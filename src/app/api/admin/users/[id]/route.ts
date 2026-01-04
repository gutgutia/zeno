import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

// GET /api/admin/users/[id] - Get user details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params;
  const supabase = await createClient();

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

  // Get user credits
  const { data: credits } = await supabase
    .from('user_credits')
    .select('*')
    .eq('user_id', userId)
    .single();

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

  // Get recent transactions
  const { data: transactions } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  // Get organizations
  const { data: memberships } = await supabase
    .from('organization_members')
    .select(`
      role,
      organization:organizations(id, name, plan_type)
    `)
    .eq('user_id', userId);

  return NextResponse.json({
    profile: {
      ...profile,
      email,
    },
    credits: credits || { balance: 0, lifetime_credits: 0, lifetime_used: 0 },
    dashboardCount: dashboardCount || 0,
    dashboards: dashboards || [],
    override: override || null,
    transactions: transactions || [],
    organizations: memberships || [],
  });
}

// PATCH /api/admin/users/[id] - Update user
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params;
  const supabase = await createClient();

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

      // Get current credits
      const { data: currentCredits } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', userId)
        .single();

      const currentBalance = currentCredits?.balance || 0;
      const newBalance = currentBalance + amount;

      // Update credits
      const { error: updateError } = await supabase
        .from('user_credits')
        .upsert({
          user_id: userId,
          balance: newBalance,
          lifetime_credits: (currentCredits?.balance || 0) + (amount > 0 ? amount : 0),
        }, { onConflict: 'user_id' });

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      // Create transaction record
      await supabase.from('credit_transactions').insert({
        user_id: userId,
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
        new_value: { amount, reason, new_balance: newBalance },
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

    case 'update_plan': {
      const { plan_type } = data;
      if (!plan_type) {
        return NextResponse.json({ error: 'Plan type required' }, { status: 400 });
      }

      // Get old plan
      const { data: oldProfile } = await supabase
        .from('profiles')
        .select('plan_type')
        .eq('id', userId)
        .single();

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ plan_type })
        .eq('id', userId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      // Log admin action
      await supabase.from('admin_audit_log').insert({
        admin_user_id: user.id,
        action: 'update_plan',
        target_type: 'user',
        target_id: userId,
        old_value: { plan_type: oldProfile?.plan_type },
        new_value: { plan_type },
      });

      return NextResponse.json({ success: true });
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
