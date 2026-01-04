import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

// GET /api/admin/organizations/[id] - Get organization details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orgId } = await params;
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

  // Get organization
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .single();

  if (orgError || !org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  // Get members with profiles
  const { data: members } = await supabase
    .from('organization_members')
    .select(`
      id,
      user_id,
      role,
      invited_at,
      accepted_at,
      profile:profiles(id, name, avatar_url, plan_type)
    `)
    .eq('organization_id', orgId)
    .order('role', { ascending: true });

  // Get member emails from auth
  let emailMap: Record<string, string> = {};
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseServiceKey && members) {
    try {
      const adminSupabase = createAdminClient(supabaseUrl, supabaseServiceKey);
      const userIds = members.map(m => m.user_id);
      for (const userId of userIds) {
        try {
          const { data: authUser } = await adminSupabase.auth.admin.getUserById(userId);
          if (authUser?.user?.email) {
            emailMap[userId] = authUser.user.email;
          }
        } catch (e) {
          // Skip if user not found
        }
      }
    } catch (e) {
      console.error('Failed to fetch auth users:', e);
    }
  }

  // Add emails to members
  const membersWithEmail = (members || []).map(m => ({
    ...m,
    email: emailMap[m.user_id] || null,
  }));

  // Get org credits
  const { data: credits } = await supabase
    .from('organization_credits')
    .select('*')
    .eq('organization_id', orgId)
    .single();

  // Get pending invitations
  const { data: invitations } = await supabase
    .from('organization_invitations')
    .select('*')
    .eq('organization_id', orgId)
    .gt('expires_at', new Date().toISOString());

  // Get dashboard count and list
  const { data: dashboards } = await supabase
    .from('dashboards')
    .select('id, title, slug, created_at, is_published, created_by')
    .eq('owner_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(10);

  const { count: dashboardCount } = await supabase
    .from('dashboards')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', orgId)
    .is('deleted_at', null);

  // Get plan override
  const { data: override } = await supabase
    .from('user_plan_overrides')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .single();

  // Get recent transactions
  const { data: transactions } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(20);

  return NextResponse.json({
    organization: org,
    members: membersWithEmail,
    invitations: invitations || [],
    credits: credits || { balance: 0, lifetime_credits: 0, lifetime_used: 0 },
    dashboardCount: dashboardCount || 0,
    dashboards: dashboards || [],
    override: override || null,
    transactions: transactions || [],
  });
}

// PATCH /api/admin/organizations/[id] - Update organization
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orgId } = await params;
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

  switch (action) {
    case 'add_credits': {
      const { amount, reason } = data;
      if (!amount || !reason) {
        return NextResponse.json({ error: 'Amount and reason required' }, { status: 400 });
      }

      // Get current credits
      const { data: currentCredits } = await supabase
        .from('organization_credits')
        .select('balance, lifetime_credits')
        .eq('organization_id', orgId)
        .single();

      const currentBalance = currentCredits?.balance || 0;
      const newBalance = currentBalance + amount;

      // Upsert credits
      const { error: updateError } = await supabase
        .from('organization_credits')
        .upsert({
          organization_id: orgId,
          balance: newBalance,
          lifetime_credits: (currentCredits?.lifetime_credits || 0) + (amount > 0 ? amount : 0),
        }, { onConflict: 'organization_id' });

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      // Create transaction record
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
        target_type: 'organization',
        target_id: orgId,
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
        .eq('organization_id', orgId);

      // Create new override
      const { error: insertError } = await supabase.from('user_plan_overrides').insert({
        organization_id: orgId,
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
        target_type: 'organization',
        target_id: orgId,
        new_value: { plan_type, max_dashboards, monthly_credits, price_override_cents },
      });

      return NextResponse.json({ success: true });
    }

    case 'remove_override': {
      await supabase
        .from('user_plan_overrides')
        .update({ is_active: false })
        .eq('organization_id', orgId);

      // Log admin action
      await supabase.from('admin_audit_log').insert({
        admin_user_id: user.id,
        action: 'remove_override',
        target_type: 'organization',
        target_id: orgId,
      });

      return NextResponse.json({ success: true });
    }

    case 'update_plan': {
      const { plan_type, seats_purchased } = data;

      // Get old values
      const { data: oldOrg } = await supabase
        .from('organizations')
        .select('plan_type, seats_purchased')
        .eq('id', orgId)
        .single();

      // Update organization
      const updateData: Record<string, unknown> = {};
      if (plan_type) updateData.plan_type = plan_type;
      if (seats_purchased) updateData.seats_purchased = seats_purchased;

      const { error: updateError } = await supabase
        .from('organizations')
        .update(updateData)
        .eq('id', orgId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      // Log admin action
      await supabase.from('admin_audit_log').insert({
        admin_user_id: user.id,
        action: 'update_plan',
        target_type: 'organization',
        target_id: orgId,
        old_value: oldOrg,
        new_value: updateData,
      });

      return NextResponse.json({ success: true });
    }

    case 'update_org': {
      const { name, subdomain, custom_domain, billing_email } = data;

      // Get old values
      const { data: oldOrg } = await supabase
        .from('organizations')
        .select('name, subdomain, custom_domain, billing_email')
        .eq('id', orgId)
        .single();

      // Update organization
      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (subdomain !== undefined) updateData.subdomain = subdomain;
      if (custom_domain !== undefined) updateData.custom_domain = custom_domain;
      if (billing_email !== undefined) updateData.billing_email = billing_email;

      const { error: updateError } = await supabase
        .from('organizations')
        .update(updateData)
        .eq('id', orgId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      // Log admin action
      await supabase.from('admin_audit_log').insert({
        admin_user_id: user.id,
        action: 'update_org',
        target_type: 'organization',
        target_id: orgId,
        old_value: oldOrg,
        new_value: updateData,
      });

      return NextResponse.json({ success: true });
    }

    case 'remove_member': {
      const { member_id } = data;
      if (!member_id) {
        return NextResponse.json({ error: 'Member ID required' }, { status: 400 });
      }

      const { error: deleteError } = await supabase
        .from('organization_members')
        .delete()
        .eq('id', member_id)
        .eq('organization_id', orgId);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }

      // Log admin action
      await supabase.from('admin_audit_log').insert({
        admin_user_id: user.id,
        action: 'remove_member',
        target_type: 'organization',
        target_id: orgId,
        new_value: { member_id },
      });

      return NextResponse.json({ success: true });
    }

    case 'update_member_role': {
      const { member_id, role } = data;
      if (!member_id || !role) {
        return NextResponse.json({ error: 'Member ID and role required' }, { status: 400 });
      }

      const { error: updateError } = await supabase
        .from('organization_members')
        .update({ role })
        .eq('id', member_id)
        .eq('organization_id', orgId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      // Log admin action
      await supabase.from('admin_audit_log').insert({
        admin_user_id: user.id,
        action: 'update_member_role',
        target_type: 'organization',
        target_id: orgId,
        new_value: { member_id, role },
      });

      return NextResponse.json({ success: true });
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
