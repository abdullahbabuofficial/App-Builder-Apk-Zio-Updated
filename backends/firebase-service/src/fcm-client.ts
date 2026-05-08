// firebase-service/src/fcm-client.ts
//
// Multi-tenant FCM. Each `android_apps` row may carry its own service-
// account credentials (large customers run their own Firebase projects
// for analytics/quotas). We cache one Messaging instance per project.
//
// If `fcm_credentials` is null on the app row, we fall back to the
// dispatcher's default Firebase project (DEFAULT_FCM_CREDENTIALS env).

import { App as FirebaseApp, ServiceAccount, cert, getApps, initializeApp } from 'firebase-admin/app';
import { Messaging, getMessaging } from 'firebase-admin/messaging';
import { logger } from './logger.js';

interface CacheEntry {
  app: FirebaseApp;
  messaging: Messaging;
  createdAt: number;
}

const cache = new Map<string, CacheEntry>();
const MAX_CACHE = 200;     // cap memory; rotate LRU when full
const TTL_MS = 6 * 60 * 60 * 1000;

function buildApp(name: string, credentials: ServiceAccount): FirebaseApp {
  // Re-use if Firebase Admin already has it.
  const existing = getApps().find((a) => a.name === name);
  if (existing) return existing;
  return initializeApp({ credential: cert(credentials) }, name);
}

function defaultCredentials(): ServiceAccount {
  const raw = process.env.DEFAULT_FCM_CREDENTIALS;
  if (!raw) throw new Error('DEFAULT_FCM_CREDENTIALS env not set');
  try {
    return JSON.parse(raw) as ServiceAccount;
  } catch {
    throw new Error('DEFAULT_FCM_CREDENTIALS is not valid JSON');
  }
}

function evictIfNeeded(): void {
  if (cache.size < MAX_CACHE) return;
  // Delete the oldest entry.
  let oldestKey: string | null = null;
  let oldestAt = Infinity;
  for (const [k, v] of cache) {
    if (v.createdAt < oldestAt) { oldestAt = v.createdAt; oldestKey = k; }
  }
  if (oldestKey) {
    cache.delete(oldestKey);
    logger.debug({ key: oldestKey }, 'fcm_cache_evicted');
  }
}

export function getMessagingForApp(
  appId: string,
  credentials: Record<string, unknown> | null,
  projectId: string | null,
): Messaging {
  const cacheKey = projectId ?? 'default';
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.createdAt < TTL_MS) return hit.messaging;
  if (hit) cache.delete(cacheKey);

  const creds = (credentials ?? defaultCredentials()) as ServiceAccount;
  const fbAppName = `pc_${cacheKey}`;
  const fbApp = buildApp(fbAppName, creds);
  const messaging = getMessaging(fbApp);

  evictIfNeeded();
  cache.set(cacheKey, { app: fbApp, messaging, createdAt: Date.now() });
  logger.debug({ appId, projectId: cacheKey }, 'fcm_client_initialized');

  return messaging;
}
