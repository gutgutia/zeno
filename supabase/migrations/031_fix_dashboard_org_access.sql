-- Migration 030: Fix dashboard organization access
-- Remove automatic org member access, add explicit org sharing

-- ============================================
-- REMOVE AUTOMATIC ORG ACCESS POLICIES
-- ============================================

-- Drop the policy that gives all org members access to all org dashboards
DROP POLICY IF EXISTS "Org members can view org dashboards" ON public.dashboards;

-- Also drop folder-based org access which has similar issues
DROP POLICY IF EXISTS "Org members can view dashboards in org folders" ON public.dashboards;

-- ============================================
-- ADD EXPLICIT ORG SHARING COLUMN
-- ============================================

-- Add column to explicitly share dashboard with entire organization
ALTER TABLE public.dashboards
ADD COLUMN IF NOT EXISTS shared_with_org BOOLEAN DEFAULT FALSE;

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_dashboards_shared_with_org
ON public.dashboards(organization_id, shared_with_org)
WHERE shared_with_org = TRUE;

-- ============================================
-- CREATE NEW EXPLICIT SHARING POLICY
-- ============================================

-- Org members can only view dashboards that are explicitly shared with org
CREATE POLICY "Org members can view org-shared dashboards"
  ON public.dashboards FOR SELECT
  USING (
    -- Dashboard is explicitly shared with organization
    shared_with_org = TRUE
    AND organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Keep owner access policy (should already exist but ensure it's there)
-- Owner always has full access to their own dashboards
DROP POLICY IF EXISTS "Owner has full access to dashboards" ON public.dashboards;

CREATE POLICY "Owner has full access to dashboards"
  ON public.dashboards FOR ALL
  USING (
    owner_id = auth.uid()
    OR workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
    )
  );

-- ============================================
-- UPDATE ADMIN/OWNER POLICIES
-- ============================================

-- Org admins/owners can still update dashboards that are shared with org
-- (but not all dashboards in the org)
DROP POLICY IF EXISTS "Org admins can update org dashboards" ON public.dashboards;

CREATE POLICY "Org admins can update org-shared dashboards"
  ON public.dashboards FOR UPDATE
  USING (
    shared_with_org = TRUE
    AND organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Org admins/owners can delete dashboards that are shared with org
DROP POLICY IF EXISTS "Org admins can delete org dashboards" ON public.dashboards;

CREATE POLICY "Org admins can delete org-shared dashboards"
  ON public.dashboards FOR DELETE
  USING (
    shared_with_org = TRUE
    AND organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Keep insert policy - users can create dashboards in their orgs
-- The visibility is controlled by shared_with_org flag
-- (Org members can create dashboards in org policy should already exist)

-- ============================================
-- ADD COMMENT FOR DOCUMENTATION
-- ============================================

COMMENT ON COLUMN public.dashboards.shared_with_org IS
'When TRUE, all organization members can view this dashboard. When FALSE, only the owner and explicitly shared users can see it.';
