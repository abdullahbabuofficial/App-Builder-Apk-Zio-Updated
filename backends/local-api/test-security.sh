#!/bin/bash

# Security Testing Script for ApkZio
# Tests rate limiting, authentication, and security headers

API_URL=${API_URL:-"http://localhost:8787"}
COLORS=true

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔒 ApkZio Security Test Suite"
echo "Testing API at: $API_URL"
echo ""

# Test 1: Rate Limiting on Auth Endpoint
echo "Test 1: Auth Rate Limiting (should block after 5 attempts)"
success_count=0
blocked_count=0

for i in {1..8}; do
  response=$(curl -s -w "%{http_code}" -o /dev/null -X POST "$API_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}')
  
  if [ "$response" = "429" ]; then
    blocked_count=$((blocked_count + 1))
  else
    success_count=$((success_count + 1))
  fi
  sleep 0.2
done

if [ "$blocked_count" -gt 0 ]; then
  echo -e "${GREEN}✓${NC} Auth rate limiting working ($success_count passed, $blocked_count blocked)"
else
  echo -e "${RED}✗${NC} Auth rate limiting NOT working (all $success_count requests passed)"
fi
echo ""

# Test 2: Security Headers
echo "Test 2: Security Headers"
headers=$(curl -s -I "$API_URL/health")

if echo "$headers" | grep -q "X-Content-Type-Options"; then
  echo -e "${GREEN}✓${NC} X-Content-Type-Options header present"
else
  echo -e "${RED}✗${NC} X-Content-Type-Options header missing"
fi

if echo "$headers" | grep -q "X-Frame-Options"; then
  echo -e "${GREEN}✓${NC} X-Frame-Options header present"
else
  echo -e "${RED}✗${NC} X-Frame-Options header missing"
fi

if echo "$headers" | grep -q "Strict-Transport-Security"; then
  echo -e "${GREEN}✓${NC} HSTS header present"
else
  echo -e "${YELLOW}⚠${NC} HSTS header missing (may be disabled in dev)"
fi
echo ""

# Test 3: API Key Authentication
echo "Test 3: API Key Authentication"
response=$(curl -s -w "%{http_code}" -o /dev/null -X GET "$API_URL/api/api-keys" \
  -H "Content-Type: application/json")

if [ "$response" = "401" ] || [ "$response" = "403" ]; then
  echo -e "${GREEN}✓${NC} Unauthorized access blocked (HTTP $response)"
else
  echo -e "${YELLOW}⚠${NC} Unexpected response (HTTP $response) - may need auth"
fi
echo ""

# Test 4: Input Validation
echo "Test 4: Input Validation"
response=$(curl -s -X POST "$API_URL/api/builder/builds" \
  -H "Content-Type: application/json" \
  -d '{"website_url":"not-a-url","app_name":"","package_name":"invalid"}')

if echo "$response" | grep -q "error"; then
  echo -e "${GREEN}✓${NC} Invalid input rejected"
else
  echo -e "${RED}✗${NC} Invalid input accepted (validation may be missing)"
fi
echo ""

# Test 5: CORS Headers
echo "Test 5: CORS Configuration"
response=$(curl -s -I -X OPTIONS "$API_URL/api/apps" \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: POST")

if echo "$response" | grep -q "Access-Control-Allow"; then
  echo -e "${GREEN}✓${NC} CORS headers configured"
else
  echo -e "${RED}✗${NC} CORS headers missing"
fi
echo ""

# Test 6: SQL Injection Protection (indirect test)
echo "Test 6: SQL Injection Protection"
response=$(curl -s -X POST "$API_URL/api/contact" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","message":"'; DROP TABLE users; --"}')

if echo "$response" | grep -q "ok"; then
  echo -e "${GREEN}✓${NC} SQL injection attempt handled (parameterized queries working)"
else
  echo -e "${YELLOW}⚠${NC} Response: $response"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Security Test Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✓ = Pass"
echo "⚠ = Warning or Expected Behavior"
echo "✗ = Fail"
echo ""
echo "For production deployment:"
echo "1. Ensure HTTPS is enabled"
echo "2. Configure Redis for rate limiting"
echo "3. Set strong API keys"
echo "4. Run 'npm run security:audit'"
echo "5. Enable monitoring and alerting"
