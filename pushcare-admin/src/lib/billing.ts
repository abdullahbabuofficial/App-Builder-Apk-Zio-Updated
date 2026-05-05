import { PUSHCARE_API_URL } from "./config";
import { FALLBACK_PLANS, type Plan } from "./plans";

export type Subscription = {
  plan_code: string;
  plan_name: string;
  status: "active" | "trialing" | "past_due" | "canceled";
  current_period_start: string | null;
  current_period_end: string | null;
  monthly_price: number | null;
  /** Snapshot of plan limits at subscription time. */
  monthly_pushes: number;
  max_apps: number;
  max_seats: number;
};

export type UsagePoint = {
  /** ISO month start, e.g. "2025-04-01". */
  month: string;
  pushes_sent: number;
  pushes_delivered: number;
};

let billingAccessToken: string | null = null;

/** Set by PushcareDataContext when REST is the active backend. */
export function setBillingAccessToken(token: string | null): void {
  billingAccessToken = token;
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

function billingHeaders(extra?: HeadersInit): Headers {
  const h = new Headers(extra);
  if (!h.has("Accept")) h.set("Accept", "application/json");
  if (billingAccessToken) h.set("Authorization", `Bearer ${billingAccessToken}`);
  return h;
}

function billingUrl(path: string): string {
  return `${PUSHCARE_API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Fetch plans from the API. Returns FALLBACK_PLANS when API is not configured or on failure. */
export async function fetchPlans(): Promise<Plan[]> {
  if (!PUSHCARE_API_URL) return FALLBACK_PLANS;
  try {
    const res = await fetch(billingUrl("/api/billing/plans"), {
      headers: billingHeaders(),
    });
    if (!res.ok) return FALLBACK_PLANS;
    const data = await jsonOrThrow<{ plans?: Plan[] }>(res);
    return data.plans?.length ? data.plans : FALLBACK_PLANS;
  } catch {
    return FALLBACK_PLANS;
  }
}

export async function fetchSubscription(): Promise<Subscription | null> {
  if (!PUSHCARE_API_URL) return null;
  const res = await fetch(billingUrl("/api/billing/subscription"), {
    headers: billingHeaders(),
  });
  if (res.status === 404) return null;
  return jsonOrThrow<{ subscription: Subscription }>(res).then((d) => d.subscription);
}

export async function changePlan(planCode: string): Promise<Subscription> {
  if (!PUSHCARE_API_URL) throw new Error("API not configured");
  const res = await fetch(billingUrl("/api/billing/subscription"), {
    method: "POST",
    headers: billingHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ plan_code: planCode }),
  });
  return jsonOrThrow<{ subscription: Subscription }>(res).then((d) => d.subscription);
}

export async function fetchUsage(): Promise<UsagePoint[]> {
  if (!PUSHCARE_API_URL) return [];
  const res = await fetch(billingUrl("/api/billing/usage"), {
    headers: billingHeaders(),
  });
  if (!res.ok) return [];
  const data = await jsonOrThrow<{ usage?: UsagePoint[] }>(res);
  return data.usage ?? [];
}
