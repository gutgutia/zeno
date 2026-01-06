-- Migration 021: Cost Monitoring
-- Implements model pricing configuration and AI usage logging for cost tracking

-- ============================================
-- MODEL PRICING TABLE
-- Configurable pricing per AI model
-- ============================================

CREATE TABLE public.model_pricing (
  model_id VARCHAR(50) PRIMARY KEY,  -- e.g., 'opus-4-5', 'sonnet-4-5'
  display_name VARCHAR(100) NOT NULL,  -- e.g., 'Claude Opus 4.5'
  input_cost_per_1m_tokens DECIMAL(10, 4) NOT NULL,  -- e.g., 15.0000 ($15/1M)
  output_cost_per_1m_tokens DECIMAL(10, 4) NOT NULL,  -- e.g., 75.0000 ($75/1M)
  is_active BOOLEAN NOT NULL DEFAULT true,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert current Anthropic pricing (as of Jan 2025)
INSERT INTO public.model_pricing (model_id, display_name, input_cost_per_1m_tokens, output_cost_per_1m_tokens) VALUES
  ('opus-4-5', 'Claude Opus 4.5', 15.0000, 75.0000),
  ('sonnet-4-5', 'Claude Sonnet 4.5', 3.0000, 15.0000),
  ('haiku-3-5', 'Claude Haiku 3.5', 0.8000, 4.0000);

-- Enable RLS
ALTER TABLE public.model_pricing ENABLE ROW LEVEL SECURITY;

-- Anyone can read pricing (for display purposes)
CREATE POLICY "Anyone can view model pricing"
  ON public.model_pricing FOR SELECT
  USING (true);

-- Only admins can modify pricing (via service role)
-- No insert/update/delete policies for regular users

-- ============================================
-- AI USAGE LOGS TABLE
-- Detailed per-event cost tracking
-- ============================================

CREATE TABLE public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  dashboard_id UUID REFERENCES public.dashboards(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,

  -- Operation details
  operation_type VARCHAR(30) NOT NULL CHECK (operation_type IN (
    'generation',      -- Initial dashboard creation
    'modification',    -- AI-driven modification
    'data_refresh'     -- Refresh with new data
  )),

  -- Model used
  model_id VARCHAR(50) NOT NULL,  -- e.g., 'opus-4-5', 'sonnet-4-5'

  -- Token usage
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  thinking_tokens INTEGER DEFAULT 0,  -- Extended thinking tokens
  cache_read_tokens INTEGER DEFAULT 0,  -- Cached input tokens (cheaper)
  cache_write_tokens INTEGER DEFAULT 0,  -- Tokens written to cache

  -- Calculated costs (in USD)
  input_cost_usd DECIMAL(10, 6) NOT NULL DEFAULT 0,
  output_cost_usd DECIMAL(10, 6) NOT NULL DEFAULT 0,
  total_cost_usd DECIMAL(10, 6) NOT NULL DEFAULT 0,

  -- Agent-reported cost (for comparison/validation)
  agent_reported_cost_usd DECIMAL(10, 6),

  -- Pricing snapshot (in case pricing changes)
  pricing_snapshot JSONB,  -- { input_per_1m, output_per_1m }

  -- Credits deducted
  credits_deducted INTEGER DEFAULT 0,

  -- Performance metrics
  duration_ms INTEGER,  -- How long the operation took
  turn_count INTEGER,   -- Number of agent turns (for agentic operations)

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'success' CHECK (status IN (
    'success', 'failed', 'partial'
  )),
  error_message TEXT,

  -- Metadata
  metadata JSONB,  -- Additional context (e.g., { instructions: "...", extended_thinking: true })

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_ai_usage_logs_dashboard ON public.ai_usage_logs(dashboard_id);
CREATE INDEX idx_ai_usage_logs_user ON public.ai_usage_logs(user_id);
CREATE INDEX idx_ai_usage_logs_org ON public.ai_usage_logs(organization_id);
CREATE INDEX idx_ai_usage_logs_operation ON public.ai_usage_logs(operation_type);
CREATE INDEX idx_ai_usage_logs_model ON public.ai_usage_logs(model_id);
CREATE INDEX idx_ai_usage_logs_created ON public.ai_usage_logs(created_at DESC);
CREATE INDEX idx_ai_usage_logs_cost ON public.ai_usage_logs(total_cost_usd DESC);

-- Enable RLS
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage
CREATE POLICY "Users can view own usage logs"
  ON public.ai_usage_logs FOR SELECT
  USING (user_id = auth.uid());

-- Org members can view org usage
CREATE POLICY "Org members can view org usage logs"
  ON public.ai_usage_logs FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Calculate cost from tokens using model pricing
CREATE OR REPLACE FUNCTION calculate_token_cost(
  p_model_id VARCHAR(50),
  p_input_tokens INTEGER,
  p_output_tokens INTEGER
)
RETURNS TABLE (
  input_cost DECIMAL(10, 6),
  output_cost DECIMAL(10, 6),
  total_cost DECIMAL(10, 6)
) AS $$
DECLARE
  v_input_rate DECIMAL(10, 4);
  v_output_rate DECIMAL(10, 4);
BEGIN
  -- Get pricing for the model
  SELECT input_cost_per_1m_tokens, output_cost_per_1m_tokens
  INTO v_input_rate, v_output_rate
  FROM public.model_pricing
  WHERE model_id = p_model_id AND is_active = true
  ORDER BY effective_from DESC
  LIMIT 1;

  -- Default to Opus pricing if model not found
  IF v_input_rate IS NULL THEN
    v_input_rate := 15.0000;
    v_output_rate := 75.0000;
  END IF;

  -- Calculate costs (tokens / 1,000,000 * rate)
  input_cost := (p_input_tokens::DECIMAL / 1000000) * v_input_rate;
  output_cost := (p_output_tokens::DECIMAL / 1000000) * v_output_rate;
  total_cost := input_cost + output_cost;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql STABLE;

-- Log AI usage and return the created log entry
CREATE OR REPLACE FUNCTION log_ai_usage(
  p_dashboard_id UUID,
  p_user_id UUID,
  p_org_id UUID,
  p_operation_type VARCHAR(30),
  p_model_id VARCHAR(50),
  p_input_tokens INTEGER,
  p_output_tokens INTEGER,
  p_thinking_tokens INTEGER DEFAULT 0,
  p_agent_reported_cost DECIMAL(10, 6) DEFAULT NULL,
  p_duration_ms INTEGER DEFAULT NULL,
  p_turn_count INTEGER DEFAULT NULL,
  p_credits_deducted INTEGER DEFAULT 0,
  p_status VARCHAR(20) DEFAULT 'success',
  p_error_message TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
  v_costs RECORD;
  v_pricing JSONB;
BEGIN
  -- Calculate costs
  SELECT * INTO v_costs
  FROM calculate_token_cost(p_model_id, p_input_tokens, p_output_tokens);

  -- Get pricing snapshot
  SELECT jsonb_build_object(
    'input_per_1m', input_cost_per_1m_tokens,
    'output_per_1m', output_cost_per_1m_tokens
  ) INTO v_pricing
  FROM public.model_pricing
  WHERE model_id = p_model_id AND is_active = true
  ORDER BY effective_from DESC
  LIMIT 1;

  -- Insert log entry
  INSERT INTO public.ai_usage_logs (
    dashboard_id, user_id, organization_id,
    operation_type, model_id,
    input_tokens, output_tokens, thinking_tokens,
    input_cost_usd, output_cost_usd, total_cost_usd,
    agent_reported_cost_usd, pricing_snapshot,
    credits_deducted, duration_ms, turn_count,
    status, error_message, metadata
  ) VALUES (
    p_dashboard_id, p_user_id, p_org_id,
    p_operation_type, p_model_id,
    p_input_tokens, p_output_tokens, p_thinking_tokens,
    v_costs.input_cost, v_costs.output_cost, v_costs.total_cost,
    p_agent_reported_cost, v_pricing,
    p_credits_deducted, p_duration_ms, p_turn_count,
    p_status, p_error_message, p_metadata
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ANALYTICS VIEWS
-- ============================================

-- Daily usage summary
CREATE OR REPLACE VIEW public.ai_usage_daily_summary AS
SELECT
  DATE(created_at) as date,
  operation_type,
  model_id,
  COUNT(*) as operation_count,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(total_cost_usd) as total_cost_usd,
  SUM(credits_deducted) as total_credits,
  AVG(duration_ms)::INTEGER as avg_duration_ms
FROM public.ai_usage_logs
WHERE status = 'success'
GROUP BY DATE(created_at), operation_type, model_id
ORDER BY date DESC, operation_type, model_id;

-- User usage summary
CREATE OR REPLACE VIEW public.ai_usage_user_summary AS
SELECT
  user_id,
  operation_type,
  model_id,
  COUNT(*) as operation_count,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(total_cost_usd) as total_cost_usd,
  SUM(credits_deducted) as total_credits,
  MAX(created_at) as last_usage_at
FROM public.ai_usage_logs
WHERE status = 'success' AND user_id IS NOT NULL
GROUP BY user_id, operation_type, model_id;

-- ============================================
-- TRIGGERS
-- ============================================

-- Update timestamp on model_pricing changes
CREATE TRIGGER model_pricing_updated_at
  BEFORE UPDATE ON public.model_pricing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ADMIN ACCESS (via service role)
-- ============================================

-- Grant admin read access to usage logs
CREATE POLICY "Admins can view all usage logs"
  ON public.ai_usage_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );
