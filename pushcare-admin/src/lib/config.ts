/** When set, dashboard loads data from PushCare HTTP API (see backends/local-api). */
export const PUSHCARE_API_URL = (import.meta.env.VITE_PUSHCARE_API_URL ?? "").replace(/\/$/, "");

export const VITE_SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
export const VITE_SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export function useLivePushcareApi(): boolean {
  return PUSHCARE_API_URL.length > 0;
}

export type PushcareDataSource = "mock" | "rest" | "supabase";

/** Supabase (JWT) wins over REST when env + session are present. */
export function resolveDataSource(hasSupabaseSession: boolean): PushcareDataSource {
  const supabaseEnv = Boolean(VITE_SUPABASE_URL.length && VITE_SUPABASE_ANON_KEY.length);
  if (supabaseEnv && hasSupabaseSession) return "supabase";
  if (PUSHCARE_API_URL.length > 0) return "rest";
  return "mock";
}
