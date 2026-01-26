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
import { getAIConfig } from './config';
import {
  type AgentEvent,
  logAgentEvent,
  printLogHeader,
  printLogFooter,
} from './agent-logging';
import { TEMPLATE_ALIASES } from '../../../e2b/template';
import { AGENT_UTILS_PYTHON } from './generate-with-claude-code';

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
 * Build the prompt for Claude Code refresh
 * Uses different prompts based on the severity of data changes:
 * - Values only: Surgical update, preserve layout exactly
 * - Minor schema change: Preserve layout, adapt minimally
 * - Major schema change: Regenerate with same style
 */
function buildRefreshPrompt(): string {
  return `You are updating a dashboard with new data.

INPUT:
- /home/user/existing.html - Current dashboard
- /home/user/data.txt - New data (source of truth)

OUTPUT: Write updated HTML to /home/user/output.html

GOAL: Make all values, counts, tables, and charts accurately reflect the new data.
Preserve the existing design unless the data structure changed significantly.

A utility library is available at /home/user/agent_utils.py if you need help parsing data or building components.

After writing output.html, output ONLY this JSON:
{"summary": "Brief description of changes"}`;
}

/**
 * Refresh a dashboard using Claude Code CLI inside E2B sandbox
 * Used when direct refresh determines regeneration is needed
 */
export async function refreshWithClaudeCode(
  newContent: string,
  currentConfig: DashboardConfig,
  branding: BrandingConfig | null
): Promise<RefreshWithClaudeCodeResult> {
  // Fetch config from database (with fallback to defaults)
  const config = await getAIConfig();

  const templateType = config.sandboxTemplate;
  const templateAlias = TEMPLATE_ALIASES[templateType];

  console.log(`[Refresh Claude Code] Starting refresh with ${templateType} template...`);
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

    // Write utility library (available if the agent wants to use it)
    if (templateType === 'python') {
      await sandbox.files.write('/home/user/agent_utils.py', AGENT_UTILS_PYTHON);
    }

    // Build and run prompt
    const prompt = buildRefreshPrompt();
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
