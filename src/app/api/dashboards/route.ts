import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import type { Dashboard, Workspace } from '@/types/database';

// GET /api/dashboards - List all dashboards for the current user
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's personal workspace
    const { data: workspaceData, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('owner_id', user.id)
      .eq('type', 'personal')
      .single();

    if (workspaceError || !workspaceData) {
      return NextResponse.json({ dashboards: [] });
    }

    const workspace = workspaceData as unknown as Workspace;

    // Get dashboards
    const { data, error } = await supabase
      .from('dashboards')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('updated_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ dashboards: data as Dashboard[] });
  } catch (error) {
    console.error('Error fetching dashboards:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/dashboards - Create a new dashboard
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, data, dataSource, config } = body;

    if (!title || !data || !dataSource) {
      return NextResponse.json(
        { error: 'Missing required fields: title, data, dataSource' },
        { status: 400 }
      );
    }

    // Get or create user's personal workspace
    let { data: workspaceData } = await supabase
      .from('workspaces')
      .select('id')
      .eq('owner_id', user.id)
      .eq('type', 'personal')
      .single();

    // Create personal workspace if it doesn't exist
    if (!workspaceData) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newWorkspace, error: createError } = await (supabase as any)
        .from('workspaces')
        .insert({
          name: 'Personal',
          slug: `personal-${nanoid(8)}`,
          type: 'personal',
          owner_id: user.id,
        })
        .select()
        .single();

      if (createError) {
        return NextResponse.json(
          { error: 'Failed to create workspace' },
          { status: 500 }
        );
      }
      workspaceData = newWorkspace;
    }

    const workspace = workspaceData as unknown as Workspace;

    // Generate slug from title
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
    const slug = `${baseSlug}-${nanoid(6)}`;

    // Create the dashboard
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: dashboard, error } = await (supabase as any)
      .from('dashboards')
      .insert({
        workspace_id: workspace.id,
        title,
        slug,
        description: null,
        data_source: dataSource,
        data,
        data_url: null,
        config: config || { charts: [] },
        is_published: false,
        published_at: null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating dashboard:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ dashboard: dashboard as Dashboard }, { status: 201 });
  } catch (error) {
    console.error('Error creating dashboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
