// Subscription plan types + hardcoded fallback for marketing pages.
// Mirrors supabase/migrations/...006_segments_team_webhooks_audit.sql.

export type Plan = {
  /** Backend uuid — present when the plan came from the API; absent on fallback rows. */
  id?: string;
  /** Stable code: free | pro | enterprise (or custom). */
  code: string;
  name: string;
  /** Monthly price in USD; null for "contact us". */
  monthly_price: number | null;
  /** 0 = unlimited (or null). */
  monthly_pushes: number;
  max_apps: number;
  max_seats: number;
  /** Bullet list of features for the marketing card. */
  features: string[];
  /** "Most popular" tag. */
  popular?: boolean;
  /** Show "Contact sales" CTA instead of /signup. */
  contact_sales?: boolean;
};

export const FALLBACK_PLANS: Plan[] = [
  {
    code: "free",
    name: "Free",
    monthly_price: 0,
    monthly_pushes: 100_000,
    max_apps: 1,
    max_seats: 2,
    features: [
      "100k pushes / month",
      "1 Android app",
      "2 team seats",
      "7-day analytics retention",
      "Community support",
    ],
  },
  {
    code: "pro",
    name: "Pro",
    monthly_price: 99,
    monthly_pushes: 5_000_000,
    max_apps: 10,
    max_seats: 10,
    popular: true,
    features: [
      "5M pushes / month",
      "Up to 10 apps",
      "10 team seats",
      "90-day analytics retention",
      "Webhooks + audit log",
      "Priority email support",
    ],
  },
  {
    code: "enterprise",
    name: "Enterprise",
    monthly_price: null,
    monthly_pushes: 0,
    max_apps: 0,
    max_seats: 0,
    contact_sales: true,
    features: [
      "Unlimited pushes",
      "Unlimited apps & seats",
      "Custom retention + on-prem option",
      "SAML SSO + SCIM",
      "99.95% uptime SLA",
      "Dedicated solutions engineer",
    ],
  },
];

/** Renders a feature list — accepts JSONB array, plain strings, or `{ label }` rows. */
export function formatFeatures(features: unknown): string[] {
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
  return [];
}

/** Display helper — "$99 / mo" or "Custom". */
export function formatPlanPrice(price: number | null): { value: string; suffix: string | null } {
  if (price === null) return { value: "Custom", suffix: null };
  if (price === 0) return { value: "$0", suffix: "/ month" };
  return { value: `$${price}`, suffix: "/ month" };
}

/** "5M pushes / mo" — "Unlimited" when 0. */
export function formatPushQuota(n: number): string {
  if (!n) return "Unlimited pushes";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M pushes / mo`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k pushes / mo`;
  return `${n} pushes / mo`;
}
