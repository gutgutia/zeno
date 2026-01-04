import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/admin/organizations - List all organizations
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

  // Build query for organizations
  let query = supabase
    .from('organizations')
    .select('*', { count: 'exact' });

  // Apply search filter
  if (search) {
    query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
  }

  // Apply plan filter
  if (planType) {
    query = query.eq('plan_type', planType);
  }

  // Apply pagination and ordering
  query = query
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false });

  const { data: organizations, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get org IDs
  const orgIds = organizations?.map(o => o.id) || [];

  // Get member counts
  const { data: memberCounts } = await supabase
    .from('organization_members')
    .select('organization_id')
    .in('organization_id', orgIds);

  const memberCountMap: Record<string, number> = {};
  memberCounts?.forEach(m => {
    memberCountMap[m.organization_id] = (memberCountMap[m.organization_id] || 0) + 1;
  });

  // Get org credits
  const { data: credits } = await supabase
    .from('organization_credits')
    .select('organization_id, balance, lifetime_credits, lifetime_used')
    .in('organization_id', orgIds);

  const creditMap: Record<string, { balance: number; lifetime_credits: number; lifetime_used: number }> = {};
  credits?.forEach(c => {
    creditMap[c.organization_id] = c;
  });

  // Get dashboard counts per org
  const { data: dashboards } = await supabase
    .from('dashboards')
    .select('owner_id')
    .in('owner_id', orgIds)
    .is('deleted_at', null);

  const dashboardCountMap: Record<string, number> = {};
  dashboards?.forEach(d => {
    if (d.owner_id) {
      dashboardCountMap[d.owner_id] = (dashboardCountMap[d.owner_id] || 0) + 1;
    }
  });

  // Get overrides
  const { data: overrides } = await supabase
    .from('user_plan_overrides')
    .select('organization_id')
    .in('organization_id', orgIds)
    .eq('is_active', true);

  const overrideSet = new Set(overrides?.map(o => o.organization_id));

  // Combine data
  const orgs = (organizations || []).map(org => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    plan_type: org.plan_type,
    billing_cycle: org.billing_cycle,
    seats_purchased: org.seats_purchased,
    subdomain: org.subdomain,
    custom_domain: org.custom_domain,
    stripe_customer_id: org.stripe_customer_id,
    stripe_subscription_id: org.stripe_subscription_id,
    member_count: memberCountMap[org.id] || 0,
    credit_balance: creditMap[org.id]?.balance || 0,
    lifetime_credits: creditMap[org.id]?.lifetime_credits || 0,
    lifetime_used: creditMap[org.id]?.lifetime_used || 0,
    dashboard_count: dashboardCountMap[org.id] || 0,
    has_override: overrideSet.has(org.id),
    created_at: org.created_at,
  }));

  return NextResponse.json({
    organizations: orgs,
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  });
}
