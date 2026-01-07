-- Fix plan_type constraint to allow 'starter' and 'pro' values
-- The original constraint only allowed ('free', 'team', 'enterprise')

-- Drop the old constraint
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_plan_type_check;

-- Add new constraint with all valid plan types
ALTER TABLE organizations ADD CONSTRAINT organizations_plan_type_check
  CHECK (plan_type IN ('free', 'starter', 'pro', 'team', 'enterprise'));

-- Update any 'team' plans to 'free' (team was used as default, should be free)
UPDATE organizations SET plan_type = 'free' WHERE plan_type = 'team';
