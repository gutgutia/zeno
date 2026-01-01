import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { Dashboard, BrandingConfig } from '@/types/database';
import type { DashboardConfig } from '@/types/dashboard';
import type { DataSchema } from '@/types/dashboard';
import { CHART_COLORS } from '@/types/chart';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function buildSystemPrompt(branding: BrandingConfig | null): string {
  const brandingContext = branding ? `
BRAND CONTEXT:
${branding.companyName ? `- Company: ${branding.companyName}` : ''}
${branding.colors?.primary ? `- Primary brand color: ${branding.colors.primary}` : ''}
${branding.colors?.secondary ? `- Secondary color: ${branding.colors.secondary}` : ''}
${branding.colors?.accent ? `- Accent color: ${branding.colors.accent}` : ''}
${branding.chartColors?.length ? `- Chart color palette: ${JSON.stringify(branding.chartColors)}` : ''}
${branding.styleGuide ? `- Style guidance: "${branding.styleGuide}"` : ''}

Apply these brand settings when generating chart configurations. Use the provided colors in the charts array.
` : '';

  return `You are a data visualization expert. Your task is to analyze a data schema and generate an optimal dashboard configuration with multiple visualizations.
${brandingContext}
You must respond with ONLY a valid JSON object (no markdown, no explanation) with this structure:
{
  "title": "Dashboard title based on the data",
  "description": "Brief description of what the dashboard shows",
  "charts": [
    // Array of chart configurations
  ]
}

Each chart in the "charts" array must have:
- "id": A unique string ID (use format "chart-1", "chart-2", etc.)
- "type": One of: "number_card", "line", "bar", "area", "pie", "table"
- "title": Descriptive title for the chart
- "description": Optional brief description
- "config": Type-specific configuration (see below)

Chart type configs:

number_card (for key metrics/KPIs):
{
  "column": "column_name",
  "aggregation": "sum" | "avg" | "min" | "max" | "count" | "countDistinct" | "latest",
  "format": "number" | "currency" | "percent" | "compact",
  "prefix": "$" | null,
  "suffix": "%" | null
}

line/area (for trends over time):
{
  "xAxis": { "column": "date_column", "type": "time" | "category" },
  "yAxis": { "column": "value_column", "aggregation": "sum" | "avg", "format": "number" },
  "splitBy": "optional_category_column" | null,
  "colors": ["#hex1", "#hex2"],  // Use brand colors if provided
  "smooth": true | false
}

bar (for comparisons):
{
  "xAxis": { "column": "category_column" },
  "yAxis": { "column": "value_column", "aggregation": "sum" | "avg", "format": "number" },
  "orientation": "vertical" | "horizontal",
  "splitBy": "optional_category_column" | null,
  "colors": ["#hex1", "#hex2"],  // Use brand colors if provided
  "stacked": false,
  "sortBy": "value" | "label",
  "sortOrder": "desc" | "asc",
  "limit": 10
}

pie (for proportions):
{
  "groupBy": "category_column",
  "value": { "column": "value_column", "aggregation": "sum" },
  "colors": ["#hex1", "#hex2"],  // Use brand colors if provided
  "donut": true | false,
  "showPercent": true,
  "limit": 8
}

table (for detailed data):
{
  "columns": [
    { "column": "col_name", "label": "Display Label", "format": "number" | "currency" | "date" }
  ],
  "pageSize": 10
}

Guidelines:
1. Start with 2-4 number_card charts for key metrics (totals, averages, counts)
2. Include 2-3 visualization charts (line/bar/area/pie) that show relationships and trends
3. Optionally include a table for detailed data view
4. Choose chart types that best fit the data types:
   - Date columns → line/area charts for trends
   - Categorical columns with few unique values → bar/pie charts
   - Numeric columns → aggregations in number_cards
5. Keep it focused: 4-8 charts total is ideal
6. Use clear, descriptive titles${branding?.styleGuide ? ' that match the brand style guidance' : ''}
7. ${branding?.chartColors?.length ? 'Use the provided brand chart colors in all visualizations' : 'Use appropriate colors for the visualizations'}`;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const schema: DataSchema = body.schema;

    if (!schema) {
      return NextResponse.json({ error: 'Schema is required' }, { status: 400 });
    }

    // Get the dashboard with workspace branding
    const { data: dashboardData, error: fetchError } = await supabase
      .from('dashboards')
      .select('*, workspaces!inner(owner_id, branding)')
      .eq('id', id)
      .single();

    if (fetchError || !dashboardData) {
      return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 });
    }

    const dashboard = dashboardData as Dashboard & {
      workspaces: { owner_id: string; branding: BrandingConfig | null }
    };

    // Check ownership
    if (dashboard.workspaces.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Merge workspace branding with any dashboard override
    const workspaceBranding = dashboard.workspaces.branding;
    const dashboardOverride = dashboard.branding_override;

    // Simple merge - dashboard override takes precedence
    const effectiveBranding: BrandingConfig | null = workspaceBranding || dashboardOverride ? {
      companyName: dashboardOverride?.companyName ?? workspaceBranding?.companyName,
      logoUrl: dashboardOverride?.logoUrl ?? workspaceBranding?.logoUrl,
      colors: {
        primary: dashboardOverride?.colors?.primary ?? workspaceBranding?.colors?.primary,
        secondary: dashboardOverride?.colors?.secondary ?? workspaceBranding?.colors?.secondary,
        accent: dashboardOverride?.colors?.accent ?? workspaceBranding?.colors?.accent,
        background: dashboardOverride?.colors?.background ?? workspaceBranding?.colors?.background,
      },
      chartColors: dashboardOverride?.chartColors ?? workspaceBranding?.chartColors,
      fontFamily: dashboardOverride?.fontFamily ?? workspaceBranding?.fontFamily,
      styleGuide: dashboardOverride?.styleGuide ?? workspaceBranding?.styleGuide,
    } : null;

    // Use brand chart colors or defaults
    const chartColors = effectiveBranding?.chartColors?.length
      ? effectiveBranding.chartColors
      : CHART_COLORS;

    // Prepare the prompt for Claude
    const userPrompt = `Analyze this data schema and generate an optimal dashboard configuration:

Data Schema:
- Total rows: ${schema.rowCount}
- Columns: ${schema.columns.length}

Column Details:
${schema.columns.map(col => {
  let details = `- "${col.name}" (${col.type})`;
  if (col.stats) {
    details += ` [min: ${col.stats.min}, max: ${col.stats.max}, avg: ${col.stats.avg?.toFixed(2)}]`;
  }
  if (col.uniqueValues) {
    details += ` [categories: ${col.uniqueValues.slice(0, 5).join(', ')}${col.uniqueValues.length > 5 ? '...' : ''}]`;
  }
  if (col.sampleValues.length > 0) {
    details += ` [samples: ${col.sampleValues.slice(0, 3).map(v => JSON.stringify(v)).join(', ')}]`;
  }
  return details;
}).join('\n')}

Sample Data:
${JSON.stringify(schema.sampleRows.slice(0, 3), null, 2)}

Chart color palette to use: ${JSON.stringify(chartColors)}

Generate a dashboard config that provides meaningful insights from this data.`;

    // Build system prompt with branding context
    const systemPrompt = buildSystemPrompt(effectiveBranding);

    // Call Claude API
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      system: systemPrompt,
    });

    // Extract the text content
    const textContent = message.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Parse the JSON response
    let generatedConfig: DashboardConfig;
    try {
      generatedConfig = JSON.parse(textContent.text);
    } catch {
      // Try to extract JSON from the response
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        generatedConfig = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse AI response as JSON');
      }
    }

    // Validate and ensure required fields
    if (!generatedConfig.charts || !Array.isArray(generatedConfig.charts)) {
      generatedConfig.charts = [];
    }

    // Update the dashboard with the generated config
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updatedDashboard, error: updateError } = await (supabase as any)
      .from('dashboards')
      .update({
        config: generatedConfig,
        title: generatedConfig.title || dashboard.title,
        description: generatedConfig.description || null,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      dashboard: updatedDashboard as Dashboard,
      generated: true,
    });
  } catch (error) {
    console.error('Error generating dashboard:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate dashboard' },
      { status: 500 }
    );
  }
}
