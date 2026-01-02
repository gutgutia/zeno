import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getValidAccessToken } from '@/lib/google/auth';
import { listUserSpreadsheets, getSpreadsheetMetadata } from '@/lib/google/sheets';

// GET /api/google/spreadsheets - List user's Google Sheets
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get workspace_id from query params
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspace_id is required' },
        { status: 400 }
      );
    }

    // Get Google connection for this workspace
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: connection, error: connectionError } = await (supabase as any)
      .from('google_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'No Google account connected. Please connect your Google account first.' },
        { status: 404 }
      );
    }

    // Get valid access token (refreshes if needed)
    const accessToken = await getValidAccessToken(connection.id);

    // List spreadsheets
    const spreadsheets = await listUserSpreadsheets(accessToken);

    return NextResponse.json({ spreadsheets });
  } catch (error) {
    console.error('Error listing spreadsheets:', error);
    return NextResponse.json(
      { error: 'Failed to list spreadsheets' },
      { status: 500 }
    );
  }
}
