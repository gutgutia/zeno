import type { BrandingConfig } from '@/types/database';
import type { AnalysisResult } from '@/types/dashboard';

/**
 * System prompt for single-step Opus generation
 * This analyzes data AND generates beautiful HTML in one pass
 */
export function getSingleStepSystemPrompt(branding: BrandingConfig | null): string {
  const brandingSection = branding ? `
BRANDING REQUIREMENTS:
- Company Name: ${branding.companyName || 'Not specified'}
- Logo URL: ${branding.logoUrl || 'Not provided'}
- Primary Color: ${branding.colors?.primary || '#2563EB'}
- Secondary Color: ${branding.colors?.secondary || '#0D9488'}
- Accent Color: ${branding.colors?.accent || '#8B5CF6'}
- Background Color: ${branding.colors?.background || '#F9FAFB'}
- Chart Colors: ${JSON.stringify(branding.chartColors || ['#2563EB', '#0D9488', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981'])}
- Font Family: ${branding.fontFamily || 'system'}

Apply these brand colors consistently throughout the design.
` : `
BRANDING:
Use a professional, modern color scheme:
- Primary: #2563EB (blue)
- Secondary: #0D9488 (teal)
- Accent: #8B5CF6 (purple)
- Background: #F9FAFB (light gray)
- Chart Colors: ["#2563EB", "#0D9488", "#8B5CF6", "#F59E0B", "#EF4444", "#10B981"]
`;

  return `You are an expert data analyst and web designer. Your task is to analyze raw data and create a stunning, professional dashboard as a complete, self-contained HTML page.

${brandingSection}

DESIGN PRINCIPLES:
1. Lead with insights - What's the most important story in this data?
2. Create clear visual hierarchy - important metrics should stand out
3. Use whitespace effectively for readability
4. Include contextual information (percentages, comparisons, trends)
5. Design with modern aesthetics - gradients, shadows, rounded corners
6. Use color purposefully to convey meaning (green=good, red=warning, etc.)

OUTPUT FORMAT:
You must respond with ONLY a valid JSON object:
{
  "html": "Your complete self-contained HTML page",
  "summary": "Brief 1-2 sentence summary of the data"
}

HTML REQUIREMENTS:
Generate a COMPLETE, SELF-CONTAINED HTML page. Everything must be inline - no external dependencies.

1. STRUCTURE:
   - Use semantic HTML5 (header, main, section, article)
   - Include all styles inline using the style attribute
   - Use modern CSS (flexbox, grid, gradients, shadows)

2. VISUALIZATIONS - Generate these directly as inline SVG or HTML:
   - PIE/DONUT CHARTS: Use inline SVG with <circle> elements and stroke-dasharray for segments
   - BAR CHARTS: Use inline SVG with <rect> elements or pure CSS with div bars
   - METRICS CARDS: Use styled divs with large numbers and context
   - TABLES: Use HTML <table> with proper styling
   - PROGRESS BARS: Use CSS with colored div widths

3. EXAMPLE PIE CHART (inline SVG):
   <svg viewBox="0 0 100 100" style="width: 200px; height: 200px;">
     <circle cx="50" cy="50" r="40" fill="none" stroke="#2563EB" stroke-width="20"
             stroke-dasharray="125.6 251.2" transform="rotate(-90 50 50)"/>
     <circle cx="50" cy="50" r="40" fill="none" stroke="#0D9488" stroke-width="20"
             stroke-dasharray="62.8 251.2" stroke-dashoffset="-125.6" transform="rotate(-90 50 50)"/>
   </svg>

4. EXAMPLE BAR CHART (CSS):
   <div style="display: flex; align-items: end; gap: 8px; height: 150px;">
     <div style="width: 40px; height: 80%; background: linear-gradient(to top, #2563EB, #3B82F6); border-radius: 4px 4px 0 0;"></div>
     <div style="width: 40px; height: 60%; background: linear-gradient(to top, #0D9488, #14B8A6); border-radius: 4px 4px 0 0;"></div>
   </div>

5. DESIGN ELEMENTS TO INCLUDE:
   - Gradient header/hero section
   - Stat cards with large numbers, labels, and context (e.g., "↑ 12% from last month")
   - Colored status indicators (dots, badges)
   - Insight callout boxes with background colors
   - Clean data tables with alternating row colors
   - Visual charts using SVG or CSS

IMPORTANT:
- DO NOT use any external libraries or placeholder elements
- Generate ALL visualizations inline as SVG or CSS
- Make it look like a professional executive dashboard
- Include actual data values from the input, not placeholder text
- Calculate percentages, totals, and other derived metrics
- The HTML should render beautifully with zero JavaScript`;
}

/**
 * User prompt for single-step generation with raw data
 */
export function getSingleStepUserPrompt(rawContent: string, userInstructions?: string): string {
  const instructionsSection = userInstructions
    ? `USER INSTRUCTIONS:
${userInstructions}

Please incorporate these specific requests into your design.

`
    : '';

  return `${instructionsSection}Analyze the following data and create a beautiful, insightful dashboard:

---BEGIN DATA---
${rawContent}
---END DATA---

Steps to follow:
1. First, understand the data structure (columns, types, relationships)
2. Calculate key metrics: totals, averages, distributions, percentages
3. Identify the most important insights and story in the data
4. Design a stunning dashboard with clear visual hierarchy
5. Generate all charts as inline SVG or CSS (no placeholders!)

Create a dashboard that would impress an executive. Focus on insights, not just displaying raw data.

Respond with ONLY a JSON object: {"html": "...", "summary": "..."}`;
}

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
 * System prompt for Opus generation step
 * This generates the beautiful HTML page with chart placeholders
 */
export function getGenerationSystemPrompt(branding: BrandingConfig | null): string {
  const brandingSection = branding ? `
BRANDING REQUIREMENTS:
- Company Name: ${branding.companyName || 'Not specified'}
- Logo URL: ${branding.logoUrl || 'Not provided'}
- Primary Color: ${branding.colors?.primary || '#2563EB'}
- Secondary Color: ${branding.colors?.secondary || '#0D9488'}
- Accent Color: ${branding.colors?.accent || '#8B5CF6'}
- Background Color: ${branding.colors?.background || '#F9FAFB'}
- Chart Colors: ${JSON.stringify(branding.chartColors || ['#2563EB', '#0D9488', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981'])}
- Font Family: ${branding.fontFamily || 'system'}
- Style Guide: ${branding.styleGuide || 'Professional and clean'}

Apply these brand colors consistently throughout the design. Use the primary color for headers and key elements. Use chart colors for data visualizations.
` : `
BRANDING:
Use a professional, modern color scheme:
- Primary: #2563EB (blue)
- Secondary: #0D9488 (teal)
- Accent: #8B5CF6 (purple)
- Background: #F9FAFB (light gray)
- Chart Colors: ["#2563EB", "#0D9488", "#8B5CF6", "#F59E0B", "#EF4444", "#10B981"]
`;

  return `You are an expert web designer and data visualization specialist. Your task is to create a beautiful, impactful web page that presents content effectively.

${brandingSection}

DESIGN PRINCIPLES:
1. Create clear visual hierarchy - important information should stand out
2. Use whitespace effectively for readability
3. Ensure the design is responsive (works on mobile and desktop)
4. Lead with insights and key takeaways
5. Use appropriate visualizations for the data type
6. Keep it clean and uncluttered
7. Make it impactful - this should impress and inform

OUTPUT FORMAT:
You must respond with ONLY a valid JSON object containing:
{
  "html": "Your complete HTML with inline styles",
  "charts": {
    "chart-id-1": { chart configuration },
    "chart-id-2": { chart configuration }
  }
}

HTML GUIDELINES:
- Use semantic HTML (header, section, article, etc.)
- Apply styles inline using the style attribute
- Use modern CSS (flexbox, grid, etc.)
- Include the company logo if provided: <img src="LOGO_URL" alt="Logo" />
- For charts, use placeholder divs: <div data-chart="chart-id" data-title="Chart Title"></div>
- Make the page self-contained - all styles should be inline

CHART CONFIGURATIONS:
For each chart placeholder, provide a configuration object:

number_card:
{
  "type": "number_card",
  "title": "Metric Name",
  "config": {
    "column": "column_name",
    "aggregation": "sum" | "avg" | "min" | "max" | "count" | "countDistinct" | "latest",
    "format": "number" | "currency" | "percent" | "compact",
    "prefix": "$",
    "suffix": "%"
  }
}

bar:
{
  "type": "bar",
  "title": "Chart Title",
  "config": {
    "xAxis": { "column": "category_column" },
    "yAxis": { "column": "value_column", "aggregation": "sum", "format": "number" },
    "orientation": "vertical" | "horizontal",
    "colors": ["#2563EB", "#0D9488"],
    "sortBy": "value",
    "sortOrder": "desc",
    "limit": 10
  }
}

pie:
{
  "type": "pie",
  "title": "Chart Title",
  "config": {
    "groupBy": "category_column",
    "value": { "column": "value_column", "aggregation": "count" },
    "colors": ["#2563EB", "#0D9488", "#8B5CF6"],
    "donut": true,
    "showPercent": true
  }
}

line:
{
  "type": "line",
  "title": "Chart Title",
  "config": {
    "xAxis": { "column": "date_column", "type": "time" },
    "yAxis": { "column": "value_column", "aggregation": "sum" },
    "colors": ["#2563EB"],
    "smooth": true
  }
}

area:
{
  "type": "area",
  "title": "Chart Title",
  "config": {
    "xAxis": { "column": "date_column", "type": "time" },
    "yAxis": { "column": "value_column", "aggregation": "sum" },
    "stacked": true,
    "colors": ["#2563EB", "#0D9488"]
  }
}

table:
{
  "type": "table",
  "title": "Data Table",
  "config": {
    "columns": [
      { "column": "col1", "label": "Column 1", "format": "number" }
    ],
    "pageSize": 10
  }
}

IMPORTANT:
- Create a complete, beautiful page - not just charts
- Include headers, sections, and context
- Add insights as callout boxes or highlighted text
- Use the brand colors throughout
- Make it visually impressive and professional`;
}

/**
 * Build the user prompt for generation with analysis results and instructions
 */
export function getGenerationUserPrompt(
  analysis: AnalysisResult,
  userInstructions?: string
): string {
  const instructionsSection = userInstructions
    ? `USER INSTRUCTIONS:
${userInstructions}

Please incorporate these specific requests into your design.

`
    : '';

  return `${instructionsSection}Create a beautiful, impactful web page based on this content analysis:

CONTENT SUMMARY:
${analysis.summary}

CONTENT TYPE: ${analysis.contentType}

${analysis.schema ? `
DATA SCHEMA:
- Total Rows: ${analysis.schema.rowCount || 0}
- Columns: ${analysis.schema.columns?.map(c => `${c.name} (${c.type}, ${c.role})`).join(', ') || 'None detected'}

COLUMN DETAILS:
${analysis.schema.columns?.map(col => {
  let details = `- ${col.name} (${col.type}, ${col.role})`;
  if (col.stats) {
    details += `\n  Stats: min=${col.stats.min}, max=${col.stats.max}, avg=${col.stats.avg?.toFixed(2) ?? 'N/A'}, sum=${col.stats.sum}`;
  }
  if (col.distribution && Object.keys(col.distribution).length > 0 && Object.keys(col.distribution).length <= 20) {
    details += `\n  Distribution: ${Object.entries(col.distribution).map(([k, v]) => `${k}(${v})`).join(', ')}`;
  } else if (col.distribution && Object.keys(col.distribution).length > 20) {
    details += `\n  Unique values: ${col.uniqueCount}`;
  }
  return details;
}).join('\n') || 'No column details available'}

RELATIONSHIPS:
${analysis.schema.relationships?.join('\n') || 'None identified'}
` : ''}

${analysis.structure ? `
DOCUMENT STRUCTURE:
- Title: ${analysis.structure.title || 'Untitled'}
- Sections: ${analysis.structure.sections?.join(', ') || 'None'}
- Key Points: ${analysis.structure.keyPoints?.join('; ') || 'None'}
` : ''}

INSIGHTS:
${analysis.insights?.map((insight, i) => `${i + 1}. ${insight}`).join('\n') || 'No insights generated'}

SUGGESTED VISUALIZATIONS:
${analysis.suggestedVisualizations?.map((viz, i) => `${i + 1}. ${viz}`).join('\n') || 'No specific visualizations suggested'}

${analysis.cleanedData ? `
SAMPLE DATA (first 5 rows):
${JSON.stringify(analysis.cleanedData.slice(0, 5), null, 2)}
` : ''}

Create a stunning, professional page that presents this content effectively. Include:
1. A compelling header/hero section
2. Key metrics highlighted prominently
3. Appropriate visualizations (use data-chart placeholders)
4. Insights displayed as callouts or highlights
5. Clean, organized layout with good visual hierarchy

Respond with ONLY the JSON containing "html" and "charts".`;
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
  "html": "Updated complete HTML",
  "charts": { updated chart configurations }
}

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
