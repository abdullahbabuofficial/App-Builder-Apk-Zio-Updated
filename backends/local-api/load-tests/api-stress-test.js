import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 50 },    // Ramp up to 50 users
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '1m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests < 500ms
    http_req_failed: ['rate<0.01'],    // Error rate < 1%
    errors: ['rate<0.1'],              // Custom error rate < 10%
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3001';
const API_KEY = __ENV.API_KEY || '';

export default function () {
  // Test GET /api/apps
  let res = http.get(`${BASE_URL}/api/apps`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` },
  });
  
  check(res, {
    'apps list status 200': (r) => r.status === 200,
    'apps list has data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.apps && Array.isArray(body.apps);
      } catch {
        return false;
      }
    },
  }) || errorRate.add(1);
  
  sleep(1);
  
  // Test GET /api/analytics/overview
  res = http.get(`${BASE_URL}/api/analytics/overview?app_id=test`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` },
  });
  
  check(res, {
    'analytics status 200': (r) => r.status === 200,
    'analytics has metrics': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.dailyInstalls !== undefined;
      } catch {
        return false;
      }
    },
  }) || errorRate.add(1);
  
  sleep(2);
  
  // Test POST /api/events (event ingestion)
  const payload = JSON.stringify({
    events: [
      {
        app_id: 'test-app',
        event_type: 'heartbeat',
        device_id: `device-${__VU}-${Date.now()}`,
        country_code: 'US',
      },
    ],
  });
  
  res = http.post(`${BASE_URL}/api/events`, payload, {
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
  });
  
  check(res, {
    'event ingestion status 200': (r) => r.status === 200 || r.status === 201,
    'events accepted': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.accepted !== undefined && body.accepted >= 0;
      } catch {
        return false;
      }
    },
  }) || errorRate.add(1);
  
  sleep(1);
}

export function handleSummary(data) {
  return {
    'summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options = {}) {
  const indent = options.indent || '';
  const colors = options.enableColors !== false;
  
  let summary = '\n';
  summary += `${indent}========= Load Test Results =========\n\n`;
  
  const metrics = data.metrics;
  
  // HTTP Request Duration
  if (metrics.http_req_duration) {
    const duration = metrics.http_req_duration;
    summary += `${indent}📊 HTTP Request Duration:\n`;
    summary += `${indent}   Avg: ${duration.values.avg.toFixed(2)}ms\n`;
    summary += `${indent}   P95: ${duration.values['p(95)'].toFixed(2)}ms\n`;
    summary += `${indent}   Max: ${duration.values.max.toFixed(2)}ms\n\n`;
  }
  
  // Request Rate
  if (metrics.http_reqs) {
    summary += `${indent}🚀 Request Rate:\n`;
    summary += `${indent}   Total: ${metrics.http_reqs.values.count}\n`;
    summary += `${indent}   Rate: ${metrics.http_reqs.values.rate.toFixed(2)} req/s\n\n`;
  }
  
  // Error Rate
  if (metrics.http_req_failed) {
    const errorPct = (metrics.http_req_failed.values.rate * 100).toFixed(2);
    const errorColor = metrics.http_req_failed.values.rate > 0.01 ? '❌' : '✅';
    summary += `${indent}${errorColor} Error Rate: ${errorPct}%\n\n`;
  }
  
  // Thresholds
  const thresholds = data.thresholds || {};
  const failed = Object.entries(thresholds).filter(([_, v]) => !v.ok);
  
  if (failed.length > 0) {
    summary += `${indent}❌ Failed Thresholds:\n`;
    failed.forEach(([name]) => {
      summary += `${indent}   - ${name}\n`;
    });
  } else {
    summary += `${indent}✅ All thresholds passed!\n`;
  }
  
  summary += `${indent}=====================================\n`;
  
  return summary;
}
