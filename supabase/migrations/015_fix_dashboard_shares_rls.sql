-- Migration 015: Fix Dashboard Shares RLS Policy
-- The original policy queries auth.users directly which is not allowed.
-- This fixes it to use auth.jwt() to get the user's email from the JWT token.

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view shares for accessible dashboards" ON public.dashboard_shares;

-- Recreate with auth.jwt() instead of querying auth.users
CREATE POLICY "Users can view shares for accessible dashboards"
  ON public.dashboard_shares FOR SELECT
  USING (
    -- User's email matches a share
    share_value = (auth.jwt()->>'email')
    OR
    -- User's email domain matches a domain share
    (share_type = 'domain' AND share_value = split_part((auth.jwt()->>'email'), '@', 2))
  );

-- Also fix the dashboard owner policy to be more explicit
DROP POLICY IF EXISTS "Dashboard owner can manage shares" ON public.dashboard_shares;

CREATE POLICY "Dashboard owner can manage shares"
  ON public.dashboard_shares FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.dashboards d
      JOIN public.workspaces w ON d.workspace_id = w.id
      WHERE d.id = dashboard_id
      AND w.owner_id = auth.uid()
    )
  );
