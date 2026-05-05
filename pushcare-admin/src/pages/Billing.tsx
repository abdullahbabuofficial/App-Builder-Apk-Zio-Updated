import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { BarChart } from "@/components/charts/MiniCharts";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { dateTime } from "@/lib/format";
import {
  changePlan,
  fetchPlans,
  fetchSubscription,
  fetchUsage,
  type Subscription,
  type UsagePoint,
} from "@/lib/billing";
import { FALLBACK_PLANS, formatPlanPrice, formatPushQuota, type Plan } from "@/lib/plans";

const INVOICES = [
  { id: "INV-202504", amount: 99,  status: "paid", date: "2025-04-01" },
  { id: "INV-202503", amount: 99,  status: "paid", date: "2025-03-01" },
  { id: "INV-202502", amount: 99,  status: "paid", date: "2025-02-01" },
  { id: "INV-202501", amount: 99,  status: "paid", date: "2025-01-01" },
];

function monthLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short" });
  } catch {
    return iso.slice(0, 7);
  }
}

export function Billing() {
  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsagePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void Promise.all([fetchPlans(), fetchSubscription(), fetchUsage()])
      .then(([p, s, u]) => {
        if (!alive) return;
        setPlans(p.length ? p : FALLBACK_PLANS);
        setSub(s);
        setUsage(u);
      })
      .catch((e) => {
        if (alive) setErr(e instanceof Error ? e.message : "Could not load billing");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  async function handleSwitch(code: string) {
    setSwitching(code);
    setErr(null);
    try {
      const updated = await changePlan(code);
      setSub(updated);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not change plan");
    } finally {
      setSwitching(null);
    }
  }

  const currentCode = sub?.plan_code ?? "free";
  const currentPlan = useMemo(() => plans.find((p) => p.code === currentCode) ?? plans[0], [plans, currentCode]);
  const usageRows = useMemo(
    () =>
      usage.slice(-12).map((u) => ({
        label: monthLabel(u.month),
        value: u.pushes_sent,
        color: "#CDFF3F",
      })),
    [usage],
  );

  return (
    <>
      <PageHeader
        title="Billing"
        description="Subscription, plan changes, usage, and invoices."
      />

      {err && (
        <div className="mb-6 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
          {err}
        </div>
      )}

      <div className="space-y-6">
        <Card>
          <CardHeader title="Current plan" />
          <CardBody>
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-signal/30 bg-signal/5 p-5">
              <div className="grid h-12 w-12 place-items-center rounded-lg bg-signal/20 text-signal">
                <Icon.Zap size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-[20px] font-semibold text-bone">
                  {sub?.plan_name ?? currentPlan?.name ?? "Free"}
                </div>
                <div className="text-[13px] text-bone-mid">
                  {sub
                    ? `${formatPushQuota(sub.monthly_pushes)} · ${sub.max_apps || "∞"} apps · ${sub.max_seats || "∞"} seats`
                    : currentPlan
                      ? `${formatPushQuota(currentPlan.monthly_pushes)} · ${currentPlan.max_apps || "∞"} apps · ${currentPlan.max_seats || "∞"} seats`
                      : "Loading plan…"}
                </div>
                {sub?.current_period_end && (
                  <div className="mt-1 font-mono text-[11px] text-bone-low">
                    Renews {dateTime(sub.current_period_end)}
                  </div>
                )}
              </div>
              <div className="text-right">
                {(() => {
                  const price = formatPlanPrice(sub?.monthly_price ?? currentPlan?.monthly_price ?? 0);
                  return (
                    <>
                      <div className="font-display text-[28px] font-semibold text-bone num">{price.value}</div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-low">
                        {price.suffix ?? ""}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
            {loading && <div className="mt-4 font-mono text-[11px] text-bone-low">Loading subscription…</div>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Plans" description="Switch your subscription instantly. Prorated to the day." />
          <CardBody>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {plans.map((p) => {
                const price = formatPlanPrice(p.monthly_price);
                const isCurrent = p.code === currentCode;
                return (
                  <div
                    key={p.code}
                    className={cn(
                      "flex flex-col rounded-xl border bg-ink-1 p-5",
                      isCurrent ? "border-signal/40 shadow-signal-glow" : "border-line-1",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-display text-[18px] font-semibold text-bone">{p.name}</div>
                      {isCurrent && <Badge tone="signal" dot>Current</Badge>}
                    </div>
                    <div className="mt-1 text-[12px] text-bone-mid">{formatPushQuota(p.monthly_pushes)}</div>
                    <div className="mt-4 flex items-baseline gap-1.5">
                      <span className="font-display text-[32px] font-semibold leading-none text-bone num">
                        {price.value}
                      </span>
                      {price.suffix && (
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-low">
                          {price.suffix}
                        </span>
                      )}
                    </div>
                    <ul className="mt-4 space-y-1.5 text-[12.5px] text-bone-mid">
                      {p.features.slice(0, 5).map((f) => (
                        <li key={f} className="flex items-start gap-1.5">
                          <Icon.Check size={12} className="mt-0.5 shrink-0 text-signal" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-5">
                      {p.contact_sales ? (
                        <a href="mailto:sales@pushcare.io">
                          <Button variant="outline" size="md" fullWidth>Contact sales</Button>
                        </a>
                      ) : isCurrent ? (
                        <Button variant="ghost" size="md" fullWidth disabled>Current plan</Button>
                      ) : (
                        <Button
                          variant="primary"
                          size="md"
                          fullWidth
                          disabled={switching !== null}
                          onClick={() => void handleSwitch(p.code)}
                        >
                          {switching === p.code ? "Switching…" : `Switch to ${p.name}`}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Usage" description="Pushes sent over the last 12 months." />
          <CardBody>
            {usageRows.length > 0 ? (
              <BarChart rows={usageRows} format={(n) => n.toLocaleString()} />
            ) : (
              <div className="rounded-lg border border-dashed border-line-1 bg-ink-2/40 p-6 text-center">
                <div className="font-display text-[14px] text-bone">No usage data yet</div>
                <p className="mt-1 text-[12px] text-bone-mid">
                  Once you start sending pushes, monthly totals appear here.
                </p>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Invoices" />
          <CardBody padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-line-1 text-bone-low">
                    <th className="px-5 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em]">Invoice</th>
                    <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em]">Date</th>
                    <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.14em]">Amount</th>
                    <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em]">Status</th>
                    <th className="px-5 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {INVOICES.map((inv) => (
                    <tr key={inv.id} className="border-b border-line-1/70 last:border-b-0 hover:bg-ink-2/60">
                      <td className="px-5 py-3 font-mono text-bone">{inv.id}</td>
                      <td className="px-4 py-3 text-bone-mid">{dateTime(inv.date)}</td>
                      <td className="px-4 py-3 text-right font-mono num text-bone">${inv.amount}.00</td>
                      <td className="px-4 py-3"><Badge tone="ok" dot>Paid</Badge></td>
                      <td className="px-5 py-3 text-right">
                        <Button variant="ghost" size="sm" leading={<Icon.External size={12} />}>PDF</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
