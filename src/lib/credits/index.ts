/**
 * Credit System Utilities
 *
 * Handles credit calculations, balance checks, and deductions
 */

import { createClient } from '@/lib/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';

// Type for optional supabase client parameter
type OptionalClient = SupabaseClient | null;

// ============================================
// Types
// ============================================

export interface CreditBalance {
  balance: number;
  lifetime_credits: number;
  lifetime_used: number;
  source: 'organization' | 'user';
  organization_id?: string;
}

export interface CreditTransaction {
  id: string;
  amount: number;
  balance_after: number;
  transaction_type: string;
  dashboard_id: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  description: string | null;
  created_at: string;
}

export interface DeductionResult {
  success: boolean;
  credits_used: number;
  balance_after: number;
  error?: string;
}

export type FeatureKey =
  | 'max_dashboards'
  | 'public_sharing'
  | 'private_sharing'
  | 'custom_subdomain'
  | 'custom_domain'
  | 'custom_branding'
  | 'remove_zeno_branding'
  | 'google_sheets'
  | 'scheduled_refresh'
  | 'pdf_export'
  | 'shared_folders'
  | 'team_members'
  | 'priority_support'
  | 'sso'
  | 'audit_logs';

export type PlanType = 'free' | 'starter' | 'pro' | 'enterprise';

export interface PlanFeature {
  feature_key: FeatureKey;
  enabled: boolean;
  limit_value: number | null;
}

// ============================================
// Credit Calculations
// ============================================

/**
 * Calculate credits from token usage
 * Formula: ceil((input + output * 5) / 10000)
 * This yields ~50% margin based on AI costs
 */
export function calculateCredits(inputTokens: number, outputTokens: number): number {
  const weightedTokens = inputTokens + outputTokens * 5;
  return Math.ceil(weightedTokens / 10000);
}

// ============================================
// Credit Balance Operations
// ============================================

/**
 * Get user's credit balance (from specified org, or user's primary org, or personal credits)
 * @param userId - The user ID to check credits for
 * @param organizationId - Optional organization ID to get credits for (if user is a member)
 * @param client - Optional supabase client (uses server client if not provided)
 */
export async function getCreditBalance(
  userId: string,
  organizationId?: string | null,
  client?: OptionalClient
): Promise<CreditBalance | null> {
  const supabase = client || await createClient();

  // If a specific organization is requested, verify membership and get those credits
  if (organizationId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: membership } = await (supabase as any)
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .not('accepted_at', 'is', null)
      .single();

    if (membership) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: orgCredits } = await (supabase as any)
        .from('organization_credits')
        .select('*')
        .eq('organization_id', organizationId)
        .single();

      if (orgCredits) {
        return {
          balance: orgCredits.balance,
          lifetime_credits: orgCredits.lifetime_credits,
          lifetime_used: orgCredits.lifetime_used,
          source: 'organization',
          organization_id: organizationId,
        };
      }
    }
  }

  // Otherwise, get the user's primary organization (first one they own, or first membership)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: memberships } = await (supabase as any)
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', userId)
    .not('accepted_at', 'is', null)
    .order('created_at', { ascending: true }); // Get oldest first (typically personal org)

  // Prefer owned orgs, then fall back to first membership
  const ownedOrg = memberships?.find((m: { role: string }) => m.role === 'owner');
  const primaryMembership = ownedOrg || memberships?.[0];

  if (primaryMembership?.organization_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: orgCredits } = await (supabase as any)
      .from('organization_credits')
      .select('*')
      .eq('organization_id', primaryMembership.organization_id)
      .single();

    if (orgCredits) {
      return {
        balance: orgCredits.balance,
        lifetime_credits: orgCredits.lifetime_credits,
        lifetime_used: orgCredits.lifetime_used,
        source: 'organization',
        organization_id: primaryMembership.organization_id,
      };
    }
  }

  // Fall back to user credits (legacy)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userCredits } = await (supabase as any)
    .from('user_credits')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (userCredits) {
    return {
      balance: userCredits.balance,
      lifetime_credits: userCredits.lifetime_credits,
      lifetime_used: userCredits.lifetime_used,
      source: 'user',
    };
  }

  return null;
}

/**
 * Check if user has enough credits
 * @param userId - The user ID to check credits for
 * @param requiredCredits - Number of credits required
 * @param client - Optional supabase client (uses server client if not provided)
 */
export async function hasEnoughCredits(
  userId: string,
  requiredCredits: number,
  client?: OptionalClient
): Promise<boolean> {
  const balance = await getCreditBalance(userId, null, client);
  return balance !== null && balance.balance >= requiredCredits;
}

/**
 * Deduct credits for an action
 */
export async function deductCredits(
  userId: string,
  inputTokens: number,
  outputTokens: number,
  transactionType: 'dashboard_create' | 'dashboard_update' | 'dashboard_refresh',
  dashboardId?: string,
  description?: string,
  client?: OptionalClient
): Promise<DeductionResult> {
  const supabase = client || await createClient();
  const creditsToDeduct = calculateCredits(inputTokens, outputTokens);

  // Get current balance info
  const balance = await getCreditBalance(userId, null, supabase);

  if (!balance) {
    return {
      success: false,
      credits_used: 0,
      balance_after: 0,
      error: 'No credit balance found',
    };
  }

  if (balance.balance < creditsToDeduct) {
    return {
      success: false,
      credits_used: 0,
      balance_after: balance.balance,
      error: `Insufficient credits. Need ${creditsToDeduct}, have ${balance.balance}`,
    };
  }

  // Call the deduct function
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('deduct_credits', {
    p_user_id: balance.source === 'user' ? userId : null,
    p_org_id: balance.source === 'organization' ? balance.organization_id : null,
    p_amount: creditsToDeduct,
    p_transaction_type: transactionType,
    p_dashboard_id: dashboardId || null,
    p_input_tokens: inputTokens,
    p_output_tokens: outputTokens,
    p_description: description || null,
  });

  if (error || data === false) {
    return {
      success: false,
      credits_used: 0,
      balance_after: balance.balance,
      error: error?.message || 'Failed to deduct credits',
    };
  }

  return {
    success: true,
    credits_used: creditsToDeduct,
    balance_after: balance.balance - creditsToDeduct,
  };
}

/**
 * Add credits (for purchases, refills, etc.)
 */
export async function addCredits(
  userId: string,
  organizationId: string | null,
  amount: number,
  transactionType: 'credit_pack' | 'monthly_refill' | 'manual_adjustment' | 'refund',
  description?: string
): Promise<number | null> {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('add_credits', {
    p_user_id: organizationId ? null : userId,
    p_org_id: organizationId,
    p_amount: amount,
    p_transaction_type: transactionType,
    p_description: description || null,
  });

  if (error) {
    console.error('Error adding credits:', error);
    return null;
  }

  return data;
}

// ============================================
// Feature Access
// ============================================

/**
 * Get user's effective plan (checks overrides first, then org, then defaults to free)
 */
export async function getUserPlan(userId: string): Promise<PlanType> {
  const supabase = await createClient();

  // First check for active plan override
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: override } = await (supabase as any)
    .from('user_plan_overrides')
    .select('plan_type')
    .eq('user_id', userId)
    .eq('is_active', true)
    .or('plan_expires_at.is.null,plan_expires_at.gt.now()')
    .single();

  if (override?.plan_type) {
    return override.plan_type as PlanType;
  }

  // Check org memberships
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: memberships } = await (supabase as any)
    .from('organization_members')
    .select('organizations(plan_type)')
    .eq('user_id', userId)
    .not('accepted_at', 'is', null);

  if (memberships && memberships.length > 0) {
    // Return best plan
    const plans = memberships.map(
      (m: { organizations: { plan_type: PlanType } }) => m.organizations.plan_type
    );
    if (plans.includes('enterprise')) return 'enterprise';
    if (plans.includes('pro')) return 'pro';
    if (plans.includes('starter')) return 'starter';
  }

  return 'free';
}

/**
 * Check if user has access to a feature
 */
export async function hasFeature(userId: string, feature: FeatureKey): Promise<boolean> {
  const supabase = await createClient();
  const plan = await getUserPlan(userId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('plan_features')
    .select('enabled')
    .eq('plan_type', plan)
    .eq('feature_key', feature)
    .single();

  return data?.enabled ?? false;
}

/**
 * Get feature limit for user (null = unlimited)
 */
export async function getFeatureLimit(
  userId: string,
  feature: FeatureKey
): Promise<number | null> {
  const supabase = await createClient();
  const plan = await getUserPlan(userId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('plan_features')
    .select('limit_value')
    .eq('plan_type', plan)
    .eq('feature_key', feature)
    .single();

  return data?.limit_value ?? null;
}

/**
 * Get all features for a plan
 */
export async function getPlanFeatures(plan: PlanType): Promise<PlanFeature[]> {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('plan_features')
    .select('feature_key, enabled, limit_value')
    .eq('plan_type', plan);

  return (data || []) as PlanFeature[];
}

/**
 * Get dashboard count for user (no limits - we rely on credits instead)
 */
export async function canCreateDashboard(userId: string): Promise<{
  allowed: boolean;
  current: number;
  limit: number | null;
  reason?: string;
}> {
  const supabase = await createClient();

  // Count current dashboards (for display only)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (supabase as any)
    .from('dashboards')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', userId)
    .is('deleted_at', null);

  const current = count || 0;

  // Always allow - we rely on credits to gate dashboard creation, not arbitrary limits
  return { allowed: true, current, limit: null };
}

// ============================================
// Credit Transaction History
// ============================================

/**
 * Get credit transaction history
 */
export async function getTransactionHistory(
  userId: string,
  organizationId?: string,
  limit: number = 50
): Promise<CreditTransaction[]> {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('credit_transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  } else {
    query = query.eq('user_id', userId);
  }

  const { data } = await query;
  return (data || []) as CreditTransaction[];
}
