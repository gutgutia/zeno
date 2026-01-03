import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { Dashboard } from '@/types/database';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// DELETE /api/dashboards/[id]/permanent - Permanently delete a dashboard
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the dashboard (including deleted ones)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingData, error: fetchError } = await (supabase as any)
      .from('dashboards')
      .select('*, workspaces!inner(owner_id)')
      .eq('id', id)
      .single();

    if (fetchError || !existingData) {
      return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 });
    }

    const existingDashboard = existingData as Dashboard & {
      workspaces: { owner_id: string };
    };

    // Check ownership
    if (existingDashboard.workspaces.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only allow permanent deletion of dashboards in trash
    if (!existingDashboard.deleted_at) {
      return NextResponse.json(
        { error: 'Dashboard must be in trash before permanent deletion. Use DELETE /api/dashboards/[id] first.' },
        { status: 400 }
      );
    }

    // Permanently delete the dashboard (versions will cascade delete)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase as any)
      .from('dashboards')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Dashboard permanently deleted',
    });
  } catch (error) {
    console.error('Error permanently deleting dashboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
