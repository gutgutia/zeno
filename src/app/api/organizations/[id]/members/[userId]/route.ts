import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{ id: string; userId: string }>;
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

// PATCH /api/organizations/[id]/members/[userId] - Update member role
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id, userId: targetUserId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if current user is admin or owner
    const currentRole = await getUserOrgRole(supabase, user.id, id);
    if (!currentRole || currentRole === 'member') {
      return NextResponse.json(
        { error: 'Only admins and owners can update member roles' },
        { status: 403 }
      );
    }

    // Get target user's current role
    const targetRole = await getUserOrgRole(supabase, targetUserId, id);
    if (!targetRole) {
      return NextResponse.json({ error: 'User is not a member' }, { status: 404 });
    }

    // Cannot modify owner
    if (targetRole === 'owner') {
      return NextResponse.json({ error: 'Cannot modify owner role' }, { status: 403 });
    }

    // Only owner can promote to admin
    const body = await request.json();
    const { role: newRole } = body;

    if (!['admin', 'member'].includes(newRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    if (newRole === 'admin' && currentRole !== 'owner') {
      return NextResponse.json(
        { error: 'Only the owner can promote members to admin' },
        { status: 403 }
      );
    }

    // Update the role
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('organization_members')
      .update({ role: newRole })
      .eq('organization_id', id)
      .eq('user_id', targetUserId);

    if (updateError) {
      console.error('Error updating member role:', updateError);
      return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
    }

    return NextResponse.json({ success: true, role: newRole });
  } catch (error) {
    console.error('Member update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/organizations/[id]/members/[userId] - Remove member
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id, userId: targetUserId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentRole = await getUserOrgRole(supabase, user.id, id);
    const targetRole = await getUserOrgRole(supabase, targetUserId, id);

    if (!targetRole) {
      return NextResponse.json({ error: 'User is not a member' }, { status: 404 });
    }

    // Cannot remove owner
    if (targetRole === 'owner') {
      return NextResponse.json({ error: 'Cannot remove the owner' }, { status: 403 });
    }

    // Allow self-removal (leaving org) or admin/owner removing others
    const isSelfRemoval = user.id === targetUserId;
    const isAdminOrOwner = currentRole === 'admin' || currentRole === 'owner';

    if (!isSelfRemoval && !isAdminOrOwner) {
      return NextResponse.json(
        { error: 'Only admins and owners can remove members' },
        { status: 403 }
      );
    }

    // Only owner can remove admins
    if (targetRole === 'admin' && currentRole !== 'owner' && !isSelfRemoval) {
      return NextResponse.json(
        { error: 'Only the owner can remove admins' },
        { status: 403 }
      );
    }

    // Remove the member
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase as any)
      .from('organization_members')
      .delete()
      .eq('organization_id', id)
      .eq('user_id', targetUserId);

    if (deleteError) {
      console.error('Error removing member:', deleteError);
      return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Member remove error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
