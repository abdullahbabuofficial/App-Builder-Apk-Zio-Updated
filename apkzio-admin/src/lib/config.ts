/** When set, dashboard loads data from the ApkZio HTTP API (e.g. https://api.apkzio.net). */
export const APKZIO_API_URL = (import.meta.env.VITE_APKZIO_API_URL ?? "").replace(/\/$/, "");

/**
 * Sent as `X-Apkzio-Admin-Key` for `/api/admin/*` (e.g. Clients CRM).
 * Never expose a production admin key in a public-facing build — use VPN/private consoles only.
 */
export const APKZIO_ADMIN_API_KEY = String(import.meta.env.VITE_APKZIO_ADMIN_API_KEY ?? "").trim();

export const VITE_SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
export const VITE_SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export type ApkzioDataSourcePreference = "auto" | "rest" | "supabase" | "mock";

/** Where lists/analytics load from: auto | rest | supabase | mock */
const rawPref = (import.meta.env.VITE_APKZIO_DATA_SOURCE ?? "auto").toLowerCase();
export const APKZIO_DATA_SOURCE_PREF: ApkzioDataSourcePreference = (
  ["auto", "rest", "supabase", "mock"] as const
).includes(rawPref as ApkzioDataSourcePreference)
  ? (rawPref as ApkzioDataSourcePreference)
  : "auto";

/** Safe hostname for UI badges (invalid URL strings fall back). */
export function apkzioApiHostname(): string {
  if (!APKZIO_API_URL) return "";
  try {
    return new URL(APKZIO_API_URL).hostname;
  } catch {
    return APKZIO_API_URL.replace(/^https?:\/\//i, "").split("/")[0] ?? "";
  }
}

export function useLiveApkzioApi(): boolean {
  return APKZIO_API_URL.length > 0;
}

export type ApkzioDataSource = "mock" | "rest" | "supabase";

/**
 * Resolves dashboard data backend.
 * Use VITE_APKZIO_DATA_SOURCE=rest to keep api.apkzio.net (or similar) while still using Supabase Auth.
 */
export function resolveDataSource(hasSupabaseSession: boolean): ApkzioDataSource {
  const supabaseEnv = Boolean(VITE_SUPABASE_URL.length && VITE_SUPABASE_ANON_KEY.length);
  const hasRest = APKZIO_API_URL.length > 0;
  const pref = APKZIO_DATA_SOURCE_PREF;

  if (pref === "mock") return "mock";

  if (pref === "rest") {
    if (hasRest) return "rest";
    if (supabaseEnv && hasSupabaseSession) return "supabase";
    return "mock";
  }

  if (pref === "supabase") {
    if (supabaseEnv && hasSupabaseSession) return "supabase";
    if (hasRest) return "rest";
    return "mock";
  }

  // auto: Supabase DB when logged in with JWT; else REST; else mock
  if (supabaseEnv && hasSupabaseSession) return "supabase";
  if (hasRest) return "rest";
  return "mock";
}
