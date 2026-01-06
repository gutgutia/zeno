import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { Sandbox } from '@e2b/code-interpreter';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { getAgentSystemPrompt, getAgentUserPrompt, getModifySystemPrompt, getModifyUserPrompt } from './agent-prompts';
import { getRefreshSystemPrompt, getRefreshUserPrompt, getLegacyRefreshUserPrompt } from './refresh-prompts';
import { computeDataDiff, formatDiffForAI, type DataDiff } from '@/lib/data/diff';
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
// USAGE TRACKING TYPES
// ============================================================================

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  thinkingTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export interface AgentUsageResult {
  usage: TokenUsage;
  costUsd: number;
  turnCount: number;
  durationMs: number;
  modelId: string;
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
export interface GenerateResult {
  config: DashboardConfig;
  usage: AgentUsageResult;
}

export async function generateWithAgent(
  rawContent: string,
  branding: BrandingConfig | null,
  userInstructions?: string
): Promise<GenerateResult> {
  console.log('[Agent] Starting agentic generation...');
  console.log('[Agent] Content length:', rawContent.length, 'characters');
  const startTime = Date.now();

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
    let totalCost: number = 0;
    let tokenUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, thinkingTokens: 0 };
    const agentLog: AgentLogEntry[] = [];

    // Build query options
    const queryOptions: Parameters<typeof query>[0]['options'] = {
      model: 'claude-opus-4-5',
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
            totalCost = message.total_cost_usd || 0;
            // Extract token usage from SDK result if available
            const resultWithUsage = message as {
              total_cost_usd?: number;
              result: string;
              usage?: {
                input_tokens?: number;
                output_tokens?: number;
                thinking_tokens?: number;
                cache_read_tokens?: number;
                cache_write_tokens?: number;
              };
            };
            if (resultWithUsage.usage) {
              tokenUsage = {
                inputTokens: resultWithUsage.usage.input_tokens || 0,
                outputTokens: resultWithUsage.usage.output_tokens || 0,
                thinkingTokens: resultWithUsage.usage.thinking_tokens || 0,
                cacheReadTokens: resultWithUsage.usage.cache_read_tokens || 0,
                cacheWriteTokens: resultWithUsage.usage.cache_write_tokens || 0,
              };
            }
            console.log(`[Agent] Total cost: $${totalCost?.toFixed(4) || 'unknown'}`);
            console.log(`[Agent] Token usage: input=${tokenUsage.inputTokens}, output=${tokenUsage.outputTokens}, thinking=${tokenUsage.thinkingTokens}`);
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
    const durationMs = Date.now() - startTime;

    // Build and return the config with usage
    const config: DashboardConfig = {
      contentType: 'data',
      html: finalResult.html,
      charts: {}, // All visualizations are inline
      metadata: {
        generatedAt: new Date().toISOString(),
        generationModel: 'claude-opus-4-5',
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

    return {
      config,
      usage: {
        usage: tokenUsage,
        costUsd: totalCost,
        turnCount,
        durationMs,
        modelId: 'opus-4-5',
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

export interface RefreshResultWithUsage extends RefreshResult {
  usage: AgentUsageResult;
}

/**
 * Options for refresh operation
 */
export interface RefreshOptions {
  /** Previous raw content for diff computation (if not provided, diff will be computed) */
  oldRawContent?: string;
  /** Pre-computed diff (if available from endpoint) */
  diff?: DataDiff;
}

/**
 * Timeout wrapper to prevent operations from hanging indefinitely
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${operation} timed out after ${timeoutMs / 1000} seconds`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Refresh a dashboard with new data using SURGICAL updates.
 *
 * This function:
 * 1. Computes a diff between old and new data (if not provided)
 * 2. Creates an E2B sandbox
 * 3. Writes the new data and existing HTML to the sandbox
 * 4. Runs an agent loop with surgical editing tools
 * 5. Returns the updated HTML with preserved structure
 *
 * Uses Sonnet 4.5 for cost efficiency (surgical edits don't need Opus)
 */
export async function refreshDashboardWithAgent(
  newRawContent: string,
  existingConfig: DashboardConfig,
  branding: BrandingConfig | null,
  options: RefreshOptions = {}
): Promise<RefreshResultWithUsage> {
  console.log('[Refresh Agent] Starting surgical dashboard refresh...');
  console.log('[Refresh Agent] New content length:', newRawContent.length, 'characters');
  console.log('[Refresh Agent] Existing HTML length:', existingConfig.html.length, 'characters');
  const startTime = Date.now();

  // Compute diff if old content is available
  let diff = options.diff;
  if (!diff && options.oldRawContent) {
    console.log('[Refresh Agent] Computing data diff...');
    diff = computeDataDiff(options.oldRawContent, newRawContent);
    console.log('[Refresh Agent] Diff computed:', {
      contentType: diff.contentType,
      unchanged: diff.unchanged,
      domainChanged: diff.domainChanged,
      recommendedApproach: diff.recommendedApproach,
    });

    // Early exit if no changes
    if (diff.unchanged) {
      console.log('[Refresh Agent] No changes detected, returning existing HTML');
      return {
        html: existingConfig.html,
        summary: 'No changes detected in the data',
        changes: [],
        warnings: [],
        usage: {
          usage: { inputTokens: 0, outputTokens: 0 },
          costUsd: 0,
          turnCount: 0,
          durationMs: 0,
          modelId: 'none',
        },
      };
    }
  }

  // Determine approach based on diff
  const approach = diff?.recommendedApproach || 'surgical';
  console.log(`[Refresh Agent] Using ${approach} approach`);

  // Create E2B sandbox with timeout protection
  console.log('[Refresh Agent] Creating E2B sandbox...');
  const sandboxStartTime = Date.now();
  try {
    activeSandbox = await withTimeout(
      Sandbox.create({ timeoutMs: 240000 }), // 4 minute max (leave buffer for cleanup)
      60000, // 60 second timeout for sandbox creation
      'E2B sandbox creation'
    );
    console.log(`[Refresh Agent] Sandbox created in ${Date.now() - sandboxStartTime}ms`);
  } catch (sandboxError) {
    console.error('[Refresh Agent] Failed to create sandbox:', sandboxError);
    throw new Error(`Failed to create E2B sandbox: ${sandboxError instanceof Error ? sandboxError.message : String(sandboxError)}`);
  }

  try {
    // Write new data and existing HTML to sandbox
    console.log('[Refresh Agent] Writing files to sandbox...');
    await activeSandbox.files.write('/tmp/data.txt', newRawContent);
    await activeSandbox.files.write('/tmp/existing.html', existingConfig.html);

    // Get prompts based on whether we have diff info
    const systemPrompt = getRefreshSystemPrompt(branding, approach);
    let userPrompt: string;

    if (diff) {
      const diffFormatted = formatDiffForAI(diff);
      userPrompt = getRefreshUserPrompt(
        diff,
        diffFormatted,
        existingConfig.analysis?.summary
      );
    } else {
      // Fallback to legacy prompt when no diff available
      userPrompt = getLegacyRefreshUserPrompt(
        existingConfig.html,
        existingConfig.analysis?.summary
      );
    }

    console.log('[Refresh Agent] Starting agent loop...');
    const agentLoopStartTime = Date.now();
    let refreshResult: RefreshResult | null = null;
    let turnCount = 0;
    let totalCost: number = 0;
    let tokenUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, thinkingTokens: 0 };

    // Use Sonnet 4.5 for surgical updates (cost-efficient)
    // Use surgical editing tools (read_lines, edit_file, get_file, execute_python)
    const queryOptions: Parameters<typeof query>[0]['options'] = {
      model: 'claude-sonnet-4-5', // Sonnet for cost efficiency
      systemPrompt,
      maxTurns: approach === 'surgical' ? 15 : 10, // More turns for surgical (multiple edits)
      mcpServers: {
        filetools: modifyToolServer, // Includes surgical editing tools
      },
      allowedTools: [
        'mcp__filetools__read_lines',
        'mcp__filetools__edit_file',
        'mcp__filetools__get_file',
        'mcp__filetools__execute_python',
      ],
      pathToClaudeCodeExecutable: CLAUDE_EXECUTABLE_PATH,
    };

    // NOTE: Extended thinking disabled for refresh agent - may cause issues with Agent SDK + Sonnet
    // If you want to re-enable, uncomment below:
    // if (AGENT_CONFIG.extendedThinking) {
    //   // @ts-expect-error - thinking option may not be in SDK types yet
    //   queryOptions.thinking = {
    //     type: 'enabled',
    //     budget_tokens: approach === 'surgical' ? 3000 : 5000,
    //   };
    // }

    // Maximum time for the entire agent loop (3 minutes to leave buffer)
    const AGENT_LOOP_TIMEOUT_MS = 180000;

    // Run the agent loop with timeout protection
    const agentLoopPromise = (async () => {
      for await (const message of query({
        prompt: userPrompt,
        options: queryOptions,
      })) {
        // Check for overall timeout inside loop
        if (Date.now() - agentLoopStartTime > AGENT_LOOP_TIMEOUT_MS) {
          throw new Error(`Agent loop timed out after ${AGENT_LOOP_TIMEOUT_MS / 1000} seconds`);
        }

        if (message.type === 'assistant') {
          turnCount++;
          console.log(`[Refresh Agent] Turn ${turnCount}: Assistant message (${Math.round((Date.now() - agentLoopStartTime) / 1000)}s elapsed)`);
          // Log assistant message content for debugging
          const assistantMsg = message as { content?: Array<{ type: string; text?: string; name?: string }> };
          if (assistantMsg.content) {
            for (const block of assistantMsg.content) {
              if (block.type === 'text') {
                console.log(`[Refresh Agent] Assistant text: ${block.text?.slice(0, 300) || '(empty)'}...`);
              } else if (block.type === 'tool_use') {
                console.log(`[Refresh Agent] Assistant tool_use: ${block.name}`);
              }
            }
          } else {
            console.log(`[Refresh Agent] Assistant message has no content`);
          }
        } else if (message.type === 'tool_progress') {
          console.log(`[Refresh Agent] Tool progress: ${message.tool_name}`);
        } else if (message.type === 'result') {
          console.log(`[Refresh Agent] Result received after ${turnCount} turns (${Math.round((Date.now() - agentLoopStartTime) / 1000)}s total)`);
          console.log(`[Refresh Agent] Result subtype: ${message.subtype}`);
          console.log(`[Refresh Agent] Result keys: ${Object.keys(message).join(', ')}`);

          if (message.subtype === 'success') {
            totalCost = message.total_cost_usd || 0;
            // Log the raw result for debugging
            const rawResult = (message as { result?: string }).result;
            console.log(`[Refresh Agent] Raw result length: ${rawResult?.length || 0}`);
            console.log(`[Refresh Agent] Raw result preview: ${rawResult?.slice(0, 500) || '(empty)'}`);

            // Extract token usage from SDK result if available
            const resultWithUsage = message as {
              total_cost_usd?: number;
              result: string;
              usage?: {
                input_tokens?: number;
                output_tokens?: number;
                thinking_tokens?: number;
                cache_read_tokens?: number;
                cache_write_tokens?: number;
              };
            };
            if (resultWithUsage.usage) {
              tokenUsage = {
                inputTokens: resultWithUsage.usage.input_tokens || 0,
                outputTokens: resultWithUsage.usage.output_tokens || 0,
                thinkingTokens: resultWithUsage.usage.thinking_tokens || 0,
                cacheReadTokens: resultWithUsage.usage.cache_read_tokens || 0,
                cacheWriteTokens: resultWithUsage.usage.cache_write_tokens || 0,
              };
            }
            console.log(`[Refresh Agent] Total cost: $${totalCost?.toFixed(4) || 'unknown'}`);
            console.log(`[Refresh Agent] Token usage: input=${tokenUsage.inputTokens}, output=${tokenUsage.outputTokens}, thinking=${tokenUsage.thinkingTokens}`);
            refreshResult = extractRefreshResult(message.result);
            console.log(`[Refresh Agent] Extracted result: ${refreshResult ? 'success' : 'null'}`);
          } else if (message.subtype.startsWith('error')) {
            // Log detailed error info (handles error_during_execution, error_max_turns, etc.)
            const errorResult = message as { errors?: string[]; error?: string; message?: string };
            console.error(`[Refresh Agent] Error result received (${message.subtype}):`, JSON.stringify(errorResult, null, 2));
            throw new Error(`Refresh agent error (${message.subtype}): ${errorResult.errors?.join(', ') || errorResult.error || errorResult.message || 'Unknown error'}`);
          } else {
            console.log(`[Refresh Agent] Unknown result subtype: ${message.subtype}`);
            console.log(`[Refresh Agent] Full message:`, JSON.stringify(message, null, 2));
          }
        } else if (message.type === 'system') {
          console.log(`[Refresh Agent] System message: ${message.subtype}`);
        }
      }
      return refreshResult;
    })();

    // Wait for agent loop with timeout
    try {
      refreshResult = await withTimeout(
        agentLoopPromise,
        AGENT_LOOP_TIMEOUT_MS + 10000, // Add 10s buffer
        'Agent refresh loop'
      );
    } catch (loopError) {
      const elapsed = Math.round((Date.now() - agentLoopStartTime) / 1000);
      console.error(`[Refresh Agent] Agent loop failed after ${elapsed}s`);
      console.error(`[Refresh Agent] Error type: ${loopError instanceof Error ? loopError.constructor.name : typeof loopError}`);
      console.error(`[Refresh Agent] Error message: ${loopError instanceof Error ? loopError.message : String(loopError)}`);
      if (loopError instanceof Error && loopError.stack) {
        console.error(`[Refresh Agent] Error stack: ${loopError.stack}`);
      }
      // Log the state at failure
      console.error(`[Refresh Agent] State at failure: turns=${turnCount}, cost=$${totalCost.toFixed(4)}, hasResult=${!!refreshResult}`);
      throw loopError;
    }

    if (!refreshResult?.html) {
      throw new Error('Refresh agent did not produce HTML output');
    }

    console.log('[Refresh Agent] Refresh complete. HTML length:', refreshResult.html.length);
    console.log('[Refresh Agent] Changes detected:', refreshResult.changes.length);
    const durationMs = Date.now() - startTime;

    return {
      ...refreshResult,
      usage: {
        usage: tokenUsage,
        costUsd: totalCost,
        turnCount,
        durationMs,
        modelId: 'sonnet-4-5', // Using Sonnet for cost-efficient surgical updates
      },
    };
  } finally {
    console.log('[Refresh Agent] Closing E2B sandbox...');
    if (activeSandbox) {
      await activeSandbox.kill();
      activeSandbox = null;
    }
  }
}

/**
 * Re-export diff utilities for use by endpoints
 */
export { computeDataDiff, formatDiffForAI, type DataDiff } from '@/lib/data/diff';

/**
 * Result from modifying a dashboard
 */
export interface ModifyResult {
  html: string;
  summary: string;
}

export interface ModifyResultWithUsage extends ModifyResult {
  usage: AgentUsageResult;
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
): Promise<ModifyResultWithUsage> {
  console.log('[Modify Agent] Starting dashboard modification...');
  console.log('[Modify Agent] Instructions:', instructions);
  console.log('[Modify Agent] Existing HTML length:', existingHtml.length, 'characters');
  const startTime = Date.now();

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
    let totalCost: number = 0;
    let tokenUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, thinkingTokens: 0 };
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
          totalCost = message.total_cost_usd || 0;
          // Extract token usage from SDK result if available
          const resultWithUsage = message as {
            total_cost_usd?: number;
            result: string;
            usage?: {
              input_tokens?: number;
              output_tokens?: number;
              thinking_tokens?: number;
              cache_read_tokens?: number;
              cache_write_tokens?: number;
            };
          };
          if (resultWithUsage.usage) {
            tokenUsage = {
              inputTokens: resultWithUsage.usage.input_tokens || 0,
              outputTokens: resultWithUsage.usage.output_tokens || 0,
              thinkingTokens: resultWithUsage.usage.thinking_tokens || 0,
              cacheReadTokens: resultWithUsage.usage.cache_read_tokens || 0,
              cacheWriteTokens: resultWithUsage.usage.cache_write_tokens || 0,
            };
          }
          console.log(`[Modify Agent] Total cost: $${totalCost?.toFixed(4) || 'unknown'}`);
          console.log(`[Modify Agent] Token usage: input=${tokenUsage.inputTokens}, output=${tokenUsage.outputTokens}, thinking=${tokenUsage.thinkingTokens}`);
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
    const durationMs = Date.now() - startTime;

    return {
      ...modifyResult,
      usage: {
        usage: tokenUsage,
        costUsd: totalCost,
        turnCount,
        durationMs,
        modelId: 'sonnet-4-5',  // Modify uses Sonnet
      },
    };
  } finally {
    console.log('[Modify Agent] Closing E2B sandbox...');
    if (activeSandbox) {
      await activeSandbox.kill();
      activeSandbox = null;
    }
  }
}
