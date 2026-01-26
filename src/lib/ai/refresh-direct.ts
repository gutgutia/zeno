/**
 * Direct (non-agentic) approach to dashboard refresh.
 *
 * This is a simpler, faster, cheaper alternative to the agent-based approach.
 * It uses:
 * 1. The pre-computed data diff to understand what changed
 * 2. A quick classification call (Haiku) to determine if surgical update or regeneration is needed
 * 3. For surgical updates: A single Sonnet call that returns find/replace edits
 *
 * Benefits:
 * - No sandbox overhead
 * - No multi-turn agent loop
 * - Faster response times (~10-15s vs 30-60s)
 * - Lower cost
 * - More predictable behavior
 */

import Anthropic from '@anthropic-ai/sdk';
import type { BrandingConfig } from '@/types/database';
import type { DashboardConfig } from '@/types/dashboard';
import type { DataDiff } from '@/lib/data/diff';
import { formatDiffForAI } from '@/lib/data/diff';
import type { TokenUsage, AgentUsageResult } from './agent';

const anthropic = new Anthropic();

// ============================================================================
// TYPES
// ============================================================================

interface ClassificationResult {
  approach: 'surgical' | 'regenerate';
  reason: string;
}

interface Edit {
  find: string;
  replace: string;
}

interface RefreshDirectResult {
  html: string;
  summary: string;
  changes: Array<{ metric: string; old: string; new: string }>;
  edits: Edit[];
}

export interface RefreshResultWithUsage {
  html: string;
  summary: string;
  changes?: Array<{ metric: string; old: string; new: string }>;
  warnings?: string[];
  usage: AgentUsageResult;
}

export interface RefreshNeedsRegeneration {
  needsRegeneration: true;
  reason: string;
}

export type DirectRefreshResult = RefreshResultWithUsage | RefreshNeedsRegeneration;

// Type guard for checking if result needs regeneration
export function needsRegeneration(result: DirectRefreshResult): result is RefreshNeedsRegeneration {
  return 'needsRegeneration' in result && result.needsRegeneration === true;
}

// ============================================================================
// CLASSIFICATION (Haiku - fast & cheap)
// ============================================================================

const CLASSIFICATION_SYSTEM_PROMPT = `You classify data refresh changes to determine the best update approach.

Given a summary of what changed between old and new data, determine if:
1. SURGICAL: Changes can be applied with targeted HTML edits (value updates, minor additions/removals)
2. REGENERATE: Changes are too significant and require full dashboard regeneration

Choose SURGICAL when:
- Only values/numbers changed (e.g., revenue $1.2M -> $1.4M)
- 1-2 columns added (can add a new chart)
- 1-2 columns removed (can remove a chart)
- Rows added/removed (update tables and charts)
- Minor structural changes that don't change the dashboard's purpose

Choose REGENERATE when:
- More than 3 columns changed (added + removed)
- The data domain fundamentally changed (different type of data entirely)
- Column names suggest completely different metrics
- The change summary indicates a major restructuring

Respond with JSON only:
{"approach": "surgical" | "regenerate", "reason": "brief explanation"}`;

async function classifyRefreshChanges(diff: DataDiff): Promise<ClassificationResult> {
  // Fast path: if diff already determined domain changed, skip AI call
  if (diff.domainChanged) {
    console.log('[Refresh Direct] Domain change detected by diff, skipping classification');
    return {
      approach: 'regenerate',
      reason: diff.domainChangeReason || 'Domain changed significantly',
    };
  }

  // Fast path: if no significant schema changes and just value updates
  const hasSchemaChanges = diff.schema && (
    diff.schema.columnsAdded.length > 0 ||
    diff.schema.columnsRemoved.length > 0
  );

  if (!hasSchemaChanges && diff.cells && diff.cells.length > 0) {
    console.log('[Refresh Direct] Only value changes detected, using surgical approach');
    return {
      approach: 'surgical',
      reason: 'Only value changes, no schema modifications',
    };
  }

  // Use Haiku to classify more complex cases
  const startTime = Date.now();
  const diffSummary = formatDiffForAI(diff);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 150,
      system: CLASSIFICATION_SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: `Data Change Summary:\n${diffSummary}` }
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const elapsed = Date.now() - startTime;
    console.log(`[Refresh Direct] Classification completed in ${elapsed}ms`);

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log(`[Refresh Direct] Classification: approach=${parsed.approach}, reason="${parsed.reason}"`);
      return {
        approach: parsed.approach === 'regenerate' ? 'regenerate' : 'surgical',
        reason: parsed.reason ?? 'Unknown',
      };
    }

    // Default to surgical if parse fails (more conservative)
    console.log('[Refresh Direct] Classification parse failed, defaulting to surgical');
    return { approach: 'surgical', reason: 'Parse failed, defaulting to surgical approach' };
  } catch (error) {
    console.error('[Refresh Direct] Classification error:', error);
    // Default to surgical on error (try the simpler approach first)
    return { approach: 'surgical', reason: 'Classification failed, attempting surgical approach' };
  }
}

// ============================================================================
// SURGICAL UPDATE (Sonnet - precise edits)
// ============================================================================

function getRefreshSystemPrompt(branding: BrandingConfig | null): string {
  let brandingSection = '';

  if (branding && (branding.colors?.primary || branding.styleGuide)) {
    const colorsSection = branding.colors?.primary ? `
- Primary color: ${branding.colors.primary}
- Secondary color: ${branding.colors.secondary || '#64748b'}` : '';

    const styleGuideSection = branding.styleGuide ? `
- Style: ${branding.styleGuide}` : '';

    brandingSection = `
## Brand Guidelines${colorsSection}${styleGuideSection}

IMPORTANT: Brand colors are accents, not themes. Use them sparingly. Never use gradients.
`;
  }

  return `You are a dashboard HTML updater. You make surgical edits to dashboard HTML based on data changes.

${brandingSection}

## Your Task
Given:
1. The current dashboard HTML
2. A summary of what changed in the data
3. The new data

Return the specific edits needed to update the dashboard to reflect the new data.

## Output Format
Return a JSON object with:
1. "edits": Array of {find, replace} pairs. Each "find" must be an EXACT string from the HTML.
2. "summary": Brief description of what was updated
3. "changes": Array of {metric, old, new} describing key value changes shown to users

## Rules for Edits
- Each "find" string must exist EXACTLY in the HTML (including whitespace)
- Update values, numbers, and text that changed
- For new columns: Add new chart/card sections in appropriate locations
- For removed columns: Remove the corresponding chart/card sections
- For added rows: Update tables and chart data
- Keep edits atomic and independent when possible
- Preserve the dashboard's existing style and layout

## Common Edit Patterns

### Updating a value in text:
{"find": "$1,234,567", "replace": "$1,456,789"}

### Updating a KPI card:
{"find": "<span class=\"value\">$1.2M</span>", "replace": "<span class=\"value\">$1.4M</span>"}

### Adding a new chart section (find insertion point):
{"find": "</div>\\n  <!-- Charts Section -->", "replace": "</div>\\n  <div class=\"chart-card\">NEW CHART HTML</div>\\n  <!-- Charts Section -->"}

### Removing a chart:
{"find": "<div class=\"chart-card\" id=\"partners-chart\">...entire div...</div>", "replace": ""}

Return ONLY valid JSON, no markdown code blocks.`;
}

/**
 * Calculate summary statistics from raw data for accurate counts
 */
function calculateDataStats(rawData: string): string {
  try {
    // Parse as CSV
    const lines = rawData.split('\n').filter(l => l.trim());
    if (lines.length < 2) return '';

    // Simple CSV parsing (handles basic cases)
    const parseRow = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseRow(lines[0]).map(h => h.toLowerCase());
    const rows = lines.slice(1).map(parseRow);

    // Find status column (common names)
    const statusColIndex = headers.findIndex(h =>
      h.includes('status') || h === 'state' || h === 'health'
    );

    const stats: string[] = [];
    stats.push(`TOTAL ROWS: ${rows.length}`);

    // Count by status if we found a status column
    if (statusColIndex >= 0) {
      const statusCounts: Record<string, number> = {};
      for (const row of rows) {
        const status = (row[statusColIndex] || '').trim();
        if (status) {
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        }
      }
      stats.push('STATUS COUNTS:');
      for (const [status, count] of Object.entries(statusCounts).sort((a, b) => b[1] - a[1])) {
        stats.push(`  - ${status}: ${count}`);
      }
    }

    return stats.join('\n');
  } catch {
    return '';
  }
}

function getRefreshUserPrompt(
  html: string,
  diff: DataDiff,
  newData: string
): string {
  const diffSummary = formatDiffForAI(diff);

  // Calculate accurate stats from the FULL data
  const dataStats = calculateDataStats(newData);

  // Include more data (up to 20KB) to ensure Sonnet sees enough
  const truncatedData = newData.length > 20000
    ? newData.slice(0, 20000) + '\n... (data truncated)'
    : newData;

  return `## Current Dashboard HTML
\`\`\`html
${html}
\`\`\`

## Data Changes
${diffSummary}

## ACCURATE DATA STATISTICS (calculated from full data)
${dataStats || 'Unable to calculate stats'}

IMPORTANT: Use these statistics for summary cards/counts. The numbers above are calculated from the COMPLETE dataset.

## New Data
\`\`\`
${truncatedData}
\`\`\`

Return the JSON with edits needed to update this dashboard with the new data. Make sure summary statistics match the ACCURATE DATA STATISTICS above.`;
}

interface ApplyRefreshOptions {
  html: string;
  diff: DataDiff;
  newData: string;
  branding: BrandingConfig | null;
}

async function applySurgicalRefresh(
  options: ApplyRefreshOptions
): Promise<{ result: RefreshDirectResult; usage: TokenUsage; costUsd: number; durationMs: number }> {
  const { html, diff, newData, branding } = options;
  const startTime = Date.now();

  const systemPrompt = getRefreshSystemPrompt(branding);
  const userPrompt = getRefreshUserPrompt(html, diff, newData);

  console.log(`[Refresh Direct] Calling Sonnet for surgical update...`);
  console.log(`[Refresh Direct] HTML length: ${html.length}, data length: ${newData.length}`);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 16000, // Higher limit for refresh since we might add new sections
    system: systemPrompt,
    messages: [
      { role: 'user', content: userPrompt }
    ],
  });

  const durationMs = Date.now() - startTime;
  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  console.log(`[Refresh Direct] Sonnet response in ${durationMs}ms`);
  console.log(`[Refresh Direct] Response length: ${text.length}`);

  // Parse the response
  let parsed: { edits?: Edit[]; summary?: string; changes?: Array<{ metric: string; old: string; new: string }> } = {};
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    }
  } catch (parseError) {
    console.error('[Refresh Direct] Failed to parse response:', parseError);
    throw new Error('Failed to parse refresh response');
  }

  if (!parsed.edits || !Array.isArray(parsed.edits)) {
    console.error('[Refresh Direct] Invalid response structure:', text.slice(0, 500));
    throw new Error('Invalid refresh response: missing edits array');
  }

  // Apply the edits
  let modifiedHtml = html;
  const appliedEdits: Edit[] = [];
  const failedEdits: Edit[] = [];

  for (const edit of parsed.edits) {
    if (!edit.find || typeof edit.find !== 'string') {
      console.warn('[Refresh Direct] Skipping invalid edit (no find string)');
      continue;
    }

    if (modifiedHtml.includes(edit.find)) {
      modifiedHtml = modifiedHtml.replace(edit.find, edit.replace || '');
      appliedEdits.push(edit);
      console.log(`[Refresh Direct] Applied edit: "${edit.find.slice(0, 50)}..." -> "${(edit.replace || '').slice(0, 50)}..."`);
    } else {
      failedEdits.push(edit);
      console.warn(`[Refresh Direct] Edit not found in HTML: "${edit.find.slice(0, 100)}..."`);
    }
  }

  if (appliedEdits.length === 0 && parsed.edits.length > 0) {
    console.error('[Refresh Direct] No edits could be applied!');
    throw new Error('No edits could be applied - the find strings did not match the HTML');
  }

  if (failedEdits.length > 0) {
    console.warn(`[Refresh Direct] ${failedEdits.length} of ${parsed.edits.length} edits failed to apply`);
  }

  // Calculate usage
  const usage: TokenUsage = {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };

  // Estimate cost (Sonnet pricing: $3/M input, $15/M output)
  const costUsd = (usage.inputTokens * 0.003 + usage.outputTokens * 0.015) / 1000;

  return {
    result: {
      html: modifiedHtml,
      summary: parsed.summary || 'Dashboard refreshed with new data',
      changes: parsed.changes || [],
      edits: appliedEdits,
    },
    usage,
    costUsd,
    durationMs,
  };
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Refresh a dashboard using the direct (non-agentic) approach.
 *
 * This function:
 * 1. Uses the pre-computed diff to understand what changed
 * 2. Classifies the change (Haiku) to determine if surgical or regeneration
 * 3. For surgical: Calls Sonnet to get targeted edits
 * 4. For regeneration: Returns a signal to use full generation instead
 *
 * @param newContent - The new raw data content
 * @param currentConfig - The current dashboard config (contains HTML)
 * @param branding - Optional branding config
 * @param context - Contains oldRawContent and pre-computed diff
 * @returns Either RefreshResultWithUsage or RefreshNeedsRegeneration
 */
export async function refreshDashboardDirect(
  newContent: string,
  currentConfig: DashboardConfig,
  branding: BrandingConfig | null,
  context: {
    oldRawContent: string;
    diff: DataDiff;
  }
): Promise<DirectRefreshResult> {
  console.log('[Refresh Direct] Starting direct refresh...');
  console.log('[Refresh Direct] Diff summary:', context.diff.summary);
  const totalStartTime = Date.now();

  // Step 1: Classify the changes
  const classification = await classifyRefreshChanges(context.diff);

  // Step 2: If regeneration is needed, signal to caller
  if (classification.approach === 'regenerate') {
    console.log('[Refresh Direct] Regeneration required:', classification.reason);
    return {
      needsRegeneration: true,
      reason: classification.reason,
    };
  }

  // Step 3: Apply surgical refresh
  console.log('[Refresh Direct] Using surgical approach:', classification.reason);

  const currentHtml = currentConfig.html;
  if (!currentHtml) {
    throw new Error('Dashboard has no HTML to refresh');
  }

  const { result, usage, costUsd, durationMs } = await applySurgicalRefresh({
    html: currentHtml,
    diff: context.diff,
    newData: newContent,
    branding,
  });

  const totalDurationMs = Date.now() - totalStartTime;
  console.log(`[Refresh Direct] Total time: ${totalDurationMs}ms`);
  console.log(`[Refresh Direct] Edits applied: ${result.edits.length}`);
  console.log(`[Refresh Direct] Cost: $${costUsd.toFixed(4)}`);

  // Build warnings if some edits failed
  const warnings: string[] = [];
  const totalEditsRequested = result.edits.length; // This is applied edits
  if (context.diff.schema?.columnsAdded.length && context.diff.schema.columnsAdded.length > 0) {
    // If columns were added, we might want to note if their visualizations weren't added
    warnings.push(`Note: ${context.diff.schema.columnsAdded.length} new column(s) detected. Verify new visualizations were added.`);
  }

  // Build the usage result
  const agentUsage: AgentUsageResult = {
    usage,
    costUsd,
    turnCount: 1, // Direct approach is always 1 turn
    durationMs: totalDurationMs,
    modelId: 'claude-sonnet-4-5',
  };

  return {
    html: result.html,
    summary: result.summary,
    changes: result.changes,
    warnings: warnings.length > 0 ? warnings : undefined,
    usage: agentUsage,
  };
}
