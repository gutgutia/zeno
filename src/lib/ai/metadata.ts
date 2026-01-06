import Anthropic from '@anthropic-ai/sdk';
import type { DataSource } from '@/types/database';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Claude Haiku for fast, cheap metadata generation
const METADATA_MODEL = 'claude-haiku-4-5';

export interface MetadataContext {
  rawContent: string;
  dataSource?: DataSource;
  userInstructions?: string;
  columnNames?: string[];
}

export interface DashboardMetadata {
  title: string;
  description: string;
}

/**
 * Build a preview of the content for the LLM
 * Limits content to avoid token waste while preserving key information
 */
function buildContentPreview(rawContent: string, columnNames?: string[]): string {
  const lines = rawContent.split('\n');
  const previewLines: string[] = [];

  // Take first 20 lines or 2000 chars, whichever is smaller
  let charCount = 0;
  const maxChars = 2000;
  const maxLines = 20;

  for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
    if (charCount + lines[i].length > maxChars) break;
    previewLines.push(lines[i]);
    charCount += lines[i].length + 1; // +1 for newline
  }

  let preview = previewLines.join('\n');

  // If we have column names, prepend them prominently
  if (columnNames && columnNames.length > 0) {
    preview = `Columns: ${columnNames.join(', ')}\n\n${preview}`;
  }

  // Indicate if content was truncated
  if (lines.length > previewLines.length) {
    preview += `\n\n[... ${lines.length - previewLines.length} more rows]`;
  }

  return preview;
}

/**
 * Generate a title and description for a dashboard using Claude Haiku
 *
 * @param context - Information about the data and user intent
 * @returns Generated title and description
 */
export async function generateDashboardMetadata(
  context: MetadataContext
): Promise<DashboardMetadata> {
  const { rawContent, dataSource, userInstructions, columnNames } = context;

  const contentPreview = buildContentPreview(rawContent, columnNames);

  // Build context about the data source
  let sourceContext = '';
  if (dataSource) {
    if (dataSource.fileName) {
      sourceContext += `File: ${dataSource.fileName}\n`;
    }
    if (dataSource.type === 'google_sheets' && dataSource.spreadsheetName) {
      sourceContext += `Google Sheet: ${dataSource.spreadsheetName}\n`;
    }
    if (dataSource.selectedSheets && dataSource.selectedSheets.length > 0) {
      sourceContext += `Sheets: ${dataSource.selectedSheets.join(', ')}\n`;
    }
  }

  const systemPrompt = `You are a helpful assistant that generates concise, descriptive titles and descriptions for data dashboards.

Your task is to analyze the provided data and context to generate:
1. A short, descriptive title (3-8 words) that captures what this dashboard is about
2. A brief description (1-2 sentences) explaining what data is visualized and what insights it might provide

Guidelines:
- Title should be specific and descriptive, not generic like "Data Dashboard" or "Analytics Report"
- Title should reflect the actual content (e.g., "Q4 Sales Performance by Region", "Customer Churn Analysis", "Monthly Revenue Trends")
- Description should mention the type of data and potential insights
- If user instructions are provided, incorporate that intent into the title/description
- Keep the title professional and concise
- Avoid redundant words like "Dashboard" in the title (it's already a dashboard)

Respond with valid JSON only, no markdown code blocks:
{"title": "your title here", "description": "your description here"}`;

  let userPrompt = '';

  if (sourceContext) {
    userPrompt += `Data Source Information:\n${sourceContext}\n\n`;
  }

  if (userInstructions) {
    userPrompt += `User's Request:\n${userInstructions}\n\n`;
  }

  userPrompt += `Data Preview:\n${contentPreview}`;

  try {
    const message = await anthropic.messages.create({
      model: METADATA_MODEL,
      max_tokens: 256,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const textContent = message.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Clean the response - strip markdown code blocks if present
    let responseText = textContent.text.trim();
    if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```(?:json)?\s*\n?/, '');
      responseText = responseText.replace(/\n?```\s*$/, '');
    }

    const metadata = JSON.parse(responseText) as DashboardMetadata;

    // Validate and provide fallbacks
    if (!metadata.title || typeof metadata.title !== 'string') {
      metadata.title = 'Data Analysis';
    }
    if (!metadata.description || typeof metadata.description !== 'string') {
      metadata.description = 'An interactive dashboard visualizing your data.';
    }

    // Truncate if too long
    if (metadata.title.length > 100) {
      metadata.title = metadata.title.slice(0, 97) + '...';
    }
    if (metadata.description.length > 500) {
      metadata.description = metadata.description.slice(0, 497) + '...';
    }

    return metadata;
  } catch (error) {
    console.error('Failed to generate dashboard metadata:', error);

    // Return sensible fallbacks based on available context
    let fallbackTitle = 'Data Analysis';
    let fallbackDescription = 'An interactive dashboard visualizing your data.';

    if (dataSource?.fileName) {
      // Extract a title from the filename
      const nameWithoutExt = dataSource.fileName.replace(/\.[^/.]+$/, '');
      fallbackTitle = nameWithoutExt
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .slice(0, 100);
    } else if (dataSource?.spreadsheetName) {
      fallbackTitle = dataSource.spreadsheetName.slice(0, 100);
    }

    if (userInstructions) {
      fallbackDescription = userInstructions.slice(0, 200);
    }

    return {
      title: fallbackTitle,
      description: fallbackDescription,
    };
  }
}
