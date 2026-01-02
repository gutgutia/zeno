import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getValidAccessToken } from '@/lib/google/auth';
import { fetchSheetData, fetchMultipleSheets, computeContentHash } from '@/lib/google/sheets';
import { refreshDashboardWithAgent } from '@/lib/ai/agent';
import { getMergedBranding } from '@/types/database';
import type { DashboardConfig } from '@/types/dashboard';
import type { BrandingConfig, Dashboard, Workspace } from '@/types/database';

export const maxDuration = 300; // 5 minutes for batch processing

interface SyncResult {
  id: string;
  title: string;
  status: 'refreshed' | 'unchanged' | 'error' | 'skipped';
  message?: string;
}

// Type for dashboard with workspace relation
type DashboardWithWorkspace = Dashboard & { workspace: Workspace | null };

// GET /api/cron/sync-google-sheets - Daily sync job for Google Sheets dashboards
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (for security)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createClient();
    const results: SyncResult[] = [];

    // Get dashboards that need syncing
    // - sync_enabled = true
    // - has Google connection
    // - last_synced_at is more than 23 hours ago (to allow for some variance)
    const twentyThreeHoursAgo = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();

    const { data: dashboardsData, error: queryError } = await supabase
      .from('dashboards')
      .select(`
        *,
        workspace:workspaces(*)
      `)
      .eq('sync_enabled', true)
      .not('google_connection_id', 'is', null)
      .not('google_sheet_id', 'is', null)
      .not('config', 'is', null)
      .or(`last_synced_at.is.null,last_synced_at.lt.${twentyThreeHoursAgo}`)
      .limit(10); // Process up to 10 at a time to avoid timeout

    const dashboards = dashboardsData as DashboardWithWorkspace[] | null;

    if (queryError) {
      console.error('[Sync] Query error:', queryError);
      return NextResponse.json(
        { error: 'Failed to query dashboards' },
        { status: 500 }
      );
    }

    if (!dashboards || dashboards.length === 0) {
      return NextResponse.json({
        message: 'No dashboards need syncing',
        synced: 0,
        results: [],
      });
    }

    console.log(`[Sync] Found ${dashboards.length} dashboards to sync`);

    // Process each dashboard
    for (const dashboard of dashboards) {
      try {
        console.log(`[Sync] Processing dashboard: ${dashboard.id} - ${dashboard.title}`);

        // Get valid access token (google_connection_id is non-null from query filter)
        let accessToken: string;
        try {
          accessToken = await getValidAccessToken(dashboard.google_connection_id!);
        } catch (tokenError) {
          console.error(`[Sync] Token error for ${dashboard.id}:`, tokenError);
          results.push({
            id: dashboard.id,
            title: dashboard.title,
            status: 'error',
            message: 'Failed to get Google access token',
          });
          continue;
        }

        // Fetch latest data
        let newContent: string;
        const selectedSheets = dashboard.data_source?.selectedSheets;

        try {
          // google_sheet_id is non-null from query filter
          if (selectedSheets && selectedSheets.length > 1) {
            const result = await fetchMultipleSheets(
              accessToken,
              dashboard.google_sheet_id!,
              selectedSheets
            );
            newContent = result.data;
          } else {
            const result = await fetchSheetData(
              accessToken,
              dashboard.google_sheet_id!,
              dashboard.google_sheet_name || undefined
            );
            newContent = result.data;
          }
        } catch (fetchError) {
          console.error(`[Sync] Fetch error for ${dashboard.id}:`, fetchError);
          results.push({
            id: dashboard.id,
            title: dashboard.title,
            status: 'error',
            message: 'Failed to fetch Google Sheet data',
          });
          continue;
        }

        // Check if content changed
        const newHash = computeContentHash(newContent);
        const oldHash = dashboard.content_hash;

        if (newHash === oldHash) {
          // No changes, just update last_synced_at
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('dashboards')
            .update({ last_synced_at: new Date().toISOString() })
            .eq('id', dashboard.id);

          results.push({
            id: dashboard.id,
            title: dashboard.title,
            status: 'unchanged',
            message: 'No changes detected',
          });
          continue;
        }

        // Content changed - refresh the dashboard
        console.log(`[Sync] Changes detected for ${dashboard.id}, refreshing...`);

        const config = dashboard.config as DashboardConfig;
        const branding = getMergedBranding(
          dashboard.workspace?.branding as BrandingConfig | null,
          dashboard.branding_override as Partial<BrandingConfig> | null
        );

        try {
          const refreshResult = await refreshDashboardWithAgent(
            newContent,
            config,
            branding
          );

          // Update dashboard
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
            .eq('id', dashboard.id);

          results.push({
            id: dashboard.id,
            title: dashboard.title,
            status: 'refreshed',
            message: refreshResult.summary,
          });
        } catch (refreshError) {
          console.error(`[Sync] Refresh error for ${dashboard.id}:`, refreshError);
          results.push({
            id: dashboard.id,
            title: dashboard.title,
            status: 'error',
            message: refreshError instanceof Error ? refreshError.message : 'Refresh failed',
          });
        }
      } catch (error) {
        console.error(`[Sync] Error processing ${dashboard.id}:`, error);
        results.push({
          id: dashboard.id,
          title: dashboard.title,
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const refreshed = results.filter(r => r.status === 'refreshed').length;
    const unchanged = results.filter(r => r.status === 'unchanged').length;
    const errors = results.filter(r => r.status === 'error').length;

    console.log(`[Sync] Complete. Refreshed: ${refreshed}, Unchanged: ${unchanged}, Errors: ${errors}`);

    return NextResponse.json({
      message: 'Sync complete',
      synced: results.length,
      refreshed,
      unchanged,
      errors,
      results,
    });
  } catch (error) {
    console.error('[Sync] Fatal error:', error);
    return NextResponse.json(
      { error: 'Sync job failed' },
      { status: 500 }
    );
  }
}
