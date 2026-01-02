import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { generateWithAgent } from '@/lib/ai/agent';
import type { Dashboard, BrandingConfig } from '@/types/database';

// Allow long-running requests for agent loops
export const maxDuration = 300; // 5 minutes

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    // Check if already generating or completed
    if (dashboard.generation_status === 'generating' || dashboard.generation_status === 'analyzing') {
      return NextResponse.json({
        message: 'Generation already in progress',
        status: dashboard.generation_status
      });
    }

    // Get raw content - either from raw_content field or reconstruct from data
    let rawContent = dashboard.raw_content;
    if (!rawContent && dashboard.data) {
      // Reconstruct from data array
      const data = dashboard.data as Record<string, unknown>[];
      if (data.length > 0) {
        const columns = Object.keys(data[0]);
        rawContent = columns.join('\t') + '\n' +
          data.map(row => columns.map(col => String(row[col] ?? '')).join('\t')).join('\n');
      }
    }

    if (!rawContent) {
      return NextResponse.json({ error: 'No content to generate from' }, { status: 400 });
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

    // Update status to generating
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('dashboards')
      .update({
        generation_status: 'generating',
        generation_started_at: new Date().toISOString(),
        generation_error: null,
      })
      .eq('id', id);

    try {
      // Agentic generation with E2B Python sandbox
      console.log(`[${id}] Starting agentic generation with E2B sandbox...`);
      const config = await generateWithAgent(
        rawContent,
        effectiveBranding,
        dashboard.user_instructions || undefined
      );
      console.log(`[${id}] Generation complete. HTML length: ${config.html?.length || 0}`);

      // Update the dashboard with the generated config
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: updatedDashboard, error: updateError } = await (supabase as any)
        .from('dashboards')
        .update({
          config,
          description: config.analysis?.summary || null,
          generation_status: 'completed',
          generation_completed_at: new Date().toISOString(),
          generation_error: null,
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to save dashboard: ${updateError.message}`);
      }

      // Send email notification if requested
      if (dashboard.notify_email) {
        try {
          await sendDashboardReadyEmail(user.email!, dashboard.title, id);
        } catch (emailError) {
          console.error('Failed to send email notification:', emailError);
          // Don't fail the generation if email fails
        }
      }

      return NextResponse.json({
        dashboard: updatedDashboard as Dashboard,
        generated: true,
      });

    } catch (generationError) {
      console.error(`[${id}] Generation failed:`, generationError);

      // Update status to failed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('dashboards')
        .update({
          generation_status: 'failed',
          generation_error: generationError instanceof Error ? generationError.message : 'Unknown error',
        })
        .eq('id', id);

      throw generationError;
    }

  } catch (error) {
    console.error('Error generating dashboard:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate dashboard' },
      { status: 500 }
    );
  }
}

/**
 * Send email notification when dashboard is ready
 */
async function sendDashboardReadyEmail(email: string, title: string, dashboardId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const dashboardUrl = `${baseUrl}/dashboards/${dashboardId}`;

  // Use our email API endpoint
  await fetch(`${baseUrl}/api/email/dashboard-ready`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, title, dashboardUrl }),
  });
}
