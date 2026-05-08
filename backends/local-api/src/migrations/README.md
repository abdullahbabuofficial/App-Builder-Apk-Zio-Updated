# ApkZio Database Migrations

Complete PostgreSQL schema for ApkZio platform.

## Schema Overview

### Migration 001: Core Tables
- **android_apps**: App registrations with owner, package name, FCM config
- **push_campaigns**: Push notification campaigns with targeting and stats
- **devices**: Device registrations with hardware info and activity tracking
- **push_subscribers**: FCM token management with validation status
- **api_keys**: API authentication with scopes and rate limiting
- **apk_builds**: APK build history with status and logs

### Migration 002: Analytics
- **analytics_events**: Real-time event tracking with JSONB data
- **analytics_hourly_rollups**: Pre-aggregated metrics for fast queries

### Migration 003: Admin & CRM
- **admin_clients**: Client accounts with plan and revenue tracking
- **campaign_errors**: Campaign delivery failure tracking
- **crash_events**: App crash reporting and analysis

### Migration 004: Future Features
- **webhook_endpoints**: Webhook registration and configuration
- **webhook_deliveries**: Webhook delivery tracking with retries
- **subscriptions**: Stripe billing integration

## Running Migrations

### Prerequisites
```bash
# Install dependencies
npm install

# Set database URL (or use default: postgresql://localhost:5432/apkzio)
export DATABASE_URL="postgresql://user:pass@host:5432/dbname"
```

### Run All Migrations
```bash
npm run migrate
```

### Manual Migration
```bash
# Run specific migration
psql $DATABASE_URL -f src/migrations/001_initial_schema.sql

# Check migration status
psql $DATABASE_URL -c "SELECT * FROM schema_migrations ORDER BY version"
```

## Database Connection

### Using the Pool
```typescript
import { query, transaction } from './db.js';

// Simple query
const result = await query('SELECT * FROM android_apps WHERE id = $1', [appId]);

// Transaction
await transaction(async (client) => {
  await client.query('INSERT INTO android_apps ...');
  await client.query('INSERT INTO api_keys ...');
});
```

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string (required)
- Default: `postgresql://localhost:5432/apkzio`

## Performance Considerations

### Indexes
All foreign keys and common query patterns have indexes:
- `idx_apps_owner`: Query apps by owner
- `idx_campaigns_app`, `idx_campaigns_status`: Campaign filtering
- `idx_analytics_app_time`: Time-series analytics queries
- `idx_devices_app`: Device lookup by app

### Query Optimization
- Use `analytics_hourly_rollups` for dashboards (pre-aggregated)
- Use `EXPLAIN ANALYZE` for slow queries
- Monitor slow query log (>1s queries are logged automatically)

### Connection Pooling
- Max 20 connections
- 30s idle timeout
- 2s connection timeout
- Automatic reconnection on errors

## Schema Evolution

### Adding New Migrations
1. Create new SQL file: `005_feature_name.sql`
2. Add to migrations array in `src/migrate.ts`
3. Run `npm run migrate`

### Rollback Strategy
Migrations are forward-only. For rollback:
1. Create a new migration that reverses changes
2. Or restore from database backup

## Testing

### Local Development
```bash
# Start local PostgreSQL
docker run -d \
  -p 5432:5432 \
  -e POSTGRES_DB=apkzio \
  -e POSTGRES_USER=apkzio \
  -e POSTGRES_PASSWORD=dev \
  postgres:16

# Run migrations
export DATABASE_URL="postgresql://apkzio:dev@localhost:5432/apkzio"
npm run migrate
```

### CI/CD
```bash
# In CI pipeline
export DATABASE_URL="$TEST_DATABASE_URL"
npm run migrate
npm test
```

## Production Deployment

### Pre-deployment Checklist
- [ ] Backup current database
- [ ] Test migrations on staging
- [ ] Review migration SQL for data safety
- [ ] Plan rollback strategy
- [ ] Schedule maintenance window if needed

### Zero-Downtime Migrations
For large tables:
1. Add new columns with defaults (fast)
2. Backfill data in batches
3. Deploy code that uses new schema
4. Drop old columns in next migration

## Troubleshooting

### Migration Failed
```bash
# Check which migrations ran
psql $DATABASE_URL -c "SELECT * FROM schema_migrations"

# Manually fix issue, then mark migration as complete
psql $DATABASE_URL -c "INSERT INTO schema_migrations (version) VALUES (2)"
```

### Connection Issues
- Verify DATABASE_URL format
- Check network connectivity
- Verify user permissions
- Check connection pool exhaustion

### Slow Queries
- Check `EXPLAIN ANALYZE` output
- Add missing indexes
- Consider partitioning large tables
- Use rollup tables for analytics
