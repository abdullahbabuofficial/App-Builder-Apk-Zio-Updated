// supabase/functions/push-send/index.ts
//
// POST /push/send
//
// This is the SERVER-TO-SERVER endpoint authed with `Authorization:
// Bearer sk_live_<...>`. It does *not* send the push synchronously
// (FCM batching at scale needs a long-lived worker). It:
//
//   1. Validates the API key and scope.
//   2. Inserts an `app_push_notifications` row in status='queued'.
//   3. Returns immediately with notification_id.
//
// The Firebase dispatcher (firebase-service/) picks up queued rows,
// targets subscribers, sends batches to FCM, records deliveries.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import {
  errorResponse, jsonResponse, handleOptions, getServiceClient,
  checkRateLimit, safeJson, v, sha256, toBytea,
} from '../_shared/utils.ts';

interface SendBody {
  app_id: string;
  title: string;
  body: string;
  image_url?: string;
  click_action_url?: string;
  data?: Record<string, string>;        // FCM data payload — strings only
  target_type?: 'all' | 'active' | 'country' | 'device_list';
  target_countries?: string[];
  target_device_ids?: string[];
  active_window_min?: number;
  scheduled_at?: string;                // ISO; null = send immediately
}

serve(async (req) => {
  const opt = handleOptions(req); if (opt) return opt;
  if (req.method !== 'POST') return errorResponse('method_not_allowed', 'POST only', 405);

  // ---- Auth ---------------------------------------------------------
  const auth = req.headers.get('authorization') ?? '';
  const m = auth.match(/^Bearer\s+(sk_(?:live|test)_[A-Za-z0-9]{32,})$/);
  if (!m) return errorResponse('missing_api_key', 'Authorization: Bearer sk_... required', 401);

  const apiKey = m[1];
  const supabase = getServiceClient();

  const keyHash = await sha256(apiKey);
  const { data: keyRow, error: keyErr } = await supabase
    .from('api_keys')
    .select('key_id, owner_id, app_id, scopes, rate_limit_rpm, is_active, expires_at')
    .eq('key_hash', toBytea(keyHash))
    .single();

  if (keyErr || !keyRow || !keyRow.is_active)
    return errorResponse('invalid_api_key', 'API key invalid or revoked', 401);
  if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date())
    return errorResponse('expired_api_key', 'API key expired', 401);
  if (!keyRow.scopes.includes('push:send'))
    return errorResponse('insufficient_scope', 'key lacks push:send', 403);

  // Per-key rate limit (configurable per-key).
  const ok = await checkRateLimit(
    supabase, `apikey:${keyRow.key_id}`, keyRow.rate_limit_rpm ?? 600, 60,
  );
  if (!ok) return errorResponse('rate_limited', 'API key over rate limit', 429);

  // ---- Body validation ---------------------------------------------
  const body = await safeJson<SendBody>(req);
  if (!body) return errorResponse('invalid_json', 'request body must be JSON');
  if (!v.uuid(body.app_id))
    return errorResponse('invalid_app_id', 'app_id must be a UUID');
  if (!v.str(1, 256)(body.title))
    return errorResponse('invalid_title', 'title 1..256 chars');
  if (!v.str(1, 2048)(body.body))
    return errorResponse('invalid_body', 'body 1..2048 chars');

  // The key must be scoped to this app (or be an owner-wide key).
  if (keyRow.app_id && keyRow.app_id !== body.app_id)
    return errorResponse('app_mismatch', 'API key not scoped to this app', 403);

  // Verify ownership.
  const { data: app } = await supabase
    .from('android_apps')
    .select('app_id, status, owner_id')
    .eq('app_id', body.app_id)
    .single();
  if (!app || app.owner_id !== keyRow.owner_id)
    return errorResponse('app_not_found', 'app not found in your account', 404);
  if (app.status !== 'active')
    return errorResponse('app_suspended', 'app is not active', 403);

  // ---- Targeting ---------------------------------------------------
  const target_type = body.target_type ?? 'all';
  if (target_type === 'country' && (!body.target_countries || body.target_countries.length === 0))
    return errorResponse('missing_countries', 'target_countries required for country targeting');
  if (target_type === 'device_list' && (!body.target_device_ids || body.target_device_ids.length === 0))
    return errorResponse('missing_device_list', 'target_device_ids required');
  if (body.target_device_ids && body.target_device_ids.length > 10000)
    return errorResponse('device_list_too_large', 'use country/segment targeting for >10k devices');

  // ---- Insert campaign --------------------------------------------
  const { data: notif, error: insertErr } = await supabase
    .from('app_push_notifications')
    .insert({
      app_id:            body.app_id,
      owner_id:          keyRow.owner_id,
      title:             body.title,
      body:              body.body,
      image_url:         body.image_url ?? null,
      click_action_url:  body.click_action_url ?? null,
      data_payload:      body.data ?? {},
      target_type,
      target_countries:  body.target_countries ?? null,
      target_device_ids: body.target_device_ids ?? null,
      active_window_min: body.active_window_min ?? 1440,
      scheduled_at:      body.scheduled_at ?? null,
      status:            body.scheduled_at ? 'queued' : 'queued',
    })
    .select('notification_id, status, scheduled_at')
    .single();

  if (insertErr) {
    console.error('push_insert_error', insertErr);
    return errorResponse('queue_failed', 'could not queue push', 500);
  }

  // Update last_used on the API key (best-effort, don't block).
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('key_id', keyRow.key_id)
    .then(() => {}, () => {});

  return jsonResponse({
    ok: true,
    notification_id: notif.notification_id,
    status: notif.status,
    scheduled_at: notif.scheduled_at,
  }, 202);
});
