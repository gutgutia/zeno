import type { ChartConfig } from './chart';

export interface DashboardConfig {
  title?: string;
  description?: string;
  charts: ChartConfig[];
  layout?: LayoutConfig;
  theme?: ThemeConfig;
}

export interface LayoutConfig {
  columns?: number;
  gap?: number;
}

export interface ThemeConfig {
  primaryColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
}

// Data parsing types
export interface ParsedData {
  rows: Record<string, unknown>[];
  columns: string[];
  errors: ParseError[];
}

export interface ParseError {
  type: string;
  code: string;
  message: string;
  row?: number;
}

export interface DataSchema {
  columns: ColumnInfo[];
  rowCount: number;
  sampleRows: Record<string, unknown>[];
}

export interface ColumnInfo {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  nullable: boolean;
  uniqueValues?: (string | number)[];
  stats?: {
    min?: number;
    max?: number;
    avg?: number;
  };
  sampleValues: unknown[];
}
