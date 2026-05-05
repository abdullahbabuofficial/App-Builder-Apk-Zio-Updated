/**
 * REST helpers for webhook endpoints (Lane 4):
 *   GET    /api/webhooks
 *   POST   /api/webhooks
 *   PATCH  /api/webhooks/:id
 *   DELETE /api/webhooks/:id
 *   POST   /api/webhooks/:id/test
 *   GET    /api/webhooks/:id/deliveries?limit=N
 *
 * `whsec_full` is only ever returned once on creation; persist it client-side
 * via the one-time-reveal modal pattern.
 */

import { apiFetch, parseJson } from "./api";

export type WebhookEventType =
  | "push.sent"
  | "push.delivered"
  | "push.opened"
  | "push.clicked"
  | "push.failed"
  | "device.registered"
  | "device.unregistered"
  | string;

export type Webhook = {
  id: string;
  app_id: string | null;
  url: string;
  signing_secret_prefix: string;
  event_types: WebhookEventType[];
  is_active: boolean;
  last_delivery_at: string | null;
  last_status: number | null;
  created_at: string;
  updated_at: string;
};

export type WebhookDelivery = {
  id: string;
  endpoint_id: string;
  event_type: WebhookEventType;
  payload: unknown;
  response_status: number | null;
  response_body: string | null;
  succeeded: boolean;
  attempt: number;
  created_at: string;
  completed_at: string | null;
};

export type WebhookCreate = {
  app_id?: string | null;
  url: string;
  event_types: WebhookEventType[];
  is_active?: boolean;
};

export type WebhookUpdate = Partial<Pick<Webhook, "url" | "event_types" | "is_active">>;

export async function fetchWebhooks(): Promise<Webhook[]> {
  const res = await apiFetch("/api/webhooks");
  const data = await parseJson<{ ok?: boolean; webhooks: Webhook[] }>(res);
  return data.webhooks ?? [];
}

export async function createWebhook(
  input: WebhookCreate,
): Promise<Webhook & { whsec_full?: string }> {
  const res = await apiFetch("/api/webhooks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseJson<{
    ok?: boolean;
    webhook: Webhook;
    whsec_full?: string;
  }>(res);
  return { ...data.webhook, whsec_full: data.whsec_full };
}

export async function updateWebhook(id: string, input: WebhookUpdate): Promise<Webhook> {
  const res = await apiFetch(`/api/webhooks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseJson<{ ok?: boolean; webhook: Webhook }>(res);
  return data.webhook;
}

export async function deleteWebhook(id: string): Promise<void> {
  const res = await apiFetch(`/api/webhooks/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  await parseJson<{ ok?: boolean }>(res);
}

export async function testWebhook(id: string): Promise<WebhookDelivery> {
  const res = await apiFetch(`/api/webhooks/${encodeURIComponent(id)}/test`, {
    method: "POST",
  });
  const data = await parseJson<{ ok?: boolean; delivery: WebhookDelivery }>(res);
  return data.delivery;
}

export async function fetchWebhookDeliveries(
  id: string,
  limit = 25,
): Promise<WebhookDelivery[]> {
  const q = `?limit=${encodeURIComponent(String(limit))}`;
  const res = await apiFetch(`/api/webhooks/${encodeURIComponent(id)}/deliveries${q}`);
  const data = await parseJson<{ ok?: boolean; deliveries: WebhookDelivery[] }>(res);
  return data.deliveries ?? [];
}
