-- Migration 014: Credit System
-- Implements credit tracking, transactions, and tier-based access

-- ============================================
-- CREDIT BALANCES TABLE
-- Tracks credit balance per organization
-- ============================================

CREATE TABLE public.organization_credits (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  lifetime_credits INTEGER NOT NULL DEFAULT 0, -- Total credits ever received
  lifetime_used INTEGER NOT NULL DEFAULT 0,    -- Total credits ever used
  last_refill_at TIMESTAMPTZ,                  -- Last monthly refill
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- For users not in an org (free tier)
CREATE TABLE public.user_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 100,        -- Free tier starts with 100
  lifetime_credits INTEGER NOT NULL DEFAULT 100,
  lifetime_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.organization_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CREDIT TRANSACTIONS TABLE
-- Audit log of all credit changes
-- ============================================

CREATE TABLE public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who owns the credits (one of these will be set)
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Transaction details
  amount INTEGER NOT NULL,                    -- Positive = add, negative = deduct
  balance_after INTEGER NOT NULL,             -- Balance after this transaction

  -- What triggered this transaction
  transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN (
    'signup_bonus',      -- Initial free credits
    'monthly_refill',    -- Monthly credit allocation
    'credit_pack',       -- Purchased credit pack
    'dashboard_create',  -- Created a dashboard
    'dashboard_update',  -- AI modification
    'dashboard_refresh', -- Data refresh with AI
    'manual_adjustment', -- Admin adjustment
    'refund'             -- Refunded credits
  )),

  -- Reference to what was created/updated
  dashboard_id UUID REFERENCES public.dashboards(id) ON DELETE SET NULL,

  -- Token usage details (for AI transactions)
  input_tokens INTEGER,
  output_tokens INTEGER,

  -- Metadata
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_credit_transactions_org ON public.credit_transactions(organization_id);
CREATE INDEX idx_credit_transactions_user ON public.credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_dashboard ON public.credit_transactions(dashboard_id);
CREATE INDEX idx_credit_transactions_type ON public.credit_transactions(transaction_type);
CREATE INDEX idx_credit_transactions_created ON public.credit_transactions(created_at DESC);

-- Enable RLS
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CREDIT PACK PURCHASES TABLE
-- ============================================

CREATE TABLE public.credit_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Purchase details
  credits INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,              -- Amount paid in cents
  stripe_payment_intent_id TEXT,
  stripe_invoice_id TEXT,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'completed', 'failed', 'refunded'
  )),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_credit_purchases_org ON public.credit_purchases(organization_id);
CREATE INDEX idx_credit_purchases_status ON public.credit_purchases(status);

-- Enable RLS
ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;

-- ============================================
-- FEATURE FLAGS TABLE
-- Which features are enabled per plan
-- ============================================

CREATE TABLE public.plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_type VARCHAR(20) NOT NULL, -- 'free', 'starter', 'pro', 'enterprise'
  feature_key VARCHAR(50) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  limit_value INTEGER, -- For numeric limits (null = unlimited)

  UNIQUE(plan_type, feature_key)
);

-- Insert feature definitions
INSERT INTO public.plan_features (plan_type, feature_key, enabled, limit_value) VALUES
  -- Free tier
  ('free', 'max_dashboards', true, 3),
  ('free', 'public_sharing', true, NULL),
  ('free', 'private_sharing', false, NULL),
  ('free', 'custom_subdomain', false, NULL),
  ('free', 'custom_domain', false, NULL),
  ('free', 'custom_branding', false, NULL),
  ('free', 'remove_zeno_branding', false, NULL),
  ('free', 'google_sheets', false, NULL),
  ('free', 'scheduled_refresh', false, NULL),
  ('free', 'pdf_export', false, NULL),
  ('free', 'shared_folders', false, NULL),
  ('free', 'team_members', false, NULL),
  ('free', 'priority_support', false, NULL),
  ('free', 'sso', false, NULL),
  ('free', 'audit_logs', false, NULL),

  -- Starter tier
  ('starter', 'max_dashboards', true, NULL), -- Unlimited
  ('starter', 'public_sharing', true, NULL),
  ('starter', 'private_sharing', true, NULL),
  ('starter', 'custom_subdomain', true, NULL),
  ('starter', 'custom_domain', false, NULL),
  ('starter', 'custom_branding', false, NULL),
  ('starter', 'remove_zeno_branding', false, NULL),
  ('starter', 'google_sheets', false, NULL),
  ('starter', 'scheduled_refresh', false, NULL),
  ('starter', 'pdf_export', false, NULL),
  ('starter', 'shared_folders', true, NULL),
  ('starter', 'team_members', true, NULL),
  ('starter', 'priority_support', false, NULL),
  ('starter', 'sso', false, NULL),
  ('starter', 'audit_logs', false, NULL),

  -- Pro tier
  ('pro', 'max_dashboards', true, NULL),
  ('pro', 'public_sharing', true, NULL),
  ('pro', 'private_sharing', true, NULL),
  ('pro', 'custom_subdomain', true, NULL),
  ('pro', 'custom_domain', true, NULL),
  ('pro', 'custom_branding', true, NULL),
  ('pro', 'remove_zeno_branding', true, NULL),
  ('pro', 'google_sheets', true, NULL),
  ('pro', 'scheduled_refresh', true, NULL),
  ('pro', 'pdf_export', true, NULL),
  ('pro', 'shared_folders', true, NULL),
  ('pro', 'team_members', true, NULL),
  ('pro', 'priority_support', true, NULL),
  ('pro', 'sso', false, NULL),
  ('pro', 'audit_logs', false, NULL),

  -- Enterprise tier
  ('enterprise', 'max_dashboards', true, NULL),
  ('enterprise', 'public_sharing', true, NULL),
  ('enterprise', 'private_sharing', true, NULL),
  ('enterprise', 'custom_subdomain', true, NULL),
  ('enterprise', 'custom_domain', true, NULL),
  ('enterprise', 'custom_branding', true, NULL),
  ('enterprise', 'remove_zeno_branding', true, NULL),
  ('enterprise', 'google_sheets', true, NULL),
  ('enterprise', 'scheduled_refresh', true, NULL),
  ('enterprise', 'pdf_export', true, NULL),
  ('enterprise', 'shared_folders', true, NULL),
  ('enterprise', 'team_members', true, NULL),
  ('enterprise', 'priority_support', true, NULL),
  ('enterprise', 'sso', true, NULL),
  ('enterprise', 'audit_logs', true, NULL);

-- Enable RLS (read-only for all)
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view plan features"
  ON public.plan_features FOR SELECT
  USING (true);

-- ============================================
-- CREDIT ALLOCATION CONFIG
-- Credits per plan per month
-- ============================================

CREATE TABLE public.plan_credit_allocations (
  plan_type VARCHAR(20) PRIMARY KEY,
  credits_per_seat_monthly INTEGER NOT NULL,
  is_one_time BOOLEAN NOT NULL DEFAULT false -- True for free tier
);

INSERT INTO public.plan_credit_allocations (plan_type, credits_per_seat_monthly, is_one_time) VALUES
  ('free', 100, true),      -- 100 one-time
  ('starter', 200, false),  -- 200/seat/month
  ('pro', 500, false),      -- 500/seat/month
  ('enterprise', 1000, false); -- 1000/seat/month

-- ============================================
-- RLS POLICIES
-- ============================================

-- Organization credits: org members can view
CREATE POLICY "Org members can view credit balance"
  ON public.organization_credits FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Only admins can modify (via API)
CREATE POLICY "Admins can update credit balance"
  ON public.organization_credits FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- User credits: users can view their own
CREATE POLICY "Users can view own credits"
  ON public.user_credits FOR SELECT
  USING (user_id = auth.uid());

-- Credit transactions: org members can view org transactions
CREATE POLICY "Org members can view transactions"
  ON public.credit_transactions FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

-- Credit purchases: org admins can view
CREATE POLICY "Admins can view purchases"
  ON public.credit_purchases FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR user_id = auth.uid()
  );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Calculate credits from tokens
CREATE OR REPLACE FUNCTION calculate_credits(input_tokens INTEGER, output_tokens INTEGER)
RETURNS INTEGER AS $$
BEGIN
  -- Weighted tokens: output costs 5x input
  -- Divisor of 10,000 for 50% margin
  RETURN CEIL((input_tokens + (output_tokens * 5))::NUMERIC / 10000);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Get user's effective plan
CREATE OR REPLACE FUNCTION get_effective_plan(user_uuid UUID)
RETURNS VARCHAR(20) AS $$
DECLARE
  best_plan VARCHAR(20) := 'free';
  org_plan VARCHAR(20);
BEGIN
  -- Check org memberships for best plan
  FOR org_plan IN
    SELECT o.plan_type
    FROM public.organization_members om
    JOIN public.organizations o ON om.organization_id = o.id
    WHERE om.user_id = user_uuid
      AND om.accepted_at IS NOT NULL
  LOOP
    IF org_plan = 'enterprise' THEN
      RETURN 'enterprise';
    ELSIF org_plan = 'pro' AND best_plan IN ('free', 'starter') THEN
      best_plan := 'pro';
    ELSIF org_plan = 'starter' AND best_plan = 'free' THEN
      best_plan := 'starter';
    END IF;
  END LOOP;

  RETURN best_plan;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user has a feature
CREATE OR REPLACE FUNCTION user_has_feature(user_uuid UUID, feature VARCHAR(50))
RETURNS BOOLEAN AS $$
DECLARE
  user_plan VARCHAR(20);
  feature_enabled BOOLEAN;
BEGIN
  user_plan := get_effective_plan(user_uuid);

  SELECT enabled INTO feature_enabled
  FROM public.plan_features
  WHERE plan_type = user_plan AND feature_key = feature;

  RETURN COALESCE(feature_enabled, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get feature limit for user
CREATE OR REPLACE FUNCTION get_feature_limit(user_uuid UUID, feature VARCHAR(50))
RETURNS INTEGER AS $$
DECLARE
  user_plan VARCHAR(20);
  feature_limit INTEGER;
BEGIN
  user_plan := get_effective_plan(user_uuid);

  SELECT limit_value INTO feature_limit
  FROM public.plan_features
  WHERE plan_type = user_plan AND feature_key = feature;

  RETURN feature_limit; -- NULL means unlimited
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Deduct credits (returns success boolean)
CREATE OR REPLACE FUNCTION deduct_credits(
  p_user_id UUID,
  p_org_id UUID,
  p_amount INTEGER,
  p_transaction_type VARCHAR(30),
  p_dashboard_id UUID DEFAULT NULL,
  p_input_tokens INTEGER DEFAULT NULL,
  p_output_tokens INTEGER DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  current_balance INTEGER;
  new_balance INTEGER;
BEGIN
  -- Get current balance
  IF p_org_id IS NOT NULL THEN
    SELECT balance INTO current_balance
    FROM public.organization_credits
    WHERE organization_id = p_org_id
    FOR UPDATE;
  ELSE
    SELECT balance INTO current_balance
    FROM public.user_credits
    WHERE user_id = p_user_id
    FOR UPDATE;
  END IF;

  -- Check if enough credits
  IF current_balance IS NULL OR current_balance < p_amount THEN
    RETURN false;
  END IF;

  new_balance := current_balance - p_amount;

  -- Update balance
  IF p_org_id IS NOT NULL THEN
    UPDATE public.organization_credits
    SET balance = new_balance,
        lifetime_used = lifetime_used + p_amount,
        updated_at = NOW()
    WHERE organization_id = p_org_id;
  ELSE
    UPDATE public.user_credits
    SET balance = new_balance,
        lifetime_used = lifetime_used + p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;

  -- Record transaction
  INSERT INTO public.credit_transactions (
    organization_id, user_id, amount, balance_after,
    transaction_type, dashboard_id, input_tokens, output_tokens,
    description, created_by
  ) VALUES (
    p_org_id, p_user_id, -p_amount, new_balance,
    p_transaction_type, p_dashboard_id, p_input_tokens, p_output_tokens,
    p_description, p_user_id
  );

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add credits
CREATE OR REPLACE FUNCTION add_credits(
  p_user_id UUID,
  p_org_id UUID,
  p_amount INTEGER,
  p_transaction_type VARCHAR(30),
  p_description TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$ -- Returns new balance
DECLARE
  new_balance INTEGER;
BEGIN
  IF p_org_id IS NOT NULL THEN
    INSERT INTO public.organization_credits (organization_id, balance, lifetime_credits)
    VALUES (p_org_id, p_amount, p_amount)
    ON CONFLICT (organization_id) DO UPDATE
    SET balance = organization_credits.balance + p_amount,
        lifetime_credits = organization_credits.lifetime_credits + p_amount,
        updated_at = NOW()
    RETURNING balance INTO new_balance;
  ELSE
    INSERT INTO public.user_credits (user_id, balance, lifetime_credits)
    VALUES (p_user_id, p_amount, p_amount)
    ON CONFLICT (user_id) DO UPDATE
    SET balance = user_credits.balance + p_amount,
        lifetime_credits = user_credits.lifetime_credits + p_amount,
        updated_at = NOW()
    RETURNING balance INTO new_balance;
  END IF;

  -- Record transaction
  INSERT INTO public.credit_transactions (
    organization_id, user_id, amount, balance_after,
    transaction_type, description, created_by
  ) VALUES (
    p_org_id, p_user_id, p_amount, new_balance,
    p_transaction_type, p_description, p_user_id
  );

  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGERS
-- ============================================

-- Give new users their free credits
CREATE OR REPLACE FUNCTION give_signup_credits()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, balance, lifetime_credits)
  VALUES (NEW.id, 100, 100);

  INSERT INTO public.credit_transactions (
    user_id, amount, balance_after, transaction_type, description
  ) VALUES (
    NEW.id, 100, 100, 'signup_bonus', 'Welcome credits'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old trigger if exists and create new one
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile with free plan
  INSERT INTO public.profiles (id, plan_type)
  VALUES (NEW.id, 'free');

  -- Give signup credits
  INSERT INTO public.user_credits (user_id, balance, lifetime_credits)
  VALUES (NEW.id, 100, 100);

  INSERT INTO public.credit_transactions (
    user_id, amount, balance_after, transaction_type, description
  ) VALUES (
    NEW.id, 100, 100, 'signup_bonus', 'Welcome credits'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Initialize org credits when org is created
CREATE OR REPLACE FUNCTION initialize_org_credits()
RETURNS TRIGGER AS $$
DECLARE
  credits_amount INTEGER;
BEGIN
  -- Get credits per seat for this plan
  SELECT credits_per_seat_monthly INTO credits_amount
  FROM public.plan_credit_allocations
  WHERE plan_type = NEW.plan_type;

  -- Create credit balance with initial allocation
  INSERT INTO public.organization_credits (
    organization_id, balance, lifetime_credits, last_refill_at
  ) VALUES (
    NEW.id,
    COALESCE(credits_amount, 200) * NEW.seats_purchased,
    COALESCE(credits_amount, 200) * NEW.seats_purchased,
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_organization_created_credits
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION initialize_org_credits();

-- Update timestamps
CREATE TRIGGER organization_credits_updated_at
  BEFORE UPDATE ON public.organization_credits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER user_credits_updated_at
  BEFORE UPDATE ON public.user_credits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
