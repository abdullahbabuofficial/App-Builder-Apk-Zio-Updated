import { Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusPill } from "@/components/ui/Badge";
import { Icon } from "@/lib/icons";
import { compact, dateTime, relTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApkzio } from "@/context/ApkzioDataContext";
import * as api from "@/lib/api";
import { ADMIN_CLIENTS_DEMO } from "@/lib/admin-clients-demo";
import { apkzioApiHostname } from "@/lib/config";
import { ClientsDirectorySkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/Misc";

function csvCell(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportClientsCsv(clients: api.AdminClientSummary[]) {
  const header = [
    "id",
    "full_name",
    "email",
    "account_status",
    "plan",
    "email_verified",
    "google_linked",
    "apps_count",
    "builds_count",
    "active_subscriptions",
    "lifetime_revenue",
    "last_seen_at",
    "created_at",
  ];
  const lines = clients.map((c) =>
    [
      c.id,
      c.full_name,
      c.email,
      c.account_status,
      c.plan,
      c.email_verified ? "true" : "false",
      c.google_linked ? "true" : "false",
      c.apps_count,
      c.builds_count,
      c.active_subscriptions,
      c.lifetime_revenue,
      c.last_seen_at ?? "",
      c.created_at,
    ]
      .map(csvCell)
      .join(","),
  );
  const csv = [header.map(csvCell).join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `apkzio-clients-${new Date().toISOString().slice(0, 10)}.csv`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function Clients() {
  const { dataSource, useLiveApi } = useApkzio();
  const [q, setQ] = useState("");
  const [plan, setPlan] = useState<string>("");
  const [lifecycle, setLifecycle] = useState<string>("");
  const [authFilter, setAuthFilter] = useState<string>("");
  const limit = 80;
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<api.AdminClientSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMock = dataSource === "mock";

  const filteredDemo = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = ADMIN_CLIENTS_DEMO;
    if (needle) {
      list = list.filter(
        (c) =>
          c.email.toLowerCase().includes(needle) ||
          c.full_name.toLowerCase().includes(needle) ||
          c.id.toLowerCase().includes(needle),
      );
    }
    if (plan === "starter" || plan === "pro" || plan === "business" || plan === "enterprise") {
      list = list.filter((c) => c.plan === plan);
    }
    if (lifecycle === "lead" || lifecycle === "active" || lifecycle === "churned") {
      list = list.filter((c) => c.account_status === lifecycle);
    }
    if (authFilter === "google") list = list.filter((c) => c.google_linked);
    if (authFilter === "password") list = list.filter((c) => !c.google_linked);
    return list;
  }, [q, plan, lifecycle, authFilter]);

  const load = useCallback(async () => {
    if (isMock) {
      setRows(filteredDemo);
      setTotal(filteredDemo.length);
      setError(null);
      setLoading(false);
      return;
    }
    if (!useLiveApi) {
      setRows([]);
      setTotal(0);
      setError("Enable REST (`VITE_APKZIO_API_URL`) to load customer accounts from the API.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.fetchAdminClients({
        q: q.trim() || undefined,
        plan: plan || undefined,
        status:
          lifecycle === "lead" || lifecycle === "active" || lifecycle === "churned"
            ? lifecycle
            : undefined,
        google_linked:
          authFilter === "google" ? true : authFilter === "password" ? false : undefined,
        offset: 0,
        limit,
      });
      setTotal(res.total);
      setRows(res.clients);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load clients";
      setError(
        msg.toLowerCase().includes("forbidden")
          ? `${msg} — when ENFORCE_ADMIN_AUTH is on, set VITE_APKZIO_ADMIN_API_KEY (internal consoles only) or use a verified business/enterprise operator account that local-api recognizes.`
          : msg,
      );
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [authFilter, filteredDemo, isMock, lifecycle, plan, q, useLiveApi, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  const hostname = apkzioApiHostname();

  if (dataSource !== "rest") {
    return (
      <>
        <PageHeader
          title="Clients"
          description="Enterprise directory of customer accounts"
        />
        <EmptyState
          icon={<Icon.Users size={20} />}
          title="Admin Clients requires REST API"
          description="Client CRM endpoints are not available in mock or Supabase mode. Set VITE_APKZIO_DATA_SOURCE=rest and configure VITE_APKZIO_API_URL to access client management."
          action={
            <Link to="/settings">
              <Button variant="primary">Configure API</Button>
            </Link>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Clients"
        description="Enterprise directory of customer accounts: lifecycle status, plans, product usage, billing signals, and verified identity. Pub-site sign-ups and linked Google accounts sync here when served by `local-api`."
        actions={
          <>
            <Button
              variant="secondary"
              leading={<Icon.Copy size={14} />}
              disabled={rows.length === 0}
              onClick={() => exportClientsCsv(rows)}
            >
              Export CSV
            </Button>
            <Button
              variant="secondary"
              leading={<Icon.Search size={14} />}
              onClick={() => void load()}
              disabled={loading}
            >
              Refresh
            </Button>
          </>
        }
      />

      {!isMock && dataSource === "supabase" && (
        <Card className="mb-5 border-warn/30 bg-warn/5">
          <div className="p-4 text-[13px] text-bone">
            <div className="font-medium text-warn">Supabase data mode</div>
            <p className="mt-1 text-bone-mid">
              Client CRM endpoints live on the HTTP API (`/api/admin/clients`). Set{" "}
              <span className="font-mono text-[11px]">VITE_APKZIO_DATA_SOURCE=rest</span> with{" "}
              <span className="font-mono text-[11px]">VITE_APKZIO_API_URL</span> to query customer
              accounts, or follow the unified billing migration in{" "}
              <span className="font-mono text-[11px]">docs/ENTERPRISE_CLIENTS_MODULE.md</span>.
            </p>
          </div>
        </Card>
      )}

      <Card className="mb-5">
        <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-end">
          <Input
            placeholder="Search name, email, or user id…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            leading={<Icon.Search size={14} />}
            className="flex-1"
          />
          <div className="flex flex-wrap gap-2">
            {(["", "starter", "pro", "business", "enterprise"] as const).map((p) => (
              <button
                key={p || "all"}
                type="button"
                onClick={() => setPlan(p)}
                className={cn(
                  "rounded-md border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors",
                  plan === p
                    ? "border-signal/50 bg-signal/10 text-signal"
                    : "border-line-1 text-bone-mid hover:border-line-2 hover:text-bone",
                )}
              >
                {p ? p : "All plans"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-line-1 px-4 py-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-low">
            Lifecycle
          </div>
          <div className="flex flex-wrap gap-2">
            {(["", "lead", "active", "churned"] as const).map((s) => (
              <button
                key={s || "all-life"}
                type="button"
                onClick={() => setLifecycle(s)}
                className={cn(
                  "rounded-md border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors",
                  lifecycle === s
                    ? "border-signal/50 bg-signal/10 text-signal"
                    : "border-line-1 text-bone-mid hover:border-line-2 hover:text-bone",
                )}
              >
                {s ? s : "All statuses"}
              </button>
            ))}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-low">
            Sign-in
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: "", label: "Any" },
                { id: "google", label: "Google" },
                { id: "password", label: "Password" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id || "any-auth"}
                type="button"
                onClick={() => setAuthFilter(opt.id)}
                className={cn(
                  "rounded-md border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors",
                  authFilter === opt.id
                    ? "border-signal/50 bg-signal/10 text-signal"
                    : "border-line-1 text-bone-mid hover:border-line-2 hover:text-bone",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-line-1 px-4 py-3 text-[11px] text-bone-mid">
          <span className="inline-flex items-center gap-1.5 font-mono">
            <span className="live-dot" />
            {loading ? "Loading…" : isMock ? "Demo dataset" : hostname ? hostname : "REST API"}
          </span>
          <span>·</span>
          <span>
            {compact(total)} account{total === 1 ? "" : "s"}
            {!isMock && total > rows.length ? (
              <span className="text-warn">
                {" "}
                (showing first {rows.length} — raise limit or add pagination per{" "}
                <span className="font-mono text-[10px]">ENTERPRISE_CLIENTS_MODULE.md</span>)
              </span>
            ) : null}
          </span>
        </div>
      </Card>

      {error && (
        <Card className="mb-5 border-rose-500/35 bg-rose-500/10">
          <div className="p-4 text-[13px] text-rose-100">{error}</div>
        </Card>
      )}

      <Card>
        {loading && !isMock && rows.length === 0 ? (
          <ClientsDirectorySkeleton />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-[13px]">
            <thead>
              <tr className="border-b border-line-1 text-bone-low">
                <th className="sticky left-0 z-20 bg-ink-1 px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.14em] shadow-[4px_0_12px_-6px_rgba(0,0,0,0.45)]">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.14em]">
                  Customer
                </th>
                <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.14em]">
                  Identity
                </th>
                <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.14em]">
                  Plan
                </th>
                <th className="hidden px-4 py-3 text-right font-mono text-[10px] uppercase tracking-[0.14em] xl:table-cell">
                  Apps
                </th>
                <th className="hidden px-4 py-3 text-right font-mono text-[10px] uppercase tracking-[0.14em] xl:table-cell">
                  Builds
                </th>
                <th className="hidden px-4 py-3 text-right font-mono text-[10px] uppercase tracking-[0.14em] lg:table-cell">
                  Active subs
                </th>
                <th className="hidden px-4 py-3 text-right font-mono text-[10px] uppercase tracking-[0.14em] lg:table-cell">
                  LTV
                </th>
                <th className="hidden px-4 py-3 text-right font-mono text-[10px] uppercase tracking-[0.14em] md:table-cell">
                  Last active
                </th>
                <th className="hidden px-4 py-3 text-right font-mono text-[10px] uppercase tracking-[0.14em] md:table-cell">
                  Created
                </th>
                <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-[0.14em]">
                  Open
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={11} className="px-4 py-16 text-center text-bone-mid">
                    <div className="mx-auto max-w-md">
                      <div className="font-display text-[16px] font-semibold text-bone">No rows yet</div>
                      <p className="mt-2 text-[13px] leading-relaxed">
                        Customer accounts appear after pub-site registration (
                        <span className="font-mono text-[11px]">/api/auth/register</span> or{" "}
                        <span className="font-mono text-[11px]">/api/auth/google</span>
                        ). Enable REST with a running <span className="font-mono text-[11px]">local-api</span>{" "}
                        instance, or switch to mock mode to preview the enterprise layout.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : null}
              {rows.map((c) => (
                <tr key={c.id} className="group border-b border-line-1/80 hover:bg-ink-2/40">
                  <td className="sticky left-0 z-10 bg-ink-1 px-4 py-3 align-middle shadow-[4px_0_12px_-6px_rgba(0,0,0,0.35)] group-hover:bg-ink-2/80">
                    <StatusPill status={c.account_status} />
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="font-medium text-bone">{c.full_name}</div>
                    <div className="font-mono text-[11px] text-bone-low">{c.email}</div>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex flex-wrap gap-1.5">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 font-mono text-[10px]",
                          c.email_verified ? "bg-ok/15 text-ok" : "bg-warn/15 text-warn",
                        )}
                      >
                        {c.email_verified ? "Verified" : "Unverified"}
                      </span>
                      {c.google_linked ? (
                        <span className="rounded bg-ink-3 px-1.5 py-0.5 font-mono text-[10px] text-bone-mid">
                          Google
                        </span>
                      ) : (
                        <span className="rounded bg-ink-3 px-1.5 py-0.5 font-mono text-[10px] text-bone-mid">
                          Password
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle capitalize text-bone">{c.plan}</td>
                  <td className="hidden px-4 py-3 text-right align-middle font-mono text-bone xl:table-cell">
                    {compact(c.apps_count)}
                  </td>
                  <td className="hidden px-4 py-3 text-right align-middle font-mono text-bone xl:table-cell">
                    {compact(c.builds_count)}
                  </td>
                  <td className="hidden px-4 py-3 text-right align-middle font-mono text-bone lg:table-cell">
                    {compact(c.active_subscriptions)}
                  </td>
                  <td className="hidden px-4 py-3 text-right align-middle font-mono text-bone lg:table-cell">
                    ${compact(c.lifetime_revenue)}
                  </td>
                  <td className="hidden px-4 py-3 text-right align-middle text-bone-mid md:table-cell">
                    {c.last_seen_at ? (
                      <span title={dateTime(c.last_seen_at)}>{relTime(c.last_seen_at)}</span>
                    ) : (
                      <span className="text-bone-low">—</span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-right align-middle text-bone-mid md:table-cell">
                    <span title={dateTime(c.created_at)}>{relTime(c.created_at)}</span>
                  </td>
                  <td className="px-4 py-3 text-right align-middle">
                    <Link
                      to={`/clients/${encodeURIComponent(c.id)}`}
                      className="inline-flex items-center gap-1 font-mono text-[11px] text-signal hover:underline"
                    >
                      Profile <Icon.ChevronRight size={12} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </Card>
    </>
  );
}
