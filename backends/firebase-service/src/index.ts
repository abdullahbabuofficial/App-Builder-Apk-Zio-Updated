// firebase-service/src/index.ts
//
// Worker entry point.
//
// Single process, configurable parallelism:
//   * `WORKER_CONCURRENCY` campaigns processed simultaneously per pod.
//   * `POLL_INTERVAL_MS` sleep between polls when queue is empty.
//
// Designed to run under a process supervisor (Fly machines, Railway,
// Cloud Run jobs, ECS service, k8s Deployment with HPA on queue depth).

import { db, claimNextNotification } from './db.js';
import { dispatchNotification } from './dispatcher.js';
import { logger } from './logger.js';
import { buildDispatcherStatusPayload } from './public-status.js';
import http from 'node:http';

const WORKER_CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 4);
const POLL_INTERVAL_MS   = Number(process.env.POLL_INTERVAL_MS ?? 2000);
const PORT               = Number(process.env.PORT ?? 8080);

let stopping = false;
const inflight = new Set<Promise<void>>();

// ---------------------------------------------------------------------
// Health check + readiness probe HTTP server.
// ---------------------------------------------------------------------
function requestPath(req: http.IncomingMessage): string {
  const raw = req.url ?? '/';
  try {
    return new URL(raw, 'http://127.0.0.1').pathname;
  } catch {
    const q = raw.indexOf('?');
    return q === -1 ? raw : raw.slice(0, q);
  }
}

const server = http.createServer(async (req, res) => {
  const path = requestPath(req);

  // `/health` aliases `/healthz` so the same probes as apkzio-local-api work.
  if (path === '/healthz' || path === '/health') {
    try {
      await db.query('SELECT 1');
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          service: 'apkzio-firebase-dispatcher',
          inflight: inflight.size,
        }),
      );
    } catch {
      res.writeHead(503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, service: 'apkzio-firebase-dispatcher' }));
    }
    return;
  }

  if (path === '/api/status' && req.method === 'GET') {
    let dbReachable = false;
    try {
      await db.query('SELECT 1');
      dbReachable = true;
    } catch {
      dbReachable = false;
    }
    const payload = buildDispatcherStatusPayload(dbReachable, inflight.size, WORKER_CONCURRENCY);
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(payload));
    return;
  }

  res.writeHead(404);
  res.end();
});

// ---------------------------------------------------------------------
// One worker loop. Multiple of these run concurrently.
// ---------------------------------------------------------------------
async function workerLoop(slot: number): Promise<void> {
  logger.info({ slot }, 'worker_started');
  while (!stopping) {
    try {
      const notif = await claimNextNotification();
      if (!notif) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }
      logger.info({
        slot,
        notification_id: notif.notification_id,
        app_id: notif.app_id,
      }, 'campaign_claimed');

      const work = dispatchNotification(notif);
      inflight.add(work);
      try {
        await work;
      } finally {
        inflight.delete(work);
      }
    } catch (err) {
      logger.error({ err, slot }, 'worker_loop_error');
      await sleep(2000);
    }
  }
  logger.info({ slot }, 'worker_stopped');
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

// ---------------------------------------------------------------------
// Bootstrap.
// ---------------------------------------------------------------------
async function main(): Promise<void> {
  // Sanity-check env before we start workers.
  if (!process.env.DATABASE_URL)
    throw new Error('DATABASE_URL env required');
  if (!process.env.DEFAULT_FCM_CREDENTIALS)
    logger.warn('DEFAULT_FCM_CREDENTIALS not set — apps without per-tenant creds will fail');

  server.listen(PORT, () => logger.info({ port: PORT }, 'health_listening'));

  const workers: Promise<void>[] = [];
  for (let i = 0; i < WORKER_CONCURRENCY; i++) workers.push(workerLoop(i));
  await Promise.all(workers);
}

// ---------------------------------------------------------------------
// Graceful shutdown — SIGTERM from orchestrator. We let in-flight
// campaigns complete (they're idempotent at the page level, so it's
// safe to be killed mid-flight, but completing them keeps stats clean).
// ---------------------------------------------------------------------
async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  logger.info({ signal, inflight: inflight.size }, 'shutdown_start');

  server.close();
  // Wait up to 25s for in-flight pages to drain.
  const deadline = Date.now() + 25_000;
  while (inflight.size > 0 && Date.now() < deadline) {
    await sleep(500);
  }
  await db.end();
  logger.info('shutdown_complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => logger.error({ err }, 'unhandled_rejection'));
process.on('uncaughtException',  (err) => logger.error({ err }, 'uncaught_exception'));

main().catch((err) => {
  logger.error({ err }, 'bootstrap_failed');
  process.exit(1);
});
