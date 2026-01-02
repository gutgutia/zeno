# Agentic Dashboard Generation

## Overview

Zeno uses an **agentic approach** for dashboard generation, powered by:

- **Claude Agent SDK** (TypeScript) - Orchestrates the agent loop
- **E2B Code Interpreter** - Sandboxed Python execution
- **Claude Opus 4.5** - The underlying LLM with extended thinking

This approach produces higher-quality dashboards because the agent can:
1. Write custom Python code tailored to the specific data
2. Execute that code to compute exact metrics
3. Iterate through multiple turns before generating HTML
4. Use actual computed values instead of estimates

---

## Why Agentic?

### The Problem with Single-Shot Generation

Previously, we used a single Claude call that tried to:
1. Understand the data from a text representation
2. Mentally compute metrics
3. Generate HTML with those metrics

This had limitations:
- Claude had to *estimate* numbers (often inaccurate for large datasets)
- No way to verify computations before rendering
- Limited ability to explore the data structure

### The Agentic Advantage

With the agent approach:
```
Turn 1: Agent reads data, understands structure
Turn 2: Agent writes Python to compute key metrics
Turn 3: Agent executes Python, gets exact values
Turn 4: Agent identifies additional insights needed
Turn 5: Agent runs more Python for those insights
Turn 6: Agent generates HTML with real, verified numbers
```

The agent *thinks about what would be useful* and *uses tools to compute it accurately*.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         VERCEL / NEXT.JS                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────────┐      ┌──────────────────────────────────────┐    │
│   │ API Route    │      │           AGENT LOOP                  │    │
│   │ /generate    │─────▶│                                       │    │
│   └──────────────┘      │  ┌─────────┐    ┌─────────────────┐  │    │
│                         │  │ Claude  │◀──▶│ execute_python  │  │    │
│                         │  │ Opus 4.5│    │     (tool)      │  │    │
│                         │  └─────────┘    └────────┬────────┘  │    │
│                         │                          │           │    │
│                         └──────────────────────────┼───────────┘    │
│                                                    │                │
└────────────────────────────────────────────────────┼────────────────┘
                                                     │
                                                     ▼
                                          ┌──────────────────┐
                                          │   E2B SANDBOX    │
                                          │                  │
                                          │  Python 3.x      │
                                          │  - pandas        │
                                          │  - numpy         │
                                          │  - json, csv     │
                                          │  - collections   │
                                          │                  │
                                          │  /tmp/data.txt   │
                                          │  (user content)  │
                                          └──────────────────┘
```

---

## Key Files

### `src/lib/ai/agent.ts`

The main agent module. Key exports:

```typescript
// Experimentation toggles - easy to modify for testing
export const AGENT_CONFIG = {
  extendedThinking: true,      // Enable/disable extended thinking
  thinkingBudgetTokens: 10000, // Tokens for reasoning
  maxTurns: 15,                // Max agent iterations
};

// Main generation function
export async function generateWithAgent(
  rawContent: string,
  branding: BrandingConfig | null,
  userInstructions?: string
): Promise<DashboardConfig>
```

#### How It Works

1. **Create E2B Sandbox**
   ```typescript
   activeSandbox = await Sandbox.create({
     timeoutMs: 300000, // 5 minute max
   });
   ```

2. **Write Content to Sandbox**
   ```typescript
   await activeSandbox.files.write('/tmp/data.txt', rawContent);
   ```

3. **Run Agent Loop**
   ```typescript
   for await (const message of query({
     prompt: userPrompt,
     options: {
       model: 'claude-opus-4-5-20251101',
       systemPrompt,
       maxTurns: AGENT_CONFIG.maxTurns,
       mcpServers: { python: pythonToolServer },
       allowedTools: ['mcp__python__execute_python'],
       thinking: AGENT_CONFIG.extendedThinking ? {
         type: 'enabled',
         budget_tokens: AGENT_CONFIG.thinkingBudgetTokens,
       } : undefined,
     },
   })) {
     // Handle messages...
   }
   ```

4. **Extract JSON Result**
   - Agent's final message contains `{"html": "...", "summary": "..."}`
   - Parsed and validated before returning

5. **Cleanup Sandbox**
   ```typescript
   await activeSandbox.kill();
   ```

### `src/lib/ai/agent-prompts.ts`

Contains the system and user prompts for the agent.

#### System Prompt Structure

```typescript
export function getAgentSystemPrompt(branding: BrandingConfig | null): string {
  return `You are a content beautifier...

  BEFORE YOU BEGIN:
  Take a moment to consider the user's likely intent...

  WHEN TO USE PYTHON:
  - Tabular data: Parse and compute aggregates
  - Lists with numbers: Calculate totals, percentages
  ...

  WHEN NOT TO USE PYTHON:
  - Simple text documents
  - Content that doesn't require computation
  ...

  WORKFLOW:
  1. Read /tmp/data.txt and understand content type
  2. Use Python to compute metrics (if needed)
  3. Generate beautiful HTML

  ${brandingSection}

  DESIGN PRINCIPLES:
  ...

  HTML REQUIREMENTS:
  - Complete, self-contained HTML page
  - All styles inline
  - No external dependencies or JavaScript
  ...

  FINAL OUTPUT:
  {"html": "...", "summary": "..."}
  `;
}
```

Key sections:
- **BEFORE YOU BEGIN** - Encourages agent to think about user intent
- **WHEN TO USE PYTHON** - Guides tool usage decisions
- **WORKFLOW** - High-level process
- **BRANDING** - Colors, fonts, company name
- **DESIGN PRINCIPLES** - Visual hierarchy, aesthetics
- **HTML REQUIREMENTS** - Technical constraints
- **FINAL OUTPUT** - Expected JSON format

### `src/lib/ai/agent.ts` - The Python Tool

```typescript
const executePythonTool = tool(
  'execute_python',
  'Execute Python code in a sandbox. The sandbox has pandas, numpy, json, csv, re, datetime, and collections available. Use this to read /tmp/data.txt and compute metrics. Print results to stdout.',
  {
    code: z.string().describe('Python code to execute. Results should be printed to stdout.'),
  },
  async ({ code }) => {
    const execution = await activeSandbox.runCode(code);
    const stdout = execution.logs.stdout.join('\n');
    return {
      content: [{ type: 'text', text: stdout || 'Code executed successfully' }],
    };
  }
);
```

The tool is registered via MCP (Model Context Protocol):
```typescript
const pythonToolServer = createSdkMcpServer({
  name: 'python',
  version: '1.0.0',
  tools: [executePythonTool],
});
```

---

## Extended Thinking

Extended thinking enables a "Think-Act-Think-Act" loop:

```
[Think] What kind of data is this? Looks like project tracking...
[Act]   execute_python: Read and parse the CSV
[Think] Okay, 47 projects. What metrics would be useful?
        - Status distribution
        - Projects at risk
        - Timeline analysis
[Act]   execute_python: Compute status counts
[Think] Good. Now let me compute risk indicators...
[Act]   execute_python: Identify overdue projects
[Think] Now I have all the data. What would make this actionable?
        User probably wants to see problems at a glance...
[Act]   Generate HTML with computed metrics
```

### Configuration

```typescript
export const AGENT_CONFIG = {
  extendedThinking: true,       // Toggle on/off
  thinkingBudgetTokens: 10000,  // Tokens allocated for reasoning
  maxTurns: 15,
};
```

### When to Disable

You might disable extended thinking to:
- Compare output quality with/without reasoning
- Reduce latency for simpler content
- Debug agent behavior

---

## E2B Integration

### What is E2B?

E2B (e2b.dev) provides sandboxed code execution for AI agents. Key features:
- ~400ms cold start (vs 1-2s for alternatives)
- Purpose-built for AI agents
- Pre-installed Python packages
- Secure isolation

### Available Packages

In the E2B sandbox:
- `pandas` - Data manipulation
- `numpy` - Numerical computing
- `json` - JSON parsing
- `csv` - CSV handling
- `re` - Regular expressions
- `datetime` - Date/time operations
- `collections` - Data structures

### Data Access

Content is written to `/tmp/data.txt`:
```python
# Agent's Python code
data = open('/tmp/data.txt').read()

# For CSV data
import pandas as pd
from io import StringIO
df = pd.read_csv(StringIO(data))
```

### Sandbox Lifecycle

```typescript
// Create (5 minute timeout)
activeSandbox = await Sandbox.create({ timeoutMs: 300000 });

try {
  // Write data
  await activeSandbox.files.write('/tmp/data.txt', rawContent);

  // Run agent (uses sandbox for Python execution)
  // ...

} finally {
  // Always cleanup
  await activeSandbox.kill();
  activeSandbox = null;
}
```

---

## Experimentation Guide

### Toggle Extended Thinking

```typescript
// src/lib/ai/agent.ts
export const AGENT_CONFIG = {
  extendedThinking: false,  // Disable to compare
  // ...
};
```

### Adjust Thinking Budget

```typescript
export const AGENT_CONFIG = {
  thinkingBudgetTokens: 5000,  // Less thinking, faster
  // or
  thinkingBudgetTokens: 20000, // More thinking, better quality
};
```

### Limit Agent Turns

```typescript
export const AGENT_CONFIG = {
  maxTurns: 5,  // Force faster completion
};
```

### Modify the Prompt

Key sections to experiment with in `agent-prompts.ts`:

1. **BEFORE YOU BEGIN** - Intent reflection
2. **WHEN TO USE PYTHON** - Tool usage guidance
3. **DESIGN PRINCIPLES** - Visual guidelines
4. **HTML REQUIREMENTS** - Technical constraints

---

## Metadata Tracking

The agent tracks metadata for analysis:

```typescript
metadata: {
  generatedAt: string;
  generationModel: 'claude-opus-4-5-20251101';
  userInstructions?: string;
  agentGenerated: true;
  turnCount: number;          // How many turns the agent took
  extendedThinking: boolean;  // Whether thinking was enabled
}
```

This allows correlating output quality with configuration.

---

## API Route Configuration

```typescript
// src/app/api/dashboards/[id]/generate/route.ts

export const maxDuration = 300; // 5 minutes (Vercel timeout)

// The route calls:
const config = await generateWithAgent(
  rawContent,
  effectiveBranding,
  dashboard.user_instructions || undefined
);
```

---

## Error Handling

### Sandbox Errors

```typescript
try {
  const execution = await activeSandbox.runCode(code);
  // ...
} catch (error) {
  return {
    content: [{ type: 'text', text: `Execution error: ${error.message}` }],
  };
}
```

### Agent Errors

```typescript
if (message.type === 'result') {
  if (message.subtype === 'success') {
    // Extract result
  } else {
    throw new Error(`Agent error: ${message.errors?.join(', ')}`);
  }
}
```

### Missing HTML

```typescript
if (!finalResult?.html) {
  throw new Error('Agent did not produce HTML output');
}
```

---

## Future Improvements

### Potential Enhancements

1. **Subagent Pattern**
   - Planner subagent: Analyzes data, creates plan
   - Generator subagent: Executes plan, produces HTML

2. **More Tools**
   - `read_file`: Read from sandbox
   - `list_files`: Explore sandbox filesystem
   - `fetch_url`: Retrieve external data

3. **Interactive Elements**
   - Generate HTML with JavaScript for search/filter
   - Client-side interactivity

4. **Streaming Output**
   - Stream HTML as it's generated
   - Show progress to user

### Adding a New Tool

```typescript
const newTool = tool(
  'tool_name',
  'Description of what the tool does',
  {
    param1: z.string().describe('Parameter description'),
    param2: z.number().optional(),
  },
  async ({ param1, param2 }) => {
    // Implementation
    return {
      content: [{ type: 'text', text: 'result' }],
    };
  }
);

// Add to MCP server
const server = createSdkMcpServer({
  name: 'server-name',
  version: '1.0.0',
  tools: [executePythonTool, newTool],
});
```

---

## Quick Reference

### Key Imports

```typescript
import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { Sandbox } from '@e2b/code-interpreter';
import { z } from 'zod';
```

### Environment Variables

```bash
ANTHROPIC_API_KEY=sk-ant-...  # Claude API key
E2B_API_KEY=e2b_...           # E2B API key
```

### NPM Packages

```json
{
  "@anthropic-ai/claude-agent-sdk": "^x.x.x",
  "@e2b/code-interpreter": "^x.x.x",
  "zod": "^3.x.x"
}
```

---

## Comparison: Old vs New Approach

| Aspect | Old (Single-Shot) | New (Agentic) |
|--------|-------------------|---------------|
| Computation | Claude estimates | Python computes exactly |
| Iterations | 1 turn | Up to 15 turns |
| Data handling | Text representation | Sandbox file access |
| Reasoning | Limited | Extended thinking |
| Tool usage | None | execute_python |
| Quality | Good | Better |
| Latency | Fast (~5s) | Slower (~30-60s) |
| Cost | Lower | Higher |

The agentic approach trades latency and cost for quality - appropriate for the dashboard generation use case where accuracy matters.
