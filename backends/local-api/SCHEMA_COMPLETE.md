# ApkZio Database Schema - Complete ✅

## Overview

Complete PostgreSQL schema implementation for ApkZio platform. Ready for Phase 3 database integration.

## What Was Created

### 📁 Directory Structure
```
backends/local-api/
├── src/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql       (112 lines) - Core tables
│   │   ├── 002_analytics_tables.sql     (30 lines)  - Analytics & events
│   │   ├── 003_admin_crm.sql            (51 lines)  - Admin & CRM
│   │   ├── 004_webhooks_billing.sql     (37 lines)  - Webhooks & billing
│   │   ├── 005_aggregation_tables.sql   (55 lines)  - Advanced analytics
│   │   └── README.md                    (4.4K)      - Migration guide
│   ├── db.ts                            (67 lines)  - Connection module
│   ├── migrate.ts                       (69 lines)  - Migration runner
│   └── examples/
│       └── db-usage.ts                  (185 lines) - Usage examples
├── docs/
│   └── DATABASE_SCHEMA.md               - Full schema documentation
└── package.json                         - Updated with pg & migrate script
```

### 📊 Database Tables (15 total)

#### Core Tables (6)
1. **android_apps** - App registrations with owner & config
2. **push_campaigns** - Push notification campaigns with targeting
3. **devices** - Device registrations with hardware info
4. **push_subscribers** - FCM token management
5. **api_keys** - API authentication with scopes
6. **apk_builds** - APK build history & logs

#### Analytics Tables (3)
7. **analytics_events** - Real-time event tracking
8. **analytics_hourly_rollups** - Hourly aggregated metrics
9. **analytics_daily_rollups** - Daily aggregated metrics

#### Admin Tables (3)
10. **admin_clients** - Client accounts with plans
11. **campaign_errors** - Campaign delivery errors
12. **crash_events** - App crash tracking

#### Future Tables (3)
13. **webhook_endpoints** - Webhook registration
14. **webhook_deliveries** - Webhook delivery tracking
15. **subscriptions** - Stripe billing integration

### 🔑 Key Features

#### Indexes (19 total)
- Foreign key indexes on all relationships
- Time-series indexes for analytics (`app_id, timestamp DESC`)
- Unique constraints on business keys
- JSONB indexes for flexible querying

#### Data Types
- **UUID** for all primary keys (`gen_random_uuid()`)
- **TIMESTAMPTZ** for all timestamps
- **JSONB** for flexible data (event payloads, configs)
- **TEXT[]** for arrays (scopes, country codes)
- **DECIMAL(5,4)** for percentages

#### Constraints
- Foreign keys with `ON DELETE CASCADE`
- Unique constraints on business identifiers
- Default values for timestamps and status fields
- Check constraints implied by application logic

## Quick Start

### 1. Install Dependencies
```bash
cd backends/local-api
npm install
```

### 2. Set Database URL
```bash
export DATABASE_URL="postgresql://user:pass@host:5432/apkzio"
```

### 3. Run Migrations
```bash
npm run migrate
```

### 4. Verify Schema
```bash
psql $DATABASE_URL -c "\dt"  # List tables
psql $DATABASE_URL -c "SELECT * FROM schema_migrations"  # Check migrations
```

## Usage Examples

### Simple Query
```typescript
import { query } from './db.js';

const app = await query(
  'SELECT * FROM android_apps WHERE id = $1',
  [appId]
);
```

### Transaction
```typescript
import { transaction } from './db.js';

await transaction(async (client) => {
  await client.query('INSERT INTO android_apps ...');
  await client.query('INSERT INTO api_keys ...');
});
```

### Full Examples
See `src/examples/db-usage.ts` for 11 complete examples including:
- CRUD operations
- JOINs and aggregations
- Transactions
- Batch inserts
- JSONB queries
- Time-series aggregations
- Pagination

## Migration Strategy

### Version Control
- Each migration has a version number (1-5)
- `schema_migrations` table tracks applied migrations
- Migrations are idempotent (safe to re-run)

### Forward-Only
- No rollback migrations (use new migration to reverse)
- Or restore from database backup

### Zero-Downtime
- Add new columns with defaults (fast)
- Backfill data in batches
- Deploy code that uses new schema
- Drop old columns in next migration

## Performance Optimization

### Query Patterns
✅ **Use rollup tables** for dashboards (fast)
```sql
SELECT * FROM analytics_hourly_rollups WHERE app_id = $1;
```

❌ **Avoid scanning raw events** (slow)
```sql
SELECT COUNT(*) FROM analytics_events WHERE app_id = $1;
```

### Indexes
All common query patterns are indexed:
- `app_id` lookups
- Status filtering
- Time-range queries
- Foreign key relationships

### Connection Pooling
- Max 20 connections
- 30s idle timeout
- 2s connection timeout
- Automatic reconnection

### Monitoring
- Slow queries logged (>1s)
- Connection pool metrics
- Query execution plans

## Next Steps

### Phase 3A: Database Integration
1. ✅ **Schema Complete** - All tables defined
2. ⏳ **Repository Layer** - Create repository classes
3. ⏳ **Replace ApkzioStore** - Migrate from in-memory to PostgreSQL
4. ⏳ **Test Coverage** - Write integration tests

### Phase 3B: Advanced Features
- Materialized views for dashboards
- Partitioning for large tables
- Read replicas for analytics
- Backup & recovery automation

## Documentation

### Primary Docs
- **`src/migrations/README.md`** - Migration guide & troubleshooting
- **`docs/DATABASE_SCHEMA.md`** - Full schema with ER diagram
- **`src/examples/db-usage.ts`** - Code examples

### Quick Reference
```bash
# Run migrations
npm run migrate

# Connect to database
psql $DATABASE_URL

# List tables
\dt

# Describe table
\d android_apps

# Check migration status
SELECT * FROM schema_migrations ORDER BY version;
```

## Success Criteria ✅

All requirements met:

- [x] Migration directory created
- [x] All 5 SQL migration files written
- [x] Migration runner implemented
- [x] Database connection module ready
- [x] Schema supports all features
- [x] Indexes optimized for queries
- [x] npm script configured
- [x] Documentation complete
- [x] Usage examples provided

## Dependencies Added

```json
{
  "dependencies": {
    "pg": "^8.13.1"
  },
  "devDependencies": {
    "@types/pg": "^8.11.10"
  },
  "scripts": {
    "migrate": "tsx src/migrate.ts"
  }
}
```

## Total Lines of Code

- **SQL migrations**: 285 lines (5 files)
- **TypeScript code**: 321 lines (3 files)
- **Documentation**: ~500 lines (3 files)
- **Total**: ~1,100 lines

## Status

**Phase 3 Database Schema: COMPLETE** ✅

Ready for next phase: Repository layer implementation.
