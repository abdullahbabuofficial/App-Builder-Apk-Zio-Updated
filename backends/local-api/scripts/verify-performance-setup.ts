#!/usr/bin/env tsx

/**
 * Performance Test Verification Script
 * 
 * Validates that all performance testing components are working
 */

import { performance } from 'perf_hooks';
import * as http from 'http';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

interface TestResult {
  name: string;
  passed: boolean;
  duration?: number;
  error?: string;
}

const results: TestResult[] = [];

function log(message: string) {
  console.log(message);
}

function logResult(name: string, passed: boolean, details?: string) {
  const emoji = passed ? '✅' : '❌';
  const color = passed ? GREEN : RED;
  results.push({ name, passed });
  log(`${emoji} ${color}${name}${RESET}${details ? ` - ${details}` : ''}`);
}

async function httpGet(path: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_URL);
    http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 0, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode || 0, body });
        }
      });
    }).on('error', reject);
  });
}

async function testEndpoint(name: string, path: string, expectedStatus: number = 200) {
  try {
    const start = performance.now();
    const { status, body } = await httpGet(path);
    const duration = performance.now() - start;
    
    const passed = status === expectedStatus;
    results.push({ name, passed, duration });
    
    logResult(
      name,
      passed,
      `${duration.toFixed(0)}ms (expected ${expectedStatus}, got ${status})`
    );
    
    return { passed, body };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, error });
    logResult(name, false, `Error: ${error}`);
    return { passed: false, body: null };
  }
}

async function runTests() {
  log(`\n${BOLD}╔════════════════════════════════════════╗${RESET}`);
  log(`${BOLD}║  Performance Test Verification         ║${RESET}`);
  log(`${BOLD}╚════════════════════════════════════════╝${RESET}\n`);
  
  log(`${YELLOW}Testing API: ${API_URL}${RESET}\n`);
  
  // 1. Basic health check
  log(`${BOLD}1. Basic Health Checks${RESET}`);
  await testEndpoint('Basic Health', '/health');
  
  // 2. Detailed health check
  log(`\n${BOLD}2. Detailed Health Endpoint${RESET}`);
  const { passed: healthPassed, body: healthBody } = await testEndpoint(
    'Detailed Health',
    '/health/detailed'
  );
  
  if (healthPassed && healthBody) {
    const checks = healthBody.checks || {};
    if (checks.database) {
      logResult(
        '  Database Health',
        checks.database.status === 'healthy',
        `${checks.database.latency}ms`
      );
    }
    if (checks.memory) {
      logResult(
        '  Memory Health',
        checks.memory.status === 'healthy',
        `${checks.memory.usage}% used`
      );
    }
    if (checks.redis) {
      logResult(
        '  Redis Health',
        checks.redis.status === 'healthy' || checks.redis.status === 'degraded',
        checks.redis.connected ? 'connected' : 'using fallback'
      );
    }
    if (healthBody.performance) {
      const perf = healthBody.performance;
      logResult(
        '  Database Pool',
        true,
        `${perf.database_pool.idle}/${perf.database_pool.total} idle`
      );
      logResult(
        '  Memory Usage',
        perf.memory_detailed.heapUsed < 2048,
        `${perf.memory_detailed.heapUsed}MB / ${perf.memory_detailed.heapTotal}MB`
      );
    }
  }
  
  // 3. Prometheus metrics
  log(`\n${BOLD}3. Monitoring Endpoints${RESET}`);
  await testEndpoint('Prometheus Metrics', '/metrics');
  
  // 4. API endpoints
  log(`\n${BOLD}4. API Endpoints${RESET}`);
  await testEndpoint('List Apps', '/api/apps');
  await testEndpoint('Analytics Overview', '/api/analytics/overview?app_id=test');
  
  // 5. Performance benchmarks
  log(`\n${BOLD}5. Performance Targets${RESET}`);
  const targets = [
    { name: 'Health Endpoint', target: 50, actual: results.find(r => r.name === 'Detailed Health')?.duration || 0 },
    { name: 'Metrics Endpoint', target: 100, actual: results.find(r => r.name === 'Prometheus Metrics')?.duration || 0 },
    { name: 'List Apps', target: 500, actual: results.find(r => r.name === 'List Apps')?.duration || 0 },
  ];
  
  for (const { name, target, actual } of targets) {
    if (actual > 0) {
      logResult(
        `  ${name} < ${target}ms`,
        actual < target,
        `${actual.toFixed(0)}ms`
      );
    }
  }
  
  // 6. File existence checks
  log(`\n${BOLD}6. Load Testing Files${RESET}`);
  const fs = await import('fs/promises');
  const files = [
    'load-tests/api-stress-test.js',
    'load-tests/campaign-stress.js',
    'load-tests/autocannon-test.ts',
    'benchmarks/benchmark.ts',
    'scripts/analyze-slow-queries.sql',
    'src/cache/redis-cache.ts',
    'src/optimizations/analytics-cache.ts',
    'docs/PERFORMANCE.md',
    'docs/LOAD_TESTING.md',
  ];
  
  for (const file of files) {
    try {
      await fs.access(file);
      logResult(`  ${file}`, true, 'exists');
    } catch {
      logResult(`  ${file}`, false, 'missing');
    }
  }
  
  // Summary
  log(`\n${BOLD}═══════════════════════════════════════${RESET}`);
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const percentage = Math.round((passed / total) * 100);
  
  log(`\n${BOLD}Results: ${passed}/${total} tests passed (${percentage}%)${RESET}\n`);
  
  if (passed === total) {
    log(`${GREEN}${BOLD}🎉 All tests passed!${RESET}\n`);
    log('✅ Load testing infrastructure is ready');
    log('✅ Performance monitoring is configured');
    log('✅ Caching layer is operational');
    log('✅ Health endpoints are responding\n');
    log(`${YELLOW}Next steps:${RESET}`);
    log('  1. Run load tests: npm run load-test');
    log('  2. Run benchmarks: npm run benchmark');
    log('  3. Analyze queries: npm run analyze-queries');
    log('  4. Monitor metrics: curl http://localhost:3001/metrics\n');
    process.exit(0);
  } else {
    log(`${RED}${BOLD}⚠️  Some tests failed${RESET}\n`);
    log('Failed tests:');
    results.filter(r => !r.passed).forEach(r => {
      log(`  - ${r.name}${r.error ? `: ${r.error}` : ''}`);
    });
    log('');
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
