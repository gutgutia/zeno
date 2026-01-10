import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper to check user's role in organization
async function getUserOrgRole(supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never, userId: string, orgId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('organization_members')
    .select('role')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .not('accepted_at', 'is', null)
    .single();

  return data?.role as 'owner' | 'admin' | 'member' | null;
}

// GET /api/organizations/[id] - Get organization details
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is a member
    const role = await getUserOrgRole(supabase, user.id, id);
    if (!role) {
      return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    // Get organization details
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: organization, error } = await (supabase as any)
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Get member count
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (supabase as any)
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', id)
      .not('accepted_at', 'is', null);

    return NextResponse.json({
      ...organization,
      role,
      member_count: count || 0,
    });
  } catch (error) {
    console.error('Organization fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/organizations/[id] - Update organization
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin or owner
    const role = await getUserOrgRole(supabase, user.id, id);
    if (!role || role === 'member') {
      return NextResponse.json(
        { error: 'Only admins and owners can update organization settings' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const allowedFields = [
      'name',
      'branding',
      'subdomain',
      'custom_domain',
      'billing_email',
      // White-label settings
      'white_label_enabled',
      'favicon_url',
      'email_sender_name',
    ];
    const updateData: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // If updating subdomain, validate it
    if (updateData.subdomain) {
      const subdomainRegex = /^[a-z0-9-]+$/;
      if (!subdomainRegex.test(updateData.subdomain as string)) {
        return NextResponse.json(
          { error: 'Subdomain must only contain lowercase letters, numbers, and hyphens' },
          { status: 400 }
        );
      }

      // Check if subdomain is taken
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabase as any)
        .from('organizations')
        .select('id')
        .eq('subdomain', updateData.subdomain)
        .neq('id', id)
        .single();

      if (existing) {
        return NextResponse.json({ error: 'Subdomain is already taken' }, { status: 400 });
      }
    }

    // Update organization
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: organization, error } = await (supabase as any)
      .from('organizations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating organization:', error);
      return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 });
    }

    return NextResponse.json(organization);
  } catch (error) {
    console.error('Organization update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/organizations/[id] - Delete organization
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only owner can delete
    const role = await getUserOrgRole(supabase, user.id, id);
    if (role !== 'owner') {
      return NextResponse.json(
        { error: 'Only the owner can delete the organization' },
        { status: 403 }
      );
    }

    // Delete organization (cascades to members, invitations)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('organizations')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting organization:', error);
      return NextResponse.json({ error: 'Failed to delete organization' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Organization delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
