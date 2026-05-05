// supabase/functions/sdk-event/index.ts
//
// POST /sdk/event
//
// Accepts a single event OR a batch of up to 100. SDK should buffer and
// flush in batches to keep network usage down.
//
// Batch format takes precedence — if `events` array is present, single-
// event fields are ignored.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import {
  errorResponse, jsonResponse, handleOptions, getServiceClient,
  checkRateLimit, safeJson, v, clientCountry,
} from '../_shared/utils.ts';

interface EventLike {
  event_name: string;
  event_params?: Record<string, unknown>;
  occurred_at?: string;
  session_id?: string;
  app_version?: string;
}

interface EventBody extends Partial<EventLike> {
  app_id: string;
  device_id: string;
  events?: EventLike[];
  country_code?: string;
}

const MAX_BATCH = 100;
const MAX_NAME_LEN = 64;
const MAX_PARAMS_BYTES = 4096;

serve(async (req) => {
  const opt = handleOptions(req); if (opt) return opt;
  if (req.method !== 'POST') return errorResponse('method_not_allowed', 'POST only', 405);

  const body = await safeJson<EventBody>(req);
  if (!body) return errorResponse('invalid_json', 'request body must be JSON');

  if (!v.uuid(body.app_id) || !v.uuid(body.device_id))
    return errorResponse('invalid_ids', 'app_id and device_id must be UUIDs');

  // Normalize to an array.
  const events: EventLike[] = Array.isArray(body.events)
    ? body.events
    : body.event_name
      ? [{
          event_name:   body.event_name!,
          event_params: body.event_params,
          occurred_at:  body.occurred_at,
          session_id:   body.session_id,
          app_version:  body.app_version,
        }]
      : [];

  if (events.length === 0)
    return errorResponse('no_events', 'event(s) required');
  if (events.length > MAX_BATCH)
    return errorResponse('batch_too_large', `max ${MAX_BATCH} events per request`);

  // Validate each event upfront — cheaper than failing inside the RPC loop.
  for (const e of events) {
    if (!v.str(1, MAX_NAME_LEN)(e.event_name))
      return errorResponse('invalid_event_name', `event_name 1..${MAX_NAME_LEN} chars`);
    if (e.event_params && JSON.stringify(e.event_params).length > MAX_PARAMS_BYTES)
      return errorResponse('params_too_large', `event_params capped at ${MAX_PARAMS_BYTES} bytes`);
  }

  const supabase = getServiceClient();

  // Per-device limit: 600 events/min ≈ 10/s sustained. Plenty for normal
  // apps; abusive ones get clipped.
  const ok = await checkRateLimit(supabase, `ev:${body.device_id}`, 600, 60);
  if (!ok) return errorResponse('rate_limited', 'too many events', 429);

  const country = clientCountry(req, body);

  // Fan-out via RPC. We could insert directly into the partitioned
  // table, but the function gives us a clean place to enforce future
  // rules (PII redaction, etc).
  const results = await Promise.allSettled(
    events.map((e) =>
      supabase.rpc('sdk_record_event', {
        p_app_id:      body.app_id,
        p_device_id:   body.device_id,
        p_session_id:  e.session_id ?? null,
        p_event_name:  e.event_name,
        p_params:      e.event_params ?? {},
        p_country:     country,
        p_app_version: e.app_version ?? null,
        p_occurred_at: e.occurred_at ?? null,
      }),
    ),
  );

  const accepted = results.filter((r) => r.status === 'fulfilled' && !r.value.error).length;
  const rejected = results.length - accepted;

  if (rejected > 0) {
    console.error('event_partial_failure', { accepted, rejected });
  }

  return jsonResponse({ ok: true, accepted, rejected });
});
