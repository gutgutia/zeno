/**
 * Refresh dashboards using Claude Code CLI running inside E2B sandbox
 *
 * This approach is used when:
 * - Direct surgical refresh signals need for regeneration
 * - Schema changes are too significant for surgical edits
 * - Domain of data fundamentally changed
 *
 * Gives Claude full access to analyze new data and regenerate appropriate visualizations.
 */

import { Sandbox } from 'e2b';
import type { BrandingConfig } from '@/types/database';
import type { DashboardConfig } from '@/types/dashboard';
import type { DataDiff } from '@/lib/data/diff';
import { formatDiffForAI } from '@/lib/data/diff';
import { getAIConfig } from './config';
import {
  type AgentEvent,
  logAgentEvent,
  printLogHeader,
  printLogFooter,
} from './agent-logging';
import { TEMPLATE_ALIASES } from '../../../e2b/template';

export interface RefreshWithClaudeCodeResult {
  html: string;
  summary: string;
  changes: Array<{ metric: string; old: string; new: string }>;
  usage: {
    durationMs: number;
    modelId: string;
  };
}

/**
 * Build the prompt for Claude Code refresh/regeneration
 */
function buildRefreshPrompt(
  diff: DataDiff,
  branding: BrandingConfig | null,
  originalSummary?: string
): string {
  const brandingSection = branding ? `
BRANDING:
- Company: ${branding.companyName || 'Not specified'}
- Primary: ${branding.colors?.primary || '#2563EB'}
- Secondary: ${branding.colors?.secondary || '#0D9488'}
- Font: ${branding.fontFamily || 'system-ui, sans-serif'}
` : '';

  const diffSummary = formatDiffForAI(diff);
  const contextSection = originalSummary ? `
ORIGINAL DASHBOARD PURPOSE:
${originalSummary}
` : '';

  return `You are refreshing a dashboard with new data. The data has changed significantly, so you'll create an updated dashboard.

FILES:
- /home/user/existing.html - The previous dashboard HTML (for reference on style/layout)
- /home/user/data.txt - The NEW data to visualize

OUTPUT: Write the refreshed HTML to /home/user/output.html

${brandingSection}
${contextSection}

DATA CHANGES:
${diffSummary}

WORKFLOW:
1. Read /home/user/existing.html to understand the previous dashboard's style and approach
2. Read /home/user/data.txt to analyze the NEW data
3. Create an updated dashboard that:
   - Preserves the visual style and branding from the original
   - Properly visualizes the NEW data
   - Adapts to any schema changes (new/removed columns)
4. Write the complete HTML to /home/user/output.html

IMPORTANT:
- Keep the same professional look and feel
- Adapt visualizations to match the new data structure
- If columns were added, consider adding new charts/cards
- If columns were removed, remove corresponding visualizations

After writing output.html, output ONLY this JSON (no markdown):
{"summary": "Brief description of refresh", "changes": [{"metric": "Name", "old": "oldValue", "new": "newValue"}]}`;
}

/**
 * Refresh a dashboard using Claude Code CLI inside E2B sandbox
 * Used when direct refresh determines regeneration is needed
 */
export async function refreshWithClaudeCode(
  newContent: string,
  currentConfig: DashboardConfig,
  branding: BrandingConfig | null,
  diff: DataDiff
): Promise<RefreshWithClaudeCodeResult> {
  // Fetch config from database (with fallback to defaults)
  const config = await getAIConfig();

  const templateType = config.sandboxTemplate;
  const templateAlias = TEMPLATE_ALIASES[templateType];

  console.log(`[Refresh Claude Code] Starting refresh/regeneration with ${templateType} template...`);
  console.log('[Refresh Claude Code] Diff summary:', diff.summary);
  const startTime = Date.now();

  let sandbox: Sandbox | null = null;

  try {
    sandbox = await Sandbox.create(templateAlias, {
      timeoutMs: config.sandboxTimeoutMs,
      envs: {
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
      },
    });

    console.log('[Refresh Claude Code] Sandbox created');

    // Write files to sandbox
    await sandbox.files.write('/home/user/existing.html', currentConfig.html);
    await sandbox.files.write('/home/user/data.txt', newContent);

    // Build and run prompt
    const prompt = buildRefreshPrompt(diff, branding, currentConfig.analysis?.summary);
    const escapedPrompt = prompt.replace(/'/g, "'\\''");

    console.log('[Refresh Claude Code] Running Claude Code CLI...');
    const commandStartTime = Date.now();
    const turnCounter = { value: 0 };
    const collectedStdout: string[] = [];
    const collectedStderr: string[] = [];

    printLogHeader('Dashboard Refresh');

    // Build the command with model flag
    const baseCommand = `echo '${escapedPrompt}' | claude -p --dangerously-skip-permissions --model ${config.refreshModel}`;
    const command = config.verboseLogging
      ? `${baseCommand} --verbose --output-format stream-json`
      : baseCommand;

    let result: { stdout: string; stderr: string; exitCode: number };

    try {
      result = await sandbox.commands.run(command, {
        timeoutMs: config.commandTimeoutMs,
        cwd: '/home/user',
        onStdout: (data) => {
          collectedStdout.push(data);

          if (config.verboseLogging) {
            const lines = data.split('\n').filter(line => line.trim());
            for (const line of lines) {
              try {
                const event = JSON.parse(line) as AgentEvent;
                if (event.type === 'assistant') {
                  turnCounter.value++;
                }
                logAgentEvent(event, turnCounter.value);
              } catch {
                if (line.trim() && !line.startsWith('{')) {
                  console.log(`[Raw] ${line}`);
                }
              }
            }
          }
        },
        onStderr: (data) => {
          collectedStderr.push(data);
          if (data.trim()) {
            console.log(`[Stderr] ${data}`);
          }
        },
      });
    } catch (cmdError: unknown) {
      console.warn('[Refresh Claude Code] Command exited with error (checking if output was generated...)');

      const err = cmdError as { result?: { exitCode?: number } };
      console.log('[Refresh Claude Code] Collected stdout chunks:', collectedStdout.length);

      let outputExists = false;
      try {
        const checkResult = await sandbox.commands.run('test -f /home/user/output.html && echo "exists"', {
          timeoutMs: 5000,
        });
        outputExists = checkResult.stdout.includes('exists');
        console.log('[Refresh Claude Code] output.html exists:', outputExists);
      } catch {
        console.log('[Refresh Claude Code] Could not check for output.html');
      }

      if (outputExists || collectedStdout.length > 0) {
        console.log('[Refresh Claude Code] Output was generated, continuing despite exit code');
        result = {
          stdout: collectedStdout.join(''),
          stderr: collectedStderr.join(''),
          exitCode: err.result?.exitCode || 1,
        };
      } else {
        console.error('[Refresh Claude Code] No output generated, throwing error');
        throw cmdError;
      }
    }

    const commandDuration = Date.now() - commandStartTime;
    printLogFooter(turnCounter.value, commandDuration);

    console.log('[Refresh Claude Code] Exit code:', result.exitCode);
    console.log('[Refresh Claude Code] Total turns:', turnCounter.value);

    const fullStdout = collectedStdout.join('');
    const fullStderr = collectedStderr.join('');

    if (fullStderr) {
      console.log('[Refresh Claude Code] Stderr:', fullStderr.slice(0, 5000));
    }

    // Read the output
    let html: string;
    try {
      html = await sandbox.files.read('/home/user/output.html');
      console.log('[Refresh Claude Code] Output HTML length:', html.length);
    } catch {
      console.error('[Refresh Claude Code] Failed to read output.html');
      throw new Error('Claude Code did not generate output.html');
    }

    // Extract summary and changes
    let summary = 'Dashboard refreshed with new data';
    let changes: Array<{ metric: string; old: string; new: string }> = [];

    try {
      // Try to find JSON with summary and changes in the output
      const jsonMatch = fullStdout.match(/\{[\s\S]*"summary"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.summary) summary = parsed.summary;
        if (parsed.changes) changes = parsed.changes;
      }
    } catch {
      // Use defaults
    }

    const durationMs = Date.now() - startTime;
    console.log(`[Refresh Claude Code] Completed in ${durationMs}ms`);

    return {
      html,
      summary,
      changes,
      usage: {
        durationMs,
        modelId: config.refreshModel,
      },
    };

  } finally {
    if (sandbox) {
      console.log('[Refresh Claude Code] Cleaning up sandbox...');
      await sandbox.kill();
    }
  }
}
