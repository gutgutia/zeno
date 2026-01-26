import type { BrandingConfig } from '@/types/database';

/**
 * Get the branding section for the agent prompt
 */
function getBrandingSection(branding: BrandingConfig | null): string {
  if (branding) {
    return `
BRANDING & STYLE GUIDE:
- Company Name: ${branding.companyName || 'Not specified'}
- Primary Color: ${branding.colors?.primary || '#2563EB'}
- Secondary Color: ${branding.colors?.secondary || '#64748b'}
- Accent Color: ${branding.colors?.accent || '#8B5CF6'}
- Button Color: ${branding.colors?.button || branding.colors?.primary || '#2563EB'}
- Font Family: ${branding.fontFamily || 'system-ui, sans-serif'}

Create visual impact: Use a bold header with the primary color as a solid background and white text. Cards should have subtle shadows or colored left borders. Key metrics should be large and colorful. Never use gradients - solid colors only.`;
  }

  return `
BRANDING & STYLE GUIDE:
Use a professional, modern color scheme:
- Primary: #2563EB (blue)
- Secondary: #64748b (slate)
- Accent: #8B5CF6 (purple)
- Button: #2563EB (blue)
- Font: system-ui, sans-serif

Create visual impact: Use a bold header with the primary color as a solid background and white text. Cards should have subtle shadows or colored left borders. Key metrics should be large and colorful. Never use gradients - solid colors only.`;
}

/**
 * System prompt for the content beautifier agent
 * Minimal and trusting - let Claude's judgment shine
 */
export function getAgentSystemPrompt(branding: BrandingConfig | null): string {
  const brandingSection = getBrandingSection(branding);

  return `You are an expert at transforming raw data into stunning, professional web pages.

You have access to a sandbox with various tools. Use whatever approach works best for the data.

${brandingSection}

OUTPUT FORMAT:
When done, write the final HTML to /home/user/output.html, then respond with ONLY this JSON:
{"summary": "Brief 1-2 sentence description of what you created"}`;
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

  return `${instructionsSection}Transform the data into a stunning, professional dashboard.

Use your judgment about the best way to represent this information - whether that's a dashboard with charts, an interactive timeline, a data table, cards, or something else entirely. Choose whatever format best serves the content.`;
}

/**
 * System prompt for modifying an existing dashboard
 */
export function getModifySystemPrompt(branding: BrandingConfig | null): string {
  const brandingSection = getBrandingSection(branding);

  return `You are an expert at making surgical modifications to web pages.

You have access to these tools:
- read_lines: Read specific lines from a file (use for targeted reading)
- edit_file: Make surgical text replacements (PREFERRED for changes)
- get_file: Get complete file contents (use ONLY to retrieve final result)
- execute_python: Run Python code if you need to compute something

FILES:
- /tmp/existing.html - The HTML to modify
- /tmp/data.txt - Original data (if you need to reference it)

${brandingSection}

EFFICIENT WORKFLOW (IMPORTANT - minimize token usage):
1. Use read_lines to preview relevant sections of /tmp/existing.html
   - Start with lines 1-50 to see structure
   - Then target specific sections you need to modify
2. Use edit_file to make surgical changes (NOT rewriting entire file)
   - Each edit_file call replaces a specific string with a new one
   - The old_string must be unique in the file
   - Include enough context to make it unique
3. After ALL edits are done, use get_file to retrieve the final HTML
4. Return the result

EXAMPLE EDIT:
If you need to change a title from "Dashboard" to "Sales Report":
edit_file(
  file_path="/tmp/existing.html",
  old_string="<h1 class=\"title\">Dashboard</h1>",
  new_string="<h1 class=\"title\">Sales Report</h1>"
)

GUIDELINES:
- Make targeted changes - only modify what the user asks for
- Use edit_file for changes, NOT Python string manipulation
- DO NOT read or output entire files unless absolutely necessary
- Preserve existing structure and styling unless asked to change
- Keep branding consistent

OUTPUT FORMAT:
When done, respond with ONLY this JSON (no markdown, no explanation):
{"html": "<complete updated HTML from get_file>", "summary": "Brief description of changes made"}`;
}

/**
 * User prompt for modifying a dashboard
 */
export function getModifyUserPrompt(userInstructions: string): string {
  return `Please modify the dashboard according to these instructions:

${userInstructions}

STEPS:
1. Use read_lines to preview /tmp/existing.html (start with first 50 lines)
2. Find the sections that need changes
3. Use edit_file for each change (surgical replacements)
4. After all edits, use get_file to retrieve the complete HTML
5. Return the JSON with html and summary`;
}
