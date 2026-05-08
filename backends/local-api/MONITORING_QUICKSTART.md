# Production Monitoring Quick Start

This guide will help you set up production monitoring in 5 minutes.

## Step 1: Set Environment Variables

Create or update your `.env` file:

```bash
cd backends/local-api
cp .env.monitoring.example .env.monitoring
# Edit .env.monitoring with your Sentry DSN
cat .env.monitoring >> .env
```

## Step 2: Get Sentry DSN (Optional but Recommended)

1. Sign up at https://sentry.io (free for small projects)
2. Create a new project (Node.js/Express)
3. Copy your DSN (looks like `https://xxx@xxx.ingest.sentry.io/xxx`)
4. Add to `.env`: `SENTRY_DSN=your-dsn-here`

## Step 3: Test Monitoring

Start the server:
```bash
npm run dev
```

Test endpoints:
```bash
./test-monitoring.sh
```

Expected output:
```
✅ Health check passed: healthy
✅ Metrics endpoint working
```

## Step 4: View Metrics

### Health Check
```bash
curl http://localhost:8787/health | jq
```

### Prometheus Metrics
```bash
curl http://localhost:8787/metrics
```

## Step 5: Set Up Grafana (Optional)

1. Install Prometheus and Grafana:
```bash
docker-compose -f docker-compose.monitoring.yml up -d
```

2. Access Grafana: http://localhost:3000 (admin/admin)

3. Add Prometheus data source:
   - URL: http://prometheus:9090
   - Save & Test

4. Import dashboard:
   - Click + → Import
   - Upload `grafana-dashboard.json`
   - Select Prometheus data source

## Monitoring Endpoints

| Endpoint | Purpose | Authentication |
|----------|---------|----------------|
| GET /health | Health status | Public |
| GET /metrics | Prometheus metrics | Public (restrict in production) |

## What's Being Monitored

✅ HTTP request duration and count  
✅ Active connections  
✅ Database query performance  
✅ Memory usage  
✅ Error rates and exceptions  
✅ Event ingestion rates  

## Production Checklist

- [ ] Set `SENTRY_DSN` environment variable
- [ ] Set `NODE_ENV=production`
- [ ] Configure log rotation for `logs/` directory
- [ ] Restrict access to `/metrics` endpoint (add authentication)
- [ ] Set up Prometheus to scrape `/metrics`
- [ ] Configure alerts in `.alerting-rules.yml`
- [ ] Set up Grafana dashboards
- [ ] Test health check integration with load balancer

## Troubleshooting

### Metrics not appearing?
- Check server started: `curl http://localhost:8787/health`
- Check metrics endpoint: `curl http://localhost:8787/metrics`

### Sentry not capturing errors?
- Verify DSN is set: `echo $SENTRY_DSN`
- Check console for "✅ Sentry initialized" message
- Test manually: trigger an error and check Sentry dashboard

### High memory usage?
- Check `/health` endpoint for memory percentage
- Review event buffer size in server logs
- Consider reducing `eventBuffer.maxSize` in server.ts

## Next Steps

- Read full documentation: `MONITORING.md`
- Customize alerts: `.alerting-rules.yml`
- Add custom metrics in `src/monitoring/metrics.ts`
- Create Grafana dashboards for your specific needs
