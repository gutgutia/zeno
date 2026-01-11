import type { BrandingConfig } from '@/types/database';
import type { DataDiff } from '@/lib/data/diff';

/**
 * System prompt for surgical dashboard refresh agent.
 * The agent uses read_lines and edit_file for efficient, targeted updates.
 */
export function getRefreshSystemPrompt(
  branding: BrandingConfig | null,
  approach: 'surgical' | 'regenerate' = 'surgical'
): string {
  if (approach === 'regenerate') {
    return getRegenerateSystemPrompt(branding);
  }

  return `You are a dashboard refresh agent. Your job is to make SURGICAL updates to an existing dashboard based on data changes.

CRITICAL RULES:
1. The dashboard layout, chart types, sections, and design must remain IDENTICAL
2. Only update the specific values that have changed
3. Use edit_file for targeted string replacements - do NOT regenerate the entire HTML
4. Preserve all styling, formatting, and structure

AVAILABLE TOOLS:
- read_lines: Read specific line ranges from files (use to inspect HTML structure)
- edit_file: Replace specific text in files (use for surgical value updates)
- get_file: Get complete file contents (use ONLY after all edits are done)
- execute_python: Run Python code (use to compute new values if needed)

FILES:
- /tmp/existing.html - The current dashboard HTML to modify
- /tmp/data.txt - The new data (for reference if needed)

WORKFLOW:
1. Review the DATA CHANGES provided in the prompt
2. Use read_lines to find where those values appear in /tmp/existing.html
3. Use edit_file to replace old values with new values
4. For new columns/rows, use edit_file to INSERT new content in appropriate locations
5. After all edits, use get_file to retrieve the final HTML
6. Return the result in the required JSON format

EDITING TIPS:
- Include enough context in old_string to make it unique (e.g., include surrounding HTML tags)
- For numbers in charts, look for data arrays like [123, 456, 789]
- For displayed values, look for patterns like ">$1.2M<" or "class="metric-value">45,000"
- When adding new columns to tables, find the </tr> tags and insert before them

OUTPUT FORMAT:
Return ONLY this JSON (no markdown code blocks):
{
  "html": "<complete updated HTML from get_file>",
  "summary": "Brief description of changes made",
  "changes": [{"metric": "Name", "old": "value", "new": "value", "change": "+X%"}],
  "warnings": []
}

${branding ? `BRANDING (preserve exactly): ${JSON.stringify(branding)}` : ''}`;
}

/**
 * System prompt for full regeneration (when domain has changed significantly)
 */
function getRegenerateSystemPrompt(branding: BrandingConfig | null): string {
  return `You are a dashboard refresh agent. The data has changed significantly, requiring regeneration of dashboard content.

CRITICAL: While you need to update the dashboard substantially, try to preserve:
- The overall visual style and theme
- The color scheme and fonts
- The general layout structure if appropriate

MOBILE-FIRST DESIGN (CRITICAL):
- Ensure the regenerated content is mobile-responsive
- Use flexbox/grid with responsive breakpoints
- Touch targets must be at least 44x44 pixels
- Tables should have horizontal scroll wrappers (overflow-x: auto)
- Charts should be full-width on mobile

You have access to a Python sandbox via the execute_python tool.
- New data is at /tmp/data.txt
- Existing dashboard HTML is at /tmp/existing.html (for style reference)

WORKFLOW:
1. Read /tmp/existing.html to understand the current styling and theme
2. Read /tmp/data.txt for the new data
3. Use Python to analyze the new data and compute metrics
4. Generate updated HTML that fits the new data while maintaining visual consistency

OUTPUT FORMAT:
Return ONLY this JSON (no markdown):
{
  "html": "<updated HTML>",
  "summary": "Brief description of changes",
  "changes": [{"metric": "Name", "old": "N/A", "new": "value"}],
  "warnings": ["Data structure changed significantly - dashboard regenerated"]
}

${branding ? `BRANDING (preserve exactly): ${JSON.stringify(branding)}` : ''}`;
}

/**
 * User prompt for surgical refresh with diff information
 */
export function getRefreshUserPrompt(
  diff: DataDiff,
  diffFormatted: string,
  previousSummary?: string
): string {
  if (diff.unchanged) {
    return `No changes detected in the data. Return the existing HTML unchanged.

Use get_file to read /tmp/existing.html and return it in the JSON format.`;
  }

  if (diff.domainChanged || diff.recommendedApproach === 'regenerate') {
    return `The data has changed significantly and requires regeneration.

${diff.domainChangeReason ? `Reason: ${diff.domainChangeReason}` : ''}

${previousSummary ? `Previous dashboard summary: "${previousSummary}"\n` : ''}

1. Read /tmp/existing.html to understand the current styling
2. Read /tmp/data.txt for the new data
3. Generate updated dashboard content that fits the new data
4. Preserve the visual style and theme as much as possible`;
  }

  // Surgical update prompt
  const parts: string[] = [];

  parts.push('Update the dashboard with the following data changes using SURGICAL edits:\n');
  parts.push('=' .repeat(60));
  parts.push(diffFormatted);
  parts.push('=' .repeat(60));
  parts.push('');

  if (previousSummary) {
    parts.push(`Dashboard context: "${previousSummary}"\n`);
  }

  parts.push('INSTRUCTIONS:');
  parts.push('1. Use read_lines to examine /tmp/existing.html and locate the values to update');
  parts.push('2. Use edit_file to make targeted replacements for each changed value');

  if (diff.schema?.columnsAdded && diff.schema.columnsAdded.length > 0) {
    parts.push(`3. For new columns (${diff.schema.columnsAdded.join(', ')}): Find where to insert and add the new data`);
  }

  if (diff.rows?.added && diff.rows.added > 0) {
    parts.push(`4. For new rows: Find tables/lists and add ${diff.rows.added} new entries`);
  }

  if (diff.rows?.removed && diff.rows.removed > 0) {
    parts.push(`5. For removed rows: Find and remove the corresponding entries from tables/lists`);
  }

  parts.push('');
  parts.push('After completing all edits, use get_file to retrieve the final HTML.');
  parts.push('Return the result in the required JSON format.');

  return parts.join('\n');
}

/**
 * Legacy user prompt for backwards compatibility (when diff is not available)
 */
export function getLegacyRefreshUserPrompt(
  existingHtml: string,
  previousSummary?: string
): string {
  return `Refresh the dashboard with new data.

${previousSummary ? `Previous summary: "${previousSummary}"\n` : ''}
1. Read /tmp/existing.html to understand the structure
2. Read /tmp/data.txt for the new data
3. Compare old and new data to identify changes
4. Use edit_file to make surgical updates where values changed
5. Use get_file to retrieve the final HTML
6. Return updated HTML with same structure, new values`;
}
