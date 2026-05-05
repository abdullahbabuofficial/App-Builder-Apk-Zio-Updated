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

const DEFAULT_TIMEOUT_MS = 28_000;

/** Optional Bearer for production APIs (e.g. validate Supabase JWT). Set from PushcareProvider in REST mode. */
let restAccessToken: string | null = null;

export function setPushcareRestAccessToken(token: string | null): void {
  restAccessToken = token;
}

/** Custom Error subclass that carries the HTTP status from a failed REST call. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(`Invalid JSON (${res.status})`, res.status);
  }
  if (!res.ok) {
    const msg =
      typeof data === "object" && data && "error" in data
        ? String((data as { error?: { message?: string } }).error?.message ?? res.statusText)
        : res.statusText;
    throw new ApiError(msg || `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

/** Exposed for sibling lib modules (lib/segments, lib/webhooks, …). */
export { parseJson };

/** True when a response means "endpoint not implemented" — used by REST helpers
 * that gracefully fall back to mock-mode when the local-api hasn't shipped a
 * route yet. */
export function isApiNotFound(err: unknown): boolean {
  if (err instanceof ApiError) return err.status === 404 || err.status === 501;
  if (!(err instanceof Error)) return false;
  const m = err.message.toLowerCase();
  return m.includes("404") || m.includes("not found") || m.includes("not implemented");
}

function apiPath(path: string): string {
  return `${PUSHCARE_API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!PUSHCARE_API_URL) {
    throw new Error("VITE_PUSHCARE_API_URL is not set");
  }

  const headers = new Headers(init?.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (restAccessToken) headers.set("Authorization", `Bearer ${restAccessToken}`);

  const method = (init?.method ?? "GET").toUpperCase();
  const allowRetry = method === "GET" || method === "HEAD";

  const runOnce = async (): Promise<Response> => {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      return await fetch(apiPath(path), {
        ...init,
        headers,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(tid);
    }
  };

  try {
    let res = await runOnce();
    if (allowRetry && res.status >= 500) {
      await new Promise((r) => setTimeout(r, 400));
      res = await runOnce();
    }
    return res;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error(`Request timed out (${DEFAULT_TIMEOUT_MS / 1000}s): ${path}`);
    }
    if (e instanceof TypeError) {
      throw new Error(`Network error — check API URL, VPN, and CORS: ${path}`);
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
}

export async function fetchApps(): Promise<AndroidApp[]> {
  const res = await apiFetch("/api/apps");
  const data = await parseJson<{ ok?: boolean; apps: AndroidApp[] }>(res);
  return data.apps;
}

export async function fetchCampaigns(): Promise<Campaign[]> {
  const res = await apiFetch("/api/campaigns");
  const data = await parseJson<{ campaigns: Campaign[] }>(res);
  return data.campaigns;
}

export async function fetchApiKeys(): Promise<ApiKey[]> {
  const res = await apiFetch("/api/api-keys");
  const data = await parseJson<{ api_keys: ApiKey[] }>(res);
  return data.api_keys;
}

export async function fetchBuilds(): Promise<ApkBuild[]> {
  const res = await apiFetch("/api/builds");
  const data = await parseJson<{ builds: ApkBuild[] }>(res);
  return data.builds;
}

export async function fetchDevices(appId: string): Promise<Device[]> {
  const res = await apiFetch(`/api/apps/${encodeURIComponent(appId)}/devices`);
  const data = await parseJson<{ devices: Device[] }>(res);
  return data.devices;
}

export async function fetchSubscribers(appId: string): Promise<Subscriber[]> {
  const res = await apiFetch(`/api/apps/${encodeURIComponent(appId)}/subscribers`);
  const data = await parseJson<{ subscribers: Subscriber[] }>(res);
  return data.subscribers;
}

export async function fetchAnalyticsOverview(seed = "global"): Promise<AnalyticsOverview> {
  const q = new URLSearchParams({ seed });
  const res = await apiFetch(`/api/analytics/overview?${q}`);
  return parseJson<AnalyticsOverview>(res);
}

export async function postCampaign(body: CreateCampaignInput): Promise<Campaign> {
  const headers = new Headers({ "content-type": "application/json" });
  const res = await apiFetch("/api/campaigns", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await parseJson<{ campaign: Campaign }>(res);
  return data.campaign;
}
