import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/folders/[id]/transfer - Transfer folder ownership
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

    // Get folder
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: folder, error: fetchError } = await (supabase as any)
      .from('folders')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    // Only owner can transfer
    if (folder.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'Only the folder owner can transfer ownership' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { new_owner_id, include_dashboards = false } = body;

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

    // Transfer folder
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('folders')
      .update({
        owner_id: new_owner_id,
        organization_id: null, // Remove from org on transfer
        parent_folder_id: null, // Move to root
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error transferring folder:', updateError);
      return NextResponse.json({ error: 'Failed to transfer folder' }, { status: 500 });
    }

    // Optionally transfer dashboards in the folder
    if (include_dashboards) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('dashboards')
        .update({ owner_id: new_owner_id })
        .eq('folder_id', id)
        .eq('owner_id', user.id);
    }

    return NextResponse.json({
      success: true,
      message: include_dashboards
        ? 'Folder and its dashboards have been transferred'
        : 'Folder has been transferred (dashboards remain with original owner)',
    });
  } catch (error) {
    console.error('Folder transfer error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
