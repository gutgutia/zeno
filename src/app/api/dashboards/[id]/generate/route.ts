import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { Dashboard, BrandingConfig } from '@/types/database';
import { createVersion } from '@/lib/versions';
import { getCreditBalance, deductCredits, hasEnoughCredits } from '@/lib/credits';
import { logUsage, type ModelId, type TokenUsage } from '@/lib/costs';
import type { DashboardConfig } from '@/types/dashboard';

// Unified result type for both generation approaches
interface GenerationResult {
  config: DashboardConfig;
  usage: {
    durationMs: number;
    modelId: string;
    // Optional fields (MCP approach has these, Claude Code E2B doesn't)
    usage?: TokenUsage;
    costUsd?: number;
    turnCount?: number;
  };
}

// Lazy load the agent to prevent startup issues
const getAgent = async (): Promise<{
  generator: (rawContent: string, branding: BrandingConfig | null, userInstructions?: string) => Promise<GenerationResult>;
  isClaudeCodeE2B: boolean;
}> => {
  console.log('[Generate] Lazy loading agent module...');
  const { generateWithAgent, AGENT_CONFIG, generateWithClaudeCode, isClaudeCodeE2BAvailable } = await import('@/lib/ai/agent');
  console.log('[Generate] Agent module loaded successfully');

  // Debug: Log configuration
  console.log('[Generate] AGENT_CONFIG.useClaudeCodeE2B:', AGENT_CONFIG.useClaudeCodeE2B);
  const e2bAvailable = isClaudeCodeE2BAvailable();
  console.log('[Generate] isClaudeCodeE2BAvailable():', e2bAvailable);

  // Check if we should use the new Claude Code E2B approach
  if (AGENT_CONFIG.useClaudeCodeE2B && e2bAvailable) {
    console.log('[Generate] ✅ Using Claude Code E2B approach (full Claude Code capabilities)');
    return { generator: generateWithClaudeCode as (rawContent: string, branding: BrandingConfig | null, userInstructions?: string) => Promise<GenerationResult>, isClaudeCodeE2B: true };
  }

  console.log('[Generate] ⚠️ Falling back to MCP-based agent approach');
  if (!AGENT_CONFIG.useClaudeCodeE2B) {
    console.log('[Generate] Reason: useClaudeCodeE2B is disabled in AGENT_CONFIG');
  }
  if (!e2bAvailable) {
    console.log('[Generate] Reason: E2B not available (check E2B_API_KEY and ANTHROPIC_API_KEY env vars)');
  }
  return { generator: generateWithAgent as (rawContent: string, branding: BrandingConfig | null, userInstructions?: string) => Promise<GenerationResult>, isClaudeCodeE2B: false };
};

// Allow long-running requests for agent loops
export const maxDuration = 480; // 8 minutes

// Estimated credits for dashboard generation (based on typical token usage)
// Simple: ~9 credits, Medium: ~25 credits, Complex: ~50 credits
// We use the medium estimate as default
const ESTIMATED_GENERATION_CREDITS = 25;

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;

  console.log('='.repeat(60));
  console.log(`[Generate] POST /api/dashboards/${id}/generate - STARTING`);
  console.log('='.repeat(60));

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
      const balance = await getCreditBalance(userId, null, supabase);
      return NextResponse.json({
        error: 'Insufficient credits',
        credits_required: ESTIMATED_GENERATION_CREDITS,
        credits_available: balance?.balance || 0,
        upgrade_url: '/settings/billing',
      }, { status: 402 }); // 402 Payment Required
    }

    // Get the dashboard with workspace and organization info
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

    // Fetch organization branding if the dashboard belongs to an organization
    let organizationBranding: BrandingConfig | null = null;
    if (dashboard.organization_id) {
      const { data: orgData } = await supabase
        .from('organizations')
        .select('branding')
        .eq('id', dashboard.organization_id)
        .single();

      if (orgData) {
        organizationBranding = orgData.branding as BrandingConfig | null;
        console.log(`[${id}] Loaded organization branding:`, organizationBranding ? 'found' : 'none');
      }
    }

    // Also check if user belongs to an organization (for dashboards not yet linked to org)
    if (!organizationBranding) {
      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', userId)
        .not('accepted_at', 'is', null)
        .limit(1)
        .single();

      if (membership) {
        // Fetch organization branding separately
        const { data: orgData } = await supabase
          .from('organizations')
          .select('branding')
          .eq('id', membership.organization_id)
          .single();

        if (orgData?.branding) {
          organizationBranding = orgData.branding as BrandingConfig;
          console.log(`[${id}] Loaded branding from user's organization`);
        }
      }
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

    // Merge branding: organization branding takes priority over workspace, dashboard override takes highest priority
    // Priority: dashboardOverride > organizationBranding > workspaceBranding
    const workspaceBranding = dashboard.workspaces.branding;
    const baseBranding = organizationBranding || workspaceBranding;
    const dashboardOverride = dashboard.branding_override;

    const effectiveBranding: BrandingConfig | null = baseBranding || dashboardOverride ? {
      companyName: dashboardOverride?.companyName ?? baseBranding?.companyName,
      logoUrl: dashboardOverride?.logoUrl ?? baseBranding?.logoUrl,
      colors: {
        primary: dashboardOverride?.colors?.primary ?? baseBranding?.colors?.primary,
        secondary: dashboardOverride?.colors?.secondary ?? baseBranding?.colors?.secondary,
        accent: dashboardOverride?.colors?.accent ?? baseBranding?.colors?.accent,
        button: dashboardOverride?.colors?.button ?? baseBranding?.colors?.button,
      },
      chartColors: dashboardOverride?.chartColors ?? baseBranding?.chartColors,
      fontFamily: dashboardOverride?.fontFamily ?? baseBranding?.fontFamily,
      styleGuide: dashboardOverride?.styleGuide ?? baseBranding?.styleGuide,
    } : null;

    // Debug: log the effective branding being used
    if (effectiveBranding) {
      console.log(`[${id}] Effective branding - Primary: ${effectiveBranding.colors?.primary}, Secondary: ${effectiveBranding.colors?.secondary}, Font: ${effectiveBranding.fontFamily}`);
    } else {
      console.log(`[${id}] No branding configured - using defaults`);
    }

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
      // Get the appropriate generator (Claude Code E2B or MCP-based)
      console.log(`[${id}] Loading generation module...`);
      const { generator, isClaudeCodeE2B } = await getAgent();
      console.log(`[${id}] Starting generation (Claude Code E2B: ${isClaudeCodeE2B})...`);

      const result = await generator(
        rawContent,
        effectiveBranding,
        dashboard.user_instructions || undefined
      );
      const config = result.config;
      const agentUsage = result.usage;
      console.log(`[${id}] Generation complete. HTML length: ${config.html?.length || 0}`);

      // Log usage differently based on approach
      if (isClaudeCodeE2B) {
        console.log(`[${id}] Duration: ${agentUsage.durationMs}ms (Claude Code E2B - token usage tracked by Claude internally)`);
      } else if (agentUsage.usage && agentUsage.costUsd !== undefined) {
        // MCP approach has detailed usage
        console.log(`[${id}] Usage: ${agentUsage.usage.inputTokens} input, ${agentUsage.usage.outputTokens} output, cost: $${agentUsage.costUsd.toFixed(4)}`);
      }

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
      // For Claude Code E2B, we use estimated credits since token usage is internal
      const actualInputTokens = agentUsage.usage?.inputTokens || 0;
      const actualOutputTokens = agentUsage.usage?.outputTokens || 0;

      // For Claude Code E2B approach, use estimated credits if no token data
      const useEstimatedCredits = isClaudeCodeE2B || (actualInputTokens === 0 && actualOutputTokens === 0);

      // Deduct credits for successful generation
      const deductionResult = useEstimatedCredits
        ? await deductCredits(
            userId,
            150000, // Estimated input tokens for Claude Code generation
            50000,  // Estimated output tokens
            'dashboard_create',
            id,
            `Generated dashboard (Claude Code E2B): ${dashboard.title}`,
            supabase
          )
        : await deductCredits(
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
      // Normalize model ID to valid type
      const logModelId: ModelId = (agentUsage.modelId === 'opus-4-5' || agentUsage.modelId === 'sonnet-4-5' || agentUsage.modelId === 'haiku-3-5')
        ? agentUsage.modelId
        : 'opus-4-5';

      // Use actual usage if available, otherwise estimate
      const logTokenUsage: TokenUsage = agentUsage.usage || { inputTokens: 150000, outputTokens: 50000 };

      await logUsage(supabase, {
        dashboardId: id,
        userId,
        organizationId: membership?.organization_id || null,
        operationType: 'generation',
        modelId: logModelId,
        usage: logTokenUsage,
        agentReportedCost: agentUsage.costUsd,
        durationMs: agentUsage.durationMs,
        turnCount: agentUsage.turnCount,
        creditsDeducted: deductionResult.success ? deductionResult.credits_used : 0,
        status: 'success',
        metadata: {
          userInstructions: dashboard.user_instructions,
          extendedThinking: !isClaudeCodeE2B,
          claudeCodeE2B: isClaudeCodeE2B,
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
          await sendDashboardReadyEmail(userEmail, dashboard.title, dashboard.slug);
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
 * Uses /d/slug URL for better UX when user is not logged in
 */
async function sendDashboardReadyEmail(email: string, title: string, dashboardSlug: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  // Use /d/slug for better UX - handles unauthenticated users gracefully
  const dashboardUrl = `${baseUrl}/d/${dashboardSlug}`;

  // Use our email API endpoint
  await fetch(`${baseUrl}/api/email/dashboard-ready`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, title, dashboardUrl }),
  });
}
