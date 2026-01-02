import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getValidAccessToken } from '@/lib/google/auth';
import { getSpreadsheetMetadata, getSheetPreview } from '@/lib/google/sheets';

// GET /api/google/spreadsheets/[id]/sheets - Get sheets/tabs from a spreadsheet
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: spreadsheetId } = await params;
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
    const { data: connection, error: connectionError } = await supabase
      .from('google_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'No Google account connected' },
        { status: 404 }
      );
    }

    // Get valid access token
    const accessToken = await getValidAccessToken(connection.id);

    // Get spreadsheet metadata (including list of sheets)
    const metadata = await getSpreadsheetMetadata(accessToken, spreadsheetId);

    return NextResponse.json({
      spreadsheetId: metadata.spreadsheetId,
      title: metadata.title,
      sheets: metadata.sheets.map((sheet) => ({
        name: sheet.title,
        rowCount: sheet.rowCount,
        columnCount: sheet.columnCount,
      })),
    });
  } catch (error) {
    console.error('Error getting spreadsheet sheets:', error);
    return NextResponse.json(
      { error: 'Failed to get spreadsheet sheets' },
      { status: 500 }
    );
  }
}
