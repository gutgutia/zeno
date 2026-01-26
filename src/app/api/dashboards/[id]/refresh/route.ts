import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getValidAccessToken } from '@/lib/google/auth';
import { fetchSheetData, fetchMultipleSheets, computeContentHash } from '@/lib/google/sheets';
import { getMergedBranding } from '@/types/database';
import type { DashboardConfig } from '@/types/dashboard';
import type { BrandingConfig, Dashboard, Workspace, DataSource } from '@/types/database';
import { createVersion } from '@/lib/versions';
import { computeDataDiff, condenseDiff, type DataDiff } from '@/lib/data/diff';
import { deductCredits, hasEnoughCredits, getCreditBalance } from '@/lib/credits';
import { logUsage, type ModelId } from '@/lib/costs';
import { sendDashboardUpdatedEmail } from '@/lib/email/send';
import { AGENT_CONFIG } from '@/lib/ai/agent';
import { refreshDashboardDirect, needsRegeneration } from '@/lib/ai/refresh-direct';
import { refreshWithClaudeCode } from '@/lib/ai/refresh-with-claude-code';

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

    // Get dashboard with workspace branding and owner info
    const { data: dashboardData, error: dashboardError } = await supabase
      .from('dashboards')
      .select(`
        *,
        workspace:workspaces!inner(owner_id, branding)
      `)
      .eq('id', id)
      .single();

    if (dashboardError || !dashboardData) {
      return NextResponse.json(
        { error: 'Dashboard not found' },
        { status: 404 }
      );
    }

    const dashboard = dashboardData as Dashboard & { workspace: Workspace & { owner_id: string } };

    // SECURITY: Verify the current user owns this dashboard
    if (dashboard.workspace.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Check if user's organization has branding application enabled
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: orgMembership } = await (supabase as any)
      .from('organization_members')
      .select('organization_id, organizations(apply_branding_to_dashboards, branding)')
      .eq('user_id', user.id)
      .not('accepted_at', 'is', null)
      .limit(1)
      .single();

    const applyBranding = orgMembership?.organizations?.apply_branding_to_dashboards ?? true;

    // Check credit balance (estimated 15 credits for refresh)
    const ESTIMATED_REFRESH_CREDITS = 15;
    const hasCredits = await hasEnoughCredits(user.id, ESTIMATED_REFRESH_CREDITS);
    if (!hasCredits) {
      const balance = await getCreditBalance(user.id);
      return NextResponse.json({
        error: 'Insufficient credits',
        credits_required: ESTIMATED_REFRESH_CREDITS,
        credits_available: balance?.balance || 0,
        upgrade_url: '/settings/billing',
      }, { status: 402 });
    }

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

      // Update status to refreshing with timestamp for timeout detection
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('dashboards')
        .update({
          generation_status: 'refreshing',
          generation_started_at: new Date().toISOString(),
          generation_error: null,
        })
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
        .update({
          generation_status: 'refreshing',
          generation_started_at: new Date().toISOString(),
          generation_error: null,
        })
        .eq('id', id);
    }

    try {
      // Get merged branding (only if enabled at org level)
      const branding = applyBranding
        ? getMergedBranding(
            orgMembership?.organizations?.branding || (dashboard.workspace?.branding as BrandingConfig | null),
            dashboard.branding_override as Partial<BrandingConfig> | null
          )
        : null;

      // Get old raw_content for diff computation
      const oldRawContent = dashboard.raw_content || '';

      // Compute diff between old and new data
      console.log('[Refresh] Computing data diff...');
      const diff: DataDiff = computeDataDiff(oldRawContent, newContent);
      console.log('[Refresh] Diff result:', condenseDiff(diff));

      // Early exit if no changes detected (in addition to hash check for Google Sheets)
      if (diff.unchanged) {
        console.log('[Refresh] No data changes detected, skipping AI refresh');

        // Update last_synced_at if Google Sheets
        if (isGoogleSheetSync) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('dashboards')
            .update({
              generation_status: 'completed',
              last_synced_at: new Date().toISOString(),
            })
            .eq('id', id);
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('dashboards')
            .update({ generation_status: 'completed' })
            .eq('id', id);
        }

        return NextResponse.json({
          success: true,
          refreshed: false,
          message: 'No changes detected in the data',
          diff: condenseDiff(diff),
        });
      }

      // Log if domain changed (will trigger regeneration)
      if (diff.domainChanged) {
        console.log('[Refresh] Domain change detected:', diff.domainChangeReason);
        console.log('[Refresh] Will use regeneration approach instead of surgical');
      }

      // Choose refresh approach based on config
      const useDirectApproach = AGENT_CONFIG.useDirectRefresh;
      console.log(`[Refresh] Starting refresh (${useDirectApproach ? 'direct' : 'agent'} approach)...`);

      let refreshResult: {
        html: string;
        summary: string;
        changes?: Array<{ metric: string; old: string; new: string }>;
        warnings?: string[];
        usage: { usage: { inputTokens: number; outputTokens: number }; costUsd: number; durationMs: number; turnCount: number; modelId: string };
      };
      let usedClaudeCodeE2B = false;

      if (useDirectApproach) {
        // Try direct approach first
        const directResult = await refreshDashboardDirect(
          newContent,
          config,
          branding,
          {
            oldRawContent,
            diff,
          }
        );

        // Check if direct approach determined regeneration is needed
        if (needsRegeneration(directResult)) {
          console.log('[Refresh] Direct approach recommends regeneration:', directResult.reason);
          console.log('[Refresh] Falling back to Claude Code E2B for regeneration...');

          // Fall back to Claude Code E2B for regeneration
          const claudeCodeResult = await refreshWithClaudeCode(
            newContent,
            config,
            branding,
            diff
          );
          usedClaudeCodeE2B = true;

          // Convert Claude Code E2B result to expected format
          refreshResult = {
            html: claudeCodeResult.html,
            summary: claudeCodeResult.summary,
            changes: claudeCodeResult.changes,
            usage: {
              usage: { inputTokens: 0, outputTokens: 0 }, // Claude Code tracks internally
              costUsd: 0,
              durationMs: claudeCodeResult.usage.durationMs,
              turnCount: 0,
              modelId: claudeCodeResult.usage.modelId,
            },
          };
        } else {
          // Direct approach succeeded
          refreshResult = directResult;
        }
      } else {
        // Direct approach disabled, use Claude Code E2B directly
        console.log('[Refresh] Using Claude Code E2B approach (direct disabled)...');
        const claudeCodeResult = await refreshWithClaudeCode(
          newContent,
          config,
          branding,
          diff
        );
        usedClaudeCodeE2B = true;

        // Convert Claude Code E2B result to expected format
        refreshResult = {
          html: claudeCodeResult.html,
          summary: claudeCodeResult.summary,
          changes: claudeCodeResult.changes,
          usage: {
            usage: { inputTokens: 0, outputTokens: 0 }, // Claude Code tracks internally
            costUsd: 0,
            durationMs: claudeCodeResult.usage.durationMs,
            turnCount: 0,
            modelId: claudeCodeResult.usage.modelId,
          },
        };
      }

      if (refreshResult.usage.usage.inputTokens > 0) {
        console.log(`[Refresh] Usage: ${refreshResult.usage.usage.inputTokens} input, ${refreshResult.usage.usage.outputTokens} output, cost: $${refreshResult.usage.costUsd.toFixed(4)}`);
      } else {
        console.log(`[Refresh] Duration: ${refreshResult.usage.durationMs}ms (Claude Code E2B - token usage tracked internally)`);
      }

      // Deduct credits based on actual usage
      // For Claude Code E2B, use estimated tokens since usage is tracked internally
      const actualInputTokens = refreshResult.usage.usage.inputTokens || 0;
      const actualOutputTokens = refreshResult.usage.usage.outputTokens || 0;
      const useEstimatedCredits = usedClaudeCodeE2B && actualInputTokens === 0;

      const deductionResult = useEstimatedCredits
        ? await deductCredits(
            user.id,
            60000,  // Estimated input tokens for Claude Code E2B regeneration
            25000,  // Estimated output tokens
            'dashboard_refresh',
            id,
            `Refreshed dashboard with new data (Claude Code E2B regeneration)`,
            supabase
          )
        : await deductCredits(
            user.id,
            actualInputTokens,
            actualOutputTokens,
            'dashboard_refresh',
            id,
            `Refreshed dashboard with new data`,
            supabase
          );

      if (!deductionResult.success) {
        console.warn(`[Refresh] Failed to deduct credits:`, deductionResult.error);
      } else {
        console.log(`[Refresh] Deducted ${deductionResult.credits_used} credits. Remaining: ${deductionResult.balance_after}`);
      }

      // Get user's organization for logging
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: membership } = await (supabase as any)
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .not('accepted_at', 'is', null)
        .limit(1)
        .single();

      // Log usage to ai_usage_logs
      const logModelId = usedClaudeCodeE2B ? 'opus-4-5' : 'sonnet-4-5';
      const logUsageData = refreshResult.usage.usage.inputTokens > 0
        ? refreshResult.usage.usage
        : { inputTokens: 60000, outputTokens: 25000 }; // Estimated for Claude Code E2B

      await logUsage(supabase, {
        dashboardId: id,
        userId: user.id,
        organizationId: membership?.organization_id || null,
        operationType: 'data_refresh',
        modelId: logModelId as ModelId,
        usage: logUsageData,
        agentReportedCost: refreshResult.usage.costUsd || undefined,
        durationMs: refreshResult.usage.durationMs,
        turnCount: refreshResult.usage.turnCount || undefined,
        creditsDeducted: deductionResult.success ? deductionResult.credits_used : 0,
        status: 'success',
        metadata: {
          isGoogleSheetSync,
          claudeCodeE2B: usedClaudeCodeE2B,
        },
      });

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
      const { error: updateError } = await (supabase as any)
        .from('dashboards')
        .update(updateData)
        .eq('id', id);

      if (updateError) {
        console.error('[Refresh] Failed to update dashboard:', updateError);
        throw new Error(`Failed to save refreshed dashboard: ${updateError.message}`);
      }

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

      // Send email notification if user has email
      if (user.email) {
        try {
          await sendDashboardUpdatedEmail({
            to: user.email,
            dashboardTitle: dashboard.title,
            dashboardSlug: dashboard.slug,
            versionLabel: versionInfo?.label,
            summary: refreshResult.summary,
            changesCount: refreshResult.changes?.length,
          });
          console.log('[Refresh] Sent update notification email to', user.email);
        } catch (emailError) {
          console.error('[Refresh] Failed to send email notification:', emailError);
          // Don't fail the request - the refresh was successful
        }
      }

      return NextResponse.json({
        success: true,
        refreshed: true,
        summary: refreshResult.summary,
        changes: refreshResult.changes,
        warnings: refreshResult.warnings,
        version: versionInfo,
        config: updatedConfig,
        // Include diff info for debugging/transparency
        diff: condenseDiff(diff),
        approach: diff.recommendedApproach,
        credits: deductionResult.success ? {
          used: deductionResult.credits_used,
          remaining: deductionResult.balance_after,
        } : undefined,
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
