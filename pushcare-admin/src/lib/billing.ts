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

/**
 * Backend `Plan` shape (matches `backends/local-api/src/store.ts` and
 * `supabase/migrations/...006_*.sql`). The frontend `Plan` (lib/plans.ts) uses
 * a flatter, marketing-friendly shape with `monthly_price` instead of
 * `monthly_price_usd` and `features: string[]` instead of a JSONB record. We
 * translate at the API boundary so pages can stay simple.
 */
type ApiPlan = {
  id: string;
  code: "free" | "pro" | "enterprise" | string;
  name: string;
  monthly_pushes: number;
  max_apps: number;
  max_seats: number;
  monthly_price_usd: number;
  features: Record<string, unknown> | unknown[] | null;
  sort_order?: number;
};

type ApiSubscription = {
  id: string;
  plan_id: string;
  plan_code: string;
  status: "trialing" | "active" | "past_due" | "cancelled" | "canceled";
  current_period_start: string;
  current_period_end: string;
  cancel_at: string | null;
  stripe_customer_id: string | null;
};

/** Maps backend feature flag keys to human-readable labels for marketing cards. */
const FEATURE_LABELS: Record<string, string | ((value: unknown) => string)> = {
  push_send: "Push notifications",
  analytics_basic: "Basic analytics",
  analytics_advanced: "Advanced analytics",
  retention_days: (days) => `${String(days)}-day retention`,
  retention_7d: "7-day retention",
  retention_30d: "30-day retention",
  retention_90d: "90-day retention",
  webhooks: "Webhooks",
  segments: "Segments",
  audit_log: "Audit log",
  sso: "SAML SSO",
  scim: "SCIM provisioning",
  sla: (s) => `${String(s)} uptime SLA`,
};

function labelForFeature(key: string, value: unknown): string | null {
  const entry = FEATURE_LABELS[key];
  if (typeof entry === "function") return entry(value);
  if (typeof entry === "string") return entry;
  // Unknown feature key — fall back to a humanised version of the key.
  if (value === true) {
    return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  if (typeof value === "string" || typeof value === "number") {
    const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return `${label}: ${String(value)}`;
  }
  return null;
}

/** Convert backend `features` (JSONB record or array) into a string list for display. */
function normaliseFeatures(features: ApiPlan["features"]): string[] {
  if (!features) return [];
  if (Array.isArray(features)) {
    return features
      .map((f) => {
        if (typeof f === "string") return f;
        if (f && typeof f === "object" && "label" in f) return String((f as { label: unknown }).label);
        return null;
      })
      .filter((f): f is string => Boolean(f));
  }
  if (typeof features === "object") {
    const out: string[] = [];
    for (const [key, value] of Object.entries(features)) {
      if (value === false || value == null) continue;
      const label = labelForFeature(key, value);
      if (label) out.push(label);
    }
    return out;
  }
  return [];
}

function transformPlan(p: ApiPlan): Plan {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    monthly_price: p.monthly_price_usd,
    monthly_pushes: p.monthly_pushes,
    max_apps: p.max_apps,
    max_seats: p.max_seats,
    features: normaliseFeatures(p.features),
    popular: p.code === "pro",
    contact_sales: p.code === "enterprise",
  };
}

let billingAccessToken: string | null = null;

/** Set by PushcareDataContext when REST is the active backend. */
export function setBillingAccessToken(token: string | null): void {
  billingAccessToken = token;
}

/** Module-scope cache of plans so `fetchSubscription` doesn't re-fetch on every call. */
let plansCache: Plan[] | null = null;

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
    const data = await jsonOrThrow<{ plans?: ApiPlan[] }>(res);
    if (!data.plans?.length) return FALLBACK_PLANS;
    const transformed = data.plans.map(transformPlan);
    plansCache = transformed;
    return transformed;
  } catch {
    return FALLBACK_PLANS;
  }
}

/** Get cached plans or fetch fresh. Used by `fetchSubscription` to avoid double round-trips. */
async function getPlans(): Promise<Plan[]> {
  if (plansCache) return plansCache;
  const plans = await fetchPlans();
  // Don't cache fallback responses — let the next call retry the API.
  if (plans !== FALLBACK_PLANS) plansCache = plans;
  return plans;
}

function normaliseStatus(s: ApiSubscription["status"]): Subscription["status"] {
  // Backend uses British "cancelled"; frontend uses American "canceled".
  if (s === "cancelled") return "canceled";
  return s as Subscription["status"];
}

function enrichSubscription(api: ApiSubscription, plans: Plan[]): Subscription {
  const plan = plans.find((p) => p.code === api.plan_code);
  return {
    plan_code: api.plan_code,
    plan_name: plan?.name ?? api.plan_code,
    status: normaliseStatus(api.status),
    current_period_start: api.current_period_start,
    current_period_end: api.current_period_end,
    monthly_price: plan?.monthly_price ?? null,
    monthly_pushes: plan?.monthly_pushes ?? 0,
    max_apps: plan?.max_apps ?? 0,
    max_seats: plan?.max_seats ?? 0,
  };
}

export async function fetchSubscription(): Promise<Subscription | null> {
  if (!PUSHCARE_API_URL) return null;
  const res = await fetch(billingUrl("/api/billing/subscription"), {
    headers: billingHeaders(),
  });
  if (res.status === 404) return null;
  const data = await jsonOrThrow<{ subscription: ApiSubscription | null }>(res);
  if (!data.subscription) return null;
  const plans = await getPlans();
  return enrichSubscription(data.subscription, plans);
}

export async function changePlan(planCode: string): Promise<Subscription> {
  if (!PUSHCARE_API_URL) throw new Error("API not configured");
  const res = await fetch(billingUrl("/api/billing/subscription"), {
    method: "POST",
    headers: billingHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ plan_code: planCode }),
  });
  const data = await jsonOrThrow<{ subscription: ApiSubscription }>(res);
  const plans = await getPlans();
  return enrichSubscription(data.subscription, plans);
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
