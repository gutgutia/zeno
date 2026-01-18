/**
 * Generate dashboards using Claude Code CLI running inside E2B sandbox
 *
 * Enhanced approach with:
 * - Pre-processed data (CSV format)
 * - Pre-computed data profile
 * - Utility library for faster development
 * - Python sandbox with data science stack
 */

import { Sandbox } from 'e2b';
import type { DashboardConfig, ParsedData, DataSchema } from '@/types/dashboard';
import type { BrandingConfig } from '@/types/database';
import { AI_CONFIG } from './config';
import {
  type AgentEvent,
  logAgentEvent,
  printLogHeader,
  printLogFooter,
  extractSummaryFromStreamOutput,
} from './agent-logging';
import { generateDataProfile, formatProfileForAgent } from '@/lib/data/profile';
import { getEnhancedAgentSystemPrompt, getEnhancedAgentUserPrompt } from './agent-prompts';

export interface GenerateResult {
  config: DashboardConfig;
  usage: {
    durationMs: number;
    modelId: string;
  };
}

export interface GenerateInput {
  // Pre-parsed data (preferred - faster)
  parsedData?: ParsedData;
  schema?: DataSchema;
  // Raw content fallback
  rawContent?: string;
}

/**
 * Convert ParsedData to CSV string
 */
function parsedDataToCSV(data: ParsedData): string {
  const { rows, columns } = data;
  if (rows.length === 0) return '';

  // Header row
  const header = columns.join(',');

  // Data rows
  const dataRows = rows.map(row => {
    return columns.map(col => {
      const value = row[col];
      if (value === null || value === undefined) return '';
      const str = String(value);
      // Escape commas and quotes
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',');
  });

  return [header, ...dataRows].join('\n');
}

/**
 * Build the enhanced prompt with data profile
 */
function buildEnhancedPrompt(
  branding: BrandingConfig | null,
  dataProfile: string,
  userInstructions?: string
): string {
  const systemPrompt = getEnhancedAgentSystemPrompt(branding, dataProfile);
  const userPrompt = getEnhancedAgentUserPrompt(userInstructions);

  return `${systemPrompt}

---

${userPrompt}`;
}

/**
 * Legacy prompt builder (for raw content without profile)
 */
function buildLegacyPrompt(branding: BrandingConfig | null, userInstructions?: string): string {
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
 * Agent utility library (Python)
 * This gets written to the sandbox for the agent to use
 */
const AGENT_UTILS_PYTHON = `"""
Agent Utility Library for Dashboard Generation
"""
import json
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Any, Optional
from datetime import datetime

_cached_df: Optional[pd.DataFrame] = None
_cached_profile: Optional[dict] = None

def load_data(path: str = "/home/user/data.csv") -> pd.DataFrame:
    """Load the pre-processed CSV data into a pandas DataFrame."""
    global _cached_df
    if _cached_df is not None:
        return _cached_df
    _cached_df = pd.read_csv(path)
    return _cached_df

def get_profile(path: str = "/home/user/profile.json") -> dict:
    """Get the pre-computed data profile."""
    global _cached_profile
    if _cached_profile is not None:
        return _cached_profile
    with open(path) as f:
        _cached_profile = json.load(f)
    return _cached_profile

def summarize_numeric(df: pd.DataFrame) -> pd.DataFrame:
    """Get summary statistics for all numeric columns."""
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    if len(numeric_cols) == 0:
        return pd.DataFrame()
    summary = df[numeric_cols].agg(['min', 'max', 'mean', 'median', 'sum']).T
    summary.columns = ['Min', 'Max', 'Mean', 'Median', 'Total']
    return summary.round(2)

def aggregate_by(df: pd.DataFrame, group_col: str, value_col: str, agg_func: str = 'sum') -> pd.DataFrame:
    """Aggregate a value column by a grouping column."""
    result = df.groupby(group_col)[value_col].agg(agg_func).reset_index()
    result.columns = [group_col, value_col]
    return result.sort_values(value_col, ascending=False)

def chart_bar(labels: list, values: list, title: str = "", color: str = "#2563EB") -> dict:
    """Generate Chart.js configuration for a bar chart."""
    return {
        "type": "bar",
        "data": {"labels": labels, "datasets": [{"data": values, "backgroundColor": color, "borderRadius": 4}]},
        "options": {"responsive": True, "maintainAspectRatio": False, "plugins": {"title": {"display": bool(title), "text": title}, "legend": {"display": False}}, "scales": {"y": {"beginAtZero": True}}}
    }

def chart_line(labels: list, values: list, title: str = "", color: str = "#2563EB", fill: bool = False) -> dict:
    """Generate Chart.js configuration for a line chart."""
    return {
        "type": "line",
        "data": {"labels": labels, "datasets": [{"data": values, "borderColor": color, "backgroundColor": color + "20" if fill else "transparent", "fill": fill, "tension": 0.3}]},
        "options": {"responsive": True, "maintainAspectRatio": False, "plugins": {"title": {"display": bool(title), "text": title}, "legend": {"display": False}}}
    }

def chart_pie(labels: list, values: list, title: str = "", colors: Optional[list] = None) -> dict:
    """Generate Chart.js configuration for a pie/doughnut chart."""
    default_colors = ["#2563EB", "#0D9488", "#8B5CF6", "#F59E0B", "#EF4444", "#10B981"]
    colors = colors or default_colors[:len(labels)]
    return {
        "type": "doughnut",
        "data": {"labels": labels, "datasets": [{"data": values, "backgroundColor": colors}]},
        "options": {"responsive": True, "maintainAspectRatio": False, "plugins": {"title": {"display": bool(title), "text": title}, "legend": {"position": "right"}}}
    }

class html:
    """HTML component builders for dashboard generation."""

    @staticmethod
    def metric_card(title: str, value: Any, subtitle: str = "", color: str = "#2563EB") -> str:
        return f'''<div style="background:white;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
            <div style="color:#6B7280;font-size:14px;margin-bottom:8px;">{title}</div>
            <div style="color:#111827;font-size:32px;font-weight:700;">{value}</div>
            {f'<div style="color:{color};font-size:14px;margin-top:8px;">{subtitle}</div>' if subtitle else ''}
        </div>'''

    @staticmethod
    def chart_container(chart_id: str, title: str = "", height: int = 300) -> str:
        title_html = f'<h3 style="margin:0 0 16px 0;color:#111827;font-size:18px;">{title}</h3>' if title else ''
        return f'''<div style="background:white;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
            {title_html}<div style="height:{height}px;"><canvas id="{chart_id}"></canvas></div>
        </div>'''

    @staticmethod
    def data_table(df: pd.DataFrame, max_rows: int = 50) -> str:
        df_display = df.head(max_rows)
        headers = ''.join(f'<th style="padding:12px;text-align:left;border-bottom:2px solid #E5E7EB;color:#374151;font-weight:600;">{col}</th>' for col in df_display.columns)
        rows = []
        for _, row in df_display.iterrows():
            cells = ''.join(f'<td style="padding:12px;border-bottom:1px solid #E5E7EB;">{val}</td>' for val in row)
            rows.append(f'<tr style="background:white;">{cells}</tr>')
        return f'''<div style="background:white;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.1);overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:14px;"><thead><tr style="background:#F9FAFB;">{headers}</tr></thead><tbody>{''.join(rows)}</tbody></table>
            {f'<div style="color:#6B7280;font-size:12px;margin-top:12px;">Showing {len(df_display)} of {len(df)} rows</div>' if len(df) > max_rows else ''}
        </div>'''

def page_template(title: str, body: str, branding: Optional[dict] = None) -> str:
    """Generate a complete HTML page with proper structure."""
    branding = branding or {}
    primary = branding.get('primary', '#2563EB')
    background = branding.get('background', '#F9FAFB')
    font = branding.get('font', 'system-ui, -apple-system, sans-serif')
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: {font}; background: {background}; color: #111827; line-height: 1.5; }}
        .container {{ max-width: 1400px; margin: 0 auto; padding: 32px; }}
        h1 {{ color: #111827; font-size: 32px; font-weight: 700; margin-bottom: 8px; }}
        .subtitle {{ color: #6B7280; font-size: 16px; margin-bottom: 32px; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>{title}</h1>
        <p class="subtitle">Generated on {datetime.now().strftime('%B %d, %Y')}</p>
        {body}
    </div>
</body>
</html>'''

def format_number(value: float, decimals: int = 0) -> str:
    if pd.isna(value): return "N/A"
    return f"{value:,.{decimals}f}"

def format_currency(value: float, symbol: str = "$") -> str:
    if pd.isna(value): return "N/A"
    if abs(value) >= 1_000_000: return f"{symbol}{value/1_000_000:.1f}M"
    if abs(value) >= 1_000: return f"{symbol}{value/1_000:.1f}K"
    return f"{symbol}{value:,.0f}"

def format_percent(value: float, decimals: int = 1) -> str:
    if pd.isna(value): return "N/A"
    return f"{value:.{decimals}f}%"
`;

/**
 * Generate a dashboard using Claude Code CLI inside E2B sandbox
 *
 * Enhanced flow:
 * 1. Pre-process data to CSV (if parsed data provided)
 * 2. Generate data profile
 * 3. Write data, profile, and utility library to sandbox
 * 4. Run Claude Code with enhanced prompts
 */
export async function generateWithClaudeCode(
  rawContent: string,
  branding: BrandingConfig | null,
  userInstructions?: string,
  input?: GenerateInput
): Promise<GenerateResult> {
  console.log('[Claude Code E2B] Starting enhanced generation...');
  const startTime = Date.now();

  // Determine if we have pre-parsed data
  const hasParsedData = input?.parsedData && input?.schema;

  let csvContent: string;
  let profileString: string;
  let profileJson: string;

  if (hasParsedData) {
    console.log('[Claude Code E2B] Using pre-parsed data (optimized path)');
    csvContent = parsedDataToCSV(input.parsedData!);
    const profile = generateDataProfile(input.parsedData!, input.schema!);
    profileString = formatProfileForAgent(profile);
    profileJson = JSON.stringify(profile, null, 2);
    console.log('[Claude Code E2B] CSV length:', csvContent.length, 'chars');
    console.log('[Claude Code E2B] Profile generated with', profile.columns.length, 'columns');
  } else {
    console.log('[Claude Code E2B] Using raw content (legacy path)');
    csvContent = rawContent;
    profileString = '';
    profileJson = '{}';
  }

  // Create sandbox with enhanced template
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

    // Write files to sandbox in parallel
    console.log('[Claude Code E2B] Writing files to sandbox...');
    const writeStartTime = Date.now();

    await Promise.all([
      // Data file (CSV if parsed, otherwise raw)
      hasParsedData
        ? sandbox.files.write('/home/user/data.csv', csvContent)
        : sandbox.files.write('/home/user/data.txt', rawContent),
      // Profile JSON (if available)
      hasParsedData
        ? sandbox.files.write('/home/user/profile.json', profileJson)
        : Promise.resolve(),
      // Utility library
      sandbox.files.write('/home/user/agent_utils.py', AGENT_UTILS_PYTHON),
    ]);

    console.log(`[Claude Code E2B] Files written in ${Date.now() - writeStartTime}ms`);

    // Build the prompt
    const prompt = hasParsedData
      ? buildEnhancedPrompt(branding, profileString, userInstructions)
      : buildLegacyPrompt(branding, userInstructions);

    // Escape the prompt for shell
    const escapedPrompt = prompt.replace(/'/g, "'\\''");

    // Run Claude Code with full permissions
    console.log('[Claude Code E2B] Running Claude Code CLI...');
    const commandStartTime = Date.now();

    // Version check
    const versionCheck = await sandbox.commands.run('which claude && claude --version', {
      timeoutMs: 30000,
      cwd: '/home/user',
    }).catch((err) => {
      console.log('[Claude Code E2B] Version check failed:', err.message);
      return { stdout: '', stderr: err.message, exitCode: 1 };
    });
    console.log('[Claude Code E2B] Claude CLI check:', versionCheck.stdout || versionCheck.stderr);

    // Run the actual command
    let result: { stdout: string; stderr: string; exitCode: number };
    const turnCounter = { value: 0 };
    const collectedStdout: string[] = [];
    const collectedStderr: string[] = [];

    printLogHeader('Dashboard Generation');

    try {
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
      console.warn('[Claude Code E2B] Command exited with error (checking output...)');

      const err = cmdError as { result?: { stdout?: string; stderr?: string; exitCode?: number }; message?: string };
      console.log('[Claude Code E2B] Exit code:', err.result?.exitCode);

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
        console.log('[Claude Code E2B] Output was generated, continuing');
        result = {
          stdout: collectedStdout.join(''),
          stderr: collectedStderr.join(''),
          exitCode: err.result?.exitCode || 1,
        };
      } else {
        const envCheck = await sandbox.commands.run('echo "ANTHROPIC_API_KEY set: ${ANTHROPIC_API_KEY:+yes}"', {
          timeoutMs: 5000,
        }).catch(() => ({ stdout: 'failed to check', stderr: '', exitCode: 1 }));
        console.log('[Claude Code E2B] API key check:', envCheck.stdout);
        throw cmdError;
      }
    }

    const commandDuration = Date.now() - commandStartTime;
    printLogFooter(turnCounter.value, commandDuration);

    console.log(`[Claude Code E2B] Claude Code completed in ${commandDuration}ms`);
    console.log('[Claude Code E2B] Exit code:', result.exitCode);
    console.log('[Claude Code E2B] Total turns:', turnCounter.value);

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
      const lsResult = await sandbox.commands.run('ls -la /home/user/', { timeoutMs: 5000 });
      console.log('[Claude Code E2B] Directory listing:', lsResult.stdout);
      throw new Error('Claude Code did not generate output.html');
    }

    // Validate HTML
    if (!html || html.length < 100) {
      throw new Error(`Generated HTML is too short (${html?.length || 0} chars)`);
    }

    if (!html.includes('<html') && !html.includes('<!DOCTYPE')) {
      console.warn('[Claude Code E2B] Warning: HTML may be incomplete');
    }

    // Extract summary
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
        claudeCodeE2B: true,
        enhancedPipeline: !!hasParsedData, // Flag for enhanced flow
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
