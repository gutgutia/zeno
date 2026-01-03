# Zeno Credit System

## Overview

Zeno uses a credit-based system to meter AI-powered dashboard generation and updates. This document outlines the technical framework for converting token usage to credits.

## Credit Pricing

| Metric | Value |
|--------|-------|
| **1 Credit** | $0.10 |
| **Target Margin** | 50% |

**Psychology**: Low per-credit price feels accessible at purchase time. Once credits are bought, users are invested and usage feels "free."

---

## Underlying Costs

### Token Pricing (AI Model Costs)

| Token Type | Cost per Million | Cost per Token |
|------------|------------------|----------------|
| Input | $5.00 | $0.000005 |
| Output | $25.00 | $0.000025 |

**Note**: Output tokens cost 5× input tokens.

### Cost Formula

```
Cost ($) = (input_tokens × $5 + output_tokens × $25) ÷ 1,000,000
```

---

## Token-to-Credit Conversion

### The Formula

```typescript
function calculateCredits(inputTokens: number, outputTokens: number): number {
  // Normalize to "input-equivalent" tokens (output costs 5x)
  const weightedTokens = inputTokens + (outputTokens * 5);
  
  // Divisor of 10,000 yields ~50% margin
  return Math.ceil(weightedTokens / 10_000);
}
```

### Why This Works

1. **Weighted Tokens**: Since output tokens cost 5× input tokens, we normalize everything to a common unit
2. **Divisor of 10,000**: Chosen to achieve 50% gross margin
3. **Ceiling**: Always round up to ensure we never lose money on an action

### Divisor Selection

| Divisor | Margin |
|---------|--------|
| 20,000 | 0% (break-even) |
| 16,000 | 25% |
| 12,000 | 40% |
| **10,000** | **50%** ✓ |
| 8,000 | 60% |

---

## Expected Credit Usage by Action

| Action Type | Input Tokens | Output Tokens | Credits | User Cost | Our Cost | Margin |
|-------------|--------------|---------------|---------|-----------|----------|--------|
| Simple dashboard | 50K | 8K | 9 | $0.90 | $0.45 | 50% |
| Medium dashboard | 150K | 20K | 25 | $2.50 | $1.25 | 50% |
| Large/complex dashboard | 300K | 40K | 50 | $5.00 | $2.50 | 50% |
| Data refresh | 80K | 15K | 16 | $1.60 | $0.78 | 51% |
| Quick AI edit | 30K | 5K | 6 | $0.60 | $0.28 | 53% |

---

## Tier Credit Allocations

Based on the conversion model, here's what each tier provides:

| Tier | Credits | Est. Dashboards | Monthly Price |
|------|---------|-----------------|---------------|
| Free | 100 (one-time) | 4-10 total | $0 |
| Starter | 200/seat/mo | 8-20/seat | $10/seat |
| Pro | 500/seat/mo | 20-50/seat | $24/seat |

### Credit Pack Pricing

| Pack | Credits | Price | Per Credit | Savings |
|------|---------|-------|------------|---------|
| Small | 100 | $6 | $0.06 | - |
| Medium | 500 | $25 | $0.05 | 17% |
| Large | 2,000 | $80 | $0.04 | 33% |

**Note**: Credit packs are priced below $0.10/credit to incentivize bulk purchases while maintaining margin (users get discount, we get cash upfront).

---

## Implementation Notes

### Database Schema

```sql
-- Track credit transactions
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  dashboard_id UUID REFERENCES dashboards(id),
  action_type TEXT, -- 'create', 'update', 'refresh', 'edit'
  input_tokens INTEGER,
  output_tokens INTEGER,
  credits_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track workspace credit balance
CREATE TABLE workspace_credits (
  workspace_id UUID PRIMARY KEY REFERENCES workspaces(id),
  balance INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Credit Deduction Flow

1. User initiates action (create/update/refresh dashboard)
2. AI processing occurs, tokens are counted
3. `calculateCredits()` converts tokens to credits
4. Credits deducted from workspace balance
5. Transaction logged for audit
6. User shown credits used in UI

### UI Display

After each action, show:
```
✓ Dashboard updated
  25 credits used · 475 credits remaining
```

---

## Quick Reference

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   1 credit = $0.10                                      │
│                                                         │
│   CREDITS = ⌈(input + output × 5) ÷ 10,000⌉            │
│                                                         │
│   Cost to us: ~$0.05/credit                            │
│   Revenue: $0.10/credit                                 │
│   Margin: 50%                                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Appendix: Derivation

**Given:**
- Input cost: $5/M tokens
- Output cost: $25/M tokens (5× input)
- Target margin: 50%
- Credit price: $0.10

**To find divisor:**
1. Cost = (input × 5 + output × 25) / 1M
2. For 50% margin: Revenue = Cost × 2
3. Revenue = Credits × $0.10
4. Credits = Cost × 2 / $0.10 = Cost × 20
5. Credits = [(input × 5 + output × 25) / 1M] × 20
6. Credits = (input + output × 5) × 100 / 1M
7. Credits = (input + output × 5) / 10,000 ✓

