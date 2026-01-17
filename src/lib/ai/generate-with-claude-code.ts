/**
 * Generate dashboards using Claude Code CLI running inside E2B sandbox
 *
 * This approach gives the agent full Claude Code capabilities:
 * - Bash commands
 * - File read/write/edit
 * - Glob/Grep search
 * - Iterative development and debugging
 *
 * This should produce higher quality dashboards compared to the limited
 * MCP tool approach because Claude can iterate and refine its output.
 */

import { Sandbox } from 'e2b';
import type { DashboardConfig } from '@/types/dashboard';
import type { BrandingConfig } from '@/types/database';
import {
  LOGGING_CONFIG,
  type AgentEvent,
  logAgentEvent,
  printLogHeader,
  printLogFooter,
  extractSummaryFromStreamOutput,
} from './agent-logging';

// Configuration
const CLAUDE_CODE_CONFIG = {
  // Sandbox timeout (8 minutes)
  sandboxTimeoutMs: 480000,

  // Command timeout (7 minutes - extended for complex dashboards with extended thinking)
  commandTimeoutMs: 420000,

  // Model to use for generation
  // Options: 'sonnet' (default, balanced), 'opus' (highest quality), 'haiku' (fastest)
  model: 'sonnet',
};

export interface GenerateResult {
  config: DashboardConfig;
  usage: {
    durationMs: number;
    modelId: string;
  };
}

/**
 * Build the prompt for Claude Code
 */
function buildPrompt(branding: BrandingConfig | null, userInstructions?: string): string {
  const brandingSection = branding ? `
BRANDING REQUIREMENTS:
- Company: ${branding.companyName || 'Not specified'}
- Primary Color: ${branding.colors?.primary || '#2563EB'}
- Secondary Color: ${branding.colors?.secondary || '#0D9488'}
- Accent Color: ${branding.colors?.accent || '#8B5CF6'}
- Background: ${branding.colors?.background || '#F9FAFB'}
- Font: ${branding.fontFamily || 'system-ui, sans-serif'}
${branding.logoUrl ? `- Logo URL: ${branding.logoUrl}` : ''}
` : `
Use a professional color scheme:
- Primary: #2563EB (blue)
- Secondary: #0D9488 (teal)
- Accent: #8B5CF6 (purple)
- Background: #F9FAFB
`;

  const userSection = userInstructions
    ? `\nUSER INSTRUCTIONS:\n${userInstructions}\n`
    : '';

  return `You are transforming data into a beautiful, professional dashboard.

INPUT: The user's data is at /home/user/data.txt

OUTPUT: Write a complete, self-contained HTML file to /home/user/output.html

${brandingSection}
${userSection}
REQUIREMENTS:
1. Read and analyze the data at /home/user/data.txt
2. Determine the best visualization approach (charts, tables, cards, etc.)
3. Create a stunning, responsive HTML page with embedded CSS and JavaScript
4. Use Chart.js from CDN if charts are appropriate
5. Make it look professional and polished
6. Write the final HTML to /home/user/output.html

After writing the file, output ONLY this JSON (no markdown, no extra text):
{"summary": "Brief 1-2 sentence description of what you created"}`;
}

/**
 * Generate a dashboard using Claude Code CLI inside E2B sandbox
 *
 * This gives Claude full access to:
 * - Bash commands for data exploration
 * - File operations for iterative development
 * - The ability to test and refine output
 */
export async function generateWithClaudeCode(
  rawContent: string,
  branding: BrandingConfig | null,
  userInstructions?: string
): Promise<GenerateResult> {
  console.log('[Claude Code E2B] Starting generation...');
  console.log('[Claude Code E2B] Content length:', rawContent.length, 'characters');
  const startTime = Date.now();

  // Create sandbox with Claude Code template
  // IMPORTANT: You must build this template first using: npx tsx e2b/build.ts
  console.log('[Claude Code E2B] Creating sandbox with zeno-claude-code template...');

  let sandbox: Sandbox | null = null;

  try {
    sandbox = await Sandbox.create('zeno-claude-code', {
      timeoutMs: CLAUDE_CODE_CONFIG.sandboxTimeoutMs,
      envs: {
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
      },
    });

    console.log('[Claude Code E2B] Sandbox created successfully');

    // Write user data to sandbox
    console.log('[Claude Code E2B] Writing data to sandbox...');
    await sandbox.files.write('/home/user/data.txt', rawContent);

    // Build the prompt
    const prompt = buildPrompt(branding, userInstructions);

    // Escape the prompt for shell
    const escapedPrompt = prompt.replace(/'/g, "'\\''");

    // Run Claude Code with full permissions (safe inside sandbox)
    console.log('[Claude Code E2B] Running Claude Code CLI...');
    const commandStartTime = Date.now();

    // First, check if claude is installed and what version
    const versionCheck = await sandbox.commands.run('which claude && claude --version', {
      timeoutMs: 30000,
      cwd: '/home/user',
    }).catch((err) => {
      console.log('[Claude Code E2B] Version check failed:', err.message);
      return { stdout: '', stderr: err.message, exitCode: 1 };
    });
    console.log('[Claude Code E2B] Claude CLI check:', versionCheck.stdout || versionCheck.stderr);

    // Run the actual command with streaming JSON output for verbose logging
    let result: { stdout: string; stderr: string; exitCode: number };
    const turnCounter = { value: 0 };
    const collectedStdout: string[] = [];
    const collectedStderr: string[] = [];

    printLogHeader('Dashboard Generation');

    try {
      // Build the command with model flag
      // Note: --output-format stream-json requires --verbose when using -p
      const baseCommand = `echo '${escapedPrompt}' | claude -p --dangerously-skip-permissions --model ${CLAUDE_CODE_CONFIG.model}`;
      const command = LOGGING_CONFIG.enabled
        ? `${baseCommand} --verbose --output-format stream-json`
        : baseCommand;

      result = await sandbox.commands.run(command, {
        timeoutMs: CLAUDE_CODE_CONFIG.commandTimeoutMs,
        cwd: '/home/user',
        onStdout: (data) => {
          collectedStdout.push(data);

          if (LOGGING_CONFIG.enabled) {
            // Parse each line as JSON event
            const lines = data.split('\n').filter(line => line.trim());
            for (const line of lines) {
              try {
                const event = JSON.parse(line) as AgentEvent;

                // Track turns based on assistant messages
                if (event.type === 'assistant') {
                  turnCounter.value++;
                }

                logAgentEvent(event, turnCounter.value);
              } catch {
                // Not JSON, log as raw output if non-empty
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
      // E2B throws on non-zero exit codes, but Claude CLI might still have generated output
      console.warn('[Claude Code E2B] Command exited with error (checking if output was generated...)');

      const err = cmdError as { result?: { stdout?: string; stderr?: string; exitCode?: number }; message?: string };
      console.log('[Claude Code E2B] Exit code:', err.result?.exitCode);
      console.log('[Claude Code E2B] Collected stdout chunks:', collectedStdout.length);

      // Check if output.html was actually created - that's the real success indicator
      let outputExists = false;
      try {
        const checkResult = await sandbox.commands.run('test -f /home/user/output.html && echo "exists"', {
          timeoutMs: 5000,
        });
        outputExists = checkResult.stdout.includes('exists');
        console.log('[Claude Code E2B] output.html exists:', outputExists);
      } catch {
        console.log('[Claude Code E2B] Could not check for output.html');
      }

      if (outputExists || collectedStdout.length > 0) {
        // Output was generated - continue processing despite exit code
        console.log('[Claude Code E2B] Output was generated, continuing despite exit code');
        result = {
          stdout: collectedStdout.join(''),
          stderr: collectedStderr.join(''),
          exitCode: err.result?.exitCode || 1,
        };
      } else {
        // No output at all - check API key and throw
        const envCheck = await sandbox.commands.run('echo "ANTHROPIC_API_KEY set: ${ANTHROPIC_API_KEY:+yes}"', {
          timeoutMs: 5000,
        }).catch(() => ({ stdout: 'failed to check', stderr: '', exitCode: 1 }));
        console.log('[Claude Code E2B] API key check in sandbox:', envCheck.stdout);

        console.error('[Claude Code E2B] No output generated, throwing error');
        throw cmdError;
      }
    }

    const commandDuration = Date.now() - commandStartTime;
    printLogFooter(turnCounter.value, commandDuration);

    console.log(`[Claude Code E2B] Claude Code completed in ${commandDuration}ms`);
    console.log('[Claude Code E2B] Exit code:', result.exitCode);
    console.log('[Claude Code E2B] Total turns:', turnCounter.value);

    // Reconstruct stdout/stderr from collected chunks
    const fullStdout = collectedStdout.join('');
    const fullStderr = collectedStderr.join('');

    if (fullStderr) {
      console.log('[Claude Code E2B] Stderr:', fullStderr.slice(0, 5000));
    }

    // Read the generated HTML
    console.log('[Claude Code E2B] Reading generated HTML...');
    let html: string;

    try {
      html = await sandbox.files.read('/home/user/output.html');
      console.log('[Claude Code E2B] HTML length:', html.length, 'characters');
    } catch (readError) {
      console.error('[Claude Code E2B] Failed to read output.html:', readError);

      // Try to find any HTML file that was created
      const lsResult = await sandbox.commands.run('ls -la /home/user/', { timeoutMs: 5000 });
      console.log('[Claude Code E2B] Directory listing:', lsResult.stdout);

      throw new Error('Claude Code did not generate output.html. Check logs for details.');
    }

    // Validate HTML
    if (!html || html.length < 100) {
      throw new Error(`Generated HTML is too short (${html?.length || 0} chars)`);
    }

    if (!html.includes('<html') && !html.includes('<!DOCTYPE')) {
      console.warn('[Claude Code E2B] Warning: HTML may be incomplete');
    }

    // Extract summary from stdout if available
    const summary = extractSummaryFromStreamOutput(fullStdout) || 'Dashboard generated successfully';

    const durationMs = Date.now() - startTime;
    console.log(`[Claude Code E2B] Total generation time: ${durationMs}ms`);

    // Build config
    const config: DashboardConfig = {
      contentType: 'data',
      html,
      charts: {},
      metadata: {
        generatedAt: new Date().toISOString(),
        generationModel: CLAUDE_CODE_CONFIG.model,
        userInstructions,
        agentGenerated: true,
        claudeCodeE2B: true, // Flag to identify this approach
      },
      analysis: {
        contentType: 'data',
        summary,
        insights: [],
        suggestedVisualizations: [],
      },
    };

    return {
      config,
      usage: {
        durationMs,
        modelId: CLAUDE_CODE_CONFIG.model,
      },
    };

  } catch (error) {
    console.error('[Claude Code E2B] Error:', error);
    throw error;
  } finally {
    // Always clean up sandbox
    if (sandbox) {
      console.log('[Claude Code E2B] Cleaning up sandbox...');
      try {
        await sandbox.kill();
      } catch (killError) {
        console.error('[Claude Code E2B] Failed to kill sandbox:', killError);
      }
    }
  }
}

/**
 * Check if the Claude Code E2B approach is available
 * (requires E2B_API_KEY to be set)
 */
export function isClaudeCodeE2BAvailable(): boolean {
  const hasE2BKey = !!process.env.E2B_API_KEY;
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;

  console.log('[Claude Code E2B] Availability check:', {
    hasE2BKey,
    hasAnthropicKey,
    available: hasE2BKey && hasAnthropicKey,
  });

  return hasE2BKey && hasAnthropicKey;
}
