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

    // Use admin client to bypass RLS and find all shares matching user's email or domain
    const adminSupabase = createAdminClient();

    // Find all shares that match user's email or domain
    const { data: shares, error: sharesError } = await adminSupabase
      .from('dashboard_shares')
      .select('dashboard_id, share_type, share_value, created_at')
      .or(`share_value.eq.${userEmail},and(share_type.eq.domain,share_value.eq.${userDomain})`);

    if (sharesError) {
      console.error('Error fetching shares:', sharesError);
      return NextResponse.json({ error: 'Failed to fetch shares' }, { status: 500 });
    }

    if (!shares || shares.length === 0) {
      return NextResponse.json({ dashboards: [] });
    }

    // Get unique dashboard IDs
    const dashboardIds = [...new Set(shares.map(s => s.dashboard_id))];

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
        workspaces!inner (
          owner_id
        )
      `)
      .in('id', dashboardIds)
      .is('deleted_at', null) // Exclude soft-deleted dashboards
      .order('updated_at', { ascending: false });

    if (dashboardsError) {
      console.error('Error fetching dashboards:', dashboardsError);
      return NextResponse.json({ error: 'Failed to fetch dashboards' }, { status: 500 });
    }

    // Filter out dashboards owned by the user (they shouldn't appear in "shared with me")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sharedDashboards = (dashboards || [] as any[])
      .filter((d) => {
        // workspaces can be array or object depending on the Supabase client
        const workspace = Array.isArray(d.workspaces) ? d.workspaces[0] : d.workspaces;
        return workspace?.owner_id !== user.id;
      })
      .map((d) => ({
        id: d.id,
        title: d.title,
        description: d.description,
        slug: d.slug,
        is_published: d.is_published,
        updated_at: d.updated_at,
        created_at: d.created_at,
        // Find when this was shared with the user
        shared_at: shares.find(s => s.dashboard_id === d.id)?.created_at,
      }));

    return NextResponse.json({ dashboards: sharedDashboards });
  } catch (error) {
    console.error('Error in shared dashboards API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
