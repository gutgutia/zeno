-- Migration 017: Fix infinite recursion in organization_members RLS policies
-- The problem: policies on organization_members reference organization_members itself
-- Solution: Use security definer functions that bypass RLS

-- Create helper function to check if user is member of an organization
CREATE OR REPLACE FUNCTION is_org_member(org_id UUID, check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id AND user_id = check_user_id
  );
END;
$$ LANGUAGE plpgsql;

-- Create helper function to check if user is admin/owner of an organization
CREATE OR REPLACE FUNCTION is_org_admin(org_id UUID, check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
    AND user_id = check_user_id
    AND role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql;

-- Create helper function to get user's organization IDs
CREATE OR REPLACE FUNCTION get_user_org_ids(check_user_id UUID DEFAULT auth.uid())
RETURNS SETOF UUID
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT organization_id FROM organization_members
  WHERE user_id = check_user_id;
END;
$$ LANGUAGE plpgsql;

-- Create helper function to get user's admin organization IDs
CREATE OR REPLACE FUNCTION get_user_admin_org_ids(check_user_id UUID DEFAULT auth.uid())
RETURNS SETOF UUID
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT organization_id FROM organization_members
  WHERE user_id = check_user_id AND role IN ('owner', 'admin');
END;
$$ LANGUAGE plpgsql;

-- Drop old recursive policies on organization_members
DROP POLICY IF EXISTS "Members can view org members" ON public.organization_members;
DROP POLICY IF EXISTS "Admins can add members" ON public.organization_members;
DROP POLICY IF EXISTS "Admins can update members" ON public.organization_members;
DROP POLICY IF EXISTS "Admins can remove members or self-remove" ON public.organization_members;

-- Recreate with security definer functions
CREATE POLICY "Members can view org members"
  ON public.organization_members FOR SELECT
  USING (is_org_member(organization_id));

CREATE POLICY "Admins can add members"
  ON public.organization_members FOR INSERT
  WITH CHECK (is_org_admin(organization_id));

CREATE POLICY "Admins can update members"
  ON public.organization_members FOR UPDATE
  USING (is_org_admin(organization_id));

CREATE POLICY "Admins can remove members or self-remove"
  ON public.organization_members FOR DELETE
  USING (
    -- Self-remove (but owner cannot leave)
    (user_id = auth.uid() AND role != 'owner')
    OR
    -- Admin removing others (not owner)
    (role != 'owner' AND is_org_admin(organization_id))
  );

-- Fix organization invitations policies too
DROP POLICY IF EXISTS "Admins can view invitations" ON public.organization_invitations;
DROP POLICY IF EXISTS "Admins can create invitations" ON public.organization_invitations;
DROP POLICY IF EXISTS "Admins can revoke invitations" ON public.organization_invitations;

CREATE POLICY "Admins can view invitations"
  ON public.organization_invitations FOR SELECT
  USING (
    is_org_admin(organization_id)
    OR
    -- Invitee can view their own invitation via JWT email
    email = (auth.jwt()->>'email')
  );

CREATE POLICY "Admins can create invitations"
  ON public.organization_invitations FOR INSERT
  WITH CHECK (is_org_admin(organization_id));

CREATE POLICY "Admins can revoke invitations"
  ON public.organization_invitations FOR DELETE
  USING (is_org_admin(organization_id));

-- Fix organizations policies that reference organization_members
DROP POLICY IF EXISTS "Members can view their organizations" ON public.organizations;
DROP POLICY IF EXISTS "Admins can update organizations" ON public.organizations;
DROP POLICY IF EXISTS "Owner can delete organization" ON public.organizations;

CREATE POLICY "Members can view their organizations"
  ON public.organizations FOR SELECT
  USING (id IN (SELECT get_user_org_ids()));

CREATE POLICY "Admins can update organizations"
  ON public.organizations FOR UPDATE
  USING (id IN (SELECT get_user_admin_org_ids()));

-- Owner-only policy for delete (uses specific role check)
CREATE OR REPLACE FUNCTION is_org_owner(org_id UUID, check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
    AND user_id = check_user_id
    AND role = 'owner'
  );
END;
$$ LANGUAGE plpgsql;

CREATE POLICY "Owner can delete organization"
  ON public.organizations FOR DELETE
  USING (is_org_owner(id));

-- Fix folders policies that reference organization_members
DROP POLICY IF EXISTS "Org members can view org folders" ON public.folders;

CREATE POLICY "Org members can view org folders"
  ON public.folders FOR SELECT
  USING (
    owner_id = auth.uid()
    OR
    (organization_id IS NOT NULL AND is_org_member(organization_id))
  );

-- Fix dashboards policy that references organization_members
DROP POLICY IF EXISTS "Org members can view dashboards in org folders" ON public.dashboards;

CREATE POLICY "Org members can view dashboards in org folders"
  ON public.dashboards FOR SELECT
  USING (
    folder_id IN (
      SELECT id FROM public.folders f
      WHERE f.organization_id IS NOT NULL AND is_org_member(f.organization_id)
    )
  );
