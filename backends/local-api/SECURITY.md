# Security Hardening

This document describes the security features implemented in ApkZio Local API.

## Features Implemented

### 1. Rate Limiting

**Location**: `src/security/rate-limiter.ts`

- **API Rate Limiter**: 100 requests per 15 minutes per IP
- **Auth Rate Limiter**: 5 login attempts per 15 minutes per IP (skips successful requests)
- **Event Rate Limiter**: 1000 events per minute per IP

**Redis Support**: Rate limiters automatically use Redis if `REDIS_URL` is configured, falling back to in-memory storage.

**Usage**:
```typescript
import { apiLimiter, authLimiter, eventLimiter } from './security/rate-limiter.js';

app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);
app.use('/api/events', eventLimiter);
```

### 2. Input Validation

**Location**: `src/security/validation.ts`

Uses Zod for schema validation:
- App creation validation
- Campaign creation validation
- API key creation validation

**Usage**:
```typescript
import { schemas, validate } from './security/validation.ts';

const validatedData = validate(schemas.createApp, req.body);
```

### 3. SQL Injection Prevention

**Location**: `src/db.ts`

- Always uses parameterized queries
- Added `safeQuery()` function with dangerous SQL pattern detection
- Blocks DROP, DELETE, TRUNCATE unless marked with `--safe`

**Usage**:
```typescript
import { safeQuery } from './db.js';

// Safe - uses parameterized query
await safeQuery('SELECT * FROM users WHERE id = $1', [userId]);

// Blocked - contains DROP without --safe flag
await safeQuery('DROP TABLE users'); // Throws error
```

### 4. CSRF Protection

**Location**: `src/security/csrf.ts`

- Cookie-based CSRF tokens
- HTTP-only, secure, SameSite=strict cookies
- Automatic exclusion for API routes with Bearer tokens
- Endpoint: `GET /api/csrf-token` to retrieve token

**Note**: CSRF middleware is deprecated. Enable with `ENABLE_CSRF=1` environment variable.

**Usage**:
```typescript
import { setupCsrf } from './security/csrf.js';

setupCsrf(app);
```

### 5. Security Headers

**Location**: `src/security/headers.ts`

Using Helmet.js:
- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection

**Configuration**:
```typescript
import { setupSecurityHeaders } from './security/headers.js';

setupSecurityHeaders(app);
```

### 6. API Key Authentication

**Location**: `src/security/auth.ts`

- SHA-256 hashed API keys
- Expiration checking
- Scope-based authorization
- Last-used tracking

**Usage**:
```typescript
import { authenticateApiKey, requireScope } from './security/auth.js';

app.post('/api/campaigns', 
  authenticateApiKey, 
  requireScope('push:send'), 
  handler
);
```

### 7. XSS Protection

**Location**: `src/security/sanitize.ts`

Using DOMPurify:
- Strips all HTML tags from input
- Recursive object sanitization
- No allowed tags or attributes by default

**Usage**:
```typescript
import { sanitizeInput, sanitizeObject } from './security/sanitize.js';

const clean = sanitizeInput(userInput);
const cleanObj = sanitizeObject(req.body);
```

### 8. Security Audit Script

**Location**: `scripts/security-audit.ts`

Checks for:
- API keys without expiration
- Inactive admin accounts (>90 days)
- Missing environment secrets

**Run**:
```bash
npm run security:audit
```

## Environment Variables

Required for production:
```env
# Database
DATABASE_URL=postgresql://...

# Stripe
STRIPE_SECRET_KEY=sk_live_...

# Firebase (optional)
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}

# Admin API
APKZIO_ADMIN_API_KEY=sk_admin_...

# Redis (optional, for distributed rate limiting)
REDIS_URL=redis://localhost:6379

# CSRF (optional, deprecated)
ENABLE_CSRF=1

# Domain for CSP
API_DOMAIN=https://api.apkzio.com
```

## Security Best Practices

1. **Always use HTTPS in production**
2. **Rotate API keys regularly**
3. **Set expiration dates on all API keys**
4. **Use Redis for rate limiting in production**
5. **Monitor rate limit violations**
6. **Run security audit regularly**
7. **Keep dependencies updated**
8. **Use strong admin API keys**
9. **Enable all security headers**
10. **Sanitize user input**

## Testing Security

### Test Rate Limiting
```bash
# Test auth rate limit (should block after 5 attempts)
for i in {1..10}; do
  curl -X POST http://localhost:8787/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
done
```

### Test API Key Auth
```bash
# Without API key (should fail)
curl -X POST http://localhost:8787/api/campaigns \
  -H "Content-Type: application/json" \
  -d '{"title":"Test"}'

# With API key (should succeed if key has push:send scope)
curl -X POST http://localhost:8787/api/campaigns \
  -H "Authorization: Bearer sk_..." \
  -H "Content-Type: application/json" \
  -d '{"title":"Test"}'
```

### Test CSRF Protection
```bash
# Get CSRF token
curl http://localhost:8787/api/csrf-token

# Use token in request
curl -X POST http://localhost:8787/api/apps \
  -H "X-CSRF-Token: YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test App"}'
```

## Incident Response

If a security incident occurs:

1. **Identify**: Check logs for suspicious activity
2. **Contain**: Disable affected API keys
3. **Eradicate**: Fix the vulnerability
4. **Recover**: Rotate credentials, update affected systems
5. **Learn**: Update security measures

## Security Checklist

- [ ] Rate limiting enabled and tested
- [ ] API keys use hashed storage
- [ ] All API keys have expiration dates
- [ ] Security headers configured
- [ ] Input validation on all endpoints
- [ ] SQL injection protection verified
- [ ] XSS sanitization tested
- [ ] HTTPS enabled in production
- [ ] Redis configured for rate limiting
- [ ] Security audit runs in CI/CD
- [ ] Monitoring alerts configured
- [ ] Incident response plan documented

## Support

For security issues, contact: security@apkzio.com
