import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { ParsedData, DataSchema, ColumnInfo } from '@/types/dashboard';

// Document file extensions supported (parsed server-side via document-parser.ts)
const DOCUMENT_EXTENSIONS = ['pdf', 'docx', 'doc', 'pptx', 'ppt', 'odt', 'odp', 'ods', 'rtf'];

// Check if a file extension is a document type
export function isDocumentType(extension: string): boolean {
  return DOCUMENT_EXTENSIONS.includes(extension.toLowerCase());
}

// Get list of supported document extensions for display
export function getSupportedDocumentExtensions(): string[] {
  return [...DOCUMENT_EXTENSIONS];
}

export interface ParseOptions {
  hasHeader?: boolean;
  delimiter?: string;
  selectedSheets?: string[]; // For Excel: which sheets to include
}

export interface ExcelSheetInfo {
  name: string;
  rowCount: number;
  columnCount: number;
}

// Get list of sheets from Excel file
export function getExcelSheets(buffer: ArrayBuffer): ExcelSheetInfo[] {
  try {
    const workbook = XLSX.read(buffer, { type: 'array' });

    return workbook.SheetNames.map((name) => {
      const worksheet = workbook.Sheets[name];
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

      return {
        name,
        rowCount: range.e.r - range.s.r + 1,
        columnCount: range.e.c - range.s.c + 1,
      };
    });
  } catch {
    return [];
  }
}

// Parse CSV text
export function parseCSV(text: string, options: ParseOptions = {}): ParsedData {
  const { hasHeader = true } = options;

  const result = Papa.parse(text, {
    header: hasHeader,
    skipEmptyLines: true,
    dynamicTyping: true,
    transformHeader: (header: string) => header.trim(),
  });

  const rows = result.data as Record<string, unknown>[];
  const columns = hasHeader ? (result.meta.fields || []) :
    Object.keys(rows[0] || {});

  return {
    rows,
    columns,
    errors: result.errors.map(e => ({
      type: 'parse',
      code: e.code || 'UNKNOWN',
      message: e.message,
      row: e.row,
    })),
  };
}

// Parse Excel file (supports multiple sheets)
export function parseExcel(
  buffer: ArrayBuffer,
  selectedSheets?: string[]
): ParsedData {
  try {
    const workbook = XLSX.read(buffer, { type: 'array' });

    // Determine which sheets to parse
    const sheetsToProcess = selectedSheets && selectedSheets.length > 0
      ? selectedSheets.filter((name) => workbook.SheetNames.includes(name))
      : [workbook.SheetNames[0]]; // Default to first sheet

    if (sheetsToProcess.length === 0) {
      return {
        rows: [],
        columns: [],
        errors: [{
          type: 'parse',
          code: 'NO_SHEETS',
          message: 'No valid sheets found to parse',
        }],
      };
    }

    let allRows: Record<string, unknown>[] = [];
    let columns: string[] = [];

    for (const sheetName of sheetsToProcess) {
      const worksheet = workbook.Sheets[sheetName];

      // Convert to JSON with headers
      const sheetRows = XLSX.utils.sheet_to_json(worksheet, {
        defval: null,
        raw: false,
      }) as Record<string, unknown>[];

      if (sheetRows.length === 0) continue;

      if (columns.length === 0) {
        // First sheet with data - use its columns as the base
        columns = Object.keys(sheetRows[0]);
        allRows = sheetRows;
      } else {
        // Subsequent sheets - merge rows, aligning to existing columns
        // Add any new columns from this sheet
        const sheetColumns = Object.keys(sheetRows[0]);
        const newColumns = sheetColumns.filter((col) => !columns.includes(col));
        columns = [...columns, ...newColumns];

        // Add rows from this sheet
        allRows = [...allRows, ...sheetRows];
      }
    }

    return {
      rows: allRows,
      columns,
      errors: [],
    };
  } catch (error) {
    return {
      rows: [],
      columns: [],
      errors: [{
        type: 'parse',
        code: 'EXCEL_PARSE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to parse Excel file',
      }],
    };
  }
}

// Detect if text is tab-separated or comma-separated
export function detectDelimiter(text: string): string {
  const firstLine = text.split('\n')[0];
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  return tabCount > commaCount ? '\t' : ',';
}

// Infer column types from data
function inferColumnType(values: unknown[]): ColumnInfo['type'] {
  const sampleValues = values.filter(v => v !== null && v !== undefined && v !== '');

  if (sampleValues.length === 0) return 'string';

  // Check if all values are numbers
  const numericValues = sampleValues.filter(v => {
    if (typeof v === 'number') return true;
    if (typeof v === 'string') {
      const num = parseFloat(v.replace(/[$,%]/g, ''));
      return !isNaN(num);
    }
    return false;
  });

  if (numericValues.length === sampleValues.length) {
    return 'number';
  }

  // Check if all values are booleans
  const boolValues = sampleValues.filter(v => {
    if (typeof v === 'boolean') return true;
    if (typeof v === 'string') {
      const lower = v.toLowerCase();
      return ['true', 'false', 'yes', 'no', '1', '0'].includes(lower);
    }
    return false;
  });

  if (boolValues.length === sampleValues.length) {
    return 'boolean';
  }

  // Check if values look like dates
  const dateValues = sampleValues.filter(v => {
    if (typeof v !== 'string') return false;
    const date = new Date(v);
    return !isNaN(date.getTime()) && v.match(/\d{4}|\d{1,2}[\/\-]\d{1,2}/);
  });

  if (dateValues.length > sampleValues.length * 0.8) {
    return 'date';
  }

  return 'string';
}

// Generate schema from parsed data
export function generateSchema(parsedData: ParsedData): DataSchema {
  const { rows, columns } = parsedData;

  const columnInfos: ColumnInfo[] = columns.map(col => {
    const values = rows.map(row => row[col]);
    const type = inferColumnType(values);
    const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');

    const columnInfo: ColumnInfo = {
      name: col,
      type,
      nullable: nonNullValues.length < values.length,
      sampleValues: nonNullValues.slice(0, 5),
    };

    // Add stats for numeric columns
    if (type === 'number') {
      const numericValues = nonNullValues
        .map(v => typeof v === 'number' ? v : parseFloat(String(v).replace(/[$,%]/g, '')))
        .filter(v => !isNaN(v)) as number[];

      if (numericValues.length > 0) {
        columnInfo.stats = {
          min: Math.min(...numericValues),
          max: Math.max(...numericValues),
          avg: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
        };
      }
    }

    // For string columns with few unique values, track them (for categorical detection)
    if (type === 'string') {
      const uniqueValues = [...new Set(nonNullValues.map(String))];
      if (uniqueValues.length <= 20 && uniqueValues.length < rows.length * 0.5) {
        columnInfo.uniqueValues = uniqueValues;
      }
    }

    return columnInfo;
  });

  return {
    columns: columnInfos,
    rowCount: rows.length,
    sampleRows: rows.slice(0, 5),
  };
}

// Main entry point for parsing tabular data (CSV, Excel, etc.)
// Note: Document types (PDF, DOCX, etc.) should be parsed via /api/parse endpoint
export async function parseData(
  input: string | File | ArrayBuffer,
  options: ParseOptions = {}
): Promise<{ data: ParsedData; schema: DataSchema }> {
  let parsedData: ParsedData;

  if (typeof input === 'string') {
    // Text input - CSV or TSV
    parsedData = parseCSV(input, options);
  } else if (input instanceof File) {
    const extension = input.name.split('.').pop()?.toLowerCase() || '';

    // Document types should be handled via API route
    if (isDocumentType(extension)) {
      throw new Error(`Document files (${extension}) must be parsed via /api/parse endpoint`);
    }

    // Handle tabular data files
    if (extension === 'csv' || extension === 'tsv' || extension === 'txt' || extension === 'md' || extension === 'json') {
      const text = await input.text();
      parsedData = parseCSV(text, options);
    } else if (extension === 'xlsx' || extension === 'xls') {
      const buffer = await input.arrayBuffer();
      parsedData = parseExcel(buffer, options.selectedSheets);
    } else {
      throw new Error(`Unsupported file type: ${extension}`);
    }
  } else {
    // ArrayBuffer - assume Excel
    parsedData = parseExcel(input, options.selectedSheets);
  }

  const schema = generateSchema(parsedData);
  return { data: parsedData, schema };
}

// Get available sheets from Excel file without fully parsing
export async function getFileSheets(
  file: File
): Promise<ExcelSheetInfo[] | null> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension !== 'xlsx' && extension !== 'xls') {
    return null; // Not an Excel file
  }

  const buffer = await file.arrayBuffer();
  return getExcelSheets(buffer);
}
