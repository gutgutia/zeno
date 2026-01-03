-- Add soft delete support to dashboards
-- Dashboards are moved to trash when deleted, and can be restored or permanently deleted

-- Add deleted_at column
ALTER TABLE public.dashboards
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for efficient filtering of non-deleted dashboards
CREATE INDEX IF NOT EXISTS idx_dashboards_deleted_at ON public.dashboards(deleted_at);

-- Create index for listing deleted dashboards (trash view)
CREATE INDEX IF NOT EXISTS idx_dashboards_deleted_at_not_null ON public.dashboards(deleted_at)
WHERE deleted_at IS NOT NULL;

-- Update RLS policies to exclude deleted dashboards by default
-- First, drop existing select policy
DROP POLICY IF EXISTS "Users can view dashboards in their workspaces" ON public.dashboards;

-- Recreate with deleted_at filter (only show non-deleted dashboards)
CREATE POLICY "Users can view dashboards in their workspaces"
ON public.dashboards
FOR SELECT
USING (
  deleted_at IS NULL AND
  workspace_id IN (
    SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
  )
);

-- Add policy for viewing deleted dashboards (trash view)
CREATE POLICY "Users can view their deleted dashboards"
ON public.dashboards
FOR SELECT
USING (
  deleted_at IS NOT NULL AND
  workspace_id IN (
    SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
  )
);

-- Update policy allows updating deleted_at (for soft delete and restore)
DROP POLICY IF EXISTS "Users can update dashboards in their workspaces" ON public.dashboards;

CREATE POLICY "Users can update dashboards in their workspaces"
ON public.dashboards
FOR UPDATE
USING (
  workspace_id IN (
    SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
  )
)
WITH CHECK (
  workspace_id IN (
    SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
  )
);

-- Delete policy for permanent deletion
DROP POLICY IF EXISTS "Users can delete dashboards in their workspaces" ON public.dashboards;

CREATE POLICY "Users can delete dashboards in their workspaces"
ON public.dashboards
FOR DELETE
USING (
  workspace_id IN (
    SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
  )
);
