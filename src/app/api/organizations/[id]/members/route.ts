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

// GET /api/organizations/[id]/members - List members
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

    // Get all members with their profile info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: members, error } = await (supabase as any)
      .from('organization_members')
      .select(`
        id,
        role,
        invited_at,
        accepted_at,
        user:profiles(id, name, avatar_url)
      `)
      .eq('organization_id', id)
      .not('accepted_at', 'is', null)
      .order('role', { ascending: true });

    if (error) {
      console.error('Error fetching members:', error);
      return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
    }

    // Get user emails from auth.users (requires service role, so we'll get emails differently)
    // For now, return members without email - can add email lookup later
    const membersWithEmail = await Promise.all(
      (members || []).map(async (m: { id: string; role: string; invited_at: string; accepted_at: string; user: { id: string; name: string; avatar_url: string } }) => {
        // Get email from auth metadata if available
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: authUser } = await (supabase as any).auth.admin?.getUserById(m.user.id) || {};

        return {
          id: m.id,
          user_id: m.user.id,
          name: m.user.name,
          avatar_url: m.user.avatar_url,
          email: authUser?.user?.email || null,
          role: m.role,
          invited_at: m.invited_at,
          accepted_at: m.accepted_at,
        };
      })
    );

    return NextResponse.json(membersWithEmail);
  } catch (error) {
    console.error('Members fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/organizations/[id]/members - Invite a new member
export async function POST(request: Request, { params }: RouteParams) {
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
        { error: 'Only admins and owners can invite members' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, inviteRole = 'member' } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Validate role
    if (!['admin', 'member'].includes(inviteRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Check seat availability
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: org } = await (supabase as any)
      .from('organizations')
      .select('seats_purchased')
      .eq('id', id)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: currentMembers } = await (supabase as any)
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', id)
      .not('accepted_at', 'is', null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: pendingInvites } = await (supabase as any)
      .from('organization_invitations')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', id);

    const totalSeatsUsed = (currentMembers || 0) + (pendingInvites || 0);
    if (org && totalSeatsUsed >= org.seats_purchased) {
      return NextResponse.json(
        { error: 'No seats available. Please upgrade your plan.' },
        { status: 400 }
      );
    }

    // Check if invitation already exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingInvite } = await (supabase as any)
      .from('organization_invitations')
      .select('id')
      .eq('organization_id', id)
      .eq('email', email.toLowerCase())
      .single();

    if (existingInvite) {
      return NextResponse.json({ error: 'Invitation already sent to this email' }, { status: 400 });
    }

    // Create invitation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: invitation, error: inviteError } = await (supabase as any)
      .from('organization_invitations')
      .insert({
        organization_id: id,
        email: email.toLowerCase(),
        role: inviteRole,
        invited_by: user.id,
      })
      .select()
      .single();

    if (inviteError) {
      console.error('Error creating invitation:', inviteError);
      return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
    }

    // TODO: Send invitation email with token link

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expires_at: invitation.expires_at,
      },
    });
  } catch (error) {
    console.error('Member invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
