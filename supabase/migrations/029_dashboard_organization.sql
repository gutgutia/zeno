-- Migration 029: Add organization_id to dashboards
-- This consolidates dashboard ownership to organizations instead of workspaces

-- Add organization_id column to dashboards
ALTER TABLE public.dashboards
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Create index for efficient org-based queries
CREATE INDEX IF NOT EXISTS idx_dashboards_organization
ON public.dashboards(organization_id)
WHERE organization_id IS NOT NULL;

-- Migrate existing dashboards to their owner's personal organization
-- This finds the organization where the dashboard owner is the org owner
UPDATE public.dashboards d
SET organization_id = (
  SELECT om.organization_id
  FROM public.organization_members om
  JOIN public.organizations o ON o.id = om.organization_id
  WHERE om.user_id = d.owner_id
    AND om.role = 'owner'
  ORDER BY o.created_at ASC
  LIMIT 1
)
WHERE d.organization_id IS NULL
  AND d.owner_id IS NOT NULL;

-- For dashboards without owner_id, try workspace owner
UPDATE public.dashboards d
SET organization_id = (
  SELECT om.organization_id
  FROM public.workspaces w
  JOIN public.organization_members om ON om.user_id = w.owner_id
  JOIN public.organizations o ON o.id = om.organization_id
  WHERE w.id = d.workspace_id
    AND om.role = 'owner'
  ORDER BY o.created_at ASC
  LIMIT 1
)
WHERE d.organization_id IS NULL
  AND d.workspace_id IS NOT NULL;

-- Add RLS policy for organization-based dashboard access
-- Members can view dashboards in their organizations
CREATE POLICY "Org members can view org dashboards"
  ON public.dashboards FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Org admins/owners can update any dashboard in their org
CREATE POLICY "Org admins can update org dashboards"
  ON public.dashboards FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Org admins/owners can delete any dashboard in their org
CREATE POLICY "Org admins can delete org dashboards"
  ON public.dashboards FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Members can create dashboards in their organizations
CREATE POLICY "Org members can create dashboards in org"
  ON public.dashboards FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Add comment for documentation
COMMENT ON COLUMN public.dashboards.organization_id IS
'The organization that owns this dashboard. Determines branding, custom domain, and billing.';
