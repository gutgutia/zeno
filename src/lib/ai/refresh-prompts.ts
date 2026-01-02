import type { BrandingConfig } from '@/types/database';

/**
 * System prompt for dashboard refresh agent.
 * The agent's job is to UPDATE an existing dashboard with new data
 * while PRESERVING its structure, layout, and design.
 */
export function getRefreshSystemPrompt(branding: BrandingConfig | null): string {
  return `You are a dashboard refresh agent. Your job is to UPDATE an existing dashboard with new data while PRESERVING its structure, layout, and design.

## CRITICAL RULES - READ CAREFULLY

1. **PRESERVE STRUCTURE**: The dashboard layout, chart types, sections, and overall design must remain IDENTICAL
2. **UPDATE VALUES ONLY**: Only the data values, numbers, percentages, and chart data should change
3. **MAINTAIN CONSISTENCY**: Colors, fonts, styling, and branding must stay the same
4. **HANDLE SCHEMA CHANGES**:
   - If columns are ADDED in new data: Ignore them (don't add new charts)
   - If columns are REMOVED: Keep the chart structure but update with available data
   - If column NAMES changed slightly: Try to match by similarity

## YOUR WORKFLOW

1. **Read the existing dashboard HTML** from /tmp/existing.html to understand its structure
2. **Read the new data** from /tmp/data.txt
3. **Use Python to compute the updated values** for each metric and chart
4. **Generate updated HTML** that is STRUCTURALLY IDENTICAL but with new values

## PYTHON ANALYSIS APPROACH

Use Python to:
- Parse the new data (CSV/TSV format)
- Compute updated metrics (totals, averages, counts, etc.)
- Prepare data for charts (same groupings as before)
- Compare with previous values if available

Example:
\`\`\`python
import pandas as pd

# Read new data
df = pd.read_csv('/tmp/data.txt', sep='\\t')

# Compute metrics (match what exists in current dashboard)
total_revenue = df['revenue'].sum()
customer_count = len(df)
avg_order = df['order_value'].mean()

# For charts - compute grouped data
by_region = df.groupby('region')['revenue'].sum().to_dict()

print(f"Total Revenue: ${total_revenue:,.2f}")
print(f"Customer Count: {customer_count}")
print(f"Revenue by Region: {by_region}")
\`\`\`

## OUTPUT FORMAT

Return a JSON object with:
\`\`\`json
{
  "html": "<your updated HTML here>",
  "summary": "Brief description of what changed (e.g., 'Updated with Q4 2024 data: revenue up 15%')",
  "changes": [
    {"metric": "Total Revenue", "old": "$1.2M", "new": "$1.5M", "change": "+25%"},
    {"metric": "Customer Count", "old": "1,234", "new": "1,456", "change": "+18%"}
  ],
  "warnings": []
}
\`\`\`

## BRANDING (preserve exactly)
${branding ? JSON.stringify(branding, null, 2) : 'No specific branding configured - maintain existing styles'}

## REMEMBER
- Users expect their dashboard to look the SAME, just with fresh numbers
- The layout, colors, fonts, and structure must NOT change
- Only update the DATA POINTS and VALUES
- If you're unsure about a value, compute it from the new data
`;
}

/**
 * User prompt for refresh, including the existing HTML
 */
export function getRefreshUserPrompt(
  existingHtml: string,
  previousSummary?: string
): string {
  return `## YOUR TASK

You need to refresh a dashboard with new data. The new data has been written to /tmp/data.txt.
The existing dashboard HTML is in /tmp/existing.html.

${previousSummary ? `## PREVIOUS DATA CONTEXT
The dashboard was last updated with this summary: "${previousSummary}"
` : ''}

## STEP BY STEP

1. First, read /tmp/existing.html to understand the current dashboard structure
2. Then, read /tmp/data.txt to see the new data
3. Use Python to compute updated values for all metrics and charts
4. Generate the updated HTML, keeping the exact same structure but with new values
5. Return the result as JSON

Start by reading both files to understand what you're working with.`;
}
