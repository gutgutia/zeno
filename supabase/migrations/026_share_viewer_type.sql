-- Migration 026: Add viewer_type to dashboard_shares
-- Enables distinguishing between internal team members and external viewers
-- Internal: Creates full Zeno account, adds to organization
-- External: Verify-only authentication, no account created

-- Add viewer_type column
ALTER TABLE public.dashboard_shares
ADD COLUMN viewer_type VARCHAR(20) NOT NULL DEFAULT 'auto'
CHECK (viewer_type IN ('auto', 'internal', 'external'));

-- Add comment for documentation
COMMENT ON COLUMN public.dashboard_shares.viewer_type IS
'Controls authentication behavior: auto (domain-based detection), internal (create account), external (verify-only)';

-- Create table for external viewer sessions (for verify-only authentication)
CREATE TABLE public.external_viewer_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  dashboard_id UUID NOT NULL REFERENCES public.dashboards(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient token lookup
CREATE INDEX idx_external_viewer_sessions_token ON public.external_viewer_sessions(token_hash);
CREATE INDEX idx_external_viewer_sessions_email_dashboard ON public.external_viewer_sessions(email, dashboard_id);
CREATE INDEX idx_external_viewer_sessions_expires ON public.external_viewer_sessions(expires_at);

-- Enable RLS
ALTER TABLE public.external_viewer_sessions ENABLE ROW LEVEL SECURITY;

-- Only allow server-side access (no client policies)
-- Sessions are managed by the API, not directly by users

-- Function to clean up expired sessions (can be called by cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_external_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.external_viewer_sessions
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
