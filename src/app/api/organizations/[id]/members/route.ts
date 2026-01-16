import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { sendTeamInvitationEmail } from '@/lib/email/send';

// Admin client for fetching user emails
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase env vars');
  }
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

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

    // Get all members (without join - profiles FK goes to auth.users, not profiles table)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: members, error } = await (supabase as any)
      .from('organization_members')
      .select('id, user_id, role, invited_at, accepted_at')
      .eq('organization_id', id)
      .not('accepted_at', 'is', null)
      .order('role', { ascending: true });

    if (error) {
      console.error('Error fetching members:', error);
      return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
    }

    // Fetch profile info separately for each member using admin client
    const adminClient = getSupabaseAdmin();
    const membersWithProfile = await Promise.all(
      (members || []).map(async (m: { id: string; user_id: string; role: string; invited_at: string; accepted_at: string }) => {
        // Get profile
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: profile } = await (supabase as any)
          .from('profiles')
          .select('name, avatar_url')
          .eq('id', m.user_id)
          .single();

        // Get email from auth using admin client
        const { data: authUser } = await adminClient.auth.admin.getUserById(m.user_id);

        return {
          id: m.id,
          user_id: m.user_id,
          name: profile?.name || null,
          avatar_url: profile?.avatar_url || null,
          email: authUser?.user?.email || null,
          role: m.role,
          invited_at: m.invited_at,
          accepted_at: m.accepted_at,
        };
      })
    );

    return NextResponse.json(membersWithProfile);
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

    // Get organization name and inviter profile for email
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: orgData } = await (supabase as any)
      .from('organizations')
      .select('name')
      .eq('id', id)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inviterProfile } = await (supabase as any)
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single();

    // Send invitation email
    try {
      await sendTeamInvitationEmail({
        to: email.toLowerCase(),
        organizationName: orgData?.name || 'a team',
        inviterName: inviterProfile?.name || undefined,
        inviteToken: invitation.token,
        role: inviteRole,
        expiresAt: invitation.expires_at,
      });
    } catch (emailError) {
      console.error('Error sending invitation email:', emailError);
      // Don't fail the request if email fails - invitation is still created
    }

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
