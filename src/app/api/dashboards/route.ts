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

// POST /api/dashboards - Create a new dashboard and trigger async generation
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      rawContent,
      data,
      dataSource,
      userInstructions,
      notifyEmail,
      // Google Sheets specific fields
      googleSheetId,
      googleSheetName,
      syncEnabled,
    } = body;

    if (!title) {
      return NextResponse.json(
        { error: 'Missing required field: title' },
        { status: 400 }
      );
    }

    if (!rawContent && !data) {
      return NextResponse.json(
        { error: 'Missing required field: rawContent or data' },
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
        console.error('Failed to create workspace:', createError);
        return NextResponse.json(
          { error: `Failed to create workspace: ${createError.message}` },
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

    // Get Google connection ID if this is a Google Sheets dashboard
    let googleConnectionId = null;
    if (googleSheetId && dataSource?.type === 'google_sheets') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: connection } = await (supabase as any)
        .from('google_connections')
        .select('id')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (connection) {
        googleConnectionId = connection.id;
      }
    }

    // Create the dashboard with pending generation status
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: dashboard, error } = await (supabase as any)
      .from('dashboards')
      .insert({
        workspace_id: workspace.id,
        title,
        slug,
        description: null,
        data_source: dataSource || { type: 'paste' },
        data: data || null,
        data_url: null,
        // config is omitted - uses database default, will be populated by generation
        is_published: false,
        published_at: null,
        // New fields for async generation
        generation_status: 'pending',
        generation_error: null,
        generation_started_at: null,
        generation_completed_at: null,
        raw_content: rawContent || null,
        user_instructions: userInstructions || null,
        notify_email: notifyEmail || false,
        created_by: user.id,
        // Google Sheets fields
        google_connection_id: googleConnectionId,
        google_sheet_id: googleSheetId || null,
        google_sheet_name: googleSheetName || null,
        sync_enabled: syncEnabled || false,
        last_synced_at: googleSheetId ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating dashboard:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Trigger async generation in the background
    // We use fetch to call our own API endpoint without waiting for it
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    fetch(`${baseUrl}/api/dashboards/${dashboard.id}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Pass the auth cookie for authentication
        'Cookie': request.headers.get('cookie') || '',
      },
      body: JSON.stringify({ async: true }),
    }).catch(err => {
      console.error('Failed to trigger async generation:', err);
    });

    return NextResponse.json({ dashboard: dashboard as Dashboard }, { status: 201 });
  } catch (error) {
    console.error('Error creating dashboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
