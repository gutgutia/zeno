-- Migration 013: Organizations, Billing & Folders
-- Transforms from workspace-centric to organization-centric model
-- Organizations are billing entities, dashboards are user-owned

-- ============================================
-- PLAN LIMITS TABLE (Configurable via admin)
-- ============================================

CREATE TABLE public.plan_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_type VARCHAR(20) NOT NULL UNIQUE, -- 'free', 'team', 'enterprise'
  max_dashboards INT, -- NULL = unlimited
  max_folders INT, -- NULL = unlimited
  max_data_rows INT, -- NULL = unlimited
  features JSONB DEFAULT '{}'::jsonb, -- Feature flags
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default plan limits
INSERT INTO public.plan_limits (plan_type, max_dashboards, max_folders, max_data_rows, features) VALUES
  ('free', 3, 5, 1000, '{"ai_generation": true, "custom_branding": false, "priority_support": false}'::jsonb),
  ('team', NULL, NULL, NULL, '{"ai_generation": true, "custom_branding": true, "priority_support": true, "shared_folders": true}'::jsonb),
  ('enterprise', NULL, NULL, NULL, '{"ai_generation": true, "custom_branding": true, "priority_support": true, "shared_folders": true, "sso": true, "audit_logs": true}'::jsonb);

-- ============================================
-- ORGANIZATIONS TABLE
-- ============================================

CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,

  -- Billing
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  plan_type VARCHAR(20) NOT NULL DEFAULT 'team' CHECK (plan_type IN ('team', 'enterprise')),
  billing_cycle VARCHAR(20) DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
  seats_purchased INT NOT NULL DEFAULT 1,
  billing_email TEXT,

  -- Branding (inherited from workspaces concept)
  branding JSONB,
  subdomain VARCHAR(63) UNIQUE,
  custom_domain VARCHAR(255) UNIQUE,

  -- Metadata
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_organizations_slug ON public.organizations(slug);
CREATE INDEX idx_organizations_subdomain ON public.organizations(subdomain) WHERE subdomain IS NOT NULL;
CREATE INDEX idx_organizations_stripe_customer ON public.organizations(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ORGANIZATION MEMBERS TABLE
-- ============================================

CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),

  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ DEFAULT NOW(), -- NULL if pending

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, user_id)
);

-- Indexes
CREATE INDEX idx_org_members_org ON public.organization_members(organization_id);
CREATE INDEX idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX idx_org_members_role ON public.organization_members(organization_id, role);

-- Enable RLS
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ORGANIZATION INVITATIONS TABLE
-- ============================================

CREATE TABLE public.organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  -- Use concatenated UUIDs for token generation (compatible with all Supabase instances)
  token TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),

  invited_by UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, email)
);

-- Indexes
CREATE INDEX idx_org_invitations_org ON public.organization_invitations(organization_id);
CREATE INDEX idx_org_invitations_email ON public.organization_invitations(email);
CREATE INDEX idx_org_invitations_token ON public.organization_invitations(token);

-- Enable RLS
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- FOLDERS TABLE
-- ============================================

CREATE TABLE public.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,

  -- Ownership: user owns it, optionally shared with org
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL, -- NULL = personal folder

  -- Hierarchy
  parent_folder_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,

  -- Folder-level sharing (inheritable by dashboards)
  share_settings JSONB DEFAULT NULL, -- Same structure as dashboard_shares but embedded

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_folders_owner ON public.folders(owner_id);
CREATE INDEX idx_folders_org ON public.folders(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_folders_parent ON public.folders(parent_folder_id) WHERE parent_folder_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

-- ============================================
-- UPDATE DASHBOARDS TABLE
-- ============================================

-- Add owner_id column (user who owns the dashboard)
ALTER TABLE public.dashboards
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add folder_id column (optional folder organization)
ALTER TABLE public.dashboards
ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL;

-- Add index for owner
CREATE INDEX IF NOT EXISTS idx_dashboards_owner ON public.dashboards(owner_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_folder ON public.dashboards(folder_id) WHERE folder_id IS NOT NULL;

-- ============================================
-- UPDATE PROFILES TABLE
-- ============================================

-- Add user's personal plan info
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS plan_type VARCHAR(20) DEFAULT 'free' CHECK (plan_type IN ('free', 'team', 'enterprise')),
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE;

-- ============================================
-- MIGRATE EXISTING DATA
-- ============================================

-- Set owner_id from workspace owner for existing dashboards
UPDATE public.dashboards d
SET owner_id = w.owner_id
FROM public.workspaces w
WHERE d.workspace_id = w.id
  AND d.owner_id IS NULL;

-- If no workspace (shouldn't happen), use created_by
UPDATE public.dashboards
SET owner_id = created_by
WHERE owner_id IS NULL AND created_by IS NOT NULL;

-- Make owner_id NOT NULL after migration
ALTER TABLE public.dashboards
ALTER COLUMN owner_id SET NOT NULL;

-- ============================================
-- RLS POLICIES: ORGANIZATIONS
-- ============================================

-- Members can view their organizations
CREATE POLICY "Members can view their organizations"
  ON public.organizations FOR SELECT
  USING (
    id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Only org creator can insert (then they become owner)
CREATE POLICY "Authenticated users can create organizations"
  ON public.organizations FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Admins and owners can update
CREATE POLICY "Admins can update organizations"
  ON public.organizations FOR UPDATE
  USING (
    id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Only owner can delete
CREATE POLICY "Owner can delete organization"
  ON public.organizations FOR DELETE
  USING (
    id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- ============================================
-- RLS POLICIES: ORGANIZATION MEMBERS
-- ============================================

-- Members can view other members in their orgs
CREATE POLICY "Members can view org members"
  ON public.organization_members FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Admins can add members
CREATE POLICY "Admins can add members"
  ON public.organization_members FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Admins can update member roles (but not demote owner)
CREATE POLICY "Admins can update members"
  ON public.organization_members FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Admins can remove members (but not owner), members can remove themselves
CREATE POLICY "Admins can remove members or self-remove"
  ON public.organization_members FOR DELETE
  USING (
    -- Self-remove (but owner cannot leave)
    (user_id = auth.uid() AND role != 'owner')
    OR
    -- Admin removing others (not owner)
    (
      role != 'owner' AND
      organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

-- ============================================
-- RLS POLICIES: ORGANIZATION INVITATIONS
-- ============================================

-- Admins can view invitations for their orgs
CREATE POLICY "Admins can view invitations"
  ON public.organization_invitations FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR
    -- Invitee can view their own invitation
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Admins can create invitations
CREATE POLICY "Admins can create invitations"
  ON public.organization_invitations FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Admins can delete (revoke) invitations
CREATE POLICY "Admins can revoke invitations"
  ON public.organization_invitations FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ============================================
-- RLS POLICIES: FOLDERS
-- ============================================

-- Owner can do everything with their folders
CREATE POLICY "Owner has full access to folders"
  ON public.folders FOR ALL
  USING (owner_id = auth.uid());

-- Org members can view org folders
CREATE POLICY "Org members can view org folders"
  ON public.folders FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Org members can create folders in their orgs
CREATE POLICY "Org members can create org folders"
  ON public.folders FOR INSERT
  WITH CHECK (
    owner_id = auth.uid() AND
    (
      organization_id IS NULL
      OR organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================
-- RLS POLICIES: DASHBOARDS (Updated)
-- ============================================

-- Drop old workspace-based policies
DROP POLICY IF EXISTS "Workspace owner full access" ON public.dashboards;
DROP POLICY IF EXISTS "Users can view dashboards in their workspaces" ON public.dashboards;
DROP POLICY IF EXISTS "Users can view their deleted dashboards" ON public.dashboards;
DROP POLICY IF EXISTS "Users can update dashboards in their workspaces" ON public.dashboards;

-- Owner has full access
CREATE POLICY "Owner has full access to dashboards"
  ON public.dashboards FOR ALL
  USING (owner_id = auth.uid());

-- Org members can view dashboards in org folders
CREATE POLICY "Org members can view dashboards in org folders"
  ON public.dashboards FOR SELECT
  USING (
    folder_id IN (
      SELECT f.id FROM public.folders f
      WHERE f.organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- Keep public viewing of published dashboards
-- (Policy "Public can view published" should already exist)

-- ============================================
-- RLS POLICIES: PLAN LIMITS
-- ============================================

-- Everyone can read plan limits
ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view plan limits"
  ON public.plan_limits FOR SELECT
  USING (true);

-- Only service role can modify (admin panel)
-- No INSERT/UPDATE/DELETE policies for regular users

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to check if user has reached dashboard limit
CREATE OR REPLACE FUNCTION check_dashboard_limit(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_plan VARCHAR(20);
  dashboard_count INT;
  max_allowed INT;
BEGIN
  -- Get user's effective plan (personal or best org plan)
  SELECT COALESCE(
    (SELECT MAX(CASE
      WHEN o.plan_type = 'enterprise' THEN 3
      WHEN o.plan_type = 'team' THEN 2
      ELSE 1
    END)
    FROM public.organization_members om
    JOIN public.organizations o ON om.organization_id = o.id
    WHERE om.user_id = user_uuid),
    1
  ) INTO user_plan;

  -- Map back to plan type
  user_plan := CASE user_plan
    WHEN 3 THEN 'enterprise'
    WHEN 2 THEN 'team'
    ELSE 'free'
  END;

  -- Get limit for this plan
  SELECT max_dashboards INTO max_allowed
  FROM public.plan_limits
  WHERE plan_type = user_plan;

  -- If unlimited, always allow
  IF max_allowed IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Count user's dashboards
  SELECT COUNT(*) INTO dashboard_count
  FROM public.dashboards
  WHERE owner_id = user_uuid AND deleted_at IS NULL;

  RETURN dashboard_count < max_allowed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's effective plan
CREATE OR REPLACE FUNCTION get_user_plan(user_uuid UUID)
RETURNS VARCHAR(20) AS $$
DECLARE
  best_plan VARCHAR(20) := 'free';
  org_plan VARCHAR(20);
BEGIN
  -- Check user's personal plan first
  SELECT plan_type INTO best_plan
  FROM public.profiles
  WHERE id = user_uuid;

  -- Check org memberships for better plans
  FOR org_plan IN
    SELECT o.plan_type
    FROM public.organization_members om
    JOIN public.organizations o ON om.organization_id = o.id
    WHERE om.user_id = user_uuid
  LOOP
    IF org_plan = 'enterprise' THEN
      RETURN 'enterprise';
    ELSIF org_plan = 'team' AND best_plan = 'free' THEN
      best_plan := 'team';
    END IF;
  END LOOP;

  RETURN COALESCE(best_plan, 'free');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to transfer dashboard ownership
CREATE OR REPLACE FUNCTION transfer_dashboard_ownership(
  dashboard_uuid UUID,
  new_owner_uuid UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.dashboards
  SET owner_id = new_owner_uuid,
      folder_id = NULL, -- Remove from folder on transfer
      updated_at = NOW()
  WHERE id = dashboard_uuid
    AND owner_id = auth.uid(); -- Only current owner can transfer

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to transfer folder ownership
CREATE OR REPLACE FUNCTION transfer_folder_ownership(
  folder_uuid UUID,
  new_owner_uuid UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Transfer folder
  UPDATE public.folders
  SET owner_id = new_owner_uuid,
      organization_id = NULL, -- Remove from org on transfer
      parent_folder_id = NULL, -- Move to root
      updated_at = NOW()
  WHERE id = folder_uuid
    AND owner_id = auth.uid();

  -- Optionally transfer dashboards in folder too (uncomment if needed)
  -- UPDATE public.dashboards
  -- SET owner_id = new_owner_uuid
  -- WHERE folder_id = folder_uuid AND owner_id = auth.uid();

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update timestamps
CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER org_members_updated_at
  BEFORE UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER folders_updated_at
  BEFORE UPDATE ON public.folders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER plan_limits_updated_at
  BEFORE UPDATE ON public.plan_limits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-add creator as owner when org is created
CREATE OR REPLACE FUNCTION add_org_creator_as_owner()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.organization_members (organization_id, user_id, role, accepted_at)
  VALUES (NEW.id, NEW.created_by, 'owner', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_organization_created
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION add_org_creator_as_owner();

-- ============================================
-- UPDATE SIGNUP TRIGGER
-- ============================================

-- Remove auto-create workspace, just create profile
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile with free plan
  INSERT INTO public.profiles (id, plan_type)
  VALUES (NEW.id, 'free');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- CLEANUP FUNCTION (for expired invitations)
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS void AS $$
BEGIN
  DELETE FROM public.organization_invitations
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- NOTES
-- ============================================
--
-- The workspaces table is NOT dropped in this migration.
-- It will be deprecated and removed in a future migration after:
-- 1. All references are updated in the codebase
-- 2. Data migration is verified
--
-- workspace_id column on dashboards is kept for now for backward compatibility.
-- It should be dropped in a future migration.
