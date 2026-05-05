/**
 * REST helpers for the segments endpoints (Lane 4):
 *   GET    /api/segments?app_id=:id
 *   POST   /api/segments
 *   PATCH  /api/segments/:id
 *   DELETE /api/segments/:id
 *   POST   /api/segments/:id/evaluate
 */

import { apiFetch, parseJson } from "./api";

export type SegmentRuleOp =
  | "equals"
  | "not_equals"
  | "in"
  | "not_in"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "contains";

export type SegmentRule = {
  field: string;
  op: SegmentRuleOp;
  value: string | number | boolean | string[] | number[];
};

export type SegmentRules = {
  match: "all" | "any";
  rules: SegmentRule[];
};

export type Segment = {
  id: string;
  app_id: string;
  name: string;
  description: string | null;
  rules: SegmentRules;
  estimated_size: number;
  created_at: string;
  updated_at: string;
  last_evaluated_at: string | null;
};

export type SegmentInput = {
  app_id: string;
  name: string;
  description?: string | null;
  rules: SegmentRules;
};

export type SegmentUpdate = Partial<Pick<Segment, "name" | "description" | "rules">>;

export async function fetchSegments(appId?: string): Promise<Segment[]> {
  const q = appId ? `?app_id=${encodeURIComponent(appId)}` : "";
  const res = await apiFetch(`/api/segments${q}`);
  const data = await parseJson<{ ok?: boolean; segments: Segment[] }>(res);
  return data.segments ?? [];
}

export async function createSegment(input: SegmentInput): Promise<Segment> {
  const res = await apiFetch("/api/segments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseJson<{ ok?: boolean; segment: Segment }>(res);
  return data.segment;
}

export async function updateSegment(id: string, input: SegmentUpdate): Promise<Segment> {
  const res = await apiFetch(`/api/segments/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseJson<{ ok?: boolean; segment: Segment }>(res);
  return data.segment;
}

export async function deleteSegment(id: string): Promise<void> {
  const res = await apiFetch(`/api/segments/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  await parseJson<{ ok?: boolean }>(res);
}

export async function evaluateSegment(id: string): Promise<{ estimated_size: number }> {
  const res = await apiFetch(`/api/segments/${encodeURIComponent(id)}/evaluate`, {
    method: "POST",
  });
  const data = await parseJson<{ ok?: boolean; estimated_size: number }>(res);
  return { estimated_size: data.estimated_size ?? 0 };
}
