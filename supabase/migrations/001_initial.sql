-- Migration 001: Initial Schema
-- Creates profiles, workspaces, and dashboards tables

-- ============================================
-- PROFILES TABLE
-- Extends auth.users with additional profile data
-- ============================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================
-- WORKSPACES TABLE
-- Personal workspace auto-created on signup
-- ============================================

CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  type VARCHAR(20) NOT NULL DEFAULT 'personal' CHECK (type IN ('personal', 'team')),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_workspaces_owner ON public.workspaces(owner_id);
CREATE INDEX idx_workspaces_slug ON public.workspaces(slug);

-- Enable RLS
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own workspaces"
  ON public.workspaces FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can create workspaces"
  ON public.workspaces FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own workspaces"
  ON public.workspaces FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own workspaces"
  ON public.workspaces FOR DELETE
  USING (auth.uid() = owner_id);

-- ============================================
-- DASHBOARDS TABLE
-- Main table for storing dashboard data and config
-- ============================================

CREATE TABLE public.dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

  -- Basic info
  title VARCHAR(255) NOT NULL DEFAULT 'Untitled Dashboard',
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,

  -- Data source info (extensible for linked sources)
  data_source JSONB NOT NULL DEFAULT '{"type": "paste"}'::jsonb,

  -- The raw data (stored as JSONB for MVP)
  data JSONB,
  data_url TEXT,  -- URL to Supabase Storage for large files

  -- Dashboard configuration (charts, layout, theme)
  config JSONB NOT NULL DEFAULT '{"charts": []}'::jsonb,

  -- Publishing
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,

  -- Tracking
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_dashboards_workspace ON public.dashboards(workspace_id);
CREATE INDEX idx_dashboards_slug ON public.dashboards(slug);
CREATE INDEX idx_dashboards_published ON public.dashboards(is_published) WHERE is_published = true;
CREATE INDEX idx_dashboards_created_by ON public.dashboards(created_by);

-- Enable RLS
ALTER TABLE public.dashboards ENABLE ROW LEVEL SECURITY;

-- Policies: Owner access via workspace
CREATE POLICY "Workspace owner full access"
  ON public.dashboards FOR ALL
  USING (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
    )
  );

-- Public can view published dashboards
CREATE POLICY "Public can view published"
  ON public.dashboards FOR SELECT
  USING (is_published = true);

-- ============================================
-- CHAT MESSAGES TABLE
-- Stores chat history for dashboard iteration
-- ============================================

CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID NOT NULL REFERENCES public.dashboards(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_chat_messages_dashboard ON public.chat_messages(dashboard_id);
CREATE INDEX idx_chat_messages_created ON public.chat_messages(created_at);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies: Access via dashboard ownership
CREATE POLICY "Dashboard owner can access chat"
  ON public.chat_messages FOR ALL
  USING (
    dashboard_id IN (
      SELECT d.id FROM public.dashboards d
      JOIN public.workspaces w ON d.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER dashboards_updated_at
  BEFORE UPDATE ON public.dashboards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile and personal workspace on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  workspace_slug TEXT;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id) VALUES (NEW.id);

  -- Create personal workspace
  workspace_slug := 'personal-' || REPLACE(NEW.id::text, '-', '');
  INSERT INTO public.workspaces (name, slug, type, owner_id)
  VALUES ('Personal', workspace_slug, 'personal', NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
