-- ============================================
-- ZENO DATABASE SETUP
-- Run this script to set up the complete database
-- ============================================

-- This is a convenience script that combines all migrations
-- For production, use individual migration files with Supabase CLI

\echo 'Starting Zeno database setup...'

-- Include the initial migration
\i migrations/001_initial.sql

\echo 'Database setup complete!'
\echo ''
\echo 'Next steps:'
\echo '1. Configure your environment variables in .env.local'
\echo '2. Set up Supabase Auth with email provider'
\echo '3. (Optional) Configure Resend for custom emails'
\echo ''
