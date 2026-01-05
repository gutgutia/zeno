import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { Sandbox } from '@e2b/code-interpreter';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { getAgentSystemPrompt, getAgentUserPrompt, getModifySystemPrompt, getModifyUserPrompt } from './agent-prompts';
import { getRefreshSystemPrompt, getRefreshUserPrompt } from './refresh-prompts';
import type { DashboardConfig } from '@/types/dashboard';
import type { BrandingConfig } from '@/types/database';

// Determine the path to the Claude Agent SDK executable
// Priority: 1) Global CLI, 2) Local node_modules cli.js
const getClaudeExecutablePath = () => {
  // First, try to find globally installed claude CLI
  // This is the recommended approach per Agent SDK docs
  try {
    const globalPath = execSync('which claude', { encoding: 'utf-8' }).trim();
    if (globalPath && fs.existsSync(globalPath)) {
      console.log('[Agent SDK] Found global claude CLI at:', globalPath);
      return globalPath;
    }
  } catch {
    console.log('[Agent SDK] Global claude CLI not found, checking local paths...');
  }

  // Fallback to local node_modules paths
  const possiblePaths = [
    // Try to resolve from node_modules
    (() => {
      try {
        const sdkPath = require.resolve('@anthropic-ai/claude-agent-sdk');
        return path.join(path.dirname(sdkPath), 'cli.js');
      } catch {
        return null;
      }
    })(),
    // Global npm paths (where npm install -g puts things)
    '/usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js',
    '/usr/lib/node_modules/@anthropic-ai/claude-code/cli.js',
    // Container paths
    '/app/node_modules/@anthropic-ai/claude-agent-sdk/cli.js', // Railway/DO
    '/var/task/node_modules/@anthropic-ai/claude-agent-sdk/cli.js', // Vercel
    path.join(process.cwd(), 'node_modules/@anthropic-ai/claude-agent-sdk/cli.js'), // Local
  ].filter(Boolean) as string[];

  console.log('[Agent SDK] Checking possible paths:');
  for (const p of possiblePaths) {
    const exists = fs.existsSync(p);
    console.log(`  ${p}: ${exists ? 'EXISTS' : 'NOT FOUND'}`);
    if (exists) {
      return p;
    }
  }

  // Return first path even if not found (will error later with clear message)
  console.error('[Agent SDK] WARNING: No cli.js found at any expected path!');
  return possiblePaths[0];
};

const CLAUDE_EXECUTABLE_PATH = getClaudeExecutablePath();
console.log('[Agent SDK] Using executable path:', CLAUDE_EXECUTABLE_PATH);
console.log('[Agent SDK] Environment:', {
  NODE_ENV: process.env.NODE_ENV,
  cwd: process.cwd(),
  platform: process.platform,
  nodeVersion: process.version,
  hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
  hasE2BKey: !!process.env.E2B_API_KEY,
});

// Check if cli.js is actually executable
try {
  const stats = fs.statSync(CLAUDE_EXECUTABLE_PATH);
  console.log('[Agent SDK] cli.js stats:', {
    size: stats.size,
    mode: stats.mode.toString(8),
    isFile: stats.isFile(),
  });
} catch (e) {
  console.error('[Agent SDK] Failed to stat cli.js:', e);
}

export interface RefreshResult {
  html: string;
  summary: string;
  changes: Array<{ metric: string; old: string; new: string; change?: string }>;
  warnings: string[];
}

// ============================================================================
// EXPERIMENTATION TOGGLES
// ============================================================================
export const AGENT_CONFIG = {
  // Enable extended thinking for deeper reasoning
  // This allows the agent to "think" before and between actions
  extendedThinking: true,

  // Budget for thinking tokens (higher = more reasoning time)
  thinkingBudgetTokens: 10000,

  // Max turns before stopping
  maxTurns: 15,
};
// ============================================================================

// Store sandbox reference for tool execution
let activeSandbox: Sandbox | null = null;

// Agent execution log entry
interface AgentLogEntry {
  turn: number;
  type: 'tool_call' | 'tool_result' | 'assistant' | 'system';
  timestamp: string;
  content: string;
}

// Print consolidated log at the end
function printAgentLog(log: AgentLogEntry[], totalCost?: number) {
  console.log('\n' + '='.repeat(80));
  console.log('AGENT EXECUTION LOG');
  console.log('='.repeat(80));

  for (const entry of log) {
    const prefix = `[Turn ${entry.turn}] [${entry.type.toUpperCase()}]`;
    console.log(`\n${prefix}`);
    console.log('-'.repeat(40));
    // Truncate long content for readability
    const content = entry.content.length > 500
      ? entry.content.slice(0, 500) + '... (truncated)'
      : entry.content;
    console.log(content);
  }

  console.log('\n' + '='.repeat(80));
  console.log(`SUMMARY: ${log.length} log entries, ${log.filter(e => e.type === 'tool_call').length} tool calls`);
  if (totalCost) {
    console.log(`COST: $${totalCost.toFixed(4)}`);
  }
  console.log('='.repeat(80) + '\n');
}

/**
 * Tool for reading specific lines from a file (surgical reading)
 */
const readLinesTool = tool(
  'read_lines',
  'Read specific lines from a file. Use this for surgical reading instead of loading entire files. If no line numbers specified, returns first 50 lines as a preview.',
  {
    file_path: z.string().describe('Path to the file (e.g., /tmp/existing.html)'),
    start_line: z.number().optional().describe('Starting line number (1-indexed, inclusive). Defaults to 1.'),
    end_line: z.number().optional().describe('Ending line number (1-indexed, inclusive). If not specified, reads 50 lines from start.'),
  },
  async ({ file_path, start_line, end_line }) => {
    if (!activeSandbox) {
      return {
        content: [{ type: 'text' as const, text: 'Error: Sandbox not initialized' }],
      };
    }

    try {
      const fileContent = await activeSandbox.files.read(file_path);
      const lines = fileContent.split('\n');
      const totalLines = lines.length;

      const start = (start_line ?? 1) - 1; // Convert to 0-indexed
      const end = end_line ?? Math.min(start + 50, totalLines);

      const selectedLines = lines.slice(start, end);
      const result = selectedLines.map((line, i) => `${start + i + 1}: ${line}`).join('\n');

      console.log(`[read_lines] Read lines ${start + 1}-${end} of ${totalLines} from ${file_path}`);

      return {
        content: [{
          type: 'text' as const,
          text: `Lines ${start + 1}-${end} of ${totalLines} total:\n\n${result}`
        }],
      };
    } catch (error) {
      console.error('[read_lines] Error:', error);
      return {
        content: [{ type: 'text' as const, text: `Error reading file: ${error instanceof Error ? error.message : String(error)}` }],
      };
    }
  }
);

/**
 * Tool for surgical file editing via string replacement
 */
const editFileTool = tool(
  'edit_file',
  'Make surgical edits to a file by replacing specific text. More efficient than rewriting entire files. The old_string must match exactly (including whitespace and indentation).',
  {
    file_path: z.string().describe('Path to the file (e.g., /tmp/existing.html)'),
    old_string: z.string().describe('The exact text to find and replace. Must be unique in the file.'),
    new_string: z.string().describe('The text to replace it with.'),
  },
  async ({ file_path, old_string, new_string }) => {
    if (!activeSandbox) {
      return {
        content: [{ type: 'text' as const, text: 'Error: Sandbox not initialized' }],
      };
    }

    try {
      const fileContent = await activeSandbox.files.read(file_path);

      // Check if old_string exists
      const occurrences = fileContent.split(old_string).length - 1;

      if (occurrences === 0) {
        return {
          content: [{ type: 'text' as const, text: `Error: Could not find the specified text in ${file_path}. Make sure it matches exactly including whitespace.` }],
        };
      }

      if (occurrences > 1) {
        return {
          content: [{ type: 'text' as const, text: `Error: Found ${occurrences} occurrences of the text. The old_string must be unique. Add more context to make it unique.` }],
        };
      }

      // Perform replacement
      const newContent = fileContent.replace(old_string, new_string);
      await activeSandbox.files.write(file_path, newContent);

      console.log(`[edit_file] Replaced text in ${file_path} (${old_string.length} chars -> ${new_string.length} chars)`);

      return {
        content: [{ type: 'text' as const, text: `Successfully edited ${file_path}. Replaced ${old_string.length} characters with ${new_string.length} characters.` }],
      };
    } catch (error) {
      console.error('[edit_file] Error:', error);
      return {
        content: [{ type: 'text' as const, text: `Error editing file: ${error instanceof Error ? error.message : String(error)}` }],
      };
    }
  }
);

/**
 * Tool for getting the complete modified file after edits
 */
const getFileTool = tool(
  'get_file',
  'Get the complete contents of a file. Use this ONLY after making all edits with edit_file to retrieve the final result.',
  {
    file_path: z.string().describe('Path to the file (e.g., /tmp/existing.html)'),
  },
  async ({ file_path }) => {
    if (!activeSandbox) {
      return {
        content: [{ type: 'text' as const, text: 'Error: Sandbox not initialized' }],
      };
    }

    try {
      const fileContent = await activeSandbox.files.read(file_path);
      console.log(`[get_file] Retrieved ${file_path} (${fileContent.length} chars)`);

      return {
        content: [{ type: 'text' as const, text: fileContent }],
      };
    } catch (error) {
      console.error('[get_file] Error:', error);
      return {
        content: [{ type: 'text' as const, text: `Error reading file: ${error instanceof Error ? error.message : String(error)}` }],
      };
    }
  }
);

/**
 * Tool for executing Python code in E2B sandbox
 */
const executePythonTool = tool(
  'execute_python',
  'Execute Python code in a sandbox. The sandbox has pandas, numpy, json, csv, re, datetime, and collections available. Use this to read /tmp/data.txt and compute metrics. Print results to stdout.',
  {
    code: z.string().describe('Python code to execute. Results should be printed to stdout.'),
  },
  async ({ code }) => {
    if (!activeSandbox) {
      return {
        content: [{ type: 'text' as const, text: 'Error: Sandbox not initialized' }],
      };
    }

    try {
      // Log the Python code being executed (truncated for readability)
      const codePreview = code.length > 300 ? code.slice(0, 300) + '\n... (truncated)' : code;
      console.log('[Python] Executing:\n' + '-'.repeat(40));
      console.log(codePreview);
      console.log('-'.repeat(40));

      const execution = await activeSandbox.runCode(code);

      const stdout = execution.logs.stdout.join('\n');
      const stderr = execution.logs.stderr.join('\n');

      if (stderr && !stdout) {
        console.log('[Python] Error:', stderr);
        return {
          content: [{ type: 'text' as const, text: `Error: ${stderr}` }],
        };
      }

      // Log the output (truncated for readability)
      const outputPreview = stdout.length > 500 ? stdout.slice(0, 500) + '\n... (truncated)' : stdout;
      console.log('[Python] Output:\n' + '-'.repeat(40));
      console.log(outputPreview || '(no output)');
      console.log('-'.repeat(40));

      return {
        content: [{ type: 'text' as const, text: stdout || 'Code executed successfully (no output)' }],
      };
    } catch (error) {
      console.error('[Python] Execution error:', error);
      return {
        content: [{ type: 'text' as const, text: `Execution error: ${error instanceof Error ? error.message : String(error)}` }],
      };
    }
  }
);

/**
 * Create MCP server with the Python tool (for generation)
 */
const pythonToolServer = createSdkMcpServer({
  name: 'python',
  version: '1.0.0',
  tools: [executePythonTool],
});

/**
 * Create MCP server with file editing tools (for modification)
 * Includes surgical read/edit tools for efficient modifications
 */
const modifyToolServer = createSdkMcpServer({
  name: 'filetools',
  version: '1.0.0',
  tools: [readLinesTool, editFileTool, getFileTool, executePythonTool],
});

/**
 * Extract JSON result from agent's final response
 */
function extractJsonFromResult(result: string): { html: string; summary: string } | null {
  // Try to parse the entire result as JSON
  try {
    const parsed = JSON.parse(result);
    if (parsed.html) return parsed;
  } catch {
    // Not pure JSON, try to extract
  }

  // Try to find JSON in the result
  const jsonMatch = result.match(/\{[\s\S]*"html"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      // Clean up potential markdown code blocks
      let jsonStr = jsonMatch[0];
      if (jsonStr.includes('```')) {
        jsonStr = jsonStr.replace(/```json?\s*/g, '').replace(/```/g, '');
      }
      const parsed = JSON.parse(jsonStr);
      if (parsed.html) return parsed;
    } catch {
      // Failed to parse extracted JSON
    }
  }

  return null;
}

/**
 * Generate a dashboard/page using the agentic approach with E2B
 *
 * This function:
 * 1. Creates an E2B sandbox
 * 2. Writes the user's content to the sandbox
 * 3. Runs an agent loop that can execute Python to analyze the content
 * 4. Returns the generated HTML
 */
export async function generateWithAgent(
  rawContent: string,
  branding: BrandingConfig | null,
  userInstructions?: string
): Promise<DashboardConfig> {
  console.log('[Agent] Starting agentic generation...');
  console.log('[Agent] Content length:', rawContent.length, 'characters');

  // Create E2B sandbox
  console.log('[Agent] Creating E2B sandbox...');
  activeSandbox = await Sandbox.create({
    timeoutMs: 300000, // 5 minute max
  });

  try {
    // Write content to sandbox
    console.log('[Agent] Writing content to sandbox...');
    await activeSandbox.files.write('/tmp/data.txt', rawContent);

    // Get prompts
    const systemPrompt = getAgentSystemPrompt(branding);
    const userPrompt = getAgentUserPrompt(userInstructions);

    console.log('[Agent] Starting agent loop...');
    console.log(`[Agent] Extended thinking: ${AGENT_CONFIG.extendedThinking ? 'ENABLED' : 'DISABLED'}`);
    let finalResult: { html: string; summary: string } | null = null;
    let turnCount = 0;
    let totalCost: number | undefined;
    const agentLog: AgentLogEntry[] = [];

    // Build query options
    const queryOptions: Parameters<typeof query>[0]['options'] = {
      model: 'claude-opus-4-5-20251101',
      systemPrompt,
      maxTurns: AGENT_CONFIG.maxTurns,
      mcpServers: {
        python: pythonToolServer,
      },
      allowedTools: ['mcp__python__execute_python'],
      pathToClaudeCodeExecutable: CLAUDE_EXECUTABLE_PATH,
    };

    // Add extended thinking if enabled
    if (AGENT_CONFIG.extendedThinking) {
      // @ts-expect-error - thinking option may not be in SDK types yet
      queryOptions.thinking = {
        type: 'enabled',
        budget_tokens: AGENT_CONFIG.thinkingBudgetTokens,
      };
    }

    // Run the agent loop
    try {
      for await (const message of query({
        prompt: userPrompt,
        options: queryOptions,
      })) {
        const timestamp = new Date().toISOString();

        if (message.type === 'assistant') {
          turnCount++;
          console.log(`[Agent] Turn ${turnCount}: Assistant message`);
          // Try to extract text content from assistant message
          const msg = message as { content?: Array<{ type: string; text?: string; name?: string; input?: unknown }> };
          if (msg.content) {
            for (const block of msg.content) {
              if (block.type === 'text' && block.text) {
                agentLog.push({
                  turn: turnCount,
                  type: 'assistant',
                  timestamp,
                  content: block.text,
                });
              } else if (block.type === 'tool_use') {
                agentLog.push({
                  turn: turnCount,
                  type: 'tool_call',
                  timestamp,
                  content: `Tool: ${block.name}\nInput: ${JSON.stringify(block.input, null, 2)}`,
                });
              }
            }
          }
        } else if (message.type === 'tool_progress') {
          agentLog.push({
            turn: turnCount,
            type: 'tool_result',
            timestamp,
            content: `Tool: ${message.tool_name} (in progress)`,
          });
        } else if (message.type === 'stream_event') {
          // Ignore stream events for logging
        } else if (message.type === 'result') {
          console.log(`[Agent] Completed after ${turnCount} turns`);
          if (message.subtype === 'success') {
            totalCost = message.total_cost_usd;
            console.log(`[Agent] Total cost: $${totalCost?.toFixed(4) || 'unknown'}`);
            finalResult = extractJsonFromResult(message.result);
          } else {
            // Error result
            const errorResult = message as { errors?: string[] };
            throw new Error(`Agent error: ${errorResult.errors?.join(', ') || 'Unknown error'}`);
          }
        } else if (message.type === 'system') {
          console.log(`[Agent] System message: ${message.subtype}`);
          agentLog.push({
            turn: turnCount,
            type: 'system',
            timestamp,
            content: `System: ${message.subtype}`,
          });
        }
      }

      // Print consolidated log
      printAgentLog(agentLog, totalCost);
    } catch (agentError) {
      console.error('[Agent] SDK Error:', agentError);
      console.error('[Agent] Error details:', JSON.stringify(agentError, Object.getOwnPropertyNames(agentError)));
      throw agentError;
    }

    if (!finalResult?.html) {
      throw new Error('Agent did not produce HTML output');
    }

    console.log('[Agent] Generation complete. HTML length:', finalResult.html.length);

    // Build and return the config
    return {
      contentType: 'data',
      html: finalResult.html,
      charts: {}, // All visualizations are inline
      metadata: {
        generatedAt: new Date().toISOString(),
        generationModel: 'claude-opus-4-5-20251101',
        userInstructions,
        agentGenerated: true,
        turnCount,
        extendedThinking: AGENT_CONFIG.extendedThinking,
      },
      analysis: {
        contentType: 'data',
        summary: finalResult.summary || 'Content transformed',
        insights: [],
        suggestedVisualizations: [],
      },
    };
  } finally {
    // Always close the sandbox
    console.log('[Agent] Closing E2B sandbox...');
    if (activeSandbox) {
      await activeSandbox.kill();
      activeSandbox = null;
    }
  }
}

/**
 * Extract refresh JSON result from agent's response
 */
function extractRefreshResult(result: string): RefreshResult | null {
  try {
    const parsed = JSON.parse(result);
    if (parsed.html) {
      return {
        html: parsed.html,
        summary: parsed.summary || 'Dashboard updated with new data',
        changes: parsed.changes || [],
        warnings: parsed.warnings || [],
      };
    }
  } catch {
    // Not pure JSON, try to extract
  }

  const jsonMatch = result.match(/\{[\s\S]*"html"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      let jsonStr = jsonMatch[0];
      if (jsonStr.includes('```')) {
        jsonStr = jsonStr.replace(/```json?\s*/g, '').replace(/```/g, '');
      }
      const parsed = JSON.parse(jsonStr);
      if (parsed.html) {
        return {
          html: parsed.html,
          summary: parsed.summary || 'Dashboard updated with new data',
          changes: parsed.changes || [],
          warnings: parsed.warnings || [],
        };
      }
    } catch {
      // Failed to parse
    }
  }

  return null;
}

/**
 * Refresh a dashboard with new data while preserving its structure.
 *
 * This function:
 * 1. Creates an E2B sandbox
 * 2. Writes the new data and existing HTML to the sandbox
 * 3. Runs an agent loop to update the values in the HTML
 * 4. Returns the updated HTML with preserved structure
 */
export async function refreshDashboardWithAgent(
  newRawContent: string,
  existingConfig: DashboardConfig,
  branding: BrandingConfig | null
): Promise<RefreshResult> {
  console.log('[Refresh Agent] Starting dashboard refresh...');
  console.log('[Refresh Agent] New content length:', newRawContent.length, 'characters');
  console.log('[Refresh Agent] Existing HTML length:', existingConfig.html.length, 'characters');

  // Create E2B sandbox
  console.log('[Refresh Agent] Creating E2B sandbox...');
  activeSandbox = await Sandbox.create({
    timeoutMs: 300000, // 5 minute max
  });

  try {
    // Write new data and existing HTML to sandbox
    console.log('[Refresh Agent] Writing files to sandbox...');
    await activeSandbox.files.write('/tmp/data.txt', newRawContent);
    await activeSandbox.files.write('/tmp/existing.html', existingConfig.html);

    // Get prompts
    const systemPrompt = getRefreshSystemPrompt(branding);
    const userPrompt = getRefreshUserPrompt(
      existingConfig.html,
      existingConfig.analysis?.summary
    );

    console.log('[Refresh Agent] Starting agent loop...');
    let refreshResult: RefreshResult | null = null;
    let turnCount = 0;

    // Build query options - use less thinking budget for refresh (simpler task)
    const queryOptions: Parameters<typeof query>[0]['options'] = {
      model: 'claude-opus-4-5-20251101',
      systemPrompt,
      maxTurns: 10, // Fewer turns for refresh
      mcpServers: {
        python: pythonToolServer,
      },
      allowedTools: ['mcp__python__execute_python'],
      pathToClaudeCodeExecutable: CLAUDE_EXECUTABLE_PATH,
    };

    // Add extended thinking with reduced budget
    if (AGENT_CONFIG.extendedThinking) {
      // @ts-expect-error - thinking option may not be in SDK types yet
      queryOptions.thinking = {
        type: 'enabled',
        budget_tokens: 5000, // Less thinking needed for refresh
      };
    }

    // Run the agent loop
    for await (const message of query({
      prompt: userPrompt,
      options: queryOptions,
    })) {
      if (message.type === 'assistant') {
        turnCount++;
        console.log(`[Refresh Agent] Turn ${turnCount}: Assistant message`);
      } else if (message.type === 'tool_progress') {
        console.log(`[Refresh Agent] Tool progress: ${message.tool_name}`);
      } else if (message.type === 'result') {
        console.log(`[Refresh Agent] Completed after ${turnCount} turns`);
        if (message.subtype === 'success') {
          console.log(`[Refresh Agent] Total cost: $${message.total_cost_usd?.toFixed(4) || 'unknown'}`);
          refreshResult = extractRefreshResult(message.result);
        } else {
          const errorResult = message as { errors?: string[] };
          throw new Error(`Refresh agent error: ${errorResult.errors?.join(', ') || 'Unknown error'}`);
        }
      } else if (message.type === 'system') {
        console.log(`[Refresh Agent] System message: ${message.subtype}`);
      }
    }

    if (!refreshResult?.html) {
      throw new Error('Refresh agent did not produce HTML output');
    }

    console.log('[Refresh Agent] Refresh complete. HTML length:', refreshResult.html.length);
    console.log('[Refresh Agent] Changes detected:', refreshResult.changes.length);

    return refreshResult;
  } finally {
    console.log('[Refresh Agent] Closing E2B sandbox...');
    if (activeSandbox) {
      await activeSandbox.kill();
      activeSandbox = null;
    }
  }
}

/**
 * Result from modifying a dashboard
 */
export interface ModifyResult {
  html: string;
  summary: string;
}

/**
 * Extract modify JSON result from agent's response
 */
function extractModifyResult(result: string): ModifyResult | null {
  try {
    const parsed = JSON.parse(result);
    if (parsed.html) {
      return {
        html: parsed.html,
        summary: parsed.summary || 'Dashboard modified',
      };
    }
  } catch {
    // Not pure JSON, try to extract
  }

  const jsonMatch = result.match(/\{[\s\S]*"html"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      let jsonStr = jsonMatch[0];
      if (jsonStr.includes('```')) {
        jsonStr = jsonStr.replace(/```json?\s*/g, '').replace(/```/g, '');
      }
      const parsed = JSON.parse(jsonStr);
      if (parsed.html) {
        return {
          html: parsed.html,
          summary: parsed.summary || 'Dashboard modified',
        };
      }
    } catch {
      // Failed to parse
    }
  }

  return null;
}

/**
 * Modify a dashboard based on user instructions.
 *
 * This function:
 * 1. Creates an E2B sandbox
 * 2. Writes the existing HTML and data to the sandbox
 * 3. Runs an agent loop to make the requested modifications
 * 4. Returns the updated HTML
 */
export async function modifyDashboardWithAgent(
  existingHtml: string,
  rawContent: string,
  instructions: string,
  branding: BrandingConfig | null
): Promise<ModifyResult> {
  console.log('[Modify Agent] Starting dashboard modification...');
  console.log('[Modify Agent] Instructions:', instructions);
  console.log('[Modify Agent] Existing HTML length:', existingHtml.length, 'characters');

  // Create E2B sandbox
  console.log('[Modify Agent] Creating E2B sandbox...');
  activeSandbox = await Sandbox.create({
    timeoutMs: 300000, // 5 minute max
  });

  try {
    // Write existing HTML and data to sandbox
    console.log('[Modify Agent] Writing files to sandbox...');
    await activeSandbox.files.write('/tmp/existing.html', existingHtml);
    await activeSandbox.files.write('/tmp/data.txt', rawContent);

    // Get prompts
    const systemPrompt = getModifySystemPrompt(branding);
    const userPrompt = getModifyUserPrompt(instructions);

    console.log('[Modify Agent] Starting agent loop...');
    let modifyResult: ModifyResult | null = null;
    let turnCount = 0;
    let totalCost: number | undefined;
    const agentLog: AgentLogEntry[] = [];

    // Build query options - use Sonnet 4.5 for modifications (cheaper than Opus)
    const queryOptions: Parameters<typeof query>[0]['options'] = {
      model: 'claude-sonnet-4-5',
      systemPrompt,
      maxTurns: AGENT_CONFIG.maxTurns,
      mcpServers: {
        filetools: modifyToolServer,
      },
      allowedTools: [
        'mcp__filetools__read_lines',
        'mcp__filetools__edit_file',
        'mcp__filetools__get_file',
        'mcp__filetools__execute_python',
      ],
      pathToClaudeCodeExecutable: CLAUDE_EXECUTABLE_PATH,
    };

    // Add extended thinking with reduced budget for modifications
    if (AGENT_CONFIG.extendedThinking) {
      // @ts-expect-error - thinking option may not be in SDK types yet
      queryOptions.thinking = {
        type: 'enabled',
        budget_tokens: 5000, // Less thinking needed for modifications
      };
    }

    // Run the agent loop
    for await (const message of query({
      prompt: userPrompt,
      options: queryOptions,
    })) {
      const timestamp = new Date().toISOString();

      if (message.type === 'assistant') {
        turnCount++;
        console.log(`[Modify Agent] Turn ${turnCount}: Assistant message`);
        const msg = message as { content?: Array<{ type: string; text?: string; name?: string; input?: unknown }> };
        if (msg.content) {
          for (const block of msg.content) {
            if (block.type === 'text' && block.text) {
              agentLog.push({
                turn: turnCount,
                type: 'assistant',
                timestamp,
                content: block.text,
              });
            } else if (block.type === 'tool_use') {
              agentLog.push({
                turn: turnCount,
                type: 'tool_call',
                timestamp,
                content: `Tool: ${block.name}\nInput: ${JSON.stringify(block.input, null, 2)}`,
              });
            }
          }
        }
      } else if (message.type === 'tool_progress') {
        agentLog.push({
          turn: turnCount,
          type: 'tool_result',
          timestamp,
          content: `Tool: ${message.tool_name} (in progress)`,
        });
      } else if (message.type === 'result') {
        console.log(`[Modify Agent] Completed after ${turnCount} turns`);
        if (message.subtype === 'success') {
          totalCost = message.total_cost_usd;
          console.log(`[Modify Agent] Total cost: $${totalCost?.toFixed(4) || 'unknown'}`);
          modifyResult = extractModifyResult(message.result);
        } else {
          const errorResult = message as { errors?: string[] };
          throw new Error(`Modify agent error: ${errorResult.errors?.join(', ') || 'Unknown error'}`);
        }
      } else if (message.type === 'system') {
        console.log(`[Modify Agent] System message: ${message.subtype}`);
      }
    }

    // Print consolidated log
    printAgentLog(agentLog, totalCost);

    if (!modifyResult?.html) {
      throw new Error('Modify agent did not produce HTML output');
    }

    console.log('[Modify Agent] Modification complete. HTML length:', modifyResult.html.length);

    return modifyResult;
  } finally {
    console.log('[Modify Agent] Closing E2B sandbox...');
    if (activeSandbox) {
      await activeSandbox.kill();
      activeSandbox = null;
    }
  }
}
