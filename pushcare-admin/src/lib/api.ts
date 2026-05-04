import { PUSHCARE_API_URL } from "./config";
import type {
  AndroidApp,
  ApiKey,
  ApkBuild,
  Campaign,
  Device,
  Point,
  Subscriber,
} from "./mock-data";

export type CreateCampaignInput = {
  app_id: string;
  title: string;
  body: string;
  image_url?: string | null;
  click_url?: string | null;
  target_type: Campaign["target_type"];
  active_within_minutes?: number;
  country_codes?: string[];
  device_ids?: string[];
  scheduled_at?: string | null;
};

export type AnalyticsOverview = {
  dailyInstalls: Point[];
  hourlyHeartbeats: Point[];
  geoBreakdown: { code: string; name: string; v: number; pct: number }[];
  recentEvents: { id: string; name: string; count: number; uniqueDevices: number; deltaPct: number }[];
};

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Invalid JSON (${res.status})`);
  }
  if (!res.ok) {
    const msg =
      typeof data === "object" && data && "error" in data
        ? String((data as { error?: { message?: string } }).error?.message ?? res.statusText)
        : res.statusText;
    throw new Error(msg);
  }
  return data as T;
}

function url(path: string): string {
  return `${PUSHCARE_API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function fetchApps(): Promise<AndroidApp[]> {
  const res = await fetch(url("/api/apps"));
  const data = await parseJson<{ ok?: boolean; apps: AndroidApp[] }>(res);
  return data.apps;
}

export async function fetchCampaigns(): Promise<Campaign[]> {
  const res = await fetch(url("/api/campaigns"));
  const data = await parseJson<{ campaigns: Campaign[] }>(res);
  return data.campaigns;
}

export async function fetchApiKeys(): Promise<ApiKey[]> {
  const res = await fetch(url("/api/api-keys"));
  const data = await parseJson<{ api_keys: ApiKey[] }>(res);
  return data.api_keys;
}

export async function fetchBuilds(): Promise<ApkBuild[]> {
  const res = await fetch(url("/api/builds"));
  const data = await parseJson<{ builds: ApkBuild[] }>(res);
  return data.builds;
}

export async function fetchDevices(appId: string): Promise<Device[]> {
  const res = await fetch(url(`/api/apps/${encodeURIComponent(appId)}/devices`));
  const data = await parseJson<{ devices: Device[] }>(res);
  return data.devices;
}

export async function fetchSubscribers(appId: string): Promise<Subscriber[]> {
  const res = await fetch(url(`/api/apps/${encodeURIComponent(appId)}/subscribers`));
  const data = await parseJson<{ subscribers: Subscriber[] }>(res);
  return data.subscribers;
}

export async function fetchAnalyticsOverview(seed = "global"): Promise<AnalyticsOverview> {
  const q = new URLSearchParams({ seed });
  const res = await fetch(url(`/api/analytics/overview?${q}`));
  return parseJson<AnalyticsOverview>(res);
}

export async function postCampaign(body: CreateCampaignInput): Promise<Campaign> {
  const res = await fetch(url("/api/campaigns"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await parseJson<{ campaign: Campaign }>(res);
  return data.campaign;
}
