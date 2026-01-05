/**
 * Cost Tracking Utilities
 *
 * Handles AI usage cost calculations and logging
 */

import { SupabaseClient } from '@supabase/supabase-js';

// ============================================
// Types
// ============================================

export type OperationType = 'generation' | 'modification' | 'data_refresh';

export type ModelId = 'opus-4-5' | 'sonnet-4-5' | 'haiku-3-5';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  thinkingTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export interface CostBreakdown {
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
}

export interface ModelPricing {
  modelId: ModelId;
  displayName: string;
  inputCostPer1M: number;
  outputCostPer1M: number;
  isActive: boolean;
  effectiveFrom: string;
}

export interface UsageLogEntry {
  id: string;
  dashboardId: string | null;
  userId: string | null;
  organizationId: string | null;
  operationType: OperationType;
  modelId: ModelId;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
  agentReportedCostUsd: number | null;
  creditsDeducted: number;
  durationMs: number | null;
  turnCount: number | null;
  status: 'success' | 'failed' | 'partial';
  createdAt: string;
}

export interface LogUsageParams {
  dashboardId: string;
  userId: string;
  organizationId?: string | null;
  operationType: OperationType;
  modelId: ModelId;
  usage: TokenUsage;
  agentReportedCost?: number;
  durationMs?: number;
  turnCount?: number;
  creditsDeducted?: number;
  status?: 'success' | 'failed' | 'partial';
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentResult {
  html: string;
  summary: string;
  usage?: TokenUsage;
  costUsd?: number;
  turnCount?: number;
  durationMs?: number;
}

// ============================================
// Model ID Mapping
// ============================================

/**
 * Map full model names to our simplified model IDs
 */
export function normalizeModelId(fullModelName: string): ModelId {
  const lower = fullModelName.toLowerCase();

  if (lower.includes('opus')) {
    return 'opus-4-5';
  }
  if (lower.includes('sonnet')) {
    return 'sonnet-4-5';
  }
  if (lower.includes('haiku')) {
    return 'haiku-3-5';
  }

  // Default to opus for unknown models
  console.warn(`[Costs] Unknown model: ${fullModelName}, defaulting to opus-4-5`);
  return 'opus-4-5';
}

// ============================================
// Default Pricing (fallback)
// ============================================

const DEFAULT_PRICING: Record<ModelId, { input: number; output: number }> = {
  'opus-4-5': { input: 15.0, output: 75.0 },
  'sonnet-4-5': { input: 3.0, output: 15.0 },
  'haiku-3-5': { input: 0.8, output: 4.0 },
};

// ============================================
// Cost Calculations
// ============================================

/**
 * Calculate cost from token usage (local calculation with default pricing)
 * Use this for quick estimates; for accurate costs use calculateCostFromDb
 */
export function calculateCost(modelId: ModelId, usage: TokenUsage): CostBreakdown {
  const pricing = DEFAULT_PRICING[modelId] || DEFAULT_PRICING['opus-4-5'];

  const inputCostUsd = (usage.inputTokens / 1_000_000) * pricing.input;
  const outputCostUsd = (usage.outputTokens / 1_000_000) * pricing.output;
  const totalCostUsd = inputCostUsd + outputCostUsd;

  return {
    inputCostUsd: Math.round(inputCostUsd * 1_000_000) / 1_000_000, // 6 decimal places
    outputCostUsd: Math.round(outputCostUsd * 1_000_000) / 1_000_000,
    totalCostUsd: Math.round(totalCostUsd * 1_000_000) / 1_000_000,
  };
}

/**
 * Calculate cost using database pricing (for accurate costs)
 */
export async function calculateCostFromDb(
  supabase: SupabaseClient,
  modelId: ModelId,
  usage: TokenUsage
): Promise<CostBreakdown> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc('calculate_token_cost', {
      p_model_id: modelId,
      p_input_tokens: usage.inputTokens,
      p_output_tokens: usage.outputTokens,
    });

    if (error || !data || data.length === 0) {
      console.warn('[Costs] Failed to get DB pricing, using defaults:', error);
      return calculateCost(modelId, usage);
    }

    return {
      inputCostUsd: parseFloat(data[0].input_cost),
      outputCostUsd: parseFloat(data[0].output_cost),
      totalCostUsd: parseFloat(data[0].total_cost),
    };
  } catch (e) {
    console.error('[Costs] Error calculating cost from DB:', e);
    return calculateCost(modelId, usage);
  }
}

// ============================================
// Usage Logging
// ============================================

/**
 * Log AI usage to the database
 */
export async function logUsage(
  supabase: SupabaseClient,
  params: LogUsageParams
): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc('log_ai_usage', {
      p_dashboard_id: params.dashboardId,
      p_user_id: params.userId,
      p_org_id: params.organizationId || null,
      p_operation_type: params.operationType,
      p_model_id: params.modelId,
      p_input_tokens: params.usage.inputTokens,
      p_output_tokens: params.usage.outputTokens,
      p_thinking_tokens: params.usage.thinkingTokens || 0,
      p_agent_reported_cost: params.agentReportedCost || null,
      p_duration_ms: params.durationMs || null,
      p_turn_count: params.turnCount || null,
      p_credits_deducted: params.creditsDeducted || 0,
      p_status: params.status || 'success',
      p_error_message: params.errorMessage || null,
      p_metadata: params.metadata || null,
    });

    if (error) {
      console.error('[Costs] Failed to log usage:', error);
      return null;
    }

    console.log(`[Costs] Logged usage: ${params.operationType} on ${params.dashboardId}, cost: $${calculateCost(params.modelId, params.usage).totalCostUsd.toFixed(4)}`);
    return data;
  } catch (e) {
    console.error('[Costs] Error logging usage:', e);
    return null;
  }
}

// ============================================
// Model Pricing Management
// ============================================

/**
 * Get all model pricing from database
 */
export async function getModelPricing(supabase: SupabaseClient): Promise<ModelPricing[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('model_pricing')
      .select('*')
      .eq('is_active', true)
      .order('model_id');

    if (error) {
      console.error('[Costs] Failed to get model pricing:', error);
      return [];
    }

    return (data || []).map((row: {
      model_id: string;
      display_name: string;
      input_cost_per_1m_tokens: string;
      output_cost_per_1m_tokens: string;
      is_active: boolean;
      effective_from: string;
    }) => ({
      modelId: row.model_id as ModelId,
      displayName: row.display_name,
      inputCostPer1M: parseFloat(row.input_cost_per_1m_tokens),
      outputCostPer1M: parseFloat(row.output_cost_per_1m_tokens),
      isActive: row.is_active,
      effectiveFrom: row.effective_from,
    }));
  } catch (e) {
    console.error('[Costs] Error getting model pricing:', e);
    return [];
  }
}

/**
 * Update model pricing (admin only, via service role)
 */
export async function updateModelPricing(
  supabase: SupabaseClient,
  modelId: ModelId,
  inputCostPer1M: number,
  outputCostPer1M: number
): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('model_pricing')
      .update({
        input_cost_per_1m_tokens: inputCostPer1M,
        output_cost_per_1m_tokens: outputCostPer1M,
        effective_from: new Date().toISOString(),
      })
      .eq('model_id', modelId);

    if (error) {
      console.error('[Costs] Failed to update pricing:', error);
      return false;
    }

    console.log(`[Costs] Updated pricing for ${modelId}: input=$${inputCostPer1M}/1M, output=$${outputCostPer1M}/1M`);
    return true;
  } catch (e) {
    console.error('[Costs] Error updating pricing:', e);
    return false;
  }
}

// ============================================
// Usage Analytics
// ============================================

/**
 * Get usage summary for a user
 */
export async function getUserUsageSummary(
  supabase: SupabaseClient,
  userId: string,
  days: number = 30
): Promise<{
  totalCost: number;
  totalOperations: number;
  byOperation: Record<OperationType, { count: number; cost: number }>;
  byModel: Record<string, { count: number; cost: number }>;
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('ai_usage_logs')
      .select('operation_type, model_id, total_cost_usd')
      .eq('user_id', userId)
      .eq('status', 'success')
      .gte('created_at', startDate.toISOString());

    if (error) {
      console.error('[Costs] Failed to get usage summary:', error);
      return {
        totalCost: 0,
        totalOperations: 0,
        byOperation: {
          generation: { count: 0, cost: 0 },
          modification: { count: 0, cost: 0 },
          data_refresh: { count: 0, cost: 0 },
        },
        byModel: {},
      };
    }

    const byOperation: Record<OperationType, { count: number; cost: number }> = {
      generation: { count: 0, cost: 0 },
      modification: { count: 0, cost: 0 },
      data_refresh: { count: 0, cost: 0 },
    };

    const byModel: Record<string, { count: number; cost: number }> = {};
    let totalCost = 0;

    for (const row of data || []) {
      const cost = parseFloat(row.total_cost_usd);
      totalCost += cost;

      if (byOperation[row.operation_type as OperationType]) {
        byOperation[row.operation_type as OperationType].count++;
        byOperation[row.operation_type as OperationType].cost += cost;
      }

      if (!byModel[row.model_id]) {
        byModel[row.model_id] = { count: 0, cost: 0 };
      }
      byModel[row.model_id].count++;
      byModel[row.model_id].cost += cost;
    }

    return {
      totalCost,
      totalOperations: data?.length || 0,
      byOperation,
      byModel,
    };
  } catch (e) {
    console.error('[Costs] Error getting usage summary:', e);
    return {
      totalCost: 0,
      totalOperations: 0,
      byOperation: {
        generation: { count: 0, cost: 0 },
        modification: { count: 0, cost: 0 },
        data_refresh: { count: 0, cost: 0 },
      },
      byModel: {},
    };
  }
}

/**
 * Get recent usage logs for a dashboard
 */
export async function getDashboardUsageLogs(
  supabase: SupabaseClient,
  dashboardId: string,
  limit: number = 20
): Promise<UsageLogEntry[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('ai_usage_logs')
      .select('*')
      .eq('dashboard_id', dashboardId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Costs] Failed to get dashboard usage logs:', error);
      return [];
    }

    return (data || []).map((row: {
      id: string;
      dashboard_id: string | null;
      user_id: string | null;
      organization_id: string | null;
      operation_type: string;
      model_id: string;
      input_tokens: number;
      output_tokens: number;
      thinking_tokens: number;
      input_cost_usd: string;
      output_cost_usd: string;
      total_cost_usd: string;
      agent_reported_cost_usd: string | null;
      credits_deducted: number;
      duration_ms: number | null;
      turn_count: number | null;
      status: string;
      created_at: string;
    }) => ({
      id: row.id,
      dashboardId: row.dashboard_id,
      userId: row.user_id,
      organizationId: row.organization_id,
      operationType: row.operation_type as OperationType,
      modelId: row.model_id as ModelId,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      thinkingTokens: row.thinking_tokens,
      inputCostUsd: parseFloat(row.input_cost_usd),
      outputCostUsd: parseFloat(row.output_cost_usd),
      totalCostUsd: parseFloat(row.total_cost_usd),
      agentReportedCostUsd: row.agent_reported_cost_usd ? parseFloat(row.agent_reported_cost_usd) : null,
      creditsDeducted: row.credits_deducted,
      durationMs: row.duration_ms,
      turnCount: row.turn_count,
      status: row.status as 'success' | 'failed' | 'partial',
      createdAt: row.created_at,
    }));
  } catch (e) {
    console.error('[Costs] Error getting dashboard usage logs:', e);
    return [];
  }
}
