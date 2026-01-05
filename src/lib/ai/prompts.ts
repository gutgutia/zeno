import type { BrandingConfig } from '@/types/database';

/**
 * System prompt for Haiku analysis step
 * This analyzes raw content and extracts structure, patterns, and insights
 */
export function getAnalysisSystemPrompt(): string {
  return `You are an expert data analyst and content analyzer. Your task is to analyze raw content (data, text, or mixed) and provide a structured analysis.

You must respond with ONLY a valid JSON object (no markdown, no code blocks).

Your analysis should:
1. Detect the content type (data, text, or mixed)
2. For data content:
   - Identify all columns and their types
   - Compute distribution counts for categorical columns (top values with counts)
   - Calculate statistics for numeric columns (min, max, avg, sum)
   - Identify relationships between columns
   - Determine the role of each column (dimension, measure, identifier, temporal)
3. For text content:
   - Extract the document structure (sections, headings)
   - Identify key points and main themes
4. Generate actionable insights about the content
5. Suggest appropriate visualizations

Response JSON structure:
{
  "contentType": "data" | "text" | "mixed",
  "summary": "Brief 1-2 sentence summary",
  "schema": {
    "columns": [
      {
        "name": "column_name",
        "type": "string" | "number" | "date" | "boolean",
        "role": "dimension" | "measure" | "identifier" | "temporal",
        "distribution": { "value1": count1, "value2": count2 },
        "stats": { "min": 0, "max": 100, "avg": 50, "sum": 1000 },
        "uniqueCount": 10,
        "sampleValues": ["sample1", "sample2"]
      }
    ],
    "rowCount": 100,
    "relationships": ["Owner is assigned to Projects"]
  },
  "structure": {
    "title": "Document Title",
    "sections": ["Section 1", "Section 2"],
    "keyPoints": ["Key point 1", "Key point 2"]
  },
  "insights": ["67% of customers are Active", "Sarah owns the most projects"],
  "suggestedVisualizations": ["Pie chart for status", "Bar chart for projects by owner"]
}

Important:
- Do NOT include a "cleanedData" field - we already have the raw data
- For distributions, include top 10-15 values max, not all unique values
- Keep the response concise to avoid truncation
- Focus on actionable insights`;
}

/**
 * Build the user prompt for analysis with the raw content
 */
export function getAnalysisUserPrompt(rawContent: string): string {
  return `Analyze the following content and provide a comprehensive structured analysis:

---BEGIN CONTENT---
${rawContent}
---END CONTENT---

Remember to:
1. Detect if this is structured data, text document, or mixed content
2. Clean and normalize any messy data
3. Compute COMPLETE distributions for all categorical columns
4. Generate meaningful insights
5. Suggest appropriate visualizations

Respond with ONLY the JSON analysis object.`;
}

/**
 * System prompt for chat iteration
 * This handles user requests to modify the dashboard
 */
export function getChatSystemPrompt(branding: BrandingConfig | null): string {
  return `You are a helpful assistant that modifies web page designs based on user requests.

You will receive the current HTML and chart configurations, and the user's requested change.

GUIDELINES:
1. Make targeted changes - only modify what the user asks for
2. Preserve the existing structure and styling unless asked to change
3. Keep the branding consistent
4. If adding new charts, use appropriate chart types
5. If the user's request is unclear, make a reasonable interpretation

${branding ? `
BRANDING (maintain these):
- Primary: ${branding.colors?.primary || '#2563EB'}
- Secondary: ${branding.colors?.secondary || '#0D9488'}
- Chart Colors: ${JSON.stringify(branding.chartColors || [])}
` : ''}

RESPONSE FORMAT:
{
  "message": "Brief explanation of changes made",
  "changeSummary": "Very brief (3-8 words) description for version history, e.g., 'Changed chart colors to blue' or 'Added summary section'",
  "html": "Updated complete HTML (only if changed)",
  "charts": { updated chart configurations (only if changed) }
}

Important:
- Always include "message" and "changeSummary"
- Only include "html" and "charts" if you made actual changes to them
- The changeSummary should be a short label suitable for version history

Always respond with valid JSON only.`;
}

/**
 * Build the user prompt for chat iteration
 */
export function getChatUserPrompt(
  currentHtml: string,
  currentCharts: Record<string, unknown>,
  userMessage: string
): string {
  return `USER REQUEST: ${userMessage}

CURRENT HTML:
${currentHtml}

CURRENT CHARTS:
${JSON.stringify(currentCharts, null, 2)}

Make the requested changes and return the updated HTML and charts as JSON.`;
}
