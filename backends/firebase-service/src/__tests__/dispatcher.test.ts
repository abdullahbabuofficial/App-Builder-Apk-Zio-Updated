// Unit tests for the pure result-mapping helpers extracted from the
// dispatcher. We don't hit FCM; we hand-craft BatchResponse-shaped
// objects and verify status codes get assigned correctly.

import { describe, it, expect } from 'vitest';
import type { BatchResponse } from 'firebase-admin/messaging';
import { mapBatchResponseToResults, batchFailureResults } from '../dispatcher.js';
import type { SubscriberRow } from '../db.js';

function chunk(n: number): SubscriberRow[] {
  return Array.from({ length: n }, (_, i) => ({
    subscriber_id: `sub-${i}`,
    device_id:     `dev-${i}`,
    fcm_token:     `tok-${i}`,
  }));
}

function fakeResp(parts: Array<{ success: true; messageId: string } | { success: false; code: string }>): BatchResponse {
  return {
    successCount: parts.filter((p) => p.success).length,
    failureCount: parts.filter((p) => !p.success).length,
    responses: parts.map((p) =>
      p.success
        ? { success: true as const, messageId: p.messageId }
        : { success: false as const, error: { code: p.code, message: p.code } as Error & { code: string } },
    ),
  };
}

describe('mapBatchResponseToResults', () => {
  it('maps all-success → status=1', () => {
    const c = chunk(3);
    const resp = fakeResp([
      { success: true, messageId: 'm1' },
      { success: true, messageId: 'm2' },
      { success: true, messageId: 'm3' },
    ]);
    const out = mapBatchResponseToResults(c, resp);
    expect(out).toHaveLength(3);
    expect(out.every((r) => r.status === 1)).toBe(true);
    expect(out[0].fcm_message_id).toBe('m1');
    expect(out[2].error_code).toBeNull();
  });

  it('maps permanent token error → status=6 (token_invalid)', () => {
    const c = chunk(2);
    const resp = fakeResp([
      { success: true, messageId: 'ok' },
      { success: false, code: 'messaging/registration-token-not-registered' },
    ]);
    const out = mapBatchResponseToResults(c, resp);
    expect(out[0].status).toBe(1);
    expect(out[1].status).toBe(6);
    expect(out[1].error_code).toBe('messaging/registration-token-not-registered');
    expect(out[1].fcm_message_id).toBeNull();
  });

  it('maps non-permanent failure → status=5 (failed)', () => {
    const c = chunk(1);
    const resp = fakeResp([{ success: false, code: 'messaging/internal-error' }]);
    const out = mapBatchResponseToResults(c, resp);
    expect(out[0].status).toBe(5);
    expect(out[0].error_code).toBe('messaging/internal-error');
  });

  it('handles unknown error code', () => {
    const c = chunk(1);
    // simulate response with no error code present
    const resp: BatchResponse = {
      successCount: 0,
      failureCount: 1,
      responses: [{ success: false }],
    };
    const out = mapBatchResponseToResults(c, resp);
    expect(out[0].status).toBe(5);
    expect(out[0].error_code).toBe('unknown');
  });
});

describe('batchFailureResults', () => {
  it('marks every token failed with the given code', () => {
    const c = chunk(4);
    const out = batchFailureResults(c, 'exhausted_retries');
    expect(out).toHaveLength(4);
    expect(out.every((r) => r.status === 5)).toBe(true);
    expect(out.every((r) => r.error_code === 'exhausted_retries')).toBe(true);
    expect(out.every((r) => r.fcm_message_id === null)).toBe(true);
  });
});
