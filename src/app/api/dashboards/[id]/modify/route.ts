import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { Dashboard, BrandingConfig } from '@/types/database';
import { getMergedBranding } from '@/types/database';
import type { DashboardConfig } from '@/types/dashboard';
import { modifyDashboardWithAgent } from '@/lib/ai/agent';
import { createVersion } from '@/lib/versions';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  console.log('[Modify API] Received modification request');

  try {
    const { id } = await params;
    console.log('[Modify API] Dashboard ID:', id);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { instructions } = body;

    if (!instructions || typeof instructions !== 'string') {
      return NextResponse.json({ error: 'Instructions are required' }, { status: 400 });
    }

    console.log('[Modify API] Instructions:', instructions);

    // Get the dashboard with workspace branding
    const { data: dashboardData, error: fetchError } = await supabase
      .from('dashboards')
      .select('*, workspaces!inner(owner_id, branding)')
      .eq('id', id)
      .single();

    if (fetchError || !dashboardData) {
      console.error('[Modify API] Dashboard not found:', fetchError);
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

    // Get raw content for reference
    const rawContent = dashboard.raw_content || '';

    console.log('[Modify API] Starting agent modification...');

    // Call the modify agent
    const modifyResult = await modifyDashboardWithAgent(
      currentConfig.html,
      rawContent,
      instructions,
      branding
    );

    console.log('[Modify API] Agent modification complete');

    // Build updated config
    const updatedConfig: DashboardConfig = {
      ...currentConfig,
      html: modifyResult.html,
      metadata: {
        ...currentConfig.metadata,
        // Track that this was modified via AI
      },
    };

    // Update the dashboard
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('dashboards')
      .update({ config: updatedConfig })
      .eq('id', id);

    if (updateError) {
      console.error('[Modify API] Failed to update dashboard:', updateError);
      return NextResponse.json(
        { error: 'Failed to save changes' },
        { status: 500 }
      );
    }

    // Create a minor version for this modification
    try {
      await createVersion(supabase, {
        dashboardId: id,
        changeType: 'ai_modification',
        changeSummary: modifyResult.summary || 'Modified via AI',
        config: updatedConfig,
        rawContent: dashboard.raw_content,
        data: dashboard.data,
        dataSource: dashboard.data_source,
        userId: user.id,
      });
      console.log('[Modify API] Version created');
    } catch (versionError) {
      // Log but don't fail - the changes were saved
      console.error('[Modify API] Failed to create version:', versionError);
    }

    console.log('[Modify API] Modification complete');

    return NextResponse.json({
      success: true,
      summary: modifyResult.summary,
      config: updatedConfig,
    });
  } catch (error) {
    console.error('[Modify API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to modify dashboard' },
      { status: 500 }
    );
  }
}
