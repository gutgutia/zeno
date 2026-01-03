import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/folders/[id] - Get folder details
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

    // Get folder
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: folder, error } = await (supabase as any)
      .from('folders')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    // Check access: owner or org member
    if (folder.owner_id !== user.id) {
      if (folder.organization_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: membership } = await (supabase as any)
          .from('organization_members')
          .select('role')
          .eq('organization_id', folder.organization_id)
          .eq('user_id', user.id)
          .not('accepted_at', 'is', null)
          .single();

        if (!membership) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      } else {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Get dashboard count
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (supabase as any)
      .from('dashboards')
      .select('*', { count: 'exact', head: true })
      .eq('folder_id', id)
      .is('deleted_at', null);

    return NextResponse.json({
      ...folder,
      dashboard_count: count || 0,
    });
  } catch (error) {
    console.error('Folder fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/folders/[id] - Update folder
export async function PATCH(request: Request, { params }: RouteParams) {
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

    // Only owner can update
    if (folder.owner_id !== user.id) {
      return NextResponse.json({ error: 'Only the folder owner can update it' }, { status: 403 });
    }

    const body = await request.json();
    const allowedFields = ['name', 'parent_folder_id', 'share_settings'];
    const updateData: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Validate parent folder if changing
    if (updateData.parent_folder_id) {
      // Can't be its own parent
      if (updateData.parent_folder_id === id) {
        return NextResponse.json({ error: 'Folder cannot be its own parent' }, { status: 400 });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: parentFolder } = await (supabase as any)
        .from('folders')
        .select('id, organization_id')
        .eq('id', updateData.parent_folder_id)
        .single();

      if (!parentFolder) {
        return NextResponse.json({ error: 'Parent folder not found' }, { status: 404 });
      }

      // Must be in same org
      if (parentFolder.organization_id !== folder.organization_id) {
        return NextResponse.json(
          { error: 'Parent folder must be in the same organization' },
          { status: 400 }
        );
      }
    }

    // Update folder
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updatedFolder, error: updateError } = await (supabase as any)
      .from('folders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating folder:', updateError);
      return NextResponse.json({ error: 'Failed to update folder' }, { status: 500 });
    }

    return NextResponse.json(updatedFolder);
  } catch (error) {
    console.error('Folder update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/folders/[id] - Delete folder
export async function DELETE(request: Request, { params }: RouteParams) {
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

    // Only owner can delete
    if (folder.owner_id !== user.id) {
      return NextResponse.json({ error: 'Only the folder owner can delete it' }, { status: 403 });
    }

    // Move dashboards out of folder (set folder_id to null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('dashboards')
      .update({ folder_id: null })
      .eq('folder_id', id);

    // Delete folder (cascades to child folders)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase as any)
      .from('folders')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting folder:', deleteError);
      return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Folder delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
