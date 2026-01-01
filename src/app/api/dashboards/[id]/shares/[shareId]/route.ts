import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{ id: string; shareId: string }>;
}

// DELETE /api/dashboards/[id]/shares/[shareId] - Remove a share
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id, shareId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify ownership via workspace
    const { data: dashboard } = await supabase
      .from('dashboards')
      .select('workspace_id, workspaces!inner(owner_id)')
      .eq('id', id)
      .single();

    if (!dashboard) {
      return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 });
    }

    const dashboardData = dashboard as { workspace_id: string; workspaces: { owner_id: string } };
    if (dashboardData.workspaces.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify share belongs to this dashboard
    const { data: share } = await supabase
      .from('dashboard_shares')
      .select('id')
      .eq('id', shareId)
      .eq('dashboard_id', id)
      .single();

    if (!share) {
      return NextResponse.json({ error: 'Share not found' }, { status: 404 });
    }

    // Delete share
    const { error } = await supabase
      .from('dashboard_shares')
      .delete()
      .eq('id', shareId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting share:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
