import type { DashboardConfig } from './dashboard';

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
  // Future: sheetId, tableId, syncConfig, etc.
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
  config: DashboardConfig;
  // Dashboard-level branding override (falls back to workspace branding)
  branding_override: Partial<BrandingConfig> | null;
  is_published: boolean;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
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
