-- Add white-label settings to organizations
-- These control the shell/chrome experience (footer, page titles, emails)
-- Separate from dashboard branding which controls colors inside dashboards

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS white_label_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS favicon_url text,
ADD COLUMN IF NOT EXISTS email_sender_name text;

-- Add comment for clarity
COMMENT ON COLUMN organizations.white_label_enabled IS 'When enabled, removes Zeno branding from shared dashboard pages and emails';
COMMENT ON COLUMN organizations.favicon_url IS 'Custom favicon URL for white-labeled dashboard pages';
COMMENT ON COLUMN organizations.email_sender_name IS 'Custom sender name for emails (e.g., "Acme Analytics" instead of "Zeno")';
