/**
 * Direct (non-agentic) approach to dashboard modification.
 *
 * This is a simpler, faster, cheaper alternative to the agent-based approach.
 * It uses:
 * 1. A quick classification call (Haiku) to determine if data is needed
 * 2. A single modification call (Sonnet) that returns surgical edits
 *
 * Benefits:
 * - No sandbox overhead
 * - No multi-turn agent loop
 * - Faster response times
 * - Lower cost
 * - More predictable behavior
 */

import Anthropic from '@anthropic-ai/sdk';
import type { BrandingConfig } from '@/types/database';
import type { ModifyResultWithUsage, TokenUsage, AgentUsageResult } from './agent';

const anthropic = new Anthropic();

// ============================================================================
// TYPES
// ============================================================================

interface ClassificationResult {
  needsData: boolean;
  reason: string;
}

interface Edit {
  find: string;
  replace: string;
}

interface ModifyDirectResult {
  html: string;
  summary: string;
  edits: Edit[];
}

// ============================================================================
// CLASSIFICATION (Haiku - fast & cheap)
// ============================================================================

const CLASSIFICATION_SYSTEM_PROMPT = `You classify dashboard modification instructions.

Determine if the instruction requires access to the underlying data to complete.

Instructions that NEED data:
- Adding new visualizations/charts (need to know what data exists)
- Fixing incorrect calculations or values
- Adding new metrics or statistics
- Creating tables with data
- Any instruction mentioning specific data fields or values

Instructions that DON'T need data:
- Styling changes (colors, fonts, sizes)
- Layout changes (spacing, alignment, positioning)
- Text changes (titles, labels)
- Adding interactivity (search, filters) - the JS logic can be generic
- Removing elements
- Reordering elements

Respond with JSON only:
{"needsData": boolean, "reason": "brief explanation"}`;

async function classifyInstruction(instruction: string): Promise<ClassificationResult> {
  const startTime = Date.now();

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 150,
      system: CLASSIFICATION_SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: `Instruction: "${instruction}"` }
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const elapsed = Date.now() - startTime;
    console.log(`[Modify Direct] Classification completed in ${elapsed}ms`);

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log(`[Modify Direct] Classification: needsData=${parsed.needsData}, reason="${parsed.reason}"`);
      return {
        needsData: parsed.needsData ?? false,
        reason: parsed.reason ?? 'Unknown',
      };
    }

    // Default to not needing data if parse fails
    console.log('[Modify Direct] Classification parse failed, defaulting to needsData=false');
    return { needsData: false, reason: 'Parse failed, defaulting to no data needed' };
  } catch (error) {
    console.error('[Modify Direct] Classification error:', error);
    // Default to including data on error (safer)
    return { needsData: true, reason: 'Classification failed, including data for safety' };
  }
}

// ============================================================================
// MODIFICATION (Sonnet - surgical edits)
// ============================================================================

function getModifySystemPrompt(branding: BrandingConfig | null): string {
  const brandingSection = branding ? `
## Branding Guidelines
- Primary color: ${branding.colors?.primary || '#0055FF'}
- Secondary color: ${branding.colors?.secondary || '#6B7280'}
- Company: ${branding.companyName || 'Unknown'}
` : '';

  return `You are a dashboard HTML modifier. You make surgical edits to dashboard HTML based on user instructions.

${brandingSection}

## Your Task
Given the current dashboard HTML and a modification instruction, return the specific edits needed.

## Output Format
Return a JSON object with:
1. "edits": Array of {find, replace} pairs. Each "find" must be an EXACT string from the HTML.
2. "summary": Brief description of changes made

## Rules for Edits
- Each "find" string must exist EXACTLY in the HTML (including whitespace)
- Make the minimum changes necessary
- For styling: modify inline styles or add style blocks
- For new elements: find a suitable insertion point (like before a closing tag)
- For removals: replace with empty string
- Keep edits atomic and independent when possible
- MAINTAIN MOBILE RESPONSIVENESS: Ensure any changes preserve mobile-friendly design (responsive layouts, 44px+ touch targets, readable fonts)

## Example Output
{
  "edits": [
    {
      "find": "<h1 class=\"title\">Dashboard</h1>",
      "replace": "<h1 class=\"title\" style=\"color: blue;\">Dashboard</h1>"
    }
  ],
  "summary": "Changed title color to blue"
}

Return ONLY valid JSON, no markdown code blocks.`;
}

function getModifyUserPrompt(
  html: string,
  instruction: string,
  data?: string
): string {
  let prompt = `## Current Dashboard HTML
\`\`\`html
${html}
\`\`\`

## Modification Instruction
${instruction}
`;

  if (data) {
    // Truncate data if too long (keep first 5000 chars for context)
    const truncatedData = data.length > 5000
      ? data.slice(0, 5000) + '\n... (data truncated)'
      : data;

    prompt += `
## Underlying Data (for reference)
\`\`\`
${truncatedData}
\`\`\`
`;
  }

  prompt += `
Return the JSON with edits needed to fulfill this instruction.`;

  return prompt;
}

interface ApplyModificationOptions {
  html: string;
  instruction: string;
  data?: string;
  branding: BrandingConfig | null;
}

async function applyModification(
  options: ApplyModificationOptions
): Promise<{ result: ModifyDirectResult; usage: TokenUsage; costUsd: number; durationMs: number }> {
  const { html, instruction, data, branding } = options;
  const startTime = Date.now();

  const systemPrompt = getModifySystemPrompt(branding);
  const userPrompt = getModifyUserPrompt(html, instruction, data);

  console.log(`[Modify Direct] Calling Sonnet with ${data ? 'data' : 'no data'}...`);
  console.log(`[Modify Direct] HTML length: ${html.length}, instruction length: ${instruction.length}`);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 8000,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userPrompt }
    ],
  });

  const durationMs = Date.now() - startTime;
  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  console.log(`[Modify Direct] Sonnet response in ${durationMs}ms`);
  console.log(`[Modify Direct] Response length: ${text.length}`);

  // Parse the response
  let parsed: { edits?: Edit[]; summary?: string } = {};
  try {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    }
  } catch (parseError) {
    console.error('[Modify Direct] Failed to parse response:', parseError);
    throw new Error('Failed to parse modification response');
  }

  if (!parsed.edits || !Array.isArray(parsed.edits)) {
    console.error('[Modify Direct] Invalid response structure:', text.slice(0, 500));
    throw new Error('Invalid modification response: missing edits array');
  }

  // Apply the edits to get the final HTML
  let modifiedHtml = html;
  const appliedEdits: Edit[] = [];
  const failedEdits: Edit[] = [];

  for (const edit of parsed.edits) {
    if (!edit.find || typeof edit.find !== 'string') {
      console.warn('[Modify Direct] Skipping invalid edit (no find string)');
      continue;
    }

    if (modifiedHtml.includes(edit.find)) {
      modifiedHtml = modifiedHtml.replace(edit.find, edit.replace || '');
      appliedEdits.push(edit);
      console.log(`[Modify Direct] Applied edit: "${edit.find.slice(0, 50)}..." -> "${(edit.replace || '').slice(0, 50)}..."`);
    } else {
      failedEdits.push(edit);
      console.warn(`[Modify Direct] Edit not found in HTML: "${edit.find.slice(0, 100)}..."`);
    }
  }

  if (appliedEdits.length === 0 && parsed.edits.length > 0) {
    console.error('[Modify Direct] No edits could be applied!');
    throw new Error('No edits could be applied - the find strings did not match the HTML');
  }

  if (failedEdits.length > 0) {
    console.warn(`[Modify Direct] ${failedEdits.length} of ${parsed.edits.length} edits failed to apply`);
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
      summary: parsed.summary || 'Dashboard modified',
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
 * Modify a dashboard using the direct (non-agentic) approach.
 *
 * This function:
 * 1. Classifies the instruction to determine if data is needed (Haiku)
 * 2. Calls Sonnet with appropriate context to get surgical edits
 * 3. Applies the edits and returns the modified HTML
 */
export async function modifyDashboardDirect(
  existingHtml: string,
  rawContent: string,
  instructions: string,
  branding: BrandingConfig | null
): Promise<ModifyResultWithUsage> {
  console.log('[Modify Direct] Starting direct modification...');
  console.log('[Modify Direct] Instructions:', instructions);
  console.log('[Modify Direct] HTML length:', existingHtml.length);
  const totalStartTime = Date.now();

  // Step 1: Classify instruction
  const classification = await classifyInstruction(instructions);

  // Step 2: Apply modification with appropriate context
  const { result, usage, costUsd, durationMs } = await applyModification({
    html: existingHtml,
    instruction: instructions,
    data: classification.needsData ? rawContent : undefined,
    branding,
  });

  const totalDurationMs = Date.now() - totalStartTime;
  console.log(`[Modify Direct] Total time: ${totalDurationMs}ms`);
  console.log(`[Modify Direct] Edits applied: ${result.edits.length}`);
  console.log(`[Modify Direct] Cost: $${costUsd.toFixed(4)}`);

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
    usage: agentUsage,
  };
}
