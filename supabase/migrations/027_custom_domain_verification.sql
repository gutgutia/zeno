-- Migration 027: Custom Domain Verification
-- Adds domain verification status and Vercel integration fields

-- Add domain verification status to organizations
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS custom_domain_status VARCHAR(20) DEFAULT NULL
  CHECK (custom_domain_status IS NULL OR custom_domain_status IN ('pending', 'verifying', 'verified', 'failed')),
ADD COLUMN IF NOT EXISTS custom_domain_verified_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS custom_domain_error TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS vercel_domain_id TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.organizations.custom_domain_status IS
'Domain verification status: pending (awaiting DNS setup), verifying (checking DNS), verified (active), failed (DNS check failed)';
COMMENT ON COLUMN public.organizations.vercel_domain_id IS
'Vercel domain ID returned when domain is added to Vercel project';

-- Index for looking up domains by Vercel ID
CREATE INDEX IF NOT EXISTS idx_organizations_vercel_domain
ON public.organizations(vercel_domain_id)
WHERE vercel_domain_id IS NOT NULL;

-- Create table for domain verification attempts (for debugging/audit)
CREATE TABLE IF NOT EXISTS public.domain_verification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  domain VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('initiated', 'dns_check', 'vercel_add', 'success', 'failed')),
  error_message TEXT,
  dns_records JSONB, -- Store what DNS records we found during verification
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for looking up logs by organization
CREATE INDEX idx_domain_verification_log_org
ON public.domain_verification_log(organization_id);

-- Enable RLS
ALTER TABLE public.domain_verification_log ENABLE ROW LEVEL SECURITY;

-- Only org admins/owners can view their verification logs
CREATE POLICY "Admins can view domain verification logs"
  ON public.domain_verification_log FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Function to initiate domain verification
CREATE OR REPLACE FUNCTION initiate_domain_verification(
  org_uuid UUID,
  domain_name TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Update the organization with the new domain (pending status)
  UPDATE public.organizations
  SET
    custom_domain = domain_name,
    custom_domain_status = 'pending',
    custom_domain_verified_at = NULL,
    custom_domain_error = NULL,
    vercel_domain_id = NULL,
    updated_at = NOW()
  WHERE id = org_uuid
    AND id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    );

  -- Log the initiation
  INSERT INTO public.domain_verification_log (organization_id, domain, status)
  VALUES (org_uuid, domain_name, 'initiated');

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update domain verification status (called by API after DNS/Vercel checks)
CREATE OR REPLACE FUNCTION update_domain_verification_status(
  org_uuid UUID,
  new_status VARCHAR(20),
  error_msg TEXT DEFAULT NULL,
  v_domain_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.organizations
  SET
    custom_domain_status = new_status,
    custom_domain_verified_at = CASE WHEN new_status = 'verified' THEN NOW() ELSE custom_domain_verified_at END,
    custom_domain_error = error_msg,
    vercel_domain_id = COALESCE(v_domain_id, vercel_domain_id),
    updated_at = NOW()
  WHERE id = org_uuid;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove custom domain
CREATE OR REPLACE FUNCTION remove_custom_domain(org_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.organizations
  SET
    custom_domain = NULL,
    custom_domain_status = NULL,
    custom_domain_verified_at = NULL,
    custom_domain_error = NULL,
    vercel_domain_id = NULL,
    updated_at = NOW()
  WHERE id = org_uuid
    AND id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    );

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
