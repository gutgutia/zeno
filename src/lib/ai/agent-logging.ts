/**
 * Shared logging utilities for Claude Code E2B agents
 *
 * Provides verbose, structured logging of agent execution to help
 * understand and debug agent behavior.
 */

// Configuration for verbose logging
export const LOGGING_CONFIG = {
  // Enable verbose logging of agent turns and tool calls
  // Uses --output-format stream-json to get structured events
  enabled: false,

  // Truncate long text in logs to this length
  maxTextLength: 2000,

  // Truncate tool inputs to this length
  maxToolInputLength: 500,
};

// Event types from Claude Code CLI stream-json output
export interface AgentEvent {
  type: string;
  subtype?: string;
  message?: {
    type: string;
    content?: Array<{
      type: string;
      text?: string;
      name?: string;
      input?: unknown;
      content?: unknown;
    }>;
  };
  tool_name?: string;
  tool_input?: unknown;
  result?: string;
  total_cost_usd?: number;
  session_id?: string;
}

/**
 * Format tool input for logging (truncate if needed)
 */
export function formatToolInput(input: unknown): string {
  if (typeof input === 'string') {
    return input.length > LOGGING_CONFIG.maxToolInputLength
      ? input.slice(0, LOGGING_CONFIG.maxToolInputLength) + '...'
      : input;
  }
  const str = JSON.stringify(input, null, 2);
  return str.length > LOGGING_CONFIG.maxToolInputLength
    ? str.slice(0, LOGGING_CONFIG.maxToolInputLength) + '...'
    : str;
}

/**
 * Log a single agent event in a human-readable format
 */
export function logAgentEvent(event: AgentEvent, turnNumber: number): void {
  if (!LOGGING_CONFIG.enabled) return;

  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const prefix = `[${timestamp}] [Turn ${turnNumber}]`;

  switch (event.type) {
    case 'assistant':
      if (event.message?.content) {
        for (const block of event.message.content) {
          if (block.type === 'text' && block.text) {
            console.log(`${prefix} 💭 ASSISTANT TEXT:`);
            console.log('-'.repeat(60));
            const text = block.text.length > LOGGING_CONFIG.maxTextLength
              ? block.text.slice(0, LOGGING_CONFIG.maxTextLength) + '...'
              : block.text;
            console.log(text);
            console.log('-'.repeat(60));
          } else if (block.type === 'tool_use') {
            console.log(`${prefix} 🔧 TOOL CALL: ${block.name}`);
            console.log('-'.repeat(60));
            console.log(formatToolInput(block.input));
            console.log('-'.repeat(60));
          } else if (block.type === 'thinking' && block.text) {
            console.log(`${prefix} 🧠 THINKING:`);
            console.log('-'.repeat(60));
            const text = block.text.length > LOGGING_CONFIG.maxTextLength
              ? block.text.slice(0, LOGGING_CONFIG.maxTextLength) + '...'
              : block.text;
            console.log(text);
            console.log('-'.repeat(60));
          }
        }
      }
      break;

    case 'user':
      if (event.message?.content) {
        for (const block of event.message.content) {
          if (block.type === 'tool_result') {
            console.log(`${prefix} 📤 TOOL RESULT:`);
            const text = typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
            const preview = text.length > 1000 ? text.slice(0, 1000) + '...' : text;
            console.log(preview);
          }
        }
      }
      break;

    case 'result':
      console.log(`${prefix} ✅ AGENT COMPLETED`);
      if (event.subtype === 'success') {
        console.log(`   Cost: $${event.total_cost_usd?.toFixed(4) || 'unknown'}`);
        if (event.result) {
          const resultPreview = event.result.length > 500
            ? event.result.slice(0, 500) + '...'
            : event.result;
          console.log(`   Result: ${resultPreview}`);
        }
      } else {
        console.log(`   Status: ${event.subtype}`);
      }
      break;

    case 'system':
      if (event.subtype === 'init') {
        console.log(`${prefix} 🚀 AGENT INITIALIZED (session: ${event.session_id?.slice(0, 8)}...)`);
      } else {
        console.log(`${prefix} ⚙️ SYSTEM: ${event.subtype}`);
      }
      break;

    default:
      // Log unknown event types for debugging
      console.log(`${prefix} 📋 EVENT: ${event.type}${event.subtype ? ` (${event.subtype})` : ''}`);
  }
}

/**
 * Process streaming stdout from Claude Code CLI with stream-json output
 * Returns the number of turns detected
 */
export function processStreamingOutput(
  data: string,
  currentTurn: { value: number }
): void {
  if (!LOGGING_CONFIG.enabled) return;

  const lines = data.split('\n').filter(line => line.trim());

  for (const line of lines) {
    try {
      const event = JSON.parse(line) as AgentEvent;

      // Track turns based on assistant messages
      if (event.type === 'assistant') {
        currentTurn.value++;
      }

      logAgentEvent(event, currentTurn.value);
    } catch {
      // Not JSON, log as raw output if non-empty and not a JSON fragment
      if (line.trim() && !line.startsWith('{') && !line.startsWith('"')) {
        console.log(`[Raw] ${line}`);
      }
    }
  }
}

/**
 * Print header for agent execution log
 */
export function printLogHeader(context: string): void {
  if (!LOGGING_CONFIG.enabled) return;

  console.log('\n' + '='.repeat(80));
  console.log(`AGENT EXECUTION LOG: ${context}`);
  console.log('='.repeat(80) + '\n');
}

/**
 * Print footer for agent execution log
 */
export function printLogFooter(turnCount: number, durationMs: number): void {
  if (!LOGGING_CONFIG.enabled) return;

  console.log('\n' + '='.repeat(80));
  console.log(`AGENT COMPLETED: ${turnCount} turns in ${(durationMs / 1000).toFixed(1)}s`);
  console.log('='.repeat(80) + '\n');
}

/**
 * Extract summary from stream-json output
 */
export function extractSummaryFromStreamOutput(stdout: string): string | null {
  try {
    // Look for the result event in stream-json output
    const resultEventMatch = stdout.match(/"type"\s*:\s*"result"[^}]*"result"\s*:\s*"([^"]+)"/);
    if (resultEventMatch) {
      const resultText = resultEventMatch[1]
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"');
      const summaryMatch = resultText.match(/\{[^{}]*"summary"[^{}]*\}/);
      if (summaryMatch) {
        const parsed = JSON.parse(summaryMatch[0]);
        if (parsed.summary) {
          return parsed.summary;
        }
      }
    }

    // Fallback to simple JSON match
    const jsonMatch = stdout.match(/\{[^{}]*"summary"[^{}]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.summary) {
        return parsed.summary;
      }
    }
  } catch {
    // Return null if we can't extract
  }

  return null;
}
