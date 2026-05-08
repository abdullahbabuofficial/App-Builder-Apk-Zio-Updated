# ApkZio Production Monitoring

## Overview

ApkZio includes comprehensive production monitoring with error tracking, metrics collection, health checks, and alerting.

## Components

### 1. Sentry Error Tracking

**Location**: `src/monitoring/sentry.ts`

Captures and tracks application errors in real-time.

**Configuration**:
```bash
# .env
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
NODE_ENV=production
```

**Features**:
- Automatic error capture
- Request tracing
- Performance monitoring
- Environment-specific sampling (10% in production, 100% in development)

### 2. Prometheus Metrics

**Location**: `src/monitoring/metrics.ts`

Exposes application metrics in Prometheus format.

**Endpoint**: `GET /metrics`

**Metrics Collected**:
- `http_request_duration_seconds` - Request latency histogram
- `http_requests_total` - Total HTTP requests counter
- `active_connections` - Current active connections gauge
- `event_ingestion_total` - Total events ingested counter
- `database_query_duration_seconds` - Database query latency histogram
- Default Node.js metrics (CPU, memory, event loop, GC)

**Example Prometheus scrape config**:
```yaml
scrape_configs:
  - job_name: 'apkzio-api'
    static_configs:
      - targets: ['localhost:8787']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

### 3. Health Checks

**Location**: `src/monitoring/health.ts`

**Endpoint**: `GET /health`

**Response Format**:
```json
{
  "status": "healthy",
  "checks": {
    "database": {
      "status": "healthy",
      "latency": 15
    },
    "memory": {
      "status": "healthy",
      "usage": 45
    },
    "uptime": {
      "status": "healthy",
      "seconds": 3600
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Status Codes**:
- `200` - Healthy or degraded
- `503` - Unhealthy

**Thresholds**:
- Database latency: < 100ms (healthy), < 200ms (degraded), >= 200ms (unhealthy)
- Memory usage: < 80% (healthy), < 95% (degraded), >= 95% (unhealthy)

### 4. Structured Logging

**Location**: `src/monitoring/logger.ts`

Uses Winston for structured JSON logging.

**Configuration**:
```bash
LOG_LEVEL=info  # debug, info, warn, error
```

**Production Mode**:
- Console output (JSON format)
- `logs/error.log` - Error logs only
- `logs/combined.log` - All logs

**Log Format**:
```json
{
  "level": "info",
  "message": "...",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "method": "GET",
  "path": "/api/apps",
  "status": 200,
  "duration": "0.025s",
  "ip": "192.168.1.1"
}
```

### 5. Request Metrics Middleware

**Location**: `src/monitoring/middleware.ts`

Automatically tracks:
- Request duration
- Request count by route and status
- Active connection count
- Request details in logs

## Alerting

**Configuration**: `.alerting-rules.yml`

### Configured Alerts

#### High Error Rate
- **Condition**: > 5% error rate over 5 minutes
- **Severity**: Critical
- **Action**: Page on-call engineer

#### Slow Response Time
- **Condition**: 95th percentile > 2 seconds over 5 minutes
- **Severity**: Warning
- **Action**: Notify team channel

#### Database Connection Failure
- **Condition**: Database unreachable for 1 minute
- **Severity**: Critical
- **Action**: Page on-call engineer immediately

## Deployment

### Docker Compose

```yaml
version: '3.8'
services:
  api:
    image: apkzio-api:latest
    environment:
      - SENTRY_DSN=${SENTRY_DSN}
      - NODE_ENV=production
      - LOG_LEVEL=info
    ports:
      - "8787:8787"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8787/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    ports:
      - "9090:9090"
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-data:/var/lib/grafana

volumes:
  prometheus-data:
  grafana-data:
```

### Kubernetes

```yaml
apiVersion: v1
kind: Service
metadata:
  name: apkzio-api
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/path: "/metrics"
    prometheus.io/port: "8787"
spec:
  ports:
  - port: 8787
    targetPort: 8787
  selector:
    app: apkzio-api
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: apkzio-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: apkzio-api
  template:
    metadata:
      labels:
        app: apkzio-api
    spec:
      containers:
      - name: api
        image: apkzio-api:latest
        ports:
        - containerPort: 8787
        env:
        - name: SENTRY_DSN
          valueFrom:
            secretKeyRef:
              name: apkzio-secrets
              key: sentry-dsn
        - name: NODE_ENV
          value: "production"
        livenessProbe:
          httpGet:
            path: /health
            port: 8787
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8787
          initialDelaySeconds: 5
          periodSeconds: 5
```

## Grafana Dashboards

### Recommended Panels

1. **Request Rate**
   - Query: `rate(http_requests_total[5m])`
   - Type: Graph

2. **Error Rate**
   - Query: `rate(http_requests_total{status_code=~"5.."}[5m])`
   - Type: Graph

3. **Response Time (p50, p95, p99)**
   - Query: `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))`
   - Type: Graph

4. **Active Connections**
   - Query: `active_connections`
   - Type: Gauge

5. **Database Query Latency**
   - Query: `histogram_quantile(0.95, rate(database_query_duration_seconds_bucket[5m]))`
   - Type: Graph

6. **Memory Usage**
   - Query: `process_resident_memory_bytes / 1024 / 1024`
   - Type: Graph

7. **Event Ingestion Rate**
   - Query: `rate(event_ingestion_total[5m])`
   - Type: Graph

## Testing

### Health Check
```bash
curl http://localhost:8787/health
```

### Metrics
```bash
curl http://localhost:8787/metrics
```

### Load Test with Metrics
```bash
# Install hey (HTTP load generator)
go install github.com/rakyll/hey@latest

# Run load test
hey -n 10000 -c 100 http://localhost:8787/api/status

# Check metrics
curl -s http://localhost:8787/metrics | grep http_requests_total
```

## Troubleshooting

### Sentry Not Capturing Errors

1. Check DSN is set: `echo $SENTRY_DSN`
2. Verify network connectivity to Sentry
3. Check logs for Sentry initialization message
4. Test with manual error:
   ```javascript
   const Sentry = require('@sentry/node');
   Sentry.captureMessage('Test message');
   ```

### Metrics Not Appearing in Prometheus

1. Verify `/metrics` endpoint is accessible
2. Check Prometheus scrape config
3. Verify Prometheus can reach the API
4. Check Prometheus targets: http://localhost:9090/targets

### High Memory Usage Alert

1. Check current memory: `GET /health`
2. Review Node.js heap size: `node --max-old-space-size=4096`
3. Investigate memory leaks with Chrome DevTools or `clinic.js`
4. Review event buffer size and flush interval

### Slow Database Queries

1. Check database metrics in `/metrics`
2. Review slow query logs in Winston output
3. Add database indexes if needed
4. Consider connection pooling tuning in `src/db.ts`

## Security Considerations

- `/metrics` endpoint exposes internal metrics - restrict access in production
- `/health` endpoint is public by design for load balancer health checks
- Sentry may capture sensitive data - configure PII scrubbing
- Winston logs may contain sensitive data - rotate and secure log files

## Performance Impact

- Sentry: < 5ms overhead per request (with 10% sampling in production)
- Prometheus metrics: < 1ms overhead per request
- Health checks: No impact on request path (separate endpoint)
- Logging: < 2ms overhead per request (async writes)

**Total monitoring overhead**: < 10ms per request in production
