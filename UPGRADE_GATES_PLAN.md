# Upgrade Gates Implementation Plan

## Overview

Implement upgrade gates throughout the application to guide free users toward paid plans. The gating is based on features, not arbitrary limits like dashboard counts (credits handle that).

## Current Infrastructure

### Existing Functions (Server-side)
- `getUserPlan(userId)` → `'free' | 'starter' | 'pro' | 'enterprise'`
- `hasFeature(userId, feature)` → `boolean`
- `getFeatureLimit(userId, feature)` → `number | null`

### Existing Components
- `UpgradeModal` - Full upgrade dialog with plan comparison
- `/api/credits` - Returns plan info and limits

### Feature Keys Available
```typescript
'team_members' | 'custom_subdomain' | 'custom_domain' |
'custom_branding' | 'remove_zeno_branding' | 'google_sheets' |
'private_sharing' | 'scheduled_refresh' | 'pdf_export' | ...
```

---

## Implementation Steps

### Phase 1: Client-Side Plan Hook

**File**: `src/lib/hooks/use-plan.ts`

Create a React hook that fetches and caches plan info for client components:

```typescript
interface PlanInfo {
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  features: {
    team_members: boolean;
    custom_subdomain: boolean;
    custom_domain: boolean;
    custom_branding: boolean;
    google_sheets: boolean;
    private_sharing: boolean;
  };
  isLoading: boolean;
}

function usePlan(): PlanInfo
```

**API Endpoint**: Extend `/api/credits` to include features, or create `/api/plan`

---

### Phase 2: Reusable Upgrade Components

**File**: `src/components/billing/FeatureGate.tsx`

A wrapper component that shows upgrade prompt for locked features:

```tsx
<FeatureGate
  feature="google_sheets"
  requiredPlan="pro"
  fallback={<UpgradePrompt feature="Google Sheets" plan="Pro" />}
>
  <GoogleSheetsConnect />
</FeatureGate>
```

**File**: `src/components/billing/UpgradePrompt.tsx`

A smaller inline upgrade prompt (not full modal):

```tsx
<UpgradePrompt
  title="Pro Feature"
  description="Google Sheets integration requires a Pro plan"
  plan="pro"
/>
```

---

### Phase 3: Team Page Gate

**File**: `src/app/settings/team/page.tsx`

**Changes**:
1. Fetch user plan on mount
2. If `plan === 'free'`:
   - Hide "Invite Team Member" button
   - Show upgrade prompt: "Upgrade to add team members"
3. If paid plan:
   - Show invite functionality as normal
   - No seat limits (seats_purchased = 9999 for paid)

**UI When Free**:
```
┌─────────────────────────────────────────┐
│ Team                                    │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ 👥 Collaborate with your team       │ │
│ │                                     │ │
│ │ Invite team members to share        │ │
│ │ dashboards and manage billing.      │ │
│ │                                     │ │
│ │ [Upgrade to Starter - $10/mo]       │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Team Members (1)                        │
│ ┌─────────────────────────────────────┐ │
│ │ 👤 You (owner)                      │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

### Phase 4: Branding Page Gates

**File**: `src/app/settings/branding/page.tsx`

**Feature Requirements**:
| Feature | Starter | Pro |
|---------|:-------:|:---:|
| Custom subdomain | ✓ | ✓ |
| Custom domain | ✗ | ✓ |
| Custom logo | ✗ | ✓ |
| Custom colors | ✗ | ✓ |
| Remove Zeno branding | ✗ | ✓ |

**Changes**:
1. Fetch user plan on mount
2. Wrap each section in `<FeatureGate>`:
   - Auto-Extract Brand → Pro only (full branding)
   - Company Identity (logo) → Pro only
   - Brand Colors → Pro only
   - Chart Colors → Pro only
   - Typography → Pro only
   - Subdomain → Starter+
   - Custom Domain → Pro only
3. Show locked state with upgrade prompts

**UI for Locked Section**:
```
┌─────────────────────────────────────────┐
│ Company Identity               PRO 🔒   │
├─────────────────────────────────────────┤
│                                         │
│  Add your logo and company name to      │
│  dashboards shared with your audience.  │
│                                         │
│  [Upgrade to Pro]                       │
│                                         │
└─────────────────────────────────────────┘
```

---

### Phase 5: Connections Page Gate

**File**: `src/app/settings/connections/page.tsx`

**Changes**:
1. Fetch user plan on mount
2. If `plan !== 'pro' && plan !== 'enterprise'`:
   - Show Google Sheets card with lock overlay
   - Replace "Connect" button with "Upgrade to Pro"
3. If Pro+:
   - Show normal connect/disconnect flow

**UI When Not Pro**:
```
┌─────────────────────────────────────────┐
│ 🔗 Google Sheets              PRO 🔒   │
├─────────────────────────────────────────┤
│                                         │
│  Import data directly from Google       │
│  Sheets with automatic sync.            │
│                                         │
│  [Upgrade to Pro - $24/mo]              │
│                                         │
└─────────────────────────────────────────┘
```

---

### Phase 6: Header Upgrade Nudge

**File**: `src/components/layout/app-header.tsx`

**Changes**:
1. Fetch user plan
2. If `plan === 'free'`:
   - Show "Upgrade" button or "Free Plan" badge before user avatar
   - Clicking opens UpgradeModal

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│ [Logo]                    [Upgrade ⚡] [👤 User Menu]   │
└─────────────────────────────────────────────────────────┘
```

OR more subtle:
```
┌─────────────────────────────────────────────────────────┐
│ [Logo]                    [Free Plan ▾] [👤 User Menu]  │
└─────────────────────────────────────────────────────────┘
```

---

### Phase 7: API Endpoint for Plan Info

**File**: `src/app/api/plan/route.ts`

Create dedicated endpoint for plan information:

```typescript
GET /api/plan

Response:
{
  plan: 'free' | 'starter' | 'pro' | 'enterprise',
  features: {
    team_members: boolean,
    custom_subdomain: boolean,
    custom_domain: boolean,
    custom_branding: boolean,
    remove_zeno_branding: boolean,
    google_sheets: boolean,
    private_sharing: boolean,
    pdf_export: boolean,
    scheduled_refresh: boolean
  }
}
```

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/app/api/plan/route.ts` | **CREATE** | New API endpoint for plan info |
| `src/lib/hooks/use-plan.ts` | **CREATE** | Client hook for plan info |
| `src/lib/hooks/index.ts` | **MODIFY** | Export new hook |
| `src/components/billing/FeatureGate.tsx` | **CREATE** | Feature gate wrapper |
| `src/components/billing/UpgradePrompt.tsx` | **CREATE** | Inline upgrade prompt |
| `src/app/settings/team/page.tsx` | **MODIFY** | Add plan check, upgrade prompt |
| `src/app/settings/branding/page.tsx` | **MODIFY** | Gate all Pro features |
| `src/app/settings/connections/page.tsx` | **MODIFY** | Gate Google Sheets |
| `src/components/layout/app-header.tsx` | **MODIFY** | Add upgrade button for free |

---

## Database Updates (Optional)

Update `plan_features` table to ensure:
- `team_members` = false for free, true for starter+
- `custom_subdomain` = true for starter+
- `custom_domain` = true for pro+ only
- `custom_branding` = true for pro+ only
- `google_sheets` = true for pro+ only

Update organizations table default `seats_purchased`:
- Starter: 9999 (no practical limit)
- Pro: 9999 (no practical limit)

---

## Testing Checklist

- [ ] Free user on Team page sees upgrade prompt, can't invite
- [ ] Starter user on Team page can invite
- [ ] Free user on Branding page sees all sections locked
- [ ] Starter user sees subdomain unlocked, branding locked
- [ ] Pro user sees all branding features unlocked
- [ ] Free/Starter user on Connections sees Google Sheets locked
- [ ] Pro user can connect Google Sheets
- [ ] Free user sees "Upgrade" in header
- [ ] Paid user doesn't see upgrade nudge
- [ ] Upgrade flows work and redirect to Stripe

---

## Implementation Order

1. **Create `/api/plan` endpoint** - Foundation for all checks
2. **Create `usePlan` hook** - Reusable across components
3. **Create `FeatureGate` and `UpgradePrompt`** - Reusable UI
4. **Update Team page** - Most impactful gate
5. **Update Branding page** - Multiple feature gates
6. **Update Connections page** - Single feature gate
7. **Update Header** - Persistent visibility
8. **Test all flows** - Ensure upgrade paths work
