import Anthropic from '@anthropic-ai/sdk';
import { getGenerationSystemPrompt, getGenerationUserPrompt } from './prompts';
import type { AnalysisResult, DashboardConfig } from '@/types/dashboard';
import type { BrandingConfig } from '@/types/database';
import type { ChartConfig } from '@/types/chart';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Opus 4.5 for high-quality generation
const GENERATION_MODEL = 'claude-opus-4-5';

interface GenerationResult {
  html: string;
  charts: Record<string, ChartConfig>;
}

/**
 * Generate a beautiful dashboard/page using Claude Opus
 * This is the second step of the two-step generation process
 *
 * @param analysis - Analysis result from Haiku step
 * @param branding - User's branding configuration
 * @param userInstructions - Optional user instructions
 * @returns Generated HTML and chart configurations
 */
export async function generatePage(
  analysis: AnalysisResult,
  branding: BrandingConfig | null,
  userInstructions?: string
): Promise<GenerationResult> {
  const systemPrompt = getGenerationSystemPrompt(branding);
  const userPrompt = getGenerationUserPrompt(analysis, userInstructions);

  // Use streaming for long-running Opus requests (required by SDK for operations > 10 minutes)
  const stream = anthropic.messages.stream({
    model: GENERATION_MODEL,
    max_tokens: 32000, // Opus 4.5 supports high output
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
  });

  // Collect the full response
  const message = await stream.finalMessage();

  // Check if the response was truncated
  if (message.stop_reason === 'max_tokens') {
    console.warn('Generation response was truncated due to max_tokens limit');
  }

  // Extract text content
  const textContent = message.content.find(c => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  // Clean the response - strip markdown code blocks if present
  let responseText = textContent.text.trim();

  // Remove markdown code blocks (```json ... ``` or ``` ... ```)
  if (responseText.startsWith('```')) {
    responseText = responseText.replace(/^```(?:json)?\s*\n?/, '');
    responseText = responseText.replace(/\n?```\s*$/, '');
  }

  // Parse JSON response
  let result: GenerationResult;
  try {
    result = JSON.parse(responseText);
  } catch {
    // Try to extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        result = JSON.parse(jsonMatch[0]);
      } catch {
        // Try to fix common JSON issues
        let fixedJson = jsonMatch[0]
          .replace(/,(\s*[}\]])/g, '$1')
          .replace(/([{,]\s*)'/g, '$1"')
          .replace(/'(\s*[}:\],])/g, '"$1');
        result = JSON.parse(fixedJson);
      }
    } else {
      console.error('Failed to parse generation response:', responseText.slice(0, 500));
      throw new Error('Failed to parse generation response as JSON');
    }
  }

  // Validate required fields
  if (!result.html) {
    throw new Error('Generation response missing HTML');
  }
  if (!result.charts) {
    result.charts = {};
  }

  // Ensure all charts have required fields
  for (const [id, chart] of Object.entries(result.charts)) {
    if (!chart.id) {
      (chart as ChartConfig).id = id;
    }
    if (!chart.type) {
      console.warn(`Chart ${id} missing type, defaulting to number_card`);
      (chart as ChartConfig).type = 'number_card';
    }
  }

  return result;
}

/**
 * Build the complete dashboard config from generation results
 */
export function buildDashboardConfig(
  analysis: AnalysisResult,
  generation: GenerationResult,
  userInstructions?: string
): DashboardConfig {
  return {
    contentType: analysis.contentType,
    html: generation.html,
    charts: generation.charts,
    analysis: analysis,
    metadata: {
      generatedAt: new Date().toISOString(),
      analysisModel: 'claude-haiku-4-5',
      generationModel: 'claude-opus-4-5',
      userInstructions,
    },
  };
}

/**
 * Run the complete two-step generation process
 */
export async function generateDashboard(
  rawContent: string,
  branding: BrandingConfig | null,
  userInstructions?: string
): Promise<DashboardConfig> {
  // Import here to avoid circular dependency
  const { analyzeContent } = await import('./analyze');

  // Step 1: Analyze with Haiku
  const analysis = await analyzeContent(rawContent);

  // Step 2: Generate with Opus
  const generation = await generatePage(analysis, branding, userInstructions);

  // Build and return the config
  return buildDashboardConfig(analysis, generation, userInstructions);
}
