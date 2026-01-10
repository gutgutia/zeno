import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

// GET /api/dashboards/shared - Get dashboards shared with the current user
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = user.email?.toLowerCase();
    if (!userEmail) {
      return NextResponse.json({ dashboards: [] });
    }

    const userDomain = userEmail.split('@')[1];

    // Use admin client to bypass RLS
    const adminSupabase = createAdminClient();

    // Get user's organization memberships
    const { data: memberships } = await adminSupabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .not('accepted_at', 'is', null);

    const userOrgIds = memberships?.map(m => m.organization_id) || [];

    // Find all shares that match user's email or domain
    const { data: shares, error: sharesError } = await adminSupabase
      .from('dashboard_shares')
      .select('dashboard_id, share_type, share_value, created_at')
      .or(`share_value.eq.${userEmail},and(share_type.eq.domain,share_value.eq.${userDomain})`);

    if (sharesError) {
      console.error('Error fetching shares:', sharesError);
      return NextResponse.json({ error: 'Failed to fetch shares' }, { status: 500 });
    }

    // Get dashboard IDs from explicit shares
    const explicitShareDashboardIds = shares?.map(s => s.dashboard_id) || [];

    // Find dashboards shared with user's organizations (shared_with_org = true)
    let orgSharedDashboards: { id: string; updated_at: string }[] = [];
    if (userOrgIds.length > 0) {
      const { data: orgDashboards } = await adminSupabase
        .from('dashboards')
        .select('id, updated_at')
        .eq('shared_with_org', true)
        .in('organization_id', userOrgIds)
        .neq('owner_id', user.id) // Exclude own dashboards
        .is('deleted_at', null);

      orgSharedDashboards = orgDashboards || [];
    }

    // Combine all dashboard IDs
    const allDashboardIds = [
      ...new Set([
        ...explicitShareDashboardIds,
        ...orgSharedDashboards.map(d => d.id),
      ])
    ];

    if (allDashboardIds.length === 0) {
      return NextResponse.json({ dashboards: [] });
    }

    // Fetch dashboard details for all shared dashboards
    const { data: dashboards, error: dashboardsError } = await adminSupabase
      .from('dashboards')
      .select(`
        id,
        title,
        description,
        slug,
        is_published,
        updated_at,
        created_at,
        owner_id,
        shared_with_org,
        organization_id
      `)
      .in('id', allDashboardIds)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (dashboardsError) {
      console.error('Error fetching dashboards:', dashboardsError);
      return NextResponse.json({ error: 'Failed to fetch dashboards' }, { status: 500 });
    }

    // Filter out dashboards owned by the user and add shared_at info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sharedDashboards = (dashboards || [])
      .filter((d) => d.owner_id !== user.id)
      .map((d) => {
        // Determine when this was shared with the user
        // For org-shared dashboards, use updated_at as approximation
        const explicitShare = shares?.find(s => s.dashboard_id === d.id);
        const isOrgShared = d.shared_with_org && userOrgIds.includes(d.organization_id);

        return {
          id: d.id,
          title: d.title,
          description: d.description,
          slug: d.slug,
          is_published: d.is_published,
          updated_at: d.updated_at,
          created_at: d.created_at,
          shared_at: explicitShare?.created_at || d.updated_at,
          share_source: isOrgShared && !explicitShare ? 'organization' : 'direct',
        };
      });

    return NextResponse.json({ dashboards: sharedDashboards });
  } catch (error) {
    console.error('Error in shared dashboards API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
