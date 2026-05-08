import { Link, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Icon } from "@/lib/icons";
import { compact, relTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { APKZIO_API_URL } from "@/lib/config";
import { useApkzio } from "@/context/ApkzioDataContext";
import * as api from "@/lib/api";
import type { WpPluginRange } from "@/lib/api";

const RANGE_TABS: { value: WpPluginRange; label: string }[] = [
  { value: "rt", label: "Realtime · 60m" },
  { value: "d", label: "Daily · 24h" },
  { value: "w", label: "Weekly · 7d" },
  { value: "m", label: "Monthly · 30d" },
];

export function Plugins() {
  const { toast } = useToast();
  const { dataSource } = useApkzio();
  const [searchParams, setSearchParams] = useSearchParams();
  const qRange = searchParams.get("range") as WpPluginRange | null;
  const initialRange =
    qRange === "rt" || qRange === "d" || qRange === "w" || qRange === "m" ? qRange : "rt";
  const [range, setRange] = useState<WpPluginRange>(initialRange);
  const [rows, setRows] = useState<Array<{ plugin: api.WpPlugin; rollup: api.WpRollup }>>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastLoaded, setLastLoaded] = useState<string | null>(null);
  const [zipBusy, setZipBusy] = useState<string | null>(null);

  const restOk = dataSource === "rest" && !!APKZIO_API_URL;

  const load = useCallback(async () => {
    if (!restOk) return;
    setLoading(true);
    setErr(null);
    try {
      const data = await api.fetchWpPlugins(range);
      setRows(data.plugins);
      setLastLoaded(new Date().toISOString());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load plugins");
    } finally {
      setLoading(false);
    }
  }, [range, restOk]);

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
        <PageHeader
          eyebrow="WORDPRESS"
          title="Plugins"
        description="Install counts, subscribers, and traffic from sites running ApkZio WP plugins."
        />
        <Card>
          <CardBody className="p-8 text-center text-[13px] text-bone-mid">
            <Icon.Trend size={28} className="mx-auto mb-3 text-bone-low" />
            <p className="font-medium text-bone">REST mode required</p>
            <p className="mt-2 max-w-md mx-auto">
              Set <span className="font-mono text-bone">VITE_APKZIO_API_URL</span> and use data source{" "}
              <span className="font-mono text-bone">rest</span> to load WordPress plugin telemetry from the local API.
            </p>
          </CardBody>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="WORDPRESS"
        title="Plugins"
        description="Per-product rollups: installs, active sites, subscribers, and traffic for the selected window."
        actions={
          <Tabs
            variant="segmented"
            value={range}
            onChange={(v) => {
              const r = v as WpPluginRange;
              setRange(r);
              setSearchParams({ range: r }, { replace: true });
            }}
            tabs={RANGE_TABS.map((t) => ({ value: t.value, label: t.label }))}
          />
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

      <Card>
        <CardHeader title="Catalog" description={loading ? "Loading…" : `${rows.length} products`} />
        <CardBody padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line-1 text-bone-low">
                  <th className="px-5 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em]">Plugin</th>
                  <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.14em]">Installs</th>
                  <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.14em]">Active</th>
                  <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.14em]">Subscribers</th>
                  <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.14em]">Pageviews</th>
                  <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.14em]">Uniques</th>
                  <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.14em]">WP ZIP</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ plugin, rollup }) => (
                  <tr key={plugin.id} className="border-b border-line-1/70 last:border-b-0 hover:bg-ink-2/60">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 place-items-center rounded border border-line-1 bg-ink-2 text-bone-mid">
                          <Icon.Globe size={15} />
                        </div>
                        <div>
                          <div className="font-medium text-bone">{plugin.name}</div>
                          <div className="mt-0.5 font-mono text-[11px] text-bone-low">
                            {plugin.slug} · v{plugin.latest_version}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono num text-bone">{rollup.installs}</td>
                    <td className="px-4 py-3 text-right font-mono num text-bone">{rollup.active_sites}</td>
                    <td className="px-4 py-3 text-right font-mono num text-bone">{compact(rollup.subscribers)}</td>
                    <td className="px-4 py-3 text-right font-mono num text-bone">{compact(rollup.pageviews)}</td>
                    <td className="px-4 py-3 text-right font-mono num text-bone">{compact(rollup.uniques)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={zipBusy === plugin.id}
                        onClick={() => {
                          setZipBusy(plugin.id);
                          void (async () => {
                            try {
                              await api.downloadWpPluginDistributionZip(plugin.id);
                              toast({
                                title: "ZIP downloaded",
                                description: "In WordPress: Plugins → Add New → Upload Plugin, then Settings → ApkZio to connect.",
                                tone: "success",
                              });
                            } catch (e) {
                              toast({
                                title: "Download failed",
                                description: e instanceof Error ? e.message : String(e),
                                tone: "error",
                              });
                            } finally {
                              setZipBusy(null);
                            }
                          })();
                        }}
                      >
                        {zipBusy === plugin.id ? "…" : "ZIP"}
                      </Button>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        to={`/plugins/${plugin.id}?range=${range}`}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md border border-line-1 px-2.5 py-1.5 text-[12px] text-bone-mid",
                          "hover:border-line-2 hover:text-bone",
                        )}
                      >
                        Open <Icon.External size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && rows.length === 0 && (
            <div className="border-t border-line-1 px-5 py-8 text-center text-[13px] text-bone-mid">No plugins in catalog.</div>
          )}
        </CardBody>
      </Card>

      {lastLoaded && (
        <p className="mt-4 font-mono text-[11px] text-bone-low">
          Last refresh {relTime(lastLoaded)}
          {range === "rt" ? " · polling every 30s" : ""}
        </p>
      )}
    </>
  );
}
