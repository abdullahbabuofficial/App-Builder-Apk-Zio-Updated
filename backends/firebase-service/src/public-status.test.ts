import { describe, expect, it, afterEach } from 'vitest';
import { buildDispatcherStatusPayload } from './public-status.js';

describe('buildDispatcherStatusPayload', () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it('reports postgres dispatcher shape', () => {
    process.env.DEFAULT_FCM_CREDENTIALS = '{"type":"service_account"}';
    const p = buildDispatcherStatusPayload(true, 2, 4);
    expect(p.ok).toBe(true);
    expect(p.service).toBe('apkzio-firebase-dispatcher');
    expect(p.persistence).toBe('postgres');
    expect(p.role).toBe('fcm_dispatcher');
    expect(p.features.db_reachable).toBe(true);
    expect(p.features.firebase_default_credentials).toBe(true);
    expect(p.features.firebase_admin).toBe(true);
    expect(p.features.admin_auth_enforced).toBe(false);
    expect(p.worker.inflight_notifications).toBe(2);
    expect(p.worker.worker_concurrency).toBe(4);
  });

  it('reports missing default FCM credentials', () => {
    delete process.env.DEFAULT_FCM_CREDENTIALS;
    const p = buildDispatcherStatusPayload(false, 0, 1);
    expect(p.features.db_reachable).toBe(false);
    expect(p.features.firebase_default_credentials).toBe(false);
    expect(p.features.firebase_admin).toBe(false);
  });
});
