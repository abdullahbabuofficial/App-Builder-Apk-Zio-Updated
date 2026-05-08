import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Field } from "@/components/ui/Input";
import { Tabs } from "@/components/ui/Tabs";
import { StatusPill } from "@/components/ui/Badge";
import { Sparkline } from "@/components/charts/MiniCharts";
import { Icon } from "@/lib/icons";
import { compact, pct, relTime } from "@/lib/format";
import { dailyInstalls } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { useApkzio } from "@/context/ApkzioDataContext";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

export function Apps() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const { apps, loading, error, useLiveApi, dataSource, createApp, refresh } = useApkzio();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [packageName, setPackageName] = useState("");
  const [fcmProjectId, setFcmProjectId] = useState("");

  const filtered = apps.filter(
    (a) => a.name.toLowerCase().includes(q.toLowerCase()) || a.package_name.includes(q),
  );

  const openAddModal = () => {
    setFormError(null);
    setName("");
    setPackageName("");
    setFcmProjectId("");
    setAddOpen(true);
  };

  const handleCreateApp = async () => {
    setFormError(null);
    const n = name.trim();
    const pkg = packageName.trim();
    if (!n) {
      setFormError("Enter an app display name.");
      return;
    }
    if (!pkg) {
      setFormError("Enter an Android application ID (package name).");
      return;
    }
    if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(pkg)) {
      setFormError("Package name should look like com.example.myapp (lowercase segments).");
      return;
    }
    setSubmitting(true);
    try {
      const row = await createApp({
        name: n,
        package_name: pkg,
        fcm_project_id: fcmProjectId.trim() || null,
      });
      toast({ tone: "success", title: "App created", description: row.name });
      setAddOpen(false);
      navigate(`/apps/${row.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not create app";
      setFormError(msg);
      toast({ tone: "error", title: "Create failed", description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Apps"
        description={`Manage ${apps.length} Android apps across all environments. Tap any app to drill into devices, subscribers, and analytics.`}
        actions={
          <>
            <Tabs
              variant="segmented"
              value={view}
              onChange={(v) => setView(v as "grid" | "list")}
              tabs={[
                { value: "grid", label: <Icon.Layers size={12} /> },
                { value: "list", label: <Icon.Menu size={12} /> },
              ]}
            />
            <Button variant="primary" leading={<Icon.Plus size={14} />} onClick={openAddModal}>
              Add app
            </Button>
          </>
        }
      />

      {error && useLiveApi && (
        <div
          role="alert"
          className="mb-4 flex flex-col gap-2 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-[13px] text-danger">{error}</p>
          <Button variant="ghost" size="sm" onClick={() => void refresh()}>
            Retry load
          </Button>
        </div>
      )}

      <Card className="mb-5">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <Input
            placeholder="Search by name or package…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            leading={<Icon.Search size={14} />}
            className="flex-1"
          />
          <div className="flex items-center gap-2 text-[12px] text-bone-low">
            <span className="font-mono">
              {filtered.length} of {apps.length}
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="live-dot" /> {loading ? "Syncing…" : "Live data"}
            </span>
          </div>
        </div>
      </Card>

      {view === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((a) => (
            <Link
              key={a.id}
              to={`/apps/${a.id}`}
              className="group relative overflow-hidden rounded-xl border border-line-1 bg-ink-1 p-5 transition-all hover:border-line-2 hover:shadow-raise"
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-signal/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "grid h-12 w-12 place-items-center rounded-lg bg-gradient-to-br font-mono text-[14px] font-medium text-bone",
                      a.icon_color,
                    )}
                  >
                    {a.icon_glyph}
                  </div>
                  <div>
                    <div className="font-display text-[16px] font-semibold leading-tight text-bone">{a.name}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-bone-low">{a.package_name}</div>
                  </div>
                </div>
                <StatusPill status={a.status} />
              </div>

              <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-lg bg-line-1">
                <Cell label="Live" value={compact(a.live_users)} />
                <Cell label="Active 24h" value={compact(a.active_devices_24h)} />
                <Cell label="Installs" value={compact(a.total_installs)} />
              </div>

              <div className="mt-4 flex items-end justify-between">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-low">Delivery 7d</div>
                  <div className="mt-0.5 font-display text-[18px] font-semibold text-ok num">{pct(a.delivery_rate * 100)}</div>
                </div>
                <Sparkline data={useLiveApi ? [] : dailyInstalls(14, a.id)} width={120} height={36} />
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-line-1 pt-3 text-[11px] text-bone-low">
                <span>Created {relTime(a.created_at)}</span>
                <span className="inline-flex items-center gap-1 text-bone-mid group-hover:text-signal">
                  Open <Icon.ArrowRight size={11} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line-1 text-bone-low">
                  <th className="px-5 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em]">App</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em]">Status</th>
                  <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.14em]">Live</th>
                  <th className="hidden px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.14em] sm:table-cell">Active</th>
                  <th className="hidden px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.14em] md:table-cell">Installs</th>
                  <th className="hidden px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.14em] lg:table-cell">Delivery</th>
                  <th className="hidden px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.14em] xl:table-cell">Created</th>
                  <th className="px-5 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className="border-b border-line-1/70 hover:bg-ink-2/60">
                    <td className="px-5 py-3">
                      <Link to={`/apps/${a.id}`} className="flex items-center gap-3">
                        <div
                          className={cn(
                            "grid h-9 w-9 place-items-center rounded-md bg-gradient-to-br font-mono text-[12px] font-medium text-bone",
                            a.icon_color,
                          )}
                        >
                          {a.icon_glyph}
                        </div>
                        <div>
                          <div className="font-medium text-bone">{a.name}</div>
                          <div className="font-mono text-[10px] text-bone-low">{a.package_name}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={a.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono num text-bone">{compact(a.live_users)}</td>
                    <td className="hidden px-4 py-3 text-right font-mono num text-bone sm:table-cell">{compact(a.active_devices_24h)}</td>
                    <td className="hidden px-4 py-3 text-right font-mono num text-bone-mid md:table-cell">{compact(a.total_installs)}</td>
                    <td className="hidden px-4 py-3 text-right lg:table-cell">
                      <span className="font-mono num text-ok">{pct(a.delivery_rate * 100)}</span>
                    </td>
                    <td className="hidden px-4 py-3 text-right text-bone-low xl:table-cell">{relTime(a.created_at)}</td>
                    <td className="px-5 py-3 text-right">
                      <Link to={`/apps/${a.id}`}>
                        <Button variant="ghost" size="icon" aria-label="Open">
                          <Icon.ArrowRight size={14} />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={addOpen}
        onClose={() => !submitting && setAddOpen(false)}
        title="Add app"
        description={
          dataSource === "supabase"
            ? "Creates an owner-scoped app row in Supabase using your signed-in user."
            : "Registers a new Android app in ApkZio. You can add FCM later from the API or app settings."
        }
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void handleCreateApp()} disabled={submitting || loading}>
              {submitting ? "Creating…" : "Create app"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {formError && (
            <div role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-[12px] text-danger">
              {formError}
            </div>
          )}
          <Field label="Display name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Awesome App" autoComplete="off" disabled={submitting} />
          </Field>
          <Field label="Package name" hint="Android applicationId, e.g. com.company.product">
            <Input
              value={packageName}
              onChange={(e) => setPackageName(e.target.value)}
              placeholder="com.example.app"
              className="font-mono text-[13px]"
              autoComplete="off"
              disabled={submitting}
            />
          </Field>
          <Field label="FCM project ID (optional)">
            <Input
              value={fcmProjectId}
              onChange={(e) => setFcmProjectId(e.target.value)}
              placeholder="my-firebase-project"
              className="font-mono text-[13px]"
              autoComplete="off"
              disabled={submitting}
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-ink-1 p-3">
      <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-bone-low">{label}</div>
      <div className="mt-0.5 font-display text-[16px] font-semibold leading-none text-bone num">{value}</div>
    </div>
  );
}
