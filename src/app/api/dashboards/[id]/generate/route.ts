import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { Dashboard, BrandingConfig } from '@/types/database';
import { createVersion } from '@/lib/versions';
import { getCreditBalance, deductCredits, hasEnoughCredits } from '@/lib/credits';
import { logUsage } from '@/lib/costs';

// Lazy load the agent to prevent startup issues
const getAgent = async () => {
  console.log('[Generate] Lazy loading agent module...');
  const { generateWithAgent } = await import('@/lib/ai/agent');
  console.log('[Generate] Agent module loaded successfully');
  return generateWithAgent;
};

// Allow long-running requests for agent loops
export const maxDuration = 300; // 5 minutes

// Estimated credits for dashboard generation (based on typical token usage)
// Simple: ~9 credits, Medium: ~25 credits, Complex: ~50 credits
// We use the medium estimate as default
const ESTIMATED_GENERATION_CREDITS = 25;

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;

  try {
    // Check for internal service call (from dashboard creation)
    const internalUserId = request.headers.get('x-internal-user-id');
    const internalSecret = request.headers.get('x-internal-secret');
    const expectedSecret = process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-20); // Use last 20 chars as internal secret
    
    let userId: string;
    let userEmail: string | undefined;
    
    if (internalUserId && internalSecret === expectedSecret) {
      // Internal service call - trust the provided user ID
      console.log(`[${id}] Internal service call for user ${internalUserId}`);
      userId = internalUserId;
      
      // Get user email from database for notifications
      const serviceClient = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const { data: userData } = await serviceClient.auth.admin.getUserById(internalUserId);
      userEmail = userData.user?.email || undefined;
    } else {
      // Normal user request - require authentication
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      userId = user.id;
      userEmail = user.email;
    }
    
    // Create service client for all database operations (bypasses RLS)
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check credit balance before generation (pass service client for internal calls)
    const hasCredits = await hasEnoughCredits(userId, ESTIMATED_GENERATION_CREDITS, supabase);
    if (!hasCredits) {
      const balance = await getCreditBalance(userId, supabase);
      return NextResponse.json({
        error: 'Insufficient credits',
        credits_required: ESTIMATED_GENERATION_CREDITS,
        credits_available: balance?.balance || 0,
        upgrade_url: '/settings/billing',
      }, { status: 402 }); // 402 Payment Required
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
    if (dashboard.workspaces.owner_id !== userId) {
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
      console.log(`[${id}] About to load agent module...`);
      const generateWithAgent = await getAgent();
      console.log(`[${id}] Agent module loaded, calling generateWithAgent...`);
      const result = await generateWithAgent(
        rawContent,
        effectiveBranding,
        dashboard.user_instructions || undefined
      );
      const config = result.config;
      const agentUsage = result.usage;
      console.log(`[${id}] Generation complete. HTML length: ${config.html?.length || 0}`);
      console.log(`[${id}] Usage: ${agentUsage.usage.inputTokens} input, ${agentUsage.usage.outputTokens} output, cost: $${agentUsage.costUsd.toFixed(4)}`);

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

      // Use actual token counts from agent for credit deduction
      const actualInputTokens = agentUsage.usage.inputTokens || 0;
      const actualOutputTokens = agentUsage.usage.outputTokens || 0;

      // Deduct credits for successful generation
      const deductionResult = await deductCredits(
        userId,
        actualInputTokens,
        actualOutputTokens,
        'dashboard_create',
        id,
        `Generated dashboard: ${dashboard.title}`,
        supabase
      );

      if (!deductionResult.success) {
        console.warn(`[${id}] Failed to deduct credits:`, deductionResult.error);
        // Don't fail the generation if credit deduction fails
      } else {
        console.log(`[${id}] Deducted ${deductionResult.credits_used} credits. Remaining: ${deductionResult.balance_after}`);
      }

      // Get user's organization for logging
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: membership } = await (supabase as any)
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', userId)
        .not('accepted_at', 'is', null)
        .limit(1)
        .single();

      // Log usage to ai_usage_logs
      await logUsage(supabase, {
        dashboardId: id,
        userId,
        organizationId: membership?.organization_id || null,
        operationType: 'generation',
        modelId: 'opus-4-5',
        usage: agentUsage.usage,
        agentReportedCost: agentUsage.costUsd,
        durationMs: agentUsage.durationMs,
        turnCount: agentUsage.turnCount,
        creditsDeducted: deductionResult.success ? deductionResult.credits_used : 0,
        status: 'success',
        metadata: {
          userInstructions: dashboard.user_instructions,
          extendedThinking: true,
        },
      });

      // Create initial version (1.0)
      try {
        await createVersion(supabase, {
          dashboardId: id,
          changeType: 'initial',
          changeSummary: 'Initial dashboard generation',
          config,
          rawContent: dashboard.raw_content,
          data: dashboard.data,
          dataSource: dashboard.data_source,
          userId: userId,
        });
      } catch (versionError) {
        console.error(`[${id}] Failed to create initial version:`, versionError);
        // Don't fail the generation if version creation fails
      }

      // Send email notification if requested
      if (dashboard.notify_email && userEmail) {
        try {
          await sendDashboardReadyEmail(userEmail, dashboard.title, id);
        } catch (emailError) {
          console.error('Failed to send email notification:', emailError);
          // Don't fail the generation if email fails
        }
      }

      return NextResponse.json({
        dashboard: updatedDashboard as Dashboard,
        generated: true,
        credits: deductionResult.success ? {
          used: deductionResult.credits_used,
          remaining: deductionResult.balance_after,
        } : undefined,
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
