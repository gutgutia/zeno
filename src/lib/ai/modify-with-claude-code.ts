/**
 * Modify dashboards using Claude Code CLI running inside E2B sandbox
 *
 * This approach is used for complex modifications that the direct approach can't handle:
 * - When direct modification fails (edits don't match)
 * - When the modification is too complex for surgical edits
 * - When user explicitly requests a redesign
 *
 * Gives Claude full access to Bash, Read, Write, Edit, Glob, Grep for iterative development.
 */

import { Sandbox } from 'e2b';
import type { BrandingConfig } from '@/types/database';
import type { ModifyResultWithUsage } from './agent';

const CONFIG = {
  sandboxTimeoutMs: 300000, // 5 minutes
  commandTimeoutMs: 240000, // 4 minutes
  model: 'claude-opus-4-5',
};

/**
 * Build the prompt for Claude Code modification
 */
function buildModifyPrompt(
  instructions: string,
  branding: BrandingConfig | null
): string {
  const brandingSection = branding ? `
BRANDING:
- Company: ${branding.companyName || 'Not specified'}
- Primary: ${branding.colors?.primary || '#2563EB'}
- Secondary: ${branding.colors?.secondary || '#0D9488'}
- Font: ${branding.fontFamily || 'system-ui, sans-serif'}
` : '';

  return `You are modifying an existing dashboard based on user instructions.

FILES:
- /home/user/existing.html - The current dashboard HTML (read this first)
- /home/user/data.txt - The underlying data (if you need it)

OUTPUT: Write the modified HTML to /home/user/output.html

${brandingSection}

USER INSTRUCTIONS:
${instructions}

WORKFLOW:
1. Read /home/user/existing.html to understand the current dashboard
2. Read /home/user/data.txt if you need data context
3. Make the requested modifications
4. Write the complete modified HTML to /home/user/output.html

IMPORTANT:
- Preserve existing structure and styling unless asked to change
- Make targeted changes based on the instructions
- Keep the dashboard functional and responsive

After writing output.html, output ONLY this JSON (no markdown):
{"summary": "Brief description of changes made"}`;
}

/**
 * Modify a dashboard using Claude Code CLI inside E2B sandbox
 */
export async function modifyWithClaudeCode(
  existingHtml: string,
  rawContent: string,
  instructions: string,
  branding: BrandingConfig | null
): Promise<ModifyResultWithUsage> {
  console.log('[Modify Claude Code] Starting modification...');
  console.log('[Modify Claude Code] Instructions:', instructions.slice(0, 500));
  const startTime = Date.now();

  let sandbox: Sandbox | null = null;

  try {
    sandbox = await Sandbox.create('zeno-claude-code', {
      timeoutMs: CONFIG.sandboxTimeoutMs,
      envs: {
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
      },
    });

    console.log('[Modify Claude Code] Sandbox created');

    // Write files to sandbox
    await sandbox.files.write('/home/user/existing.html', existingHtml);
    await sandbox.files.write('/home/user/data.txt', rawContent);

    // Build and run prompt
    const prompt = buildModifyPrompt(instructions, branding);
    const escapedPrompt = prompt.replace(/'/g, "'\\''");

    console.log('[Modify Claude Code] Running Claude Code CLI...');
    const result = await sandbox.commands.run(
      `echo '${escapedPrompt}' | claude -p --dangerously-skip-permissions`,
      {
        timeoutMs: CONFIG.commandTimeoutMs,
        cwd: '/home/user',
      }
    );

    console.log('[Modify Claude Code] Exit code:', result.exitCode);

    // Log stdout/stderr for debugging
    if (result.stderr) {
      console.log('[Modify Claude Code] Stderr:', result.stderr.slice(0, 10000));
    }
    if (result.stdout) {
      console.log('[Modify Claude Code] Stdout:', result.stdout.slice(0, 10000));
    }

    // Read the output
    let html: string;
    try {
      html = await sandbox.files.read('/home/user/output.html');
      console.log('[Modify Claude Code] Output HTML length:', html.length);
    } catch {
      console.error('[Modify Claude Code] Failed to read output.html');
      throw new Error('Claude Code did not generate output.html');
    }

    // Extract summary
    let summary = 'Dashboard modified';
    try {
      const jsonMatch = result.stdout.match(/\{[^{}]*"summary"[^{}]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.summary) summary = parsed.summary;
      }
    } catch {
      // Use default summary
    }

    const durationMs = Date.now() - startTime;
    console.log(`[Modify Claude Code] Completed in ${durationMs}ms`);

    return {
      html,
      summary,
      usage: {
        usage: { inputTokens: 0, outputTokens: 0 }, // Claude Code tracks internally
        costUsd: 0,
        turnCount: 0,
        durationMs,
        modelId: CONFIG.model,
      },
    };

  } finally {
    if (sandbox) {
      console.log('[Modify Claude Code] Cleaning up sandbox...');
      await sandbox.kill();
    }
  }
}
