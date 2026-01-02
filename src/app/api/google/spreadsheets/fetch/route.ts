import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getValidAccessToken } from '@/lib/google/auth';
import { fetchSheetData, fetchMultipleSheets } from '@/lib/google/sheets';

// POST /api/google/spreadsheets/fetch - Fetch data from Google Sheets
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { workspace_id, spreadsheet_id, sheets } = body;

    if (!workspace_id || !spreadsheet_id) {
      return NextResponse.json(
        { error: 'workspace_id and spreadsheet_id are required' },
        { status: 400 }
      );
    }

    // Get Google connection for this workspace
    const { data: connection, error: connectionError } = await supabase
      .from('google_connections')
      .select('*')
      .eq('workspace_id', workspace_id)
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

    // Fetch data from sheets
    let result;

    if (sheets && sheets.length > 1) {
      // Multiple sheets - combine them
      result = await fetchMultipleSheets(accessToken, spreadsheet_id, sheets);
    } else {
      // Single sheet or all sheets
      const sheetName = sheets?.[0];
      const fetchResult = await fetchSheetData(accessToken, spreadsheet_id, sheetName);
      result = {
        data: fetchResult.data,
        metadata: {
          spreadsheetTitle: fetchResult.metadata.spreadsheetTitle,
          sheets: [fetchResult.metadata.sheetName],
        },
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching spreadsheet data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch spreadsheet data' },
      { status: 500 }
    );
  }
}
