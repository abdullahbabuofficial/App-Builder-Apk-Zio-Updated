/**
 * Maps `apps-stats` Edge Function JSON into dashboard `AnalyticsOverview`.
 *
 * Coverage vs `AnalyticsOverview`:
 * - dailyInstalls: from `app_daily_stats` rows (`new_installs` per day). ✓
 * - hourlyHeartbeats: not exposed by apps-stats (no hourly series in DB rollup here). []
 * - geoBreakdown: not in apps-stats response. []
 * - recentEvents: best-effort from `window.totals` (aggregated push + event counts), not per-event-type. []
 *   When multiple apps are merged, totals and daily series are summed per calendar day.
 */
import type { AnalyticsOverview } from "@/lib/api";
import type { AndroidApp, Campaign, Point } from "@/lib/mock-data";
import { VITE_SUPABASE_ANON_KEY, VITE_SUPABASE_URL } from "@/lib/config";

export type AppsStatsRange = "24h" | "7d" | "30d" | "90d";

type DailyRow = {
  stat_date: string;
  new_installs: number | null;
  active_devices: number | null;
  total_events: number | null;
  total_sessions: number | null;
  push_sent: number | null;
  push_delivered: number | null;
  push_opened: number | null;
  push_clicked: number | null;
};

type WindowTotals = {
  new_installs: number;
  total_events: number;
  push_sent: number;
  push_delivered: number;
  push_opened: number;
  push_clicked: number;
};

type AppsStatsPayload = {
  ok?: boolean;
  window?: {
    range: string;
    totals: WindowTotals;
  };
  daily?: DailyRow[];
};

function functionsBaseUrl(): string {
  const base = VITE_SUPABASE_URL.replace(/\/$/, "");
  return `${base}/functions/v1`;
}

async function fetchAppsStatsForApp(
  accessToken: string,
  appId: string,
  range: AppsStatsRange,
): Promise<AppsStatsPayload> {
  const url = new URL(`${functionsBaseUrl()}/apps-stats`);
  url.searchParams.set("app_id", appId);
  url.searchParams.set("range", range);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: VITE_SUPABASE_ANON_KEY,
      Accept: "application/json",
    },
  });

  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("apps-stats: invalid JSON");
  }

  if (!res.ok) {
    const errObj =
      typeof data === "object" && data && "error" in data
        ? (data as { error?: { message?: string; code?: string } }).error
        : undefined;
    const msg = errObj?.message ?? errObj?.code ?? res.statusText;
    throw new Error(`apps-stats: ${msg}`);
  }

  return data as AppsStatsPayload;
}

function mergeDailyRows(rows: DailyRow[]): Point[] {
  const byDate = new Map<string, number>();
  for (const r of rows) {
    const d = r.stat_date?.slice(0, 10);
    if (!d) continue;
    byDate.set(d, (byDate.get(d) ?? 0) + (r.new_installs ?? 0));
  }
  const sortedDates = [...byDate.keys()].sort();
  return sortedDates.map((d) => ({
    t: Date.UTC(
      Number(d.slice(0, 4)),
      Number(d.slice(5, 7)) - 1,
      Number(d.slice(8, 10)),
    ),
    v: byDate.get(d) ?? 0,
  }));
}

function totalsFromPayload(p: AppsStatsPayload): WindowTotals {
  return (
    p.window?.totals ?? {
      new_installs: 0,
      total_events: 0,
      push_sent: 0,
      push_delivered: 0,
      push_opened: 0,
      push_clicked: 0,
    }
  );
}

function buildRecentEventsFromTotals(t: WindowTotals): AnalyticsOverview["recentEvents"] {
  const rows: AnalyticsOverview["recentEvents"] = [
    {
      id: "rollup-installs",
      name: "New installs (window)",
      count: t.new_installs,
      uniqueDevices: 0,
      deltaPct: 0,
    },
    {
      id: "rollup-events",
      name: "Analytics events (window)",
      count: t.total_events,
      uniqueDevices: 0,
      deltaPct: 0,
    },
    {
      id: "rollup-push-sent",
      name: "Push sent",
      count: t.push_sent,
      uniqueDevices: 0,
      deltaPct: 0,
    },
    {
      id: "rollup-push-delivered",
      name: "Push delivered",
      count: t.push_delivered,
      uniqueDevices: 0,
      deltaPct: 0,
    },
    {
      id: "rollup-push-opened",
      name: "Push opened",
      count: t.push_opened,
      uniqueDevices: 0,
      deltaPct: 0,
    },
    {
      id: "rollup-push-clicked",
      name: "Push clicked",
      count: t.push_clicked,
      uniqueDevices: 0,
      deltaPct: 0,
    },
  ];
  return rows.filter((r) => r.count > 0);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseAnalyticsSeed(
  seed: string,
  apps: AndroidApp[],
  campaigns: Campaign[],
): { appIds: string[]; range: AppsStatsRange } | null {
  const global = /^global-(24h|7d|30d|90d)$/.exec(seed);
  if (global) {
    const r = global[1] as AppsStatsRange;
    return { appIds: apps.map((a) => a.id), range: r };
  }

  const ana = /^ana-(all|[0-9a-f-]{36})-(24h|7d|30d|90d)$/i.exec(seed);
  if (ana) {
    const who = ana[1].toLowerCase();
    const range = ana[2] as AppsStatsRange;
    if (who === "all") return { appIds: apps.map((a) => a.id), range };
    if (UUID_RE.test(who)) return { appIds: [who], range };
    return null;
  }

  if (UUID_RE.test(seed)) {
    if (apps.some((a) => a.id === seed)) return { appIds: [seed], range: "30d" };
    const camp = campaigns.find((c) => c.id === seed);
    if (camp) return { appIds: [camp.app_id], range: "30d" };
  }

  return null;
}

export async function fetchAppsStatsOverview(
  accessToken: string,
  appIds: string[],
  range: AppsStatsRange,
): Promise<AnalyticsOverview> {
  if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY) {
    throw new Error("Supabase URL or anon key not configured");
  }
  if (appIds.length === 0) {
    return {
      dailyInstalls: [],
      hourlyHeartbeats: [],
      geoBreakdown: [],
      recentEvents: [],
    };
  }

  const payloads = await Promise.all(
    appIds.map((id) => fetchAppsStatsForApp(accessToken, id, range)),
  );

  const allDaily: DailyRow[] = [];
  const mergedTotals = {
    new_installs: 0,
    total_events: 0,
    push_sent: 0,
    push_delivered: 0,
    push_opened: 0,
    push_clicked: 0,
  };

  for (const p of payloads) {
    allDaily.push(...(p.daily ?? []));
    const t = totalsFromPayload(p);
    mergedTotals.new_installs += t.new_installs;
    mergedTotals.total_events += t.total_events;
    mergedTotals.push_sent += t.push_sent;
    mergedTotals.push_delivered += t.push_delivered;
    mergedTotals.push_opened += t.push_opened;
    mergedTotals.push_clicked += t.push_clicked;
  }

  return {
    dailyInstalls: mergeDailyRows(allDaily),
    hourlyHeartbeats: [],
    geoBreakdown: [],
    recentEvents: buildRecentEventsFromTotals(mergedTotals),
  };
}
