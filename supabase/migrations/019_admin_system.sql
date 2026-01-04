-- Migration 019: Admin System
-- Admin dashboard for user management, global settings, and credit adjustments

-- ============================================
-- ADMIN USERS TABLE
-- Who can access admin dashboard
-- ============================================

CREATE TABLE public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'support', 'billing_admin')),
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Users can check their own admin status
CREATE POLICY "Users can check own admin status"
  ON public.admin_users FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all admin users
CREATE POLICY "Admins can view all admin users"
  ON public.admin_users FOR SELECT
  USING (
    auth.uid() IN (SELECT user_id FROM public.admin_users)
  );

-- Only super_admins can manage admin users
CREATE POLICY "Super admins can manage admin users"
  ON public.admin_users FOR ALL
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.admin_users WHERE role = 'super_admin'
    )
  );

-- ============================================
-- USER PLAN OVERRIDES TABLE
-- Custom pricing, credits, and limits per user/org
-- ============================================

CREATE TABLE public.user_plan_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Plan override
  plan_type TEXT CHECK (plan_type IN ('free', 'starter', 'pro', 'enterprise', 'custom')),
  plan_expires_at TIMESTAMPTZ, -- NULL = never expires

  -- Custom limits (override plan_limits)
  max_dashboards INTEGER,
  max_folders INTEGER,
  max_data_rows INTEGER,
  monthly_credits INTEGER,

  -- Billing overrides (fixed price)
  price_override_cents INTEGER, -- Fixed monthly price in cents
  price_reason TEXT,

  -- Metadata
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Either user_id OR organization_id must be set
  CONSTRAINT user_or_org CHECK (
    (user_id IS NOT NULL AND organization_id IS NULL) OR
    (user_id IS NULL AND organization_id IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX idx_plan_overrides_user ON public.user_plan_overrides(user_id);
CREATE INDEX idx_plan_overrides_org ON public.user_plan_overrides(organization_id);
CREATE INDEX idx_plan_overrides_active ON public.user_plan_overrides(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.user_plan_overrides ENABLE ROW LEVEL SECURITY;

-- Admins can view and manage overrides
CREATE POLICY "Admins can manage plan overrides"
  ON public.user_plan_overrides FOR ALL
  USING (
    auth.uid() IN (SELECT user_id FROM public.admin_users)
  );

-- Users can view their own overrides (so they see their special pricing)
CREATE POLICY "Users can view own overrides"
  ON public.user_plan_overrides FOR SELECT
  USING (user_id = auth.uid());

-- ============================================
-- GLOBAL SETTINGS TABLE
-- Platform-wide configuration
-- ============================================

CREATE TABLE public.global_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read global settings (needed for pricing display)
CREATE POLICY "Anyone can view global settings"
  ON public.global_settings FOR SELECT
  USING (true);

-- Only admins can update global settings
CREATE POLICY "Admins can update global settings"
  ON public.global_settings FOR ALL
  USING (
    auth.uid() IN (SELECT user_id FROM public.admin_users)
  );

-- Insert default global settings
INSERT INTO public.global_settings (key, value, description) VALUES
  ('plan_pricing', '{
    "free": {"monthly_cents": 0, "annual_cents": 0},
    "starter": {"monthly_cents": 1900, "annual_cents": 15900},
    "pro": {"monthly_cents": 4900, "annual_cents": 41900},
    "enterprise": {"monthly_cents": 9900, "annual_cents": 99900}
  }', 'Monthly and annual pricing for each plan in cents'),

  ('plan_credits', '{
    "free": {"credits_per_month": 100, "is_one_time": true},
    "starter": {"credits_per_month": 200, "is_one_time": false},
    "pro": {"credits_per_month": 500, "is_one_time": false},
    "enterprise": {"credits_per_month": 1000, "is_one_time": false}
  }', 'Credit allocation per plan per month'),

  ('signup_bonus_credits', '{"amount": 100}', 'Credits given to new users on signup'),

  ('feature_flags', '{
    "maintenance_mode": false,
    "new_signups_enabled": true,
    "google_sheets_enabled": true
  }', 'Global feature flags');

-- ============================================
-- ADMIN AUDIT LOG TABLE
-- Track all admin actions
-- ============================================

CREATE TABLE public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL, -- 'user', 'organization', 'settings', 'credits'
  target_id UUID,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for quick lookups
CREATE INDEX idx_audit_log_admin ON public.admin_audit_log(admin_user_id);
CREATE INDEX idx_audit_log_target ON public.admin_audit_log(target_type, target_id);
CREATE INDEX idx_audit_log_created ON public.admin_audit_log(created_at DESC);

-- Enable RLS
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit log
CREATE POLICY "Admins can view audit log"
  ON public.admin_audit_log FOR SELECT
  USING (
    auth.uid() IN (SELECT user_id FROM public.admin_users)
  );

-- System inserts via functions (no direct insert policy needed)
CREATE POLICY "System can insert audit log"
  ON public.admin_audit_log FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT user_id FROM public.admin_users)
  );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = user_uuid AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get admin role
CREATE OR REPLACE FUNCTION get_admin_role(user_uuid UUID)
RETURNS TEXT AS $$
DECLARE
  admin_role TEXT;
BEGIN
  SELECT role INTO admin_role
  FROM public.admin_users
  WHERE user_id = user_uuid;

  RETURN admin_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log admin action
CREATE OR REPLACE FUNCTION log_admin_action(
  p_action TEXT,
  p_target_type TEXT,
  p_target_id UUID,
  p_old_value JSONB DEFAULT NULL,
  p_new_value JSONB DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.admin_audit_log (
    admin_user_id, action, target_type, target_id,
    old_value, new_value, reason
  ) VALUES (
    auth.uid(), p_action, p_target_type, p_target_id,
    p_old_value, p_new_value, p_reason
  )
  RETURNING id INTO log_id;

  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin add credits to user
CREATE OR REPLACE FUNCTION admin_add_credits(
  p_target_user_id UUID,
  p_target_org_id UUID,
  p_amount INTEGER,
  p_reason TEXT
)
RETURNS INTEGER AS $$
DECLARE
  new_balance INTEGER;
BEGIN
  -- Check caller is admin
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can add credits';
  END IF;

  -- Add credits using existing function
  IF p_target_org_id IS NOT NULL THEN
    new_balance := add_credits(NULL, p_target_org_id, p_amount, 'manual_adjustment', p_reason);
  ELSE
    new_balance := add_credits(p_target_user_id, NULL, p_amount, 'manual_adjustment', p_reason);
  END IF;

  -- Log the action
  PERFORM log_admin_action(
    'add_credits',
    CASE WHEN p_target_org_id IS NOT NULL THEN 'organization' ELSE 'user' END,
    COALESCE(p_target_org_id, p_target_user_id),
    NULL,
    jsonb_build_object('amount', p_amount, 'new_balance', new_balance),
    p_reason
  );

  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's effective plan considering overrides
CREATE OR REPLACE FUNCTION get_user_effective_plan(user_uuid UUID)
RETURNS JSONB AS $$
DECLARE
  base_plan TEXT;
  override_record RECORD;
  result JSONB;
BEGIN
  -- Get base plan
  base_plan := get_effective_plan(user_uuid);

  -- Check for active override
  SELECT * INTO override_record
  FROM public.user_plan_overrides
  WHERE user_id = user_uuid
    AND is_active = true
    AND (plan_expires_at IS NULL OR plan_expires_at > NOW())
  LIMIT 1;

  IF override_record IS NOT NULL THEN
    result := jsonb_build_object(
      'plan_type', COALESCE(override_record.plan_type, base_plan),
      'has_override', true,
      'max_dashboards', override_record.max_dashboards,
      'monthly_credits', override_record.monthly_credits,
      'price_override_cents', override_record.price_override_cents,
      'expires_at', override_record.plan_expires_at
    );
  ELSE
    result := jsonb_build_object(
      'plan_type', base_plan,
      'has_override', false
    );
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update timestamp trigger for overrides
CREATE TRIGGER user_plan_overrides_updated_at
  BEFORE UPDATE ON public.user_plan_overrides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Update timestamp trigger for global settings
CREATE TRIGGER global_settings_updated_at
  BEFORE UPDATE ON public.global_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- INITIAL ADMIN USER
-- Grant super_admin to specific email
-- ============================================

-- Insert super admin for abhishek.gutgutia@gmail.com
-- This runs after user signs up
INSERT INTO public.admin_users (user_id, role)
SELECT id, 'super_admin'
FROM auth.users
WHERE email = 'abhishek.gutgutia@gmail.com'
ON CONFLICT (user_id) DO NOTHING;
