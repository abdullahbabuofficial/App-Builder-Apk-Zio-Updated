import { PUSHCARE_API_URL } from "./config";

export type MemberRole = "owner" | "admin" | "developer" | "viewer";

export type Member = {
  id: string;
  email: string;
  display_name: string | null;
  role: MemberRole;
  avatar_url: string | null;
  last_active_at: string | null;
  created_at: string;
};

export type Invite = {
  id: string;
  email: string;
  role: MemberRole;
  token: string;
  expires_at: string;
  created_at: string;
  invited_by: string | null;
};

let teamAccessToken: string | null = null;

export function setTeamAccessToken(token: string | null): void {
  teamAccessToken = token;
}

function teamHeaders(extra?: HeadersInit): Headers {
  const h = new Headers(extra);
  if (!h.has("Accept")) h.set("Accept", "application/json");
  if (teamAccessToken) h.set("Authorization", `Bearer ${teamAccessToken}`);
  return h;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
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
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return data as T;
}

function teamUrl(path: string): string {
  return `${PUSHCARE_API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function fetchMembers(): Promise<Member[]> {
  if (!PUSHCARE_API_URL) return [];
  const res = await fetch(teamUrl("/api/members"), { headers: teamHeaders() });
  if (!res.ok) return [];
  const data = await jsonOrThrow<{ members?: Member[] }>(res);
  return data.members ?? [];
}

export async function fetchInvites(): Promise<Invite[]> {
  if (!PUSHCARE_API_URL) return [];
  const res = await fetch(teamUrl("/api/invites"), { headers: teamHeaders() });
  if (!res.ok) return [];
  const data = await jsonOrThrow<{ invites?: Invite[] }>(res);
  return data.invites ?? [];
}

export async function inviteMember(email: string, role: MemberRole): Promise<Invite> {
  if (!PUSHCARE_API_URL) throw new Error("API not configured — cannot send invite in mock mode.");
  const res = await fetch(teamUrl("/api/members/invite"), {
    method: "POST",
    headers: teamHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ email: email.trim().toLowerCase(), role }),
  });
  const data = await jsonOrThrow<{ invite: Invite }>(res);
  return data.invite;
}

export async function removeMember(id: string): Promise<void> {
  if (!PUSHCARE_API_URL) throw new Error("API not configured");
  const res = await fetch(teamUrl(`/api/members/${encodeURIComponent(id)}`), {
    method: "DELETE",
    headers: teamHeaders(),
  });
  if (!res.ok && res.status !== 204) {
    await jsonOrThrow(res);
  }
}

export async function updateMemberRole(id: string, role: MemberRole): Promise<Member> {
  if (!PUSHCARE_API_URL) throw new Error("API not configured");
  const res = await fetch(teamUrl(`/api/members/${encodeURIComponent(id)}`), {
    method: "PATCH",
    headers: teamHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ role }),
  });
  const data = await jsonOrThrow<{ member: Member }>(res);
  return data.member;
}

export async function acceptInvite(token: string): Promise<{ ok: true }> {
  if (!PUSHCARE_API_URL) throw new Error("API not configured");
  const res = await fetch(teamUrl(`/api/invites/${encodeURIComponent(token)}/accept`), {
    method: "POST",
    headers: teamHeaders(),
  });
  return jsonOrThrow<{ ok: true }>(res);
}

/** Build a shareable invite URL (always relative to current host). */
export function inviteUrl(token: string): string {
  if (typeof window === "undefined") return `/accept-invite?token=${token}`;
  return `${window.location.origin}/accept-invite?token=${token}`;
}
