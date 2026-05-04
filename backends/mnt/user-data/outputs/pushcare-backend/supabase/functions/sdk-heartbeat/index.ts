// supabase/functions/sdk-heartbeat/index.ts
//
// POST /sdk/heartbeat
//
// Highest-QPS endpoint in the system. Every active device pings every
// ~45s. At 5M MAU with ~10% concurrent → ~11k req/s sustained.
//
// Optimizations:
//   * No DB read except the RPC. Trust the device_id.
//   * Single RPC call writes to the partitioned table and (conditionally)
//     bumps last_seen_at.
//   * No body validation beyond the bare minimum — we want to accept and
//     forget.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import {
  errorResponse, jsonResponse, handleOptions, getServiceClient,
  checkRateLimit, extractAppKey, safeJson, v, clientCountry,
} from '../_shared/utils.ts';

interface HeartbeatBody {
  app_key?: string;
  app_id: string;
  device_id: string;
  session_id?: string;
  app_version?: string;
  country_code?: string;
}

serve(async (req) => {
  const opt = handleOptions(req); if (opt) return opt;
  if (req.method !== 'POST') return errorResponse('method_not_allowed', 'POST only', 405);

  const body = await safeJson<HeartbeatBody>(req);
  if (!body) return errorResponse('invalid_json', 'request body must be JSON');

  if (!v.uuid(body.app_id) || !v.uuid(body.device_id))
    return errorResponse('invalid_ids', 'app_id and device_id must be UUIDs');

  const supabase = getServiceClient();

  // Per-device rate limit: max 4 heartbeats / min. Clients are supposed
  // to send every 45s; anything beating that pace is misbehaving.
  const ok = await checkRateLimit(supabase, `hb:${body.device_id}`, 4, 60);
  if (!ok) {
    // Don't error out — just no-op so the SDK doesn't retry storm.
    return jsonResponse({ ok: true, throttled: true });
  }

  const country = clientCountry(req, body);

  const { error } = await supabase.rpc('sdk_record_heartbeat', {
    p_app_id:      body.app_id,
    p_device_id:   body.device_id,
    p_session_id:  body.session_id ?? null,
    p_country:     country,
    p_app_version: body.app_version ?? null,
  });

  if (error) {
    // Heartbeats are best-effort. We don't fail the client.
    console.error('heartbeat_error', error);
    return jsonResponse({ ok: true, ack: false });
  }

  return jsonResponse({ ok: true });
});
