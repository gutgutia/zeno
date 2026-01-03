import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { Folder, FolderWithCount } from '@/types/database';

// GET /api/folders - List user's folders
export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    // Build query based on filters
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('folders')
      .select('*')
      .order('name', { ascending: true });

    if (organizationId) {
      // Get org folders
      query = query.eq('organization_id', organizationId);
    } else {
      // Get personal folders (owned by user, not in any org)
      query = query.eq('owner_id', user.id).is('organization_id', null);
    }

    const { data: folders, error } = await query;

    if (error) {
      console.error('Error fetching folders:', error);
      return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 });
    }

    // Get dashboard counts for each folder
    const foldersWithCounts: FolderWithCount[] = await Promise.all(
      (folders || []).map(async (folder: Folder) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { count } = await (supabase as any)
          .from('dashboards')
          .select('*', { count: 'exact', head: true })
          .eq('folder_id', folder.id)
          .is('deleted_at', null);

        return {
          ...folder,
          dashboard_count: count || 0,
        };
      })
    );

    return NextResponse.json(foldersWithCounts);
  } catch (error) {
    console.error('Folders fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/folders - Create a new folder
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
    const { name, organization_id, parent_folder_id } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // If organization_id provided, check membership
    if (organization_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: membership } = await (supabase as any)
        .from('organization_members')
        .select('role')
        .eq('organization_id', organization_id)
        .eq('user_id', user.id)
        .not('accepted_at', 'is', null)
        .single();

      if (!membership) {
        return NextResponse.json(
          { error: 'You are not a member of this organization' },
          { status: 403 }
        );
      }
    }

    // If parent_folder_id provided, validate it
    if (parent_folder_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: parentFolder } = await (supabase as any)
        .from('folders')
        .select('id, organization_id')
        .eq('id', parent_folder_id)
        .single();

      if (!parentFolder) {
        return NextResponse.json({ error: 'Parent folder not found' }, { status: 404 });
      }

      // Parent folder must be in same org (or both personal)
      if (parentFolder.organization_id !== organization_id) {
        return NextResponse.json(
          { error: 'Parent folder must be in the same organization' },
          { status: 400 }
        );
      }
    }

    // Create folder
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: folder, error: createError } = await (supabase as any)
      .from('folders')
      .insert({
        name,
        owner_id: user.id,
        organization_id: organization_id || null,
        parent_folder_id: parent_folder_id || null,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating folder:', createError);
      return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });
    }

    return NextResponse.json({
      ...folder,
      dashboard_count: 0,
    } as FolderWithCount);
  } catch (error) {
    console.error('Folder create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
