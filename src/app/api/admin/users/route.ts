import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient, SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminSupabase = SupabaseClient<any, any, any>;

// GET /api/admin/users - List all users with pagination and search
export async function GET(request: NextRequest) {
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

  // Parse query params
  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get('search') || '';
  const planFilter = searchParams.get('plan_type') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;

  // Build query for profiles
  let query = supabase
    .from('profiles')
    .select('*', { count: 'exact' });

  // Apply search filter (search by name)
  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  // Apply pagination and ordering
  query = query
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false });

  const { data: profiles, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const userIds = profiles?.map(p => p.id) || [];

  // Get organization memberships with org details (plan comes from org, not profile)
  const { data: memberships } = await supabase
    .from('organization_members')
    .select('user_id, organization_id, organizations(id, plan_type)')
    .in('user_id', userIds)
    .not('accepted_at', 'is', null);

  // Map user to their best org plan
  const userPlanMap: Record<string, string> = {};
  const userOrgIdMap: Record<string, string> = {};
  const planRank: Record<string, number> = { enterprise: 4, pro: 3, starter: 2, free: 1 };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  memberships?.forEach((m: any) => {
    const org = m.organizations;
    if (org) {
      const currentPlan = userPlanMap[m.user_id];
      const newPlan = org.plan_type;
      // Pick best plan: enterprise > pro > starter > free
      if (!currentPlan || (planRank[newPlan] || 0) > (planRank[currentPlan] || 0)) {
        userPlanMap[m.user_id] = newPlan;
        userOrgIdMap[m.user_id] = m.organization_id;
      }
    }
  });

  // Get org credits for users' organizations
  const orgIds = [...new Set(Object.values(userOrgIdMap))];
  const { data: orgCredits } = await supabase
    .from('organization_credits')
    .select('organization_id, balance, lifetime_credits, lifetime_used')
    .in('organization_id', orgIds);

  const orgCreditMap: Record<string, { balance: number; lifetime_credits: number; lifetime_used: number }> = {};
  orgCredits?.forEach(c => {
    orgCreditMap[c.organization_id] = c;
  });

  // Get dashboard counts
  const { data: dashboardCounts } = await supabase
    .from('dashboards')
    .select('created_by')
    .in('created_by', userIds)
    .is('deleted_at', null);

  // Count dashboards per user
  const dashboardCountMap: Record<string, number> = {};
  dashboardCounts?.forEach(d => {
    if (d.created_by) {
      dashboardCountMap[d.created_by] = (dashboardCountMap[d.created_by] || 0) + 1;
    }
  });

  // Get overrides
  const { data: overrides } = await supabase
    .from('user_plan_overrides')
    .select('user_id')
    .in('user_id', userIds)
    .eq('is_active', true);

  const overrideSet = new Set(overrides?.map(o => o.user_id));

  // Try to get emails from auth.users using admin client
  let emailMap: Record<string, string> = {};
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseServiceKey) {
    try {
      const adminSupabase = createAdminClient(supabaseUrl, supabaseServiceKey);
      const { data: authUsers } = await adminSupabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      authUsers?.users?.forEach(u => {
        if (u.email) {
          emailMap[u.id] = u.email;
        }
      });
    } catch (e) {
      console.error('Failed to fetch auth users:', e);
    }
  }

  // Combine data - plan comes from org membership, credits from org
  let users = (profiles || []).map(profile => {
    const orgId = userOrgIdMap[profile.id];
    const orgCredit = orgId ? orgCreditMap[orgId] : null;
    return {
      id: profile.id,
      email: emailMap[profile.id] || null,
      name: profile.name,
      avatar_url: profile.avatar_url,
      plan_type: userPlanMap[profile.id] || 'free', // Derived from org, not profile
      credit_balance: orgCredit?.balance || 0,
      lifetime_credits: orgCredit?.lifetime_credits || 0,
      lifetime_used: orgCredit?.lifetime_used || 0,
      dashboard_count: dashboardCountMap[profile.id] || 0,
      has_override: overrideSet.has(profile.id),
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    };
  });

  // Apply plan filter if specified (filter after mapping since plan comes from org)
  if (planFilter) {
    users = users.filter(u => u.plan_type === planFilter);
  }

  return NextResponse.json({
    users,
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  });
}
