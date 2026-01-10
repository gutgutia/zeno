import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { NextResponse } from 'next/server';

// POST /api/invitations/accept - Accept an organization invitation
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
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Use service client for database operations to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing Supabase configuration');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabase = createServiceClient(supabaseUrl, serviceRoleKey);

    // Find the invitation
    const { data: invitation, error: inviteError } = await supabase
      .from('organization_invitations')
      .select('*')
      .eq('token', token)
      .single();

    if (inviteError || !invitation) {
      return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 404 });
    }

    // Get organization details
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name, slug, seats_purchased')
      .eq('id', invitation.organization_id)
      .single();

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
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
    const { data: existingMember } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', invitation.organization_id)
      .eq('user_id', user.id)
      .single();

    if (existingMember) {
      // Already a member, just delete the invitation
      await supabase
        .from('organization_invitations')
        .delete()
        .eq('id', invitation.id);

      return NextResponse.json({
        success: true,
        message: 'You are already a member of this organization',
        organization: { id: org.id, name: org.name, slug: org.slug },
      });
    }

    // Check seat availability
    const { count: currentMembers } = await supabase
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', invitation.organization_id)
      .not('accepted_at', 'is', null);

    if (org.seats_purchased && (currentMembers || 0) >= org.seats_purchased) {
      return NextResponse.json(
        { error: 'No seats available in this organization' },
        { status: 400 }
      );
    }

    // Add user as member
    const { error: memberError } = await supabase
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
    await supabase
      .from('organization_invitations')
      .delete()
      .eq('id', invitation.id);

    return NextResponse.json({
      success: true,
      message: `You have joined ${org.name}`,
      organization: { id: org.id, name: org.name, slug: org.slug },
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

    // Use service client to bypass RLS - invitation preview should work for unauthenticated users
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing Supabase configuration');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabase = createServiceClient(supabaseUrl, serviceRoleKey);

    // Find the invitation
    const { data: invitation, error } = await supabase
      .from('organization_invitations')
      .select('email, role, expires_at, organization_id')
      .eq('token', token)
      .single();

    if (error || !invitation) {
      return NextResponse.json({ error: 'Invalid invitation' }, { status: 404 });
    }

    // Get organization details separately
    const { data: org } = await supabase
      .from('organizations')
      .select('name, slug')
      .eq('id', invitation.organization_id)
      .single();

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 });
    }

    return NextResponse.json({
      email: invitation.email,
      role: invitation.role,
      organization: org || { name: 'Unknown', slug: '' },
      expires_at: invitation.expires_at,
    });
  } catch (error) {
    console.error('Invitation preview error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
