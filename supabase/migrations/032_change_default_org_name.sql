-- Migration 032: Change default organization name from 'Personal' to 'Default'
-- This makes it clearer that it's a default workspace, not specifically a personal one

-- Update the create_user_organization function with new default name
CREATE OR REPLACE FUNCTION create_user_organization(
  p_user_id UUID,
  p_name TEXT DEFAULT 'Default'
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

-- Ensure permissions are still granted
GRANT EXECUTE ON FUNCTION create_user_organization(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_organization(UUID, TEXT) TO service_role;
