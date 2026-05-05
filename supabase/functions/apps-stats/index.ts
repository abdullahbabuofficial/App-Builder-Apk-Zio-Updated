// supabase/functions/apps-stats/index.ts
//
// GET /apps/stats?app_id=<uuid>&range=7d
//
// Returns aggregate stats for one app over a window. Reads from the
// `app_daily_stats` rollup + `mv_app_live_users` for now-values.
//
// Authed via the dashboard JWT (Supabase auth). RLS enforces ownership.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { errorResponse, jsonResponse, handleOptions, CORS, v } from '../_shared/utils.ts';

const RANGES: Record<string, number> = { '24h': 1, '7d': 7, '30d': 30, '90d': 90 };

serve(async (req) => {
  const opt = handleOptions(req); if (opt) return opt;
  if (req.method !== 'GET') return errorResponse('method_not_allowed', 'GET only', 405);

  const auth = req.headers.get('authorization');
  if (!auth) return errorResponse('unauthorized', 'Bearer token required', 401);

  // Use the caller's JWT so RLS scopes the query to their owner_id.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } }, auth: { persistSession: false } },
  );

  const url = new URL(req.url);
  const appId = url.searchParams.get('app_id');
  const range = url.searchParams.get('range') ?? '7d';

  if (!appId || !v.uuid(appId))
    return errorResponse('invalid_app_id', 'app_id must be a UUID');
  if (!RANGES[range])
    return errorResponse('invalid_range', `range must be one of: ${Object.keys(RANGES).join(',')}`);

  const days = RANGES[range];
  const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);

  // Daily rollup (RLS filters by owner_id automatically).
  const { data: daily, error: dErr } = await supabase
    .from('app_daily_stats')
    .select('stat_date, new_installs, active_devices, total_events, total_sessions, push_sent, push_delivered, push_opened, push_clicked')
    .eq('app_id', appId)
    .gte('stat_date', since)
    .order('stat_date', { ascending: true });

  if (dErr) {
    console.error('stats_daily_error', dErr);
    return errorResponse('stats_failed', 'could not load stats', 500);
  }

  // Now-values (live and 1h/24h MAU).
  const { data: live } = await supabase
    .from('mv_app_live_users')
    .select('live_5m, active_1h, active_24h')
    .eq('app_id', appId)
    .maybeSingle();

  const { data: app } = await supabase
    .from('v_my_apps')
    .select('total_installs, active_installs, total_uninstalls, live_users, counters_synced_at')
    .eq('app_id', appId)
    .maybeSingle();

  if (!app) return errorResponse('app_not_found', 'app not found', 404);

  // Derive totals over window.
  const totals = (daily ?? []).reduce(
    (acc, r) => ({
      new_installs: acc.new_installs + (r.new_installs ?? 0),
      total_events: acc.total_events + (r.total_events ?? 0),
      push_sent:    acc.push_sent    + (r.push_sent ?? 0),
      push_delivered: acc.push_delivered + (r.push_delivered ?? 0),
      push_opened:  acc.push_opened  + (r.push_opened ?? 0),
      push_clicked: acc.push_clicked + (r.push_clicked ?? 0),
    }),
    { new_installs: 0, total_events: 0, push_sent: 0, push_delivered: 0, push_opened: 0, push_clicked: 0 },
  );

  return new Response(
    JSON.stringify({
      ok: true,
      app: {
        app_id: appId,
        total_installs:   app.total_installs,
        active_installs:  app.active_installs,
        total_uninstalls: app.total_uninstalls,
        counters_synced_at: app.counters_synced_at,
      },
      now: {
        live_users:  live?.live_5m ?? app.live_users ?? 0,
        active_1h:   live?.active_1h ?? 0,
        active_24h:  live?.active_24h ?? 0,
      },
      window: { range, totals },
      daily: daily ?? [],
    }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'private, max-age=30',
        ...CORS,
      },
    },
  );
});
