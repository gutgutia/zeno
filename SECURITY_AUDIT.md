# Security Audit Report: Dashboard Sharing

**Date:** January 3, 2026
**Auditor:** Claude Code
**Scope:** Dashboard sharing, access control, and authentication

---

## Executive Summary

This security audit focused on the dashboard sharing functionality, examining authentication, authorization, Row-Level Security (RLS) policies, and access control mechanisms. One **critical vulnerability** was identified and fixed, along with several findings that should be addressed to strengthen security.

---

## Critical Findings (Fixed)

### 1. CRITICAL: Missing Authorization Check in `/api/dashboards/[id]/refresh`

**Severity:** Critical
**Status:** ✅ FIXED

**Description:**
The `/api/dashboards/[id]/refresh` endpoint was missing an ownership verification check. Any authenticated user could refresh ANY dashboard by knowing its ID, potentially:
- Accessing sensitive dashboard data
- Triggering compute-intensive AI operations on other users' dashboards
- Modifying dashboard content

**Location:** `src/app/api/dashboards/[id]/refresh/route.ts`

**Fix Applied:**
Added ownership verification before processing the refresh request:
```typescript
// SECURITY: Verify the current user owns this dashboard
if (dashboard.workspace.owner_id !== user.id) {
  return NextResponse.json(
    { error: 'Forbidden' },
    { status: 403 }
  );
}
```

---

## Medium Findings

### 2. Inconsistent Ownership Check Pattern

**Severity:** Medium
**Status:** ✅ FIXED

**Description:**
The `/api/dashboards/[id]/transfer/route.ts` endpoint was using `dashboard.owner_id` directly on the dashboard table instead of checking through `workspaces.owner_id` like other endpoints.

**Fix Applied:**
Updated to check both `dashboard.owner_id` and `workspaces.owner_id` for defense in depth, matching the RLS policy pattern from migration 016.

### 3. Admin Client Bypass of RLS

**Severity:** Medium
**Status:** By Design (with caveats)

**Description:**
Several endpoints use `createAdminClient()` which bypasses Row-Level Security:
- `/api/dashboards/shared/route.ts` - Finding shares matching user's email
- `/app/d/[slug]/page.tsx` - Fetching dashboard by slug for public access

**Risk:**
Any vulnerability in these endpoints could bypass RLS protections entirely.

**Recommendation:**
- Document why admin client is necessary in each location
- Add extra validation in code before returning data
- Consider adding audit logging for admin client usage

---

## Low Findings

### 4. Slug Predictability

**Severity:** Low
**Status:** Acceptable Risk

**Description:**
Dashboard slugs are generated from title + nanoid(6). While the nanoid provides 6 characters of randomness (~2 billion combinations), the title portion is predictable.

**Location:** `src/app/api/dashboards/route.ts:172`

**Recommendation:**
Consider using longer nanoid (8-10 characters) for additional entropy if slug enumeration becomes a concern.

### 5. No Audit Logging for Share Operations

**Severity:** Low
**Status:** Enhancement

**Description:**
Creating, modifying, or deleting shares does not produce audit logs. This makes it difficult to investigate security incidents related to unauthorized access.

**Recommendation:**
Add audit logging for:
- Share creation
- Share deletion
- Access attempts (both successful and denied)

---

## Positive Findings

The following security measures are properly implemented:

### Authentication
- ✅ All API endpoints check `supabase.auth.getUser()`
- ✅ OTP system has rate limiting (1 min cooldown, max 5 attempts)
- ✅ OTP codes expire after 10 minutes
- ✅ Middleware protects `/dashboards/*` routes

### Authorization
- ✅ Most endpoints verify ownership via `workspaces.owner_id`
- ✅ Share creation/deletion requires dashboard ownership
- ✅ Public dashboard access properly checks `is_published` flag
- ✅ Share-based access correctly validates email/domain

### Row-Level Security
- ✅ RLS enabled on all tables
- ✅ Dashboards: Owner access via `owner_id` or `workspace.owner_id`
- ✅ Shares: Owner can manage, users can view matching shares
- ✅ Published dashboards: Public SELECT access

### Access Revocation
- ✅ When share is deleted, access is immediately revoked
- ✅ Next access attempt shows "Access Denied" page
- ✅ Email/domain matching is case-insensitive

---

## API Endpoint Security Matrix

| Endpoint | Auth | Owner Check | Status |
|----------|------|-------------|--------|
| GET /api/dashboards | ✅ | ✅ via workspace | Secure |
| POST /api/dashboards | ✅ | N/A (creates new) | Secure |
| GET /api/dashboards/[id] | ✅ | ✅ workspaces.owner_id | Secure |
| PUT /api/dashboards/[id] | ✅ | ✅ workspaces.owner_id | Secure |
| DELETE /api/dashboards/[id] | ✅ | ✅ workspaces.owner_id | Secure |
| POST /api/dashboards/[id]/refresh | ✅ | ✅ workspaces.owner_id | **FIXED** |
| POST /api/dashboards/[id]/generate | ✅ | ✅ workspaces.owner_id | Secure |
| POST /api/dashboards/[id]/chat | ✅ | ✅ workspaces.owner_id | Secure |
| GET /api/dashboards/[id]/versions | ✅ | ✅ workspaces.owner_id | Secure |
| POST /api/dashboards/[id]/restore | ✅ | ✅ workspaces.owner_id | Secure |
| DELETE /api/dashboards/[id]/permanent | ✅ | ✅ workspaces.owner_id | Secure |
| POST /api/dashboards/[id]/transfer | ✅ | ✅ both owner_id fields | **FIXED** |
| GET /api/dashboards/[id]/shares | ✅ | ✅ workspaces.owner_id | Secure |
| POST /api/dashboards/[id]/shares | ✅ | ✅ workspaces.owner_id | Secure |
| DELETE /api/dashboards/[id]/shares/[shareId] | ✅ | ✅ workspaces.owner_id | Secure |
| GET /api/dashboards/shared | ✅ | N/A (user's shares) | Secure |
| GET /api/dashboards/trash | ✅ | ✅ via workspace | Secure |

---

## Dashboard Sharing Access Flow

```
User visits /d/[slug]
         │
         ▼
   Is dashboard published?
         │
    ┌────┴────┐
    │ YES     │ NO
    ▼         ▼
  Allow   Is user authenticated?
  Access        │
           ┌────┴────┐
           │ NO      │ YES
           ▼         ▼
         Show    Is user the owner?
         Auth         │
         Gate    ┌────┴────┐
                 │ YES     │ NO
                 ▼         ▼
               Allow   Check shares
               Access       │
                       ┌────┴────┐
                       │ Match   │ No Match
                       ▼         ▼
                     Allow     Deny
                     Access    Access
```

---

## Recommendations

### Immediate Actions
1. ~~Fix the refresh endpoint~~ ✅ DONE
2. ~~Fix the transfer endpoint~~ ✅ DONE

### Short-term
3. Add audit logging for share operations
4. Document admin client usage patterns
5. Consider adding API rate limiting beyond OTP

### Long-term
6. Implement IP-based rate limiting for API endpoints
7. Add session-based access revocation (invalidate sessions when share removed)
8. Consider implementing share expiration dates

---

## Conclusion

The dashboard sharing system is well-architected with proper RLS policies and authorization checks. The critical vulnerability in the refresh endpoint has been fixed. The remaining findings are lower severity but should be addressed to maintain a strong security posture.
