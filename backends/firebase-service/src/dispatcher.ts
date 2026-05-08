// firebase-service/src/dispatcher.ts
//
// Process one claimed notification end-to-end:
//   1. Page through subscribers in chunks of 1000.
//   2. For each chunk, call FCM `sendEachForMulticast` in batches of 500
//      (FCM hard limit).
//   3. Map results → DeliveryResult[], call recordDeliveryBatch.
//   4. Retry transient errors with exponential backoff (max 3 attempts).
//   5. Mark token-invalid errors so the SDK is forced to re-register.

import pLimit from 'p-limit';
import type { Messaging, MulticastMessage, BatchResponse } from 'firebase-admin/messaging';
import {
  ClaimedNotification, SubscriberRow, DeliveryResult,
  fetchSubscriberChunk, recordDeliveryBatch, markCampaign,
} from './db.js';
import { getMessagingForApp } from './fcm-client.js';
import { logger } from './logger.js';

const FCM_BATCH = 500;                 // FCM `sendEachForMulticast` cap
const SUB_CHUNK = 2000;                // tokens fetched per DB roundtrip
const SEND_CONCURRENCY = 6;            // parallel FCM batches per campaign
const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 250;

// FCM error codes that mean the token will never work again.
const PERMANENT_TOKEN_ERRORS = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',                 // sometimes returned for malformed tokens
  'messaging/mismatched-credential',
  'messaging/sender-id-mismatch',
]);

// FCM errors worth retrying.
const TRANSIENT_ERRORS = new Set([
  'messaging/internal-error',
  'messaging/server-unavailable',
  'messaging/unavailable',
  'messaging/quota-exceeded',
  'messaging/timeout',
]);

function buildMessagePayload(n: ClaimedNotification): Omit<MulticastMessage, 'tokens'> {
  // FCM data values must be strings.
  const data: Record<string, string> = {
    pc_notification_id: n.notification_id,
  };
  for (const [k, v] of Object.entries(n.data_payload ?? {})) {
    data[k] = typeof v === 'string' ? v : JSON.stringify(v);
  }
  if (n.click_action_url) data.pc_click_url = n.click_action_url;

  return {
    notification: {
      title: n.title,
      body:  n.body,
      ...(n.image_url ? { imageUrl: n.image_url } : {}),
    },
    data,
    android: {
      priority: 'high',
      notification: {
        clickAction: n.click_action_url ?? undefined,
        channelId: 'apkzio_default',
      },
    },
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

// ---------------------------------------------------------------------
// Send one batch of <=500 tokens. Returns DeliveryResult[] in lockstep
// with the input chunk so the caller can record everything in one go.
// ---------------------------------------------------------------------
async function sendOneBatch(
  messaging: Messaging,
  notif: ClaimedNotification,
  chunk: SubscriberRow[],
): Promise<DeliveryResult[]> {
  const message: MulticastMessage = {
    ...buildMessagePayload(notif),
    tokens: chunk.map((s) => s.fcm_token),
  };

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const resp: BatchResponse = await messaging.sendEachForMulticast(message);
      const out: DeliveryResult[] = [];
      resp.responses.forEach((r, i) => {
        const sub = chunk[i];
        if (r.success) {
          out.push({
            subscriber_id:  sub.subscriber_id,
            device_id:      sub.device_id,
            status:         1, // sent
            fcm_message_id: r.messageId ?? null,
            error_code:     null,
          });
        } else {
          const code = r.error?.code ?? 'unknown';
          const isPermanent = PERMANENT_TOKEN_ERRORS.has(code);
          out.push({
            subscriber_id:  sub.subscriber_id,
            device_id:      sub.device_id,
            status:         isPermanent ? 6 : 5,  // token_invalid | failed
            fcm_message_id: null,
            error_code:     code,
          });
        }
      });
      return out;
    } catch (err) {
      lastError = err;
      const code = (err as { code?: string }).code;
      if (code && TRANSIENT_ERRORS.has(code) && attempt < MAX_ATTEMPTS) {
        const wait = BACKOFF_BASE_MS * 2 ** (attempt - 1) + Math.random() * 100;
        logger.warn({ code, attempt, wait }, 'fcm_batch_retry');
        await sleep(wait);
        continue;
      }
      logger.error({ err, code }, 'fcm_batch_failed');
      // Mark every token in this batch as failed.
      return chunk.map((sub) => ({
        subscriber_id:  sub.subscriber_id,
        device_id:      sub.device_id,
        status:         5,
        fcm_message_id: null,
        error_code:     code ?? 'batch_send_failed',
      }));
    }
  }
  // Should be unreachable.
  logger.error({ err: lastError }, 'fcm_batch_exhausted');
  return chunk.map((sub) => ({
    subscriber_id: sub.subscriber_id,
    device_id:     sub.device_id,
    status:        5,
    fcm_message_id: null,
    error_code:    'exhausted_retries',
  }));
}

// ---------------------------------------------------------------------
// Process a campaign end-to-end.
// ---------------------------------------------------------------------
export async function dispatchNotification(notif: ClaimedNotification): Promise<void> {
  const startedAt = Date.now();
  const messaging = getMessagingForApp(notif.app_id, notif.fcm_credentials, notif.fcm_project_id);
  const limiter = pLimit(SEND_CONCURRENCY);

  let totalRecipients = 0;
  let cursor: string | null = null;
  let pageSafety = 0;

  try {
    while (true) {
      if (++pageSafety > 5000) {
        logger.error({ notification_id: notif.notification_id }, 'pagination_runaway');
        break;
      }

      const subs = await fetchSubscriberChunk(notif.notification_id, SUB_CHUNK, cursor);
      if (subs.length === 0) break;

      // Split chunk into FCM-sized batches.
      const batches: SubscriberRow[][] = [];
      for (let i = 0; i < subs.length; i += FCM_BATCH) {
        batches.push(subs.slice(i, i + FCM_BATCH));
      }

      // Run batches with bounded parallelism.
      const batchResults = await Promise.all(
        batches.map((b) => limiter(() => sendOneBatch(messaging, notif, b))),
      );

      // Record all results for this page in one DB roundtrip.
      const flat = batchResults.flat();
      await recordDeliveryBatch(notif.notification_id, notif.app_id, flat);

      totalRecipients += subs.length;
      cursor = subs[subs.length - 1].subscriber_id;

      logger.info({
        notification_id: notif.notification_id,
        page_size: subs.length,
        total: totalRecipients,
      }, 'page_dispatched');
    }

    await markCampaign(notif.notification_id, 'sent', totalRecipients);
    logger.info({
      notification_id: notif.notification_id,
      recipients: totalRecipients,
      duration_ms: Date.now() - startedAt,
    }, 'campaign_complete');
  } catch (err) {
    logger.error({ err, notification_id: notif.notification_id }, 'campaign_failed');
    await markCampaign(notif.notification_id, 'failed', totalRecipients);
  }
}
