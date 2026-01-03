# Zeno Pricing Structure

> Last updated: January 2026

## Overview

Zeno uses a **tiered subscription model with credits**:
- **Tiers** unlock features and include monthly credits
- **Credits** are consumed by AI actions (create, edit, refresh)
- **Per-seat pricing** for all paid plans
- **Credits pool at workspace level** (team shares credits)

---

## Pricing Tiers

| | **Free** | **Starter** | **Pro** | **Business** |
|---|:---:|:---:|:---:|:---:|
| **Price** | $0 | **$10**/seat/mo | **$24**/seat/mo | **$49**/seat/mo |
| **Annual** | - | $8/seat/mo | $20/seat/mo | $40/seat/mo |
| **Credits** | 100 (one-time) | 200/seat/mo | 500/seat/mo | 1,200/seat/mo |
| **Max Seats** | 1 | 10 | 50 | Unlimited |

### Annual Billing Savings

| Plan | Monthly | Annual (per month) | Savings |
|------|---------|-------------------|---------|
| Starter | $10/seat | $8/seat | 20% |
| Pro | $24/seat | $20/seat | 17% |
| Business | $49/seat | $40/seat | 18% |

---

## Feature Matrix

### Dashboards & Content

| Feature | Free | Starter | Pro | Business |
|---------|:----:|:-------:|:---:|:--------:|
| Dashboard limit | 3 | Unlimited | Unlimited | Unlimited |
| Public sharing (anyone with link) | ✓ | ✓ | ✓ | ✓ |
| Private sharing (specific emails) | ✗ | ✓ | ✓ | ✓ |
| Private sharing (email domains) | ✗ | ✓ | ✓ | ✓ |
| PDF export | ✗ | ✗ | ✓ | ✓ |
| DocX export | ✗ | ✗ | ✓ | ✓ |

### Branding & Customization

| Feature | Free | Starter | Pro | Business |
|---------|:----:|:-------:|:---:|:--------:|
| Zeno branding on shared dashboards | Required | Required | **Removable** | **Removable** |
| Custom subdomain (you.zeno.fyi) | ✗ | ✓ | ✓ | ✓ |
| Custom domain (dashboard.yourco.com) | ✗ | ✗ | ✓ | ✓ |
| Custom branding (logo, colors) | ✗ | ✗ | ✓ | ✓ |

### Data Sources

| Feature | Free | Starter | Pro | Business |
|---------|:----:|:-------:|:---:|:--------:|
| Paste data | ✓ | ✓ | ✓ | ✓ |
| Upload CSV/Excel | ✓ | ✓ | ✓ | ✓ |
| Google Sheets integration | ✗ | ✗ | ✓ | ✓ |
| Airtable integration | ✗ | ✗ | ✗ | ✓ |
| Other integrations (future) | ✗ | ✗ | ✗ | ✓ |
| Scheduled auto-refresh | ✗ | ✗ | ✓ | ✓ |

### Team & Collaboration

| Feature | Free | Starter | Pro | Business |
|---------|:----:|:-------:|:---:|:--------:|
| Maximum seats | 1 | 10 | 50 | Unlimited |
| Shared workspaces | ✗ | ✗ | ✓ | ✓ |
| Admin controls | ✗ | ✗ | ✗ | ✓ |
| SSO/SAML authentication | ✗ | ✗ | ✗ | ✓ |
| Audit logs | ✗ | ✗ | ✗ | ✓ |

### Support & Security

| Feature | Free | Starter | Pro | Business |
|---------|:----:|:-------:|:---:|:--------:|
| Community support | ✓ | ✓ | ✗ | ✗ |
| Email support | ✗ | ✓ | ✓ | ✗ |
| Priority support | ✗ | ✗ | ✓ | ✓ |
| Dedicated success manager | ✗ | ✗ | ✗ | ✓ |
| SOC 2 documentation | ✗ | ✗ | ✗ | ✓ |
| SLA guarantee | ✗ | ✗ | ✗ | ✓ |

---

## Credit System

### Credit Fundamentals

- **1 credit ≈ $0.05** retail value
- Credits are consumed by AI-powered actions
- Credits **pool at the workspace level** (all team members share)
- Credits **do not roll over** to the next month
- Credit usage is shown after each action

### Credit Costs by Action

Actions cost **2-20 credits** based on AI compute complexity:

| Action | Typical Credits | Cost Equivalent |
|--------|:---------------:|-----------------|
| Create dashboard (simple data, basic layout) | 3-5 | $0.15-0.25 |
| Create dashboard (complex data, rich visualizations) | 10-20 | $0.50-1.00 |
| AI edit (minor change - colors, labels) | 2-4 | $0.10-0.20 |
| AI edit (major restructure - new charts, layout) | 8-15 | $0.40-0.75 |
| Data refresh (small data delta) | 2-5 | $0.10-0.25 |
| Data refresh (significant data changes) | 8-15 | $0.40-0.75 |

### What Determines Credit Cost?

The credit cost of an action depends on:
1. **Data complexity** - More rows/columns = more analysis needed
2. **Request complexity** - "Change the color" vs "Completely redesign the layout"
3. **Output size** - Larger dashboards with more charts cost more
4. **AI model used** - Advanced features may use more capable (expensive) models

### Credit Allocation Examples

| Plan | Seats | Monthly Credits | Typical Usage |
|------|:-----:|:---------------:|---------------|
| Starter | 1 | 200 | ~15-40 dashboards or ~50+ edits |
| Starter | 3 | 600 | ~45-120 dashboards (pooled) |
| Pro | 1 | 500 | ~35-100 dashboards or ~100+ edits |
| Pro | 5 | 2,500 | ~175-500 dashboards (pooled) |
| Business | 10 | 12,000 | ~800-2,400 dashboards (pooled) |

### User Experience

After each AI action, users see:
```
✓ Dashboard created successfully
  This action used 7 credits. You have 193 credits remaining this month.
```

---

## Extra Credit Packs

Available on all **paid plans**. Credits are added to the workspace pool immediately.

| Pack | Price | Per Credit | Savings vs Base |
|------|-------|:----------:|-----------------|
| 100 credits | $6 | $0.060 | — |
| 500 credits | $25 | $0.050 | 17% |
| 2,000 credits | $80 | $0.040 | 33% |

### Overage Handling

When credits run out mid-month, users have two options:

1. **Auto-purchase (opt-in)**
   - User enables auto-purchase in settings
   - When credits run low (configurable threshold), automatically purchase a credit pack
   - Default: Buy 100-credit pack when balance drops below 20 credits

2. **Manual purchase**
   - User is prompted to purchase a credit pack
   - Cannot perform AI actions until credits are purchased or next billing cycle

---

## Free Tier Details

The Free tier is designed for:
- Trying the product before committing
- Occasional personal use
- Students and hobbyists

### Limitations

| Aspect | Limit |
|--------|-------|
| Seats | 1 (strictly single user) |
| Dashboards | 3 maximum |
| Credits | 100 (one-time, never refreshes) |
| Sharing | **Public only** (private sharing requires upgrade) |
| Branding | Zeno branding required on all shared dashboards |
| Data sources | Paste and CSV upload only |

### Upgrade Triggers

Free users are prompted to upgrade when they:
- Try to create a 4th dashboard
- Try to share privately (specific email/domain)
- Run out of credits
- Try to use Google Sheets integration

---

## Plan Comparison Summary

### Who Is Each Plan For?

| Plan | Ideal For |
|------|-----------|
| **Free** | Trying Zeno, occasional personal use, students |
| **Starter** | Solo creators, freelancers, individual professionals |
| **Pro** | Small teams, agencies, power users needing integrations |
| **Business** | Organizations, enterprises, security-conscious teams |

### Upgrade Paths

```
Free
  │
  │ Need: More dashboards, private sharing, more credits
  ▼
Starter ($10/seat)
  │
  │ Need: Custom domain, branding, Google Sheets, team workspaces
  ▼
Pro ($24/seat)
  │
  │ Need: SSO, admin controls, more integrations, dedicated support
  ▼
Business ($49/seat)
```

---

## Implementation Notes

### Database Schema Requirements

```sql
-- Workspace credits tracking
ALTER TABLE workspaces ADD COLUMN credits_balance INTEGER DEFAULT 0;
ALTER TABLE workspaces ADD COLUMN credits_included_monthly INTEGER DEFAULT 0;
ALTER TABLE workspaces ADD COLUMN credits_reset_at TIMESTAMP;
ALTER TABLE workspaces ADD COLUMN auto_purchase_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE workspaces ADD COLUMN auto_purchase_threshold INTEGER DEFAULT 20;
ALTER TABLE workspaces ADD COLUMN auto_purchase_pack_size INTEGER DEFAULT 100;

-- Credit usage log
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  user_id UUID REFERENCES auth.users(id),
  dashboard_id UUID REFERENCES dashboards(id),
  action_type TEXT, -- 'create', 'edit', 'refresh', 'purchase', 'monthly_allocation'
  credits_used INTEGER,
  credits_balance_after INTEGER,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Subscription/Billing Integration

- Use Stripe for subscription management
- Stripe Checkout for initial subscription
- Stripe Customer Portal for plan changes
- Stripe Billing for seat management
- Credit pack purchases via Stripe Checkout (one-time payments)

### Feature Flags

```typescript
interface PlanFeatures {
  maxDashboards: number | 'unlimited';
  maxSeats: number | 'unlimited';
  monthlyCreditsPerSeat: number;
  
  // Sharing
  publicSharing: boolean;
  privateSharing: boolean;
  
  // Branding
  zenoBrandingRemovable: boolean;
  customSubdomain: boolean;
  customDomain: boolean;
  customBranding: boolean;
  
  // Data sources
  googleSheets: boolean;
  airtable: boolean;
  scheduledRefresh: boolean;
  
  // Export
  pdfExport: boolean;
  docxExport: boolean;
  
  // Team
  sharedWorkspaces: boolean;
  adminControls: boolean;
  sso: boolean;
  auditLogs: boolean;
  
  // Support
  supportLevel: 'community' | 'email' | 'priority' | 'dedicated';
  sla: boolean;
  soc2Docs: boolean;
}
```

---

## Changelog

| Date | Change |
|------|--------|
| Jan 2026 | Initial pricing structure defined |

