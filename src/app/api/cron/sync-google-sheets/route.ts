import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getValidAccessToken } from '@/lib/google/auth';
import { fetchSheetData, fetchMultipleSheets, computeContentHash } from '@/lib/google/sheets';
import { getMergedBranding } from '@/types/database';
import type { DashboardConfig } from '@/types/dashboard';
import type { BrandingConfig, Dashboard, Workspace } from '@/types/database';
import { computeDataDiff } from '@/lib/data/diff';
import { refreshDashboardDirect, needsRegeneration } from '@/lib/ai/refresh-direct';
import { refreshWithClaudeCode } from '@/lib/ai/refresh-with-claude-code';
import { sendDashboardUpdatedEmail } from '@/lib/email/send';
import { createVersion, getCurrentVersion } from '@/lib/versions';

export const maxDuration = 300; // 5 minutes for batch processing

interface SyncResult {
  id: string;
  title: string;
  status: 'refreshed' | 'unchanged' | 'error' | 'skipped';
  message?: string;
}

// Type for dashboard with workspace relation
type DashboardWithWorkspace = Dashboard & { workspace: Workspace | null };

// Get user email by ID
async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data } = await serviceClient.auth.admin.getUserById(userId);
    return data.user?.email || null;
  } catch {
    return null;
  }
}

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

    // Use service client to bypass RLS - cron jobs don't have user sessions
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
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
        // Pass supabase client to bypass RLS
        let accessToken: string;
        try {
          accessToken = await getValidAccessToken(dashboard.google_connection_id!, supabase);
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

        // Skip dashboards without generated HTML
        if (!config?.html) {
          console.log(`[Sync] Skipping ${dashboard.id} - no HTML in config`);
          results.push({
            id: dashboard.id,
            title: dashboard.title,
            status: 'skipped',
            message: 'Dashboard has no generated HTML',
          });
          continue;
        }

        const branding = getMergedBranding(
          dashboard.workspace?.branding as BrandingConfig | null,
          dashboard.branding_override as Partial<BrandingConfig> | null
        );

        try {
          // Compute diff
          const oldRawContent = dashboard.raw_content || '';
          const diff = computeDataDiff(oldRawContent, newContent);

          // Try direct approach first
          let refreshResult: { html: string; summary: string };
          const directResult = await refreshDashboardDirect(
            newContent,
            config,
            branding,
            { oldRawContent, diff }
          );

          if (needsRegeneration(directResult)) {
            console.log(`[Sync] Direct approach recommends regeneration for ${dashboard.id}, using Claude Code E2B...`);
            const claudeCodeResult = await refreshWithClaudeCode(
              newContent,
              config,
              branding,
              diff
            );
            refreshResult = { html: claudeCodeResult.html, summary: claudeCodeResult.summary };
          } else {
            refreshResult = directResult;
          }

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

          // Create version history
          let versionLabel = '';
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const version = await createVersion(supabase as any, {
              dashboardId: dashboard.id,
              changeType: 'data_refresh',
              changeSummary: refreshResult.summary,
              config: updatedConfig,
              rawContent: newContent,
            });
            versionLabel = `${version.major_version}.${version.minor_version}`;
            console.log(`[Sync] Created version ${versionLabel} for dashboard ${dashboard.id}`);
          } catch (versionError) {
            console.error(`[Sync] Failed to create version for ${dashboard.id}:`, versionError);
            // Don't fail the sync if version creation fails
          }

          // Send email notification to the dashboard owner
          try {
            const userEmail = await getUserEmail(dashboard.owner_id);
            if (userEmail) {
              await sendDashboardUpdatedEmail({
                to: userEmail,
                dashboardTitle: dashboard.title,
                dashboardSlug: dashboard.slug,
                versionLabel: versionLabel || undefined,
                summary: refreshResult.summary,
              });
              console.log(`[Sync] Email notification sent to ${userEmail} for dashboard ${dashboard.id}`);
            }
          } catch (emailError) {
            console.error(`[Sync] Failed to send email notification for ${dashboard.id}:`, emailError);
            // Don't fail the sync if email fails
          }

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
