# Analytics Aggregation System

## Overview

The analytics aggregation system provides high-performance analytics queries by pre-computing hourly and daily rollups from raw event data.

## Architecture

```
Raw Events (analytics_events)
      ↓
Hourly Rollups (every hour)
      ↓
Daily Rollups (midnight)
      ↓
Cached Queries (1-5 min TTL)
      ↓
API Endpoints
```

## Components

### 1. Database Schema (`005_aggregation_tables.sql`)

- **analytics_hourly_rollups**: Hourly aggregations by app, event type
  - event_count: Total events in the hour
  - unique_devices: Distinct devices
  - country_breakdown: JSON object with country counts

- **analytics_daily_rollups**: Daily aggregations rolled up from hourly data
  - installs, active_devices, heartbeats
  - push_sent, push_opened, crashes
  - country_breakdown: JSON with all event types

### 2. Aggregator Worker (`aggregator.ts`)

Background worker that runs:
- **Hourly**: Every hour for the last completed hour
- **Daily**: At midnight for yesterday

Features:
- Automatic scheduling
- Graceful start/stop
- Backfill support for historical data

### 3. Geo Aggregator (`geo-aggregator.ts`)

Provides country-level breakdowns:
- `getGeoBreakdown()`: Top 20 countries by activity
- `getGeoBreakdownByEvent()`: Country breakdown per event type

### 4. Cache Layer (`analytics-cache.ts`)

In-memory cache with TTL:
- Reduces database load
- Configurable TTL per query type
- Automatic cleanup
- Pattern-based invalidation

### 5. Optimized Queries (`analytics-queries.ts`)

High-performance query functions:
- `getDailyInstalls()`: Install trends (5 min cache)
- `getHourlyHeartbeats()`: Active device trends (1 min cache)
- `getAppSummary()`: Summary statistics (5 min cache)
- `getPushStats()`: Push notification metrics (5 min cache)
- `getRecentEvents()`: Real-time events (10 sec cache)

## API Endpoints

### Get Comprehensive Overview
```bash
GET /api/apps/:appId/analytics/overview?range=30d
```

Returns:
- Daily install trends (30 days)
- Hourly heartbeat trends (48 hours)
- Geographic breakdown
- Summary statistics
- Push notification stats
- Recent events (20 latest)

### Get Geographic Breakdown
```bash
GET /api/apps/:appId/analytics/geo?range=7d
```

### Get Summary Statistics
```bash
GET /api/apps/:appId/analytics/summary?days=30
```

### Get Push Stats
```bash
GET /api/apps/:appId/analytics/push?days=30
```

## Performance

**Before aggregation:**
- Query 1M events: ~5-10 seconds
- No caching
- Heavy database load

**After aggregation:**
- Query from rollups: ~50-200ms
- With cache: ~1-5ms
- 95%+ reduction in database load

## Running Aggregations

### Automatic (Production)
The aggregator starts automatically with the server and runs:
- Hourly at :00 minutes past the hour
- Daily at 00:05 (midnight + 5 minutes)

### Manual (Development/Backfill)
```typescript
import { aggregator } from './aggregator.js';

// Run for last hour
await aggregator.runHourlyAggregation();

// Run for yesterday
await aggregator.runDailyAggregation();

// Backfill historical data
const startDate = new Date('2024-01-01');
const endDate = new Date('2024-12-31');
await aggregator.backfillHourlyAggregations(startDate, endDate);
await aggregator.backfillDailyAggregations(startDate, endDate);
```

## Testing

Run the test script:
```bash
npm run test:aggregation
```

This verifies:
- Migrations applied
- Tables created
- Aggregator working
- Queries functioning
- Cache operational

## Cache Statistics

Get cache performance metrics:
```typescript
import { analyticsCache } from './analytics-cache.js';

const stats = analyticsCache.getStats();
console.log(stats);
// {
//   size: 42,
//   hits: 1234,
//   misses: 56,
//   hitRate: "95.67%"
// }
```

## Monitoring

Watch aggregation logs:
```bash
# Server logs show aggregation runs
📊 Analytics Aggregator starting...
⏰ Starting hourly aggregation...
  📍 Aggregating from 2024-01-15T14:00:00Z to 2024-01-15T15:00:00Z
✅ Hourly aggregation complete: 23 rollups created/updated (127ms)
```

## Troubleshooting

### Aggregation not running
1. Check server logs for errors
2. Verify migrations applied: `SELECT * FROM schema_migrations`
3. Run manual aggregation to test

### Slow queries
1. Check cache hit rate: `analyticsCache.getStats()`
2. Verify indexes exist on rollup tables
3. Check if aggregations are running

### Missing data
1. Verify raw events are being inserted
2. Run backfill for historical data
3. Check for gaps in hourly rollups

## Future Enhancements

- [ ] Real-time aggregation using triggers
- [ ] Materialized views for complex queries
- [ ] Redis cache for distributed systems
- [ ] Partitioning for rollup tables
- [ ] Compression for old aggregations
- [ ] Automated cleanup of old rollups
