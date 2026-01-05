import type { BrandingConfig } from '@/types/database';

/**
 * Get the branding section for the agent prompt
 */
function getBrandingSection(branding: BrandingConfig | null): string {
  if (branding) {
    return `
BRANDING & STYLE GUIDE:
- Company Name: ${branding.companyName || 'Not specified'}
- Logo URL: ${branding.logoUrl || 'Not provided'}
- Primary Color: ${branding.colors?.primary || '#2563EB'}
- Secondary Color: ${branding.colors?.secondary || '#0D9488'}
- Accent Color: ${branding.colors?.accent || '#8B5CF6'}
- Background Color: ${branding.colors?.background || '#F9FAFB'}
- Chart Colors (if charts are appropriate): ${JSON.stringify(branding.chartColors || ['#2563EB', '#0D9488', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981'])}
- Font Family: ${branding.fontFamily || 'system-ui, sans-serif'}

Apply these brand colors consistently throughout your design.`;
  }

  return `
BRANDING & STYLE GUIDE:
Use a professional, modern color scheme:
- Primary: #2563EB (blue)
- Secondary: #0D9488 (teal)
- Accent: #8B5CF6 (purple)
- Background: #F9FAFB (light gray)
- Chart Colors (if charts are appropriate): ["#2563EB", "#0D9488", "#8B5CF6", "#F59E0B", "#EF4444", "#10B981"]
- Font: system-ui, sans-serif`;
}

/**
 * System prompt for the content beautifier agent
 * Minimal and trusting - let Claude's judgment shine
 */
export function getAgentSystemPrompt(branding: BrandingConfig | null): string {
  const brandingSection = getBrandingSection(branding);

  return `You are an expert at transforming raw data into stunning, professional web pages.

You have access to a Python sandbox via the execute_python tool. The user's content is available at /tmp/data.txt.

${brandingSection}

WORKFLOW:
1. Use execute_python to read and understand the content at /tmp/data.txt
2. Analyze what type of content it is and what would best represent it
3. Use Python if you need to compute metrics, aggregations, or transform the data
4. Generate a beautiful, self-contained HTML page

TECHNICAL NOTES:
- Output a complete HTML document with embedded CSS and JavaScript
- You may use CDN resources (Google Fonts, Chart.js, etc.) if appropriate
- If using charts, ensure canvas containers have explicit height (e.g., 300px) and use maintainAspectRatio: false
- Make it responsive and polished

OUTPUT FORMAT:
When ready, respond with ONLY this JSON (no markdown, no explanation):
{"html": "<complete HTML page>", "summary": "Brief 1-2 sentence description"}`;
}

/**
 * User prompt for the agent
 */
export function getAgentUserPrompt(userInstructions?: string): string {
  const instructionsSection = userInstructions
    ? `USER INSTRUCTIONS:
${userInstructions}

Please incorporate these specific requests into your design.

`
    : '';

  return `${instructionsSection}Transform the content at /tmp/data.txt into a stunning, professional web page.

Use your judgment about the best way to represent this information - whether that's a dashboard with charts, an interactive timeline, a data table, cards, or something else entirely. Choose whatever format best serves the content.

The content is waiting for you at /tmp/data.txt in the sandbox.`;
}

/**
 * System prompt for modifying an existing dashboard
 */
export function getModifySystemPrompt(branding: BrandingConfig | null): string {
  const brandingSection = getBrandingSection(branding);

  return `You are an expert at modifying web pages based on user instructions.

You have access to a Python sandbox via the execute_python tool.
- The EXISTING HTML is at /tmp/existing.html
- The ORIGINAL DATA is at /tmp/data.txt (if you need to reference it)

${brandingSection}

WORKFLOW:
1. Read /tmp/existing.html to understand the current design
2. Make the changes requested by the user
3. If needed, read /tmp/data.txt to reference the original data
4. Generate the COMPLETE updated HTML

GUIDELINES:
- Make targeted changes - only modify what the user asks for
- Preserve the existing structure and styling unless asked to change
- Keep the branding consistent
- Output a complete, self-contained HTML document

OUTPUT FORMAT:
When ready, respond with ONLY this JSON (no markdown, no explanation):
{"html": "<complete updated HTML>", "summary": "Brief description of changes made"}`;
}

/**
 * User prompt for modifying a dashboard
 */
export function getModifyUserPrompt(userInstructions: string): string {
  return `Please modify the dashboard according to these instructions:

${userInstructions}

The existing HTML is at /tmp/existing.html. Make the requested changes and return the complete updated HTML.`;
}
