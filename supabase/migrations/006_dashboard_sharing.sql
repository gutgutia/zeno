-- Migration 006: Dashboard Sharing
-- Enables sharing dashboards with specific emails or email domains

CREATE TABLE public.dashboard_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID NOT NULL REFERENCES public.dashboards(id) ON DELETE CASCADE,
  share_type VARCHAR(20) NOT NULL CHECK (share_type IN ('domain', 'email')),
  share_value VARCHAR(255) NOT NULL, -- email address or domain (e.g., 'acme.com')
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate shares
  UNIQUE(dashboard_id, share_type, share_value)
);

-- Indexes
CREATE INDEX idx_dashboard_shares_dashboard ON public.dashboard_shares(dashboard_id);
CREATE INDEX idx_dashboard_shares_value ON public.dashboard_shares(share_value);

-- Enable RLS
ALTER TABLE public.dashboard_shares ENABLE ROW LEVEL SECURITY;

-- Dashboard owner can manage shares
CREATE POLICY "Dashboard owner can manage shares"
  ON public.dashboard_shares FOR ALL
  USING (
    dashboard_id IN (
      SELECT d.id FROM public.dashboards d
      JOIN public.workspaces w ON d.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

-- Users can view shares for dashboards shared with them
-- (This allows checking if they have access)
CREATE POLICY "Users can view shares for accessible dashboards"
  ON public.dashboard_shares FOR SELECT
  USING (
    -- User's email matches a share
    share_value = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR
    -- User's email domain matches a domain share
    (share_type = 'domain' AND share_value = split_part((SELECT email FROM auth.users WHERE id = auth.uid()), '@', 2))
  );
