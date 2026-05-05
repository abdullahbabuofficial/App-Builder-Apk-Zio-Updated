// supabase/functions/webhook-deliver/index.ts
//
// POST /webhook-deliver
//
// Worker-style endpoint that posts a signed event to a customer-defined
// webhook_endpoints URL. Called by:
//   - the dispatcher / cron job that drains the outbound webhook queue
//   - the dashboard "test fire" button
//
// Auth: service-role bearer only (this is internal). Reject otherwise so
// a leaked dashboard JWT can't pivot into outbound HTTP from our infra.
//
// Behavior:
//   1. Validate input + auth.
//   2. Load webhook_endpoints row. If !is_active → silently skip
//      (no delivery row recorded — we drop disabled endpoints).
//   3. HMAC-SHA256 sign the payload with the endpoint's signing secret.
//   4. POST with up to 3 attempts and exp. backoff (250/500/1000ms).
//      Stop on 4xx (don't retry). Retry on 5xx and network errors.
//   5. Record the final outcome via record_webhook_delivery RPC, with
//      response body truncated to 2 KB.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import {
  errorResponse, jsonResponse, handleOptions, getServiceClient,
  safeJson, v,
} from '../_shared/utils.ts';

interface DeliverBody {
  endpoint_id: string;
  event_type: string;
  payload: Record<string, unknown>;
}

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [250, 500, 1000];
const TIMEOUT_MS = 10_000;
const BODY_LIMIT = 2048;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  return toHex(new Uint8Array(sig));
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n);
}

async function attemptPost(
  url: string,
  headers: Record<string, string>,
  body: string,
): Promise<{ status: number; responseBody: string; networkError: boolean }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: ctrl.signal,
    });
    let responseBody = '';
    try {
      responseBody = truncate(await res.text(), BODY_LIMIT);
    } catch {
      responseBody = '';
    }
    return { status: res.status, responseBody, networkError: false };
  } catch (e) {
    return {
      status: 0,
      responseBody: truncate(String((e as Error)?.message ?? e), BODY_LIMIT),
      networkError: true,
    };
  } finally {
    clearTimeout(timer);
  }
}

serve(async (req) => {
  const opt = handleOptions(req); if (opt) return opt;
  if (req.method !== 'POST') return errorResponse('method_not_allowed', 'POST only', 405);

  // ---- Service-role auth ------------------------------------------
  const auth = req.headers.get('authorization') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey || auth !== `Bearer ${serviceKey}`) {
    return errorResponse('unauthorized', 'service-role bearer required', 401);
  }

  // ---- Body validation --------------------------------------------
  const body = await safeJson<DeliverBody>(req);
  if (!body) return errorResponse('invalid_json', 'request body must be JSON');
  if (!v.uuid(body.endpoint_id))
    return errorResponse('invalid_endpoint_id', 'endpoint_id must be a UUID');
  if (!v.str(1, 200)(body.event_type))
    return errorResponse('invalid_event_type', 'event_type 1..200 chars');
  if (!v.obj(body.payload))
    return errorResponse('invalid_payload', 'payload must be an object');

  const supabase = getServiceClient();

  // ---- Load endpoint ---------------------------------------------
  const { data: endpoint, error: epErr } = await supabase
    .from('webhook_endpoints')
    .select('endpoint_id, url, signing_secret, is_active')
    .eq('endpoint_id', body.endpoint_id)
    .maybeSingle();

  if (epErr) {
    console.error('webhook_endpoint_lookup_error', epErr);
    return errorResponse('lookup_failed', 'could not load endpoint', 500);
  }
  if (!endpoint) return errorResponse('endpoint_not_found', 'unknown endpoint', 404);
  if (!endpoint.is_active) {
    return jsonResponse({ ok: true, skipped: true, reason: 'inactive' });
  }

  // ---- Build signed request --------------------------------------
  // TODO(prod): per-endpoint plaintext signing keys belong in a vault
  // (Supabase Vault, AWS KMS, etc.). The DB column today stores a
  // sha256 hash of the secret, which is one-way — receivers can't
  // verify with it. Until the migration to vault-backed secrets
  // lands, we use the bytea column as the raw HMAC key (same bytes
  // both sides, stable, but not zero-knowledge against a DB read).
  const signingKey = String(endpoint.signing_secret ?? '');
  if (!signingKey) {
    return errorResponse('missing_signing_secret', 'endpoint has no signing secret', 500);
  }

  const deliveryId = crypto.randomUUID();
  const timestamp = Math.floor(Date.now() / 1000);
  const envelope = JSON.stringify({
    id: deliveryId,
    event_type: body.event_type,
    payload: body.payload,
    timestamp,
  });
  const sig = await hmacSha256Hex(signingKey, JSON.stringify(body.payload));

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-pushcare-event': body.event_type,
    'x-pushcare-signature': `t=${timestamp},v1=${sig}`,
    'x-pushcare-delivery-id': deliveryId,
    'user-agent': 'PushCare-Webhook/1.0',
  };

  // ---- Attempt with retries --------------------------------------
  let attempts = 0;
  let lastStatus = 0;
  let lastBody = '';
  let succeeded = false;

  while (attempts < MAX_ATTEMPTS) {
    attempts += 1;
    const res = await attemptPost(endpoint.url, headers, envelope);
    lastStatus = res.status;
    lastBody = res.responseBody;

    if (!res.networkError && res.status >= 200 && res.status < 300) {
      succeeded = true;
      break;
    }
    // 4xx → terminal, don't retry.
    if (!res.networkError && res.status >= 400 && res.status < 500) {
      break;
    }
    // 5xx or network → retry if attempts left.
    if (attempts < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, BACKOFF_MS[attempts - 1]));
    }
  }

  // ---- Record delivery -------------------------------------------
  const { error: recErr } = await supabase.rpc('record_webhook_delivery', {
    p_endpoint_id: body.endpoint_id,
    p_event_type: body.event_type,
    p_payload: body.payload,
    p_response_status: lastStatus,
    p_response_body: lastBody,
    p_attempt_count: attempts,
  });
  if (recErr) console.error('webhook_record_error', recErr);

  return jsonResponse({
    ok: true,
    succeeded,
    attempts,
    status: lastStatus,
  });
});
