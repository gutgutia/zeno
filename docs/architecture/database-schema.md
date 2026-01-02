# Zeno Database Schema

## Overview

Zeno uses PostgreSQL via Supabase. The schema is designed to:
1. Start simple for MVP (single user, no teams)
2. Extend naturally for Phase 2 (teams, workspaces)
3. Support efficient queries for access control

---

## Entity Relationship Diagram

### MVP Schema

```
┌─────────────────┐       ┌─────────────────┐
│     users       │       │   dashboards    │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │──────<│ user_id (FK)    │
│ email           │       │ id (PK)         │
│ name            │       │ title           │
│ created_at      │       │ slug            │
└─────────────────┘       │ data            │
                          │ config          │
                          │ is_published    │
                          │ published_at    │
                          │ created_at      │
                          │ updated_at      │
                          └─────────────────┘
```

### Full Schema (Phase 2+)

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     users       │       │   workspaces    │       │   dashboards    │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │──┐    │ id (PK)         │──────<│ workspace_id    │
│ email           │  │    │ name            │       │ id (PK)         │
│ name            │  │    │ slug            │       │ title           │
│ avatar_url      │  │    │ type            │       │ slug            │
│ created_at      │  │    │ owner_id (FK)───│───────│ config          │
└─────────────────┘  │    │ logo_url        │       │ is_published    │
        │            │    │ primary_color   │       │ created_by (FK) │
        │            │    │ custom_domain   │       │ created_at      │
        │            │    │ plan            │       │ updated_at      │
        │            │    │ created_at      │       └────────┬────────┘
        │            │    └────────┬────────┘                │
        │            │             │                         │
        │            │             │                         │
        │    ┌───────┴─────────────┴───────┐                 │
        │    │   workspace_members         │                 │
        │    ├─────────────────────────────┤                 │
        └───>│ user_id (PK, FK)            │                 │
             │ workspace_id (PK, FK)       │                 │
             │ role                        │                 │
             │ invited_at                  │                 │
             │ joined_at                   │                 │
             └─────────────────────────────┘                 │
                                                             │
┌─────────────────┐       ┌─────────────────┐                │
│  access_rules   │       │  data_versions  │                │
├─────────────────┤       ├─────────────────┤                │
│ id (PK)         │       │ id (PK)         │                │
│ dashboard_id(FK)│<──────│ dashboard_id(FK)│<───────────────┘
│ type            │       │ version_number  │
│ allowed_domains │       │ data            │
│ allowed_emails  │       │ data_url        │
│ password_hash   │       │ uploaded_by(FK) │
│ created_at      │       │ created_at      │
└─────────────────┘       └─────────────────┘
```

---

## MVP Tables

### users

Managed by Supabase Auth. We extend with a profile table if needed.

```sql
-- Supabase Auth handles this table (auth.users)
-- We can access via auth.uid() in RLS policies

-- Optional: Profile extension
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### dashboards

Core table for MVP.

```sql
CREATE TABLE public.dashboards (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Owner (references Supabase auth.users)
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic info
  title VARCHAR(255) NOT NULL DEFAULT 'Untitled Dashboard',
  slug VARCHAR(100) NOT NULL,
  
  -- The raw data (stored as JSONB for MVP)
  -- For large datasets, we'll store in Supabase Storage and reference here
  data JSONB,
  data_url TEXT,  -- URL to Supabase Storage for large files
  
  -- Dashboard configuration (charts, layout, theme)
  config JSONB NOT NULL DEFAULT '{
    "charts": [],
    "layout": {},
    "theme": {}
  }'::jsonb,
  
  -- Publishing
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT dashboards_slug_unique UNIQUE (slug)
);

-- Indexes
CREATE INDEX idx_dashboards_user_id ON public.dashboards(user_id);
CREATE INDEX idx_dashboards_slug ON public.dashboards(slug);
CREATE INDEX idx_dashboards_is_published ON public.dashboards(is_published);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dashboards_updated_at
  BEFORE UPDATE ON public.dashboards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Row Level Security (MVP)

```sql
-- Enable RLS
ALTER TABLE public.dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only see/edit their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Dashboards: Users can CRUD their own dashboards
CREATE POLICY "Users can view own dashboards"
  ON public.dashboards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create dashboards"
  ON public.dashboards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own dashboards"
  ON public.dashboards FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own dashboards"
  ON public.dashboards FOR DELETE
  USING (auth.uid() = user_id);

-- Published dashboards: Anyone can view
CREATE POLICY "Anyone can view published dashboards"
  ON public.dashboards FOR SELECT
  USING (is_published = true);
```

---

## Phase 2 Tables

### workspaces

```sql
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic info
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  type VARCHAR(20) NOT NULL DEFAULT 'personal', -- 'personal' | 'team'
  
  -- Owner
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Branding
  logo_url TEXT,
  primary_color VARCHAR(7) DEFAULT '#3B82F6',
  accent_color VARCHAR(7) DEFAULT '#10B981',
  font_family VARCHAR(100) DEFAULT 'Inter',
  custom_domain VARCHAR(255) UNIQUE,
  show_zeno_badge BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Plan & limits
  plan VARCHAR(20) NOT NULL DEFAULT 'free', -- 'free' | 'pro'
  dashboard_limit INTEGER NOT NULL DEFAULT 3,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_workspaces_owner ON public.workspaces(owner_id);
CREATE INDEX idx_workspaces_slug ON public.workspaces(slug);
CREATE INDEX idx_workspaces_custom_domain ON public.workspaces(custom_domain);
```

### workspace_members

```sql
CREATE TABLE public.workspace_members (
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Role
  role VARCHAR(20) NOT NULL DEFAULT 'viewer', -- 'owner' | 'admin' | 'editor' | 'viewer'
  
  -- Invitation tracking
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  joined_at TIMESTAMP WITH TIME ZONE,
  
  PRIMARY KEY (workspace_id, user_id)
);

-- Indexes
CREATE INDEX idx_workspace_members_user ON public.workspace_members(user_id);
```

### invitations

```sql
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'editor',
  
  -- Invitation tracking
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_invitations_token ON public.invitations(token);
CREATE INDEX idx_invitations_email ON public.invitations(email);
```

### data_versions

```sql
CREATE TABLE public.data_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  dashboard_id UUID NOT NULL REFERENCES public.dashboards(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  
  -- Data storage
  data JSONB,           -- For small datasets (< 1MB)
  data_url TEXT,        -- For large datasets (Supabase Storage URL)
  
  -- Metadata
  row_count INTEGER,
  column_count INTEGER,
  columns JSONB,        -- [{name, type, sample_values}]
  file_name VARCHAR(255),
  file_size INTEGER,
  
  -- Tracking
  uploaded_by UUID REFERENCES auth.users(id),
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE (dashboard_id, version_number)
);

-- Indexes
CREATE INDEX idx_data_versions_dashboard ON public.data_versions(dashboard_id);
```

### access_rules

```sql
CREATE TABLE public.access_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  dashboard_id UUID NOT NULL REFERENCES public.dashboards(id) ON DELETE CASCADE,
  
  -- Access type
  type VARCHAR(20) NOT NULL, -- 'public' | 'domain' | 'email' | 'password'
  
  -- Type-specific config
  allowed_domains TEXT[],     -- For 'domain' type: ['acme.com', 'partner.co']
  allowed_emails TEXT[],      -- For 'email' type: ['alice@example.com']
  password_hash TEXT,         -- For 'password' type
  
  -- Options
  allow_download BOOLEAN DEFAULT FALSE,
  require_reauth_hours INTEGER, -- Re-verify after N hours
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_access_rules_dashboard ON public.access_rules(dashboard_id);
```

### dashboard_shares (for editor/viewer access)

```sql
CREATE TABLE public.dashboard_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  dashboard_id UUID NOT NULL REFERENCES public.dashboards(id) ON DELETE CASCADE,
  
  -- Who has access
  email VARCHAR(255) NOT NULL,
  user_id UUID REFERENCES auth.users(id), -- Populated when they sign up
  
  -- Permission level
  permission VARCHAR(20) NOT NULL DEFAULT 'viewer', -- 'editor' | 'viewer'
  
  -- Tracking
  shared_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE (dashboard_id, email)
);

-- Indexes
CREATE INDEX idx_dashboard_shares_dashboard ON public.dashboard_shares(dashboard_id);
CREATE INDEX idx_dashboard_shares_email ON public.dashboard_shares(email);
CREATE INDEX idx_dashboard_shares_user ON public.dashboard_shares(user_id);
```

---

## Phase 3 Tables

### subscriptions

```sql
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  
  -- Stripe data
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  stripe_price_id VARCHAR(255),
  
  -- Subscription details
  plan VARCHAR(20) NOT NULL DEFAULT 'free', -- 'free' | 'pro'
  seats INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active' | 'past_due' | 'canceled' | 'trialing'
  
  -- Billing period
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_subscriptions_workspace ON public.subscriptions(workspace_id);
CREATE INDEX idx_subscriptions_stripe_customer ON public.subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_stripe_subscription ON public.subscriptions(stripe_subscription_id);
```

---

## Analytics Tables

### dashboard_views

```sql
CREATE TABLE public.dashboard_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  dashboard_id UUID NOT NULL REFERENCES public.dashboards(id) ON DELETE CASCADE,
  
  -- Viewer info
  viewer_email VARCHAR(255),  -- If authenticated
  viewer_user_id UUID REFERENCES auth.users(id),
  viewer_ip INET,
  user_agent TEXT,
  referer TEXT,
  
  -- Timestamp
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_dashboard_views_dashboard ON public.dashboard_views(dashboard_id);
CREATE INDEX idx_dashboard_views_viewed_at ON public.dashboard_views(viewed_at);

-- Partitioning for performance (optional, for scale)
-- CREATE TABLE public.dashboard_views (
--   ...
-- ) PARTITION BY RANGE (viewed_at);
```

---

## Migration Strategy

### MVP Migration

```sql
-- migrations/001_mvp.sql

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create dashboards table
CREATE TABLE public.dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL DEFAULT 'Untitled Dashboard',
  slug VARCHAR(100) NOT NULL UNIQUE,
  data JSONB,
  data_url TEXT,
  config JSONB NOT NULL DEFAULT '{"charts": [], "layout": {}, "theme": {}}'::jsonb,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_dashboards_user_id ON public.dashboards(user_id);
CREATE INDEX idx_dashboards_slug ON public.dashboards(slug);
CREATE INDEX idx_dashboards_is_published ON public.dashboards(is_published);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboards ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can view own dashboards" ON public.dashboards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create dashboards" ON public.dashboards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own dashboards" ON public.dashboards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own dashboards" ON public.dashboards FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view published dashboards" ON public.dashboards FOR SELECT USING (is_published = true);

-- Create triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dashboards_updated_at
  BEFORE UPDATE ON public.dashboards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## TypeScript Types

Generated from the schema for use in the application:

```typescript
// types/database.ts

export interface Profile {
  id: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Dashboard {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  data: Record<string, unknown>[] | null;
  data_url: string | null;
  config: DashboardConfig;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardConfig {
  title?: string;
  description?: string;
  charts: ChartConfig[];
  layout?: LayoutConfig;
  theme?: ThemeConfig;
}

export interface ChartConfig {
  id: string;
  type: 'number_card' | 'line' | 'bar' | 'area' | 'pie' | 'table';
  title: string;
  config: Record<string, unknown>;
}

export interface LayoutConfig {
  columns?: number;
  gap?: number;
}

export interface ThemeConfig {
  primaryColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
}

// Supabase Database type (for client generation)
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id'>>;
      };
      dashboards: {
        Row: Dashboard;
        Insert: Omit<Dashboard, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Dashboard, 'id' | 'user_id'>>;
      };
    };
  };
}
```

