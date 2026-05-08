#!/usr/bin/env bash
# Final verification of monitoring implementation

set -e

echo "═══════════════════════════════════════════════════════════════"
echo "  Production Monitoring - Final Verification"
echo "═══════════════════════════════════════════════════════════════"
echo ""

ERRORS=0

# Check monitoring source files
echo "✓ Checking monitoring source files..."
for file in src/monitoring/{sentry,metrics,logger,health,middleware}.ts; do
  if [ -f "$file" ]; then
    echo "  ✓ $file exists"
  else
    echo "  ✗ $file missing"
    ERRORS=$((ERRORS + 1))
  fi
done
echo ""

# Check configuration files
echo "✓ Checking configuration files..."
for file in prometheus.yml alertmanager.yml docker-compose.monitoring.yml .env.monitoring.example; do
  if [ -f "$file" ]; then
    echo "  ✓ $file exists"
  else
    echo "  ✗ $file missing"
    ERRORS=$((ERRORS + 1))
  fi
done

# Check alerting rules in project root
if [ -f "../../.alerting-rules.yml" ]; then
  echo "  ✓ ../../.alerting-rules.yml exists"
else
  echo "  ✗ ../../.alerting-rules.yml missing"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# Check documentation
echo "✓ Checking documentation..."
for file in MONITORING.md MONITORING_QUICKSTART.md MONITORING_IMPLEMENTATION.md; do
  if [ -f "$file" ]; then
    echo "  ✓ $file exists"
  else
    echo "  ✗ $file missing"
    ERRORS=$((ERRORS + 1))
  fi
done
echo ""

# Check test script
echo "✓ Checking test script..."
if [ -f "test-monitoring.sh" ] && [ -x "test-monitoring.sh" ]; then
  echo "  ✓ test-monitoring.sh exists and is executable"
else
  echo "  ✗ test-monitoring.sh missing or not executable"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# Check dependencies
echo "✓ Checking dependencies in package.json..."
if grep -q '"@sentry/node"' package.json && \
   grep -q '"prom-client"' package.json && \
   grep -q '"winston"' package.json; then
  echo "  ✓ All monitoring dependencies present"
else
  echo "  ✗ Some dependencies missing"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# Check server.ts integration
echo "✓ Checking server.ts integration..."
if grep -q "initSentry" src/server.ts && \
   grep -q "metricsMiddleware" src/server.ts && \
   grep -q "checkHealth" src/server.ts && \
   grep -q "sentryErrorHandler" src/server.ts; then
  echo "  ✓ All monitoring imports present in server.ts"
else
  echo "  ✗ Some monitoring imports missing from server.ts"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# Check GitLab CI
echo "✓ Checking GitLab CI configuration..."
if grep -q "monitoring-test" ../../.gitlab-ci.yml; then
  echo "  ✓ Monitoring test stage added to CI pipeline"
else
  echo "  ✗ Monitoring test stage missing from CI"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# Summary
echo "═══════════════════════════════════════════════════════════════"
if [ $ERRORS -eq 0 ]; then
  echo "  ✅ All verification checks passed!"
  echo "═══════════════════════════════════════════════════════════════"
  echo ""
  echo "Next steps:"
  echo "  1. Start server: npm run dev"
  echo "  2. Test monitoring: ./test-monitoring.sh"
  echo "  3. View health: curl http://localhost:8787/health"
  echo "  4. View metrics: curl http://localhost:8787/metrics"
  echo "  5. Deploy stack: docker-compose -f docker-compose.monitoring.yml up -d"
  echo ""
  echo "Documentation:"
  echo "  • Quick start: MONITORING_QUICKSTART.md"
  echo "  • Full guide: MONITORING.md"
  echo "  • Implementation: MONITORING_IMPLEMENTATION.md"
  exit 0
else
  echo "  ❌ Verification failed with $ERRORS error(s)"
  echo "═══════════════════════════════════════════════════════════════"
  exit 1
fi
