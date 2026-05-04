// supabase/functions/push-track/index.ts
//
// POST /push/track
//
// SDK reports back when a push is:
//   - delivered  (FCM onMessageReceived fired)
//   - opened     (user tapped notification)
//   - clicked    (user tapped a notification action / link)
//
// Public endpoint, but limited to known device_ids; we don't authenticate
// with app_key here because the notification_id itself is unguessable
// (UUID v4) and only valid for the device that received it.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import {
  errorResponse, jsonResponse, handleOptions, getServiceClient,
  checkRateLimit, safeJson, v,
} from '../_shared/utils.ts';

interface TrackBody {
  notification_id: string;
  device_id: string;
  event: 'delivered' | 'opened' | 'clicked';
}

const VALID_EVENTS = new Set(['delivered', 'opened', 'clicked']);

serve(async (req) => {
  const opt = handleOptions(req); if (opt) return opt;
  if (req.method !== 'POST') return errorResponse('method_not_allowed', 'POST only', 405);

  const body = await safeJson<TrackBody>(req);
  if (!body) return errorResponse('invalid_json', 'request body must be JSON');
  if (!v.uuid(body.notification_id) || !v.uuid(body.device_id))
    return errorResponse('invalid_ids', 'IDs must be UUIDs');
  if (!VALID_EVENTS.has(body.event))
    return errorResponse('invalid_event', 'event must be delivered|opened|clicked');

  const supabase = getServiceClient();

  // 60 events / device / min — generous for tap-spammers.
  const ok = await checkRateLimit(supabase, `track:${body.device_id}`, 60, 60);
  if (!ok) return jsonResponse({ ok: true, throttled: true });

  const { error } = await supabase.rpc('push_record_engagement', {
    p_notification_id: body.notification_id,
    p_device_id:       body.device_id,
    p_event:           body.event,
  });

  if (error) {
    console.error('track_error', error);
    return jsonResponse({ ok: true, ack: false }); // don't fail SDK retries
  }

  return jsonResponse({ ok: true });
});
