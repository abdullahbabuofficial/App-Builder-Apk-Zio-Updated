import { Link } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { AreaChart } from "@/components/charts/AreaChart";
import { Sparkline, DonutChart, BarChart } from "@/components/charts/MiniCharts";
import { StatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/lib/icons";
import { compact, dateTime, pct, relTime } from "@/lib/format";
import { dailyInstalls } from "@/lib/mock-data";
import type { AndroidApp, Campaign } from "@/lib/mock-data";
import { Tabs } from "@/components/ui/Tabs";
import { useEffect, useState } from "react";
import { useApkzio } from "@/context/ApkzioDataContext";
import { useAnalyticsOverview } from "@/hooks/useAnalyticsOverview";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { apkzioApiHostname } from "@/lib/config";

function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportDashboardCsv(apps: AndroidApp[], campaigns: Campaign[]): void {
  const appRows = apps.map((a) =>
    [
      a.id,
      a.name,
      a.package_name,
      String(a.live_users),
      String(a.active_devices_24h),
      String(a.total_installs),
      String(a.total_pushes_sent),
      a.status,
    ].map(csvCell).join(","),
  );
  const campRows = campaigns.slice(0, 200).map((c) =>
    [c.id, c.app_id, c.title, c.status, c.sent_at ?? "", String(c.delivered_count)].map(csvCell).join(","),
  );
  const csv = [
    "===apps===",
    "id,name,package_name,live_users,active_24h,installs,pushes_sent,status",
    ...appRows,
    "",
    "===campaigns_recent_200===",
    "id,app_id,title,status,sent_at,delivered",
    ...campRows,
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `apkzio-dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function Dashboard() {
  const [range, setRange] = useState("7d");
  const { apps, campaigns, loading, error, dataSource, useLiveApi } = useApkzio();
  const { toast } = useToast();
  const overview = useAnalyticsOverview("global-" + range);
  const days = range === "90d" ? 90 : range === "30d" ? 30 : 7;
  const installs = overview.dailyInstalls.slice(-Math.min(days, overview.dailyInstalls.length));
  const hb = overview.hourlyHeartbeats;
  const geo = overview.geoBreakdown;
  const events = overview.recentEvents.slice(0, 8);

  // Cosmetic: nudges the "Last refreshed" relative-time string in the eyebrow row every 30s
  // so users can see how stale the panel is between full data fetches.
  const [lastRefreshed, setLastRefreshed] = useState(() => Date.now());
  useEffect(() => {
    const handle = window.setInterval(() => setLastRefreshed(Date.now()), 30_000);
    return () => window.clearInterval(handle);
  }, []);

  const sourceEyebrow =
    dataSource === "rest"
      ? `REST · ${apkzioApiHostname() || "API"}`
      : dataSource === "supabase"
        ? "SUPABASE · RLS"
        : "MOCK · DEMO";

  const totals = apps.reduce(
    (s, a) => ({
      installs: s.installs + a.total_installs,
      active: s.active + a.active_devices_24h,
      live: s.live + a.live_users,
      sent: s.sent + a.total_pushes_sent,
    }),
    { installs: 0, active: 0, live: 0, sent: 0 }
  );

  // Pushes delivered in the last 7 days, computed straight off campaigns.sent_at.
  const sevenDayWindowMs = 7 * 86400_000;
  const pushes7d = campaigns
    .filter((c) => c.sent_at && Date.now() - +new Date(c.sent_at) < sevenDayWindowMs)
    .reduce((s, c) => s + c.delivered_count, 0);

  // Delivery rate weighted by active devices so big apps dominate; falls back to a flat
  // mean when no app reports active devices, and to null when there are no apps at all.
  const totalActive24h = apps.reduce((s, a) => s + a.active_devices_24h, 0);
  const deliveryWeighted: number | null =
    apps.length === 0
      ? null
      : totalActive24h > 0
        ? apps.reduce((s, a) => s + a.delivery_rate * a.active_devices_24h, 0) / totalActive24h
        : apps.reduce((s, a) => s + a.delivery_rate, 0) / apps.length;

  const recentSent = campaigns.filter((c) => c.status === "sent" || c.status === "dispatching" || c.status === "scheduled").slice(0, 5);

  if (loading && apps.length === 0 && !error) {
    return <DashboardSkeleton />;
  }

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-1.5">
            <span className="live-dot" />
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-bone-low">{sourceEyebrow}</span>
            <span className="text-bone-mid">·</span>
            <span>{loading ? "Syncing…" : "Live"}</span>
            <span className="text-bone-mid">·</span>
            <span className="font-mono text-[10px] normal-case tracking-normal text-bone-low">
              Last refreshed {relTime(lastRefreshed)}
            </span>
          </span>
        }
        title="Mission control"
        description={
          dataSource === "rest"
            ? "Operational telemetry from your ApkZio REST API. JWT forwarded when you use Supabase sign-in."
            : dataSource === "supabase"
              ? "Tenant-scoped data from Supabase Postgres (RLS)."
              : "Preview dataset — configure API or Supabase for production."
        }
        actions={
          <>
            <Tabs
              variant="segmented"
              value={range}
              onChange={setRange}
              tabs={[{ value: "7d", label: "7d" }, { value: "30d", label: "30d" }, { value: "90d", label: "90d" }]}
            />
            <Button
              variant="secondary"
              leading={<Icon.External size={14} />}
              onClick={() => {
                exportDashboardCsv(apps, campaigns);
                toast({
                  tone: "success",
                  title: "Export ready",
                  description: "Dashboard CSV downloaded.",
                });
              }}
            >
              Export
            </Button>
            <Link to="/campaigns/new">
              <Button variant="primary" leading={<Icon.Plus size={14} />}>New campaign</Button>
            </Link>
          </>
        }
      />

      {/* Top KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Live users"
          value={compact(totals.live)}
          hint={apps.length > 0 ? `across ${apps.length} apps` : "no apps yet"}
          emphasis
          trailing={<Sparkline data={hb.slice(-24)} width={72} height={36} />}
        />
        <StatCard
          label="Active devices · 24h"
          value={compact(totals.active)}
          hint={totals.installs > 0 ? `/ ${compact(totals.installs)} installs` : "no installs yet"}
          trailing={<Sparkline data={installs.slice(-14)} color="#7CB7FF" width={72} height={36} />}
        />
        <StatCard
          label="Pushes delivered · 7d"
          value={compact(pushes7d)}
          hint={pushes7d > 0 ? "delivered · last 7d" : "no sends in window"}
        />
        <StatCard
          label="Delivery rate"
          value={deliveryWeighted === null ? "—" : pct(deliveryWeighted * 100, 1)}
          hint={apps.length > 0 ? `across ${apps.length} apps` : "—"}
        />
      </div>

      {/* Installs chart + Geo */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Installs"
            description={`Daily install count, last ${range}`}
            trailing={
              <div className="flex items-center gap-3">
                <Legend dot="#CDFF3F" label="Installs" />
              </div>
            }
          />
          <CardBody>
            <AreaChart data={installs} height={260} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Top geographies" description="Active devices · last 24h" />
          <CardBody>
            <div className="flex items-center gap-6">
              <DonutChart
                size={140}
                thickness={12}
                centerLabel="Countries"
                centerValue={String(geo.length)}
                segments={geo.slice(0, 5).map((g, i) => ({
                  value: g.v,
                  color: ["#CDFF3F", "#7CB7FF", "#FF8A4C", "#5DCFA3", "#E280C9"][i],
                }))}
              />
              <div className="min-w-0 flex-1 space-y-1.5">
                {geo.slice(0, 5).map((g, i) => (
                  <div key={g.code} className="flex items-center gap-2 text-[12px]">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: ["#CDFF3F", "#7CB7FF", "#FF8A4C", "#5DCFA3", "#E280C9"][i] }}
                    />
                    <span className="truncate text-bone">{g.name}</span>
                    <span className="ml-auto font-mono text-[11px] tabular-nums text-bone-low">{pct(g.pct * 100)}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardBody>
          <CardFooter>
            <Link to="/analytics" className="text-[12px] text-bone-mid hover:text-bone">View full breakdown →</Link>
          </CardFooter>
        </Card>
      </div>

      {/* Apps table + Recent campaigns */}
      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Apps"
            description="Health, scale, and recent sends"
            trailing={<Link to="/apps"><Button variant="ghost" size="sm" trailing={<Icon.ArrowRight size={12} />}>All apps</Button></Link>}
          />
          <CardBody padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-line-1 text-bone-low">
                    <th className="px-5 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-[0.14em]">App</th>
                    <th className="px-4 py-2.5 text-right font-mono text-[10px] font-medium uppercase tracking-[0.14em]">Live</th>
                    <th className="hidden px-4 py-2.5 text-right font-mono text-[10px] font-medium uppercase tracking-[0.14em] sm:table-cell">Active 24h</th>
                    <th className="hidden px-4 py-2.5 text-right font-mono text-[10px] font-medium uppercase tracking-[0.14em] md:table-cell">Installs</th>
                    <th className="hidden px-4 py-2.5 text-right font-mono text-[10px] font-medium uppercase tracking-[0.14em] lg:table-cell">Delivery</th>
                    <th className="px-5 py-2.5 text-right font-mono text-[10px] font-medium uppercase tracking-[0.14em]">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {apps.slice(0, 6).map((a) => (
                    <tr key={a.id} className="border-b border-line-1/70 last:border-b-0 hover:bg-ink-2/60">
                      <td className="px-5 py-3">
                        <Link to={`/apps/${a.id}`} className="flex items-center gap-3">
                          <div className={`grid h-8 w-8 place-items-center rounded-md bg-gradient-to-br font-mono text-[11px] font-medium text-bone ${a.icon_color}`}>
                            {a.icon_glyph}
                          </div>
                          <div>
                            <div className="font-medium text-bone">{a.name}</div>
                            <div className="font-mono text-[10px] text-bone-low">{a.package_name}</div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right font-mono num text-bone">{compact(a.live_users)}</td>
                      <td className="hidden px-4 py-3 text-right font-mono num text-bone sm:table-cell">{compact(a.active_devices_24h)}</td>
                      <td className="hidden px-4 py-3 text-right font-mono num text-bone-mid md:table-cell">{compact(a.total_installs)}</td>
                      <td className="hidden px-4 py-3 text-right lg:table-cell"><span className="font-mono num text-ok">{pct(a.delivery_rate * 100)}</span></td>
                      <td className="px-5 py-3">
                        <div className="ml-auto w-fit">
                          <Sparkline
                            data={useLiveApi ? [] : dailyInstalls(14, a.id)}
                            color={a.status === "paused" ? "#FFB547" : "#CDFF3F"}
                            width={88}
                            height={28}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Recent campaigns"
            trailing={<Link to="/campaigns"><Button variant="ghost" size="sm" trailing={<Icon.ArrowRight size={12} />}>All</Button></Link>}
          />
          <CardBody padded={false}>
            <ul>
              {recentSent.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/campaigns/${c.id}`}
                    className="flex items-start gap-3 border-b border-line-1/70 px-5 py-3.5 last:border-b-0 hover:bg-ink-2/60"
                  >
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-line-1 bg-ink-2 text-bone-mid">
                      <Icon.Send size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-medium">{c.title}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-bone-low">
                        <span className="truncate">{apps.find((x) => x.id === c.app_id)?.name ?? "—"}</span>
                        <span>·</span>
                        <span>{c.sent_at ? relTime(c.sent_at) : c.scheduled_at ? `at ${dateTime(c.scheduled_at)}` : relTime(c.created_at)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <StatusPill status={c.status} />
                      <div className="mt-1 font-mono text-[10px] tabular-nums text-bone-low">
                        {compact(c.delivered_count)} ▸ {compact(c.opened_count)}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      {/* Heartbeats + Top events */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Live users · 48h" description="Heartbeats per hour, all apps combined" />
          <CardBody>
            <AreaChart data={hb} color="#7CB7FF" height={200} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Top events" description="Most-fired events in the last 24h" trailing={<Link to="/analytics" className="text-[12px] text-bone-mid hover:text-bone">Explore →</Link>} />
          <CardBody>
            <BarChart
              rows={events.map((e, i) => ({
                label: e.name,
                value: e.count,
                color: ["#CDFF3F", "#7CB7FF", "#FF8A4C", "#5DCFA3", "#E280C9", "#FFB547", "#CDFF3F", "#7CB7FF"][i % 8],
              }))}
              format={compact}
            />
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-mid">
      <span className="h-2 w-2 rounded-full" style={{ background: dot }} /> {label}
    </span>
  );
}
