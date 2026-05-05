import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import {
  FALLBACK_PLANS,
  formatFeatures,
  formatPlanPrice,
  formatPushQuota,
  type Plan,
} from "@/lib/plans";
import { fetchPlans } from "@/lib/billing";

const FAQS = [
  {
    q: "What happens if I exceed my plan's push quota?",
    a: "You won't be cut off mid-campaign. Overage runs at $0.20 per 1,000 additional pushes on Pro and is billed monthly. Free plan stops sending at the quota.",
  },
  {
    q: "How long is analytics data retained?",
    a: "Free retains 7 days, Pro retains 90 days, and Enterprise retains custom durations (1-7 years).",
  },
  {
    q: "Can we run PushCare on-prem?",
    a: "Yes — Enterprise customers can self-host the dispatcher and Postgres in their own cloud. Talk to us about deployment patterns.",
  },
  {
    q: "Is there a free trial of Pro?",
    a: "Pro starts free for 14 days when you upgrade from Free. Cancel anytime — no charge if you cancel before day 15.",
  },
  {
    q: "Can I move my workspace between plans?",
    a: "Up- and down-grades happen instantly. You're prorated for the unused portion of the previous tier.",
  },
];

export function Pricing() {
  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchPlans()
      .then((res) => {
        if (alive) setPlans(res.length ? res : FALLBACK_PLANS);
      })
      .catch(() => {
        if (alive) setPlans(FALLBACK_PLANS);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-ink-0 text-bone">
      {/* Top nav */}
      <header className="sticky top-0 z-30 border-b border-line-1/80 bg-ink-0/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-signal text-ink-0">
              <Icon.Logo size={18} />
            </div>
            <span className="font-display text-[18px] font-semibold tracking-tight">PushCare</span>
          </Link>
          <nav className="hidden items-center gap-6 text-[13px] text-bone-mid sm:flex">
            <Link to="/pricing" className="text-bone">Pricing</Link>
            <Link to="/sign-in" className="hover:text-bone">Sign in</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/sign-in" className="hidden sm:block">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link to="/signup">
              <Button variant="primary" size="sm">Start free</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="border-b border-line-1">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-bone-low">Pricing</div>
            <h1 className="mt-2 font-display text-[44px] font-semibold leading-tight tracking-tight text-bone sm:text-[60px]">
              Pay only for what you push.
            </h1>
            <p className="mt-4 text-[15px] text-bone-mid">
              Predictable monthly tiers. Generous quotas. No per-seat surprises.
              {loading ? " Loading the latest plans…" : ""}
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-3">
            {plans.map((p) => {
              const price = formatPlanPrice(p.monthly_price);
              const isPro = p.popular || p.code === "pro";
              return (
                <div
                  key={p.code}
                  className={cn(
                    "relative flex flex-col rounded-2xl border bg-ink-1 p-7",
                    isPro ? "border-signal/40 shadow-signal-glow" : "border-line-1",
                  )}
                >
                  {isPro && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge tone="signal" dot>Most popular</Badge>
                    </div>
                  )}
                  <div className="font-display text-[22px] font-semibold text-bone">{p.name}</div>
                  <div className="mt-1 text-[12px] text-bone-mid">{formatPushQuota(p.monthly_pushes)}</div>

                  <div className="mt-6 flex items-baseline gap-1.5">
                    <span className="font-display text-[44px] font-semibold leading-none text-bone num">
                      {price.value}
                    </span>
                    {price.suffix && (
                      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-bone-low">
                        {price.suffix}
                      </span>
                    )}
                  </div>

                  <div className="my-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line-1 bg-line-1 text-[12px]">
                    <div className="bg-ink-2/60 px-3 py-2">
                      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-low">Apps</div>
                      <div className="text-bone num">{p.max_apps ? p.max_apps : "∞"}</div>
                    </div>
                    <div className="bg-ink-2/60 px-3 py-2">
                      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-low">Seats</div>
                      <div className="text-bone num">{p.max_seats ? p.max_seats : "∞"}</div>
                    </div>
                  </div>

                  <ul className="space-y-2.5 text-[13px] text-bone-mid">
                    {(p.features?.length ? p.features : formatFeatures(p.features as unknown)).map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Icon.Check size={14} className="mt-0.5 shrink-0 text-signal" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-7 pt-1">
                    {p.contact_sales ? (
                      <a href="mailto:sales@pushcare.io?subject=Enterprise%20inquiry">
                        <Button variant="outline" size="lg" fullWidth trailing={<Icon.ArrowRight size={15} />}>
                          Contact sales
                        </Button>
                      </a>
                    ) : (
                      <Link
                        to={p.code === "free" ? "/signup" : `/signup?plan=${encodeURIComponent(p.code)}`}
                      >
                        <Button
                          variant={isPro ? "primary" : "secondary"}
                          size="lg"
                          fullWidth
                          trailing={<Icon.ArrowRight size={15} />}
                        >
                          {p.code === "free" ? "Start free" : `Choose ${p.name}`}
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-b border-line-1">
        <div className="mx-auto max-w-3xl px-6 py-20">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-bone-low">FAQ</div>
          <h2 className="mt-2 font-display text-[32px] font-semibold tracking-tight text-bone sm:text-[40px]">
            Common questions
          </h2>
          <div className="mt-8 divide-y divide-line-1 rounded-xl border border-line-1 bg-ink-1">
            {FAQS.map((f) => (
              <details key={f.q} className="group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[14px] font-medium text-bone">
                  {f.q}
                  <span className="grid h-6 w-6 place-items-center rounded-md border border-line-1 bg-ink-2 text-bone-low transition-transform group-open:rotate-45">
                    <Icon.Plus size={12} />
                  </span>
                </summary>
                <p className="mt-3 text-[13px] leading-relaxed text-bone-mid">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-ink-0">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="grid h-7 w-7 place-items-center rounded-md bg-signal text-ink-0">
                <Icon.Logo size={15} />
              </div>
              <span className="font-display text-[15px] font-semibold tracking-tight">PushCare</span>
            </Link>
            <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[12px] text-bone-low">
              <Link to="/pricing" className="hover:text-bone">Pricing</Link>
              <Link to="/sign-in" className="hover:text-bone">Sign in</Link>
              <Link to="/signup" className="hover:text-bone">Sign up</Link>
              <Link to="/legal/terms" className="hover:text-bone">Terms</Link>
              <Link to="/legal/privacy" className="hover:text-bone">Privacy</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
