import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminSupabaseClient = SupabaseClient<any, any, any>;

export type AdminRole = 'super_admin' | 'support' | 'billing_admin';

export interface AdminUser {
  id: string;
  user_id: string;
  role: AdminRole;
  permissions: Record<string, boolean>;
  created_at: string;
}

/**
 * Check if a user is an admin
 */
export async function isAdmin(
  supabase: AdminSupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('admin_users')
    .select('id')
    .eq('user_id', userId)
    .single();

  return !error && !!data;
}

/**
 * Get admin role for a user
 */
export async function getAdminRole(
  supabase: AdminSupabaseClient,
  userId: string
): Promise<AdminRole | null> {
  const { data, error } = await supabase
    .from('admin_users')
    .select('role')
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;
  return data.role as AdminRole;
}

/**
 * Get full admin user record
 */
export async function getAdminUser(
  supabase: AdminSupabaseClient,
  userId: string
): Promise<AdminUser | null> {
  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;
  return data as AdminUser;
}

/**
 * Require admin access - throws if not admin
 */
export async function requireAdmin(
  supabase: AdminSupabaseClient,
  userId: string,
  requiredRoles?: AdminRole[]
): Promise<AdminUser> {
  const adminUser = await getAdminUser(supabase, userId);

  if (!adminUser) {
    throw new Error('Unauthorized: Admin access required');
  }

  if (requiredRoles && requiredRoles.length > 0) {
    if (!requiredRoles.includes(adminUser.role)) {
      throw new Error(`Unauthorized: Requires one of: ${requiredRoles.join(', ')}`);
    }
  }

  return adminUser;
}

/**
 * Log an admin action
 */
export async function logAdminAction(
  supabase: AdminSupabaseClient,
  params: {
    action: string;
    targetType: 'user' | 'organization' | 'settings' | 'credits';
    targetId?: string;
    oldValue?: Record<string, unknown>;
    newValue?: Record<string, unknown>;
    reason?: string;
  }
): Promise<void> {
  await supabase.from('admin_audit_log').insert({
    admin_user_id: (await supabase.auth.getUser()).data.user?.id,
    action: params.action,
    target_type: params.targetType,
    target_id: params.targetId,
    old_value: params.oldValue,
    new_value: params.newValue,
    reason: params.reason,
  });
}

/**
 * Get global settings
 */
export async function getGlobalSettings(
  supabase: AdminSupabaseClient
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from('global_settings')
    .select('key, value');

  if (error) throw error;

  const settings: Record<string, unknown> = {};
  for (const row of data || []) {
    settings[row.key] = row.value;
  }
  return settings;
}

/**
 * Update a global setting
 */
export async function updateGlobalSetting(
  supabase: AdminSupabaseClient,
  key: string,
  value: unknown,
  reason?: string
): Promise<void> {
  // Get old value for audit log
  const { data: oldData } = await supabase
    .from('global_settings')
    .select('value')
    .eq('key', key)
    .single();

  // Update setting
  const { error } = await supabase
    .from('global_settings')
    .update({
      value: value as Record<string, unknown>,
      updated_by: (await supabase.auth.getUser()).data.user?.id,
    })
    .eq('key', key);

  if (error) throw error;

  // Log the action
  await logAdminAction(supabase, {
    action: 'update_setting',
    targetType: 'settings',
    oldValue: { key, value: oldData?.value },
    newValue: { key, value },
    reason,
  });
}

/**
 * Add credits to a user or organization
 */
export async function adminAddCredits(
  supabase: AdminSupabaseClient,
  params: {
    userId?: string;
    organizationId?: string;
    amount: number;
    reason: string;
  }
): Promise<number> {
  const { data, error } = await supabase.rpc('admin_add_credits', {
    p_target_user_id: params.userId || null,
    p_target_org_id: params.organizationId || null,
    p_amount: params.amount,
    p_reason: params.reason,
  });

  if (error) throw error;
  return data as number;
}

/**
 * Get all users with admin view (includes credits, plan, etc.)
 */
export async function getAdminUserList(
  supabase: AdminSupabaseClient,
  params: {
    search?: string;
    planType?: string;
    page?: number;
    limit?: number;
  }
): Promise<{
  users: AdminUserView[];
  total: number;
}> {
  const page = params.page || 1;
  const limit = params.limit || 50;
  const offset = (page - 1) * limit;

  // Build query for profiles (plan_type comes from org membership, not profile)
  let query = supabase
    .from('profiles')
    .select(`
      id,
      name,
      avatar_url,
      created_at,
      updated_at
    `, { count: 'exact' });

  // Apply search filter
  if (params.search) {
    query = query.or(`name.ilike.%${params.search}%`);
  }

  // Note: Plan filter not supported here - plan comes from org membership

  // Apply pagination
  query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false });

  const { data: profiles, error, count } = await query;

  if (error) throw error;

  // Get user emails from auth (requires admin client)
  // For now, return profiles without email - email will be fetched separately
  // Note: plan_type is derived from org membership elsewhere
  const users: AdminUserView[] = (profiles || []).map(profile => ({
    id: profile.id,
    name: profile.name,
    avatar_url: profile.avatar_url,
    plan_type: null, // Plan comes from org membership, not profile
    created_at: profile.created_at,
    updated_at: profile.updated_at,
  }));

  return {
    users,
    total: count || 0,
  };
}

export interface AdminUserView {
  id: string;
  email?: string;
  name: string | null;
  avatar_url: string | null;
  plan_type: string | null;
  created_at: string | null;
  updated_at: string | null;
  credit_balance?: number;
  dashboard_count?: number;
  has_override?: boolean;
}

/**
 * Get detailed user info for admin view
 */
export async function getAdminUserDetail(
  supabase: AdminSupabaseClient,
  userId: string
): Promise<AdminUserDetail | null> {
  // Get profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileError || !profile) return null;

  // Get user credits
  const { data: credits } = await supabase
    .from('user_credits')
    .select('balance, lifetime_credits, lifetime_used')
    .eq('user_id', userId)
    .single();

  // Get dashboard count
  const { count: dashboardCount } = await supabase
    .from('dashboards')
    .select('id', { count: 'exact', head: true })
    .eq('created_by', userId)
    .is('deleted_at', null);

  // Get override if exists
  const { data: override } = await supabase
    .from('user_plan_overrides')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  // Get recent transactions
  const { data: transactions } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  return {
    profile,
    credits: credits || { balance: 0, lifetime_credits: 0, lifetime_used: 0 },
    dashboardCount: dashboardCount || 0,
    override: override || null,
    recentTransactions: transactions || [],
  };
}

export interface AdminUserDetail {
  profile: {
    id: string;
    name: string | null;
    avatar_url: string | null;
    plan_type: string | null;
    stripe_customer_id: string | null;
    created_at: string | null;
    updated_at: string | null;
  };
  credits: {
    balance: number;
    lifetime_credits: number;
    lifetime_used: number;
  };
  dashboardCount: number;
  override: {
    id: string;
    plan_type: string | null;
    max_dashboards: number | null;
    monthly_credits: number | null;
    price_override_cents: number | null;
    plan_expires_at: string | null;
    notes: string | null;
  } | null;
  recentTransactions: {
    id: string;
    amount: number;
    balance_after: number;
    transaction_type: string;
    description: string | null;
    created_at: string;
  }[];
}

/**
 * Set plan override for a user
 */
export async function setUserPlanOverride(
  supabase: AdminSupabaseClient,
  userId: string,
  override: {
    planType?: string;
    maxDashboards?: number;
    monthlyCredits?: number;
    priceOverrideCents?: number;
    expiresAt?: string;
    notes?: string;
  }
): Promise<void> {
  // Deactivate existing overrides
  await supabase
    .from('user_plan_overrides')
    .update({ is_active: false })
    .eq('user_id', userId);

  // Create new override
  const { error } = await supabase.from('user_plan_overrides').insert({
    user_id: userId,
    plan_type: override.planType,
    max_dashboards: override.maxDashboards,
    monthly_credits: override.monthlyCredits,
    price_override_cents: override.priceOverrideCents,
    plan_expires_at: override.expiresAt,
    notes: override.notes,
    created_by: (await supabase.auth.getUser()).data.user?.id,
  });

  if (error) throw error;

  // Log the action
  await logAdminAction(supabase, {
    action: 'set_plan_override',
    targetType: 'user',
    targetId: userId,
    newValue: override as Record<string, unknown>,
  });
}

/**
 * Remove plan override for a user
 */
export async function removeUserPlanOverride(
  supabase: AdminSupabaseClient,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('user_plan_overrides')
    .update({ is_active: false })
    .eq('user_id', userId);

  if (error) throw error;

  await logAdminAction(supabase, {
    action: 'remove_plan_override',
    targetType: 'user',
    targetId: userId,
  });
}
