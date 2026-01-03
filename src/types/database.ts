import type { DashboardConfig, GenerationStatus } from './dashboard';

export interface Profile {
  id: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

// Branding configuration for workspaces (and dashboard overrides)
export interface BrandingConfig {
  // Company identity
  companyName?: string;
  logoUrl?: string;

  // Color palette (hex colors)
  colors?: {
    primary?: string;      // Main brand color
    secondary?: string;    // Supporting color
    accent?: string;       // Highlights, CTAs
    background?: string;   // Dashboard background
  };

  // Chart color palette (array of hex colors for chart series)
  chartColors?: string[];

  // Typography
  fontFamily?: 'system' | 'inter' | 'dm-sans' | 'space-grotesk';

  // Free-form AI guidance for style/tone
  styleGuide?: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  type: 'personal' | 'team';
  owner_id: string;
  branding: BrandingConfig | null;
  subdomain: string | null;       // e.g., "acme" for acme.zeno.app
  custom_domain: string | null;   // e.g., "dashboards.acme.com" for CNAME
  created_at: string;
  updated_at: string;
}

export interface DataSource {
  type: 'paste' | 'upload' | 'google_sheets' | 'airtable';
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  // For multi-sheet files (Excel, Google Sheets)
  selectedSheets?: string[];  // Sheet/tab names selected by user
  availableSheets?: string[]; // All available sheets in the file
  // Google Sheets specific
  spreadsheetId?: string;
  spreadsheetName?: string;
}

// Google OAuth connection
export interface GoogleConnection {
  id: string;
  user_id: string;
  workspace_id: string;
  google_email: string;
  google_user_id: string | null;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface Dashboard {
  id: string;
  workspace_id: string;
  title: string;
  slug: string;
  description: string | null;
  data_source: DataSource;
  data: Record<string, unknown>[] | null;
  data_url: string | null;
  config: DashboardConfig | null;
  // Dashboard-level branding override (falls back to workspace branding)
  branding_override: Partial<BrandingConfig> | null;
  is_published: boolean;
  published_at: string | null;
  // Generation status for async processing
  generation_status: GenerationStatus;
  generation_error: string | null;
  generation_started_at: string | null;
  generation_completed_at: string | null;
  // Raw content (original pasted/uploaded content)
  raw_content: string | null;
  user_instructions: string | null;
  notify_email: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Google Sheets integration
  google_connection_id: string | null;
  google_sheet_id: string | null;
  google_sheet_name: string | null;
  google_sheet_range: string | null;
  last_synced_at: string | null;
  sync_enabled: boolean;
  content_hash: string | null;
  // Versioning
  current_major_version: number;
  current_minor_version: number;
  // Soft delete
  deleted_at: string | null;
}

export interface ChatMessage {
  id: string;
  dashboard_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface DashboardShare {
  id: string;
  dashboard_id: string;
  share_type: 'domain' | 'email';
  share_value: string; // email address or domain (e.g., 'acme.com')
  created_by: string | null;
  created_at: string;
}

// Version change types
export type VersionChangeType = 'initial' | 'ai_modification' | 'data_refresh' | 'restore';

// Dashboard version snapshot
export interface DashboardVersion {
  id: string;
  dashboard_id: string;
  major_version: number;
  minor_version: number;
  change_type: VersionChangeType;
  change_summary: string | null;
  // Snapshot data
  config: DashboardConfig | null;
  raw_content: string | null;
  data: Record<string, unknown>[] | null;
  data_source: DataSource | null;
  // Metadata
  created_at: string;
  created_by: string | null;
}

// Helper to format version label
export function formatVersionLabel(major: number, minor: number): string {
  return `${major}.${minor}`;
}

// Supabase Database type (for client generation)
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id'>>;
      };
      workspaces: {
        Row: Workspace;
        Insert: Omit<Workspace, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Workspace, 'id' | 'owner_id'>>;
      };
      dashboards: {
        Row: Dashboard;
        Insert: Omit<Dashboard, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Dashboard, 'id' | 'workspace_id'>>;
      };
      chat_messages: {
        Row: ChatMessage;
        Insert: Omit<ChatMessage, 'id' | 'created_at'>;
        Update: Partial<Omit<ChatMessage, 'id' | 'dashboard_id'>>;
      };
      google_connections: {
        Row: GoogleConnection;
        Insert: Omit<GoogleConnection, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<GoogleConnection, 'id' | 'user_id' | 'workspace_id'>>;
      };
      dashboard_versions: {
        Row: DashboardVersion;
        Insert: Omit<DashboardVersion, 'id' | 'created_at'>;
        Update: Partial<Omit<DashboardVersion, 'id' | 'dashboard_id'>>;
      };
    };
  };
}

// Utility function to merge workspace branding with dashboard override
export function getMergedBranding(
  workspaceBranding: BrandingConfig | null,
  dashboardOverride: Partial<BrandingConfig> | null
): BrandingConfig {
  const base = workspaceBranding || {};
  const override = dashboardOverride || {};

  return {
    companyName: override.companyName ?? base.companyName,
    logoUrl: override.logoUrl ?? base.logoUrl,
    colors: {
      primary: override.colors?.primary ?? base.colors?.primary,
      secondary: override.colors?.secondary ?? base.colors?.secondary,
      accent: override.colors?.accent ?? base.colors?.accent,
      background: override.colors?.background ?? base.colors?.background,
    },
    chartColors: override.chartColors ?? base.chartColors,
    fontFamily: override.fontFamily ?? base.fontFamily,
    styleGuide: override.styleGuide ?? base.styleGuide,
  };
}
