// firebase-service/src/db.ts
//
// Thin layer over pg. We talk to Postgres directly (not via the Supabase
// REST API) because the dispatcher needs:
//   * SELECT ... FOR UPDATE SKIP LOCKED for safe job claiming.
//   * High-throughput bulk inserts.
//   * Long-lived prepared statements.

import pg from 'pg';
import { logger } from './logger.js';

const { Pool } = pg;

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Direct connections to Supabase Postgres go through pgbouncer in
  // transaction mode. We keep our own pool small per-worker because
  // pgbouncer already pools.
  max: Number(process.env.PG_POOL_MAX ?? 5),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  application_name: 'pushcare-dispatcher',
});

db.on('error', (err) => logger.error({ err }, 'pg_pool_error'));

// ---------------------------------------------------------------------
// Claim the next queued notification atomically. Multiple workers can
// run this concurrently; SKIP LOCKED guarantees they don't fight for
// the same row.
// ---------------------------------------------------------------------
export interface ClaimedNotification {
  notification_id: string;
  app_id: string;
  owner_id: string;
  title: string;
  body: string;
  image_url: string | null;
  click_action_url: string | null;
  data_payload: Record<string, string>;
  target_type: string;
  fcm_credentials: Record<string, unknown> | null;
  fcm_project_id: string | null;
}

export async function claimNextNotification(): Promise<ClaimedNotification | null> {
  const sql = `
    WITH next AS (
      SELECT n.notification_id
        FROM app_push_notifications n
       WHERE n.status = 'queued'
         AND (n.scheduled_at IS NULL OR n.scheduled_at <= NOW())
       ORDER BY COALESCE(n.scheduled_at, n.created_at)
       FOR UPDATE SKIP LOCKED
       LIMIT 1
    )
    UPDATE app_push_notifications n
       SET status = 'dispatching',
           dispatched_at = NOW(),
           updated_at = NOW()
      FROM next
     WHERE n.notification_id = next.notification_id
    RETURNING
      n.notification_id, n.app_id, n.owner_id,
      n.title, n.body, n.image_url, n.click_action_url, n.data_payload,
      n.target_type,
      (SELECT fcm_credentials FROM android_apps a WHERE a.app_id = n.app_id) AS fcm_credentials,
      (SELECT fcm_project_id  FROM android_apps a WHERE a.app_id = n.app_id) AS fcm_project_id
  `;
  const { rows } = await db.query(sql);
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------
// Pull a chunk of subscribers for a campaign. Cursor pattern keeps
// memory bounded — we never load >chunkSize tokens at once.
// ---------------------------------------------------------------------
export interface SubscriberRow {
  subscriber_id: string;
  device_id: string;
  fcm_token: string;
}

export async function fetchSubscriberChunk(
  notificationId: string,
  chunkSize: number,
  afterSubId: string | null,
): Promise<SubscriberRow[]> {
  const { rows } = await db.query(
    'SELECT * FROM push_target_subscribers($1, $2, $3)',
    [notificationId, chunkSize, afterSubId],
  );
  return rows as SubscriberRow[];
}

// ---------------------------------------------------------------------
// Bulk-record the result of one FCM send batch.
// ---------------------------------------------------------------------
export interface DeliveryResult {
  subscriber_id: string;
  device_id: string;
  status: 1 | 2 | 5 | 6; // sent | delivered | failed | token_invalid
  fcm_message_id: string | null;
  error_code: string | null;
}

export async function recordDeliveryBatch(
  notificationId: string,
  appId: string,
  results: DeliveryResult[],
): Promise<number> {
  if (results.length === 0) return 0;
  const { rows } = await db.query(
    'SELECT push_record_delivery_batch($1, $2, $3) AS inserted',
    [notificationId, appId, JSON.stringify(results)],
  );
  return rows[0]?.inserted ?? 0;
}

// ---------------------------------------------------------------------
// Mark a campaign as completed/failed.
// ---------------------------------------------------------------------
export async function markCampaign(
  notificationId: string,
  finalStatus: 'sent' | 'failed',
  recipients: number,
): Promise<void> {
  await db.query(
    `UPDATE app_push_notifications
        SET status            = $2,
            recipients_count  = $3,
            completed_at      = NOW(),
            updated_at        = NOW()
      WHERE notification_id = $1`,
    [notificationId, finalStatus, recipients],
  );
}
