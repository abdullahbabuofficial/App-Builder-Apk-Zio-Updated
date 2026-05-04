import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { StatCard } from "@/components/ui/StatCard";
import { AreaChart } from "@/components/charts/AreaChart";
import { Sparkline, BarChart, DonutChart } from "@/components/charts/MiniCharts";
import { EmptyState } from "@/components/ui/Misc";
import { Icon } from "@/lib/icons";
import { compact, commas, dateTime, pct, relTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { usePushcare } from "@/context/PushcareDataContext";
import { useAnalyticsOverview } from "@/hooks/useAnalyticsOverview";
import { useDevices } from "@/hooks/useAppCollections";

export function AppDetail() {
  const { appId } = useParams();
  const { findApp, campaigns } = usePushcare();
  const app = findApp(appId);
  const overview = useAnalyticsOverview(appId ?? "app-detail");
  const devicesPreview = useDevices(app?.id, 12);
  const [tab, setTab] = useState("overview");

  if (!app) {
    return (
      <EmptyState
        icon={<Icon.Layers size={20} />}
        title="App not found"
        description="The app you're looking for either doesn't exist or you don't have access."
        action={<Link to="/apps"><Button variant="primary" leading={<Icon.ArrowLeft size={14} />}>Back to apps</Button></Link>}
      />
    );
  }

  const installs = overview.dailyInstalls.slice(-30);
  const hb = overview.hourlyHeartbeats;
  const geo = overview.geoBreakdown;
  const recent = campaigns.filter((c) => c.app_id === app.id).slice(0, 5);
  const devices = devicesPreview;

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Apps", to: "/apps" }, { label: app.name }]}
        title={
          <span className="flex items-center gap-3">
            <div className={cn("grid h-10 w-10 place-items-center rounded-md bg-gradient-to-br font-mono text-[14px] font-medium text-bone", app.icon_color)}>
              {app.icon_glyph}
            </div>
            <span>{app.name}</span>
            <StatusPill status={app.status} />
          </span>
        }
        description={
          <span className="font-mono text-[12px] text-bone-mid">{app.package_name}</span>
        }
        actions={
          <>
            <Button variant="secondary" leading={<Icon.Code size={14} />}>SDK</Button>
            <Button variant="secondary" leading={<Icon.Cog size={14} />}>Settings</Button>
            <Link to={`/campaigns/new`}>
              <Button variant="primary" leading={<Icon.Send size={14} />}>Send push</Button>
            </Link>
          </>
        }
      />

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "devices", label: "Devices", count: devices.length * 8 },
          { value: "subscribers", label: "Subscribers", count: Math.floor(app.active_devices_24h * 0.78) },
          { value: "campaigns", label: "Campaigns", count: recent.length * 4 },
          { value: "events", label: "Events" },
          { value: "config", label: "Config" },
        ]}
        className="mb-6"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Live users" value={compact(app.live_users)} deltaPct={3.4} emphasis trailing={<Sparkline data={hb.slice(-24)} width={80} height={36} />} />
        <StatCard label="Active · 24h" value={compact(app.active_devices_24h)} deltaPct={1.2} hint={`${pct((app.active_devices_24h / app.total_installs) * 100)} of installs`} trailing={<Sparkline data={installs.slice(-14)} color="#7CB7FF" width={80} height={36} />} />
        <StatCard label="Installs total" value={compact(app.total_installs)} deltaPct={5.8} trailing={<Sparkline data={installs} color="#5DCFA3" width={80} height={36} />} />
        <StatCard label="Delivery rate" value={pct(app.delivery_rate * 100, 1)} deltaPct={0.4} hint="rolling 7d" trailing={<Sparkline data={installs.slice(-14)} color="#FF8A4C" width={80} height={36} />} />
      </div>

      {/* Charts */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Installs · 30d" description="Daily install count" trailing={<span className="font-mono text-[11px] text-bone-low">UTC</span>} />
          <CardBody><AreaChart data={installs} height={240} /></CardBody>
        </Card>
        <Card>
          <CardHeader title="Live users · 48h" description="Heartbeats per hour" />
          <CardBody><AreaChart data={hb} color="#7CB7FF" height={240} showAxis={false} /></CardBody>
        </Card>
      </div>

      {/* Geo + recent campaigns + devices fleet snapshot */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Geographies" description="Top countries · last 24h" />
          <CardBody>
            <div className="mb-4 flex justify-center">
              <DonutChart
                size={140}
                thickness={12}
                centerLabel="Top 5"
                centerValue={pct(geo.slice(0, 5).reduce((s, x) => s + x.pct, 0) * 100, 0)}
                segments={geo.slice(0, 5).map((g, i) => ({
                  value: g.v,
                  color: ["#CDFF3F", "#7CB7FF", "#FF8A4C", "#5DCFA3", "#E280C9"][i],
                }))}
              />
            </div>
            <BarChart
              rows={geo.slice(0, 6).map((g, i) => ({
                label: g.name,
                value: g.v,
                color: ["#CDFF3F", "#7CB7FF", "#FF8A4C", "#5DCFA3", "#E280C9", "#FFB547"][i],
              }))}
              format={compact}
            />
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent campaigns"
            trailing={
              <Link to="/campaigns" className="text-[12px] text-bone-mid hover:text-bone">All campaigns →</Link>
            }
          />
          <CardBody padded={false}>
            {recent.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={<Icon.Send size={18} />}
                  title="No campaigns yet"
                  description="Send your first push to see delivery and engagement data."
                  action={
                    <Link to="/campaigns/new">
                      <Button variant="primary" leading={<Icon.Plus size={14} />}>Create campaign</Button>
                    </Link>
                  }
                />
              </div>
            ) : (
              <ul>
                {recent.map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/campaigns/${c.id}`}
                      className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-line-1/70 px-5 py-3.5 last:border-b-0 hover:bg-ink-2/60"
                    >
                      <div className="grid h-8 w-8 place-items-center rounded-md border border-line-1 bg-ink-2 text-bone-mid">
                        <Icon.Send size={14} />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-bone">{c.title}</div>
                        <div className="mt-0.5 line-clamp-1 text-[11px] text-bone-low">{c.body}</div>
                      </div>
                      <div className="flex items-center gap-3 whitespace-nowrap">
                        <div className="hidden text-right sm:block">
                          <div className="font-mono text-[11px] tabular-nums text-bone">{compact(c.delivered_count)}</div>
                          <div className="font-mono text-[10px] tabular-nums text-bone-low">{pct((c.opened_count / Math.max(1, c.delivered_count)) * 100)} open</div>
                        </div>
                        <StatusPill status={c.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Fleet snapshot */}
      <div className="mt-6">
        <Card>
          <CardHeader
            title="Fleet snapshot"
            description="Most recently active devices"
            trailing={
              <Link to={`/apps/${app.id}/devices`}>
                <Button variant="ghost" size="sm" trailing={<Icon.ArrowRight size={12} />}>All devices</Button>
              </Link>
            }
          />
          <CardBody padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-line-1 text-bone-low">
                    <th className="px-5 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em]">Device</th>
                    <th className="hidden px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em] sm:table-cell">Country</th>
                    <th className="hidden px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em] md:table-cell">App ver.</th>
                    <th className="hidden px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em] lg:table-cell">OS</th>
                    <th className="px-5 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.14em]">Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((d) => (
                    <tr key={d.id} className="border-b border-line-1/70 last:border-b-0 hover:bg-ink-2/60">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="grid h-8 w-8 place-items-center rounded border border-line-1 bg-ink-2 text-bone-low">
                            <Icon.Phone size={14} />
                          </div>
                          <div>
                            <div className="font-medium text-bone">{d.manufacturer} {d.model}</div>
                            <div className="font-mono text-[10px] text-bone-low">{d.install_hash.slice(0, 12)}…</div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <Badge dot tone="neutral">{d.country_code}</Badge>
                      </td>
                      <td className="hidden px-4 py-3 font-mono text-bone-mid md:table-cell">{d.app_version}</td>
                      <td className="hidden px-4 py-3 font-mono text-bone-mid lg:table-cell">Android {d.os_version}</td>
                      <td className="px-5 py-3 text-right">
                        <span className="inline-flex items-center gap-1.5">
                          {d.is_active && <span className="live-dot scale-75" />}
                          <span className="text-[12px] text-bone-mid">{relTime(d.last_seen_at)}</span>
                        </span>
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
