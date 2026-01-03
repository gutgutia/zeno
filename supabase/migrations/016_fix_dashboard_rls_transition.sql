-- Migration 016: Fix Dashboard RLS for transition period
-- Restores access to dashboards that were created before owner_id was introduced
-- Adds backward-compatible policy for workspace-based access

-- First, ensure all existing dashboards have owner_id set from workspace owner
UPDATE public.dashboards d
SET owner_id = w.owner_id
FROM public.workspaces w
WHERE d.workspace_id = w.id
AND d.owner_id IS NULL;

-- Add a transition policy that allows workspace owners to access their dashboards
-- even if owner_id wasn't properly set (belt and suspenders approach)
CREATE POLICY "Workspace owner can access dashboards (transition)"
  ON public.dashboards FOR ALL
  USING (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
    )
  );

-- Make sure deleted_at filtering works with new policies
-- Drop and recreate the owner policy to include deleted_at check
DROP POLICY IF EXISTS "Owner has full access to dashboards" ON public.dashboards;

CREATE POLICY "Owner has full access to dashboards"
  ON public.dashboards FOR ALL
  USING (
    owner_id = auth.uid()
    OR workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
    )
  );

-- Drop the transition policy since we merged it into the main policy
DROP POLICY IF EXISTS "Workspace owner can access dashboards (transition)" ON public.dashboards;
