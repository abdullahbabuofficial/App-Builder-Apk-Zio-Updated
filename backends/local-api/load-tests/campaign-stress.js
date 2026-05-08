import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 20 },
    { duration: '3m', target: 50 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // Campaign sends can be slower
    http_req_failed: ['rate<0.05'],     // Error rate < 5%
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3001';
const API_KEY = __ENV.API_KEY || '';

export default function () {
  const payload = JSON.stringify({
    app_id: 'test-app',
    title: `Test Campaign ${__VU}-${Date.now()}`,
    body: 'Load test campaign body - this is a test notification',
    target_type: 'all',
  });
  
  const res = http.post(`${BASE_URL}/api/campaigns`, payload, {
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
  });
  
  check(res, {
    'campaign created': (r) => r.status === 201 || r.status === 200,
    'campaign has id': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.campaign_id !== undefined || body.id !== undefined;
      } catch {
        return false;
      }
    },
  });
  
  sleep(3);
}

export function handleSummary(data) {
  const metrics = data.metrics;
  
  let summary = '\n========= Campaign Stress Test Results =========\n\n';
  
  if (metrics.http_req_duration) {
    const duration = metrics.http_req_duration;
    summary += '📊 Campaign Send Duration:\n';
    summary += `   Avg: ${duration.values.avg.toFixed(2)}ms\n`;
    summary += `   P95: ${duration.values['p(95)'].toFixed(2)}ms\n`;
    summary += `   Max: ${duration.values.max.toFixed(2)}ms\n\n`;
  }
  
  if (metrics.http_reqs) {
    summary += '🚀 Campaigns Sent:\n';
    summary += `   Total: ${metrics.http_reqs.values.count}\n`;
    summary += `   Rate: ${metrics.http_reqs.values.rate.toFixed(2)} campaigns/s\n\n`;
  }
  
  if (metrics.http_req_failed) {
    const errorPct = (metrics.http_req_failed.values.rate * 100).toFixed(2);
    summary += `Error Rate: ${errorPct}%\n\n`;
  }
  
  summary += '==============================================\n';
  
  return {
    'campaign-summary.json': JSON.stringify(data, null, 2),
    stdout: summary,
  };
}
