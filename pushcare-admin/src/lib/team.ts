/**
 * REST helpers for team membership endpoints (Lane 5):
 *   GET  /api/team/members
 *   GET  /api/team/invites
 *   POST /api/team/invites           (body: { email, role })
 *   POST /api/team/invites/:id/accept
 *   PATCH /api/team/members/:id      (body: { role })
 *   DELETE /api/team/members/:id
 */

import { apiFetch, parseJson } from "./api";

export type TeamRole = "owner" | "admin" | "developer" | "viewer" | "service";

export type TeamMember = {
  id: string;
  user_id: string | null;
  email: string;
  name: string | null;
  role: TeamRole;
  last_active_at: string | null;
  invited_at: string | null;
  joined_at: string | null;
};

export type TeamInvite = {
  id: string;
  email: string;
  role: TeamRole;
  token: string;
  invited_by_email: string | null;
  created_at: string;
  expires_at: string | null;
  accepted_at: string | null;
};

export async function fetchMembers(): Promise<TeamMember[]> {
  const res = await apiFetch("/api/team/members");
  const data = await parseJson<{ ok?: boolean; members: TeamMember[] }>(res);
  return data.members ?? [];
}

export async function fetchInvites(): Promise<TeamInvite[]> {
  const res = await apiFetch("/api/team/invites");
  const data = await parseJson<{ ok?: boolean; invites: TeamInvite[] }>(res);
  return data.invites ?? [];
}

export async function inviteMember(input: {
  email: string;
  role: TeamRole;
}): Promise<TeamInvite> {
  const res = await apiFetch("/api/team/invites", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseJson<{ ok?: boolean; invite: TeamInvite }>(res);
  return data.invite;
}

export async function acceptInvite(token: string): Promise<TeamMember> {
  const res = await apiFetch(`/api/team/invites/${encodeURIComponent(token)}/accept`, {
    method: "POST",
  });
  const data = await parseJson<{ ok?: boolean; member: TeamMember }>(res);
  return data.member;
}

export async function updateMemberRole(id: string, role: TeamRole): Promise<TeamMember> {
  const res = await apiFetch(`/api/team/members/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ role }),
  });
  const data = await parseJson<{ ok?: boolean; member: TeamMember }>(res);
  return data.member;
}

export async function removeMember(id: string): Promise<void> {
  const res = await apiFetch(`/api/team/members/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  await parseJson<{ ok?: boolean }>(res);
}
