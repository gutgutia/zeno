-- Google Sheets Integration
-- Adds OAuth connection storage, dashboard sync fields, and related indexes

-- ============================================================================
-- GOOGLE CONNECTIONS TABLE
-- Stores OAuth tokens for Google account connections per workspace
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.google_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

  -- Google account info
  google_email TEXT NOT NULL,
  google_user_id TEXT, -- Google's sub claim

  -- OAuth tokens (encrypted at rest by Supabase)
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- One Google account per workspace (can reconnect with different account)
  UNIQUE(workspace_id, google_email)
);

-- Enable RLS
ALTER TABLE public.google_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only manage connections in their own workspaces
CREATE POLICY "Users can view their workspace connections"
  ON public.google_connections FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can create connections in their workspaces"
  ON public.google_connections FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their workspace connections"
  ON public.google_connections FOR UPDATE
  USING (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their workspace connections"
  ON public.google_connections FOR DELETE
  USING (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
    )
  );

-- Index for looking up connections by workspace
CREATE INDEX IF NOT EXISTS idx_google_connections_workspace
  ON public.google_connections(workspace_id);

-- Index for token refresh queries
CREATE INDEX IF NOT EXISTS idx_google_connections_expiry
  ON public.google_connections(token_expires_at)
  WHERE token_expires_at IS NOT NULL;

-- ============================================================================
-- DASHBOARD GOOGLE SHEETS FIELDS
-- Extends dashboards table for Google Sheets data source
-- ============================================================================

-- Reference to the Google connection used for this dashboard
ALTER TABLE public.dashboards
ADD COLUMN IF NOT EXISTS google_connection_id UUID REFERENCES public.google_connections(id) ON DELETE SET NULL;

-- Google Sheet identifiers
ALTER TABLE public.dashboards
ADD COLUMN IF NOT EXISTS google_sheet_id TEXT;

-- Sheet/tab name within the spreadsheet (if specific tab selected)
ALTER TABLE public.dashboards
ADD COLUMN IF NOT EXISTS google_sheet_name TEXT;

-- Cell range (e.g., "A1:Z100") - null means entire sheet
ALTER TABLE public.dashboards
ADD COLUMN IF NOT EXISTS google_sheet_range TEXT;

-- Last time data was synced from Google Sheets
ALTER TABLE public.dashboards
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Whether automatic daily sync is enabled
ALTER TABLE public.dashboards
ADD COLUMN IF NOT EXISTS sync_enabled BOOLEAN DEFAULT false NOT NULL;

-- Content hash for change detection (MD5 of raw_content)
ALTER TABLE public.dashboards
ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Index for daily sync job - find dashboards due for sync
CREATE INDEX IF NOT EXISTS idx_dashboards_sync_enabled
  ON public.dashboards(sync_enabled, last_synced_at)
  WHERE sync_enabled = true;

-- Index for finding dashboards by Google Sheet
CREATE INDEX IF NOT EXISTS idx_dashboards_google_sheet
  ON public.dashboards(google_sheet_id)
  WHERE google_sheet_id IS NOT NULL;

-- ============================================================================
-- UPDATE GENERATION STATUS CONSTRAINT
-- Add 'refreshing' status for data refresh operations
-- ============================================================================

-- Drop existing constraint
ALTER TABLE public.dashboards
DROP CONSTRAINT IF EXISTS dashboards_generation_status_check;

-- Add updated constraint with 'refreshing' status
ALTER TABLE public.dashboards
ADD CONSTRAINT dashboards_generation_status_check
CHECK (generation_status IN ('pending', 'analyzing', 'generating', 'completed', 'failed', 'refreshing'));

-- ============================================================================
-- UPDATED_AT TRIGGER FOR GOOGLE_CONNECTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_google_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER google_connections_updated_at
  BEFORE UPDATE ON public.google_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_google_connections_updated_at();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.google_connections IS 'OAuth tokens for Google account connections, scoped to workspaces';
COMMENT ON COLUMN public.google_connections.google_email IS 'Email address of the connected Google account';
COMMENT ON COLUMN public.google_connections.access_token IS 'OAuth access token (short-lived, ~1 hour)';
COMMENT ON COLUMN public.google_connections.refresh_token IS 'OAuth refresh token (long-lived, used to get new access tokens)';

COMMENT ON COLUMN public.dashboards.google_connection_id IS 'Reference to Google connection for Sheets-based dashboards';
COMMENT ON COLUMN public.dashboards.google_sheet_id IS 'Google Sheets spreadsheet ID';
COMMENT ON COLUMN public.dashboards.google_sheet_name IS 'Specific sheet/tab name within the spreadsheet';
COMMENT ON COLUMN public.dashboards.google_sheet_range IS 'Cell range to import (null = entire sheet)';
COMMENT ON COLUMN public.dashboards.last_synced_at IS 'Last successful sync from Google Sheets';
COMMENT ON COLUMN public.dashboards.sync_enabled IS 'Whether automatic daily sync is enabled';
COMMENT ON COLUMN public.dashboards.content_hash IS 'MD5 hash of raw_content for change detection';
