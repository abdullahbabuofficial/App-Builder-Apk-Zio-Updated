# ApkZio Database Schema

Complete PostgreSQL schema documentation with entity relationships and query patterns.

## Entity Relationship Diagram

```mermaid
erDiagram
    admin_clients ||--o{ android_apps : owns
    admin_clients ||--o{ subscriptions : has
    
    android_apps ||--o{ push_campaigns : creates
    android_apps ||--o{ devices : tracks
    android_apps ||--o{ push_subscribers : manages
    android_apps ||--o{ api_keys : secures
    android_apps ||--o{ apk_builds : builds
    android_apps ||--o{ analytics_events : generates
    android_apps ||--o{ crash_events : reports
    
    push_campaigns ||--o{ campaign_errors : fails
    
    webhook_endpoints ||--o{ webhook_deliveries : sends
    
    admin_clients {
        uuid id PK
        text email UK
        text full_name
        text plan
        boolean email_verified
        text account_status
        bigint lifetime_revenue
        int apps_count
        timestamptz created_at
    }
    
    android_apps {
        uuid id PK
        uuid owner_id FK
        text package_name UK
        text app_key UK
        text name
        text status
        text fcm_project_id
        int live_users
        timestamptz created_at
    }
    
    push_campaigns {
        uuid id PK
        uuid app_id FK
        text title
        text body
        text status
        text target_type
        int recipients_count
        int sent_count
        int delivered_count
        timestamptz created_at
    }
    
    devices {
        uuid id PK
        uuid app_id FK
        text install_hash UK
        text manufacturer
        text model
        text country_code
        boolean is_active
        timestamptz last_seen_at
    }
    
    push_subscribers {
        uuid id PK
        uuid app_id FK
        text fcm_token UK
        boolean is_valid
        timestamptz last_seen_at
    }
    
    api_keys {
        uuid id PK
        uuid app_id FK
        text key_hash UK
        text[] scopes
        int rate_limit_rpm
        boolean is_active
        timestamptz expires_at
    }
    
    apk_builds {
        uuid id PK
        uuid app_id FK
        text version_name
        int version_code
        text status
        jsonb config
        bigint apk_size
    }
    
    analytics_events {
        bigserial id PK
        uuid app_id FK
        text event_type
        jsonb event_data
        text device_id
        timestamptz timestamp
    }
    
    campaign_errors {
        bigserial id PK
        uuid campaign_id FK
        text error_code
        jsonb device_info
        timestamptz timestamp
    }
    
    crash_events {
        bigserial id PK
        uuid app_id FK
        text crash_type
        text stack_trace
        timestamptz timestamp
    }
    
    webhook_endpoints {
        uuid id PK
        text url
        text[] events
        boolean is_active
    }
    
    webhook_deliveries {
        uuid id PK
        uuid endpoint_id FK
        text event_type
        jsonb payload
        int response_code
        timestamptz delivered_at
    }
    
    subscriptions {
        uuid id PK
        uuid client_id FK
        text stripe_subscription_id UK
        text plan_name
        text status
        int amount
        timestamptz started_at
    }
```

## Table Details

### Core Tables

#### `android_apps`
Primary entity representing a registered Android app.

**Key Columns:**
- `owner_id`: Links to `admin_clients.id` (client who owns this app)
- `app_key`: Unique secret key for SDK authentication
- `package_name`: Android package identifier (e.g., `com.example.app`)
- `fcm_project_id`: Firebase Cloud Messaging project ID
- `live_users`, `active_devices_24h`, `total_installs`: Cached metrics

**Indexes:**
- `idx_apps_owner` on `owner_id`

**Typical Queries:**
```sql
-- Get all apps for a client
SELECT * FROM android_apps WHERE owner_id = $1;

-- Find app by package name
SELECT * FROM android_apps WHERE package_name = $1;
```

#### `push_campaigns`
Push notification campaigns with targeting and delivery tracking.

**Key Columns:**
- `status`: `draft`, `scheduled`, `sending`, `completed`, `failed`
- `target_type`: `all`, `active`, `country`, `device_ids`
- `country_codes`, `device_ids`: Targeting parameters (arrays)
- `recipients_count`, `sent_count`, `delivered_count`: Delivery metrics

**Indexes:**
- `idx_campaigns_app` on `app_id`
- `idx_campaigns_status` on `status`

**Typical Queries:**
```sql
-- Get campaigns for an app
SELECT * FROM push_campaigns WHERE app_id = $1 ORDER BY created_at DESC;

-- Get active campaigns
SELECT * FROM push_campaigns WHERE status = 'sending';
```

#### `devices`
Device registrations with hardware info and activity tracking.

**Key Columns:**
- `install_hash`: Unique device identifier from SDK
- `manufacturer`, `model`, `os_version`: Hardware info
- `is_active`: Whether device was active in last 24h
- `last_seen_at`: Last heartbeat timestamp

**Indexes:**
- `idx_devices_app` on `app_id`
- `UNIQUE(app_id, install_hash)`

**Typical Queries:**
```sql
-- Count active devices for app
SELECT COUNT(*) FROM devices WHERE app_id = $1 AND is_active = true;

-- Get devices by country
SELECT * FROM devices WHERE app_id = $1 AND country_code = $2;
```

#### `push_subscribers`
FCM token management with validation status.

**Key Columns:**
- `fcm_token`: Full FCM registration token
- `fcm_token_redacted`: Masked token for display (e.g., `abc...xyz`)
- `is_valid`: Whether token is valid (updated by FCM feedback)

**Indexes:**
- `idx_subscribers_app` on `app_id`
- `UNIQUE(app_id, fcm_token)`

**Typical Queries:**
```sql
-- Count valid subscribers
SELECT COUNT(*) FROM push_subscribers WHERE app_id = $1 AND is_valid = true;

-- Get subscribers for targeting
SELECT fcm_token FROM push_subscribers 
WHERE app_id = $1 AND is_valid = true 
LIMIT 1000;
```

### Analytics Tables

#### `analytics_events`
Real-time event tracking with flexible JSONB data.

**Key Columns:**
- `event_type`: `device_heartbeat`, `campaign_delivered`, `campaign_opened`, etc.
- `event_data`: Arbitrary JSON payload
- `device_id`: Optional device identifier

**Indexes:**
- `idx_analytics_app_time` on `(app_id, timestamp DESC)`
- `idx_analytics_type` on `event_type`
- `idx_analytics_device` on `device_id`

**Typical Queries:**
```sql
-- Get recent events for app
SELECT * FROM analytics_events 
WHERE app_id = $1 AND timestamp > NOW() - INTERVAL '1 hour'
ORDER BY timestamp DESC;

-- Count events by type
SELECT event_type, COUNT(*) 
FROM analytics_events 
WHERE app_id = $1 
GROUP BY event_type;
```

#### `analytics_hourly_rollups`
Pre-aggregated hourly metrics for fast dashboard queries.

**Key Columns:**
- `hour_bucket`: Hourly timestamp (e.g., `2026-05-08 18:00:00`)
- `event_count`: Total events in that hour
- `unique_devices`: Distinct device count

**Typical Queries:**
```sql
-- Get last 24h rollups
SELECT * FROM analytics_hourly_rollups
WHERE app_id = $1 AND hour_bucket > NOW() - INTERVAL '24 hours'
ORDER BY hour_bucket DESC;
```

### Admin Tables

#### `admin_clients`
Client accounts with plan and revenue tracking.

**Key Columns:**
- `plan`: `starter`, `pro`, `enterprise`
- `account_status`: `lead`, `trial`, `active`, `churned`
- `lifetime_revenue`: Total revenue in cents
- `apps_count`, `builds_count`: Cached counts

**Typical Queries:**
```sql
-- Get client by email
SELECT * FROM admin_clients WHERE email = $1;

-- Get active clients
SELECT * FROM admin_clients WHERE account_status = 'active';
```

## Query Optimization Guidelines

### Use Appropriate Indexes
All foreign keys and common filters have indexes. Check query plans:
```sql
EXPLAIN ANALYZE SELECT * FROM push_campaigns WHERE app_id = 'xxx';
```

### Use Rollup Tables
For analytics dashboards, prefer `analytics_hourly_rollups` over raw events:
```sql
-- Fast (uses rollups)
SELECT SUM(event_count) FROM analytics_hourly_rollups 
WHERE app_id = $1 AND hour_bucket > NOW() - INTERVAL '7 days';

-- Slow (scans millions of rows)
SELECT COUNT(*) FROM analytics_events 
WHERE app_id = $1 AND timestamp > NOW() - INTERVAL '7 days';
```

### Use Pagination
Always use `LIMIT` and `OFFSET` for large result sets:
```sql
SELECT * FROM analytics_events 
WHERE app_id = $1 
ORDER BY timestamp DESC 
LIMIT 100 OFFSET $2;
```

### Use Transactions
For multi-table updates, use transactions:
```typescript
await transaction(async (client) => {
  await client.query('INSERT INTO android_apps ...');
  await client.query('INSERT INTO api_keys ...');
});
```

## Migration History

| Version | File | Description |
|---------|------|-------------|
| 1 | `001_initial_schema.sql` | Core tables: apps, campaigns, devices, subscribers, API keys, builds |
| 2 | `002_analytics_tables.sql` | Analytics events and hourly rollups |
| 3 | `003_admin_crm.sql` | Admin clients, campaign errors, crash tracking |
| 4 | `004_webhooks_billing.sql` | Webhooks and Stripe billing |

## Development Workflow

### 1. Start Local Database
```bash
docker run -d -p 5432:5432 \
  -e POSTGRES_DB=apkzio \
  -e POSTGRES_PASSWORD=dev \
  postgres:16
```

### 2. Run Migrations
```bash
export DATABASE_URL="postgresql://postgres:dev@localhost:5432/apkzio"
npm run migrate
```

### 3. Seed Test Data
```bash
psql $DATABASE_URL -f scripts/seed-test-data.sql
```

### 4. Test Queries
```bash
psql $DATABASE_URL
> \dt  -- List tables
> SELECT * FROM android_apps;
```

## Production Considerations

### Backup Strategy
- Daily full backups
- Point-in-time recovery enabled
- Retention: 30 days

### Monitoring
- Query performance (slow query log)
- Connection pool usage
- Table size growth
- Index usage stats

### Scaling
- Read replicas for analytics queries
- Partitioning for `analytics_events` (by month)
- Connection pooling (PgBouncer)
- Caching layer (Redis) for hot data
