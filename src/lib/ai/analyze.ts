import Anthropic from '@anthropic-ai/sdk';
import { getAnalysisSystemPrompt, getAnalysisUserPrompt } from './prompts';
import type { AnalysisResult } from '@/types/dashboard';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Claude Haiku 4.5 for fast, cheap analysis
const ANALYSIS_MODEL = 'claude-haiku-4-5';

/**
 * Analyze raw content using Claude Haiku
 * This is the first step of the two-step generation process
 *
 * @param rawContent - The raw pasted/uploaded content
 * @returns Structured analysis result
 */
export async function analyzeContent(rawContent: string): Promise<AnalysisResult> {
  const systemPrompt = getAnalysisSystemPrompt();
  const userPrompt = getAnalysisUserPrompt(rawContent);

  const message = await anthropic.messages.create({
    model: ANALYSIS_MODEL,
    max_tokens: 16000, // Haiku supports up to 8192 output, but we request more for safety
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
  });

  // Extract text content
  const textContent = message.content.find(c => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  // Parse JSON response with error recovery
  let analysis: AnalysisResult;
  try {
    analysis = JSON.parse(textContent.text);
  } catch {
    // Try to extract JSON from response (in case there's extra text)
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        analysis = JSON.parse(jsonMatch[0]);
      } catch {
        // Try to fix common JSON issues
        let fixedJson = jsonMatch[0]
          // Remove trailing commas before } or ]
          .replace(/,(\s*[}\]])/g, '$1')
          // Fix single quotes to double quotes (be careful with apostrophes in text)
          .replace(/([{,]\s*)'/g, '$1"')
          .replace(/'(\s*[}:\],])/g, '"$1');

        try {
          analysis = JSON.parse(fixedJson);
        } catch (finalError) {
          console.error('Failed to parse analysis response after fixes:', textContent.text.slice(0, 500));
          throw new Error('Failed to parse analysis response as JSON');
        }
      }
    } else {
      console.error('Failed to parse analysis response:', textContent.text.slice(0, 500));
      throw new Error('Failed to parse analysis response as JSON');
    }
  }

  // Validate required fields
  if (!analysis.contentType) {
    analysis.contentType = 'data'; // Default to data if not specified
  }
  if (!analysis.insights) {
    analysis.insights = [];
  }
  if (!analysis.suggestedVisualizations) {
    analysis.suggestedVisualizations = [];
  }
  if (!analysis.summary) {
    analysis.summary = 'Content analysis completed';
  }

  return analysis;
}

/**
 * Quick content type detection without full analysis
 * Useful for UI hints before full analysis runs
 */
export function detectContentTypeQuick(content: string): 'data' | 'text' | 'mixed' {
  const lines = content.trim().split('\n');
  if (lines.length === 0) return 'text';

  // Check for CSV/TSV patterns
  const firstLine = lines[0];
  const hasTabDelimiter = firstLine.includes('\t');
  const hasCommaDelimiter = firstLine.includes(',');

  if (hasTabDelimiter || hasCommaDelimiter) {
    // Check if subsequent lines have similar structure
    const delimiter = hasTabDelimiter ? '\t' : ',';
    const firstLineFields = firstLine.split(delimiter).length;

    let consistentLines = 0;
    for (let i = 1; i < Math.min(lines.length, 5); i++) {
      if (lines[i].split(delimiter).length === firstLineFields) {
        consistentLines++;
      }
    }

    if (consistentLines >= Math.min(lines.length - 1, 3)) {
      return 'data';
    }
  }

  // Check for JSON data
  if (content.trim().startsWith('[') || content.trim().startsWith('{')) {
    try {
      JSON.parse(content);
      return 'data';
    } catch {
      // Not valid JSON, continue checking
    }
  }

  // Check for mostly prose (long lines, few delimiters)
  const avgLineLength = content.length / lines.length;
  const totalDelimiters = (content.match(/[,\t|]/g) || []).length;
  const delimiterRatio = totalDelimiters / content.length;

  if (avgLineLength > 100 && delimiterRatio < 0.02) {
    return 'text';
  }

  // If there's some structure but also prose, it's mixed
  if (lines.length > 5 && avgLineLength > 50) {
    return 'mixed';
  }

  return 'data';
}
