-- Migration 018: Auto-create organization for new users
-- Every user gets a personal organization on signup (org of one model)
-- The organization is invisible to the user - just a database construct for team/billing

-- Function to create a user's personal organization
-- Called during signup process via admin client
CREATE OR REPLACE FUNCTION create_user_organization(
  p_user_id UUID,
  p_name TEXT DEFAULT 'Personal'
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_slug TEXT;
BEGIN
  -- Generate a random slug (8 char alphanumeric)
  v_slug := 'org-' || lower(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));

  -- Create the organization
  INSERT INTO public.organizations (name, slug, created_by)
  VALUES (p_name, v_slug, p_user_id)
  RETURNING id INTO v_org_id;

  -- Note: The trigger on_organization_created will automatically
  -- add the user as owner in organization_members

  RETURN v_org_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users (though typically called via admin)
GRANT EXECUTE ON FUNCTION create_user_organization(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_organization(UUID, TEXT) TO service_role;

-- Function to get or create user's organization
-- Useful for ensuring a user always has an org
CREATE OR REPLACE FUNCTION get_or_create_user_organization(p_user_id UUID)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Check if user already has an organization (as owner)
  SELECT om.organization_id INTO v_org_id
  FROM organization_members om
  WHERE om.user_id = p_user_id AND om.role = 'owner'
  LIMIT 1;

  -- If no org exists, create one
  IF v_org_id IS NULL THEN
    v_org_id := create_user_organization(p_user_id);
  END IF;

  RETURN v_org_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_or_create_user_organization(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_user_organization(UUID) TO service_role;
