import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Tabs } from "@/components/ui/Tabs";
import { StatCard } from "@/components/ui/StatCard";
import { AreaChart } from "@/components/charts/AreaChart";
import { BarChart, Sparkline } from "@/components/charts/MiniCharts";
import { Icon } from "@/lib/icons";
import { commas, compact, dateTime, pct, relTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { dailyInstalls } from "@/lib/mock-data";
import { usePushcare } from "@/context/PushcareDataContext";
import { useAnalyticsOverview } from "@/hooks/useAnalyticsOverview";

export function Analytics() {
  const { apps } = usePushcare();
  const [appId, setAppId] = useState<string>("all");
  const [range, setRange] = useState("30d");
  const [q, setQ] = useState("");

  const seed = `ana-${appId}-${range}`;
  const overview = useAnalyticsOverview(seed);
  const days = range === "30d" ? 30 : range === "90d" ? 90 : 7;
  const installs = overview.dailyInstalls.slice(-Math.min(days, overview.dailyInstalls.length));
  const hb = overview.hourlyHeartbeats;

  const events = overview.recentEvents;

  const filtered = events.filter((e) => !q || e.name.includes(q.toLowerCase()));
  const top = filtered.slice(0, 8);
  const totalEvents = filtered.reduce((s, e) => s + e.count, 0);
  const totalDevices = filtered.reduce((s, e) => s + e.uniqueDevices, 0);

  return (
    <>
      <PageHeader
        eyebrow="ANALYTICS"
        title="Events explorer"
        description="Every event your apps have ever fired. Filter, group, and chart anything."
        actions={
          <>
            <Select
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              options={[{ value: "all", label: "All apps" }, ...apps.map((a) => ({ value: a.id, label: a.name }))]}
              className="w-40"
            />
            <Tabs
              variant="segmented"
              value={range}
              onChange={setRange}
              tabs={[{ value: "7d", label: "7d" }, { value: "30d", label: "30d" }, { value: "90d", label: "90d" }]}
            />
            <Button variant="secondary" leading={<Icon.External size={14} />}>Export</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Events fired" value={compact(totalEvents)} deltaPct={6.4} hint={`across ${filtered.length} types`} emphasis />
        <StatCard label="Unique devices" value={compact(totalDevices)} deltaPct={2.1} trailing={<Sparkline data={hb.slice(-24)} color="#7CB7FF" width={72} height={36} />} />
        <StatCard label="Avg events / device" value={(totalEvents / Math.max(1, totalDevices)).toFixed(1)} deltaPct={3.2} />
        <StatCard label="Crash rate" value="0.18" unit="%" deltaPct={-0.4} hint="rolling 24h" trailing={<Sparkline data={hb.slice(-24)} color="#FF8A4C" width={72} height={36} />} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Events over time" description={`Daily event count, last ${range}`} />
          <CardBody><AreaChart data={installs} height={240} /></CardBody>
        </Card>
        <Card>
          <CardHeader title="Top events" description={`${top.length} most-fired`} />
          <CardBody>
            <BarChart
              rows={top.map((e, i) => ({
                label: e.name,
                value: e.count,
                color: ["#CDFF3F", "#7CB7FF", "#FF8A4C", "#5DCFA3", "#E280C9", "#FFB547", "#CDFF3F", "#7CB7FF"][i % 8],
              }))}
              format={compact}
            />
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="All events"
          description="Tap a row to drill into a specific event"
          trailing={
            <Input placeholder="Search events…" value={q} onChange={(e) => setQ(e.target.value)} leading={<Icon.Search size={14} />} className="w-60" />
          }
        />
        <CardBody padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line-1 text-bone-low">
                  <th className="px-5 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em]">Event</th>
                  <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.14em]">Count</th>
                  <th className="hidden px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.14em] sm:table-cell">Unique devices</th>
                  <th className="hidden px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.14em] md:table-cell">Δ vs prev</th>
                  <th className="hidden px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.14em] lg:table-cell">Trend</th>
                  <th className="px-5 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => {
                  const trendData = dailyInstalls(14, e.id);
                  const isUp = e.deltaPct > 0;
                  return (
                    <tr key={e.id} className="border-b border-line-1/70 last:border-b-0 hover:bg-ink-2/60">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="grid h-8 w-8 place-items-center rounded border border-line-1 bg-ink-2 text-bone-mid">
                            <Icon.Zap size={13} />
                          </div>
                          <div>
                            <div className="font-mono font-medium text-bone">{e.name}</div>
                            <div className="text-[11px] text-bone-low">last fired {relTime(Date.now() - i * 60_000)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono num text-bone">{commas(e.count)}</td>
                      <td className="hidden px-4 py-3 text-right font-mono num text-bone-mid sm:table-cell">{commas(e.uniqueDevices)}</td>
                      <td className="hidden px-4 py-3 text-right md:table-cell">
                        <span className={cn("inline-flex items-center gap-1 font-mono num", isUp ? "text-ok" : "text-danger")}>
                          {isUp ? "↑" : "↓"} {pct(Math.abs(e.deltaPct))}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 text-right lg:table-cell">
                        <div className="ml-auto w-fit"><Sparkline data={trendData} color={isUp ? "#CDFF3F" : "#FF8A4C"} width={88} height={28} /></div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button variant="ghost" size="icon" aria-label="Drill in"><Icon.ArrowRight size={14} /></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
        <CardFooter>
          <span className="font-mono text-[11px] text-bone-low">{filtered.length} events · {compact(totalEvents)} occurrences</span>
          <Button variant="ghost" size="sm" trailing={<Icon.ArrowRight size={12} />}>View all</Button>
        </CardFooter>
      </Card>
    </>
  );
}
