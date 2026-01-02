import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getValidAccessToken } from '@/lib/google/auth';
import { fetchSheetData, fetchMultipleSheets, computeContentHash } from '@/lib/google/sheets';
import { refreshDashboardWithAgent } from '@/lib/ai/agent';
import { getMergedBranding } from '@/types/database';
import type { DashboardConfig } from '@/types/dashboard';
import type { BrandingConfig, Dashboard, Workspace } from '@/types/database';

export const maxDuration = 300; // 5 minutes for agent refresh

// POST /api/dashboards/[id]/refresh - Refresh a Google Sheets dashboard with new data
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get dashboard with workspace branding
    const { data: dashboardData, error: dashboardError } = await supabase
      .from('dashboards')
      .select(`
        *,
        workspace:workspaces(*)
      `)
      .eq('id', id)
      .single();

    if (dashboardError || !dashboardData) {
      return NextResponse.json(
        { error: 'Dashboard not found' },
        { status: 404 }
      );
    }

    const dashboard = dashboardData as Dashboard & { workspace: Workspace };

    // Verify it's a Google Sheets dashboard
    if (!dashboard.google_connection_id || !dashboard.google_sheet_id) {
      return NextResponse.json(
        { error: 'Dashboard is not connected to Google Sheets' },
        { status: 400 }
      );
    }

    // Verify dashboard has been generated (has config)
    if (!dashboard.config) {
      return NextResponse.json(
        { error: 'Dashboard has not been generated yet' },
        { status: 400 }
      );
    }

    const config = dashboard.config as DashboardConfig;

    // Update status to refreshing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('dashboards')
      .update({ generation_status: 'refreshing' })
      .eq('id', id);

    try {
      // Get valid access token
      const accessToken = await getValidAccessToken(dashboard.google_connection_id);

      // Fetch latest data from Google Sheets
      let newContent: string;
      const selectedSheets = dashboard.data_source?.selectedSheets;

      if (selectedSheets && selectedSheets.length > 1) {
        const result = await fetchMultipleSheets(
          accessToken,
          dashboard.google_sheet_id,
          selectedSheets
        );
        newContent = result.data;
      } else {
        const result = await fetchSheetData(
          accessToken,
          dashboard.google_sheet_id,
          dashboard.google_sheet_name || undefined
        );
        newContent = result.data;
      }

      // Check if content actually changed
      const newHash = computeContentHash(newContent);
      const oldHash = dashboard.content_hash;

      if (newHash === oldHash) {
        // No changes, just update last_synced_at
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('dashboards')
          .update({
            generation_status: 'completed',
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', id);

        return NextResponse.json({
          success: true,
          refreshed: false,
          message: 'No changes detected in the data',
        });
      }

      // Get merged branding
      const branding = getMergedBranding(
        dashboard.workspace?.branding as BrandingConfig | null,
        dashboard.branding_override as Partial<BrandingConfig> | null
      );

      // Refresh using Agent SDK
      const refreshResult = await refreshDashboardWithAgent(
        newContent,
        config,
        branding
      );

      // Update dashboard with new HTML
      const updatedConfig: DashboardConfig = {
        ...config,
        html: refreshResult.html,
        metadata: {
          ...config.metadata,
          lastRefreshedAt: new Date().toISOString(),
          refreshSummary: refreshResult.summary,
        },
        analysis: {
          ...config.analysis,
          contentType: config.analysis?.contentType || 'data',
          summary: refreshResult.summary,
          insights: config.analysis?.insights || [],
          suggestedVisualizations: config.analysis?.suggestedVisualizations || [],
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('dashboards')
        .update({
          config: updatedConfig,
          raw_content: newContent,
          content_hash: newHash,
          last_synced_at: new Date().toISOString(),
          generation_status: 'completed',
        })
        .eq('id', id);

      return NextResponse.json({
        success: true,
        refreshed: true,
        summary: refreshResult.summary,
        changes: refreshResult.changes,
        warnings: refreshResult.warnings,
      });
    } catch (error) {
      // Update status to failed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('dashboards')
        .update({
          generation_status: 'failed',
          generation_error: error instanceof Error ? error.message : 'Refresh failed',
        })
        .eq('id', id);

      throw error;
    }
  } catch (error) {
    console.error('Error refreshing dashboard:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to refresh dashboard' },
      { status: 500 }
    );
  }
}
