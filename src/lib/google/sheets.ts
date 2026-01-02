import { google, sheets_v4 } from 'googleapis';
import { createOAuth2Client } from './auth';

export interface SheetMetadata {
  spreadsheetId: string;
  title: string;
  sheets: SheetInfo[];
  lastModified?: string;
}

export interface SheetInfo {
  sheetId: number;
  title: string;
  rowCount: number;
  columnCount: number;
}

export interface SpreadsheetListItem {
  id: string;
  name: string;
  modifiedTime: string;
  owners?: { emailAddress: string; displayName?: string }[];
}

export interface FetchedSheetData {
  data: string; // CSV format for compatibility with existing parser
  metadata: {
    spreadsheetTitle: string;
    sheetName: string;
    rowCount: number;
    columnCount: number;
  };
}

// Create authenticated Sheets API client
function createSheetsClient(accessToken: string): sheets_v4.Sheets {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.sheets({ version: 'v4', auth: oauth2Client });
}

// Create authenticated Drive API client
function createDriveClient(accessToken: string) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.drive({ version: 'v3', auth: oauth2Client });
}

// List user's Google Sheets (from Drive)
export async function listUserSpreadsheets(
  accessToken: string,
  pageSize: number = 50
): Promise<SpreadsheetListItem[]> {
  const drive = createDriveClient(accessToken);

  const response = await drive.files.list({
    q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
    fields: 'files(id, name, modifiedTime, owners)',
    orderBy: 'modifiedTime desc',
    pageSize,
  });

  return (response.data.files || []).map((file) => ({
    id: file.id!,
    name: file.name!,
    modifiedTime: file.modifiedTime!,
    owners: file.owners?.map((o) => ({
      emailAddress: o.emailAddress!,
      displayName: o.displayName ?? undefined,
    })),
  }));
}

// Get spreadsheet metadata (list of sheets/tabs)
export async function getSpreadsheetMetadata(
  accessToken: string,
  spreadsheetId: string
): Promise<SheetMetadata> {
  const sheets = createSheetsClient(accessToken);

  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'spreadsheetId,properties.title,sheets.properties',
  });

  const spreadsheet = response.data;

  return {
    spreadsheetId: spreadsheet.spreadsheetId!,
    title: spreadsheet.properties?.title || 'Untitled',
    sheets: (spreadsheet.sheets || []).map((sheet) => ({
      sheetId: sheet.properties?.sheetId || 0,
      title: sheet.properties?.title || 'Sheet',
      rowCount: sheet.properties?.gridProperties?.rowCount || 0,
      columnCount: sheet.properties?.gridProperties?.columnCount || 0,
    })),
  };
}

// Fetch data from a specific sheet
export async function fetchSheetData(
  accessToken: string,
  spreadsheetId: string,
  sheetName?: string,
  range?: string
): Promise<FetchedSheetData> {
  const sheets = createSheetsClient(accessToken);

  // First get metadata to determine sheet name if not provided
  const metadata = await getSpreadsheetMetadata(accessToken, spreadsheetId);

  // Use first sheet if not specified
  const targetSheet = sheetName || metadata.sheets[0]?.title || 'Sheet1';

  // Build range - either use provided range or fetch entire sheet
  const fullRange = range ? `${targetSheet}!${range}` : targetSheet;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: fullRange,
    valueRenderOption: 'FORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });

  const values = response.data.values || [];

  // Convert to CSV format (compatible with existing parser)
  const csv = valuesToCSV(values);

  // Find sheet info
  const sheetInfo = metadata.sheets.find((s) => s.title === targetSheet);

  return {
    data: csv,
    metadata: {
      spreadsheetTitle: metadata.title,
      sheetName: targetSheet,
      rowCount: values.length,
      columnCount: values[0]?.length || 0,
    },
  };
}

// Fetch data from multiple sheets and combine them
export async function fetchMultipleSheets(
  accessToken: string,
  spreadsheetId: string,
  sheetNames: string[]
): Promise<{ data: string; metadata: { spreadsheetTitle: string; sheets: string[] } }> {
  const sheets = createSheetsClient(accessToken);

  // Get metadata for spreadsheet title
  const metadata = await getSpreadsheetMetadata(accessToken, spreadsheetId);

  // Fetch each sheet
  const allData: string[][] = [];
  let headers: string[] | null = null;

  for (const sheetName of sheetNames) {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: sheetName,
      valueRenderOption: 'FORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
    });

    const values = response.data.values || [];

    if (values.length === 0) continue;

    if (headers === null) {
      // First sheet - use its headers
      headers = values[0].map(String);
      allData.push(...values);
    } else {
      // Subsequent sheets - skip header row, align columns
      const sheetHeaders = values[0].map(String);

      // Map columns from this sheet to the main headers
      for (let i = 1; i < values.length; i++) {
        const row: string[] = new Array(headers.length).fill('');

        for (let j = 0; j < sheetHeaders.length; j++) {
          const headerIndex = headers.indexOf(sheetHeaders[j]);
          if (headerIndex !== -1) {
            row[headerIndex] = String(values[i][j] ?? '');
          }
        }

        allData.push(row);
      }
    }
  }

  const csv = valuesToCSV(allData);

  return {
    data: csv,
    metadata: {
      spreadsheetTitle: metadata.title,
      sheets: sheetNames,
    },
  };
}

// Convert 2D array to CSV string
function valuesToCSV(values: unknown[][]): string {
  return values
    .map((row) =>
      row
        .map((cell) => {
          const str = String(cell ?? '');
          // Escape quotes and wrap in quotes if contains comma, newline, or quote
          if (str.includes(',') || str.includes('\n') || str.includes('"')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(',')
    )
    .join('\n');
}

// Get preview of sheet data (first N rows)
export async function getSheetPreview(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  rows: number = 5
): Promise<{ headers: string[]; rows: string[][] }> {
  const sheets = createSheetsClient(accessToken);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!1:${rows + 1}`, // +1 for header
    valueRenderOption: 'FORMATTED_VALUE',
  });

  const values = response.data.values || [];

  if (values.length === 0) {
    return { headers: [], rows: [] };
  }

  return {
    headers: values[0].map(String),
    rows: values.slice(1).map((row) => row.map(String)),
  };
}

// Check if spreadsheet was modified since a given time
export async function wasSpreadsheetModified(
  accessToken: string,
  spreadsheetId: string,
  since: Date
): Promise<boolean> {
  const drive = createDriveClient(accessToken);

  const response = await drive.files.get({
    fileId: spreadsheetId,
    fields: 'modifiedTime',
  });

  const modifiedTime = response.data.modifiedTime;
  if (!modifiedTime) return true; // Assume modified if we can't tell

  return new Date(modifiedTime) > since;
}

// Compute content hash for change detection
export function computeContentHash(content: string): string {
  // Simple hash function (djb2)
  let hash = 5381;
  for (let i = 0; i < content.length; i++) {
    hash = (hash * 33) ^ content.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}
