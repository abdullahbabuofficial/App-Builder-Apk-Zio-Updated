/**
 * REST helpers for billing endpoints exposed by the local-api / production API.
 * Endpoints (Lane 5):
 *   GET  /api/billing/plans
 *   GET  /api/billing/subscription
 *   POST /api/billing/subscription
 *   GET  /api/billing/usage
 *
 * All helpers throw `ApiError` (with `.status`) on non-2xx and follow the same
 * Bearer-token plumbing as the rest of `lib/api.ts`.
 */

import { apiFetch, parseJson } from "./api";

export type Plan = {
  id: string;
  name: string;
  price_cents: number;
  interval: "month" | "year";
  features: string[];
  limits: {
    pushes_per_month?: number;
    apps?: number;
    seats?: number;
    [k: string]: number | undefined;
  };
  is_default?: boolean;
  description?: string | null;
};

export type Subscription = {
  id: string;
  plan_id: string;
  status: "active" | "past_due" | "canceled" | "trialing";
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end?: boolean;
  trial_ends_at?: string | null;
};

export type UsageBucket = {
  metric: string;
  current: number;
  limit: number | null;
  period_start?: string;
  period_end?: string;
};

export type Usage = {
  buckets: UsageBucket[];
  generated_at: string;
};

export async function fetchPlans(): Promise<Plan[]> {
  const res = await apiFetch("/api/billing/plans");
  const data = await parseJson<{ ok?: boolean; plans: Plan[] }>(res);
  return data.plans ?? [];
}

export async function fetchSubscription(): Promise<Subscription | null> {
  const res = await apiFetch("/api/billing/subscription");
  const data = await parseJson<{ ok?: boolean; subscription: Subscription | null }>(res);
  return data.subscription ?? null;
}

export async function changePlan(planId: string): Promise<Subscription> {
  const res = await apiFetch("/api/billing/subscription", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ plan_id: planId }),
  });
  const data = await parseJson<{ ok?: boolean; subscription: Subscription }>(res);
  return data.subscription;
}

export async function fetchUsage(): Promise<Usage> {
  const res = await apiFetch("/api/billing/usage");
  const data = await parseJson<{ ok?: boolean } & Usage>(res);
  return { buckets: data.buckets ?? [], generated_at: data.generated_at };
}
