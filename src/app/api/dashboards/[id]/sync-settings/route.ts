import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { Dashboard } from '@/types/database';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/dashboards/[id]/sync-settings - Get sync settings for a dashboard
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the dashboard with workspace
    const { data, error } = await supabase
      .from('dashboards')
      .select('id, sync_enabled, last_synced_at, google_connection_id, google_sheet_id, google_sheet_name, workspaces!inner(owner_id)')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 });
    }

    const dashboardData = data as {
      id: string;
      sync_enabled: boolean;
      last_synced_at: string | null;
      google_connection_id: string | null;
      google_sheet_id: string | null;
      google_sheet_name: string | null;
      workspaces: { owner_id: string };
    };

    // Check ownership
    if (dashboardData.workspaces.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      sync_enabled: dashboardData.sync_enabled,
      last_synced_at: dashboardData.last_synced_at,
      has_google_connection: Boolean(dashboardData.google_connection_id && dashboardData.google_sheet_id),
      google_sheet_name: dashboardData.google_sheet_name,
    });
  } catch (error) {
    console.error('Error fetching sync settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/dashboards/[id]/sync-settings - Update sync settings
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sync_enabled } = body;

    if (typeof sync_enabled !== 'boolean') {
      return NextResponse.json({ error: 'sync_enabled must be a boolean' }, { status: 400 });
    }

    // Get the existing dashboard
    const { data: existingData, error: fetchError } = await supabase
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

    // Check if dashboard has Google Sheets connection (required for sync)
    if (sync_enabled && !existingDashboard.google_connection_id) {
      return NextResponse.json(
        { error: 'Cannot enable sync: dashboard is not connected to Google Sheets' },
        { status: 400 }
      );
    }

    // Update sync_enabled
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updatedData, error: updateError } = await (supabase as any)
      .from('dashboards')
      .update({ sync_enabled })
      .eq('id', id)
      .select('id, sync_enabled, last_synced_at, google_sheet_name')
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      sync_enabled: updatedData.sync_enabled,
      last_synced_at: updatedData.last_synced_at,
      google_sheet_name: updatedData.google_sheet_name,
    });
  } catch (error) {
    console.error('Error updating sync settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
