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

## Important Files

- `src/lib/ai/agent.ts` - Claude Agent SDK integration
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
