# Supabase Database Setup

This folder contains all the SQL scripts needed to set up the Zeno database.

## Quick Start

### Option 1: Using Supabase CLI (Recommended)

```bash
# Install Supabase CLI if you haven't
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Push the migrations
supabase db push
```

### Option 2: Manual Setup via Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run the scripts in order:
   - `migrations/001_initial.sql` - Creates all tables, indexes, and RLS policies
   - `seed.sql` (optional) - Adds test data

## Database Schema

### Tables

| Table | Description |
|-------|-------------|
| `profiles` | User profiles (extends auth.users) |
| `workspaces` | Personal/team workspaces |
| `dashboards` | Dashboard data and configurations |
| `chat_messages` | Chat history for AI iterations |

### Key Features

- **Row Level Security (RLS)** - All tables have RLS enabled
- **Auto-timestamps** - `created_at` and `updated_at` are automatically managed
- **Auto-provisioning** - Profile and personal workspace are created on signup
- **Public dashboards** - Published dashboards are viewable by anyone

## Environment Variables

Add these to your `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Email (Resend)
RESEND_API_KEY=your-resend-api-key
FROM_EMAIL=Zeno <noreply@yourdomain.com>
EMAIL_WEBHOOK_SECRET=your-webhook-secret

# AI
ANTHROPIC_API_KEY=your-anthropic-api-key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Supabase Auth Configuration

### Email Templates

Since we're using Resend for emails, configure Supabase to use custom SMTP or webhooks:

1. Go to **Authentication** > **Email Templates**
2. For OTP emails, you can either:
   - Configure custom SMTP with Resend's SMTP relay
   - Use Auth Hooks to call our `/api/email/otp` endpoint

### Auth Settings

1. Go to **Authentication** > **Providers**
2. Enable **Email** provider
3. Set **Confirm email** to `true`
4. Set **Secure email change** to `true`

### Auth Hooks (Optional)

To use Resend for all emails:

1. Go to **Authentication** > **Hooks**
2. Add a webhook for `send_email` event
3. Set the URL to `https://your-app.com/api/email/otp`
4. Add the `EMAIL_WEBHOOK_SECRET` as a header

## Migrations

| File | Description |
|------|-------------|
| `001_initial.sql` | Initial schema - profiles, workspaces, dashboards, chat_messages |

## Useful Commands

```bash
# Generate TypeScript types from your database
supabase gen types typescript --local > src/types/supabase.ts

# Reset the database (DANGEROUS - deletes all data)
supabase db reset

# Create a new migration
supabase migration new your_migration_name

# Check migration status
supabase migration list
```

## Backup & Restore

```bash
# Backup
pg_dump -h YOUR_HOST -U postgres -d postgres > backup.sql

# Restore
psql -h YOUR_HOST -U postgres -d postgres < backup.sql
```
