-- WARNING: This script will DELETE ALL DATA
-- Only use in development!

-- Drop all triggers first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS dashboards_updated_at ON public.dashboards;
DROP TRIGGER IF EXISTS workspaces_updated_at ON public.workspaces;
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;

-- Drop functions
DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS update_updated_at();

-- Drop tables (in order of dependencies)
DROP TABLE IF EXISTS public.chat_messages CASCADE;
DROP TABLE IF EXISTS public.dashboards CASCADE;
DROP TABLE IF EXISTS public.workspaces CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Confirm reset
SELECT 'Database reset complete. Run 001_initial.sql to recreate.' AS status;
