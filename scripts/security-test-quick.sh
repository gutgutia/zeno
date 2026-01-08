#!/bin/bash
#
# Quick Security Test for Zeno
# Tests basic security properties without requiring database access
#
# Usage:
#   ./scripts/security-test-quick.sh [BASE_URL]
#
# Examples:
#   ./scripts/security-test-quick.sh                     # Test localhost:3000
#   ./scripts/security-test-quick.sh https://zeno.fyi    # Test production
#

BASE_URL="${1:-http://localhost:3000}"
PASSED=0
FAILED=0

echo "🔒 Zeno Quick Security Test"
echo "════════════════════════════════════════════════════"
echo "Target: $BASE_URL"
echo "════════════════════════════════════════════════════"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

pass() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
    ((PASSED++))
}

fail() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    echo "   └─ $2"
    ((FAILED++))
}

# ============================================================================
# Test 1: Security Headers
# ============================================================================
echo ""
echo "📋 Testing Security Headers..."
echo "────────────────────────────────────────────────────"

HEADERS=$(curl -sI "$BASE_URL" 2>/dev/null)

# X-Frame-Options
if echo "$HEADERS" | grep -qi "x-frame-options: deny"; then
    pass "X-Frame-Options: DENY"
else
    fail "X-Frame-Options header missing or incorrect" "Should be 'DENY'"
fi

# X-Content-Type-Options
if echo "$HEADERS" | grep -qi "x-content-type-options: nosniff"; then
    pass "X-Content-Type-Options: nosniff"
else
    fail "X-Content-Type-Options header missing" "Should be 'nosniff'"
fi

# Strict-Transport-Security
if echo "$HEADERS" | grep -qi "strict-transport-security"; then
    pass "Strict-Transport-Security present"
else
    fail "HSTS header missing" "Should have Strict-Transport-Security"
fi

# Content-Security-Policy
if echo "$HEADERS" | grep -qi "content-security-policy"; then
    pass "Content-Security-Policy present"
else
    fail "CSP header missing" "Should have Content-Security-Policy"
fi

# Referrer-Policy
if echo "$HEADERS" | grep -qi "referrer-policy"; then
    pass "Referrer-Policy present"
else
    fail "Referrer-Policy header missing"
fi

# X-Powered-By should NOT be present
if echo "$HEADERS" | grep -qi "x-powered-by"; then
    fail "X-Powered-By header exposed" "Technology fingerprinting possible"
else
    pass "X-Powered-By header removed"
fi

# ============================================================================
# Test 2: API Authentication Required
# ============================================================================
echo ""
echo "📋 Testing API Authentication..."
echo "────────────────────────────────────────────────────"

ENDPOINTS=(
    "GET /api/dashboards"
    "GET /api/organizations"
    "GET /api/folders"
    "GET /api/credits"
    "GET /api/plan"
    "GET /api/workspaces"
    "POST /api/dashboards"
    "POST /api/billing/checkout"
    "GET /api/admin/users"
)

for endpoint in "${ENDPOINTS[@]}"; do
    METHOD=$(echo "$endpoint" | cut -d' ' -f1)
    PATH=$(echo "$endpoint" | cut -d' ' -f2)

    if [ "$METHOD" = "GET" ]; then
        STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$PATH")
    else
        STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X "$METHOD" -H "Content-Type: application/json" -d '{}' "$BASE_URL$PATH")
    fi

    if [ "$STATUS" = "401" ]; then
        pass "$endpoint returns 401 Unauthorized"
    else
        fail "$endpoint should require auth" "Got HTTP $STATUS, expected 401"
    fi
done

# ============================================================================
# Test 3: Rate Limiting
# ============================================================================
echo ""
echo "📋 Testing Rate Limiting..."
echo "────────────────────────────────────────────────────"

# Send 15 OTP requests rapidly (limit is 10 per 5 min)
echo "Sending 15 rapid OTP requests..."
RATE_LIMITED=false
for i in {1..15}; do
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST -H "Content-Type: application/json" \
        -d "{\"email\": \"ratelimit-test-$i@example.com\"}" \
        "$BASE_URL/api/auth/send-otp" 2>/dev/null)

    STATUS=$(echo "$RESPONSE" | tail -1)

    if [ "$STATUS" = "429" ]; then
        RATE_LIMITED=true
        pass "Rate limiting triggered after $i requests"
        break
    fi
done

if [ "$RATE_LIMITED" = false ]; then
    fail "Rate limiting not working" "Sent 15 requests without getting 429"
fi

# ============================================================================
# Test 4: Input Validation
# ============================================================================
echo ""
echo "📋 Testing Input Validation..."
echo "────────────────────────────────────────────────────"

# SQL injection in email
RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" \
    -d '{"email": "test@example.com; DROP TABLE users;--"}' \
    "$BASE_URL/api/auth/send-otp")

if echo "$RESPONSE" | grep -qi "invalid email"; then
    pass "SQL injection in email rejected"
else
    fail "SQL injection not properly handled" "Response: $RESPONSE"
fi

# Invalid email format
RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" \
    -d '{"email": "not-an-email"}' \
    "$BASE_URL/api/auth/send-otp")

if echo "$RESPONSE" | grep -qi "invalid email"; then
    pass "Invalid email format rejected"
else
    fail "Invalid email format not rejected" "Response: $RESPONSE"
fi

# ============================================================================
# Test 5: Sensitive File Access
# ============================================================================
echo ""
echo "📋 Testing Sensitive File Access..."
echo "────────────────────────────────────────────────────"

SENSITIVE_PATHS=(
    "/.env"
    "/.git/config"
    "/api/.env"
    "/.env.local"
    "/package.json"
)

for path in "${SENSITIVE_PATHS[@]}"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$path")

    if [ "$STATUS" = "404" ] || [ "$STATUS" = "403" ]; then
        pass "$path returns $STATUS (not accessible)"
    else
        fail "$path accessible" "Got HTTP $STATUS, should be 404 or 403"
    fi
done

# ============================================================================
# Test 6: CORS Configuration
# ============================================================================
echo ""
echo "📋 Testing CORS Configuration..."
echo "────────────────────────────────────────────────────"

# Test with malicious origin
CORS_HEADERS=$(curl -sI -H "Origin: https://evil.com" "$BASE_URL/api/dashboards" 2>/dev/null)

if echo "$CORS_HEADERS" | grep -qi "access-control-allow-origin: \*"; then
    fail "CORS allows all origins" "Wildcard Access-Control-Allow-Origin found"
elif echo "$CORS_HEADERS" | grep -qi "access-control-allow-origin: https://evil.com"; then
    fail "CORS allows malicious origin" "evil.com was reflected"
else
    pass "CORS does not allow arbitrary origins"
fi

# ============================================================================
# Test 7: security.txt
# ============================================================================
echo ""
echo "📋 Testing Security Disclosure..."
echo "────────────────────────────────────────────────────"

SECURITY_TXT=$(curl -s "$BASE_URL/.well-known/security.txt")

if echo "$SECURITY_TXT" | grep -qi "contact"; then
    pass "security.txt exists with contact info"
else
    fail "security.txt missing or incomplete" "Should have Contact field"
fi

# ============================================================================
# Summary
# ============================================================================
echo ""
echo "════════════════════════════════════════════════════"
echo "📊 SECURITY TEST SUMMARY"
echo "════════════════════════════════════════════════════"
echo ""
echo "Total Tests: $((PASSED + FAILED))"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All security tests passed!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some security tests failed. Review the issues above.${NC}"
    exit 1
fi
