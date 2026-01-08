-- Rate limiting table for IP-based request throttling
-- Used to prevent abuse of authentication endpoints

CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient lookups by key and time window
CREATE INDEX idx_rate_limits_key_created ON rate_limits (key, created_at DESC);

-- Index for cleanup of old entries
CREATE INDEX idx_rate_limits_created ON rate_limits (created_at);

-- No RLS needed - this table is only accessed via service role
-- The table stores IP-based rate limit data, not user data

COMMENT ON TABLE rate_limits IS 'Stores rate limit entries for IP-based throttling of API endpoints';
COMMENT ON COLUMN rate_limits.key IS 'Composite key of namespace:identifier (e.g., send-otp-ip:192.168.1.1)';
COMMENT ON COLUMN rate_limits.created_at IS 'Timestamp of the request, used for sliding window calculation';
