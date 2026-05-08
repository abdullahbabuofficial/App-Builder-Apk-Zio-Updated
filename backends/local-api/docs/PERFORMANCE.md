# ApkZio Performance Benchmarks & Optimization

## Target SLAs

### API Response Times
- **API Response Time (P95)**: < 500ms
- **Event Ingestion (P95)**: < 100ms
- **Dashboard Load**: < 2s
- **Campaign Send (per 1k recipients)**: < 5s
- **Database Query (P95)**: < 50ms

### System Metrics
- **Cache Hit Rate**: > 80%
- **Error Rate**: < 1%
- **Database Connection Pool**: 20 connections max
- **Memory Usage**: < 2GB per instance
- **CPU Usage**: < 70% average

## Performance Optimization Strategy

### 1. Caching Layer

#### Redis Cache
- **Implementation**: Distributed Redis cache with in-memory fallback
- **TTL Strategy**:
  - Dashboard metrics: 5 minutes
  - App lists: 2 minutes
  - Daily analytics: 10 minutes
  - Geographic data: 15 minutes
  - Campaign stats: 5 minutes
  - Subscriber counts: 1 minute

#### Cache Invalidation
- Automatic invalidation on data mutations
- Pattern-based invalidation for related data
- Manual flush via admin endpoint

### 2. Database Optimizations

#### Connection Pooling
```typescript
max: 20,              // Maximum connections
idleTimeoutMillis: 30000,
connectionTimeoutMillis: 2000
```

#### Query Optimizations
- Indexed columns for frequent WHERE clauses
- Materialized views for complex aggregations
- Query result caching
- Prepared statements for repeated queries

#### Recommended Indexes
```sql
-- Analytics events by app and timestamp
CREATE INDEX idx_analytics_app_timestamp 
ON analytics_events(app_id, timestamp DESC);

-- Device lookups
CREATE INDEX idx_analytics_device 
ON analytics_events(device_id, timestamp DESC);

-- Geographic queries
CREATE INDEX idx_analytics_country 
ON analytics_events(country_code, timestamp DESC);

-- Campaign notifications
CREATE INDEX idx_notifications_campaign 
ON push_notifications(campaign_id, status);
```

### 3. Load Testing

#### k6 Stress Test
```bash
# Run API stress test
npm run load-test

# Run with custom configuration
k6 run --env API_URL=https://api.apkzio.com \
       --env API_KEY=your-key \
       load-tests/api-stress-test.js

# Campaign stress test
npm run load-test:campaign
```

#### Expected Results
- **Concurrent Users**: 100
- **Duration**: 4.5 minutes
- **Request Rate**: 50-100 req/s
- **Success Rate**: > 99%

### 4. Performance Monitoring

#### Metrics Collected
- HTTP request duration (histogram)
- Request counts by endpoint
- Active connections
- Event ingestion rate
- Database query duration
- Cache hit/miss ratio

#### Prometheus Endpoints
```
GET /metrics          # Prometheus metrics
GET /health           # Health check
GET /health/detailed  # Detailed health info
```

#### Example Grafana Queries
```promql
# P95 Response Time
histogram_quantile(0.95, 
  rate(http_request_duration_seconds_bucket[5m])
)

# Error Rate
rate(http_requests_total{status_code=~"5.."}[5m])

# Cache Hit Rate
rate(cache_hits_total[5m]) / 
  rate(cache_requests_total[5m])
```

## Benchmark Results

### Running Benchmarks

```bash
# Run all benchmarks
npm run benchmark

# Results saved to benchmark-results.json
```

### Example Output

```
📊 List Apps (Simple SELECT):
   Min:    8.45ms
   Avg:    12.34ms
   Median: 11.23ms
   P95:    18.92ms
   Max:    45.67ms
   ✅ SLA: P95 < 50ms

📊 Dashboard Metrics (Warm Cache):
   Min:    0.89ms
   Avg:    1.23ms
   Median: 1.15ms
   P95:    2.34ms
   Max:    5.67ms
   ✅ SLA: P95 < 10ms
```

## Database Analysis

### Running Slow Query Analysis

```bash
# Analyze slow queries and missing indexes
npm run analyze-queries

# Or directly with psql
psql $DATABASE_URL -f scripts/analyze-slow-queries.sql
```

### Common Performance Issues

#### 1. Missing Indexes
**Symptom**: High sequential scan count
**Solution**: Add indexes on frequently queried columns

```sql
-- Find tables with high seq scans
SELECT tablename, seq_scan, seq_tup_read
FROM pg_stat_user_tables
WHERE seq_scan > 100
ORDER BY seq_tup_read DESC;
```

#### 2. Table Bloat
**Symptom**: Large table size with many dead rows
**Solution**: Run VACUUM ANALYZE

```sql
-- Check dead row percentage
SELECT tablename, n_dead_tup, n_live_tup,
  ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_pct
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000;

-- Fix bloat
VACUUM ANALYZE analytics_events;
```

#### 3. Long-Running Queries
**Symptom**: Queries taking > 5 seconds
**Solution**: Optimize query or add caching

```sql
-- Find long-running queries
SELECT pid, usename, 
  EXTRACT(EPOCH FROM (now() - query_start)) AS duration,
  query
FROM pg_stat_activity
WHERE state != 'idle'
  AND query_start < now() - interval '5 seconds'
ORDER BY duration DESC;
```

## Optimization Checklist

### Pre-Deployment
- [ ] Run benchmark suite
- [ ] All benchmarks pass SLA targets
- [ ] Load test with k6 passes
- [ ] Database indexes created
- [ ] Redis cache configured
- [ ] Monitoring dashboards configured

### Post-Deployment
- [ ] Monitor P95 response times
- [ ] Check cache hit rate (target > 80%)
- [ ] Review slow query logs
- [ ] Monitor error rates
- [ ] Check database connection pool usage
- [ ] Review memory and CPU metrics

## Troubleshooting

### High Response Times

1. **Check cache hit rate**
   ```bash
   curl http://localhost:3001/health/detailed
   ```

2. **Review slow queries**
   ```bash
   npm run analyze-queries
   ```

3. **Check database connections**
   ```sql
   SELECT count(*) FROM pg_stat_activity 
   WHERE datname = 'apkzio';
   ```

### High Memory Usage

1. **Check cache size**
   - In-memory cache should be limited
   - Use Redis for production

2. **Review connection pool**
   - Reduce max connections if needed
   - Check for connection leaks

3. **Monitor event buffer**
   - Flush events more frequently
   - Reduce batch size

### Low Cache Hit Rate

1. **Review TTL settings**
   - Increase TTL for stable data
   - Decrease for frequently changing data

2. **Check cache invalidation**
   - Ensure proper invalidation on updates
   - Avoid over-invalidation

3. **Monitor cache patterns**
   ```typescript
   const stats = cache.getStats();
   console.log(stats);
   ```

## Production Recommendations

### Infrastructure
- **API Instances**: 3+ for redundancy
- **Database**: Managed PostgreSQL with read replicas
- **Redis**: Managed Redis cluster or ElastiCache
- **Load Balancer**: nginx or cloud LB
- **CDN**: CloudFlare or AWS CloudFront

### Configuration
```env
# Production settings
NODE_ENV=production
DATABASE_URL=postgresql://prod-db:5432/apkzio
REDIS_URL=redis://prod-redis:6379
REDIS_ENABLED=true

# Connection pooling
DB_POOL_MAX=20
DB_POOL_IDLE_TIMEOUT=30000

# Cache TTLs (seconds)
CACHE_TTL_DASHBOARD=300
CACHE_TTL_ANALYTICS=600
CACHE_TTL_APPS=120
```

### Scaling Strategy
1. **Horizontal Scaling**: Add more API instances
2. **Database Read Replicas**: Route analytics queries to replicas
3. **Redis Cluster**: Distribute cache across nodes
4. **CDN**: Cache static assets and API responses

## Continuous Monitoring

### Alerts
- P95 response time > 500ms
- Error rate > 1%
- Database connections > 18
- Memory usage > 1.8GB
- Cache hit rate < 70%

### Weekly Reviews
- Review benchmark trends
- Analyze slow query logs
- Check for missing indexes
- Review database bloat
- Optimize hot queries

## Resources

- [k6 Documentation](https://k6.io/docs/)
- [PostgreSQL Performance](https://www.postgresql.org/docs/current/performance-tips.html)
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
- [Node.js Performance](https://nodejs.org/en/docs/guides/simple-profiling/)
