-- Add apply_branding_to_dashboards column to organizations
-- This controls whether branding config is passed to AI during dashboard generation
-- Default: true (existing behavior)

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS apply_branding_to_dashboards boolean NOT NULL DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN organizations.apply_branding_to_dashboards IS 'Whether to apply organization branding during AI dashboard generation';
