/**
 * REST helpers for the APK builder service:
 *   POST /api/builds
 *   GET  /api/builds/:id
 *
 * If `/api/builds` POST isn't implemented yet, callers should fall back to
 * an optimistic local insert via `usePushcare()` mock state.
 */

import { apiFetch, parseJson } from "./api";
import type { ApkBuild } from "./mock-data";

export type BuildCreatePayload = {
  app_id: string;
  version_name: string;
  version_code: number;
  branch?: string;
  release_notes?: string;
  build_config?: Record<string, unknown>;
};

export async function createBuild(payload: BuildCreatePayload): Promise<ApkBuild> {
  const res = await apiFetch("/api/builds", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJson<{ ok?: boolean; build: ApkBuild }>(res);
  return data.build;
}

export async function fetchBuild(id: string): Promise<ApkBuild | null> {
  try {
    const res = await apiFetch(`/api/builds/${encodeURIComponent(id)}`);
    const data = await parseJson<{ ok?: boolean; build: ApkBuild | null }>(res);
    return data.build ?? null;
  } catch (err) {
    if (err instanceof Error && err.message.includes("not_found")) return null;
    throw err;
  }
}
