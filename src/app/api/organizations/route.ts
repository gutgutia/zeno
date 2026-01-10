import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { NextResponse } from 'next/server';
import type { Organization, OrganizationWithRole } from '@/types/database';

// GET /api/organizations - List user's organizations
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Ensure user has at least one organization (auto-create personal org if needed)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: orgId } = await (supabase as any).rpc('get_or_create_user_organization', { p_user_id: user.id });

    // If an org was created/returned, assign any orphaned dashboards to it
    if (orgId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('dashboards')
        .update({ organization_id: orgId })
        .eq('owner_id', user.id)
        .is('organization_id', null);
    }

    // Get organizations where user is a member, with their role
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: memberships, error } = await (supabase as any)
      .from('organization_members')
      .select(`
        role,
        organization:organizations(*)
      `)
      .eq('user_id', user.id)
      .not('accepted_at', 'is', null);

    if (error) {
      console.error('Error fetching organizations:', error);
      return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 });
    }

    // Transform to include role and member count
    const organizations: OrganizationWithRole[] = await Promise.all(
      (memberships || []).map(async (m: { role: string; organization: Organization }) => {
        // Get member count for each org
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { count } = await (supabase as any)
          .from('organization_members')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', m.organization.id)
          .not('accepted_at', 'is', null);

        return {
          ...m.organization,
          role: m.role as OrganizationWithRole['role'],
          member_count: count || 0,
        };
      })
    );

    return NextResponse.json({ organizations });
  } catch (error) {
    console.error('Organizations fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/organizations - Create a new organization
export async function POST(request: Request) {
  try {
    // Use regular client for auth check
    const authClient = await createClient();

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, slug, billing_cycle = 'monthly' } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      );
    }

    // Validate slug format
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(slug)) {
      return NextResponse.json(
        { error: 'Slug must only contain lowercase letters, numbers, and hyphens' },
        { status: 400 }
      );
    }

    // Use service client for database operations to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing Supabase configuration');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabase = createServiceClient(supabaseUrl, serviceRoleKey);

    // Check if slug is already taken
    const { data: existingOrg } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existingOrg) {
      return NextResponse.json(
        { error: 'This slug is already taken' },
        { status: 400 }
      );
    }

    // Create the organization
    const { data: organization, error: createError } = await supabase
      .from('organizations')
      .insert({
        name,
        slug,
        billing_cycle,
        created_by: user.id,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating organization:', createError);
      return NextResponse.json(
        { error: 'Failed to create organization' },
        { status: 500 }
      );
    }

    // The trigger will automatically add the creator as owner
    // Return the organization with role info
    return NextResponse.json({
      ...organization,
      role: 'owner',
      member_count: 1,
    } as OrganizationWithRole);
  } catch (error) {
    console.error('Organization create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
