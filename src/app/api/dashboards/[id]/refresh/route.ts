import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getValidAccessToken } from '@/lib/google/auth';
import { fetchSheetData, fetchMultipleSheets, computeContentHash } from '@/lib/google/sheets';
import { refreshDashboardWithAgent } from '@/lib/ai/agent';
import { getMergedBranding } from '@/types/database';
import type { DashboardConfig } from '@/types/dashboard';
import type { BrandingConfig, Dashboard, Workspace, DataSource } from '@/types/database';
import { createVersion } from '@/lib/versions';

export const maxDuration = 300; // 5 minutes for agent refresh

// POST /api/dashboards/[id]/refresh - Refresh a dashboard with new data
// Supports both Google Sheets sync and manual data updates (paste/upload)
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

    // Parse request body for manual data updates
    const body = await request.json().catch(() => ({}));
    const { rawContent, data, dataSource: newDataSource, syncFromSheet } = body as {
      rawContent?: string;
      data?: Record<string, unknown>[];
      dataSource?: DataSource;
      syncFromSheet?: boolean;
    };

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

    // Verify dashboard has been generated (has config)
    if (!dashboard.config) {
      return NextResponse.json(
        { error: 'Dashboard has not been generated yet' },
        { status: 400 }
      );
    }

    const config = dashboard.config as DashboardConfig;

    // Determine the data source and content
    let newContent: string;
    let finalDataSource: DataSource = dashboard.data_source;
    let newData: Record<string, unknown>[] | null = null;
    let isGoogleSheetSync = false;

    // Case 1: Google Sheets sync
    if (syncFromSheet && dashboard.google_connection_id && dashboard.google_sheet_id) {
      isGoogleSheetSync = true;

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
      } catch (error) {
        // Update status to failed
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('dashboards')
          .update({
            generation_status: 'failed',
            generation_error: error instanceof Error ? error.message : 'Sync failed',
          })
          .eq('id', id);

        throw error;
      }
    }
    // Case 2: Manual data update (paste/upload)
    else if (rawContent) {
      newContent = rawContent;
      if (newDataSource) {
        finalDataSource = newDataSource;
      }
      if (data) {
        newData = data;
      }
    }
    // Case 3: Data array provided
    else if (data) {
      newContent = JSON.stringify(data, null, 2);
      newData = data;
      if (newDataSource) {
        finalDataSource = newDataSource;
      }
    }
    // No data provided
    else {
      return NextResponse.json(
        { error: 'No data provided. Use syncFromSheet for Google Sheets, or provide rawContent/data.' },
        { status: 400 }
      );
    }

    // Update status to refreshing if not already done (for non-Google Sheets)
    if (!isGoogleSheetSync) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('dashboards')
        .update({ generation_status: 'refreshing' })
        .eq('id', id);
    }

    try {
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

      // Build update object
      const updateData: Record<string, unknown> = {
        config: updatedConfig,
        raw_content: newContent,
        data_source: finalDataSource,
        generation_status: 'completed',
      };

      if (newData) {
        updateData.data = newData;
      }

      if (isGoogleSheetSync) {
        updateData.content_hash = computeContentHash(newContent);
        updateData.last_synced_at = new Date().toISOString();
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('dashboards')
        .update(updateData)
        .eq('id', id);

      // Create a major version for this data refresh
      let versionInfo = null;
      try {
        // Build a change summary from the refresh result
        let changeSummary = isGoogleSheetSync ? 'Synced from Google Sheets' : 'Updated with new data';
        if (refreshResult.changes && refreshResult.changes.length > 0) {
          const changeDescriptions = refreshResult.changes
            .slice(0, 3)
            .map((c: { metric: string; old: string; new: string }) =>
              `${c.metric}: ${c.old} → ${c.new}`
            )
            .join(', ');
          changeSummary = `Data refresh: ${changeDescriptions}`;
          if (refreshResult.changes.length > 3) {
            changeSummary += ` (+${refreshResult.changes.length - 3} more)`;
          }
        }

        const version = await createVersion(supabase, {
          dashboardId: id,
          changeType: 'data_refresh',
          changeSummary,
          config: updatedConfig,
          rawContent: newContent,
          data: newData || dashboard.data,
          dataSource: finalDataSource,
          userId: user.id,
        });

        versionInfo = {
          major: version.major_version,
          minor: version.minor_version,
          label: `${version.major_version}.${version.minor_version}`,
        };
      } catch (versionError) {
        console.error('[Refresh] Failed to create version:', versionError);
        // Don't fail the request - the refresh was successful
      }

      return NextResponse.json({
        success: true,
        refreshed: true,
        summary: refreshResult.summary,
        changes: refreshResult.changes,
        warnings: refreshResult.warnings,
        version: versionInfo,
        config: updatedConfig,
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
