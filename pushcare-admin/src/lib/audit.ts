/**
 * REST helpers for audit-log endpoints (Lane 4):
 *   GET /api/audit?limit=&action=&since=
 */

import { apiFetch, parseJson } from "./api";

export type AuditEntry = {
  id: string;
  actor_email: string | null;
  /** Auth user id of the actor — present when written from a logged-in session.
   * The local-api currently doesn't include this, but the Edge schema does. */
  actor_user_id?: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown>;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

export type AuditQuery = {
  limit?: number;
  action?: string;
  since?: string; // ISO timestamp
};

export async function fetchAudit(opts: AuditQuery = {}): Promise<AuditEntry[]> {
  const q = new URLSearchParams();
  if (typeof opts.limit === "number") q.set("limit", String(opts.limit));
  if (opts.action) q.set("action", opts.action);
  if (opts.since) q.set("since", opts.since);
  const qs = q.toString();
  const res = await apiFetch(`/api/audit${qs ? `?${qs}` : ""}`);
  const data = await parseJson<{ ok?: boolean; entries: AuditEntry[] }>(res);
  return data.entries ?? [];
}
