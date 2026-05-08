import { APKZIO_ADMIN_API_KEY, APKZIO_API_URL } from "./config";
import type {
  AndroidApp,
  ApiKey,
  ApkBuild,
  AppStatus,
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

export type CreateAppInput = {
  name: string;
  package_name: string;
  fcm_project_id?: string | null;
  icon_glyph?: string;
  icon_color?: string;
};

export type UpdateAppInput = Partial<{
  name: string;
  status: AppStatus;
  fcm_project_id: string | null;
  icon_glyph: string;
  icon_color: string;
}>;

export type CreateApiKeyInput = {
  app_id: string;
  name: string;
  scopes: string[];
  rate_limit_rpm: number;
  expires_at?: string | null;
  environment?: "live" | "test";
};

export type UpdateApiKeyInput = Partial<{
  is_active: boolean;
  name: string;
  scopes: string[];
  rate_limit_rpm: number;
  expires_at: string | null;
}>;

export type CreateBuildInput = {
  app_id: string;
  version_code: number;
  version_name: string;
  branch?: string;
  release_notes?: string;
  // ---- Optional WebView Builder config ----
  // The local-api fills in sensible defaults derived from the parent app row
  // when these are omitted, so callers can supply only the fields they care
  // about. See `WebViewBuildConfig` in `mock-data.ts` for the resolved shape.
  app_name?: string;
  package_name?: string;
  start_url?: string;
  primary_color?: string;
  background_color?: string;
  splash_color?: string;
  allow_file_uploads?: boolean;
  allow_geolocation?: boolean;
  allow_camera?: boolean;
  pull_to_refresh?: boolean;
  swipe_back?: boolean;
  offline_message?: string;
};

export type AnalyticsOverview = {
  dailyInstalls: Point[];
  hourlyHeartbeats: Point[];
  geoBreakdown: { code: string; name: string; v: number; pct: number }[];
  recentEvents: { id: string; name: string; count: number; uniqueDevices: number; deltaPct: number }[];
};

const DEFAULT_TIMEOUT_MS = 28_000;

/** Optional Bearer for production APIs (e.g. validate Supabase JWT). Set from ApkzioProvider in REST mode. */
let restAccessToken: string | null = null;

export function setApkzioRestAccessToken(token: string | null): void {
  restAccessToken = token;
}

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

function apiPath(path: string): string {
  return `${APKZIO_API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!APKZIO_API_URL) {
    throw new Error("VITE_APKZIO_API_URL is not set");
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

export async function updateSubscriber(id: string, patch: { is_valid: boolean }): Promise<Subscriber> {
  const res = await apiFetch(`/api/subscribers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: jsonHeaders(),
    body: JSON.stringify(patch),
  });
  const data = await parseJson<{ subscriber: Subscriber }>(res);
  return data.subscriber;
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

function jsonHeaders(): Headers {
  return new Headers({ "content-type": "application/json" });
}

// --- Apps CRUD ---

export async function createApp(input: CreateAppInput): Promise<AndroidApp> {
  const res = await apiFetch("/api/apps", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  });
  const data = await parseJson<{ app: AndroidApp }>(res);
  return data.app;
}

export async function updateApp(id: string, patch: UpdateAppInput): Promise<AndroidApp> {
  const res = await apiFetch(`/api/apps/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: jsonHeaders(),
    body: JSON.stringify(patch),
  });
  const data = await parseJson<{ app: AndroidApp }>(res);
  return data.app;
}

export async function deleteApp(id: string): Promise<void> {
  const res = await apiFetch(`/api/apps/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  await parseJson<{ ok: boolean }>(res);
}

// --- API keys ---

export async function createApiKey(
  input: CreateApiKeyInput,
): Promise<{ api_key: ApiKey; secret: string }> {
  const res = await apiFetch("/api/api-keys", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  });
  const data = await parseJson<{ api_key: ApiKey; secret: string }>(res);
  return { api_key: data.api_key, secret: data.secret };
}

export async function updateApiKey(id: string, patch: UpdateApiKeyInput): Promise<ApiKey> {
  const res = await apiFetch(`/api/api-keys/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: jsonHeaders(),
    body: JSON.stringify(patch),
  });
  const data = await parseJson<{ api_key: ApiKey }>(res);
  return data.api_key;
}

export async function revokeApiKey(id: string): Promise<ApiKey> {
  const res = await apiFetch(`/api/api-keys/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const data = await parseJson<{ api_key: ApiKey }>(res);
  return data.api_key;
}

// --- Builds ---

export async function createBuild(input: CreateBuildInput): Promise<ApkBuild> {
  const res = await apiFetch("/api/builds", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  });
  const data = await parseJson<{ build: ApkBuild }>(res);
  return data.build;
}

export async function fetchBuildLogs(id: string): Promise<string[]> {
  const res = await apiFetch(`/api/builds/${encodeURIComponent(id)}/logs`);
  const data = await parseJson<{ logs: string[] }>(res);
  return data.logs;
}

// --- Campaign actions ---

export async function pauseCampaign(id: string): Promise<Campaign> {
  const res = await apiFetch(`/api/campaigns/${encodeURIComponent(id)}/pause`, {
    method: "POST",
    headers: jsonHeaders(),
  });
  const data = await parseJson<{ campaign: Campaign }>(res);
  return data.campaign;
}

export async function cancelCampaign(id: string): Promise<Campaign> {
  const res = await apiFetch(`/api/campaigns/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    headers: jsonHeaders(),
  });
  const data = await parseJson<{ campaign: Campaign }>(res);
  return data.campaign;
}

export async function duplicateCampaign(id: string): Promise<Campaign> {
  const res = await apiFetch(`/api/campaigns/${encodeURIComponent(id)}/duplicate`, {
    method: "POST",
    headers: jsonHeaders(),
  });
  const data = await parseJson<{ campaign: Campaign }>(res);
  return data.campaign;
}

export async function sendCampaign(id: string): Promise<Campaign> {
  const res = await apiFetch(`/api/campaigns/${encodeURIComponent(id)}/send`, {
    method: "POST",
    headers: jsonHeaders(),
  });
  const data = await parseJson<{ campaign: Campaign }>(res);
  return data.campaign;
}

// --- WordPress plugins (admin Plugins pages) ---

export type WpPluginRange = "rt" | "d" | "w" | "m";

export type WpPlugin = {
  id: string;
  slug: string;
  name: string;
  latest_version: string;
  description?: string;
};

export type WpSiteInstall = {
  id: string;
  plugin_id: string;
  site_url: string;
  wp_version: string;
  plugin_version: string;
  created_at: string;
  last_seen_at: string;
  subscribers_total: number;
};

export type WpRollup = {
  pageviews: number;
  uniques: number;
  subscribers: number;
  active_sites: number;
  installs: number;
};

export async function fetchWpPlugins(range: WpPluginRange = "rt") {
  const q = new URLSearchParams({ range });
  const res = await apiFetch(`/api/wp-plugins?${q}`);
  return parseJson<{
    ok: boolean;
    range: WpPluginRange;
    plugins: Array<{ plugin: WpPlugin; rollup: WpRollup }>;
  }>(res);
}

export async function fetchWpPluginDetail(pluginId: string, range: WpPluginRange = "rt") {
  const q = new URLSearchParams({ range });
  const res = await apiFetch(`/api/wp-plugins/${encodeURIComponent(pluginId)}?${q}`);
  return parseJson<{
    ok: boolean;
    plugin: WpPlugin;
    range: WpPluginRange;
    rollup: WpRollup;
    series_pageviews: Point[];
    series_uniques: Point[];
  }>(res);
}

/** Download the WordPress plugin ZIP for this catalog product (admin auth). */
export async function downloadWpPluginDistributionZip(pluginId: string): Promise<void> {
  const res = await apiFetch(`/api/wp-plugins/${encodeURIComponent(pluginId)}/distribution.zip`);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || res.statusText);
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition");
  let filename = "apkzio-telemetry-wordpress.zip";
  const m = cd?.match(/filename="?([^";]+)"?/i);
  if (m?.[1]) filename = m[1].trim();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function fetchWpPluginSites(
  pluginId: string,
  opts?: { q?: string; limit?: number; offset?: number; include_series?: boolean },
) {
  const q = new URLSearchParams();
  if (opts?.q) q.set("q", opts.q);
  if (opts?.limit != null) q.set("limit", String(opts.limit));
  if (opts?.offset != null) q.set("offset", String(opts.offset));
  if (opts?.include_series) q.set("include_series", "1");
  const res = await apiFetch(`/api/wp-plugins/${encodeURIComponent(pluginId)}/sites?${q}`);
  return parseJson<{
    ok: boolean;
    sites: Array<WpSiteInstall & { sparkline?: Point[] }>;
    total: number;
    limit: number;
    offset: number;
  }>(res);
}

// --- Operator CRM (`/api/admin/*`; optional `VITE_APKZIO_ADMIN_API_KEY`) ---

export type AdminClientAccountStatus = "lead" | "active" | "churned";

export type AdminClientSummary = {
  id: string;
  email: string;
  full_name: string;
  plan: string;
  email_verified: boolean;
  created_at: string;
  last_seen_at: string | null;
  google_linked: boolean;
  apps_count: number;
  builds_count: number;
  active_subscriptions: number;
  lifetime_revenue: number;
  account_status: AdminClientAccountStatus;
};

export type AdminClientAppRow = {
  id: string;
  name: string;
  package_name: string;
  status: string;
  created_at: string;
};

export type AdminClientBuildRow = {
  id: string;
  app_id: string;
  version_name: string;
  version_code: number;
  status: string;
  build_started_at: string;
  build_completed_at: string | null;
};

export type AdminClientDetail = {
  summary: AdminClientSummary;
  profile: {
    id: string;
    email: string;
    full_name: string;
    plan: string;
    email_verified: boolean;
    created_at: string;
    phone?: string | null;
    location?: string | null;
    website?: string | null;
    bio?: string | null;
  };
  apps: AdminClientAppRow[];
  builds: AdminClientBuildRow[];
  subscriptions: Array<{
    id: string;
    plan_name: string;
    status: string;
    started_at: string;
    amount: number;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    status: string;
    method: string;
    created_at: string;
    invoice_id?: string;
  }>;
  invoices: Array<{
    id: string;
    number: string;
    total: number;
    status: string;
    paid_at: string | null;
    created_at: string;
  }>;
  cart: { items_count: number; promo_code: string | null };
  contact_messages: Array<{
    id: string;
    name: string;
    email: string;
    subject: string | null;
    created_at: string;
    topic: string | null;
  }>;
};

function adminHeaders(): Headers {
  const h = new Headers();
  if (APKZIO_ADMIN_API_KEY) h.set("X-Apkzio-Admin-Key", APKZIO_ADMIN_API_KEY);
  return h;
}

export async function fetchAdminClients(params?: {
  q?: string;
  plan?: string;
  status?: AdminClientAccountStatus;
  google_linked?: boolean;
  offset?: number;
  limit?: number;
}): Promise<{ total: number; clients: AdminClientSummary[] }> {
  const sp = new URLSearchParams();
  if (params?.q) sp.set("q", params.q);
  if (params?.plan) sp.set("plan", params.plan);
  if (params?.status) sp.set("status", params.status);
  if (params?.google_linked === true) sp.set("google_linked", "true");
  if (params?.google_linked === false) sp.set("google_linked", "false");
  if (params?.offset != null) sp.set("offset", String(params.offset));
  if (params?.limit != null) sp.set("limit", String(params.limit));
  const qs = sp.toString();
  const path = `/api/admin/clients${qs ? `?${qs}` : ""}`;
  const headers = adminHeaders();
  const res = await apiFetch(path, { headers });
  const data = await parseJson<{ ok?: boolean; total: number; clients: AdminClientSummary[] }>(res);
  return { total: data.total, clients: data.clients ?? [] };
}

export async function fetchAdminClientDetail(userId: string): Promise<AdminClientDetail> {
  const headers = adminHeaders();
  const res = await apiFetch(`/api/admin/clients/${encodeURIComponent(userId)}`, { headers });
  const data = await parseJson<{ ok?: boolean; client: AdminClientDetail }>(res);
  return data.client;
}
