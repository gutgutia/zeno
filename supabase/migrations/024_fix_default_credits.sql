-- Fix default credits from 200 to 100
-- Update the initialize_org_credits function to use correct default

CREATE OR REPLACE FUNCTION initialize_org_credits()
RETURNS TRIGGER AS $$
DECLARE
  credits_amount INTEGER;
BEGIN
  -- Get credits per seat for this plan
  SELECT credits_per_seat_monthly INTO credits_amount
  FROM public.plan_credit_allocations
  WHERE plan_type = NEW.plan_type;

  -- Create credit balance with initial allocation (default to 100 if not found)
  INSERT INTO public.organization_credits (
    organization_id, balance, lifetime_credits, last_refill_at
  ) VALUES (
    NEW.id,
    COALESCE(credits_amount, 100) * NEW.seats_purchased,
    COALESCE(credits_amount, 100) * NEW.seats_purchased,
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update plan_credit_allocations to ensure correct values
UPDATE public.plan_credit_allocations SET credits_per_seat_monthly = 100 WHERE plan_type = 'free';
UPDATE public.plan_credit_allocations SET credits_per_seat_monthly = 100 WHERE plan_type = 'starter';
UPDATE public.plan_credit_allocations SET credits_per_seat_monthly = 250 WHERE plan_type = 'pro';
UPDATE public.plan_credit_allocations SET credits_per_seat_monthly = 500 WHERE plan_type = 'enterprise';

-- Update global_settings plan_credits
UPDATE public.global_settings
SET value = '{
  "free": {"credits_per_month": 100, "is_one_time": true},
  "starter": {"credits_per_month": 100, "is_one_time": false},
  "pro": {"credits_per_month": 250, "is_one_time": false},
  "enterprise": {"credits_per_month": 500, "is_one_time": false}
}'::jsonb
WHERE key = 'plan_credits';
