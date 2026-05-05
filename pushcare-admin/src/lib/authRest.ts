/**
 * REST helpers for the local-api auth endpoints (no Supabase):
 *   POST /api/auth/signup     -> { session, member }
 *   POST /api/auth/login      -> { session, member }
 *   POST /api/auth/logout     -> { ok }
 *   GET  /api/auth/me         -> { session, member }
 *
 * These mirror Supabase's public surface enough that AuthContext can swap
 * between the two without leaking the difference into pages. The local-api
 * actually returns `session` (with `access_token`) + `member` records; we
 * flatten that into a Supabase-ish `{ access_token, user }` shape here.
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

type ServerSession = {
  user_id: string;
  email: string;
  display_name: string;
  access_token: string;
  expires_at: string;
};

type ServerMember = {
  id: string;
  user_id: string | null;
  email: string;
  display_name: string;
  role?: string | null;
  created_at?: string | null;
};

function toRestUser(member: ServerMember | null, session: ServerSession): RestUser {
  if (member) {
    return {
      id: member.user_id ?? member.id,
      email: member.email,
      name: member.display_name ?? null,
      role: member.role ?? null,
      created_at: member.created_at ?? null,
    };
  }
  return {
    id: session.user_id,
    email: session.email,
    name: session.display_name ?? null,
  };
}

export async function restSignup(email: string, password: string): Promise<RestAuthResult> {
  const res = await apiFetch("/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  const data = await parseJson<{
    ok?: boolean;
    session: ServerSession;
    member: ServerMember | null;
  }>(res);
  return { access_token: data.session.access_token, user: toRestUser(data.member, data.session) };
}

export async function restLogin(email: string, password: string): Promise<RestAuthResult> {
  const res = await apiFetch("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  const data = await parseJson<{
    ok?: boolean;
    session: ServerSession;
    member: ServerMember | null;
  }>(res);
  return { access_token: data.session.access_token, user: toRestUser(data.member, data.session) };
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
    const data = await parseJson<{
      ok?: boolean;
      session: ServerSession;
      member: ServerMember | null;
    }>(res);
    if (!data.session) return null;
    return toRestUser(data.member, data.session);
  } catch {
    return null;
  }
}
