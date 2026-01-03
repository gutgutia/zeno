-- ============================================
-- DATABASE RESET SCRIPT
-- WARNING: This will DELETE ALL DATA!
-- Only use in development/testing environments
-- ============================================

-- Disable triggers temporarily to avoid issues during truncation
SET session_replication_role = 'replica';

-- ============================================
-- TRUNCATE ALL TABLES (in dependency order)
-- ============================================

-- Credit system tables
TRUNCATE TABLE public.credit_transactions CASCADE;
TRUNCATE TABLE public.organization_credits CASCADE;
TRUNCATE TABLE public.user_credits CASCADE;

-- Dashboard related tables
TRUNCATE TABLE public.dashboard_shares CASCADE;
TRUNCATE TABLE public.dashboard_versions CASCADE;
TRUNCATE TABLE public.dashboards CASCADE;

-- Folder tables
TRUNCATE TABLE public.folders CASCADE;

-- Organization tables
TRUNCATE TABLE public.organization_invitations CASCADE;
TRUNCATE TABLE public.organization_members CASCADE;
TRUNCATE TABLE public.organizations CASCADE;

-- Google connections
TRUNCATE TABLE public.google_connections CASCADE;

-- Workspace tables
TRUNCATE TABLE public.workspaces CASCADE;

-- User profiles (this will cascade from auth.users deletion)
TRUNCATE TABLE public.profiles CASCADE;

-- Plan features and limits (keep these as they're configuration)
-- Uncomment if you want to reset these too:
-- TRUNCATE TABLE public.plan_features CASCADE;
-- TRUNCATE TABLE public.plan_limits CASCADE;

-- Re-enable triggers
SET session_replication_role = 'origin';

-- ============================================
-- DELETE AUTH USERS (Supabase specific)
-- This requires service role access
-- ============================================

-- Delete all users from auth.users
-- This will cascade to profiles via the foreign key
DELETE FROM auth.users;

-- ============================================
-- RESET SEQUENCES (optional)
-- ============================================

-- Most tables use UUIDs so no sequences to reset
-- But if you have any serial/bigserial columns, reset them here:
-- ALTER SEQUENCE your_sequence_name RESTART WITH 1;

-- ============================================
-- VERIFICATION
-- ============================================

-- Show counts to verify reset
SELECT 'profiles' as table_name, COUNT(*) as count FROM public.profiles
UNION ALL SELECT 'workspaces', COUNT(*) FROM public.workspaces
UNION ALL SELECT 'dashboards', COUNT(*) FROM public.dashboards
UNION ALL SELECT 'dashboard_shares', COUNT(*) FROM public.dashboard_shares
UNION ALL SELECT 'organizations', COUNT(*) FROM public.organizations
UNION ALL SELECT 'organization_members', COUNT(*) FROM public.organization_members
UNION ALL SELECT 'folders', COUNT(*) FROM public.folders
UNION ALL SELECT 'auth.users', COUNT(*) FROM auth.users;

SELECT 'Database reset complete!' as status;
