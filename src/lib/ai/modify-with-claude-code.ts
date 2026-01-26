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
import { AI_CONFIG } from './config';
import {
  type AgentEvent,
  logAgentEvent,
  printLogHeader,
  printLogFooter,
  extractSummaryFromStreamOutput,
} from './agent-logging';
import { TEMPLATE_ALIASES } from '../../../e2b/template';

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
  const templateType = AI_CONFIG.sandboxTemplate;
  const templateAlias = TEMPLATE_ALIASES[templateType];

  console.log(`[Modify Claude Code] Starting modification with ${templateType} template...`);
  console.log('[Modify Claude Code] Instructions:', instructions.slice(0, 500));
  const startTime = Date.now();

  let sandbox: Sandbox | null = null;

  try {
    sandbox = await Sandbox.create(templateAlias, {
      timeoutMs: AI_CONFIG.sandboxTimeoutMs,
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
    const commandStartTime = Date.now();
    const turnCounter = { value: 0 };
    const collectedStdout: string[] = [];
    const collectedStderr: string[] = [];

    printLogHeader('Dashboard Modification');

    // Build the command with model flag
    const baseCommand = `echo '${escapedPrompt}' | claude -p --dangerously-skip-permissions --model ${AI_CONFIG.modifyModel}`;
    const command = AI_CONFIG.verboseLogging
      ? `${baseCommand} --verbose --output-format stream-json`
      : baseCommand;

    let result: { stdout: string; stderr: string; exitCode: number };

    try {
      result = await sandbox.commands.run(command, {
        timeoutMs: AI_CONFIG.commandTimeoutMs,
        cwd: '/home/user',
        onStdout: (data) => {
          collectedStdout.push(data);

          if (AI_CONFIG.verboseLogging) {
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
      console.warn('[Modify Claude Code] Command exited with error (checking if output was generated...)');

      const err = cmdError as { result?: { exitCode?: number } };
      console.log('[Modify Claude Code] Collected stdout chunks:', collectedStdout.length);

      let outputExists = false;
      try {
        const checkResult = await sandbox.commands.run('test -f /home/user/output.html && echo "exists"', {
          timeoutMs: 5000,
        });
        outputExists = checkResult.stdout.includes('exists');
        console.log('[Modify Claude Code] output.html exists:', outputExists);
      } catch {
        console.log('[Modify Claude Code] Could not check for output.html');
      }

      if (outputExists || collectedStdout.length > 0) {
        console.log('[Modify Claude Code] Output was generated, continuing despite exit code');
        result = {
          stdout: collectedStdout.join(''),
          stderr: collectedStderr.join(''),
          exitCode: err.result?.exitCode || 1,
        };
      } else {
        console.error('[Modify Claude Code] No output generated, throwing error');
        throw cmdError;
      }
    }

    const commandDuration = Date.now() - commandStartTime;
    printLogFooter(turnCounter.value, commandDuration);

    console.log('[Modify Claude Code] Exit code:', result.exitCode);
    console.log('[Modify Claude Code] Total turns:', turnCounter.value);

    const fullStdout = collectedStdout.join('');
    const fullStderr = collectedStderr.join('');

    if (fullStderr) {
      console.log('[Modify Claude Code] Stderr:', fullStderr.slice(0, 5000));
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
    const summary = extractSummaryFromStreamOutput(fullStdout) || 'Dashboard modified';

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
        modelId: AI_CONFIG.modifyModel,
      },
    };

  } finally {
    if (sandbox) {
      console.log('[Modify Claude Code] Cleaning up sandbox...');
      await sandbox.kill();
    }
  }
}
