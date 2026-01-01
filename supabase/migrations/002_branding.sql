-- Migration 002: Workspace Branding
-- Adds branding configuration to workspaces and dashboard-level overrides

-- ============================================
-- ADD BRANDING TO WORKSPACES
-- ============================================

ALTER TABLE public.workspaces
ADD COLUMN IF NOT EXISTS branding JSONB DEFAULT NULL;

-- Comment explaining the branding structure
COMMENT ON COLUMN public.workspaces.branding IS 'Workspace branding configuration: {
  companyName?: string,
  logoUrl?: string,
  colors?: { primary?, secondary?, accent?, background? },
  chartColors?: string[],
  fontFamily?: "system" | "inter" | "dm-sans" | "space-grotesk",
  styleGuide?: string (free-form AI guidance)
}';

-- ============================================
-- ADD BRANDING OVERRIDE TO DASHBOARDS
-- ============================================

ALTER TABLE public.dashboards
ADD COLUMN IF NOT EXISTS branding_override JSONB DEFAULT NULL;

-- Comment explaining the override structure
COMMENT ON COLUMN public.dashboards.branding_override IS 'Dashboard-level branding override. Same structure as workspace branding. Fields here override workspace defaults.';

-- ============================================
-- INDEXES FOR BRANDING QUERIES
-- ============================================

-- Index for finding workspaces with branding configured
CREATE INDEX IF NOT EXISTS idx_workspaces_has_branding
ON public.workspaces ((branding IS NOT NULL))
WHERE branding IS NOT NULL;

-- ============================================
-- VALIDATION FUNCTION (optional, for data integrity)
-- ============================================

-- Function to validate hex color format
CREATE OR REPLACE FUNCTION is_valid_hex_color(color TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN color ~ '^#[0-9A-Fa-f]{6}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- EXAMPLE: Set branding for a workspace
-- ============================================
/*
UPDATE public.workspaces
SET branding = '{
  "companyName": "Acme Corp",
  "logoUrl": "https://example.com/logo.png",
  "colors": {
    "primary": "#2563EB",
    "secondary": "#10B981",
    "accent": "#F59E0B"
  },
  "chartColors": ["#2563EB", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"],
  "fontFamily": "inter",
  "styleGuide": "We are a friendly fintech startup. Use casual language in chart titles. Prefer rounded visuals and vibrant colors."
}'::jsonb
WHERE id = 'your-workspace-id';
*/
