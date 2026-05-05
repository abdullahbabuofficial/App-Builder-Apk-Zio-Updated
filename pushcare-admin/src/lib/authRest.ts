/**
 * REST helpers for the local-api auth endpoints (no Supabase):
 *   POST /api/auth/signup
 *   POST /api/auth/login
 *   POST /api/auth/logout
 *   GET  /api/auth/me
 *
 * These mirror Supabase's public surface enough that AuthContext can swap
 * between the two without leaking the difference into pages.
 */

import { apiFetch, parseJson } from "./api";

export type RestUser = {
  id: string;
  email: string;
  name: string | null;
  role?: string | null;
  created_at?: string | null;
};

export type RestAuthResult = {
  access_token: string;
  user: RestUser;
};

export async function restSignup(email: string, password: string): Promise<RestAuthResult> {
  const res = await apiFetch("/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  const data = await parseJson<{
    ok?: boolean;
    access_token: string;
    user: RestUser;
  }>(res);
  return { access_token: data.access_token, user: data.user };
}

export async function restLogin(email: string, password: string): Promise<RestAuthResult> {
  const res = await apiFetch("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  const data = await parseJson<{
    ok?: boolean;
    access_token: string;
    user: RestUser;
  }>(res);
  return { access_token: data.access_token, user: data.user };
}

export async function restLogout(): Promise<void> {
  try {
    const res = await apiFetch("/api/auth/logout", { method: "POST" });
    await parseJson<{ ok?: boolean }>(res);
  } catch {
    // Logout is best-effort: if server is offline or the endpoint is missing,
    // we still want the local session cleared by the caller.
  }
}

export async function restMe(): Promise<RestUser | null> {
  try {
    const res = await apiFetch("/api/auth/me");
    const data = await parseJson<{ ok?: boolean; user: RestUser }>(res);
    return data.user ?? null;
  } catch {
    return null;
  }
}
