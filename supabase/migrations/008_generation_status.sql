-- Add generation status fields for async dashboard generation
-- This enables the two-step AI generation flow with email notifications

-- Add generation status enum-like column
ALTER TABLE public.dashboards
ADD COLUMN IF NOT EXISTS generation_status VARCHAR(20) DEFAULT 'pending' NOT NULL;

-- Add generation tracking fields
ALTER TABLE public.dashboards
ADD COLUMN IF NOT EXISTS generation_error TEXT;

ALTER TABLE public.dashboards
ADD COLUMN IF NOT EXISTS generation_started_at TIMESTAMPTZ;

ALTER TABLE public.dashboards
ADD COLUMN IF NOT EXISTS generation_completed_at TIMESTAMPTZ;

-- Add raw content storage (original pasted/uploaded content as text)
ALTER TABLE public.dashboards
ADD COLUMN IF NOT EXISTS raw_content TEXT;

-- Add user instructions for AI generation
ALTER TABLE public.dashboards
ADD COLUMN IF NOT EXISTS user_instructions TEXT;

-- Add email notification preference
ALTER TABLE public.dashboards
ADD COLUMN IF NOT EXISTS notify_email BOOLEAN DEFAULT false NOT NULL;

-- Add check constraint for valid status values
ALTER TABLE public.dashboards
ADD CONSTRAINT dashboards_generation_status_check
CHECK (generation_status IN ('pending', 'analyzing', 'generating', 'completed', 'failed'));

-- Create index for querying dashboards by generation status
CREATE INDEX IF NOT EXISTS idx_dashboards_generation_status
ON public.dashboards(generation_status)
WHERE generation_status IN ('pending', 'analyzing', 'generating');

-- Comment on columns for documentation
COMMENT ON COLUMN public.dashboards.generation_status IS 'Status of async AI generation: pending, analyzing, generating, completed, failed';
COMMENT ON COLUMN public.dashboards.generation_error IS 'Error message if generation failed';
COMMENT ON COLUMN public.dashboards.raw_content IS 'Original pasted or uploaded content as raw text';
COMMENT ON COLUMN public.dashboards.user_instructions IS 'User-provided instructions for AI generation';
COMMENT ON COLUMN public.dashboards.notify_email IS 'Whether to send email notification when generation completes';
