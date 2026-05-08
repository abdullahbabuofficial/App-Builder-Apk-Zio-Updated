import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Tabs } from "@/components/ui/Tabs";
import { StatCard } from "@/components/ui/StatCard";
import { Modal } from "@/components/ui/Modal";
import { AreaChart } from "@/components/charts/AreaChart";
import { BarChart, Sparkline } from "@/components/charts/MiniCharts";
import { Icon } from "@/lib/icons";
import { commas, compact, dateTime, pct, relTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApkzio } from "@/context/ApkzioDataContext";
import { useAnalyticsOverview } from "@/hooks/useAnalyticsOverview";
import { useToast } from "@/components/ui/Toast";
import { downloadCsv } from "@/lib/csv";
import type { AnalyticsOverview, CrashAnalytics } from "@/lib/api";
import { fetchCrashAnalytics } from "@/lib/api";
import { useEventTrends } from "@/hooks/useAppTrends";

export function Analytics() {
  const { apps, useLiveApi } = useApkzio();
  const { toast } = useToast();
  const [appId, setAppId] = useState<string>("all");
  const [range, setRange] = useState("30d");
  const [q, setQ] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<AnalyticsOverview["recentEvents"][number] | null>(null);
  const [crashAnalytics, setCrashAnalytics] = useState<CrashAnalytics | null>(null);
  const [crashLoading, setCrashLoading] = useState(false);

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

  // Fetch crash analytics when app changes
  useEffect(() => {
    if (!useLiveApi || appId === "all" || !appId) {
      setCrashAnalytics(null);
      return;
    }
    setCrashLoading(true);
    const rangeMap = { "7d": "7d", "30d": "30d", "90d": "30d" } as const;
    fetchCrashAnalytics(appId, rangeMap[range as keyof typeof rangeMap] ?? "7d")
      .then(setCrashAnalytics)
      .catch(() => setCrashAnalytics(null))
      .finally(() => setCrashLoading(false));
  }, [appId, range, useLiveApi]);

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
            <Button
              variant="secondary"
              leading={<Icon.External size={14} />}
              disabled={filtered.length === 0}
              onClick={() => {
                downloadCsv(`apkzio-events-${range}-${new Date().toISOString().slice(0, 10)}.csv`, [
                  ["event", "count", "unique_devices", "delta_pct"],
                  ...filtered.map((e) => [e.name, String(e.count), String(e.uniqueDevices), String(e.deltaPct)]),
                ]);
                toast({ tone: "success", title: "Export ready", description: "Events CSV downloaded." });
              }}
            >
              Export
            </Button>
          </>
        }
      />

      {overview.error && (
        <div role="alert" className="mb-5 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-[13px] text-danger">
          {overview.error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Events fired"
          value={compact(totalEvents)}
          {...(!useLiveApi ? { deltaPct: 6.4 } : {})}
          hint={`across ${filtered.length} types`}
          emphasis
        />
        <StatCard
          label="Unique devices"
          value={compact(totalDevices)}
          {...(!useLiveApi ? { deltaPct: 2.1 } : {})}
          trailing={<Sparkline data={hb.slice(-24)} color="#7CB7FF" width={72} height={36} />}
        />
        <StatCard
          label="Avg events / device"
          value={(totalEvents / Math.max(1, totalDevices)).toFixed(1)}
          {...(!useLiveApi ? { deltaPct: 3.2 } : {})}
        />
        <StatCard
          label="Crash rate"
          value={
            crashLoading
              ? "…"
              : useLiveApi && crashAnalytics
                ? crashAnalytics.crash_rate.toFixed(2)
                : useLiveApi
                  ? "—"
                  : "0.18"
          }
          {...(useLiveApi && crashAnalytics ? { unit: "%", deltaPct: -0.4 } : useLiveApi ? {} : { unit: "%", deltaPct: -0.4 })}
          hint={
            crashLoading
              ? "loading…"
              : useLiveApi && !crashAnalytics
                ? appId === "all"
                  ? "select an app"
                  : "no crash data"
                : useLiveApi
                  ? `last ${range}`
                  : "rolling 24h"
          }
          trailing={
            useLiveApi && crashAnalytics ? (
              <Sparkline data={crashAnalytics.trend} color="#FF8A4C" width={72} height={36} />
            ) : useLiveApi ? undefined : (
              <Sparkline data={hb.slice(-24)} color="#FF8A4C" width={72} height={36} />
            )
          }
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Events over time" description={overview.loading ? "Loading analytics…" : `Daily event count, last ${range}`} />
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
          description="Open a row for event totals, device reach, and export-ready details."
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
                {filtered.map((e, i) => (
                  <EventRow 
                    key={e.id} 
                    event={e} 
                    index={i}
                    onSelect={() => setSelectedEvent(e)} 
                  />
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
        <CardFooter>
          <span className="font-mono text-[11px] text-bone-low">{filtered.length} events · {compact(totalEvents)} occurrences</span>
          <Button
            variant="ghost"
            size="sm"
            disabled={!q}
            onClick={() => setQ("")}
            title={q ? "Clear search and show every event." : "All matching events are already shown."}
            trailing={<Icon.ArrowRight size={12} />}
          >
            View all
          </Button>
        </CardFooter>
      </Card>

      <Modal
        open={selectedEvent !== null}
        onClose={() => setSelectedEvent(null)}
        title={selectedEvent?.name ?? "Event details"}
        description="Event-level summary for the current app and date range."
        footer={
          <>
            <Button variant="ghost" onClick={() => setSelectedEvent(null)}>
              Close
            </Button>
            <Button
              variant="primary"
              disabled={!selectedEvent}
              leading={<Icon.External size={14} />}
              onClick={() => {
                if (!selectedEvent) return;
                downloadCsv(`apkzio-event-${selectedEvent.id}-${range}.csv`, [
                  ["event", "count", "unique_devices", "delta_pct", "range", "app"],
                  [selectedEvent.name, selectedEvent.count, selectedEvent.uniqueDevices, selectedEvent.deltaPct, range, appId],
                ]);
                toast({ tone: "success", title: "Export ready", description: `${selectedEvent.name} CSV downloaded.` });
              }}
            >
              Export event
            </Button>
          </>
        }
      >
        {selectedEvent && <EventDetailsModal event={selectedEvent} range={range} appId={appId} />}
      </Modal>
    </>
  );
}

function EventDetailsModal({ 
  event, 
  range, 
  appId 
}: { 
  event: AnalyticsOverview["recentEvents"][number]; 
  range: string;
  appId: string;
}) {
  const days = range === "30d" ? 30 : range === "90d" ? 90 : 7;
  const eventTrends = useEventTrends(event.name, days);
  
  // Convert to Point[] format for AreaChart
  const chartData = eventTrends.map((v, i) => ({
    t: Date.now() - (eventTrends.length - 1 - i) * 86400_000,
    v
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <EventMetric label="Count" value={commas(event.count)} />
        <EventMetric label="Devices" value={commas(event.uniqueDevices)} />
        <EventMetric label="Delta" value={pct(event.deltaPct)} tone={event.deltaPct >= 0 ? "ok" : "danger"} />
      </div>
      <div className="rounded-lg border border-line-1 bg-ink-2/50 p-4">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-bone-low">Trend</div>
        <AreaChart data={chartData} height={180} showAxis={false} />
      </div>
      <div className="rounded-lg border border-line-1 bg-ink-2/40 p-3 font-mono text-[11px] text-bone-mid">
        <div>event_id: <span className="text-bone">{event.id}</span></div>
        <div className="mt-1">scope: <span className="text-bone">{appId === "all" ? "all apps" : appId}</span></div>
        <div className="mt-1">range: <span className="text-bone">{range}</span></div>
      </div>
    </div>
  );
}

function EventMetric({ label, value, tone }: { label: string; value: string; tone?: "ok" | "danger" }) {
  return (
    <div className="rounded-lg border border-line-1 bg-ink-2/50 p-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-low">{label}</div>
      <div className={cn("mt-1 font-display text-[22px] font-semibold num text-bone", tone === "ok" && "text-ok", tone === "danger" && "text-danger")}>
        {value}
      </div>
    </div>
  );
}

function EventRow({ 
  event, 
  index,
  onSelect 
}: { 
  event: AnalyticsOverview["recentEvents"][number]; 
  index: number;
  onSelect: () => void;
}) {
  const trendData = useEventTrends(event.name, 14);
  const isUp = event.deltaPct > 0;
  
  return (
    <tr className="border-b border-line-1/70 last:border-b-0 hover:bg-ink-2/60">
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded border border-line-1 bg-ink-2 text-bone-mid">
            <Icon.Zap size={13} />
          </div>
          <div>
            <div className="font-mono font-medium text-bone">{event.name}</div>
            <div className="text-[11px] text-bone-low">last fired {relTime(Date.now() - index * 60_000)}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-right font-mono num text-bone">{commas(event.count)}</td>
      <td className="hidden px-4 py-3 text-right font-mono num text-bone-mid sm:table-cell">{commas(event.uniqueDevices)}</td>
      <td className="hidden px-4 py-3 text-right md:table-cell">
        <span className={cn("inline-flex items-center gap-1 font-mono num", isUp ? "text-ok" : "text-danger")}>
          {isUp ? "↑" : "↓"} {pct(Math.abs(event.deltaPct))}
        </span>
      </td>
      <td className="hidden px-4 py-3 text-right lg:table-cell">
        <div className="ml-auto w-fit">
          <Sparkline 
            data={trendData} 
            color={isUp ? "#CDFF3F" : "#FF8A4C"} 
            width={88} 
            height={28} 
          />
        </div>
      </td>
      <td className="px-5 py-3 text-right">
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Open ${event.name} event details`}
          onClick={onSelect}
        >
          <Icon.ArrowRight size={14} />
        </Button>
      </td>
    </tr>
  );
}
