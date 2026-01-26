import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export const maxDuration = 60; // 1 minute max

const STALE_THRESHOLD_MINUTES = 10; // Consider operations stale after 10 minutes

/**
 * GET /api/cron/cleanup-stale-statuses
 *
 * Cleans up dashboards stuck in 'generating' or 'refreshing' status.
 * This happens when Vercel times out (hard 5-minute limit) and no cleanup runs.
 *
 * Should be run every 5-10 minutes via Vercel cron or external scheduler.
 */
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

    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Find dashboards stuck in 'generating' or 'refreshing' status
    // where generation_started_at is older than threshold
    const thresholdTime = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000).toISOString();

    // Get stale generating dashboards
    const { data: staleGenerating, error: genError } = await supabase
      .from('dashboards')
      .select('id, title, generation_status, generation_started_at')
      .in('generation_status', ['generating', 'analyzing', 'pending'])
      .not('generation_started_at', 'is', null)
      .lt('generation_started_at', thresholdTime);

    if (genError) {
      console.error('[Cleanup] Error querying stale generating dashboards:', genError);
    }

    // Get stale refreshing dashboards
    const { data: staleRefreshing, error: refError } = await supabase
      .from('dashboards')
      .select('id, title, generation_status, generation_started_at')
      .eq('generation_status', 'refreshing')
      .not('generation_started_at', 'is', null)
      .lt('generation_started_at', thresholdTime);

    if (refError) {
      console.error('[Cleanup] Error querying stale refreshing dashboards:', refError);
    }

    const staleDashboards = [
      ...(staleGenerating || []),
      ...(staleRefreshing || []),
    ];

    if (staleDashboards.length === 0) {
      return NextResponse.json({
        message: 'No stale dashboards found',
        cleaned: 0,
      });
    }

    console.log(`[Cleanup] Found ${staleDashboards.length} stale dashboards`);

    // Update each stale dashboard to failed status
    const results: Array<{ id: string; title: string; status: 'cleaned' | 'error'; message?: string }> = [];

    for (const dashboard of staleDashboards) {
      try {
        const previousStatus = dashboard.generation_status;
        const startedAt = dashboard.generation_started_at;
        const elapsedMinutes = startedAt
          ? Math.round((Date.now() - new Date(startedAt).getTime()) / 60000)
          : 'unknown';

        const errorMessage = previousStatus === 'refreshing'
          ? `Data refresh timed out after ${elapsedMinutes} minutes. The operation may have exceeded server limits.`
          : `Dashboard generation timed out after ${elapsedMinutes} minutes. The operation may have exceeded server limits.`;

        const { error: updateError } = await supabase
          .from('dashboards')
          .update({
            generation_status: 'failed',
            generation_error: errorMessage,
          })
          .eq('id', dashboard.id);

        if (updateError) {
          console.error(`[Cleanup] Failed to update dashboard ${dashboard.id}:`, updateError);
          results.push({
            id: dashboard.id,
            title: dashboard.title,
            status: 'error',
            message: updateError.message,
          });
        } else {
          console.log(`[Cleanup] Cleaned up stale dashboard: ${dashboard.id} (${dashboard.title}) - was ${previousStatus} for ${elapsedMinutes} minutes`);
          results.push({
            id: dashboard.id,
            title: dashboard.title,
            status: 'cleaned',
            message: `Was ${previousStatus} for ${elapsedMinutes} minutes`,
          });
        }
      } catch (err) {
        console.error(`[Cleanup] Error processing dashboard ${dashboard.id}:`, err);
        results.push({
          id: dashboard.id,
          title: dashboard.title,
          status: 'error',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    const cleaned = results.filter(r => r.status === 'cleaned').length;
    const errors = results.filter(r => r.status === 'error').length;

    console.log(`[Cleanup] Complete. Cleaned: ${cleaned}, Errors: ${errors}`);

    return NextResponse.json({
      message: 'Cleanup complete',
      cleaned,
      errors,
      results,
    });
  } catch (error) {
    console.error('[Cleanup] Fatal error:', error);
    return NextResponse.json(
      { error: 'Cleanup job failed' },
      { status: 500 }
    );
  }
}
