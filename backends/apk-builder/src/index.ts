// apk-builder/src/index.ts
//
// Worker entry point.
//
// Single process, configurable parallelism:
//   * `WORKER_CONCURRENCY` builds processed simultaneously per pod.
//   * `POLL_INTERVAL_MS` sleep between polls when queue is empty.
//
// Designed to run under a process supervisor (Fly machines, Railway,
// Cloud Run jobs, ECS service, k8s Deployment with HPA on queue depth).
//
// Two transport modes:
//   * Postgres mode  (DATABASE_URL set): claim/update via pg.
//   * Local-API mode (LOCAL_API_URL set): poll/post backends/local-api.

import http from 'node:http';
import { db, claimNextBuild, markBuildSucceeded, markBuildFailed } from './db.js';
import {
  pollNextBuild,
  markBuildSucceeded as apiMarkSucceeded,
  markBuildFailed as apiMarkFailed,
} from './api-client.js';
import type { ClaimedBuild } from './db.js';
import { buildApk } from './builder.js';
import { uploadApk } from './storage.js';
import { logger } from './logger.js';

const WORKER_CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 2);
const POLL_INTERVAL_MS   = Number(process.env.POLL_INTERVAL_MS ?? 5000);
const PORT               = Number(process.env.PORT ?? 8090);

const USE_POSTGRES = Boolean(process.env.DATABASE_URL);
const USE_LOCAL_API = !USE_POSTGRES && Boolean(process.env.LOCAL_API_URL);

let stopping = false;
const inflight = new Set<Promise<void>>();

// ---------------------------------------------------------------------
// Health check + readiness probe HTTP server.
// ---------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  if (req.url === '/healthz') {
    try {
      if (USE_POSTGRES) await db.query('SELECT 1');
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, inflight: inflight.size }));
    } catch (err) {
      res.writeHead(503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false }));
    }
    return;
  }
  res.writeHead(404); res.end();
});

// ---------------------------------------------------------------------
// Claim wrapper — chooses the right transport.
// ---------------------------------------------------------------------
async function claimNext(): Promise<ClaimedBuild | null> {
  if (USE_POSTGRES) return claimNextBuild();
  if (USE_LOCAL_API) return pollNextBuild();
  return null;
}

// ---------------------------------------------------------------------
// One worker loop. Multiple of these run concurrently.
// ---------------------------------------------------------------------
async function workerLoop(slot: number): Promise<void> {
  logger.info({ slot }, 'worker_started');
  while (!stopping) {
    try {
      const claim = await claimNext();
      if (!claim) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }
      logger.info({
        slot,
        build_id: claim.build_id,
        app_id: claim.app_id,
        version_name: claim.version_name,
        version_code: claim.version_code,
      }, 'build_claimed');

      const work = dispatchBuild(claim);
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

// ---------------------------------------------------------------------
// Process one claimed build end-to-end: simulate the build, upload
// the artifact, record the result. Errors flow into markBuildFailed.
// ---------------------------------------------------------------------
async function dispatchBuild(claim: ClaimedBuild): Promise<void> {
  try {
    const result = await buildApk(claim, logger);
    const url = await uploadApk(claim, result.apkPath);
    if (USE_POSTGRES) {
      await markBuildSucceeded(claim.build_id, url, result.sizeBytes, result.sha256);
    } else if (USE_LOCAL_API) {
      await apiMarkSucceeded(claim.build_id, url, result.sizeBytes, result.sha256);
    }
    logger.info({ build_id: claim.build_id, url }, 'build_succeeded');
  } catch (err) {
    logger.error({ err, build_id: claim.build_id }, 'build_failed');
    const msg = (err as Error).message ?? 'unknown_error';
    if (USE_POSTGRES) {
      await markBuildFailed(claim.build_id, msg);
    } else if (USE_LOCAL_API) {
      await apiMarkFailed(claim.build_id, msg);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

// ---------------------------------------------------------------------
// Bootstrap.
// ---------------------------------------------------------------------
async function main(): Promise<void> {
  if (!USE_POSTGRES && !USE_LOCAL_API) {
    throw new Error('Set DATABASE_URL (production) or LOCAL_API_URL (dev)');
  }
  if (USE_POSTGRES) logger.info('mode=postgres');
  else logger.info({ url: process.env.LOCAL_API_URL }, 'mode=local_api');

  if (!process.env.SUPABASE_URL && !process.env.OUTPUT_DIR) {
    logger.warn('Neither SUPABASE_URL nor OUTPUT_DIR set — APKs will only land in /tmp');
  }

  server.listen(PORT, () => logger.info({ port: PORT }, 'health_listening'));

  const workers: Promise<void>[] = [];
  for (let i = 0; i < WORKER_CONCURRENCY; i++) workers.push(workerLoop(i));
  await Promise.all(workers);
}

// ---------------------------------------------------------------------
// Graceful shutdown — SIGTERM from orchestrator. We let in-flight
// builds finish (a partial APK is worse than a slightly slower drain).
// ---------------------------------------------------------------------
async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  logger.info({ signal, inflight: inflight.size }, 'shutdown_start');

  server.close();
  // Wait up to 60s for in-flight builds to drain.
  const deadline = Date.now() + 60_000;
  while (inflight.size > 0 && Date.now() < deadline) {
    await sleep(500);
  }
  if (USE_POSTGRES) await db.end();
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
