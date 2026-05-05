// supabase/functions/sdk-init/index.ts
//
// POST /sdk/init
//
// Called once per cold-start by the Android SDK. Idempotent on
// (app_key, android_id) — the install_hash is computed here so the
// raw android_id never lands in the database.
//
// On the happy path:
//   1. Verify the app_key shape and resolve the caller's IP.
//   2. Rate-limit per (app_key, ip) — 30 req/min keeps a misconfigured
//      SDK from drowning a single tenant.
//   3. Hash (app_key + ":" + android_id) → install_hash bytea.
//   4. Hand off to the `sdk_init_device` RPC, which does the actual
//      upsert of app_devices + (optionally) app_subscribers.
//
// fcm_token is OPTIONAL — apps without Google Play Services can still
// register a device for analytics; they just won't get pushes until
// they re-init with a token.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import {
  errorResponse, jsonResponse, handleOptions, getServiceClient,
  checkRateLimit, extractAppKey, safeJson, v, sha256, toBytea, clientCountry,
} from '../_shared/utils.ts';

interface InitBody {
  app_key?: string;
  android_id: string;
  fcm_token?: string;
  app_version?: string;
  app_build?: string | number;
  os_version?: string;
  sdk_int?: string | number;
  device_model?: string;
  manufacturer?: string;
  language?: string;
  timezone?: string;
  country_code?: string;
  carrier?: string;
  network_type?: string;
  metadata?: Record<string, unknown>;
}

interface InitRow {
  device_id: string;
  app_id: string;
  subscriber_id: string | null;
  is_new_install: boolean;
}

serve(async (req) => {
  const opt = handleOptions(req); if (opt) return opt;
  if (req.method !== 'POST') return errorResponse('method_not_allowed', 'POST only', 405);

  const body = await safeJson<InitBody>(req);
  if (!body) return errorResponse('invalid_json', 'request body must be JSON');

  const app_key = extractAppKey(req, body);
  if (!app_key) return errorResponse('invalid_app_key', 'app_key required (pk_<48 hex>)', 401);

  if (!v.str(8, 128)(body.android_id))
    return errorResponse('invalid_android_id', 'android_id must be 8..128 chars');

  // fcm_token is optional. If present, it must look like a real FCM token.
  if (body.fcm_token !== undefined && !v.str(20, 4096)(body.fcm_token))
    return errorResponse('invalid_fcm_token', 'fcm_token must be 20..4096 chars');

  const supabase = getServiceClient();

  // Resolve caller IP for the rate-limit bucket. x-forwarded-for is
  // a comma-separated list — the first hop is the originating client.
  const xff = req.headers.get('x-forwarded-for');
  const ip = (xff?.split(',')[0]?.trim()) || req.headers.get('x-real-ip') || 'unknown';

  const ok = await checkRateLimit(supabase, `init:${app_key}:${ip}`, 30, 60);
  if (!ok) return errorResponse('rate_limited', 'too many init calls', 429);

  // install_hash = sha256(app_key + ":" + android_id). Hashing keeps the
  // raw android_id out of the DB while still giving us idempotency.
  const installHash = await sha256(`${app_key}:${body.android_id}`);

  const country = clientCountry(req, body);

  // Build the JSONB attrs blob the RPC expects.
  const p_attrs: Record<string, unknown> = {
    manufacturer: body.manufacturer ?? null,
    model:        body.device_model ?? null,
    os_version:   body.os_version ?? null,
    sdk_int:      body.sdk_int ?? null,
    app_version:  body.app_version ?? null,
    app_build:    body.app_build ?? null,
    language:     body.language ?? null,
    timezone:     body.timezone ?? null,
    country_code: country,
    carrier:      body.carrier ?? null,
    network_type: body.network_type ?? null,
    metadata:     body.metadata ?? {},
  };

  const { data, error } = await supabase.rpc('sdk_init_device', {
    p_app_key:      app_key,
    p_install_hash: toBytea(installHash),
    p_fcm_token:    body.fcm_token ?? null,
    p_attrs,
  });

  if (error) {
    // The plpgsql function raises 'invalid_app_key' / 'app_suspended'
    // as exceptions with the code in the message. Map them to HTTP.
    const msg = error.message ?? '';
    if (msg.includes('invalid_app_key'))
      return errorResponse('invalid_app_key', 'app_key not recognized', 401);
    if (msg.includes('app_suspended'))
      return errorResponse('app_suspended', 'app is not active', 403);

    console.error('sdk_init_error', error);
    return errorResponse('internal', 'init failed', 500);
  }

  // RPC returns a TABLE, so PostgREST hands back an array. Take row 0.
  const row: InitRow | undefined = Array.isArray(data) ? data[0] : data;
  if (!row || !row.device_id) {
    console.error('sdk_init_empty_result', { data });
    return errorResponse('internal', 'init produced no row', 500);
  }

  return jsonResponse({
    ok: true,
    device_id:      row.device_id,
    app_id:         row.app_id,
    subscriber_id:  row.subscriber_id,
    is_new_install: row.is_new_install,
    heartbeat_interval_sec: 45,
  });
});
