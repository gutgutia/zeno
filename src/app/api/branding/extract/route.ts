import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { BrandingConfig } from '@/types/database';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Use Sonnet 4.5 for reliable extraction
const EXTRACTION_MODEL = 'claude-sonnet-4-5';

// ExtractedBranding is just BrandingConfig - we extract colors and generate a style guide
type ExtractedBranding = BrandingConfig;

interface ExtractionResult {
  success: boolean;
  branding?: ExtractedBranding;
  error?: string;
}

const EXTRACTION_SYSTEM_PROMPT = `You are a brand identity expert that analyzes websites to extract brand colors and visual identity.

Your task is to analyze the provided website HTML/CSS and extract:
1. Primary brand color (the main color used for logo, brand identity, key elements)
2. Secondary color (supporting color, often used in headers or text accents)
3. Accent color (highlight color for special elements, badges, notifications)
4. Button color (color used for primary CTA buttons - may match primary or be different)
5. Font family (the primary font used on the website)
6. Company name (from title, logo alt text, or meta tags)

IMPORTANT: Return ONLY valid JSON, no other text. Use this exact structure:
{
  "companyName": "string or null",
  "colors": {
    "primary": "#hexcode",
    "secondary": "#hexcode",
    "accent": "#hexcode",
    "button": "#hexcode"
  },
  "fontFamily": "system" | "inter" | "dm-sans" | "space-grotesk"
}

Guidelines:
- Extract the TRUE brand colors - the colors that define this company's identity
- Primary should be the most distinctive brand color (often in logo, brand marks)
- Secondary should be a supporting color that complements the primary
- Accent is for highlights, often a contrasting or vibrant color
- Button color is what's used for primary CTAs - may be same as primary or accent
- For fontFamily, map detected fonts to closest match:
  - Sans-serif fonts (Helvetica, Arial, etc.) → "system"
  - Inter, similar geometric sans → "inter"
  - DM Sans, similar friendly sans → "dm-sans"
  - Space Grotesk, monospace-influenced, tech fonts → "space-grotesk"
  - If unsure, use "system"
- If you can't detect a color, make an educated guess based on the overall design
- Avoid extracting generic grays as primary/secondary - find the actual brand colors`;

/**
 * Generate a default style guide for brand colors.
 * This guide is color-agnostic - it describes HOW to use the colors,
 * not what the colors are. Users can customize this later.
 */
function generateDefaultStyleGuide(): string {
  return `Create a visually impressive dashboard that makes an impact. Use a bold header section with a solid primary color background and white text - this is the hero of the dashboard. Below the header, use white cards with subtle shadows, colored left borders, or accent elements. Key metrics should be large and colorful. Use the primary color prominently for headers, important values, and visual accents. The secondary color works well for supporting elements. Charts should use brand colors. Never use gradients - solid colors only.`;
}

async function fetchWebsiteContent(url: string): Promise<string> {
  // Normalize URL
  let normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  const response = await fetch(normalizedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ZenoBrandExtractor/1.0)',
      'Accept': 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(15000), // 15 second timeout
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch website: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();

  // Truncate if too long (keep head and first part of body for CSS/meta info)
  if (html.length > 100000) {
    // Extract head section completely
    const headMatch = html.match(/<head[^>]*>[\s\S]*?<\/head>/i);
    const head = headMatch ? headMatch[0] : '';

    // Get first part of body
    const bodyStart = html.indexOf('<body');
    const bodyContent = bodyStart > -1 ? html.slice(bodyStart, bodyStart + 50000) : '';

    return head + bodyContent;
  }

  return html;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Fetch website content
    let websiteContent: string;
    try {
      websiteContent = await fetchWebsiteContent(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch website';
      return NextResponse.json({
        success: false,
        error: `Could not access website: ${message}`
      } as ExtractionResult);
    }

    // Call Claude to extract brand elements
    const message = await anthropic.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: 4096,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Analyze this website and extract the brand identity:\n\nURL: ${url}\n\nHTML Content:\n${websiteContent}`,
        },
      ],
    });

    // Extract text content
    const textContent = message.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json({
        success: false,
        error: 'No response from AI'
      } as ExtractionResult);
    }

    // Parse JSON response
    let extracted: ExtractedBranding;
    try {
      extracted = JSON.parse(textContent.text);
    } catch {
      // Try to extract JSON from response
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[0]);
      } else {
        console.error('Failed to parse extraction response:', textContent.text);
        return NextResponse.json({
          success: false,
          error: 'Failed to parse brand extraction results'
        } as ExtractionResult);
      }
    }

    // Validate and normalize the response
    const primaryColor = extracted.colors?.primary || '#6366f1';
    const secondaryColor = extracted.colors?.secondary || '#64748b';
    const accentColor = extracted.colors?.accent || '#22c55e';
    const buttonColor = extracted.colors?.button || primaryColor;

    // Validate fontFamily is one of our supported options
    const validFonts = ['system', 'inter', 'dm-sans', 'space-grotesk'];
    const fontFamily = validFonts.includes(extracted.fontFamily || '')
      ? (extracted.fontFamily as BrandingConfig['fontFamily'])
      : 'system';

    const branding: ExtractedBranding = {
      companyName: extracted.companyName || undefined,
      colors: {
        primary: primaryColor,
        secondary: secondaryColor,
        accent: accentColor,
        button: buttonColor,
      },
      fontFamily,
      styleGuide: generateDefaultStyleGuide(),
    };

    return NextResponse.json({
      success: true,
      branding
    } as ExtractionResult);

  } catch (error) {
    console.error('Brand extraction error:', error);
    return NextResponse.json({
      success: false,
      error: 'An unexpected error occurred'
    } as ExtractionResult, { status: 500 });
  }
}
