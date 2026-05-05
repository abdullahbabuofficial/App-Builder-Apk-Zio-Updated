/**
 * REST helpers for API-key admin endpoints. The local-api may not have these
 * endpoints landed yet; helpers throw `ApiError` and callers should fall back
 * to mock-mode when `isApiNotFound(err) === true`.
 *
 *   POST   /api/api-keys           (returns { key, key_full } — key_full ONCE)
 *   DELETE /api/api-keys/:id
 */

import { apiFetch, parseJson } from "./api";
import type { ApiKey } from "./mock-data";

export type ApiKeyCreatePayload = {
  name: string;
  app_id: string;
  scopes: string[];
  rate_limit_rpm: number;
};

export type ApiKeyCreateResult = {
  key: ApiKey;
  /** Full secret value — shown ONLY once on create, never returned again. */
  key_full: string;
};

export async function createApiKey(payload: ApiKeyCreatePayload): Promise<ApiKeyCreateResult> {
  const res = await apiFetch("/api/api-keys", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJson<{
    ok?: boolean;
    key: ApiKey;
    key_full: string;
  }>(res);
  return { key: data.key, key_full: data.key_full };
}

export async function revokeApiKey(id: string): Promise<void> {
  const res = await apiFetch(`/api/api-keys/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  await parseJson<{ ok?: boolean }>(res);
}
