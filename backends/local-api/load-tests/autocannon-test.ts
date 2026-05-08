#!/usr/bin/env tsx

/**
 * Autocannon Load Test Runner
 * 
 * Alternative to k6 for quick HTTP load testing
 */

import autocannon from 'autocannon';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const API_KEY = process.env.API_KEY || '';

async function runTest() {
  console.log('🚀 Starting Autocannon load test...\n');
  console.log(`Target: ${API_URL}`);
  console.log(`Duration: 30 seconds`);
  console.log(`Connections: 10\n`);

  const result = await autocannon({
    url: API_URL,
    connections: 10,
    duration: 30,
    pipelining: 1,
    requests: [
      {
        method: 'GET',
        path: '/api/apps',
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
      },
      {
        method: 'GET',
        path: '/api/analytics/overview?app_id=test',
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
      },
      {
        method: 'POST',
        path: '/api/events',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          events: [
            {
              app_id: 'test-app',
              event_type: 'heartbeat',
              device_id: 'test-device',
              country_code: 'US',
            },
          ],
        }),
      },
    ],
  });

  console.log('\n📊 Load Test Results:\n');
  console.log(`Requests: ${result.requests.total}`);
  console.log(`Duration: ${result.duration}s`);
  console.log(`Req/sec: ${result.requests.average.toFixed(2)}`);
  console.log(`Latency:`);
  console.log(`  Mean: ${result.latency.mean.toFixed(2)}ms`);
  console.log(`  P50: ${result.latency.p50.toFixed(2)}ms`);
  console.log(`  P95: ${result.latency.p95.toFixed(2)}ms`);
  console.log(`  P99: ${result.latency.p99.toFixed(2)}ms`);
  console.log(`  Max: ${result.latency.max.toFixed(2)}ms`);
  console.log(`\nThroughput: ${(result.throughput.total / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Errors: ${result.errors}`);
  console.log(`Timeouts: ${result.timeouts}`);

  if (result.errors > 0 || result.timeouts > 0) {
    console.log('\n⚠️  Some requests failed');
    process.exit(1);
  }

  console.log('\n✅ Load test completed successfully');
}

runTest().catch((err) => {
  console.error('❌ Load test failed:', err);
  process.exit(1);
});
