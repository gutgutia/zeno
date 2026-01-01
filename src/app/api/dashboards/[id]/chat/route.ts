import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { Dashboard, BrandingConfig } from '@/types/database';
import type { DashboardConfig } from '@/types/dashboard';
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
${branding.chartColors?.length ? `- Chart color palette: ${JSON.stringify(branding.chartColors)}` : ''}
${branding.styleGuide ? `- Style guidance: "${branding.styleGuide}"` : ''}

When modifying charts, use the brand colors and follow the style guidance.
` : '';

  return `You are an AI assistant helping users modify their data dashboards. You receive user requests and the current dashboard configuration, and you modify the configuration based on the request.
${brandingContext}
You must respond with a JSON object containing:
1. "message": A natural language response to the user explaining what you did
2. "config": The updated dashboard configuration (only if changes were made, omit if just answering a question)

The dashboard config structure:
{
  "title": "Dashboard title",
  "description": "Description",
  "charts": [
    // Array of chart configs
  ]
}

Chart types and their configs:

number_card (for key metrics/KPIs):
{
  "id": "unique-id",
  "type": "number_card",
  "title": "Chart Title",
  "config": {
    "column": "column_name",
    "aggregation": "sum" | "avg" | "min" | "max" | "count" | "countDistinct" | "latest",
    "format": "number" | "currency" | "percent" | "compact",
    "prefix": "$" | null,
    "suffix": "%" | null
  }
}

line (for trends):
{
  "id": "unique-id",
  "type": "line",
  "title": "Chart Title",
  "config": {
    "xAxis": { "column": "date_column", "type": "time" | "category" },
    "yAxis": { "column": "value_column", "aggregation": "sum" | "avg", "format": "number" },
    "splitBy": "category_column" | null,
    "colors": ["#hex1", "#hex2"],
    "smooth": true | false
  }
}

bar (for comparisons):
{
  "id": "unique-id",
  "type": "bar",
  "title": "Chart Title",
  "config": {
    "xAxis": { "column": "category_column" },
    "yAxis": { "column": "value_column", "aggregation": "sum" | "avg", "format": "number" },
    "orientation": "vertical" | "horizontal",
    "splitBy": "category_column" | null,
    "colors": ["#hex1", "#hex2"],
    "stacked": false,
    "sortBy": "value" | "label",
    "sortOrder": "desc" | "asc",
    "limit": 10
  }
}

area (for stacked trends):
{
  "id": "unique-id",
  "type": "area",
  "title": "Chart Title",
  "config": {
    "xAxis": { "column": "date_column", "type": "time" | "category" },
    "yAxis": { "column": "value_column", "aggregation": "sum", "format": "number" },
    "splitBy": "category_column" | null,
    "colors": ["#hex1", "#hex2"],
    "stacked": true | false,
    "smooth": true
  }
}

pie (for proportions):
{
  "id": "unique-id",
  "type": "pie",
  "title": "Chart Title",
  "config": {
    "groupBy": "category_column",
    "value": { "column": "value_column", "aggregation": "sum" },
    "colors": ["#hex1", "#hex2"],
    "donut": true | false,
    "showPercent": true,
    "limit": 8
  }
}

table (for detailed data):
{
  "id": "unique-id",
  "type": "table",
  "title": "Chart Title",
  "config": {
    "columns": [
      { "column": "col_name", "label": "Display Label", "format": "number" | "currency" | "date" }
    ],
    "pageSize": 10
  }
}

Guidelines:
- Always preserve existing chart IDs when modifying charts
- Generate new unique IDs (format: "chart-{timestamp}") for new charts
- When removing charts, simply remove them from the array
- When asked to change a chart type, create a new config appropriate for the new type
- Be helpful and explain your changes clearly
- If the request is unclear, ask clarifying questions in your message
- Only modify the parts that need changing
${branding?.chartColors?.length ? '- Use the brand chart colors when adding or modifying visualizations' : ''}
${branding?.styleGuide ? '- Follow the brand style guidance for chart titles and descriptions' : ''}

Respond with ONLY valid JSON, no markdown or explanation outside the JSON.`;
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
    const { message, config } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
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

    // Get available columns from data
    const dashboardDataRows = dashboard.data as Record<string, unknown>[] | null;
    const availableColumns = dashboardDataRows && dashboardDataRows.length > 0
      ? Object.keys(dashboardDataRows[0])
      : [];

    // Use brand chart colors or defaults
    const chartColors = effectiveBranding?.chartColors?.length
      ? effectiveBranding.chartColors
      : CHART_COLORS;

    // Build the user prompt
    const userPrompt = `User request: "${message}"

Available data columns: ${availableColumns.join(', ')}
Chart color palette: ${JSON.stringify(chartColors)}

Current dashboard configuration:
${JSON.stringify(config || dashboard.config, null, 2)}

Please modify the dashboard based on the user's request.`;

    // Build system prompt with branding context
    const systemPrompt = buildSystemPrompt(effectiveBranding);

    // Call Claude API
    const response = await anthropic.messages.create({
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
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Parse the JSON response
    let aiResponse: { message: string; config?: DashboardConfig };
    try {
      aiResponse = JSON.parse(textContent.text);
    } catch {
      // Try to extract JSON from the response
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse AI response as JSON');
      }
    }

    // If there's a new config, update the dashboard
    if (aiResponse.config) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from('dashboards')
        .update({ config: aiResponse.config })
        .eq('id', id);

      if (updateError) {
        console.error('Failed to update dashboard:', updateError);
      }
    }

    return NextResponse.json({
      message: aiResponse.message,
      config: aiResponse.config,
    });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process chat message' },
      { status: 500 }
    );
  }
}
