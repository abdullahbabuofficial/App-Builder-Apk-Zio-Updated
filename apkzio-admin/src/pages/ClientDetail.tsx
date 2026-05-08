import { Link, useParams } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { StatusPill } from "@/components/ui/Badge";
import { Icon } from "@/lib/icons";
import { compact, dateTime, relTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApkzio } from "@/context/ApkzioDataContext";
import * as api from "@/lib/api";
import {
  ADMIN_CLIENT_DETAIL_DEMO,
  ADMIN_CLIENTS_DEMO,
} from "@/lib/admin-clients-demo";

function demoDetailFromSummary(s: api.AdminClientSummary): api.AdminClientDetail {
  return {
    summary: s,
    profile: {
      id: s.id,
      email: s.email,
      full_name: s.full_name,
      plan: s.plan,
      email_verified: s.email_verified,
      created_at: s.created_at,
    },
    apps: [],
    builds: [],
    subscriptions: [],
    payments: [],
    invoices: [],
    cart: { items_count: 0, promo_code: null },
    contact_messages: [],
  };
}

export function ClientDetail() {
  const { userId = "" } = useParams();
  const decodedId = decodeURIComponent(userId);
  const { dataSource, useLiveApi } = useApkzio();
  const [tab, setTab] = useState("overview");
  const [detail, setDetail] = useState<api.AdminClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isMock = dataSource === "mock";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isMock) {
        const rich = ADMIN_CLIENT_DETAIL_DEMO[decodedId];
        if (rich) {
          setDetail(rich);
          return;
        }
        const summary = ADMIN_CLIENTS_DEMO.find((c) => c.id === decodedId);
        if (summary) {
          setDetail(demoDetailFromSummary(summary));
          return;
        }
        setDetail(null);
        setError("Demo client id not found.");
        return;
      }
      if (!useLiveApi) {
        setDetail(null);
        setError("Enable REST with `VITE_APKZIO_API_URL` to load client profiles.");
        return;
      }
      const d = await api.fetchAdminClientDetail(decodedId);
      setDetail(d);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load client";
      setError(msg);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [decodedId, isMock, useLiveApi]);

  useEffect(() => {
    void load();
  }, [load]);

  const s = detail?.summary;

  return (
    <>
      <PageHeader
        title={s ? s.full_name : "Client profile"}
        description={
          s
            ? `${s.email} · Plan ${s.plan} · Created ${dateTime(s.created_at)}`
            : "360° view — billing, product usage, and risk signals."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/clients">
              <Button variant="secondary" leading={<Icon.ArrowLeft size={14} />}>
                Directory
              </Button>
            </Link>
            <Button variant="secondary" leading={<Icon.Search size={14} />} onClick={() => void load()}>
              Refresh
            </Button>
          </div>
        }
      />

      {loading && (
        <div className="mb-6 font-mono text-[12px] text-bone-mid">Loading client record…</div>
      )}
      {error && (
        <Card className="mb-6 border-rose-500/35 bg-rose-500/10">
          <div className="p-4 text-[13px] text-rose-100">{error}</div>
        </Card>
      )}

      {!loading && detail && (
        <>
          <div className="mb-6 flex flex-wrap gap-3">
            <StatusPill status={detail.summary.account_status} />
            <span
              className={cn(
                "chip font-mono text-[11px]",
                detail.summary.email_verified ? "text-ok" : "text-warn",
              )}
            >
              {detail.summary.email_verified ? "Email verified" : "Email not verified"}
            </span>
            {detail.summary.google_linked ? (
              <span className="chip font-mono text-[11px] text-bone-mid">Google linked</span>
            ) : (
              <span className="chip font-mono text-[11px] text-bone-mid">Password auth</span>
            )}
          </div>

          <Tabs
            variant="underline"
            value={tab}
            onChange={setTab}
            className="mb-6"
            tabs={[
              { value: "overview", label: "Overview" },
              {
                value: "billing",
                label: "Billing",
                count: detail.subscriptions.length + detail.invoices.length,
              },
              { value: "product", label: "Apps & builds", count: detail.apps.length + detail.builds.length },
              { value: "engagement", label: "Engagement", count: detail.contact_messages.length },
              { value: "roadmap", label: "Enterprise roadmap" },
            ]}
          />

          {tab === "overview" && (
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader title="Profile" description="Identity & workspace" />
                <CardBody className="grid gap-3 text-[13px] text-bone">
                  <Row label="User id" value={detail.profile.id} breakAll />
                  <Row label="Email" value={detail.profile.email} />
                  <Row label="Plan" value={detail.profile.plan} />
                  <Row label="Phone" value={detail.profile.phone ?? "—"} />
                  <Row label="Location" value={detail.profile.location ?? "—"} />
                  <Row label="Website" value={detail.profile.website ?? "—"} />
                  <Row label="Bio" value={detail.profile.bio ?? "—"} />
                </CardBody>
              </Card>
              <div className="flex flex-col gap-4">
                <Card>
                  <CardHeader title="Usage snapshot" description="Product & billing signals" />
                  <CardBody className="grid gap-2 text-[13px]">
                    <Metric label="Apps" value={compact(detail.summary.apps_count)} />
                    <Metric label="Builds" value={compact(detail.summary.builds_count)} />
                    <Metric label="Active subscriptions" value={compact(detail.summary.active_subscriptions)} />
                    <Metric label="Lifetime revenue" value={`$${compact(detail.summary.lifetime_revenue)}`} />
                    <Metric
                      label="Last activity"
                      value={
                        detail.summary.last_seen_at
                          ? relTime(detail.summary.last_seen_at)
                          : "No sessions yet"
                      }
                    />
                    <Metric label="Open cart lines" value={compact(detail.cart.items_count)} />
                  </CardBody>
                </Card>
                <Card className="border-dashed border-line-2">
                  <CardHeader title="Internal notes" description="Operator-only context" />
                  <CardBody className="text-[12px] leading-relaxed text-bone-mid">
                    SLA tiers, contract flags, and operator notes ship in phase 2 — see{" "}
                    <span className="font-mono text-[11px] text-bone">docs/ENTERPRISE_CLIENTS_MODULE.md</span>.
                  </CardBody>
                </Card>
              </div>
            </div>
          )}

          {tab === "billing" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader title="Subscriptions" description="Plans & renewals" />
                <CardBody padded={false} className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-line-1 text-bone-low">
                        <th className="px-4 py-2 text-left font-mono text-[10px] uppercase">Plan</th>
                        <th className="px-4 py-2 text-left font-mono text-[10px] uppercase">Status</th>
                        <th className="px-4 py-2 text-right font-mono text-[10px] uppercase">MRR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.subscriptions.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-bone-mid">
                            No subscription rows (checkout creates them in local-api).
                          </td>
                        </tr>
                      ) : (
                        detail.subscriptions.map((sub) => (
                          <tr key={sub.id} className="border-b border-line-1/70">
                            <td className="px-4 py-2 text-bone">{sub.plan_name}</td>
                            <td className="px-4 py-2">
                              <StatusPill status={sub.status} />
                            </td>
                            <td className="px-4 py-2 text-right font-mono">${compact(sub.amount)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Cash collection" description="Payments & invoices" />
                <CardBody className="space-y-4">
                  <div>
                    <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-low">
                      Recent payments
                    </div>
                    <div className="space-y-2 text-[13px]">
                      {detail.payments.length === 0 ? (
                        <div className="text-bone-mid">No payments recorded.</div>
                      ) : (
                        detail.payments.slice(0, 12).map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between rounded-lg border border-line-1 px-3 py-2"
                          >
                            <div>
                              <div className="font-mono text-[11px] text-bone-low">{relTime(p.created_at)}</div>
                              <StatusPill status={p.status} />
                            </div>
                            <div className="font-mono text-bone">${compact(p.amount)}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-low">
                      Invoices
                    </div>
                    <div className="space-y-2 text-[13px]">
                      {detail.invoices.length === 0 ? (
                        <div className="text-bone-mid">No invoices.</div>
                      ) : (
                        detail.invoices.slice(0, 12).map((inv) => (
                          <div
                            key={inv.id}
                            className="flex items-center justify-between rounded-lg border border-line-1 px-3 py-2"
                          >
                            <div>
                              <div className="font-medium text-bone">{inv.number}</div>
                              <div className="font-mono text-[11px] text-bone-low">{inv.status}</div>
                            </div>
                            <div className="font-mono">${compact(inv.total)}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>
          )}

          {tab === "product" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader title="Apps" description="Owned applications" />
                <CardBody padded={false} className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-line-1 text-bone-low">
                        <th className="px-4 py-2 text-left font-mono text-[10px] uppercase">App</th>
                        <th className="px-4 py-2 text-left font-mono text-[10px] uppercase">Status</th>
                        <th className="px-4 py-2 text-right font-mono text-[10px] uppercase">Open</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.apps.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-bone-mid">
                            No linked apps yet.
                          </td>
                        </tr>
                      ) : (
                        detail.apps.map((ap) => (
                          <tr key={ap.id} className="border-b border-line-1/70">
                            <td className="px-4 py-2">
                              <div className="font-medium text-bone">{ap.name}</div>
                              <div className="font-mono text-[11px] text-bone-low">{ap.package_name}</div>
                            </td>
                            <td className="px-4 py-2">
                              <StatusPill status={ap.status} />
                            </td>
                            <td className="px-4 py-2 text-right">
                              <Link
                                className="font-mono text-[11px] text-signal hover:underline"
                                to={`/apps/${encodeURIComponent(ap.id)}`}
                              >
                                Console
                              </Link>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Builds" description="Recent WebView builds" />
                <CardBody padded={false} className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-line-1 text-bone-low">
                        <th className="px-4 py-2 text-left font-mono text-[10px] uppercase">Version</th>
                        <th className="px-4 py-2 text-left font-mono text-[10px] uppercase">Status</th>
                        <th className="px-4 py-2 text-right font-mono text-[10px] uppercase">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.builds.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-bone-mid">
                            No builds attributed to this account.
                          </td>
                        </tr>
                      ) : (
                        detail.builds.map((b) => (
                          <tr key={b.id} className="border-b border-line-1/70">
                            <td className="px-4 py-2 font-mono text-bone">
                              {b.version_name}{" "}
                              <span className="text-bone-low">({b.version_code})</span>
                            </td>
                            <td className="px-4 py-2">
                              <StatusPill status={b.status} />
                            </td>
                            <td className="px-4 py-2 text-right text-bone-mid">
                              {relTime(b.build_started_at)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </CardBody>
              </Card>
            </div>
          )}

          {tab === "engagement" && (
            <Card>
              <CardHeader title="Contact threads" description="Inbound messages (same email)" />
              <CardBody className="space-y-3 text-[13px]">
                {detail.contact_messages.length === 0 ? (
                  <div className="text-bone-mid">No contact form threads for this email.</div>
                ) : (
                  detail.contact_messages.map((m) => (
                    <div key={m.id} className="rounded-lg border border-line-1 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-medium text-bone">{m.subject ?? "(no subject)"}</div>
                        <div className="font-mono text-[11px] text-bone-low">{relTime(m.created_at)}</div>
                      </div>
                      <div className="mt-1 font-mono text-[11px] text-bone-mid">
                        {m.topic ?? "general"}
                      </div>
                    </div>
                  ))
                )}
              </CardBody>
            </Card>
          )}

          {tab === "roadmap" && (
            <Card>
              <CardHeader title="Enterprise roadmap" description="What ships next for client CRM" />
              <CardBody className="max-w-none text-[13px] leading-relaxed text-bone-mid">
                <ul className="list-disc space-y-2 pl-5">
                  <li>Stripe / ledger sync, tax IDs, and credit holds</li>
                  <li>Health scores, churn prediction, and expansion cues</li>
                  <li>Per-tenant RBAC, impersonation audit trail, and SOC2 exports</li>
                  <li>Segments, lifecycle campaigns, and success-team queues</li>
                  <li>Supabase-backed persistent directory replacing in-memory dev store</li>
                </ul>
                <p className="mt-4">
                  Full breakdown: repository file{" "}
                  <code className="rounded bg-ink-3 px-1 py-0.5 font-mono text-[11px] text-bone">
                    docs/ENTERPRISE_CLIENTS_MODULE.md
                  </code>
                  .
                </p>
              </CardBody>
            </Card>
          )}
        </>
      )}
    </>
  );
}

function Row({ label, value, breakAll }: { label: string; value: string; breakAll?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-4">
      <div className="min-w-[120px] font-mono text-[10px] uppercase tracking-[0.14em] text-bone-low">
        {label}
      </div>
      <div className={cn("text-bone", breakAll && "break-all font-mono text-[12px]")}>{value}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line-1/60 py-2 last:border-0">
      <span className="text-bone-mid">{label}</span>
      <span className="font-display text-[18px] font-semibold tabular-nums text-bone">{value}</span>
    </div>
  );
}
