-- Add subdomain support to workspaces
-- Subdomains allow workspace-specific URLs like: acme.zeno.app

-- Add subdomain column (optional, nullable)
ALTER TABLE public.workspaces
ADD COLUMN subdomain VARCHAR(63) UNIQUE;

-- Add custom_domain for future CNAME support
ALTER TABLE public.workspaces
ADD COLUMN custom_domain VARCHAR(255) UNIQUE;

-- Index for fast subdomain lookups
CREATE INDEX idx_workspaces_subdomain ON public.workspaces(subdomain) WHERE subdomain IS NOT NULL;
CREATE INDEX idx_workspaces_custom_domain ON public.workspaces(custom_domain) WHERE custom_domain IS NOT NULL;

-- Validate subdomain format (lowercase alphanumeric with hyphens, no leading/trailing hyphens)
ALTER TABLE public.workspaces
ADD CONSTRAINT valid_subdomain CHECK (
  subdomain IS NULL OR
  subdomain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'
);

-- Reserved subdomains that cannot be claimed
-- These would conflict with app routes or are reserved for system use
CREATE TABLE public.reserved_subdomains (
  subdomain VARCHAR(63) PRIMARY KEY,
  reason VARCHAR(255)
);

INSERT INTO public.reserved_subdomains (subdomain, reason) VALUES
  ('www', 'Reserved for main site'),
  ('app', 'Reserved for application'),
  ('api', 'Reserved for API'),
  ('admin', 'Reserved for administration'),
  ('dashboard', 'Reserved - conflicts with app routes'),
  ('dashboards', 'Reserved - conflicts with app routes'),
  ('login', 'Reserved - conflicts with app routes'),
  ('signup', 'Reserved - conflicts with app routes'),
  ('settings', 'Reserved - conflicts with app routes'),
  ('help', 'Reserved for help/support'),
  ('support', 'Reserved for support'),
  ('docs', 'Reserved for documentation'),
  ('blog', 'Reserved for blog'),
  ('mail', 'Reserved for email'),
  ('email', 'Reserved for email'),
  ('ftp', 'Reserved'),
  ('cdn', 'Reserved for CDN'),
  ('assets', 'Reserved for assets'),
  ('static', 'Reserved for static files');

-- RLS for reserved_subdomains (read-only for all)
ALTER TABLE public.reserved_subdomains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reserved subdomains are readable by all"
  ON public.reserved_subdomains FOR SELECT
  USING (true);
