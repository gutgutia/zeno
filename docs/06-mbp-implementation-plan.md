# Zeno MVP Implementation Plan (MBP)

## Executive Summary

This document defines the Minimum Build Plan (MBP) for Zeno's MVP. The goal is to ship a working product where users can:

1. Sign up with email magic link
2. Paste/upload data
3. Get an AI-generated dashboard
4. Iterate via chat
5. Publish and share publicly

**Architecture Principle:** Build for a single user now, but structure code for easy extension to workspaces, teams, and advanced sharing later.

---

## MVP Scope Definition

### In Scope (MVP)

| Feature | Description | Priority |
|---------|-------------|----------|
| Email Auth | Magic link sign-in via Supabase | P0 |
| Personal Workspace | Auto-created on signup (implicit, not exposed in UI) | P0 |
| Dashboard List | View all my dashboards | P0 |
| Create Dashboard | New dashboard with title | P0 |
| Data Input - Paste | Paste CSV/JSON/tab-delimited data | P0 |
| Data Input - Upload | Upload CSV/Excel (.xlsx) files | P0 |
| AI Generation | Claude generates initial dashboard config | P0 |
| Chat Iteration | Modify dashboard via natural language | P0 |
| Dashboard Rendering | Render charts from config using Recharts | P0 |
| Publish Toggle | Make dashboard publicly accessible | P0 |
| Public Viewer | Clean, read-only view at `/d/[slug]` | P0 |
| Zeno Branding | "Made with Zeno" badge on public dashboards | P0 |

### Out of Scope (Post-MVP)

| Feature | Phase | Notes |
|---------|-------|-------|
| Team Workspaces | Phase 2 | Create/manage team workspaces |
| Member Invitations | Phase 2 | Invite users to workspaces |
| Workspace-level Settings | Phase 2 | Branding, permissions |
| Dashboard Sharing (editors/viewers) | Phase 2 | Share with specific users |
| Access Restrictions | Phase 2 | Domain/email allowlists, passwords |
| Linked Data Sources | Phase 2 | Google Sheets, Airtable auto-sync |
| Data Versioning UI | Phase 2 | View/restore previous versions |
| Commenting | Phase 2 | Comments on dashboards |
| Custom Subdomains | Phase 3 | `team.zeno.fyi` |
| Custom Domains | Phase 3 | CNAME support |
| Stripe Billing | Phase 3 | Pro subscriptions |
| Branding Controls | Phase 3 | Remove Zeno badge, custom colors |

---

## Architecture Decisions for Extensibility

### 1. Workspace-First Data Model

Even though MVP is single-user, we structure the database with workspaces from day one:

```
User (auth.users)
  └── Workspace (personal, auto-created)
        └── Dashboard
              └── DataVersion (for future versioning)
```

**Why:** Adding team workspaces later is just creating a new workspace type and adding `workspace_members` table. No data migrations needed.

**MVP Implementation:**
- Create `workspaces` table with `type = 'personal'`
- Auto-create personal workspace on user signup
- Dashboards belong to workspace, not directly to user
- UI doesn't expose workspaces (just shows "My Dashboards")

### 2. Data Source Abstraction

Structure data input to support multiple sources:

```typescript
interface DataSource {
  type: 'paste' | 'upload' | 'google_sheets' | 'airtable' | 'url';
  config: {
    // Type-specific config
  };
  lastSyncedAt?: Date;
  syncSchedule?: string; // cron for future
}
```

**MVP Implementation:**
- Support `paste` and `upload` types only
- Store raw data + source metadata
- Design schema to accommodate linked sources later

### 3. Permission System Hooks

Build permission checks as a service layer:

```typescript
// lib/permissions.ts
export async function canViewDashboard(userId: string | null, dashboardId: string): Promise<boolean>;
export async function canEditDashboard(userId: string, dashboardId: string): Promise<boolean>;
export async function canPublishDashboard(userId: string, dashboardId: string): Promise<boolean>;
```

**MVP Implementation:**
- Simple owner-based checks
- Easy to extend for workspace roles, sharing, etc.

### 4. Component Architecture

Build UI components that can adapt to different contexts:

```
components/
├── ui/                    # Primitives (button, input, modal)
├── charts/                # Chart renderers (context-agnostic)
├── dashboard/             # Dashboard-specific (editor, viewer)
├── data/                  # Data input components
└── layout/                # App shell, navigation
```

---

## Implementation Phases

### Phase 0: Project Setup (Foundation)

**Goal:** Set up the development environment, install dependencies, configure Supabase.

#### Tasks

| # | Task | Files |
|---|------|-------|
| 0.1 | Install core dependencies | `package.json` |
| 0.2 | Configure Supabase client (stubbed) | `lib/supabase/client.ts`, `lib/supabase/server.ts` |
| 0.3 | Set up environment variables template | `.env.example` |
| 0.4 | Create database types | `types/database.ts` |
| 0.5 | Create dashboard config types | `types/dashboard.ts`, `types/chart.ts` |
| 0.6 | Set up Tailwind with design tokens | `tailwind.config.ts`, `globals.css` |
| 0.7 | Create base UI components | `components/ui/*` |

#### Dependencies to Install

```bash
# Supabase
@supabase/supabase-js
@supabase/ssr

# AI
@anthropic-ai/sdk

# Charts
recharts

# Data parsing
papaparse
xlsx

# Utilities
zod              # Schema validation
nanoid           # ID generation
clsx             # Classname utility
tailwind-merge   # Tailwind class merging

# Dev
@types/papaparse
```

---

### Phase 1: Authentication

**Goal:** Users can sign up/login with email magic link.

#### Tasks

| # | Task | Files |
|---|------|-------|
| 1.1 | Create login page UI | `app/login/page.tsx` |
| 1.2 | Implement magic link request | `app/api/auth/magic-link/route.ts` |
| 1.3 | Handle auth callback | `app/auth/callback/route.ts` |
| 1.4 | Create auth middleware | `middleware.ts` |
| 1.5 | Auto-create personal workspace on signup | `lib/supabase/triggers.ts` (doc) |
| 1.6 | Create auth context/hooks | `lib/hooks/use-auth.ts` |
| 1.7 | Add sign out functionality | Header component |

#### User Flow

```
/login → Enter email → Send magic link → Email received →
Click link → /auth/callback → Redirect to /dashboards
```

#### Database (Migration 001)

```sql
-- profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  name VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- workspaces table
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  type VARCHAR(20) NOT NULL DEFAULT 'personal', -- 'personal' | 'team'
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create personal workspace trigger
CREATE FUNCTION create_personal_workspace()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO workspaces (name, slug, type, owner_id)
  VALUES ('Personal', 'personal-' || NEW.id, 'personal', NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_personal_workspace();
```

---

### Phase 2: Dashboard CRUD & List

**Goal:** Users can see their dashboards and create new ones.

#### Tasks

| # | Task | Files |
|---|------|-------|
| 2.1 | Create dashboards table migration | `supabase/migrations/002_dashboards.sql` |
| 2.2 | Create dashboard list page | `app/dashboards/page.tsx` |
| 2.3 | Create empty state component | `components/dashboard/empty-state.tsx` |
| 2.4 | Create dashboard card component | `components/dashboard/dashboard-card.tsx` |
| 2.5 | Create "New Dashboard" button/flow | `app/dashboards/new/page.tsx` |
| 2.6 | Implement dashboard API routes | `app/api/dashboards/route.ts` |
| 2.7 | Implement single dashboard API | `app/api/dashboards/[id]/route.ts` |
| 2.8 | Add delete dashboard functionality | Dashboard card menu |
| 2.9 | Create app header/navigation | `components/layout/header.tsx` |

#### Database (Migration 002)

```sql
CREATE TABLE dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  title VARCHAR(255) NOT NULL DEFAULT 'Untitled Dashboard',
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,

  -- Data source info (extensible for linked sources)
  data_source JSONB NOT NULL DEFAULT '{"type": "paste"}'::jsonb,
  data JSONB,                    -- Parsed data rows
  data_url TEXT,                 -- For large files in storage

  -- Dashboard configuration
  config JSONB NOT NULL DEFAULT '{"charts": []}'::jsonb,

  -- Publishing
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_dashboards_workspace ON dashboards(workspace_id);
CREATE INDEX idx_dashboards_slug ON dashboards(slug);
CREATE INDEX idx_dashboards_published ON dashboards(is_published) WHERE is_published = true;

-- RLS Policies
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;

-- Owner can do everything (via workspace)
CREATE POLICY "Workspace owner full access"
  ON dashboards FOR ALL
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- Anyone can view published dashboards
CREATE POLICY "Public can view published"
  ON dashboards FOR SELECT
  USING (is_published = true);
```

---

### Phase 3: Data Input

**Goal:** Users can paste data or upload files, which gets parsed and stored.

#### Tasks

| # | Task | Files |
|---|------|-------|
| 3.1 | Create data input page UI | `app/dashboards/new/page.tsx` |
| 3.2 | Build paste textarea component | `components/data/paste-input.tsx` |
| 3.3 | Build file upload component | `components/data/file-upload.tsx` |
| 3.4 | Implement CSV parser | `lib/data/parser.ts` |
| 3.5 | Implement Excel parser | `lib/data/parser.ts` |
| 3.6 | Implement data analyzer | `lib/data/analyzer.ts` |
| 3.7 | Create data preview component | `components/data/data-preview.tsx` |
| 3.8 | Handle file upload to Supabase Storage | `lib/supabase/storage.ts` |
| 3.9 | Save parsed data to dashboard | API integration |

#### Data Flow

```
User pastes/uploads → Parse (papaparse/xlsx) → Analyze schema →
Show preview → User confirms → Save to database → Redirect to editor
```

#### Key Types

```typescript
// lib/data/types.ts

interface ParsedData {
  rows: Record<string, unknown>[];
  columns: string[];
  errors: ParseError[];
}

interface DataSchema {
  columns: ColumnInfo[];
  rowCount: number;
  sampleRows: Record<string, unknown>[];
}

interface ColumnInfo {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  nullable: boolean;
  uniqueValues?: (string | number)[];  // For low-cardinality
  stats?: {
    min?: number;
    max?: number;
    avg?: number;
  };
  sampleValues: unknown[];
}

interface DataSource {
  type: 'paste' | 'upload' | 'google_sheets' | 'airtable';
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  // Future: sheetId, tableId, syncConfig, etc.
}
```

---

### Phase 4: AI Dashboard Generation

**Goal:** Claude analyzes data schema and generates initial dashboard config.

#### Tasks

| # | Task | Files |
|---|------|-------|
| 4.1 | Create Claude API wrapper | `lib/ai/claude.ts` |
| 4.2 | Define system prompt | `lib/ai/prompts.ts` |
| 4.3 | Define generation prompt | `lib/ai/prompts.ts` |
| 4.4 | Create config validation | `lib/ai/schema.ts` |
| 4.5 | Build generate API route | `app/api/ai/generate/route.ts` |
| 4.6 | Create loading/generating UI | `components/dashboard/generating-state.tsx` |
| 4.7 | Implement fallback config | `lib/ai/fallback.ts` |
| 4.8 | Add error handling | Throughout |

#### API Flow

```
POST /api/ai/generate
Body: { dashboardId, schema, title? }

1. Validate request + auth
2. Build prompt with schema
3. Call Claude API
4. Parse JSON response
5. Validate config against schema
6. Save config to dashboard
7. Return config
```

#### Prompt Strategy

- Send **schema only** to Claude (not full data)
- Include sample rows for context
- Request specific JSON structure
- Validate output matches our ChartConfig types

---

### Phase 5: Chart Rendering

**Goal:** Render dashboards from config using Recharts.

#### Tasks

| # | Task | Files |
|---|------|-------|
| 5.1 | Create chart renderer (router) | `components/charts/chart-renderer.tsx` |
| 5.2 | Build NumberCard component | `components/charts/number-card.tsx` |
| 5.3 | Build LineChart component | `components/charts/line-chart.tsx` |
| 5.4 | Build BarChart component | `components/charts/bar-chart.tsx` |
| 5.5 | Build AreaChart component | `components/charts/area-chart.tsx` |
| 5.6 | Build PieChart component | `components/charts/pie-chart.tsx` |
| 5.7 | Build DataTable component | `components/charts/data-table.tsx` |
| 5.8 | Create data aggregator | `lib/data/aggregator.ts` |
| 5.9 | Create dashboard grid layout | `components/dashboard/dashboard-grid.tsx` |
| 5.10 | Add chart loading states | Each chart component |
| 5.11 | Add chart error states | Each chart component |

#### Chart Config Types

```typescript
// types/chart.ts

type ChartType = 'number_card' | 'line' | 'bar' | 'area' | 'pie' | 'table';

interface BaseChartConfig {
  id: string;
  type: ChartType;
  title: string;
  description?: string;
}

interface NumberCardConfig extends BaseChartConfig {
  type: 'number_card';
  config: {
    column: string;
    aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'latest';
    format?: 'number' | 'currency' | 'percent' | 'compact';
    prefix?: string;
    suffix?: string;
  };
}

interface LineChartConfig extends BaseChartConfig {
  type: 'line';
  config: {
    xAxis: { column: string; type?: 'category' | 'time' };
    yAxis: { column: string; aggregation?: AggregationType; format?: FormatType };
    splitBy?: string;
    colors?: string[];
    showDots?: boolean;
    smooth?: boolean;
  };
}

// ... similar for bar, area, pie, table
```

---

### Phase 6: Dashboard Editor

**Goal:** Full editor UI with chart display and chat panel.

#### Tasks

| # | Task | Files |
|---|------|-------|
| 6.1 | Create editor page layout | `app/dashboards/[id]/page.tsx` |
| 6.2 | Build editor header | `components/dashboard/editor-header.tsx` |
| 6.3 | Build dashboard canvas | `components/dashboard/dashboard-canvas.tsx` |
| 6.4 | Build chat panel | `components/dashboard/chat-panel.tsx` |
| 6.5 | Create chat message components | `components/dashboard/chat-message.tsx` |
| 6.6 | Add chat input with send | `components/dashboard/chat-input.tsx` |
| 6.7 | Implement real-time config updates | State management |
| 6.8 | Add "Back to dashboards" navigation | Header |
| 6.9 | Show dashboard title (editable) | Header |

#### Editor Layout

```
┌─────────────────────────────────────────────────────────────┐
│ ← Back    Dashboard Title              [Publish ▼]   [⚙️]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌──────────────────┐  ┌──────────────────┐               │
│   │   Number Card    │  │   Number Card    │               │
│   └──────────────────┘  └──────────────────┘               │
│                                                             │
│   ┌────────────────────────────────────────────────────┐   │
│   │              Line/Bar Chart                         │   │
│   └────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ 💬 Chat with AI                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ User: Make the revenue chart a bar chart               ││
│ │ AI: Done! I've converted the line chart to a bar...    ││
│ └─────────────────────────────────────────────────────────┘│
│ ┌───────────────────────────────────────────────┐ [Send]   │
│ │ Type a message...                              │          │
│ └───────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

---

### Phase 7: Chat Iteration

**Goal:** Users can modify dashboards via natural language chat.

#### Tasks

| # | Task | Files |
|---|------|-------|
| 7.1 | Create iteration prompt | `lib/ai/prompts.ts` |
| 7.2 | Build iterate API route | `app/api/ai/iterate/route.ts` |
| 7.3 | Store chat history | State or database |
| 7.4 | Handle streaming responses (optional) | API route + client |
| 7.5 | Show AI "thinking" state | Chat panel |
| 7.6 | Animate config changes | Dashboard canvas |
| 7.7 | Add undo functionality (optional P1) | State management |

#### Iteration Flow

```
User types message → POST /api/ai/iterate →
Send current config + schema + message to Claude →
Claude returns updated config → Validate →
Update dashboard in DB → Return to client →
Re-render charts with new config
```

---

### Phase 8: Publishing & Public Viewer

**Goal:** Users can publish dashboards and anyone can view via public link.

#### Tasks

| # | Task | Files |
|---|------|-------|
| 8.1 | Build publish modal | `components/dashboard/publish-modal.tsx` |
| 8.2 | Generate/display public URL | `lib/utils/slug.ts` |
| 8.3 | Add copy link functionality | Publish modal |
| 8.4 | Implement publish/unpublish toggle | API + UI |
| 8.5 | Create public viewer page | `app/d/[slug]/page.tsx` |
| 8.6 | Style public viewer (clean, minimal) | `app/d/[slug]/page.tsx` |
| 8.7 | Add "Made with Zeno" badge | Public viewer footer |
| 8.8 | Add "Create your own" CTA | Badge link |
| 8.9 | Handle 404 for unpublished/missing | Error page |

#### Public Viewer

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                  📊 Dashboard Title                         │
│                                                             │
│   ┌──────────────────┐  ┌──────────────────┐               │
│   │   Number Card    │  │   Number Card    │               │
│   └──────────────────┘  └──────────────────┘               │
│                                                             │
│   ┌────────────────────────────────────────────────────┐   │
│   │              Charts...                              │   │
│   └────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│      Made with Zeno · Create your own dashboard →          │
└─────────────────────────────────────────────────────────────┘
```

---

### Phase 9: Landing Page

**Goal:** Marketing landing page at `/` for new visitors.

#### Tasks

| # | Task | Files |
|---|------|-------|
| 9.1 | Design hero section | `app/page.tsx` |
| 9.2 | Add value proposition | Hero section |
| 9.3 | Create "Get Started" CTA | Links to /login |
| 9.4 | Add feature highlights | Below hero |
| 9.5 | Add example dashboard preview | Optional |
| 9.6 | Create footer | `components/layout/footer.tsx` |

---

### Phase 10: Polish & Testing

**Goal:** Bug fixes, edge cases, UX improvements.

#### Tasks

| # | Task | Description |
|---|------|-------------|
| 10.1 | Error boundaries | Catch React errors gracefully |
| 10.2 | Loading states | Skeletons, spinners |
| 10.3 | Empty states | No data, no dashboards |
| 10.4 | Form validation | Login, data input |
| 10.5 | Mobile responsiveness | Key pages |
| 10.6 | Keyboard navigation | Accessibility |
| 10.7 | Toast notifications | Success/error feedback |
| 10.8 | Rate limiting | AI endpoints |
| 10.9 | Manual testing | All user flows |

---

## File Structure (MVP)

```
zeno/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Landing page
│   │   ├── layout.tsx                  # Root layout
│   │   ├── globals.css                 # Global styles
│   │   ├── login/
│   │   │   └── page.tsx                # Login page
│   │   ├── auth/
│   │   │   └── callback/
│   │   │       └── route.ts            # Magic link handler
│   │   ├── dashboards/
│   │   │   ├── page.tsx                # Dashboard list
│   │   │   ├── new/
│   │   │   │   └── page.tsx            # New dashboard (data input)
│   │   │   └── [id]/
│   │   │       └── page.tsx            # Dashboard editor
│   │   ├── d/
│   │   │   └── [slug]/
│   │   │       └── page.tsx            # Public viewer
│   │   └── api/
│   │       ├── auth/
│   │       │   └── magic-link/
│   │       │       └── route.ts
│   │       ├── dashboards/
│   │       │   ├── route.ts            # GET list, POST create
│   │       │   └── [id]/
│   │       │       └── route.ts        # GET, PUT, DELETE
│   │       └── ai/
│   │           ├── generate/
│   │           │   └── route.ts
│   │           └── iterate/
│   │               └── route.ts
│   │
│   ├── components/
│   │   ├── ui/
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── modal.tsx
│   │   │   ├── card.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── spinner.tsx
│   │   │   ├── toast.tsx
│   │   │   └── dropdown.tsx
│   │   ├── charts/
│   │   │   ├── chart-renderer.tsx
│   │   │   ├── number-card.tsx
│   │   │   ├── line-chart.tsx
│   │   │   ├── bar-chart.tsx
│   │   │   ├── area-chart.tsx
│   │   │   ├── pie-chart.tsx
│   │   │   └── data-table.tsx
│   │   ├── dashboard/
│   │   │   ├── dashboard-grid.tsx
│   │   │   ├── dashboard-card.tsx
│   │   │   ├── editor-header.tsx
│   │   │   ├── chat-panel.tsx
│   │   │   ├── chat-input.tsx
│   │   │   ├── chat-message.tsx
│   │   │   ├── publish-modal.tsx
│   │   │   ├── empty-state.tsx
│   │   │   └── generating-state.tsx
│   │   ├── data/
│   │   │   ├── paste-input.tsx
│   │   │   ├── file-upload.tsx
│   │   │   └── data-preview.tsx
│   │   └── layout/
│   │       ├── header.tsx
│   │       └── footer.tsx
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts               # Browser client
│   │   │   ├── server.ts               # Server client
│   │   │   └── middleware.ts           # Auth middleware
│   │   ├── ai/
│   │   │   ├── claude.ts               # Claude API wrapper
│   │   │   ├── prompts.ts              # System + generation prompts
│   │   │   ├── schema.ts               # Config validation
│   │   │   └── fallback.ts             # Fallback config generator
│   │   ├── data/
│   │   │   ├── parser.ts               # CSV/Excel parsing
│   │   │   ├── analyzer.ts             # Schema extraction
│   │   │   └── aggregator.ts           # Chart data aggregation
│   │   ├── hooks/
│   │   │   ├── use-auth.ts
│   │   │   ├── use-dashboard.ts
│   │   │   └── use-chat.ts
│   │   ├── utils/
│   │   │   ├── slug.ts                 # Slug generation
│   │   │   ├── format.ts               # Number/date formatting
│   │   │   └── cn.ts                   # classname utility
│   │   └── permissions.ts              # Permission checks (extensible)
│   │
│   └── types/
│       ├── database.ts                 # Supabase types
│       ├── dashboard.ts                # Dashboard config types
│       └── chart.ts                    # Chart config types
│
├── supabase/
│   └── migrations/
│       ├── 001_profiles_workspaces.sql
│       └── 002_dashboards.sql
│
├── public/
│   ├── logo.svg
│   └── favicon.ico
│
├── .env.example
├── .env.local
├── middleware.ts                       # Next.js middleware for auth
├── package.json
├── tsconfig.json
└── tailwind.config.ts
```

---

## Database Migrations Summary

### Migration 001: Profiles & Workspaces

```sql
-- profiles (extends auth.users)
-- workspaces (personal workspace auto-created)
-- Trigger: create_personal_workspace on user signup
```

### Migration 002: Dashboards

```sql
-- dashboards (belongs to workspace)
-- data_source JSONB for extensibility
-- RLS policies for owner access + public viewing
```

---

## API Routes Summary

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| POST | `/api/auth/magic-link` | Request magic link email | No |
| GET | `/auth/callback` | Handle magic link redirect | No |
| GET | `/api/dashboards` | List user's dashboards | Yes |
| POST | `/api/dashboards` | Create new dashboard | Yes |
| GET | `/api/dashboards/[id]` | Get dashboard by ID | Yes |
| PUT | `/api/dashboards/[id]` | Update dashboard | Yes |
| DELETE | `/api/dashboards/[id]` | Delete dashboard | Yes |
| POST | `/api/ai/generate` | Generate initial config | Yes |
| POST | `/api/ai/iterate` | Modify config via chat | Yes |

---

## Full Scope: Linked Data Sources (Phase 2)

### Overview

Users can connect dashboards to external data sources (Google Sheets, Airtable). When the source updates, the dashboard data updates automatically.

### Supported Sources (Initial)

| Source | Sync Method | Auth |
|--------|-------------|------|
| Google Sheets | Polling or webhook | OAuth 2.0 |
| Airtable | Polling or webhook | API key |

### Data Model Extension

```sql
-- Add to dashboards table
ALTER TABLE dashboards ADD COLUMN data_source JSONB DEFAULT '{"type": "paste"}';

-- data_source examples:
-- Paste: {"type": "paste"}
-- Upload: {"type": "upload", "fileName": "sales.csv", "fileSize": 12345}
-- Google Sheets: {
--   "type": "google_sheets",
--   "sheetId": "1abc...",
--   "sheetName": "Sheet1",
--   "range": "A1:Z1000",
--   "credentials": "encrypted_ref",
--   "syncSchedule": "*/15 * * * *"  -- every 15 min
-- }
-- Airtable: {
--   "type": "airtable",
--   "baseId": "app...",
--   "tableId": "tbl...",
--   "viewId": "viw...",
--   "credentials": "encrypted_ref",
--   "syncSchedule": "0 * * * *"  -- every hour
-- }
```

### Sync Mechanism

```typescript
// lib/data-sources/sync.ts

interface SyncResult {
  success: boolean;
  rowCount: number;
  versionNumber: number;
  changedAt: Date;
  error?: string;
}

async function syncDataSource(dashboard: Dashboard): Promise<SyncResult> {
  const source = dashboard.data_source;

  switch (source.type) {
    case 'google_sheets':
      return syncGoogleSheets(dashboard, source);
    case 'airtable':
      return syncAirtable(dashboard, source);
    default:
      return { success: true, rowCount: 0, versionNumber: 0, changedAt: new Date() };
  }
}
```

### UI Flow

1. In dashboard editor, user clicks "Connect Data Source"
2. Choose Google Sheets or Airtable
3. OAuth flow or API key entry
4. Select sheet/table
5. Configure sync schedule (optional)
6. Dashboard now shows "Connected" badge
7. Data auto-updates based on schedule
8. User can manually trigger sync

### Versioning

Each sync creates a new `data_version` record, allowing rollback.

---

## Implementation Order Summary

```
Phase 0: Project Setup (Foundation)
    ↓
Phase 1: Authentication
    ↓
Phase 2: Dashboard CRUD & List
    ↓
Phase 3: Data Input
    ↓
Phase 4: AI Dashboard Generation
    ↓
Phase 5: Chart Rendering
    ↓
Phase 6: Dashboard Editor
    ↓
Phase 7: Chat Iteration
    ↓
Phase 8: Publishing & Public Viewer
    ↓
Phase 9: Landing Page
    ↓
Phase 10: Polish & Testing
```

---

## Success Criteria

### MVP is complete when:

- [ ] User can sign up with email magic link
- [ ] User can see list of their dashboards
- [ ] User can create a new dashboard
- [ ] User can paste CSV data
- [ ] User can upload CSV/Excel file
- [ ] AI generates initial charts from data
- [ ] User can chat to modify dashboard
- [ ] User can publish dashboard
- [ ] Anyone with link can view published dashboard
- [ ] Published dashboard shows "Made with Zeno" badge
- [ ] App works on desktop browsers

---

## Notes

- **Supabase credentials** will be added to `.env.local` (stubbed for now)
- **Anthropic API key** will be added to `.env.local` (stubbed for now)
- **Workspace UI is hidden** in MVP but data model supports it
- **Permission system** uses simple owner checks, extensible for roles
- **Data source abstraction** ready for linked sources in Phase 2
