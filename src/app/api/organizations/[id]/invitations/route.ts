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

// GET /api/organizations/[id]/invitations - List pending invitations
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

    // Check if user is admin or owner
    const role = await getUserOrgRole(supabase, user.id, id);
    if (!role || role === 'member') {
      return NextResponse.json(
        { error: 'Only admins and owners can view invitations' },
        { status: 403 }
      );
    }

    // Get pending invitations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: invitations, error } = await (supabase as any)
      .from('organization_invitations')
      .select(`
        id,
        email,
        role,
        expires_at,
        created_at,
        invited_by:profiles!invited_by(name)
      `)
      .eq('organization_id', id)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching invitations:', error);
      return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
    }

    return NextResponse.json(invitations || []);
  } catch (error) {
    console.error('Invitations fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/organizations/[id]/invitations - Revoke an invitation
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

    // Check if user is admin or owner
    const role = await getUserOrgRole(supabase, user.id, id);
    if (!role || role === 'member') {
      return NextResponse.json(
        { error: 'Only admins and owners can revoke invitations' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const invitationId = searchParams.get('invitationId');

    if (!invitationId) {
      return NextResponse.json({ error: 'Invitation ID is required' }, { status: 400 });
    }

    // Delete the invitation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase as any)
      .from('organization_invitations')
      .delete()
      .eq('id', invitationId)
      .eq('organization_id', id);

    if (deleteError) {
      console.error('Error revoking invitation:', deleteError);
      return NextResponse.json({ error: 'Failed to revoke invitation' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Invitation revoke error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
