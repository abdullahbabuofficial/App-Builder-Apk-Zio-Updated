import { webhookWorker } from './delivery-worker.js';
import { query } from '../db.js';
import { randomBytes } from 'crypto';
import type { WebhookEventType, WebhookPayload, WebhookEndpoint } from './types.js';

export async function triggerWebhook(event: WebhookEventType, data: Record<string, any>) {
  try {
    const { rows } = await query<WebhookEndpoint>(`
      SELECT * FROM webhook_endpoints
      WHERE is_active = true AND $1 = ANY(events)
    `, [event]);
    
    if (rows.length === 0) {
      console.log(`📭 No active webhook endpoints for event: ${event}`);
      return;
    }
    
    const payload: WebhookPayload = {
      id: randomBytes(16).toString('hex'),
      event,
      created_at: new Date().toISOString(),
      data,
    };
    
    console.log(`📤 Triggering ${rows.length} webhook(s) for event: ${event}`);
    
    for (const endpoint of rows) {
      await webhookWorker.enqueue(endpoint.id, payload);
    }
  } catch (err) {
    console.error('Failed to trigger webhooks:', err);
  }
}
