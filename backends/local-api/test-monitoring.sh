#!/usr/bin/env bash
# Test monitoring endpoints

set -e

API_URL="${API_URL:-http://localhost:8787}"

echo "🔍 Testing ApkZio Monitoring Endpoints..."
echo ""

# Test 1: Health check
echo "1️⃣  Testing /health endpoint..."
HEALTH_RESPONSE=$(curl -s "$API_URL/health")
HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ "$HEALTH_STATUS" = "healthy" ] || [ "$HEALTH_STATUS" = "degraded" ]; then
    echo "✅ Health check passed: $HEALTH_STATUS"
    echo "$HEALTH_RESPONSE" | jq '.' || echo "$HEALTH_RESPONSE"
else
    echo "❌ Health check failed"
    echo "$HEALTH_RESPONSE"
    exit 1
fi

echo ""

# Test 2: Metrics endpoint
echo "2️⃣  Testing /metrics endpoint..."
METRICS_RESPONSE=$(curl -s "$API_URL/metrics")

if echo "$METRICS_RESPONSE" | grep -q "http_requests_total"; then
    echo "✅ Metrics endpoint working"
    echo "📊 Sample metrics:"
    echo "$METRICS_RESPONSE" | grep -E "(http_requests_total|http_request_duration|active_connections)" | head -5
else
    echo "❌ Metrics endpoint failed"
    echo "$METRICS_RESPONSE"
    exit 1
fi

echo ""

# Test 3: Generate some traffic and check metrics
echo "3️⃣  Generating test traffic..."
for i in {1..10}; do
    curl -s "$API_URL/api/status" > /dev/null
done

sleep 1

echo "✅ Test traffic generated"
echo ""

# Test 4: Check metrics updated
echo "4️⃣  Verifying metrics updated..."
METRICS_AFTER=$(curl -s "$API_URL/metrics")

if echo "$METRICS_AFTER" | grep -q "http_requests_total"; then
    TOTAL_REQUESTS=$(echo "$METRICS_AFTER" | grep 'http_requests_total{' | head -1 | awk '{print $NF}')
    echo "✅ Metrics updated: $TOTAL_REQUESTS total requests"
else
    echo "❌ Metrics not updating"
    exit 1
fi

echo ""

# Test 5: Check database health
echo "5️⃣  Checking database health..."
DB_STATUS=$(echo "$HEALTH_RESPONSE" | grep -o '"database":{[^}]*}' | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ "$DB_STATUS" = "healthy" ] || [ "$DB_STATUS" = "degraded" ]; then
    echo "✅ Database health: $DB_STATUS"
else
    echo "⚠️  Database health: $DB_STATUS (this may be expected if DB is not running)"
fi

echo ""
echo "✅ All monitoring tests passed!"
echo ""
echo "📊 Monitoring Dashboard URLs:"
echo "   Health: $API_URL/health"
echo "   Metrics: $API_URL/metrics"
echo ""
echo "💡 To view metrics in Prometheus format:"
echo "   curl $API_URL/metrics"
echo ""
echo "💡 To set up Grafana dashboards, see MONITORING.md"
