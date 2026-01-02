# Zeno Documentation

> **Paste data. Get a dashboard. Share in seconds.**

Zeno is a platform for creating beautiful, shareable dashboards from data without any technical expertise.

**Domain:** zeno.fyi

---

## Documentation Index

### Product
| Document | Description |
|----------|-------------|
| [product-vision.md](./product/product-vision.md) | Product overview, target users, business model, roadmap |
| [design-system.md](./product/design-system.md) | Colors, typography, components, visual guidelines |

### Architecture
| Document | Description |
|----------|-------------|
| [technical-architecture.md](./architecture/technical-architecture.md) | Tech stack, system architecture, project structure |
| [database-schema.md](./architecture/database-schema.md) | Database tables, RLS policies, migrations |
| [ai-integration.md](./architecture/ai-integration.md) | Claude integration, prompts, config schema |
| [agentic-dashboard-generation.md](./architecture/agentic-dashboard-generation.md) | AI agent flow for dashboard generation |

### Planning
| Document | Description |
|----------|-------------|
| [mvp-specification.md](./planning/mvp-specification.md) | MVP scope, user flows, acceptance criteria |
| [mvp-implementation-plan.md](./planning/mvp-implementation-plan.md) | Implementation timeline and milestones |
| [website-redesign.md](./planning/website-redesign.md) | Marketing website redesign plan |

---

## Quick Reference

### Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| AI | Claude (Anthropic) |
| Charts | Recharts |
| Styling | Tailwind CSS |
| Payments | Stripe (Phase 3) |
| Email | Resend |
| Hosting | Vercel |

### MVP Features

- ✅ Email magic link authentication
- ✅ Create dashboards from pasted/uploaded data
- ✅ AI-powered chart generation
- ✅ Chat-based iteration
- ✅ Publish with public links
- ✅ Clean public viewer

### Roadmap

| Phase | Focus | Timeline |
|-------|-------|----------|
| **Phase 1 (MVP)** | Solo creator flow | 2-3 weeks |
| **Phase 2** | Teams, access control, sharing | 2-3 weeks |
| **Phase 3** | Monetization, custom domains | 2-3 weeks |
| **Phase 4** | Scale, templates, API | Ongoing |

---

## Getting Started (Development)

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase and Anthropic keys

# Run database migrations
npx supabase db push

# Start development server
npm run dev
```

### Required Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Claude (Anthropic)
ANTHROPIC_API_KEY=

# Resend (Email)
RESEND_API_KEY=

# App
NEXT_PUBLIC_APP_URL=https://zeno.fyi
```

---

## Key Decisions

### Why PostgreSQL over MongoDB?

Zeno's data is relational (users → workspaces → dashboards → versions). PostgreSQL provides:
- Strong referential integrity
- Complex JOINs for access control
- JSONB for flexible config storage
- Supabase ecosystem integration

### Why Config-Based Charts (not Code Generation)?

Claude generates JSON configurations, not code. This is:
- **Secure** — No arbitrary code execution
- **Fast** — Instant rendering
- **Reliable** — Predictable output format
- **Editable** — Users can manually tweak

### Why Recharts?

- React-native (declarative API)
- Good TypeScript support
- Responsive by default
- Actively maintained

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         VERCEL                               │
│                    zeno.fyi + subdomains                     │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                   Next.js Application                    ││
│  │   Landing │ Dashboard Editor │ Public Viewer             ││
│  └─────────────────────────────────────────────────────────┘│
└──────────────────────────────┬──────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│   SUPABASE    │      │    CLAUDE     │      │    RESEND     │
│ • Database    │      │ • Generation  │      │ • Magic links │
│ • Auth        │      │ • Iteration   │      │ • Emails      │
│ • Storage     │      └───────────────┘      └───────────────┘
└───────────────┘
```

---

## Contact

Questions? Reach out to the team.

