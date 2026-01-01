# Zeno Technical Architecture

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Framework** | Next.js 14 (App Router) | Full-stack React framework |
| **Language** | TypeScript | Type safety |
| **Database** | PostgreSQL (Supabase) | Relational data storage |
| **Auth** | Supabase Auth | Email magic links |
| **Storage** | Supabase Storage | File uploads (CSV, Excel, logos) |
| **AI** | Claude (Anthropic) | Dashboard generation & iteration |
| **Charts** | Recharts | React charting library |
| **Styling** | Tailwind CSS | Utility-first CSS |
| **Payments** | Stripe | Subscriptions (Phase 3) |
| **Email** | Resend | Transactional emails |
| **Hosting** | Vercel | Next.js hosting with edge functions |
| **Domain** | GoDaddy | DNS management |

---

## Why This Stack?

### PostgreSQL over MongoDB

Zeno's data is **relational**:

```
User ──┬── owns ──→ Workspace ──┬── contains ──→ Dashboard ──→ DataVersions
       │                        │
       └── member of ───────────┘
```

**PostgreSQL advantages:**
- Strong referential integrity (foreign keys)
- Complex queries (JOINs for access control)
- JSONB for flexible fields (dashboard config)
- Transactional consistency (critical for publishing)
- Supabase ecosystem (auth, storage, realtime)

**MongoDB would require:**
- Manual relationship management
- Eventual consistency issues
- Separate auth/storage solutions

### Supabase as All-in-One Backend

Supabase provides:
- ✅ PostgreSQL database with good DX
- ✅ Magic link authentication built-in
- ✅ File storage with CDN
- ✅ Row Level Security (RLS) for data access
- ✅ Realtime subscriptions (future: collaboration)
- ✅ Edge Functions if needed

**Alternative considered:** Separate services (Auth0 + S3 + raw Postgres)
**Why Supabase:** Faster development, single dashboard, integrated security

### Recharts for Visualizations

**Why Recharts:**
- React-native (no DOM manipulation)
- Declarative API (config → chart)
- Good TypeScript support
- Responsive by default
- Active maintenance

**Alternatives considered:**
- Chart.js — More jQuery-style API
- Plotly — Heavier, overkill for our needs
- D3 — Too low-level, requires more code
- Visx — Good but less out-of-box charts

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                           VERCEL                                 │
│                    (Hosts Next.js App)                           │
│         zeno.fyi | *.zeno.fyi | custom domains                  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    Next.js Application                      │ │
│  │                                                             │ │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │ │
│  │   │  Landing    │  │  Dashboard  │  │   Public    │       │ │
│  │   │   Page      │  │   Editor    │  │   Viewer    │       │ │
│  │   └─────────────┘  └─────────────┘  └─────────────┘       │ │
│  │                                                             │ │
│  │   ┌─────────────────────────────────────────────────────┐  │ │
│  │   │              API Routes (/api/*)                     │  │ │
│  │   │  • /api/dashboards      - CRUD operations           │  │ │
│  │   │  • /api/ai/generate     - Initial dashboard gen     │  │ │
│  │   │  • /api/ai/iterate      - Chat modifications        │  │ │
│  │   │  • /api/upload          - File upload handling      │  │ │
│  │   └─────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│    SUPABASE     │  │     CLAUDE      │  │     RESEND      │
│                 │  │   (Anthropic)   │  │    (Email)      │
│  • PostgreSQL   │  │                 │  │                 │
│  • Auth         │  │  Dashboard      │  │  Magic links    │
│  • Storage      │  │  generation     │  │  Notifications  │
│                 │  │  & iteration    │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
          │
          ▼
    ┌─────────────────┐
    │     STRIPE      │
    │   (Phase 3)     │
    │                 │
    │  Subscriptions  │
    │  Seat billing   │
    └─────────────────┘
```

---

## Request Flow

### Creating a Dashboard

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Browser │────▶│ Next.js  │────▶│  Claude  │────▶│ Supabase │
│          │     │   API    │     │   API    │     │    DB    │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                 │                │
     │  1. POST /api/dashboards/generate                 │
     │     { title, rawData }                            │
     │                │                                  │
     │                │  2. Parse data, extract schema   │
     │                │                                  │
     │                │  3. POST to Claude API           │
     │                │     { schema, prompt }           │
     │                │                                  │
     │                │◀─────────────────┘               │
     │                │  4. Receive dashboard config     │
     │                │                                  │
     │                │  5. INSERT dashboard             │
     │                │─────────────────────────────────▶│
     │                │                                  │
     │◀───────────────┘                                  │
     │  6. Return dashboard with config                  │
     │                                                   │
     │  7. Render charts using config                    │
```

### Chat Iteration

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Browser │────▶│ Next.js  │────▶│  Claude  │────▶│ Supabase │
│          │     │   API    │     │   API    │     │    DB    │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                 │                │
     │  1. POST /api/ai/iterate                          │
     │     { dashboardId, message }                      │
     │                │                                  │
     │                │  2. Fetch current config         │
     │                │◀─────────────────────────────────│
     │                │                                  │
     │                │  3. POST to Claude API           │
     │                │     { currentConfig, message }   │
     │                │                                  │
     │                │◀─────────────────┘               │
     │                │  4. Receive updated config       │
     │                │                                  │
     │                │  5. UPDATE dashboard config      │
     │                │─────────────────────────────────▶│
     │                │                                  │
     │◀───────────────┘                                  │
     │  6. Return updated config                         │
     │                                                   │
     │  7. Re-render charts with new config              │
```

---

## Project Structure

```
zeno/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── page.tsx              # Landing page
│   │   ├── layout.tsx            # Root layout
│   │   ├── globals.css           # Global styles
│   │   │
│   │   ├── login/
│   │   │   └── page.tsx          # Login page
│   │   │
│   │   ├── auth/
│   │   │   └── callback/
│   │   │       └── route.ts      # Magic link handler
│   │   │
│   │   ├── dashboards/
│   │   │   ├── page.tsx          # Dashboard list
│   │   │   ├── new/
│   │   │   │   └── page.tsx      # New dashboard
│   │   │   └── [id]/
│   │   │       └── page.tsx      # Dashboard editor
│   │   │
│   │   ├── d/
│   │   │   └── [slug]/
│   │   │       └── page.tsx      # Public viewer
│   │   │
│   │   └── api/
│   │       ├── dashboards/
│   │       │   ├── route.ts      # GET, POST dashboards
│   │       │   └── [id]/
│   │       │       └── route.ts  # GET, PUT, DELETE dashboard
│   │       │
│   │       ├── ai/
│   │       │   ├── generate/
│   │       │   │   └── route.ts  # Generate initial dashboard
│   │       │   └── iterate/
│   │       │       └── route.ts  # Chat iteration
│   │       │
│   │       └── upload/
│   │           └── route.ts      # File upload handling
│   │
│   ├── components/
│   │   ├── ui/                   # Reusable UI components
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── modal.tsx
│   │   │   └── ...
│   │   │
│   │   ├── charts/               # Chart components
│   │   │   ├── chart-renderer.tsx
│   │   │   ├── number-card.tsx
│   │   │   ├── line-chart.tsx
│   │   │   ├── bar-chart.tsx
│   │   │   ├── pie-chart.tsx
│   │   │   └── data-table.tsx
│   │   │
│   │   ├── dashboard/            # Dashboard-specific components
│   │   │   ├── dashboard-grid.tsx
│   │   │   ├── dashboard-header.tsx
│   │   │   ├── chat-panel.tsx
│   │   │   └── publish-modal.tsx
│   │   │
│   │   └── layout/               # Layout components
│   │       ├── header.tsx
│   │       ├── sidebar.tsx
│   │       └── footer.tsx
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts         # Browser client
│   │   │   ├── server.ts         # Server client
│   │   │   └── middleware.ts     # Auth middleware
│   │   │
│   │   ├── ai/
│   │   │   ├── claude.ts         # Claude API wrapper
│   │   │   ├── prompts.ts        # System prompts
│   │   │   └── schema.ts         # Config schema for Claude
│   │   │
│   │   ├── data/
│   │   │   ├── parser.ts         # CSV/Excel parsing
│   │   │   ├── analyzer.ts       # Data schema extraction
│   │   │   └── aggregator.ts     # Data aggregation for charts
│   │   │
│   │   └── utils/
│   │       ├── slug.ts           # Slug generation
│   │       └── format.ts         # Number/date formatting
│   │
│   └── types/
│       ├── database.ts           # Supabase generated types
│       ├── dashboard.ts          # Dashboard config types
│       └── chart.ts              # Chart config types
│
├── supabase/
│   ├── migrations/               # Database migrations
│   │   └── 001_initial.sql
│   └── config.toml               # Supabase config
│
├── public/
│   └── ...                       # Static assets
│
├── docs/                         # Documentation
│   ├── 01-product-vision.md
│   ├── 02-mvp-specification.md
│   ├── 03-technical-architecture.md
│   ├── 04-database-schema.md
│   └── 05-ai-integration.md
│
├── .env.local                    # Environment variables
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.ts
```

---

## Environment Variables

```bash
# .env.local

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Claude (Anthropic)
ANTHROPIC_API_KEY=sk-ant-...

# Resend (Email)
RESEND_API_KEY=re_...

# App
NEXT_PUBLIC_APP_URL=https://zeno.fyi

# Stripe (Phase 3)
# STRIPE_SECRET_KEY=sk_...
# STRIPE_WEBHOOK_SECRET=whsec_...
# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
```

---

## Domain & Hosting Setup

### DNS Configuration (GoDaddy)

**For main domain (zeno.fyi):**
```
Type: A
Name: @
Value: 76.76.21.21

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

**For wildcard subdomains (*.zeno.fyi):**
```
Type: CNAME
Name: *
Value: cname.vercel-dns.com
```

### Vercel Configuration

```json
// vercel.json
{
  "rewrites": [
    {
      "source": "/:path*",
      "has": [
        {
          "type": "host",
          "value": "(?<subdomain>[^.]+).zeno.fyi"
        }
      ],
      "destination": "/workspace/:subdomain/:path*"
    }
  ]
}
```

### Custom Domains (Pro Feature)

When a user adds a custom domain:
1. They configure CNAME: `dashboards.acme.com → custom.zeno.fyi`
2. We add the domain in Vercel via API
3. Vercel auto-provisions SSL
4. Our app reads the `host` header and looks up the workspace

---

## Security Considerations

### Authentication
- Supabase Auth handles magic link token security
- Sessions stored in HTTP-only cookies
- Row Level Security (RLS) on all tables

### API Security
- All mutations require authentication
- Rate limiting on AI endpoints (expensive operations)
- Input validation with Zod schemas

### Data Access
- RLS policies ensure users can only access their own data
- Published dashboards have separate public access
- No raw SQL exposed to client

### Example RLS Policies

```sql
-- Users can only see their own dashboards
CREATE POLICY "Users can view own dashboards"
  ON dashboards FOR SELECT
  USING (auth.uid() = user_id);

-- Anyone can view published dashboards
CREATE POLICY "Anyone can view published dashboards"
  ON dashboards FOR SELECT
  USING (is_published = true);

-- Users can only modify their own dashboards
CREATE POLICY "Users can update own dashboards"
  ON dashboards FOR UPDATE
  USING (auth.uid() = user_id);
```

---

## Performance Considerations

### Data Handling
- Large datasets stored in Supabase Storage (not in JSONB)
- Only schema sent to Claude (not full data)
- Aggregations computed client-side or via API

### Caching
- Published dashboards can be cached at CDN
- Static assets cached with long TTLs
- API responses cached where appropriate

### Code Splitting
- Dashboard editor loaded separately from landing page
- Chart library loaded only when needed
- Per-route code splitting via Next.js

---

## Future Considerations

### Phase 2: Teams
- Add `workspaces` and `workspace_members` tables
- Implement invitation flow
- Add role-based access control

### Phase 3: Billing
- Stripe Customer Portal integration
- Webhook handlers for subscription events
- Usage tracking for limits

### Phase 4: Scale
- Consider moving data aggregation to server/edge
- Implement caching layer for hot dashboards
- Add analytics for dashboard views

