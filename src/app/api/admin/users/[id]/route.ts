import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient, SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminSupabase = SupabaseClient<any, any, any>;

// GET /api/admin/users/[id] - Get user details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params;
  const supabase = await createClient() as AdminSupabase;

  // Check if user is admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!adminUser) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  // Get profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Get user email from auth
  let email = null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseServiceKey) {
    try {
      const adminSupabase = createAdminClient(supabaseUrl, supabaseServiceKey);
      const { data: authUser } = await adminSupabase.auth.admin.getUserById(userId);
      email = authUser?.user?.email || null;
    } catch (e) {
      console.error('Failed to fetch auth user:', e);
    }
  }

  // Get organizations first (needed for credits and plan)
  const { data: memberships } = await supabase
    .from('organization_members')
    .select(`
      role,
      organization:organizations(id, name, plan_type)
    `)
    .eq('user_id', userId)
    .not('accepted_at', 'is', null);

  // Get the user's primary org (best plan)
  let primaryOrgId: string | null = null;
  let effectivePlan = 'free';
  const planRank: Record<string, number> = { enterprise: 4, pro: 3, starter: 2, free: 1 };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  memberships?.forEach((m: any) => {
    const org = m.organization;
    if (org) {
      const orgPlan = org.plan_type;
      if ((planRank[orgPlan] || 0) > (planRank[effectivePlan] || 0)) {
        effectivePlan = orgPlan;
        primaryOrgId = org.id;
      } else if (!primaryOrgId) {
        primaryOrgId = org.id;
      }
    }
  });

  // Get credits from organization (not user_credits)
  let credits = { balance: 0, lifetime_credits: 0, lifetime_used: 0 };
  if (primaryOrgId) {
    const { data: orgCredits } = await supabase
      .from('organization_credits')
      .select('balance, lifetime_credits, lifetime_used')
      .eq('organization_id', primaryOrgId)
      .single();

    if (orgCredits) {
      credits = orgCredits;
    }
  }

  // Get dashboard count
  const { count: dashboardCount } = await supabase
    .from('dashboards')
    .select('*', { count: 'exact', head: true })
    .eq('created_by', userId)
    .is('deleted_at', null);

  // Get dashboards list
  const { data: dashboards } = await supabase
    .from('dashboards')
    .select('id, title, slug, created_at, is_published')
    .eq('created_by', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(10);

  // Get plan override
  const { data: override } = await supabase
    .from('user_plan_overrides')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  // Get recent transactions (from org if available)
  let transactions: unknown[] = [];
  if (primaryOrgId) {
    const { data: txData } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('organization_id', primaryOrgId)
      .order('created_at', { ascending: false })
      .limit(20);
    transactions = txData || [];
  }

  return NextResponse.json({
    profile: {
      ...profile,
      email,
      plan_type: effectivePlan, // Override with effective plan from org
    },
    credits,
    dashboardCount: dashboardCount || 0,
    dashboards: dashboards || [],
    override: override || null,
    transactions,
    organizations: memberships || [],
  });
}

// PATCH /api/admin/users/[id] - Update user
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params;
  const supabase = await createClient() as AdminSupabase;

  // Check if user is admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (!adminUser) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await request.json();
  const { action, ...data } = body;

  // Handle different actions
  switch (action) {
    case 'add_credits': {
      const { amount, reason } = data;
      if (!amount || !reason) {
        return NextResponse.json({ error: 'Amount and reason required' }, { status: 400 });
      }

      // Get user's primary organization
      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', userId)
        .not('accepted_at', 'is', null)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (!membership) {
        return NextResponse.json({ error: 'User has no organization' }, { status: 400 });
      }

      const orgId = membership.organization_id;

      // Get current org credits
      const { data: currentCredits } = await supabase
        .from('organization_credits')
        .select('balance, lifetime_credits')
        .eq('organization_id', orgId)
        .single();

      const currentBalance = currentCredits?.balance || 0;
      const currentLifetime = currentCredits?.lifetime_credits || 0;
      const newBalance = currentBalance + amount;
      const newLifetime = currentLifetime + (amount > 0 ? amount : 0);

      // Update org credits
      const { error: updateError } = await supabase
        .from('organization_credits')
        .upsert({
          organization_id: orgId,
          balance: newBalance,
          lifetime_credits: newLifetime,
        }, { onConflict: 'organization_id' });

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      // Create transaction record (at org level)
      await supabase.from('credit_transactions').insert({
        organization_id: orgId,
        amount,
        balance_after: newBalance,
        transaction_type: 'manual_adjustment',
        description: reason,
        created_by: user.id,
      });

      // Log admin action
      await supabase.from('admin_audit_log').insert({
        admin_user_id: user.id,
        action: 'add_credits',
        target_type: 'user',
        target_id: userId,
        new_value: { amount, reason, new_balance: newBalance, organization_id: orgId },
      });

      return NextResponse.json({ success: true, new_balance: newBalance });
    }

    case 'set_override': {
      const { plan_type, max_dashboards, monthly_credits, price_override_cents, expires_at, notes } = data;

      // Deactivate existing overrides
      await supabase
        .from('user_plan_overrides')
        .update({ is_active: false })
        .eq('user_id', userId);

      // Create new override
      const { error: insertError } = await supabase.from('user_plan_overrides').insert({
        user_id: userId,
        plan_type,
        max_dashboards,
        monthly_credits,
        price_override_cents,
        plan_expires_at: expires_at,
        notes,
        created_by: user.id,
      });

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      // Log admin action
      await supabase.from('admin_audit_log').insert({
        admin_user_id: user.id,
        action: 'set_override',
        target_type: 'user',
        target_id: userId,
        new_value: { plan_type, max_dashboards, monthly_credits, price_override_cents },
      });

      return NextResponse.json({ success: true });
    }

    case 'remove_override': {
      await supabase
        .from('user_plan_overrides')
        .update({ is_active: false })
        .eq('user_id', userId);

      // Log admin action
      await supabase.from('admin_audit_log').insert({
        admin_user_id: user.id,
        action: 'remove_override',
        target_type: 'user',
        target_id: userId,
      });

      return NextResponse.json({ success: true });
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
