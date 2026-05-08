# Database Setup Guide

## Quick Start

The backend supports two modes:

1. **In-Memory Mode** (default, no setup required)
2. **Database Mode** (PostgreSQL required)

## Option 1: In-Memory Mode (Recommended for Development)

No database setup needed! The backend will use mock data stored in memory.

```bash
# Create .env file
echo "USE_DATABASE=false" > .env
echo "PORT=3001" >> .env

# Start server
npm run dev
```

**Pros**:
- No database setup required
- Fast startup
- No data persistence (fresh start every time)
- Perfect for frontend development

**Cons**:
- Data is lost on restart
- Mock analytics data only

## Option 2: Database Mode (For Real Analytics)

### Prerequisites

- PostgreSQL 14+ installed
- Database created

### Step 1: Create Database

```bash
# Using psql
createdb apkzio_local

# Or using Docker
docker run --name apkzio-postgres \
  -e POSTGRES_DB=apkzio_local \
  -e POSTGRES_USER=apkzio \
  -e POSTGRES_PASSWORD=localdev \
  -p 5432:5432 \
  -d postgres:16-alpine
```

### Step 2: Configure Environment

```bash
# Create .env file
cat > .env <<EOF
# Database
DATABASE_URL=postgresql://apkzio:localdev@localhost:5432/apkzio_local
USE_DATABASE=true

# Server
PORT=3001

# Service Keys
APKZIO_SERVICE_KEY=sk_live_demo_apkzio_local
APKZIO_ADMIN_API_KEY=admin_demo_key

# Optional: Disable admin auth for local development
ENFORCE_ADMIN_AUTH=0
EOF
```

### Step 3: Run Migrations

```bash
npm run migrate
```

This will create all required tables:
- `apps`, `users`, `api_keys`, `campaigns`, etc.
- `analytics_events`, `analytics_hourly_rollups`, `analytics_daily_rollups`
- `campaign_notifications`
- Indexes and constraints

### Step 4: Start Server

```bash
npm run dev
```

Visit http://localhost:3001/api/status to verify:
- ✅ Database connected
- ✅ Tables exist
- ✅ Migrations up to date

### Step 5: (Optional) Generate Test Data

```bash
# Run aggregation test to populate analytics tables
npm run test-aggregation
```

This will:
- Create sample events
- Run hourly aggregation
- Generate analytics rollups
- Populate all analytics tables

## Testing Analytics Endpoints

Once the database is set up:

```bash
# Test analytics overview
curl http://localhost:3001/api/analytics/overview?seed=ana-all-30d

# Check for real data (should see non-zero values)
curl http://localhost:3001/api/analytics/overview | jq '.recentEvents | length'
```

## Troubleshooting

### Error: "SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string"

**Cause**: Database password is not set or is incorrectly formatted.

**Fix**:
```bash
# Ensure DATABASE_URL has proper format
DATABASE_URL=postgresql://username:password@host:port/database

# Example:
DATABASE_URL=postgresql://apkzio:mypassword@localhost:5432/apkzio_local
```

### Error: "connection refused"

**Cause**: PostgreSQL is not running.

**Fix**:
```bash
# Start PostgreSQL
# On macOS with Homebrew:
brew services start postgresql@16

# On Ubuntu:
sudo systemctl start postgresql

# Or start Docker container if using Docker
docker start apkzio-postgres
```

### Error: "database does not exist"

**Cause**: Database hasn't been created yet.

**Fix**:
```bash
createdb apkzio_local
```

### Error: "relation does not exist"

**Cause**: Migrations haven't been run.

**Fix**:
```bash
npm run migrate
```

### No analytics data showing

**Cause**: Tables are empty (no events ingested yet).

**Fix**:
```bash
# Generate test data
npm run test-aggregation

# Or send real events from your app/SDK
```

## Switching Between Modes

You can switch between in-memory and database mode by changing `.env`:

```bash
# Switch to in-memory mode
echo "USE_DATABASE=false" > .env

# Switch to database mode
echo "USE_DATABASE=true" > .env
echo "DATABASE_URL=postgresql://user:pass@localhost:5432/apkzio_local" >> .env
```

Restart the server after changing modes.

## Production Deployment

For production:

1. Use a managed PostgreSQL service (AWS RDS, Google Cloud SQL, etc.)
2. Enable SSL/TLS for database connections
3. Use connection pooling (already configured in code)
4. Set up regular backups
5. Monitor slow queries
6. Configure Redis for distributed caching (optional but recommended)

```bash
# Production .env example
DATABASE_URL=postgresql://user:pass@prod-db.example.com:5432/apkzio?sslmode=require
USE_DATABASE=true
PORT=3001
APKZIO_TRUST_PROXY=1
```

## Current Status

**As of Phase 4 Integration**:

- ✅ Analytics query functions implemented
- ✅ Server endpoints updated
- ✅ Error handling in place
- ✅ Caching implemented
- ⚠️  Database connection needs configuration
- ⚠️  Migrations need to be run
- ⚠️  Test data needs to be generated

**Estimated setup time**: 15-30 minutes
