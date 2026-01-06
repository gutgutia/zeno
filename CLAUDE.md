# Zeno: CLAUDE.md

## Project Overview

Zeno is an AI-powered dashboard generation platform. Users upload data (CSV, Excel, paste, or Google Sheets), describe what they want, and Claude AI generates beautiful, shareable dashboards.

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript
- **Backend:** Next.js API routes
- **Database:** Supabase (PostgreSQL with Row-Level Security)
- **AI:** Anthropic Claude API (Opus 4.5), Claude Agent SDK, E2B Sandbox
- **Auth:** Supabase Auth (Email OTP + Google OAuth)
- **Payments:** Stripe
- **Email:** Resend
- **Styling:** Tailwind CSS 4, Radix UI components

## Directory Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes (51+ endpoints)
│   │   ├── admin/         # Admin management
│   │   ├── auth/          # Authentication
│   │   ├── billing/       # Stripe integration
│   │   ├── dashboards/    # Dashboard CRUD + generation
│   │   └── organizations/ # Team management
│   ├── dashboards/        # Dashboard UI pages
│   ├── admin/             # Admin panel
│   └── settings/          # User settings
├── components/            # React components
│   ├── ui/               # Shadcn/Radix components
│   └── dashboard/        # Dashboard-specific components
├── lib/                   # Utilities
│   ├── ai/               # AI generation (agent.ts, generate.ts)
│   ├── supabase/         # Database clients
│   └── credits/          # Credit system
└── types/                # TypeScript definitions
```

## Common Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run db:push      # Push database migrations
npm run db:reset     # Reset database
```

## Code Style

- **TypeScript:** Strict mode, prefer explicit types
- **Imports:** Use `@/` path alias for src/ imports
- **Components:** Functional components with hooks
- **Naming:** camelCase for functions/variables, PascalCase for components/types
- **Files:** kebab-case for file names

## Key Patterns

### API Routes
- Use service client for internal operations (bypasses RLS)
- Verify ownership before mutations
- Return proper HTTP status codes (401, 403, 402, 404, 500)
- 402 for insufficient credits

### Dashboard Generation
- Async generation: returns immediately, polls for status
- Uses Claude Agent SDK with E2B Python sandbox
- Falls back gracefully if generation fails

### Credit System
```
Credits = ceil((input_tokens + output_tokens * 5) / 10000)
```
- Check balance before generation
- Deduct after successful completion

### Database
- Row-Level Security (RLS) on all tables
- Soft deletes via `deleted_at` timestamp
- Version history for dashboards

## AI Approaches

The system supports two approaches for AI operations, configurable via `AGENT_CONFIG` in `src/lib/ai/agent.ts`:

### Initial Generation (Always Agentic)
- Uses Claude Agent SDK with E2B Python sandbox
- Opus 4.5 for creative dashboard design
- Multi-turn agent loop with Python execution for data analysis
- Worth the overhead for one-time generation

### Dashboard Modification
Two approaches available (toggle with `AGENT_CONFIG.useDirectModify`):

**Direct Approach (default, recommended):**
- `src/lib/ai/modify-direct.ts`
- Step 1: Classification (Haiku) - determines if data is needed
- Step 2: Single Sonnet call - returns surgical edits as find/replace pairs
- Benefits: Fast (~5-10s), cheap, predictable, no sandbox

**Agentic Approach (fallback):**
- `src/lib/ai/agent.ts` → `modifyDashboardWithAgent()`
- Uses E2B sandbox with file editing tools
- Multi-turn agent loop
- Use when: Direct approach fails or complex modifications needed

### Data Refresh
Two approaches available (toggle with `AGENT_CONFIG.useDirectRefresh`):

**Direct Approach (default, recommended):**
- `src/lib/ai/refresh-direct.ts`
- Uses pre-computed data diff to understand what changed
- Step 1: Classification (Haiku or heuristics) - determines surgical vs regeneration
- Step 2: For surgical: Single Sonnet call with diff + HTML + new data → find/replace edits
- Step 3: If regeneration needed, falls back to agentic approach
- Benefits: Fast (~10-15s for surgical), cheap, predictable

**Classification Logic:**
- Value-only changes → Surgical (no AI classification needed)
- Minor column changes (1-2 added/removed) → Haiku classifies → usually surgical
- Major schema changes (>30% columns different) → Regeneration

**Agentic Approach (fallback for regeneration):**
- `src/lib/ai/agent.ts` → `refreshDashboardWithAgent()`
- Uses E2B sandbox
- Multi-turn agent loop
- Used when: Schema changed significantly, domain changed

### Model Names
**IMPORTANT:** Never use date stamps in model names.
- ✅ `claude-sonnet-4-5`, `claude-opus-4-5`, `claude-haiku-4-5`
- ❌ `claude-sonnet-4-5-20250514`

## Important Files

- `src/lib/ai/agent.ts` - Claude Agent SDK integration + config flags (`AGENT_CONFIG`)
- `src/lib/ai/modify-direct.ts` - Direct (non-agentic) modification approach
- `src/lib/ai/refresh-direct.ts` - Direct (non-agentic) refresh approach
- `src/lib/data/diff.ts` - Data diff computation for refresh
- `src/lib/ai/generate.ts` - Single-step generation
- `src/app/api/dashboards/[id]/generate/route.ts` - Generation endpoint
- `src/lib/credits/index.ts` - Credit calculations

## Environment Variables

Required:
- `ANTHROPIC_API_KEY` - Claude API
- `E2B_API_KEY` - E2B sandbox
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase admin key

Optional:
- `STRIPE_SECRET_KEY` - Stripe payments
- `RESEND_API_KEY` - Email sending

## Security Notes

- Never commit `.env` files
- Use service role only for internal operations
- Validate ownership before any mutation
- Sanitize HTML with DOMPurify

## Deployment

- **Platform:** Railway (using Dockerfile)
- **Build:** Webpack (not Turbopack - ESM issues)
- **Agent SDK:** Requires global Claude Code CLI installation
