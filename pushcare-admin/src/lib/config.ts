/** When set, dashboard loads data from PushCare HTTP API (e.g. https://api.pushcare.net). */
export const PUSHCARE_API_URL = (import.meta.env.VITE_PUSHCARE_API_URL ?? "").replace(/\/$/, "");

export const VITE_SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
export const VITE_SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export type PushcareDataSourcePreference = "auto" | "rest" | "supabase" | "mock";

/** Where lists/analytics load from: auto | rest | supabase | mock */
const rawPref = (import.meta.env.VITE_PUSHCARE_DATA_SOURCE ?? "auto").toLowerCase();
export const PUSHCARE_DATA_SOURCE_PREF: PushcareDataSourcePreference = (
  ["auto", "rest", "supabase", "mock"] as const
).includes(rawPref as PushcareDataSourcePreference)
  ? (rawPref as PushcareDataSourcePreference)
  : "auto";

/** Safe hostname for UI badges (invalid URL strings fall back). */
export function pushcareApiHostname(): string {
  if (!PUSHCARE_API_URL) return "";
  try {
    return new URL(PUSHCARE_API_URL).hostname;
  } catch {
    return PUSHCARE_API_URL.replace(/^https?:\/\//i, "").split("/")[0] ?? "";
  }
}

export function useLivePushcareApi(): boolean {
  return PUSHCARE_API_URL.length > 0;
}

export type PushcareDataSource = "mock" | "rest" | "supabase";

/**
 * Resolves dashboard data backend.
 * Use VITE_PUSHCARE_DATA_SOURCE=rest to keep api.pushcare.net (or similar) while still using Supabase Auth.
 */
export function resolveDataSource(hasSupabaseSession: boolean): PushcareDataSource {
  const supabaseEnv = Boolean(VITE_SUPABASE_URL.length && VITE_SUPABASE_ANON_KEY.length);
  const hasRest = PUSHCARE_API_URL.length > 0;
  const pref = PUSHCARE_DATA_SOURCE_PREF;

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
