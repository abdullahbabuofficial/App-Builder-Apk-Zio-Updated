# Admin Clients CRM API

Complete backend API for managing customer accounts in the ApkZio enterprise admin console.

## Overview

The Admin Clients API provides full CRUD operations for customer account management, including:
- List and search clients with filtering
- View detailed client profiles
- Create new client accounts
- Update client information
- Delete client accounts
- Impersonate clients for support

## Authentication

All endpoints require admin authentication via one of:
- **Admin API Key**: `x-apkzio-admin-key` header with `APKZIO_ADMIN_API_KEY`
- **Verified Business/Enterprise Account**: Bearer token from verified business or enterprise user

## Database Schema

When using persistent storage (Postgres), run the migration:

```sql
-- See backends/local-api/src/migrations/001_admin_clients.sql
CREATE TABLE admin_clients (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  plan TEXT CHECK (plan IN ('starter', 'pro', 'business', 'enterprise')),
  email_verified BOOLEAN DEFAULT false,
  google_linked BOOLEAN DEFAULT false,
  account_status TEXT CHECK (account_status IN ('lead', 'active', 'churned')),
  -- ... additional fields
);
```

## API Endpoints

### List Clients

```http
GET /api/admin/clients
```

**Query Parameters:**
- `q` (string): Search by name, email, or ID
- `plan` (string): Filter by plan (`starter`, `pro`, `business`, `enterprise`)
- `status` (string): Filter by lifecycle status (`lead`, `active`, `churned`)
- `google_linked` (boolean): Filter by Google sign-in (`true`, `false`)
- `offset` (number): Pagination offset (default: 0)
- `limit` (number): Results per page (default: 50, max: 200)

**Response:**
```json
{
  "ok": true,
  "total": 150,
  "clients": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "full_name": "John Doe",
      "plan": "pro",
      "email_verified": true,
      "google_linked": false,
      "account_status": "active",
      "apps_count": 3,
      "builds_count": 12,
      "active_subscriptions": 1,
      "lifetime_revenue": 299,
      "last_seen_at": "2026-05-08T12:00:00Z",
      "created_at": "2026-01-15T10:30:00Z"
    }
  ]
}
```

### Get Client Detail

```http
GET /api/admin/clients/:userId
```

**Response:**
```json
{
  "ok": true,
  "client": {
    "summary": { /* AdminClientSummary */ },
    "profile": {
      "id": "uuid",
      "email": "user@example.com",
      "full_name": "John Doe",
      "plan": "pro",
      "phone": "+1234567890",
      "location": "New York",
      "website": "https://example.com",
      "bio": "Developer and entrepreneur"
    },
    "apps": [
      {
        "id": "app-uuid",
        "name": "My App",
        "package_name": "com.example.myapp",
        "status": "active",
        "created_at": "2026-02-01T08:00:00Z"
      }
    ],
    "builds": [ /* recent builds */ ],
    "subscriptions": [ /* active/cancelled subscriptions */ ],
    "payments": [ /* payment history */ ],
    "invoices": [ /* invoices */ ],
    "cart": {
      "items_count": 0,
      "promo_code": null
    },
    "contact_messages": [ /* support inquiries */ ]
  }
}
```

### Create Client

```http
POST /api/admin/clients
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "full_name": "Jane Smith",
  "plan": "pro",
  "phone": "+1234567890",
  "location": "San Francisco",
  "website": "https://janesmith.com",
  "bio": "Product designer"
}
```

**Response:** `201 Created`
```json
{
  "ok": true,
  "client": { /* AdminClientSummary */ }
}
```

**Errors:**
- `400 invalid_email`: Email format invalid
- `400 invalid_full_name`: Full name required
- `400 invalid_plan`: Invalid plan value
- `409 conflict`: Email already in use

### Update Client

```http
PATCH /api/admin/clients/:userId
Content-Type: application/json
```

**Request Body:** (all fields optional)
```json
{
  "full_name": "Jane Smith Updated",
  "plan": "business",
  "email_verified": true,
  "phone": "+1987654321",
  "location": "Los Angeles",
  "website": "https://newsite.com",
  "bio": "Updated bio"
}
```

**Response:**
```json
{
  "ok": true,
  "client": { /* AdminClientSummary */ }
}
```

**Errors:**
- `404 not_found`: Client not found
- `400 invalid_request`: Invalid input

### Delete Client

```http
DELETE /api/admin/clients/:userId
```

**Response:**
```json
{
  "ok": true
}
```

**Errors:**
- `404 not_found`: Client not found

**Note:** Deletion cascades to:
- User apps
- Carts
- Subscriptions
- Payments
- Invoices
- Push tokens

### Impersonate Client

```http
POST /api/admin/clients/:userId/impersonate
```

**Response:**
```json
{
  "ok": true,
  "token": "jwt-token-here",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "plan": "pro",
    "email_verified": true,
    "created_at": "2026-01-15T10:30:00Z"
  }
}
```

**Usage:**
Use the returned token as a Bearer token to make authenticated requests as the client:

```http
GET /api/me/apps
Authorization: Bearer <token>
```

**Security:** Impersonation events are logged with admin identity and target user for audit trails.

**Errors:**
- `404 not_found`: Client not found

## Frontend Integration

### ApkZioDataContext

The frontend automatically switches between mock data and REST API based on `VITE_APKZIO_DATA_SOURCE`:

```typescript
import { useApkzio } from "@/context/ApkzioDataContext";
import * as api from "@/lib/api";

const { dataSource } = useApkzio();

if (dataSource === "rest") {
  // Use live API
  const { total, clients } = await api.fetchAdminClients({
    q: "john",
    plan: "pro",
    limit: 50,
  });
}
```

### API Client Methods

```typescript
// List clients
import { fetchAdminClients } from "@/lib/api";
const { total, clients } = await fetchAdminClients({
  q: "search",
  plan: "pro",
  status: "active",
  google_linked: true,
  offset: 0,
  limit: 50,
});

// Get detail
import { fetchAdminClientDetail } from "@/lib/api";
const detail = await fetchAdminClientDetail(userId);

// Create
import { createAdminClient } from "@/lib/api";
const newClient = await createAdminClient({
  email: "new@example.com",
  full_name: "New User",
  plan: "starter",
});

// Update
import { updateAdminClient } from "@/lib/api";
const updated = await updateAdminClient(userId, {
  plan: "pro",
  email_verified: true,
});

// Delete
import { deleteAdminClient } from "@/lib/api";
await deleteAdminClient(userId);

// Impersonate
import { impersonateAdminClient } from "@/lib/api";
const { token, user } = await impersonateAdminClient(userId);
```

## Configuration

### Environment Variables

**Backend (`backends/local-api/.env`):**
```bash
# Admin API key for dashboard access
APKZIO_ADMIN_API_KEY=your-secret-admin-key

# Enforce admin auth (1=yes, 0=no, default=0 in dev, 1 in production)
ENFORCE_ADMIN_AUTH=1
```

**Frontend (`apkzio-admin/.env`):**
```bash
# Data source (rest, supabase, mock)
VITE_APKZIO_DATA_SOURCE=rest

# API URL
VITE_APKZIO_API_URL=http://localhost:8787

# Admin API key (for internal consoles only)
VITE_APKZIO_ADMIN_API_KEY=your-secret-admin-key
```

## Testing

### Manual Testing

1. Start the backend:
```bash
cd backends/local-api
npm run dev
```

2. Start the frontend:
```bash
cd apkzio-admin
npm run dev
```

3. Navigate to `http://localhost:5177/clients`

### Integration Tests

Run the API test suite:
```bash
cd backends/local-api
npm test -- admin-clients-api.test.ts
```

### Example cURL Commands

```bash
# List clients
curl -H "x-apkzio-admin-key: sk_live_demo_apkzio_local" \
  http://localhost:8787/api/admin/clients

# Create client
curl -X POST \
  -H "x-apkzio-admin-key: sk_live_demo_apkzio_local" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","full_name":"Test User","plan":"pro"}' \
  http://localhost:8787/api/admin/clients

# Get detail
curl -H "x-apkzio-admin-key: sk_live_demo_apkzio_local" \
  http://localhost:8787/api/admin/clients/{userId}

# Update client
curl -X PATCH \
  -H "x-apkzio-admin-key: sk_live_demo_apkzio_local" \
  -H "Content-Type: application/json" \
  -d '{"plan":"business","email_verified":true}' \
  http://localhost:8787/api/admin/clients/{userId}

# Delete client
curl -X DELETE \
  -H "x-apkzio-admin-key: sk_live_demo_apkzio_local" \
  http://localhost:8787/api/admin/clients/{userId}

# Impersonate
curl -X POST \
  -H "x-apkzio-admin-key: sk_live_demo_apkzio_local" \
  http://localhost:8787/api/admin/clients/{userId}/impersonate
```

## Migration from In-Memory to Postgres

The current implementation uses in-memory storage. To migrate to Postgres:

1. **Run the migration:**
```bash
psql -h localhost -U postgres -d apkzio < backends/local-api/src/migrations/001_admin_clients.sql
```

2. **Update store.ts** to use database queries instead of Map operations:
```typescript
// Example: Replace in-memory listAdminClients with SQL
async listAdminClients(opts): Promise<{ total: number; clients: AdminClientSummary[] }> {
  const query = `
    SELECT * FROM admin_clients
    WHERE ($1::text IS NULL OR email ILIKE $1 OR full_name ILIKE $1)
    AND ($2::text IS NULL OR plan = $2)
    AND ($3::text IS NULL OR account_status = $3)
    ORDER BY last_seen_at DESC NULLS LAST
    LIMIT $4 OFFSET $5
  `;
  // ... execute query
}
```

3. **Test the migration** using the integration test suite

## Security Considerations

- **Admin authentication required**: All endpoints check for admin privileges
- **Impersonation logging**: All impersonation events logged for audit
- **Cascade deletes**: Deletion removes all user data to prevent orphans
- **Email validation**: Strict email format validation on create/update
- **Rate limiting**: Apply standard rate limits to admin endpoints
- **HTTPS only**: Use HTTPS in production to protect admin API keys

## Troubleshooting

### 403 Forbidden Error
- Verify `APKZIO_ADMIN_API_KEY` matches between frontend and backend
- Check `ENFORCE_ADMIN_AUTH` setting
- Ensure admin API key is passed in `x-apkzio-admin-key` header

### Clients Not Showing
- Verify `VITE_APKZIO_DATA_SOURCE=rest` in frontend `.env`
- Check `VITE_APKZIO_API_URL` points to running backend
- Verify backend is running: `curl http://localhost:8787/health`

### Search/Filter Not Working
- Check query parameter format in URL
- Verify backend logs for parsing errors
- Test with curl to isolate frontend vs backend issue

## Roadmap

Future enhancements:
- [ ] Pagination UI in frontend
- [ ] Advanced search with multiple field filters
- [ ] Bulk operations (bulk delete, bulk update)
- [ ] Export to Excel
- [ ] Activity timeline for clients
- [ ] Notes/comments on client records
- [ ] Email client from admin console
- [ ] Client segmentation and tagging
