import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { BrandingConfig } from '@/types/database';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Use Sonnet 4.5 for reliable extraction
const EXTRACTION_MODEL = 'claude-sonnet-4-5';

interface ExtractedBranding extends BrandingConfig {
  suggestedChartColors?: string[];
}

interface ExtractionResult {
  success: boolean;
  branding?: ExtractedBranding;
  error?: string;
}

const EXTRACTION_SYSTEM_PROMPT = `You are a brand identity expert that analyzes websites to extract brand colors, fonts, and visual identity elements.

Your task is to analyze the provided website HTML/CSS and extract:
1. Primary brand color (the main color used for CTAs, links, brand elements)
2. Secondary color (supporting color, often used in headers or accents)
3. Accent color (highlight color for special elements)
4. Background color (main page background)
5. Font family (primary font used for headings/body)
6. Company name (from title, logo alt text, or meta tags)
7. Logo URL (from og:image, favicon, or common logo paths)
8. A brief style guide describing the brand's visual identity

Also generate a harmonious chart color palette (6-8 colors) that complements the brand colors.

IMPORTANT: Return ONLY valid JSON, no other text. Use this exact structure:
{
  "companyName": "string or null",
  "logoUrl": "string or null",
  "colors": {
    "primary": "#hexcode",
    "secondary": "#hexcode",
    "accent": "#hexcode",
    "background": "#hexcode"
  },
  "fontFamily": "system" | "inter" | "dm-sans" | "space-grotesk",
  "styleGuide": "Brief description of the brand's visual style and tone",
  "suggestedChartColors": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5", "#hex6"]
}

Guidelines:
- For fontFamily, map detected fonts to closest match: Sans-serif → "inter", Display/Modern → "space-grotesk", Geometric → "dm-sans", else "system"
- If you can't detect a color, make an educated guess based on the overall design
- For logoUrl, look for: og:image meta tag, link[rel="icon"], common paths like /logo.png, /images/logo.svg
- Chart colors should be visually distinct but harmonious with the brand
- The style guide should be 2-3 sentences describing the visual tone (e.g., "Modern and clean with bold accents. Professional yet approachable.")`;

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
    const branding: ExtractedBranding = {
      companyName: extracted.companyName || undefined,
      logoUrl: extracted.logoUrl || undefined,
      colors: {
        primary: extracted.colors?.primary || '#6366f1',
        secondary: extracted.colors?.secondary || '#64748b',
        accent: extracted.colors?.accent || '#22c55e',
        background: extracted.colors?.background || '#f8fafc',
      },
      fontFamily: ['system', 'inter', 'dm-sans', 'space-grotesk'].includes(extracted.fontFamily || '')
        ? extracted.fontFamily as BrandingConfig['fontFamily']
        : 'system',
      styleGuide: extracted.styleGuide || undefined,
      chartColors: extracted.suggestedChartColors || [
        extracted.colors?.primary || '#6366f1',
        extracted.colors?.secondary || '#64748b',
        extracted.colors?.accent || '#22c55e',
        '#f59e0b',
        '#ef4444',
        '#8b5cf6',
      ],
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
