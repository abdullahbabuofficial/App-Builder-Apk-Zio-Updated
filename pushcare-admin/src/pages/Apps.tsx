import { Link } from "react-router-dom";
import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Tabs } from "@/components/ui/Tabs";
import { StatusPill } from "@/components/ui/Badge";
import { Sparkline } from "@/components/charts/MiniCharts";
import { Icon } from "@/lib/icons";
import { compact, pct, relTime } from "@/lib/format";
import { dailyInstalls } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { usePushcare } from "@/context/PushcareDataContext";

export function Apps() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [q, setQ] = useState("");
  const { apps, loading } = usePushcare();

  const filtered = apps.filter(
    (a) => a.name.toLowerCase().includes(q.toLowerCase()) || a.package_name.includes(q)
  );

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
            <Button variant="primary" leading={<Icon.Plus size={14} />}>Add app</Button>
          </>
        }
      />

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
            <span className="font-mono">{filtered.length} of {apps.length}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1.5"><span className="live-dot" /> {loading ? "Syncing…" : "Live data"}</span>
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
                  <div className={cn("grid h-12 w-12 place-items-center rounded-lg bg-gradient-to-br font-mono text-[14px] font-medium text-bone", a.icon_color)}>
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
                <Sparkline data={dailyInstalls(14, a.id)} width={120} height={36} />
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
                        <div className={cn("grid h-9 w-9 place-items-center rounded-md bg-gradient-to-br font-mono text-[12px] font-medium text-bone", a.icon_color)}>
                          {a.icon_glyph}
                        </div>
                        <div>
                          <div className="font-medium text-bone">{a.name}</div>
                          <div className="font-mono text-[10px] text-bone-low">{a.package_name}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3"><StatusPill status={a.status} /></td>
                    <td className="px-4 py-3 text-right font-mono num text-bone">{compact(a.live_users)}</td>
                    <td className="hidden px-4 py-3 text-right font-mono num text-bone sm:table-cell">{compact(a.active_devices_24h)}</td>
                    <td className="hidden px-4 py-3 text-right font-mono num text-bone-mid md:table-cell">{compact(a.total_installs)}</td>
                    <td className="hidden px-4 py-3 text-right lg:table-cell">
                      <span className="font-mono num text-ok">{pct(a.delivery_rate * 100)}</span>
                    </td>
                    <td className="hidden px-4 py-3 text-right text-bone-low xl:table-cell">{relTime(a.created_at)}</td>
                    <td className="px-5 py-3 text-right">
                      <Link to={`/apps/${a.id}`}>
                        <Button variant="ghost" size="icon" aria-label="Open"><Icon.ArrowRight size={14} /></Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
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
