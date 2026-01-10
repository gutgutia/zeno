import type { DashboardConfig, GenerationStatus } from './dashboard';

export interface Profile {
  id: string;
  name: string | null;
  avatar_url: string | null;
  plan_type: 'free' | 'team' | 'enterprise';
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

// Plan limits (configurable via admin)
export interface PlanLimits {
  id: string;
  plan_type: 'free' | 'team' | 'enterprise';
  max_dashboards: number | null; // null = unlimited
  max_folders: number | null;
  max_data_rows: number | null;
  features: {
    ai_generation?: boolean;
    custom_branding?: boolean;
    priority_support?: boolean;
    shared_folders?: boolean;
    sso?: boolean;
    audit_logs?: boolean;
  };
  created_at: string;
  updated_at: string;
}

// Branding configuration for organizations (and dashboard overrides)
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

// Custom domain verification status
export type CustomDomainStatus = 'pending' | 'verifying' | 'verified' | 'failed';

// Organization (billing entity)
export interface Organization {
  id: string;
  name: string;
  slug: string;

  // Billing
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_type: 'team' | 'enterprise';
  billing_cycle: 'monthly' | 'annual';
  seats_purchased: number;
  billing_email: string | null;

  // Branding
  branding: BrandingConfig | null;
  subdomain: string | null;
  custom_domain: string | null;

  // Custom domain verification
  custom_domain_status: CustomDomainStatus | null;
  custom_domain_verified_at: string | null;
  custom_domain_error: string | null;
  vercel_domain_id: string | null;

  // White-label settings (shell/chrome, not dashboard content)
  white_label_enabled: boolean;
  favicon_url: string | null;
  email_sender_name: string | null;

  // Metadata
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type OrganizationRole = 'owner' | 'admin' | 'member';

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrganizationRole;
  invited_by: string | null;
  invited_at: string;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationInvitation {
  id: string;
  organization_id: string;
  email: string;
  role: 'admin' | 'member';
  token: string;
  invited_by: string;
  expires_at: string;
  created_at: string;
}

// Folder for organizing dashboards
export interface Folder {
  id: string;
  name: string;
  owner_id: string;
  organization_id: string | null; // null = personal folder
  parent_folder_id: string | null;
  share_settings: FolderShareSettings | null;
  created_at: string;
  updated_at: string;
}

export interface FolderShareSettings {
  shares: Array<{
    type: 'email' | 'domain';
    value: string;
  }>;
}

// Legacy: Workspace (deprecated, use Organization)
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
  workspace_id: string; // Legacy, use owner_id instead
  owner_id: string;
  folder_id: string | null;
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

export type ShareViewerType = 'auto' | 'internal' | 'external';

export interface DashboardShare {
  id: string;
  dashboard_id: string;
  share_type: 'domain' | 'email';
  share_value: string; // email address or domain (e.g., 'acme.com')
  viewer_type: ShareViewerType; // Controls auth behavior: auto (domain-based), internal (create account), external (verify-only)
  created_by: string | null;
  created_at: string;
}

export interface ExternalViewerSession {
  id: string;
  email: string;
  dashboard_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
  last_accessed_at: string;
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
      organizations: {
        Row: Organization;
        Insert: Omit<Organization, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Organization, 'id' | 'created_by'>>;
      };
      organization_members: {
        Row: OrganizationMember;
        Insert: Omit<OrganizationMember, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<OrganizationMember, 'id' | 'organization_id' | 'user_id'>>;
      };
      organization_invitations: {
        Row: OrganizationInvitation;
        Insert: Omit<OrganizationInvitation, 'id' | 'created_at' | 'token'>;
        Update: never; // Invitations are not updateable
      };
      folders: {
        Row: Folder;
        Insert: Omit<Folder, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Folder, 'id' | 'owner_id'>>;
      };
      workspaces: {
        Row: Workspace;
        Insert: Omit<Workspace, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Workspace, 'id' | 'owner_id'>>;
      };
      dashboards: {
        Row: Dashboard;
        Insert: Omit<Dashboard, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Dashboard, 'id' | 'owner_id'>>;
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
      plan_limits: {
        Row: PlanLimits;
        Insert: Omit<PlanLimits, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<PlanLimits, 'id' | 'plan_type'>>;
      };
      admin_users: {
        Row: AdminUser;
        Insert: Omit<AdminUser, 'id' | 'created_at'>;
        Update: Partial<Omit<AdminUser, 'id' | 'user_id'>>;
      };
      user_plan_overrides: {
        Row: UserPlanOverride;
        Insert: Omit<UserPlanOverride, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<UserPlanOverride, 'id'>>;
      };
      global_settings: {
        Row: GlobalSetting;
        Insert: Omit<GlobalSetting, 'updated_at'>;
        Update: Partial<Omit<GlobalSetting, 'key'>>;
      };
      admin_audit_log: {
        Row: AdminAuditLog;
        Insert: Omit<AdminAuditLog, 'id' | 'created_at'>;
        Update: never;
      };
      user_credits: {
        Row: UserCredits;
        Insert: Omit<UserCredits, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<UserCredits, 'user_id'>>;
      };
      organization_credits: {
        Row: OrganizationCredits;
        Insert: Omit<OrganizationCredits, 'updated_at'>;
        Update: Partial<Omit<OrganizationCredits, 'organization_id'>>;
      };
      credit_transactions: {
        Row: CreditTransaction;
        Insert: Omit<CreditTransaction, 'id' | 'created_at'>;
        Update: never;
      };
    };
  };
}

// Utility function to merge organization/workspace branding with dashboard override
export function getMergedBranding(
  baseBranding: BrandingConfig | null,
  dashboardOverride: Partial<BrandingConfig> | null
): BrandingConfig {
  const base = baseBranding || {};
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

// Helper type for organization with member info
export interface OrganizationWithRole extends Organization {
  role: OrganizationRole;
  member_count?: number;
}

// Helper type for folder with dashboard count
export interface FolderWithCount extends Folder {
  dashboard_count: number;
}

// ============================================
// ADMIN SYSTEM TYPES
// ============================================

export type AdminRole = 'super_admin' | 'support' | 'billing_admin';

export interface AdminUser {
  id: string;
  user_id: string;
  role: AdminRole;
  permissions: Record<string, boolean>;
  created_at: string;
  created_by: string | null;
}

export interface UserPlanOverride {
  id: string;
  user_id: string | null;
  organization_id: string | null;
  plan_type: 'free' | 'starter' | 'pro' | 'enterprise' | 'custom' | null;
  plan_expires_at: string | null;
  max_dashboards: number | null;
  max_folders: number | null;
  max_data_rows: number | null;
  monthly_credits: number | null;
  price_override_cents: number | null;
  price_reason: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
  updated_at: string;
}

export interface GlobalSetting {
  key: string;
  value: Record<string, unknown>;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface AdminAuditLog {
  id: string;
  admin_user_id: string;
  action: string;
  target_type: 'user' | 'organization' | 'settings' | 'credits';
  target_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  reason: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface UserCredits {
  user_id: string;
  balance: number;
  lifetime_credits: number;
  lifetime_used: number;
  created_at: string;
  updated_at: string;
}

export interface OrganizationCredits {
  organization_id: string;
  balance: number;
  lifetime_credits: number;
  lifetime_used: number;
  last_refill_at: string | null;
  updated_at: string;
}

export interface CreditTransaction {
  id: string;
  organization_id: string | null;
  user_id: string | null;
  amount: number;
  balance_after: number;
  transaction_type: 'signup_bonus' | 'monthly_refill' | 'credit_pack' | 'dashboard_create' | 'dashboard_update' | 'dashboard_refresh' | 'manual_adjustment' | 'refund';
  dashboard_id: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  description: string | null;
  created_by: string | null;
  created_at: string;
}

// Global settings value types
export interface PlanPricing {
  free: { monthly_cents: number; annual_cents: number };
  starter: { monthly_cents: number; annual_cents: number };
  pro: { monthly_cents: number; annual_cents: number };
  enterprise: { monthly_cents: number; annual_cents: number };
}

export interface PlanCredits {
  free: { credits_per_month: number; is_one_time: boolean };
  starter: { credits_per_month: number; is_one_time: boolean };
  pro: { credits_per_month: number; is_one_time: boolean };
  enterprise: { credits_per_month: number; is_one_time: boolean };
}
