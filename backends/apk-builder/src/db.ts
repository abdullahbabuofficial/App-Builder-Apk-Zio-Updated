// apk-builder/src/db.ts
//
// Thin layer over pg. We talk to Postgres directly (not via the Supabase
// REST API) because the builder needs:
//   * SELECT ... FOR UPDATE SKIP LOCKED for safe job claiming.
//   * Long-lived prepared statements.
//
// This module is only used when DATABASE_URL is set; otherwise the
// worker falls back to api-client.ts (Local-API mode).

import pg from 'pg';
import { logger } from './logger.js';

const { Pool } = pg;

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Direct connections to Supabase Postgres go through pgbouncer in
  // transaction mode. Builder write volume is low so we keep the pool
  // small per worker.
  max: Number(process.env.PG_POOL_MAX ?? 3),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  application_name: 'pushcare-apk-builder',
});

db.on('error', (err) => logger.error({ err }, 'pg_pool_error'));

// ---------------------------------------------------------------------
// Claim the next pending build atomically. Multiple workers can run
// this concurrently; SKIP LOCKED guarantees they don't fight for the
// same row.
// ---------------------------------------------------------------------
export interface ClaimedBuild {
  build_id: string;
  app_id: string;
  owner_id: string;
  version_name: string;
  version_code: number;
  build_config: Record<string, unknown>;
}

export async function claimNextBuild(): Promise<ClaimedBuild | null> {
  const sql = `
    WITH next AS (
      SELECT build_id FROM apk_builds
       WHERE build_status = 'pending'
       ORDER BY created_at
       FOR UPDATE SKIP LOCKED
       LIMIT 1
    )
    UPDATE apk_builds b
       SET build_status = 'building', started_at = NOW()
      FROM next
     WHERE b.build_id = next.build_id
    RETURNING b.build_id, b.app_id, b.owner_id, b.version_name,
              b.version_code, b.build_config
  `;
  const { rows } = await db.query(sql);
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------
// Mark a build as succeeded with the resulting APK metadata. `buildLogUrl`
// is the storage URL of the captured build log (uploaded by the dispatcher
// before this call).
// ---------------------------------------------------------------------
export async function markBuildSucceeded(
  buildId: string,
  apkUrl: string,
  apkSizeBytes: number,
  apkSha256: string,
  buildLogUrl: string | null = null,
): Promise<void> {
  await db.query(
    `UPDATE apk_builds
        SET build_status   = 'succeeded',
            apk_url        = $2,
            apk_size_bytes = $3,
            apk_sha256     = $4,
            build_log_url  = COALESCE($5, build_log_url),
            completed_at   = NOW()
      WHERE build_id = $1`,
    [buildId, apkUrl, apkSizeBytes, apkSha256, buildLogUrl],
  );
}

// ---------------------------------------------------------------------
// Mark a build as failed. We persist the error message AND the log URL
// (when available) so support can pull the full output from storage.
// ---------------------------------------------------------------------
export async function markBuildFailed(
  buildId: string,
  errorMessage: string,
  buildLogUrl: string | null = null,
): Promise<void> {
  await db.query(
    `UPDATE apk_builds
        SET build_status   = 'failed',
            error_message  = $2,
            build_log_url  = COALESCE($3, build_log_url),
            completed_at   = NOW()
      WHERE build_id = $1`,
    [buildId, errorMessage, buildLogUrl],
  );
}
