# Admin Dashboard Plan - User Management & Billing Controls

## Overview

A comprehensive admin dashboard for managing users, plans, credits, and billing. This will be accessible at `/admin` subdomain (already reserved in middleware) and protected by a new "super_admin" role.

---

## Phase 1: Database Schema Changes

### 1.1 Super Admin Role System

```sql
-- New table: admin_users
CREATE TABLE public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'support', 'billing_admin')),
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id)
);

-- Admin roles:
-- super_admin: Full access to all admin features
-- support: Can view users, adjust credits, but not change plans
-- billing_admin: Can manage plans and billing, but not system settings
```

### 1.2 Plan Overrides (Special Discounts & Custom Limits)

```sql
-- New table: user_plan_overrides
CREATE TABLE public.user_plan_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Plan override
  plan_type TEXT CHECK (plan_type IN ('free', 'team', 'enterprise', 'custom')),
  plan_expires_at TIMESTAMPTZ, -- NULL = never expires

  -- Custom limits (override plan_limits)
  max_dashboards INTEGER,
  max_folders INTEGER,
  max_data_rows INTEGER,
  monthly_credits INTEGER,

  -- Billing overrides
  discount_percent INTEGER CHECK (discount_percent >= 0 AND discount_percent <= 100),
  discount_reason TEXT,
  price_override_cents INTEGER, -- Fixed price instead of standard

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Either user_id OR organization_id must be set
  CONSTRAINT user_or_org CHECK (
    (user_id IS NOT NULL AND organization_id IS NULL) OR
    (user_id IS NULL AND organization_id IS NOT NULL)
  )
);
```

### 1.3 Admin Audit Log

```sql
-- New table: admin_audit_log
CREATE TABLE public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL, -- 'user', 'organization', 'plan', 'credits'
  target_id UUID,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX idx_audit_log_admin ON admin_audit_log(admin_user_id);
CREATE INDEX idx_audit_log_target ON admin_audit_log(target_type, target_id);
CREATE INDEX idx_audit_log_created ON admin_audit_log(created_at DESC);
```

---

## Phase 2: API Routes

### 2.1 Admin Authentication Middleware

```
/src/lib/admin/auth.ts
- isAdmin(userId) - Check if user is admin
- requireAdmin(request, roles?) - Middleware for admin routes
- getAdminPermissions(userId) - Get admin's permission set
```

### 2.2 User Management APIs

```
GET    /api/admin/users
       - List all users with pagination, search, filters
       - Filters: plan_type, created_date, has_dashboards, credit_balance
       - Returns: user details, plan, org, credit balance, dashboard count

GET    /api/admin/users/[id]
       - Full user profile with all related data
       - Returns: profile, organizations, dashboards, credits, transactions

PATCH  /api/admin/users/[id]
       - Update user profile fields
       - Can set: name, email (with verification), plan_type

DELETE /api/admin/users/[id]
       - Soft delete user account
       - Archives all data, doesn't permanently delete

POST   /api/admin/users/[id]/impersonate
       - Generate temporary auth token to login as user
       - For debugging/support purposes
       - Logged in audit trail
```

### 2.3 Plan Management APIs

```
GET    /api/admin/users/[id]/plan
       - Get user's current plan with all limits and features
       - Shows effective plan (base + overrides)

PUT    /api/admin/users/[id]/plan
       - Change user's plan type
       - Body: { plan_type, reason }

POST   /api/admin/users/[id]/plan/override
       - Set custom plan overrides
       - Body: { max_dashboards, monthly_credits, discount_percent, ... }

DELETE /api/admin/users/[id]/plan/override
       - Remove all custom overrides, revert to standard plan
```

### 2.4 Credit Management APIs

```
GET    /api/admin/users/[id]/credits
       - Get credit balance and transaction history
       - Returns: current_balance, lifetime_credits, recent_transactions

POST   /api/admin/users/[id]/credits/adjust
       - Add or remove credits
       - Body: { amount, reason, type: 'bonus' | 'refund' | 'correction' }

GET    /api/admin/credits/transactions
       - Global transaction log with filters
       - Filters: user, type, date_range, min_amount
```

### 2.5 Organization Management APIs

```
GET    /api/admin/organizations
       - List all organizations with billing info
       - Filters: plan_type, member_count, has_subscription

GET    /api/admin/organizations/[id]
       - Full organization details
       - Returns: members, billing, usage, dashboards

PATCH  /api/admin/organizations/[id]
       - Update organization settings
       - Can modify: plan, billing, limits

POST   /api/admin/organizations/[id]/credits/adjust
       - Adjust organization credit balance
```

### 2.6 Analytics APIs

```
GET    /api/admin/analytics/overview
       - Dashboard summary stats
       - Returns: total_users, active_users, revenue, credits_used

GET    /api/admin/analytics/users
       - User growth and activity metrics
       - Returns: signups_by_day, active_by_day, churn_rate

GET    /api/admin/analytics/revenue
       - Revenue and billing metrics
       - Returns: mrr, plan_distribution, credit_purchases

GET    /api/admin/analytics/usage
       - Platform usage metrics
       - Returns: dashboards_created, ai_calls, data_processed
```

---

## Phase 3: Admin Dashboard Pages

### 3.1 Page Structure

```
/src/app/admin/
├── layout.tsx              # Admin layout with sidebar nav
├── page.tsx                # Dashboard overview with stats
├── users/
│   ├── page.tsx            # User list with search/filter
│   └── [id]/
│       ├── page.tsx        # User detail view
│       ├── plan/page.tsx   # Plan management
│       └── credits/page.tsx # Credit management
├── organizations/
│   ├── page.tsx            # Organization list
│   └── [id]/page.tsx       # Organization detail
├── billing/
│   ├── page.tsx            # Billing overview
│   ├── transactions/page.tsx # All transactions
│   └── subscriptions/page.tsx # Active subscriptions
├── analytics/
│   └── page.tsx            # Analytics dashboard
└── settings/
    ├── page.tsx            # Admin settings
    ├── admins/page.tsx     # Manage admin users
    └── audit-log/page.tsx  # View audit log
```

### 3.2 User List Page Features

```tsx
// /admin/users - Main user management interface

Features:
- Searchable table with columns:
  - User (name, email, avatar)
  - Plan (badge: free/team/enterprise + any overrides)
  - Credits (current balance / monthly limit)
  - Dashboards (count)
  - Status (active/inactive/suspended)
  - Created date
  - Last active

- Quick filters:
  - Plan type dropdown
  - Credit balance range
  - Sign up date range
  - Has custom overrides
  - Active in last 30 days

- Bulk actions:
  - Export to CSV
  - Bulk plan change
  - Bulk credit adjustment

- Row actions:
  - View details
  - Edit plan
  - Adjust credits
  - Impersonate
```

### 3.3 User Detail Page Features

```tsx
// /admin/users/[id] - Comprehensive user view

Sections:

1. Header:
   - User avatar, name, email
   - Plan badge with "Override" indicator if applicable
   - Quick action buttons: Edit, Adjust Credits, Change Plan

2. Overview Tab:
   - Account created date
   - Last login
   - Total dashboards
   - Credit usage this month
   - Organization memberships

3. Plan Tab:
   - Current plan details
   - Feature access matrix
   - Override settings (if any)
   - Plan change history
   - "Change Plan" form:
     - Plan selector (free/team/enterprise)
     - Custom limits toggles
     - Discount percentage
     - Expiration date
     - Reason/notes

4. Credits Tab:
   - Current balance (large display)
   - Monthly usage chart
   - Transaction history table
   - "Adjust Credits" form:
     - Amount (+/-)
     - Type (bonus/refund/correction)
     - Reason (required)

5. Dashboards Tab:
   - List of all dashboards
   - Creation dates
   - Sharing status
   - Credit usage per dashboard

6. Activity Tab:
   - Login history
   - Dashboard operations
   - Credit transactions
   - Plan changes
```

### 3.4 Quick Action Modals

```tsx
// Reusable modal components

1. ChangePlanModal:
   - Plan type selector
   - Duration (permanent / until date)
   - Reason field
   - Preview of changes

2. AdjustCreditsModal:
   - Amount input with +/- toggle
   - Transaction type selector
   - Reason field (required)
   - Current balance display

3. SetOverrideModal:
   - Toggle for each limit type
   - Custom value inputs
   - Discount percentage slider
   - Notes field

4. ConfirmActionModal:
   - Warning for destructive actions
   - Reason input
   - Confirmation checkbox
```

---

## Phase 4: Key UI Components

### 4.1 New Components to Build

```
/src/components/admin/
├── AdminLayout.tsx         # Layout with navigation
├── AdminSidebar.tsx        # Side navigation
├── UserTable.tsx           # Paginated user list
├── UserCard.tsx            # User summary card
├── PlanBadge.tsx           # Plan type badge with override indicator
├── CreditDisplay.tsx       # Credit balance display
├── CreditAdjustForm.tsx    # Form for adjusting credits
├── PlanChangeForm.tsx      # Form for changing plans
├── OverrideForm.tsx        # Form for setting overrides
├── TransactionTable.tsx    # Credit transaction history
├── AuditLogTable.tsx       # Admin action log
├── StatsCard.tsx           # Analytics metric card
├── UserSearchFilters.tsx   # Search and filter controls
└── QuickActions.tsx        # Action button group
```

### 4.2 Existing Components to Reuse

```
From /src/components/ui/:
- Button, Input, Dialog, Dropdown, Tabs
- Avatar, Badge, Card, Label
- Separator, Textarea

From /src/components/:
- DataTable (for tables)
- Existing chart components for analytics
```

---

## Phase 5: Implementation Order

### Sprint 1: Foundation (Database + Auth)
1. Create database migration with new tables
2. Build admin authentication middleware
3. Create basic admin layout and navigation
4. Implement admin user management (add first super admin)

### Sprint 2: User Management
1. Build user list API with pagination/search
2. Create user list page with table
3. Build user detail API
4. Create user detail page with tabs
5. Add user search and filters

### Sprint 3: Plan Management
1. Build plan override APIs
2. Create plan change form and modal
3. Create override settings form
4. Add plan change history tracking
5. Test plan limit enforcement

### Sprint 4: Credit Management
1. Build credit adjustment APIs
2. Create credit adjustment form
3. Build transaction history view
4. Add credit analytics
5. Test credit operations

### Sprint 5: Analytics & Polish
1. Build analytics APIs
2. Create analytics dashboard
3. Add audit log viewing
4. Polish UI and add bulk actions
5. Add export functionality

---

## Phase 6: Security Considerations

### 6.1 Access Control
- All admin routes require `admin_users` table check
- RLS policies for admin tables
- IP allowlist option for admin access
- Session timeout after inactivity

### 6.2 Audit Requirements
- Log ALL admin actions
- Include before/after values
- Capture IP address
- Require reason for sensitive actions

### 6.3 Rate Limiting
- Limit admin API calls
- Alert on unusual patterns
- Automatic lockout after failed attempts

---

## Data Model Summary

```
┌─────────────────────────────────────────────────────────────┐
│                     ADMIN DASHBOARD                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐     ┌─────────────────────┐               │
│  │ admin_users  │     │ admin_audit_log     │               │
│  │ ------------ │     │ ------------------- │               │
│  │ user_id      │────▶│ admin_user_id       │               │
│  │ role         │     │ action              │               │
│  │ permissions  │     │ target_type/id      │               │
│  └──────────────┘     │ old_value/new_value │               │
│                       └─────────────────────┘               │
│                                                              │
│  ┌────────────────────────────────────────────┐             │
│  │           user_plan_overrides              │             │
│  │ ------------------------------------------ │             │
│  │ user_id / organization_id                  │             │
│  │ plan_type, plan_expires_at                 │             │
│  │ max_dashboards, monthly_credits            │             │
│  │ discount_percent, price_override_cents     │             │
│  │ notes, created_by                          │             │
│  └────────────────────────────────────────────┘             │
│                                                              │
│  Extends existing:                                           │
│  - profiles (view/edit)                                      │
│  - organizations (view/edit)                                 │
│  - user_credits / organization_credits (adjust)              │
│  - credit_transactions (view)                                │
│  - plan_limits / plan_features (reference)                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Feature Summary

| Feature | Description |
|---------|-------------|
| **User List** | Search, filter, paginate all users |
| **User Details** | View complete user profile and activity |
| **Plan Management** | Change plan, set custom limits |
| **Credit Adjustment** | Add/remove credits with audit trail |
| **Discounts** | Set percentage or fixed-price discounts |
| **Override Expiry** | Time-limited special offers |
| **Organization View** | Manage teams and billing |
| **Analytics** | Usage, revenue, growth metrics |
| **Audit Log** | Complete history of admin actions |
| **Impersonation** | Debug as user (logged) |

---

## Questions for Clarification

1. **Admin Roles**: Do you want multiple admin role types (super_admin, support, billing_admin) or just one "admin" role?

2. **Self-Service vs Admin-Only**: Should users be able to see their own override/discount status, or is this admin-only info?

3. **Discount Types**:
   - Percentage off standard price?
   - Fixed monthly price?
   - Free period (X months free)?
   - All of the above?

4. **Credit Bonuses**:
   - One-time bonus credits?
   - Increased monthly refill amount?
   - Both?

5. **Notification**: Should users be notified when their plan/credits are changed by admin?

6. **Impersonation**: Is the ability to login as a user for debugging needed?

7. **Priority**: Which features are most critical for the first release?
