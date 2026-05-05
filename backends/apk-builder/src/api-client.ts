// apk-builder/src/api-client.ts
//
// Fallback transport for local development: when DATABASE_URL is not
// set but LOCAL_API_URL is, the worker talks to backends/local-api
// over HTTP instead of Postgres.
//
// The local-api currently exposes GET /api/builds; PATCH/result endpoints
// may not exist yet — we degrade gracefully (TODO: replace with proper
// claim API once local-api adds it).

import type { ClaimedBuild } from './db.js';
import { logger } from './logger.js';

const LOCAL_API_URL = process.env.LOCAL_API_URL ?? '';

interface RawBuild {
  id: string;
  build_id?: string;
  app_id: string;
  owner_id?: string;
  version_name: string;
  version_code: number;
  build_config?: Record<string, unknown>;
  status?: string;
  build_status?: string;
}

// ---------------------------------------------------------------------
// Poll the next queued build from local-api. Lane 3 may add a
// `?status=` filter; if not, we fetch all and filter client-side.
// ---------------------------------------------------------------------
export async function pollNextBuild(): Promise<ClaimedBuild | null> {
  if (!LOCAL_API_URL) return null;

  const url = `${LOCAL_API_URL}/api/builds?status=queued&limit=1`;
  let resp: Response;
  try {
    resp = await fetch(url);
  } catch (err) {
    logger.warn({ err, url }, 'local_api_fetch_failed');
    return null;
  }
  if (!resp.ok) {
    logger.warn({ status: resp.status, url }, 'local_api_non_ok');
    return null;
  }

  const body = (await resp.json()) as { ok?: boolean; builds?: RawBuild[] };
  const all = body.builds ?? [];
  // Defensive client-side filter — local-api may ignore the query param.
  const candidates = all.filter((b) => {
    const s = b.status ?? b.build_status ?? '';
    return s === 'queued' || s === 'pending';
  });
  const next = candidates[0];
  if (!next) return null;

  const buildId = next.build_id ?? next.id;
  // Atomically PATCH the row to building. If local-api does not support
  // PATCH (404), just proceed — we'll POST the final result later.
  try {
    const patchUrl = `${LOCAL_API_URL}/api/builds/${buildId}`;
    const patch = await fetch(patchUrl, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'building' }),
    });
    if (patch.status === 404) {
      logger.debug({ buildId }, 'local_api_patch_not_implemented');
    } else if (!patch.ok) {
      logger.warn({ status: patch.status, buildId }, 'local_api_patch_failed');
    }
  } catch (err) {
    logger.debug({ err, buildId }, 'local_api_patch_threw');
  }

  return {
    build_id: buildId,
    app_id: next.app_id,
    owner_id: next.owner_id ?? '',
    version_name: next.version_name,
    version_code: next.version_code,
    build_config: next.build_config ?? {},
  };
}

// ---------------------------------------------------------------------
// Post a successful build result. If endpoint does not exist, log and
// skip so the worker keeps draining the queue.
// ---------------------------------------------------------------------
export async function markBuildSucceeded(
  buildId: string,
  apkUrl: string,
  apkSizeBytes: number,
  apkSha256: string,
): Promise<void> {
  await postResult(buildId, {
    status: 'succeeded',
    apk_url: apkUrl,
    apk_size_bytes: apkSizeBytes,
    apk_sha256: apkSha256,
  });
}

// ---------------------------------------------------------------------
// Post a failed build result.
// ---------------------------------------------------------------------
export async function markBuildFailed(
  buildId: string,
  errorMessage: string,
): Promise<void> {
  await postResult(buildId, {
    status: 'failed',
    error_message: errorMessage,
  });
}

async function postResult(buildId: string, payload: Record<string, unknown>): Promise<void> {
  if (!LOCAL_API_URL) return;
  const url = `${LOCAL_API_URL}/api/builds/${buildId}/result`;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (resp.status === 404) {
      logger.warn({ buildId }, 'local_api_result_endpoint_missing');
      return;
    }
    if (!resp.ok) {
      logger.warn({ status: resp.status, buildId }, 'local_api_post_result_failed');
    }
  } catch (err) {
    logger.warn({ err, buildId }, 'local_api_post_result_threw');
  }
}
