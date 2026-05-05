// Verifies getMessagingForApp's per-project caching and LRU eviction.
// We mock firebase-admin/app + /messaging so initializeApp is a counted
// stub. Each test re-imports the module to reset the cache map.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const initializeAppMock = vi.fn((_opts: unknown, name: string) => ({ name }));
const getMessagingMock = vi.fn(() => ({ id: Math.random() }));
const certMock = vi.fn((c: unknown) => c);

vi.mock('firebase-admin/app', () => ({
  initializeApp: initializeAppMock,
  getApps: () => [],
  cert: certMock,
}));

vi.mock('firebase-admin/messaging', () => ({
  getMessaging: getMessagingMock,
}));

beforeEach(() => {
  initializeAppMock.mockClear();
  getMessagingMock.mockClear();
  vi.resetModules();
  process.env.DEFAULT_FCM_CREDENTIALS = JSON.stringify({
    project_id: 'default',
    client_email: 'a@b.iam.gserviceaccount.com',
    private_key: '---',
  });
});

describe('getMessagingForApp', () => {
  it('caches per project_id and reuses on second call', async () => {
    const { getMessagingForApp } = await import('../fcm-client.js');
    const creds = { project_id: 'p1', client_email: 'x@y', private_key: '-' } as Record<string, unknown>;
    const m1 = getMessagingForApp('app1', creds, 'p1');
    const m2 = getMessagingForApp('app1', creds, 'p1');
    expect(m1).toBe(m2);
    expect(initializeAppMock).toHaveBeenCalledTimes(1);
  });

  it('builds separate clients for distinct project_ids', async () => {
    const { getMessagingForApp } = await import('../fcm-client.js');
    const c = { project_id: 'x', client_email: 'a', private_key: '-' } as Record<string, unknown>;
    getMessagingForApp('app1', c, 'p1');
    getMessagingForApp('app2', c, 'p2');
    expect(initializeAppMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to default credentials when none are passed', async () => {
    const { getMessagingForApp } = await import('../fcm-client.js');
    getMessagingForApp('app1', null, null);
    expect(initializeAppMock).toHaveBeenCalledTimes(1);
    // verify default credentials were parsed and forwarded via cert()
    expect(certMock).toHaveBeenCalled();
  });

  it('evicts oldest entry when cache size grows past MAX_CACHE', async () => {
    const { getMessagingForApp } = await import('../fcm-client.js');
    const creds = { project_id: 'x', client_email: 'a', private_key: '-' } as Record<string, unknown>;
    // Fill MAX_CACHE (200) + 1 entries to trigger eviction
    for (let i = 0; i < 205; i++) {
      getMessagingForApp(`app${i}`, creds, `p${i}`);
    }
    // Re-asking for the very first project should rebuild it (was evicted).
    const before = initializeAppMock.mock.calls.length;
    getMessagingForApp('app0', creds, 'p0');
    expect(initializeAppMock.mock.calls.length).toBe(before + 1);
  });
});
