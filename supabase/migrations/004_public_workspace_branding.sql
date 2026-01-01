-- Migration 004: Allow public access to workspace branding for published dashboards
-- This fixes the 404 error when viewing published dashboards in incognito

-- Allow public to read workspace data when that workspace has published dashboards
-- This is needed because the public dashboard page joins with workspaces to get branding
CREATE POLICY "Public can view workspace with published dashboards"
  ON public.workspaces FOR SELECT
  USING (
    id IN (
      SELECT workspace_id FROM public.dashboards WHERE is_published = true
    )
  );
