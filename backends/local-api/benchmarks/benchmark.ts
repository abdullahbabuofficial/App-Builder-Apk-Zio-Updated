#!/usr/bin/env tsx

/**
 * Performance Benchmarking Tool for ApkZio
 * 
 * Measures query performance and reports statistics
 */

import { performance } from 'perf_hooks';
import { query } from '../db.js';
import { getDashboardMetrics, getCachedAppList } from '../optimizations/analytics-cache.js';
import { cache } from '../cache/redis-cache.js';

interface BenchmarkResult {
  name: string;
  iterations: number;
  times: number[];
  min: number;
  median: number;
  p95: number;
  p99: number;
  max: number;
  avg: number;
  total: number;
}

async function benchmark(
  name: string,
  fn: () => Promise<void>,
  iterations: number = 100
): Promise<BenchmarkResult> {
  const times: number[] = [];

  console.log(`\n🏃 Running ${name} (${iterations} iterations)...`);

  // Warmup
  await fn();

  // Actual benchmark
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);

    if ((i + 1) % 25 === 0) {
      process.stdout.write('.');
    }
  }

  console.log(' Done!');

  times.sort((a, b) => a - b);

  const result: BenchmarkResult = {
    name,
    iterations,
    times,
    min: times[0],
    median: times[Math.floor(iterations / 2)],
    p95: times[Math.floor(iterations * 0.95)],
    p99: times[Math.floor(iterations * 0.99)],
    max: times[iterations - 1],
    avg: times.reduce((a, b) => a + b, 0) / iterations,
    total: times.reduce((a, b) => a + b, 0),
  };

  return result;
}

function printResult(result: BenchmarkResult) {
  console.log(`\n📊 ${result.name}:`);
  console.log(`   Min:    ${result.min.toFixed(2)}ms`);
  console.log(`   Avg:    ${result.avg.toFixed(2)}ms`);
  console.log(`   Median: ${result.median.toFixed(2)}ms`);
  console.log(`   P95:    ${result.p95.toFixed(2)}ms`);
  console.log(`   P99:    ${result.p99.toFixed(2)}ms`);
  console.log(`   Max:    ${result.max.toFixed(2)}ms`);
  console.log(`   Total:  ${result.total.toFixed(2)}ms`);
}

function checkSLA(result: BenchmarkResult, slaMs: number): boolean {
  const passed = result.p95 < slaMs;
  const emoji = passed ? '✅' : '❌';
  console.log(`   ${emoji} SLA: P95 < ${slaMs}ms (actual: ${result.p95.toFixed(2)}ms)`);
  return passed;
}

async function runBenchmarks() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   ApkZio Performance Benchmarks        ║');
  console.log('╚════════════════════════════════════════╝');

  const results: BenchmarkResult[] = [];
  const slaResults: { name: string; passed: boolean }[] = [];

  // 1. Simple SELECT query
  const listApps = await benchmark('List Apps (Simple SELECT)', async () => {
    await query('SELECT * FROM android_apps LIMIT 100');
  }, 100);
  results.push(listApps);
  printResult(listApps);
  slaResults.push({ name: 'List Apps', passed: checkSLA(listApps, 50) });

  // 2. Analytics aggregation query
  const analyticsQuery = await benchmark('Analytics Query (Aggregation)', async () => {
    await query(`
      SELECT 
        COUNT(*) as total_events,
        COUNT(DISTINCT device_id) as unique_devices
      FROM analytics_events
      WHERE timestamp > NOW() - INTERVAL '24 hours'
    `);
  }, 50);
  results.push(analyticsQuery);
  printResult(analyticsQuery);
  slaResults.push({ name: 'Analytics Query', passed: checkSLA(analyticsQuery, 100) });

  // 3. Campaign list with JOIN
  const campaignList = await benchmark('Campaign List (JOIN)', async () => {
    await query(`
      SELECT 
        c.*,
        COUNT(p.id) as notification_count
      FROM push_campaigns c
      LEFT JOIN push_notifications p ON p.campaign_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT 50
    `);
  }, 50);
  results.push(campaignList);
  printResult(campaignList);
  slaResults.push({ name: 'Campaign List', passed: checkSLA(campaignList, 100) });

  // 4. Cached dashboard metrics (cold)
  await cache.flush(); // Clear cache
  const dashboardCold = await benchmark('Dashboard Metrics (Cold Cache)', async () => {
    await getDashboardMetrics('test-app');
    await cache.del('dashboard:test-app'); // Clear after each iteration
  }, 50);
  results.push(dashboardCold);
  printResult(dashboardCold);
  slaResults.push({ name: 'Dashboard Cold', passed: checkSLA(dashboardCold, 150) });

  // 5. Cached dashboard metrics (warm)
  await getDashboardMetrics('test-app'); // Populate cache
  const dashboardWarm = await benchmark('Dashboard Metrics (Warm Cache)', async () => {
    await getDashboardMetrics('test-app');
  }, 100);
  results.push(dashboardWarm);
  printResult(dashboardWarm);
  slaResults.push({ name: 'Dashboard Warm', passed: checkSLA(dashboardWarm, 10) });

  // 6. Complex geographic query
  const geoQuery = await benchmark('Geographic Distribution Query', async () => {
    await query(`
      SELECT 
        country_code,
        COUNT(*) as event_count,
        COUNT(DISTINCT device_id) as unique_devices
      FROM analytics_events
      WHERE timestamp > NOW() - INTERVAL '30 days'
      GROUP BY country_code
      ORDER BY event_count DESC
      LIMIT 50
    `);
  }, 30);
  results.push(geoQuery);
  printResult(geoQuery);
  slaResults.push({ name: 'Geographic Query', passed: checkSLA(geoQuery, 200) });

  // Print summary
  console.log('\n\n╔════════════════════════════════════════╗');
  console.log('║           Summary Report               ║');
  console.log('╚════════════════════════════════════════╝\n');

  const passedCount = slaResults.filter((r) => r.passed).length;
  const totalCount = slaResults.length;

  console.log('SLA Compliance:');
  slaResults.forEach((r) => {
    const emoji = r.passed ? '✅' : '❌';
    console.log(`  ${emoji} ${r.name}`);
  });

  console.log(`\n📈 Overall: ${passedCount}/${totalCount} benchmarks passed`);

  if (passedCount === totalCount) {
    console.log('\n🎉 All performance benchmarks passed!');
  } else {
    console.log('\n⚠️  Some benchmarks did not meet SLA targets');
  }

  // Export results to JSON
  const report = {
    timestamp: new Date().toISOString(),
    results: results.map((r) => ({
      name: r.name,
      iterations: r.iterations,
      min: r.min,
      avg: r.avg,
      median: r.median,
      p95: r.p95,
      p99: r.p99,
      max: r.max,
    })),
    sla: slaResults,
    passed: passedCount === totalCount,
  };

  const fs = await import('fs/promises');
  await fs.writeFile(
    'benchmark-results.json',
    JSON.stringify(report, null, 2)
  );

  console.log('\n📄 Results saved to benchmark-results.json');
}

// Run benchmarks
runBenchmarks()
  .then(() => {
    console.log('\n✅ Benchmarks complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Benchmark failed:', err);
    process.exit(1);
  });
