import { Link, useParams, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Tabs } from "@/components/ui/Tabs";
import { StatCard } from "@/components/ui/StatCard";
import { AreaChart } from "@/components/charts/AreaChart";
import { Sparkline } from "@/components/charts/MiniCharts";
import { Icon } from "@/lib/icons";
import { compact, dateTime, relTime } from "@/lib/format";
import { cn, copyToClipboard } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { APKZIO_API_URL } from "@/lib/config";
import { useApkzio } from "@/context/ApkzioDataContext";
import * as api from "@/lib/api";
import type { WpPluginRange } from "@/lib/api";
import type { Point } from "@/lib/mock-data";

const RANGE_TABS: { value: WpPluginRange; label: string }[] = [
  { value: "rt", label: "Realtime · 60m" },
  { value: "d", label: "Daily · 24h" },
  { value: "w", label: "Weekly · 7d" },
  { value: "m", label: "Monthly · 30d" },
];

export function PluginDetail() {
  const { toast } = useToast();
  const { pluginId } = useParams<{ pluginId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const range = (searchParams.get("range") as WpPluginRange) || "rt";
  const setRange = (r: WpPluginRange) => {
    setSearchParams({ range: r }, { replace: true });
  };

  const { dataSource } = useApkzio();
  const restOk = dataSource === "rest" && !!APKZIO_API_URL;

  const [detail, setDetail] = useState<Awaited<ReturnType<typeof api.fetchWpPluginDetail>> | null>(null);
  const [sites, setSites] = useState<Array<api.WpSiteInstall & { sparkline?: Point[] }>>([]);
  const [sitesTotal, setSitesTotal] = useState(0);
  const [siteQInput, setSiteQInput] = useState("");
  const [siteQ, setSiteQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastLoaded, setLastLoaded] = useState<string | null>(null);
  const [metric, setMetric] = useState<"pageviews" | "uniques">("pageviews");
  const [zipBusy, setZipBusy] = useState(false);

  const chartSeries = useMemo(() => {
    if (!detail) return [];
    return metric === "pageviews" ? detail.series_pageviews : detail.series_uniques;
  }, [detail, metric]);

  const load = useCallback(async () => {
    if (!restOk || !pluginId) return;
    setLoading(true);
    setErr(null);
    try {
      const [d, s] = await Promise.all([
        api.fetchWpPluginDetail(pluginId, range),
        api.fetchWpPluginSites(pluginId, { q: siteQ || undefined, limit: 50, include_series: true }),
      ]);
      setDetail(d);
      setSites(s.sites);
      setSitesTotal(s.total);
      setLastLoaded(new Date().toISOString());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [restOk, pluginId, range, siteQ]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!restOk || range !== "rt") return;
    const t = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(t);
  }, [restOk, range, load]);

  if (!restOk) {
    return (
      <>
        <PageHeader eyebrow="WORDPRESS" title="Plugin" description="—" />
        <Card>
          <CardBody className="p-8 text-center text-[13px] text-bone-mid">
            Set <span className="font-mono text-bone">VITE_APKZIO_API_URL</span> and REST data source to view plugin telemetry.
          </CardBody>
        </Card>
      </>
    );
  }

  if (!pluginId) {
    return null;
  }

  return (
    <>
      <PageHeader
        eyebrow="WORDPRESS"
        title={detail?.plugin.name ?? "Plugin"}
        description={detail?.plugin.description ?? "Traffic and installs across connected sites."}
        actions={
          <>
            <Link
              to={`/plugins?range=${range}`}
              className={cn(
                "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-line-1 bg-ink-2/60 px-3.5 text-[13px] font-medium text-bone",
                "hover:border-line-2 hover:bg-ink-3",
              )}
            >
              <Icon.Layers size={14} />
              All plugins
            </Link>
            <Tabs
              variant="segmented"
              value={range}
              onChange={(v) => setRange(v as WpPluginRange)}
              tabs={RANGE_TABS.map((t) => ({ value: t.value, label: t.label }))}
            />
          </>
        }
      />

      {err && (
        <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-[13px] text-rose-200">
          {err}
          <button type="button" className="ml-3 underline" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}

      {detail && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatCard label="Installs" value={compact(detail.rollup.installs)} hint="sites in catalog" />
            <StatCard label="Active sites" value={compact(detail.rollup.active_sites)} hint="seen in window" />
            <StatCard label="Subscribers" value={compact(detail.rollup.subscribers)} hint="sum across sites" emphasis />
            <StatCard label="Pageviews" value={compact(detail.rollup.pageviews)} hint="range total" />
            <StatCard label="Uniques" value={compact(detail.rollup.uniques)} hint="range total" />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title="Traffic"
                description={`Aggregated ${metric} · ${RANGE_TABS.find((x) => x.value === range)?.label ?? range}`}
                trailing={
                  <Tabs
                    variant="segmented"
                    value={metric}
                    onChange={(v) => setMetric(v as "pageviews" | "uniques")}
                    tabs={[
                      { value: "pageviews", label: "Pageviews" },
                      { value: "uniques", label: "Uniques" },
                    ]}
                  />
                }
              />
              <CardBody>
                <AreaChart data={chartSeries} height={260} color={metric === "pageviews" ? "#7CB7FF" : "#CDFF3F"} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Product" description="WordPress package" />
              <CardBody className="space-y-4 text-[13px] text-bone-mid">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={zipBusy}
                    leading={<Icon.External size={14} />}
                    onClick={() => {
                      if (!pluginId) return;
                      setZipBusy(true);
                      void (async () => {
                        try {
                          await api.downloadWpPluginDistributionZip(pluginId);
                          toast({
                            title: "ZIP downloaded",
                            description: "Upload in WP → Plugins → Add New, then Settings → ApkZio to connect.",
                            tone: "success",
                          });
                        } catch (e) {
                          toast({
                            title: "Download failed",
                            description: e instanceof Error ? e.message : String(e),
                            tone: "error",
                          });
                        } finally {
                          setZipBusy(false);
                        }
                      })();
                    }}
                  >
                    {zipBusy ? "Preparing…" : "Download WP plugin (.zip)"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      void copyToClipboard(detail.plugin.id).then((ok) =>
                        toast(
                          ok
                            ? { title: "Copied", description: "Plugin ID is on the clipboard.", tone: "success" }
                            : { title: "Copy failed", description: "Select the ID manually.", tone: "error" },
                        ),
                      );
                    }}
                  >
                    Copy plugin ID
                  </Button>
                </div>
                <p className="text-[12px] leading-relaxed text-bone-low">
                  New installs register when WordPress connects; this table refreshes automatically in realtime mode.
                </p>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-low">Slug</div>
                  <div className="mt-1 font-mono text-bone">{detail.plugin.slug}</div>
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-low">Latest</div>
                  <div className="mt-1 text-bone">v{detail.plugin.latest_version}</div>
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-low">Plugin id</div>
                  <div className="mt-1 break-all font-mono text-[11px] text-bone">{detail.plugin.id}</div>
                </div>
              </CardBody>
            </Card>
          </div>
        </>
      )}

      <Card className="mt-6">
        <CardHeader
          title="Connected sites"
          description={`${sitesTotal} total · showing ${sites.length}`}
          trailing={
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setSiteQ(siteQInput.trim());
              }}
            >
              <Input
                placeholder="Filter by URL…"
                value={siteQInput}
                onChange={(e) => setSiteQInput(e.target.value)}
                leading={<Icon.Search size={14} />}
                className="w-56"
              />
              <Button type="submit" variant="secondary">
                Search
              </Button>
            </form>
          }
        />
        <CardBody padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line-1 text-bone-low">
                  <th className="px-5 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em]">Site</th>
                  <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.14em]">WP</th>
                  <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.14em]">Plugin</th>
                  <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.14em]">Subs</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em]">Last seen</th>
                  <th className="hidden px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.14em] md:table-cell">24h pv</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((s) => (
                  <tr key={s.id} className="border-b border-line-1/70 last:border-b-0 hover:bg-ink-2/60">
                    <td className="px-5 py-3">
                      <div className="max-w-[280px] truncate font-mono text-[12px] text-bone" title={s.site_url}>
                        {s.site_url}
                      </div>
                      <div className="mt-1 font-mono text-[10px] text-bone-low">{s.id.slice(0, 8)}…</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-bone">{s.wp_version}</td>
                    <td className="px-4 py-3 text-right font-mono text-bone">{s.plugin_version}</td>
                    <td className="px-4 py-3 text-right font-mono num text-bone">{compact(s.subscribers_total)}</td>
                    <td className="px-4 py-3 text-[12px] text-bone-mid">{relTime(s.last_seen_at)}</td>
                    <td className="hidden px-4 py-3 text-right md:table-cell">
                      {s.sparkline && s.sparkline.length > 0 ? (
                        <Sparkline data={s.sparkline} color="#7CB7FF" width={80} height={32} />
                      ) : (
                        <span className="text-bone-low">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {loading && !detail && (
            <div className="border-t border-line-1 px-5 py-6 text-center text-bone-mid">Loading…</div>
          )}
          {!loading && sites.length === 0 && (
            <div className="border-t border-line-1 px-5 py-8 text-center text-[13px] text-bone-mid">No sites match this filter.</div>
          )}
        </CardBody>
      </Card>

      {lastLoaded && (
        <p className="mt-4 font-mono text-[11px] text-bone-low">
          Loaded {dateTime(lastLoaded)}
          {range === "rt" ? " · auto-refresh every 30s" : ""}
        </p>
      )}
    </>
  );
}
