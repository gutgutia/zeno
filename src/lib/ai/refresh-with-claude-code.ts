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

const CONFIG = {
  sandboxTimeoutMs: 300000, // 5 minutes
  commandTimeoutMs: 240000, // 4 minutes
  model: 'claude-opus-4-5',
};

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
  console.log('[Refresh Claude Code] Starting refresh/regeneration...');
  console.log('[Refresh Claude Code] Diff summary:', diff.summary);
  const startTime = Date.now();

  let sandbox: Sandbox | null = null;

  try {
    sandbox = await Sandbox.create('zeno-claude-code', {
      timeoutMs: CONFIG.sandboxTimeoutMs,
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
    const result = await sandbox.commands.run(
      `echo '${escapedPrompt}' | claude -p --dangerously-skip-permissions`,
      {
        timeoutMs: CONFIG.commandTimeoutMs,
        cwd: '/home/user',
      }
    );

    console.log('[Refresh Claude Code] Exit code:', result.exitCode);

    // Log stdout/stderr for debugging
    if (result.stderr) {
      console.log('[Refresh Claude Code] Stderr:', result.stderr.slice(0, 10000));
    }
    if (result.stdout) {
      console.log('[Refresh Claude Code] Stdout:', result.stdout.slice(0, 10000));
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
      const jsonMatch = result.stdout.match(/\{[\s\S]*"summary"[\s\S]*\}/);
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
        modelId: CONFIG.model,
      },
    };

  } finally {
    if (sandbox) {
      console.log('[Refresh Claude Code] Cleaning up sandbox...');
      await sandbox.kill();
    }
  }
}
