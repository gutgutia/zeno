-- Add subscription_ends_at column to track scheduled cancellation
-- When a user cancels, subscription continues until this date, then downgrades to free

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;

COMMENT ON COLUMN organizations.subscription_ends_at IS 'When subscription is scheduled to end (cancel at period end). Null means active/not canceling.';
