import { NextRequest, NextResponse } from 'next/server';

// GET /api/google/spreadsheets - DEPRECATED
// This endpoint previously listed all user's Google Sheets using drive.metadata.readonly scope.
// That scope requires CASA security assessment. We now use Google Picker with drive.file scope
// which only grants access to files the user explicitly selects.
//
// Use the GoogleSheetPicker component instead, which opens the official Google Picker UI.
export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      error: 'This endpoint is deprecated. Use Google Picker to select spreadsheets instead.',
      reason: 'The drive.metadata.readonly scope required for listing files triggers CASA security requirements. We now use drive.file scope with Google Picker for per-file access.'
    },
    { status: 410 } // 410 Gone
  );
}
