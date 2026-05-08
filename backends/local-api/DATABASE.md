# Database Persistence for ApkZio

This guide explains how to use PostgreSQL database persistence instead of the default in-memory store.

## Prerequisites

- PostgreSQL 13+ installed and running
- Node.js 20.10.0+

## Setup

### 1. Create Database

```bash
createdb apkzio
```

### 2. Configure Environment Variables

Create a `.env` file in `backends/local-api/`:

```env
# Database connection
DATABASE_URL=postgresql://localhost:5432/apkzio

# Enable database persistence (default: false)
USE_DATABASE=true

# Other existing config...
APKZIO_SERVICE_KEY=sk_live_demo_apkzio_local
PORT=8787
```

### 3. Run Migrations

```bash
cd backends/local-api
npm run migrate
```

This will create all required tables:
- `android_apps` - App configurations
- `push_campaigns` - Push notification campaigns
- `devices` - Device registrations
- `push_subscribers` - FCM token subscriptions
- `api_keys` - API authentication keys
- `apk_builds` - Build history

### 4. Seed Data (Optional)

Populate the database with demo data:

```bash
npm run seed
```

This creates:
- 1 demo app
- 1 draft campaign
- 10 demo devices
- 10 demo subscribers

### 5. Start the Server

```bash
npm run dev
```

The server will:
1. Connect to PostgreSQL
2. Run pending migrations automatically
3. Start with database persistence enabled

## Database Schema

### Apps Table

```sql
CREATE TABLE android_apps (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  package_name TEXT UNIQUE NOT NULL,
  app_key TEXT UNIQUE NOT NULL,
  icon_glyph TEXT,
  icon_color TEXT,
  status TEXT DEFAULT 'active',
  fcm_project_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Campaigns Table

```sql
CREATE TABLE push_campaigns (
  id UUID PRIMARY KEY,
  app_id UUID REFERENCES android_apps(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  target_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);
```

See `backends/local-api/src/migrations/` for complete schema.

## Usage

### In-Memory Mode (Default)

```env
USE_DATABASE=false
# or just omit USE_DATABASE
```

The store uses in-memory Maps and Arrays. Data is lost on restart.

### Database Mode

```env
USE_DATABASE=true
DATABASE_URL=postgresql://localhost:5432/apkzio
```

The store uses PostgreSQL for persistence. Data survives restarts.

## API Changes

All store methods now return Promises when `USE_DATABASE=true`:

### Before (In-Memory)
```typescript
const apps = store.listApps();
```

### After (Database)
```typescript
const apps = await store.listApps();
```

## Testing

Run tests with database:

```bash
export DATABASE_URL=postgresql://localhost:5432/apkzio_test
npm test
```

## Connection Pooling

The database connection pool is configured in `src/db.ts`:

```typescript
export const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  max: 20,                    // Max connections
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Fail fast on connection issues
});
```

## Performance Considerations

### Indexes

Key indexes are created automatically:
- `idx_apps_owner` - Owner lookup
- `idx_campaigns_app` - Campaign filtering by app
- `idx_devices_app` - Device filtering by app
- `idx_subscribers_app` - Subscriber filtering by app

### Query Optimization

Slow queries (>1s) are automatically logged:

```
Slow query (1234ms): SELECT * FROM android_apps...
```

### Caching Strategy

Consider adding Redis for:
- Active device counts
- Campaign recipient lists
- Frequently accessed app data

## Troubleshooting

### Connection Refused

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution**: Ensure PostgreSQL is running:
```bash
sudo systemctl start postgresql
# or on macOS:
brew services start postgresql
```

### Migration Failed

```
Error applying 001_initial_schema: relation "android_apps" already exists
```

**Solution**: Check applied migrations:
```sql
SELECT * FROM schema_migrations;
```

Drop and recreate if needed:
```bash
dropdb apkzio
createdb apkzio
npm run migrate
```

### Slow Queries

Monitor with:
```bash
npm run analyze-queries
```

## Migration Guide

### From In-Memory to Database

1. **Export existing data** (if needed):
   ```typescript
   const apps = store.listApps();
   fs.writeFileSync('apps.json', JSON.stringify(apps));
   ```

2. **Enable database mode**:
   ```env
   USE_DATABASE=true
   ```

3. **Import data** (if needed):
   ```typescript
   const apps = JSON.parse(fs.readFileSync('apps.json'));
   for (const app of apps) {
     await store.createApp(app);
   }
   ```

## Production Deployment

### Environment Variables

```env
DATABASE_URL=postgresql://user:pass@host:5432/apkzio
USE_DATABASE=true
NODE_ENV=production
```

### Connection Security

Use SSL for production:

```typescript
const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});
```

### Backup Strategy

Set up automated backups:

```bash
# Daily backup
pg_dump apkzio > backup_$(date +%Y%m%d).sql

# Restore from backup
psql apkzio < backup_20260508.sql
```

## FAQ

### Q: Can I switch between modes?

**A**: Yes, but data won't be shared. In-memory data is lost on restart.

### Q: What's the performance impact?

**A**: Database adds ~5-20ms latency per query but enables horizontal scaling.

### Q: Do I need to update my code?

**A**: Only add `await` to store method calls when `USE_DATABASE=true`.

### Q: Can I use a different database?

**A**: The code uses PostgreSQL-specific features (JSONB, UUID). MySQL/SQLite would require schema changes.

## Next Steps

- [ ] Set up connection pooling with pgBouncer
- [ ] Add Redis caching layer
- [ ] Implement read replicas for analytics queries
- [ ] Add database monitoring (pg_stat_statements)
- [ ] Set up automated backups

## Support

For issues, see:
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [node-postgres Guide](https://node-postgres.com/)
- Project issues: [GitHub Issues](https://github.com/apkzio/apkzio/issues)
