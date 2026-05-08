# ApkZio Load Testing Guide

## Prerequisites

### k6 Installation

k6 cannot be installed via npm. Install it separately:

**macOS (Homebrew)**:
```bash
brew install k6
```

**Linux (Debian/Ubuntu)**:
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

**Windows (Chocolatey)**:
```bash
choco install k6
```

**Or download from**: https://k6.io/docs/get-started/installation/

### Autocannon (already installed via npm)

Autocannon is automatically installed as a dev dependency.

## Running Load Tests

### 1. k6 Load Tests (Recommended)

**API Stress Test** (10 → 50 → 100 concurrent users):
```bash
npm run load-test

# With custom API URL and key
k6 run --env API_URL=https://api.apkzio.com \
       --env API_KEY=your-api-key \
       load-tests/api-stress-test.js
```

**Campaign Stress Test**:
```bash
npm run load-test:campaign

# With custom configuration
k6 run --env API_URL=https://api.apkzio.com \
       --env API_KEY=your-api-key \
       load-tests/campaign-stress.js
```

**Expected Output**:
```
✓ apps list status 200
✓ apps list has data
✓ analytics status 200
✓ analytics has metrics
✓ event ingestion status 200
✓ events accepted

checks.........................: 98.50% ✓ 5910    ✗ 90
data_received..................: 15 MB  37 kB/s
data_sent......................: 3.2 MB 8.0 kB/s
http_req_duration..............: avg=245ms  p(95)=485ms
http_reqs......................: 6000   15/s
errors.........................: 0.5%
```

### 2. Autocannon Tests (Alternative)

Simple HTTP load testing:
```bash
tsx load-tests/autocannon-test.ts
```

### 3. Performance Benchmarks

Run comprehensive benchmarks on query performance:
```bash
npm run benchmark
```

This will:
- Test database query performance
- Measure cache hit rates
- Benchmark API endpoints
- Generate `benchmark-results.json`

**Example Output**:
```
📊 List Apps (Simple SELECT):
   Min:    8.45ms
   Avg:    12.34ms
   P95:    18.92ms
   ✅ SLA: P95 < 50ms

📊 Dashboard Metrics (Warm Cache):
   Min:    0.89ms
   Avg:    1.23ms
   P95:    2.34ms
   ✅ SLA: P95 < 10ms
```

### 4. Database Performance Analysis

Analyze slow queries and missing indexes:
```bash
npm run analyze-queries
```

This will show:
- Slow queries (>100ms average)
- Tables with high sequential scan rates
- Missing indexes
- Table bloat
- Unused indexes

## Performance Targets

### Response Time SLAs
- **API Endpoints (P95)**: < 500ms
- **Event Ingestion (P95)**: < 100ms
- **Dashboard Load**: < 2s
- **Database Queries (P95)**: < 50ms

### System Metrics
- **Cache Hit Rate**: > 80%
- **Error Rate**: < 1%
- **Database Connections**: < 18 (max 20)
- **Memory Usage**: < 2GB per instance

## Monitoring During Tests

### 1. Watch Metrics in Real-Time

```bash
# Prometheus metrics
curl http://localhost:3001/metrics

# Detailed health
curl http://localhost:3001/health/detailed | jq
```

### 2. Monitor Database

```bash
# Active connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'apkzio';"

# Slow queries
psql $DATABASE_URL -c "SELECT pid, usename, EXTRACT(EPOCH FROM (now() - query_start)) AS duration, query FROM pg_stat_activity WHERE state != 'idle' ORDER BY duration DESC LIMIT 10;"
```

### 3. Monitor Redis

```bash
# Redis info
redis-cli info stats

# Monitor commands
redis-cli monitor
```

## Interpreting Results

### Good Results ✅
- P95 latency < target SLA
- Error rate < 1%
- No database connection exhaustion
- Cache hit rate > 80%

### Warning Signs ⚠️
- P95 latency approaching SLA limit
- Error rate > 1%
- Database connections > 15
- Cache hit rate < 70%

### Critical Issues ❌
- P95 latency exceeds SLA
- Error rate > 5%
- Database connection pool exhausted
- Memory usage > 90%

## Optimization Workflow

1. **Baseline**: Run benchmarks and record results
2. **Load Test**: Identify bottlenecks under load
3. **Analyze**: Check slow queries and database stats
4. **Optimize**: Apply caching, indexing, or query improvements
5. **Verify**: Re-run benchmarks to confirm improvements
6. **Document**: Update performance metrics

## Troubleshooting

### High Response Times
1. Check cache hit rate: `curl http://localhost:3001/health/detailed`
2. Analyze slow queries: `npm run analyze-queries`
3. Check database connections
4. Review query execution plans

### High Error Rates
1. Check API logs for error patterns
2. Verify database health
3. Check rate limiting configuration
4. Review recent code changes

### Memory Issues
1. Check cache size
2. Review connection pool size
3. Look for memory leaks with `clinic doctor`
4. Analyze heap snapshots

## Continuous Performance Testing

### CI/CD Integration

Add to `.gitlab-ci.yml`:
```yaml
performance-test:
  stage: test
  script:
    - npm run benchmark
    - npm run load-test
  artifacts:
    reports:
      junit: benchmark-results.json
```

### Scheduled Tests

Run nightly performance tests and compare to baseline:
```bash
npm run benchmark > results-$(date +%Y%m%d).json
```

## Resources

- [k6 Documentation](https://k6.io/docs/)
- [Autocannon](https://github.com/mcollina/autocannon)
- [Postgres Performance](https://www.postgresql.org/docs/current/performance-tips.html)
- [Redis Performance](https://redis.io/docs/manual/optimization/)
- [Performance Monitoring Docs](./PERFORMANCE.md)
