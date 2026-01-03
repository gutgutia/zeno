import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// POST /api/invitations/accept - Accept an organization invitation
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Find the invitation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: invitation, error: inviteError } = await (supabase as any)
      .from('organization_invitations')
      .select(`
        *,
        organization:organizations(id, name, slug)
      `)
      .eq('token', token)
      .single();

    if (inviteError || !invitation) {
      return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 404 });
    }

    // Check if invitation is expired
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 });
    }

    // Check if user email matches invitation (case insensitive)
    if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'This invitation was sent to a different email address' },
        { status: 403 }
      );
    }

    // Check if already a member
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingMember } = await (supabase as any)
      .from('organization_members')
      .select('id')
      .eq('organization_id', invitation.organization_id)
      .eq('user_id', user.id)
      .single();

    if (existingMember) {
      // Already a member, just delete the invitation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('organization_invitations')
        .delete()
        .eq('id', invitation.id);

      return NextResponse.json({
        success: true,
        message: 'You are already a member of this organization',
        organization: invitation.organization,
      });
    }

    // Check seat availability again
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: org } = await (supabase as any)
      .from('organizations')
      .select('seats_purchased')
      .eq('id', invitation.organization_id)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: currentMembers } = await (supabase as any)
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', invitation.organization_id)
      .not('accepted_at', 'is', null);

    if (org && currentMembers >= org.seats_purchased) {
      return NextResponse.json(
        { error: 'No seats available in this organization' },
        { status: 400 }
      );
    }

    // Add user as member
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: memberError } = await (supabase as any)
      .from('organization_members')
      .insert({
        organization_id: invitation.organization_id,
        user_id: user.id,
        role: invitation.role,
        invited_by: invitation.invited_by,
        accepted_at: new Date().toISOString(),
      });

    if (memberError) {
      console.error('Error adding member:', memberError);
      return NextResponse.json({ error: 'Failed to join organization' }, { status: 500 });
    }

    // Delete the invitation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('organization_invitations')
      .delete()
      .eq('id', invitation.id);

    return NextResponse.json({
      success: true,
      message: `You have joined ${invitation.organization.name}`,
      organization: invitation.organization,
    });
  } catch (error) {
    console.error('Invitation accept error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/invitations/accept - Get invitation details (for preview before accepting)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Find the invitation (don't require auth for preview)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: invitation, error } = await (supabase as any)
      .from('organization_invitations')
      .select(`
        email,
        role,
        expires_at,
        organization:organizations(name, slug)
      `)
      .eq('token', token)
      .single();

    if (error || !invitation) {
      return NextResponse.json({ error: 'Invalid invitation' }, { status: 404 });
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 });
    }

    return NextResponse.json({
      email: invitation.email,
      role: invitation.role,
      organization: invitation.organization,
      expires_at: invitation.expires_at,
    });
  } catch (error) {
    console.error('Invitation preview error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
