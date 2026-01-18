import type { ChartConfig } from './chart';

// Content type detection
export type ContentType = 'data' | 'text' | 'mixed';

// Generation status for async processing
export type GenerationStatus = 'pending' | 'analyzing' | 'generating' | 'refreshing' | 'completed' | 'failed';

// New dashboard config structure
export interface DashboardConfig {
  contentType: ContentType;
  html: string;
  charts: Record<string, ChartConfig>;
  analysis?: AnalysisResult;
  metadata: {
    generatedAt: string;
    analysisModel?: string;
    generationModel: string;
    userInstructions?: string;
    agentGenerated?: boolean;
    turnCount?: number;
    extendedThinking?: boolean;
    // Claude Code E2B approach flag
    claudeCodeE2B?: boolean;
    // Enhanced pipeline flag (pre-processed data + profile)
    enhancedPipeline?: boolean;
    // Refresh-related fields
    lastRefreshedAt?: string;
    refreshSummary?: string;
    // Modification-related fields
    lastModifiedAt?: string;
    modificationSummary?: string;
  };
}

// Analysis result from Haiku step
export interface AnalysisResult {
  contentType: ContentType;

  // For data content
  cleanedData?: Record<string, unknown>[];
  schema?: AnalyzedSchema;

  // For text content
  structure?: TextStructure;

  // Common
  insights: string[];
  suggestedVisualizations: string[];
  summary: string;
}

export interface AnalyzedSchema {
  columns: ColumnAnalysis[];
  rowCount: number;
  relationships: string[];
}

export interface ColumnAnalysis {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  role: 'dimension' | 'measure' | 'identifier' | 'temporal';
  distribution: Record<string, number>;
  stats?: {
    min: number;
    max: number;
    avg: number;
    sum: number;
  };
  nullCount: number;
  uniqueCount: number;
  sampleValues: unknown[];
}

export interface TextStructure {
  title?: string;
  sections: string[];
  keyPoints: string[];
  entities: string[];
}

// Generation request payload
export interface GenerationRequest {
  rawContent: string;
  contentType?: ContentType;
  userInstructions?: string;
}

// Layout config (keeping for reference, may be used later)
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

// Token estimation
export function estimateTokens(content: string): number {
  return Math.ceil(content.length / 4);
}

export const MAX_TOKENS = 200000;

export function isContentTooLarge(content: string): boolean {
  return estimateTokens(content) > MAX_TOKENS;
}
