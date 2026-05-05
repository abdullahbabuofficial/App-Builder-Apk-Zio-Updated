// Smoke tests for db.ts — we mock pg.Pool so no real Postgres connection
// is needed. We snapshot the SQL strings (via regex) to ensure the
// FOR UPDATE SKIP LOCKED contract and the markCampaign UPDATE are intact.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();
const onMock = vi.fn();

vi.mock('pg', () => ({
  default: {
    Pool: vi.fn().mockImplementation(() => ({
      query: queryMock,
      on: onMock,
    })),
  },
}));

beforeEach(() => {
  queryMock.mockReset();
  onMock.mockReset();
});

describe('claimNextNotification', () => {
  it('issues a CTE with FOR UPDATE SKIP LOCKED and returns the row', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ notification_id: 'n1', app_id: 'a1', owner_id: 'o1', title: 't', body: 'b' }],
    });
    const { claimNextNotification } = await import('../db.js');
    const out = await claimNextNotification();

    expect(queryMock).toHaveBeenCalledTimes(1);
    const sql = queryMock.mock.calls[0][0] as string;
    expect(sql).toMatch(/with\s+next\s+as/i);
    expect(sql).toMatch(/for\s+update\s+skip\s+locked/i);
    expect(sql).toMatch(/update\s+app_push_notifications/i);
    expect(sql).toMatch(/dispatching/);
    expect(out?.notification_id).toBe('n1');
  });

  it('returns null when the queue is empty', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const { claimNextNotification } = await import('../db.js');
    const out = await claimNextNotification();
    expect(out).toBeNull();
  });
});

describe('markCampaign', () => {
  it('builds the right UPDATE for sent + recipients', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const { markCampaign } = await import('../db.js');
    await markCampaign('n42', 'sent', 1234);

    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toMatch(/update\s+app_push_notifications/i);
    expect(sql).toMatch(/recipients_count\s*=\s*\$3/i);
    expect(sql).toMatch(/completed_at\s*=\s*now\(\)/i);
    expect(params).toEqual(['n42', 'sent', 1234]);
  });
});

describe('recordDeliveryBatch', () => {
  it('returns 0 immediately when results array is empty', async () => {
    const { recordDeliveryBatch } = await import('../db.js');
    const inserted = await recordDeliveryBatch('n1', 'a1', []);
    expect(inserted).toBe(0);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('forwards JSON results to push_record_delivery_batch', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ inserted: 5 }] });
    const { recordDeliveryBatch } = await import('../db.js');
    const n = await recordDeliveryBatch('n1', 'a1', [
      { subscriber_id: 's1', device_id: 'd1', status: 1, fcm_message_id: 'm1', error_code: null },
    ]);
    expect(n).toBe(5);
    const [sql, params] = queryMock.mock.calls[0];
    expect(sql).toMatch(/push_record_delivery_batch/);
    expect(params[0]).toBe('n1');
    expect(JSON.parse(params[2] as string)).toHaveLength(1);
  });
});
