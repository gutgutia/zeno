import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { Sandbox } from '@e2b/code-interpreter';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { getAgentSystemPrompt, getAgentUserPrompt } from './agent-prompts';
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

// NOTE: RefreshResult interface has been removed.
// Use RefreshWithClaudeCodeResult from refresh-with-claude-code.ts instead.

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

  // Use direct (non-agentic) approach for modifications
  // This is faster, cheaper, and more predictable
  // Set to false to use the full agent-based approach
  useDirectModify: true,

  // Use direct (non-agentic) approach for data refresh
  // This is faster, cheaper, and more predictable
  // Falls back to full regeneration for major schema changes
  useDirectRefresh: true,

  // Use Claude Code CLI running inside E2B sandbox for generation
  // This gives Claude full access to Bash, Read, Write, Edit, Glob, Grep
  // Should produce higher quality dashboards through iterative development
  // Set to false to use the MCP-based approach (limited to execute_python only)
  useClaudeCodeE2B: true,
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

// NOTE: modifyToolServer has been removed.
// Use modifyWithClaudeCode from modify-with-claude-code.ts for modifications.

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

// NOTE: refreshDashboardWithAgent has been removed.
// Use refreshWithClaudeCode from refresh-with-claude-code.ts for regeneration,
// or refreshDashboardDirect from refresh-direct.ts for surgical updates.

/**
 * Re-export diff utilities for use by endpoints
 */
export { computeDataDiff, formatDiffForAI, type DataDiff } from '@/lib/data/diff';

/**
 * Re-export Claude Code E2B generation for use by endpoints
 */
export { generateWithClaudeCode, isClaudeCodeE2BAvailable } from './generate-with-claude-code';

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
