// supabase/functions/_shared/utils.ts
//
// Shared helpers for every Edge Function. Keep this file dependency-light
// — Edge Functions cold-start on Deno, and every extra import slows boot.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-pc-app-key, x-pc-device-id, x-pc-signature',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  });
}

export function errorResponse(code: string, message: string, status = 400): Response {
  return jsonResponse({ ok: false, error: { code, message } }, status);
}

export function handleOptions(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }
  return null;
}

// ---------------------------------------------------------------------
// Singleton Supabase client. Re-using one instance across invocations
// keeps the WS pool warm.
// ---------------------------------------------------------------------
let _client: SupabaseClient | null = null;
export function getServiceClient(): SupabaseClient {
  if (_client) return _client;
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('missing_supabase_env');
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-pc-source': 'edge' } },
  });
  return _client;
}

// ---------------------------------------------------------------------
// Rate limiting — calls the SQL function `check_rate_limit`.
// Returns true if request is allowed, false if blocked.
// ---------------------------------------------------------------------
export async function checkRateLimit(
  supabase: SupabaseClient,
  bucketKey: string,
  limit: number,
  windowSec = 60,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_bucket_key: bucketKey,
    p_limit: limit,
    p_window_sec: windowSec,
  });
  if (error) {
    // Fail-open on rate-limiter errors — better than dropping legitimate
    // traffic. We log to Sentry separately.
    console.error('rate_limit_error', error);
    return true;
  }
  return data === true;
}

// ---------------------------------------------------------------------
// Resolve the SDK app_key from the request. Accepts either an
// X-PC-App-Key header (preferred — keeps it out of body logs) or a
// JSON body field.
// ---------------------------------------------------------------------
export function extractAppKey(req: Request, body: Record<string, unknown> | null): string | null {
  const h = req.headers.get('x-pc-app-key');
  if (h && /^pk_[a-f0-9]{48}$/.test(h)) return h;
  const b = body?.app_key;
  if (typeof b === 'string' && /^pk_[a-f0-9]{48}$/.test(b)) return b;
  return null;
}

// ---------------------------------------------------------------------
// Hash a string with SHA-256 → bytea-compatible Uint8Array.
// Used for install_hash.
// ---------------------------------------------------------------------
export async function sha256(input: string): Promise<Uint8Array> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return new Uint8Array(digest);
}

// PostgreSQL bytea representation expected by PostgREST when sending hex.
export function toBytea(bytes: Uint8Array): string {
  return '\\x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------
// Best-effort parse — returns null on bad JSON instead of throwing.
// ---------------------------------------------------------------------
export async function safeJson<T = Record<string, unknown>>(req: Request): Promise<T | null> {
  try {
    const text = await req.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------
// Lightweight schema validator — a third of zod's API, none of the bundle.
// ---------------------------------------------------------------------
type Validator<T> = (v: unknown) => v is T;

export const v = {
  str: (min = 1, max = 4096) =>
    ((x: unknown): x is string =>
      typeof x === 'string' && x.length >= min && x.length <= max) as Validator<string>,
  uuid: ((x: unknown): x is string =>
    typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x)) as Validator<string>,
  optStr: ((x: unknown): x is string | undefined =>
    x === undefined || typeof x === 'string') as Validator<string | undefined>,
  obj: ((x: unknown): x is Record<string, unknown> =>
    typeof x === 'object' && x !== null && !Array.isArray(x)) as Validator<Record<string, unknown>>,
};

// ---------------------------------------------------------------------
// Resolve client country from Cloudflare/Supabase headers (Supabase
// proxies CF headers through in production). Falls back to body.
// ---------------------------------------------------------------------
export function clientCountry(req: Request, body?: Record<string, unknown> | null): string | null {
  const cc = req.headers.get('cf-ipcountry') ?? req.headers.get('x-vercel-ip-country');
  if (cc && /^[A-Z]{2}$/.test(cc)) return cc;
  const b = body?.country_code;
  if (typeof b === 'string' && /^[A-Za-z]{2}$/.test(b)) return b.toUpperCase();
  return null;
}
