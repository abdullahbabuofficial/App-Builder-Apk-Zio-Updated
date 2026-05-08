// supabase/functions/sdk-register-device/index.ts
//
// POST /sdk/register-device
//
// Used when:
//   - SDK gets a fresh FCM token (Firebase rotates them).
//   - SDK has device_id from previous init and just needs to refresh
//     attributes / re-attach a token.
//
// Differs from /sdk/init in that the SDK already has a device_id, so we
// skip the install_hash dance.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import {
  errorResponse, jsonResponse, handleOptions, getServiceClient,
  checkRateLimit, extractAppKey, safeJson, v,
} from '../_shared/utils.ts';

interface RegisterBody {
  app_key?: string;
  device_id: string;
  fcm_token: string;
}

serve(async (req) => {
  const opt = handleOptions(req); if (opt) return opt;
  if (req.method !== 'POST') return errorResponse('method_not_allowed', 'POST only', 405);

  const body = await safeJson<RegisterBody>(req);
  if (!body) return errorResponse('invalid_json', 'request body must be JSON');

  const app_key = extractAppKey(req, body);
  if (!app_key) return errorResponse('missing_app_key', 'app_key required', 401);
  if (!v.uuid(body.device_id))
    return errorResponse('invalid_device_id', 'device_id must be a UUID');
  if (!v.str(20, 4096)(body.fcm_token))
    return errorResponse('invalid_token', 'fcm_token too short');

  const supabase = getServiceClient();

  const ok = await checkRateLimit(supabase, `register:${body.device_id}`, 10, 60);
  if (!ok) return errorResponse('rate_limited', 'too many registrations', 429);

  // Validate that device_id belongs to the app behind this app_key.
  const { data: app } = await supabase
    .from('android_apps')
    .select('app_id, status')
    .eq('app_key', app_key)
    .single();

  if (!app) return errorResponse('invalid_app_key', 'app_key not recognized', 401);
  if (app.status !== 'active') return errorResponse('app_suspended', 'app is not active', 403);

  const { data: device } = await supabase
    .from('app_devices')
    .select('device_id')
    .eq('device_id', body.device_id)
    .eq('app_id', app.app_id)
    .single();

  if (!device) return errorResponse('device_not_found', 'unknown device', 404);

  // Upsert subscriber row. ON CONFLICT (app_id, token_hash) handles
  // dedupe; if the same token already exists for another device (rare:
  // FCM sometimes hands the same token to the same physical device
  // across reinstalls), it gets re-pointed at the new device_id.
  const { error: upsertErr } = await supabase
    .from('app_subscribers')
    .upsert(
      {
        app_id:    app.app_id,
        device_id: body.device_id,
        fcm_token: body.fcm_token,
        is_valid:  true,
        invalid_reason: null,
        last_validated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'app_id,token_hash', ignoreDuplicates: false },
    );

  if (upsertErr) {
    console.error('subscriber_upsert_error', upsertErr);
    return errorResponse('register_failed', 'register failed', 500);
  }

  // Touch last_seen so this device shows up as "active".
  await supabase
    .from('app_devices')
    .update({ last_seen_at: new Date().toISOString(), is_active: true })
    .eq('device_id', body.device_id);

  return jsonResponse({ ok: true, device_id: body.device_id });
});
