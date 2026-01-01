-- Migration 005: Fix workspace RLS recursion
-- The policy from 004 caused infinite recursion between dashboards and workspaces RLS
-- We now use admin client for public dashboard page instead

-- Drop the problematic policy
DROP POLICY IF EXISTS "Public can view workspace with published dashboards" ON public.workspaces;
