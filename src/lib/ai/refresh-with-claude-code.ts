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
 * Build the prompt for Claude Code refresh
 * Uses different prompts based on the severity of data changes:
 * - Values only: Surgical update, preserve layout exactly
 * - Minor schema change: Preserve layout, adapt minimally
 * - Major schema change: Regenerate with same style
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

  // Determine the refresh strategy based on diff
  const columnsAdded = diff.schema?.columnsAdded || [];
  const columnsRemoved = diff.schema?.columnsRemoved || [];
  const totalColumns = (diff.schema?.columnsUnchanged?.length || 0) + columnsAdded.length;

  const isMajorSchemaChange = diff.domainChanged ||
    (columnsAdded.length + columnsRemoved.length > Math.max(3, totalColumns * 0.3));

  const isMinorSchemaChange = !isMajorSchemaChange &&
    (columnsAdded.length > 0 || columnsRemoved.length > 0);

  // Default: Values-only change - most conservative
  if (!isMinorSchemaChange && !isMajorSchemaChange) {
    return `You are updating a dashboard with new data values. The data structure is the same, only values changed.

FILES:
- /home/user/existing.html - The current dashboard HTML (PRESERVE THIS LAYOUT)
- /home/user/data.txt - The NEW data with updated values

OUTPUT: Write the updated HTML to /home/user/output.html

${brandingSection}
${contextSection}

DATA CHANGES:
${diffSummary}

WORKFLOW:
1. Read /home/user/existing.html carefully - you must preserve its EXACT structure
2. Read /home/user/data.txt to see the new values
3. Update ONLY the data values in the HTML - do NOT change the layout or structure
4. Write the complete HTML to /home/user/output.html

CRITICAL REQUIREMENTS:
- Preserve the EXACT layout, structure, and styling of the existing dashboard
- Do NOT add, remove, or rearrange any charts, cards, tables, or sections
- Do NOT redesign or "improve" the dashboard - only update values
- Keep all CSS, classes, and HTML structure identical
- Only change the actual data values (numbers, text in tables, chart data)
- If a metric/value appears in the existing dashboard, update it with the new value
- This is a DATA UPDATE, not a redesign

After writing output.html, output ONLY this JSON (no markdown):
{"summary": "Updated data values", "changes": [{"metric": "Name", "old": "oldValue", "new": "newValue"}]}`;
  }

  // Minor schema change - preserve layout, adapt minimally
  if (isMinorSchemaChange) {
    return `You are updating a dashboard with new data. Some columns were added or removed, but the core data is similar.

FILES:
- /home/user/existing.html - The current dashboard HTML (PRESERVE THIS LAYOUT as much as possible)
- /home/user/data.txt - The NEW data

OUTPUT: Write the updated HTML to /home/user/output.html

${brandingSection}
${contextSection}

DATA CHANGES:
${diffSummary}

WORKFLOW:
1. Read /home/user/existing.html carefully - preserve its structure as much as possible
2. Read /home/user/data.txt to understand the new data
3. Update the dashboard with minimal changes:
   - Update all existing values with new data
   - If a column was removed, you may remove its visualization (but keep the overall layout)
   - If a column was added, you may add a small element for it (matching the existing style)
4. Write the complete HTML to /home/user/output.html

IMPORTANT REQUIREMENTS:
- Preserve the overall layout and visual design
- Make MINIMAL structural changes - only what's necessary for the schema change
- Keep the same styling, colors, and visual hierarchy
- Do NOT redesign or significantly restructure the dashboard
- Match the existing style for any new elements

After writing output.html, output ONLY this JSON (no markdown):
{"summary": "Brief description of changes", "changes": [{"metric": "Name", "old": "oldValue", "new": "newValue"}]}`;
  }

  // Major schema change - regenerate with same style
  return `You are refreshing a dashboard with significantly changed data. The data structure changed substantially, so you'll need to create an updated dashboard while keeping the visual style.

FILES:
- /home/user/existing.html - The previous dashboard HTML (reference for VISUAL STYLE only)
- /home/user/data.txt - The NEW data to visualize

OUTPUT: Write the refreshed HTML to /home/user/output.html

${brandingSection}
${contextSection}

DATA CHANGES:
${diffSummary}

WORKFLOW:
1. Read /home/user/existing.html to understand the visual style (colors, fonts, card styles, etc.)
2. Read /home/user/data.txt to analyze the NEW data structure
3. Create an updated dashboard that:
   - Uses the same visual style and branding from the original
   - Properly visualizes the NEW data structure
   - Creates appropriate charts/cards for the new columns
4. Write the complete HTML to /home/user/output.html

IMPORTANT:
- Keep the same professional look, colors, and visual style
- Create visualizations appropriate for the new data structure
- This is a regeneration due to major schema changes

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
