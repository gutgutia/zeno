import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { Dashboard, BrandingConfig } from '@/types/database';
import { getMergedBranding } from '@/types/database';
import type { DashboardConfig } from '@/types/dashboard';
import { getChatSystemPrompt, getChatUserPrompt } from '@/lib/ai/prompts';
import { sanitizeHTML } from '@/lib/rendering/sanitize';
import { createVersion } from '@/lib/versions';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ChatResponse {
  message: string;
  changeSummary?: string;
  html?: string;
  charts?: Record<string, unknown>;
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
    const { message } = body;

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

    // Get the current config
    const currentConfig = dashboard.config as DashboardConfig | null;

    if (!currentConfig || !currentConfig.html) {
      return NextResponse.json(
        { error: 'Dashboard is not yet generated or has invalid config' },
        { status: 400 }
      );
    }

    // Get merged branding
    const branding = getMergedBranding(
      dashboard.workspaces.branding,
      dashboard.branding_override
    );

    // Build prompts
    const systemPrompt = getChatSystemPrompt(branding);
    const userPrompt = getChatUserPrompt(
      currentConfig.html,
      currentConfig.charts,
      message
    );

    // Call Claude API (using Sonnet for chat - faster response)
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
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
    let aiResponse: ChatResponse;
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

    // If there's updated HTML/charts, update the dashboard config
    if (aiResponse.html || aiResponse.charts) {
      const updatedConfig: DashboardConfig = {
        ...currentConfig,
        html: aiResponse.html ? sanitizeHTML(aiResponse.html) : currentConfig.html,
        charts: aiResponse.charts
          ? (aiResponse.charts as DashboardConfig['charts'])
          : currentConfig.charts,
        metadata: {
          ...currentConfig.metadata,
          // Note that the config was modified via chat
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from('dashboards')
        .update({ config: updatedConfig })
        .eq('id', id);

      if (updateError) {
        console.error('Failed to update dashboard:', updateError);
        return NextResponse.json(
          { error: 'Failed to save changes' },
          { status: 500 }
        );
      }

      // Create a minor version for this AI modification
      try {
        const changeSummary = aiResponse.changeSummary || 'Modified via AI';
        await createVersion(supabase, {
          dashboardId: id,
          changeType: 'ai_modification',
          changeSummary,
          config: updatedConfig,
          rawContent: dashboard.raw_content,
          data: dashboard.data,
          dataSource: dashboard.data_source,
          userId: user.id,
        });
      } catch (versionError) {
        // Log but don't fail the request - the changes were saved
        console.error('Failed to create version:', versionError);
      }

      return NextResponse.json({
        message: aiResponse.message,
        config: updatedConfig,
      });
    }

    // No changes, just a message response
    return NextResponse.json({
      message: aiResponse.message,
    });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process chat message' },
      { status: 500 }
    );
  }
}
