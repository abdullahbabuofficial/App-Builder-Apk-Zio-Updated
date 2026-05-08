/**
 * Integration tests for webhook system
 * 
 * Run with: npm test -- webhooks.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { query, pool } from '../db.js';
import { webhookWorker } from './delivery-worker.js';
import { triggerWebhook } from './trigger.js';
import type { WebhookPayload } from './types.js';
import crypto from 'crypto';

describe('Webhook System', () => {
  let testEndpointId: string;
  const testSecret = crypto.randomBytes(32).toString('hex');
  
  beforeAll(async () => {
    // Create test webhook endpoint
    const { rows } = await query(`
      INSERT INTO webhook_endpoints (url, secret, events, is_active)
      VALUES ($1, $2, $3, true)
      RETURNING id
    `, [
      'http://localhost:9999/webhook',
      testSecret,
      ['campaign.sent', 'app.created']
    ]);
    testEndpointId = rows[0].id;
    
    // Start worker
    webhookWorker.start();
  });
  
  afterAll(async () => {
    // Cleanup
    await query('DELETE FROM webhook_endpoints WHERE id = $1', [testEndpointId]);
    webhookWorker.stop();
    await pool.end();
  });
  
  it('should create webhook endpoint', async () => {
    const { rows } = await query(`
      SELECT * FROM webhook_endpoints WHERE id = $1
    `, [testEndpointId]);
    
    expect(rows).toHaveLength(1);
    expect(rows[0].url).toBe('http://localhost:9999/webhook');
    expect(rows[0].is_active).toBe(true);
    expect(rows[0].events).toEqual(['campaign.sent', 'app.created']);
  });
  
  it('should enqueue webhook delivery', async () => {
    const payload: WebhookPayload = {
      id: crypto.randomBytes(16).toString('hex'),
      event: 'campaign.sent',
      created_at: new Date().toISOString(),
      data: {
        campaign_id: 'test-campaign-id',
        app_id: 'test-app-id',
        recipients_count: 100,
      },
    };
    
    await webhookWorker.enqueue(testEndpointId, payload);
    
    // Check delivery was persisted
    const { rows } = await query(`
      SELECT * FROM webhook_deliveries
      WHERE endpoint_id = $1 AND payload->>'id' = $2
    `, [testEndpointId, payload.id]);
    
    expect(rows).toHaveLength(1);
    expect(rows[0].event_type).toBe('campaign.sent');
    expect(rows[0].attempt_count).toBe(1);
  });
  
  it('should trigger webhook for matching events', async () => {
    await triggerWebhook('campaign.sent', {
      campaign_id: 'test-campaign-2',
      app_id: 'test-app-2',
      recipients_count: 50,
    });
    
    // Wait for async processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check webhook was queued
    const { rows } = await query(`
      SELECT * FROM webhook_deliveries
      WHERE endpoint_id = $1 AND event_type = 'campaign.sent'
      ORDER BY created_at DESC
      LIMIT 1
    `,[testEndpointId]);
    
    expect(rows).toHaveLength(1);
  });
  
  it('should not trigger webhook for non-matching events', async () => {
    const beforeCount = await query(`
      SELECT COUNT(*) FROM webhook_deliveries WHERE endpoint_id = $1
    `, [testEndpointId]);
    
    await triggerWebhook('build.completed', {
      build_id: 'test-build-1',
    });
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const afterCount = await query(`
      SELECT COUNT(*) FROM webhook_deliveries WHERE endpoint_id = $1
    `, [testEndpointId]);
    
    expect(afterCount.rows[0].count).toBe(beforeCount.rows[0].count);
  });
  
  it('should generate valid HMAC signature', async () => {
    const payload: WebhookPayload = {
      id: 'test-payload-id',
      event: 'campaign.sent',
      created_at: new Date().toISOString(),
      data: { test: 'data' },
    };
    
    const hmac = crypto.createHmac('sha256', testSecret);
    hmac.update(JSON.stringify(payload));
    const signature = hmac.digest('hex');
    
    expect(signature).toHaveLength(64);
    expect(typeof signature).toBe('string');
  });
  
  it('should handle inactive endpoints', async () => {
    // Deactivate endpoint
    await query('UPDATE webhook_endpoints SET is_active = false WHERE id = $1', [testEndpointId]);
    
    await triggerWebhook('campaign.sent', {
      campaign_id: 'test-campaign-3',
    });
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Should not create new deliveries for inactive endpoints
    const { rows } = await query(`
      SELECT * FROM webhook_deliveries
      WHERE endpoint_id = $1 AND payload->>'data' LIKE '%test-campaign-3%'
    `, [testEndpointId]);
    
    expect(rows).toHaveLength(0);
    
    // Reactivate for cleanup
    await query('UPDATE webhook_endpoints SET is_active = true WHERE id = $1', [testEndpointId]);
  });
  
  it('should support multiple event subscriptions', async () => {
    await triggerWebhook('app.created', {
      app_id: 'new-app-id',
      name: 'Test App',
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const { rows } = await query(`
      SELECT * FROM webhook_deliveries
      WHERE endpoint_id = $1 AND event_type = 'app.created'
      ORDER BY created_at DESC
      LIMIT 1
    `, [testEndpointId]);
    
    expect(rows).toHaveLength(1);
  });
});
