/** REST API origin from `.env` / `.env.local`: `VITE_APKZIO_API_URL` (Vite injects at build time). */
const DEFAULT_API_BASE = (import.meta.env.VITE_APKZIO_API_URL || "https://api.apkzio.net").replace(
  /\/$/,
  "",
);

/** Legacy Settings override removed — clear stale key so old sessions don't confuse operators. */
try {
  if (typeof window !== "undefined") window.localStorage?.removeItem("apkzio.settings.api_base_url");
} catch {
  /* ignore */
}

export function getApiBaseUrl(): string {
  return DEFAULT_API_BASE;
}

/** Alias for `getApiBaseUrl()` — makes call sites explicit that the value comes from env at build time. */
export function getApiBaseUrlFromEnv(): string {
  return DEFAULT_API_BASE;
}

export const apiBaseUrl = DEFAULT_API_BASE;

/** Subset of `GET /api/status` from apkzio-local-api (unknown servers may omit fields). */
export type PublicApiStatus = {
  ok: true;
  service: string;
  persistence?: string;
  /** e.g. `fcm_dispatcher` for firebase-service vs REST local-api */
  role?: string;
  features?: {
    db_reachable?: boolean;
    firebase_default_credentials?: boolean;
    firebase_admin?: boolean;
    email_via_resend?: boolean;
    webview_zip_pipeline?: boolean;
    apk_gradle_pipeline?: boolean;
    apk_pipeline_hint?: string | null;
  };
  worker?: {
    inflight_notifications?: number;
    worker_concurrency?: number;
  };
};

export type ApiConnectionProbe =
  | { ok: true; source: "status"; status: PublicApiStatus }
  | { ok: true; source: "health"; service?: string }
  | { ok: false; message: string };

function networkErrorMessage(e: unknown): string {
  if (e instanceof DOMException && e.name === "AbortError") {
    return "Timed out — check URL and CORS.";
  }
  if (e instanceof Error) return e.message;
  return "Network error";
}

/**
 * Probes an ApkZio API: prefers `GET /api/status`, falls back to `GET /health`.
 */
export async function probeApiConnection(baseUrl: string): Promise<ApiConnectionProbe> {
  if (typeof window === "undefined") {
    return { ok: false, message: "Not available on server." };
  }
  const base = baseUrl.replace(/\/$/, "");
  const controller = new AbortController();
  const t = window.setTimeout(() => controller.abort(), 12_000);
  const signal = controller.signal;

  try {
    let res = await fetch(`${base}/api/status`, { signal });
    let raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok && raw.ok === true && typeof raw.service === "string") {
      clearTimeout(t);
      return { ok: true, source: "status", status: raw as PublicApiStatus };
    }

    res = await fetch(`${base}/health`, { signal });
    raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    clearTimeout(t);
    if (!res.ok || raw.ok !== true) {
      return { ok: false, message: `Unreachable or invalid response (HTTP ${res.status})` };
    }
    return { ok: true, source: "health", service: typeof raw.service === "string" ? raw.service : undefined };
  } catch (e) {
    clearTimeout(t);
    return { ok: false, message: networkErrorMessage(e) };
  }
}

/** @deprecated Use `probeApiConnection` for richer diagnostics. */
export async function probeApiHealth(baseUrl: string): Promise<
  | { ok: true; service?: string }
  | { ok: false; message: string }
> {
  const r = await probeApiConnection(baseUrl);
  if (!r.ok) return r;
  if (r.source === "health") return { ok: true, service: r.service };
  return { ok: true, service: r.status.service };
}

export type BuilderPayload = {
  website_url: string;
  app_name: string;
  package_name: string;
  description?: string;
  primary_color: string;
  accent_color: string;
  icon_data_url?: string | null;
  icon_name?: string | null;
  icon_assets?: Array<{
    name: string;
    path: string;
    size: number;
    density: string;
    purpose: string;
    data_url?: string;
  }>;
  splash_style: string;
  orientation: string;
  pull_to_refresh: boolean;
  offline_mode: boolean;
  push_notifications: boolean;
  status_bar_style: string;
  build_type: string;
  version_code: number;
  version_name: string;
};

export type BuilderBuildStatus = "queued" | "building" | "success" | "failed";

export type BuilderBuild = {
  build_id: string;
  app_name: string;
  package_name: string;
  webview_url: string;
  version_name: string;
  version_code: number;
  filename: string;
  build_status: BuilderBuildStatus | string;
  created_at: string;
  completed_at?: string | null;
  duration_ms?: number | null;
  source_zip_url?: string | null;
  apk_url?: string | null;
  apk_size_bytes?: number | null;
  apk_build_skipped?: boolean;
  apk_build_error?: string | null;
};

export type BuilderApiErrorCode = "network" | "timeout" | "server" | "client";

export class BuilderApiError extends Error {
  code: BuilderApiErrorCode;
  status?: number;
  constructor(code: BuilderApiErrorCode, message: string, status?: number) {
    super(message);
    this.name = "BuilderApiError";
    this.code = code;
    this.status = status;
  }
}

export async function submitBuilderBuild(payload: BuilderPayload): Promise<BuilderBuild> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  let res: Response;
  try {
    res = await fetch(`${getApiBaseUrl()}/api/builder/builds`, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new BuilderApiError(
        "timeout",
        "The build service didn't respond in time. Please try again.",
      );
    }
    // `TypeError: Failed to fetch` is what browsers throw on DNS / network /
    // CORS-preflight failures; surface a friendly message instead.
    throw new BuilderApiError(
      "network",
      "We couldn't reach the build service. Check your connection or try again in a moment.",
    );
  }
  clearTimeout(timer);

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (data && (data.error?.message || data.message)) ||
      `Build request failed (HTTP ${res.status}).`;
    throw new BuilderApiError(res.status >= 500 ? "server" : "client", msg, res.status);
  }
  if (!data.ok) {
    throw new BuilderApiError(
      "client",
      data?.error?.message || "Build request was not accepted.",
    );
  }
  return data.build as BuilderBuild;
}

// Public read — used to poll an in-flight build's status and pick up
// download URLs once Gradle finishes. No auth required; the build ID is a
// UUID so it's effectively a capability token.
export async function getBuilderBuild(buildId: string): Promise<BuilderBuild> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  let res: Response;
  try {
    res = await fetch(
      `${getApiBaseUrl()}/api/builder/builds/${encodeURIComponent(buildId)}`,
      { signal: controller.signal },
    );
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new BuilderApiError("timeout", "Build status request timed out.");
    }
    throw new BuilderApiError("network", "Could not reach the build service.");
  }
  clearTimeout(timer);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    const msg =
      (data && (data.error?.message || data.message)) ||
      `Build status request failed (HTTP ${res.status}).`;
    throw new BuilderApiError(res.status >= 500 ? "server" : "client", msg, res.status);
  }
  return data.build as BuilderBuild;
}

// TODO(Agent R): the customer-scoped types and wrappers below were added by Agent S
// so the dashboard pages can type-check and render real data. Replace with the
// authoritative versions when Agent R lands the typed API client and bearer-token
// plumbing. The signatures here are intentionally aligned with the prompt:
//   getMyApps(): Promise<App[]>
//   getMyBuilds(): Promise<Build[]>
//   getMyBuild(id: string): Promise<Build>

const TOKEN_STORAGE_KEY = "apkzio.auth.token";

function readToken(): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage?.getItem(TOKEN_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function authHeaders(): Record<string, string> {
  const token = readToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  for (const [k, v] of Object.entries(authHeaders())) headers.set(k, v);
  const res = await fetch(`${getApiBaseUrl()}${path}`, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (data && (data.error?.message || data.message)) || `Request failed: ${res.status}`;
    throw new Error(message);
  }
  return data as T;
}

export type User = {
  id: string;
  email: string;
  full_name: string;
  plan: string;
  email_verified: boolean;
  phone?: string | null;
  location?: string | null;
  website?: string | null;
  bio?: string | null;
};

export type App = {
  id: string;
  name: string;
  package_name: string;
  website_url?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type BuildStatus = "queued" | "building" | "success" | "failed";

export type BuildConfig = {
  app_name?: string;
  package_name?: string;
  start_url?: string;
  website_url?: string;
  version_name?: string;
  version_code?: number;
  primary_color?: string;
  accent_color?: string;
  background_color?: string;
  splash_color?: string;
  splash_style?: string;
  orientation?: string;
  pull_to_refresh?: boolean;
  offline_mode?: boolean;
  push_notifications?: boolean;
  status_bar_style?: string;
  [k: string]: unknown;
};

export type Build = {
  id: string;
  app_id: string;
  app_name: string;
  package_name: string;
  status: BuildStatus;
  version_name: string;
  version_code: number;
  build_started_at: string;
  build_completed_at?: string | null;
  size_bytes?: number | null;
  source_zip_url?: string | null;
  config?: BuildConfig | null;
  /** Best-effort APK download URL (only when the local-api host has JDK + Gradle + ANDROID_HOME). */
  apk_url?: string | null;
  apk_size_bytes?: number | null;
  /** True when the backend deliberately skipped the Gradle pass (no toolchain or env flag off). */
  apk_build_skipped?: boolean;
  /** Reason string if Gradle ran but failed; the source.zip is still the deliverable. */
  apk_build_error?: string | null;
};

export async function getMe(): Promise<User> {
  const data = await apiFetch<{ user: User }>("/api/auth/me");
  return data.user;
}

export async function registerMyPushToken(token: string): Promise<void> {
  await apiFetch<{ ok: true }>("/api/me/push-tokens", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

// TODO(Agent R): the auth-flow wrappers below are stubs added by Agent S so the
// AuthProvider in src/app/contexts/auth-context.tsx type-checks while Agent R is
// still landing the authoritative client. Replace with the real implementations.

export async function getCurrentUser(): Promise<{ user: User }> {
  const user = await getMe();
  return { user };
}

export async function registerUser(input: {
  email: string;
  password: string;
  full_name: string;
}): Promise<{ token: string; user: User }> {
  return apiFetch<{ token: string; user: User }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<{ token: string; user: User }> {
  return apiFetch<{ token: string; user: User }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Exchange a Firebase Auth ID token (Google provider) for an ApkZio API session. */
export async function loginWithGoogleIdToken(
  idToken: string,
): Promise<{ token: string; user: User }> {
  return apiFetch<{ token: string; user: User }>("/api/auth/google", {
    method: "POST",
    body: JSON.stringify({ id_token: idToken }),
  });
}

export async function logoutUser(): Promise<void> {
  await apiFetch<{ ok?: boolean }>("/api/auth/logout", { method: "POST" }).catch(
    () => undefined,
  );
}

export async function forgotPasswordRequest(email: string): Promise<void> {
  await apiFetch<{ ok?: boolean }>("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPasswordRequest(
  token: string,
  password: string,
): Promise<{ token: string; user: User }> {
  return apiFetch<{ token: string; user: User }>("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

export async function verifyEmailRequest(token: string): Promise<{ user: User }> {
  return apiFetch<{ user: User }>("/api/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function resendVerificationRequest(): Promise<void> {
  await apiFetch<{ ok?: boolean }>("/api/auth/resend-verification", {
    method: "POST",
  });
}

export async function getMyApps(): Promise<App[]> {
  const data = await apiFetch<{ apps: App[] }>("/api/me/apps");
  return data.apps ?? [];
}

export async function getMyBuilds(): Promise<Build[]> {
  const data = await apiFetch<{ builds: Build[] }>("/api/me/builds");
  return data.builds ?? [];
}

export async function getMyBuild(id: string): Promise<Build> {
  const data = await apiFetch<{ build: Build }>(`/api/me/builds/${encodeURIComponent(id)}`);
  return data.build;
}

export type ContactPayload = {
  name: string;
  email: string;
  subject: string;
  category?: string;
  message: string;
};

export async function submitContact(payload: ContactPayload): Promise<void> {
  await apiFetch<{ ok?: boolean }>("/api/contact", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
