import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { Dashboard } from '@/types/database';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/dashboards/[id]/restore - Restore a dashboard from trash
export async function POST(request: Request, { params }: RouteParams) {
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

    // Check if dashboard is actually deleted
    if (!existingDashboard.deleted_at) {
      return NextResponse.json({ error: 'Dashboard is not in trash' }, { status: 400 });
    }

    // Restore: clear deleted_at timestamp
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: restoredData, error: updateError } = await (supabase as any)
      .from('dashboards')
      .update({ deleted_at: null })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Dashboard restored',
      dashboard: restoredData as Dashboard,
    });
  } catch (error) {
    console.error('Error restoring dashboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
