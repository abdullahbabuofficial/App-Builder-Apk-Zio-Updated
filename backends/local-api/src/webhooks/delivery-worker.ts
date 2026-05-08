import crypto from 'crypto';
import fetch from 'node-fetch';
import { query } from '../db.js';
import type { WebhookPayload } from './types.js';

export class WebhookDeliveryWorker {
  private queue: Array<{ endpointId: string; payload: WebhookPayload }> = [];
  private processing = false;
  private intervalId: NodeJS.Timeout | null = null;
  
  start() {
    console.log('🔄 Webhook delivery worker started');
    this.intervalId = setInterval(() => {
      void this.processQueue();
    }, 5000);
  }
  
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 Webhook delivery worker stopped');
    }
  }
  
  async enqueue(endpointId: string, payload: WebhookPayload) {
    this.queue.push({ endpointId, payload });
    
    // Save to database for persistence
    try {
      await query(`
        INSERT INTO webhook_deliveries (endpoint_id, event_type, payload)
        VALUES ($1, $2, $3)
      `, [endpointId, payload.event, JSON.stringify(payload)]);
    } catch (err) {
      console.error('Failed to persist webhook delivery:', err);
    }
  }
  
  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    try {
      while (this.queue.length > 0) {
        const item = this.queue.shift()!;
        await this.deliver(item.endpointId, item.payload);
      }
      
      // Also retry failed deliveries
      await this.retryFailed();
    } finally {
      this.processing = false;
    }
  }
  
  private async deliver(endpointId: string, payload: WebhookPayload) {
    try {
      const { rows } = await query<{ url: string; secret: string }>(`
        SELECT url, secret FROM webhook_endpoints 
        WHERE id = $1 AND is_active = true
      `, [endpointId]);
      
      if (rows.length === 0) {
        console.log(`⏭️  Webhook endpoint ${endpointId} not found or inactive`);
        return;
      }
      
      const endpoint = rows[0];
      const signature = this.generateSignature(payload, endpoint.secret);
      
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-ID': payload.id,
          'X-Webhook-Event': payload.event,
        },
        body: JSON.stringify(payload),
        // @ts-ignore - timeout exists in node-fetch
        timeout: 10000,
      });
      
      const responseBody = await response.text();
      
      await query(`
        UPDATE webhook_deliveries
        SET response_code = $1, response_body = $2, delivered_at = NOW()
        WHERE endpoint_id = $3 AND payload->>'id' = $4 AND delivered_at IS NULL
      `, [response.status, responseBody.slice(0, 1000), endpointId, payload.id]);
      
      console.log(`✅ Webhook delivered: ${endpoint.url} [${response.status}]`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`❌ Webhook delivery failed: ${endpointId}`, errorMessage);
      
      try {
        await query(`
          UPDATE webhook_deliveries
          SET response_code = 0, response_body = $1, attempt_count = attempt_count + 1
          WHERE endpoint_id = $2 AND payload->>'id' = $3 AND delivered_at IS NULL
        `, [errorMessage.slice(0, 1000), endpointId, payload.id]);
      } catch (updateErr) {
        console.error('Failed to update delivery error:', updateErr);
      }
    }
  }
  
  private async retryFailed() {
    try {
      const { rows } = await query<{
        endpoint_id: string;
        payload: WebhookPayload;
        attempt_count: number;
        created_at: string;
      }>(`
        SELECT d.endpoint_id, d.payload, d.attempt_count, d.created_at
        FROM webhook_deliveries d
        JOIN webhook_endpoints e ON d.endpoint_id = e.id
        WHERE d.delivered_at IS NULL
          AND d.attempt_count < 5
          AND d.created_at > NOW() - INTERVAL '24 hours'
          AND e.is_active = true
        ORDER BY d.created_at ASC
        LIMIT 10
      `);
      
      for (const row of rows) {
        const backoffMs = Math.min(1000 * Math.pow(2, row.attempt_count), 60000);
        const shouldRetry = Date.now() - new Date(row.created_at).getTime() > backoffMs;
        
        if (shouldRetry) {
          await this.deliver(row.endpoint_id, row.payload);
        }
      }
    } catch (err) {
      console.error('Failed to retry webhooks:', err);
    }
  }
  
  private generateSignature(payload: WebhookPayload, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex');
  }
}

export const webhookWorker = new WebhookDeliveryWorker();
