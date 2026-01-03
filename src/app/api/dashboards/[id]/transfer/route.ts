import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/dashboards/[id]/transfer - Transfer dashboard ownership
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

    // Get dashboard
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: dashboard, error: fetchError } = await (supabase as any)
      .from('dashboards')
      .select('id, owner_id, title')
      .eq('id', id)
      .single();

    if (fetchError || !dashboard) {
      return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 });
    }

    // Only owner can transfer
    if (dashboard.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'Only the dashboard owner can transfer ownership' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { new_owner_id } = body;

    if (!new_owner_id) {
      return NextResponse.json({ error: 'new_owner_id is required' }, { status: 400 });
    }

    // Verify new owner exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newOwner } = await (supabase as any)
      .from('profiles')
      .select('id')
      .eq('id', new_owner_id)
      .single();

    if (!newOwner) {
      return NextResponse.json({ error: 'New owner not found' }, { status: 404 });
    }

    // Transfer dashboard
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('dashboards')
      .update({
        owner_id: new_owner_id,
        folder_id: null, // Remove from folder on transfer
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error transferring dashboard:', updateError);
      return NextResponse.json({ error: 'Failed to transfer dashboard' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Dashboard "${dashboard.title}" has been transferred`,
    });
  } catch (error) {
    console.error('Dashboard transfer error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
