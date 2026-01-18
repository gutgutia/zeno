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
import { AI_CONFIG } from './config';
import {
  type AgentEvent,
  logAgentEvent,
  printLogHeader,
  printLogFooter,
  extractSummaryFromStreamOutput,
} from './agent-logging';

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
  // Build branding section with all colors, typography, and style guide
  let brandingSection: string;

  if (branding && (branding.colors?.primary || branding.styleGuide)) {
    const colorsSection = `
BRAND COLORS:
- Primary: ${branding.colors?.primary || '#2563EB'}
- Secondary: ${branding.colors?.secondary || '#64748b'}
- Accent: ${branding.colors?.accent || '#8B5CF6'}
- Button: ${branding.colors?.button || branding.colors?.primary || '#2563EB'}`;

    const typographySection = `
TYPOGRAPHY:
- Font Family: ${branding.fontFamily || 'system'}`;

    const styleGuideSection = branding.styleGuide ? `

STYLE GUIDE:
${branding.styleGuide}` : `

STYLE GUIDE:
Create a visually impressive dashboard that makes an impact. Use a bold header section with a solid primary color background and white text - this is the hero of the dashboard. Below the header, use white cards with subtle shadows, colored left borders, or accent elements. Key metrics should be large and colorful. Use the primary color prominently for headers, important values, and visual accents. The secondary color works well for supporting elements. Charts should use brand colors. Never use gradients - solid colors only.`;

    brandingSection = `${colorsSection}${typographySection}${styleGuideSection}`;
  } else {
    // Default when no branding is set
    brandingSection = `
BRAND COLORS:
- Primary: #2563EB (blue)
- Secondary: #64748b (slate)
- Accent: #8B5CF6 (purple)
- Button: #2563EB (blue)

TYPOGRAPHY:
- Font Family: system

STYLE GUIDE:
Create a visually impressive dashboard that makes an impact. Use a bold header section with a solid primary color background and white text - this is the hero of the dashboard. Below the header, use white cards with subtle shadows, colored left borders, or accent elements. Key metrics should be large and colorful. Use the primary color prominently for headers, important values, and visual accents. The secondary color works well for supporting elements. Charts should use brand colors. Never use gradients - solid colors only.`;
  }

  const userSection = userInstructions
    ? `\nUSER INSTRUCTIONS:\n${userInstructions}\n`
    : '';

  return `You are transforming data into a beautiful, professional dashboard.

INPUT: The user's data is at /home/user/data.txt

OUTPUT: Write a complete, self-contained HTML file to /home/user/output.html
${brandingSection}
${userSection}
DESIGN PRINCIPLES:
- Create visual impact: The dashboard should impress at first glance.
- Bold header: Use a solid primary color background for the header/hero section with white text.
- Card-based layout: White cards with subtle shadows or colored left borders organize content.
- Colorful metrics: Key numbers should be large and use brand colors.
- Visual hierarchy: Important information stands out through size, color, and placement.
- NEVER use gradients - they look AI-generated. Use solid colors only.
- Professional polish: Clean typography, consistent spacing, attention to detail.

REQUIREMENTS:
1. Read and analyze the data at /home/user/data.txt
2. Determine the best visualization approach (charts, tables, cards, etc.)
3. Create a stunning, responsive HTML page with embedded CSS and JavaScript
4. Use Chart.js from CDN if charts are appropriate
5. Make it visually impressive - this should look better than a spreadsheet!
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
      timeoutMs: AI_CONFIG.sandboxTimeoutMs,
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
      const baseCommand = `echo '${escapedPrompt}' | claude -p --dangerously-skip-permissions --model ${AI_CONFIG.generateModel}`;
      const command = AI_CONFIG.verboseLogging
        ? `${baseCommand} --verbose --output-format stream-json`
        : baseCommand;

      result = await sandbox.commands.run(command, {
        timeoutMs: AI_CONFIG.commandTimeoutMs,
        cwd: '/home/user',
        onStdout: (data) => {
          collectedStdout.push(data);

          if (AI_CONFIG.verboseLogging) {
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
        generationModel: AI_CONFIG.generateModel,
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
        modelId: AI_CONFIG.generateModel,
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
