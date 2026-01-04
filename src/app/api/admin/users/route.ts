import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

// GET /api/admin/users - List all users with pagination and search
export async function GET(request: NextRequest) {
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

  // Parse query params
  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get('search') || '';
  const planType = searchParams.get('plan_type') || '';
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

  // Apply plan filter
  if (planType) {
    query = query.eq('plan_type', planType);
  }

  // Apply pagination and ordering
  query = query
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false });

  const { data: profiles, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get user credits for each profile
  const userIds = profiles?.map(p => p.id) || [];

  const { data: credits } = await supabase
    .from('user_credits')
    .select('user_id, balance, lifetime_credits, lifetime_used')
    .in('user_id', userIds);

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

  // Create credit map
  const creditMap: Record<string, { balance: number; lifetime_credits: number; lifetime_used: number }> = {};
  credits?.forEach(c => {
    creditMap[c.user_id] = c;
  });

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

  // Combine data
  const users = (profiles || []).map(profile => ({
    id: profile.id,
    email: emailMap[profile.id] || null,
    name: profile.name,
    avatar_url: profile.avatar_url,
    plan_type: profile.plan_type,
    credit_balance: creditMap[profile.id]?.balance || 0,
    lifetime_credits: creditMap[profile.id]?.lifetime_credits || 0,
    lifetime_used: creditMap[profile.id]?.lifetime_used || 0,
    dashboard_count: dashboardCountMap[profile.id] || 0,
    has_override: overrideSet.has(profile.id),
    created_at: profile.created_at,
    updated_at: profile.updated_at,
  }));

  return NextResponse.json({
    users,
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  });
}
