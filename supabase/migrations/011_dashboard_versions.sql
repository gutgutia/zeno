-- Migration: Dashboard Versioning System
-- Enables tracking of dashboard changes with major.minor versioning

-- Create dashboard_versions table for storing snapshots
CREATE TABLE IF NOT EXISTS public.dashboard_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID NOT NULL REFERENCES public.dashboards(id) ON DELETE CASCADE,

  -- Version info (major.minor format)
  major_version INTEGER NOT NULL DEFAULT 1,
  minor_version INTEGER NOT NULL DEFAULT 0,

  -- Change metadata
  change_type VARCHAR(20) NOT NULL CHECK (change_type IN ('initial', 'ai_modification', 'data_refresh', 'restore')),
  change_summary TEXT, -- Auto-generated description of changes

  -- Full snapshot of dashboard state at this version
  config JSONB, -- DashboardConfig (HTML, charts, metadata)
  raw_content TEXT, -- Raw data content
  data JSONB, -- Parsed data
  data_source JSONB, -- DataSource info

  -- Timestamps and ownership
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Ensure unique versions per dashboard
  UNIQUE(dashboard_id, major_version, minor_version)
);

-- Add current version tracking to dashboards table
ALTER TABLE public.dashboards
  ADD COLUMN IF NOT EXISTS current_major_version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS current_minor_version INTEGER DEFAULT 0;

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_dashboard_versions_dashboard_id
  ON public.dashboard_versions(dashboard_id);

CREATE INDEX IF NOT EXISTS idx_dashboard_versions_created_at
  ON public.dashboard_versions(dashboard_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dashboard_versions_version
  ON public.dashboard_versions(dashboard_id, major_version DESC, minor_version DESC);

-- RLS Policies for dashboard_versions

-- Enable RLS
ALTER TABLE public.dashboard_versions ENABLE ROW LEVEL SECURITY;

-- Users can view versions of dashboards they own
CREATE POLICY "Users can view their dashboard versions"
  ON public.dashboard_versions FOR SELECT
  TO authenticated
  USING (
    dashboard_id IN (
      SELECT d.id FROM public.dashboards d
      JOIN public.workspaces w ON d.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

-- Users can create versions for dashboards they own
CREATE POLICY "Users can create versions for their dashboards"
  ON public.dashboard_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    dashboard_id IN (
      SELECT d.id FROM public.dashboards d
      JOIN public.workspaces w ON d.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

-- Users can delete versions of dashboards they own (for future pruning)
CREATE POLICY "Users can delete their dashboard versions"
  ON public.dashboard_versions FOR DELETE
  TO authenticated
  USING (
    dashboard_id IN (
      SELECT d.id FROM public.dashboards d
      JOIN public.workspaces w ON d.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

-- Add comment for documentation
COMMENT ON TABLE public.dashboard_versions IS 'Stores versioned snapshots of dashboards. Major versions increment on data refresh, minor versions on AI modifications.';
COMMENT ON COLUMN public.dashboard_versions.change_type IS 'Type of change: initial (first generation), ai_modification (chat edits), data_refresh (new data), restore (restored from previous version)';
