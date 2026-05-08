import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { StatCard } from "@/components/ui/StatCard";
import { AreaChart } from "@/components/charts/AreaChart";
import { Sparkline, BarChart, DonutChart } from "@/components/charts/MiniCharts";
import { EmptyState } from "@/components/ui/Misc";
import { Icon } from "@/lib/icons";
import { compact, dateTime, pct, relTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApkzio } from "@/context/ApkzioDataContext";
import { useAnalyticsOverview } from "@/hooks/useAnalyticsOverview";
import { useDevices, useSubscribers } from "@/hooks/useAppCollections";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

export function AppDetail() {
  const { appId } = useParams();
  const nav = useNavigate();
  const { toast } = useToast();
  const { findApp, campaigns, updateApp, deleteApp } = useApkzio();
  const app = findApp(appId);
  const overview = useAnalyticsOverview(appId ?? "app-detail");
  const {
    data: devices,
    error: devicesError,
    loading: devicesLoading,
    refetch: refetchDevices,
  } = useDevices(app?.id);
  const {
    data: subscribers,
    error: subscribersError,
    loading: subscribersLoading,
    refetch: refetchSubscribers,
  } = useSubscribers(app?.id);
  const [tab, setTab] = useState("overview");
  const [sdkOpen, setSdkOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsName, setSettingsName] = useState("");
  const [settingsStatus, setSettingsStatus] = useState("active");
  const [settingsFcmProjectId, setSettingsFcmProjectId] = useState("");
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [deletingApp, setDeletingApp] = useState(false);

  useEffect(() => {
    if (!app || !settingsOpen) return;
    setSettingsName(app.name);
    setSettingsStatus(app.status);
    setSettingsFcmProjectId(app.fcm_project_id ?? "");
    setSettingsError(null);
  }, [app, settingsOpen]);

  if (!app) {
    return (
      <EmptyState
        icon={<Icon.Layers size={20} />}
        title="App not found"
        description="The app you're looking for either doesn't exist or you don't have access."
        action={
          <Link to="/apps">
            <Button variant="primary" leading={<Icon.ArrowLeft size={14} />}>
              Back to apps
            </Button>
          </Link>
        }
      />
    );
  }

  const installs = overview.dailyInstalls.slice(-30);
  const hb = overview.hourlyHeartbeats;
  const geo = overview.geoBreakdown;
  const appCampaigns = campaigns.filter((c) => c.app_id === app.id).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  const recent = appCampaigns.slice(0, 5);
  const fleetPreview = devices.slice(0, 12);

  const copyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ tone: "success", title: "Copied", description: label });
    } catch {
      toast({ tone: "error", title: "Copy failed", description: "Clipboard permission denied." });
    }
  };

  const saveSettings = async () => {
    if (!app) return;
    const nextName = settingsName.trim();
    if (!nextName) {
      setSettingsError("Enter an app name.");
      return;
    }
    setSettingsSaving(true);
    setSettingsError(null);
    try {
      const row = await updateApp(app.id, {
        name: nextName,
        status: settingsStatus as typeof app.status,
        fcm_project_id: settingsFcmProjectId.trim() || null,
      });
      toast({ tone: "success", title: "App settings saved", description: row.name });
      setSettingsOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save app settings.";
      setSettingsError(msg);
      toast({ tone: "error", title: "Save failed", description: msg });
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleDeleteApp = async () => {
    if (!app) return;
    const confirmed = window.confirm(`Delete ${app.name}? This removes the app from this dashboard.`);
    if (!confirmed) return;
    setDeletingApp(true);
    setSettingsError(null);
    try {
      await deleteApp(app.id);
      toast({ tone: "success", title: "App deleted", description: app.name });
      nav("/apps");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not delete app.";
      setSettingsError(msg);
      toast({ tone: "error", title: "Delete failed", description: msg });
    } finally {
      setDeletingApp(false);
    }
  };

  const tabDefs = [
    { value: "overview", label: "Overview" },
    {
      value: "devices",
      label: "Devices",
      count: devicesLoading ? undefined : devices.length,
    },
    {
      value: "subscribers",
      label: "Subscribers",
      count: subscribersLoading ? undefined : subscribers.length,
    },
    {
      value: "campaigns",
      label: "Campaigns",
      count: appCampaigns.length,
    },
    { value: "events", label: "Events" },
    { value: "config", label: "Config" },
  ] as const;

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Apps", to: "/apps" }, { label: app.name }]}
        title={
          <span className="flex items-center gap-3">
            <div
              className={cn(
                "grid h-10 w-10 place-items-center rounded-md bg-gradient-to-br font-mono text-[14px] font-medium text-bone",
                app.icon_color,
              )}
            >
              {app.icon_glyph}
            </div>
            <span>{app.name}</span>
            <StatusPill status={app.status} />
          </span>
        }
        description={<span className="font-mono text-[12px] text-bone-mid">{app.package_name}</span>}
        actions={
          <>
            <Button variant="secondary" leading={<Icon.Code size={14} />} onClick={() => setSdkOpen(true)}>
              SDK
            </Button>
            <Button variant="secondary" leading={<Icon.Cog size={14} />} onClick={() => setSettingsOpen(true)}>
              Settings
            </Button>
            <Link to={`/campaigns/new`}>
              <Button variant="primary" leading={<Icon.Send size={14} />}>
                Send push
              </Button>
            </Link>
          </>
        }
      />

      <Tabs value={tab} onChange={setTab} tabs={[...tabDefs]} className="mb-6" />

      {tab === "overview" && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              label="Live users"
              value={compact(app.live_users)}
              deltaPct={3.4}
              emphasis
              trailing={<Sparkline data={hb.slice(-24)} width={80} height={36} />}
            />
            <StatCard
              label="Active · 24h"
              value={compact(app.active_devices_24h)}
              deltaPct={1.2}
              hint={`${pct((app.active_devices_24h / Math.max(1, app.total_installs)) * 100)} of installs`}
              trailing={<Sparkline data={installs.slice(-14)} color="#7CB7FF" width={80} height={36} />}
            />
            <StatCard
              label="Installs total"
              value={compact(app.total_installs)}
              deltaPct={5.8}
              trailing={<Sparkline data={installs} color="#5DCFA3" width={80} height={36} />}
            />
            <StatCard
              label="Delivery rate"
              value={pct(app.delivery_rate * 100, 1)}
              deltaPct={0.4}
              hint="rolling 7d"
              trailing={<Sparkline data={installs.slice(-14)} color="#FF8A4C" width={80} height={36} />}
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Installs · 30d" description="Daily install count" trailing={<span className="font-mono text-[11px] text-bone-low">UTC</span>} />
              <CardBody>
                <AreaChart data={installs} height={240} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Live users · 48h" description="Heartbeats per hour" />
              <CardBody>
                <AreaChart data={hb} color="#7CB7FF" height={240} showAxis={false} />
              </CardBody>
            </Card>
          </div>

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
                  <Link to="/campaigns" className="text-[12px] text-bone-mid hover:text-bone">
                    All campaigns →
                  </Link>
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
                          <Button variant="primary" leading={<Icon.Plus size={14} />}>
                            Create campaign
                          </Button>
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
                              <div className="font-mono text-[10px] tabular-nums text-bone-low">
                                {pct((c.opened_count / Math.max(1, c.delivered_count)) * 100)} open
                              </div>
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

          <div className="mt-6">
            <Card>
              <CardHeader
                title="Fleet snapshot"
                description="Most recently active devices"
                trailing={
                  <Link to={`/apps/${app.id}/devices`}>
                    <Button variant="ghost" size="sm" trailing={<Icon.ArrowRight size={12} />}>
                      All devices
                    </Button>
                  </Link>
                }
              />
              <CardBody padded={false}>
                {devicesError && (
                  <div
                    role="alert"
                    className="mx-5 mt-4 flex flex-col gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <p className="text-[12px] text-danger">{devicesError}</p>
                    <Button variant="ghost" size="sm" onClick={() => refetchDevices()}>
                      Retry
                    </Button>
                  </div>
                )}
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
                      {devicesLoading && fleetPreview.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-10 text-center text-[13px] text-bone-mid">
                            Loading devices…
                          </td>
                        </tr>
                      ) : (
                        fleetPreview.map((d) => (
                          <tr key={d.id} className="border-b border-line-1/70 last:border-b-0 hover:bg-ink-2/60">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-3">
                                <div className="grid h-8 w-8 place-items-center rounded border border-line-1 bg-ink-2 text-bone-low">
                                  <Icon.Phone size={14} />
                                </div>
                                <div>
                                  <div className="font-medium text-bone">
                                    {d.manufacturer} {d.model}
                                  </div>
                                  <div className="font-mono text-[10px] text-bone-low">{d.install_hash.slice(0, 12)}…</div>
                                </div>
                              </div>
                            </td>
                            <td className="hidden px-4 py-3 sm:table-cell">
                              <Badge dot tone="neutral">
                                {d.country_code}
                              </Badge>
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
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          </div>
        </>
      )}

      {tab === "devices" && (
        <Card>
          <CardHeader
            title="Devices"
            description="Installs reporting heartbeats for this app"
            trailing={
              <Link to={`/apps/${app.id}/devices`}>
                <Button variant="ghost" size="sm" trailing={<Icon.ArrowRight size={12} />}>
                  Full devices page
                </Button>
              </Link>
            }
          />
          <CardBody padded={false}>
            {devicesError && (
              <div
                role="alert"
                className="mx-5 mt-4 flex flex-col gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-[12px] text-danger">{devicesError}</p>
                <Button variant="ghost" size="sm" onClick={() => refetchDevices()}>
                  Retry
                </Button>
              </div>
            )}
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
                  {devicesLoading && devices.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-[13px] text-bone-mid">
                        Loading devices…
                      </td>
                    </tr>
                  ) : devices.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-10">
                        <EmptyState
                          icon={<Icon.Phone size={18} />}
                          title="No devices yet"
                          description="Once the SDK registers installs, they will show up here."
                        />
                      </td>
                    </tr>
                  ) : (
                    devices.map((d) => (
                      <tr key={d.id} className="border-b border-line-1/70 last:border-b-0 hover:bg-ink-2/60">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="grid h-8 w-8 place-items-center rounded border border-line-1 bg-ink-2 text-bone-low">
                              <Icon.Phone size={14} />
                            </div>
                            <div>
                              <div className="font-medium text-bone">
                                {d.manufacturer} {d.model}
                              </div>
                              <div className="font-mono text-[10px] text-bone-low">{d.install_hash}</div>
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <Badge dot tone="neutral">
                            {d.country_code}
                          </Badge>
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {tab === "subscribers" && (
        <Card>
          <CardHeader
            title="Push subscribers"
            description="FCM tokens registered for this app"
            trailing={
              <Link to={`/apps/${app.id}/subscribers`}>
                <Button variant="ghost" size="sm" trailing={<Icon.ArrowRight size={12} />}>
                  Full subscribers page
                </Button>
              </Link>
            }
          />
          <CardBody padded={false}>
            {subscribersError && (
              <div
                role="alert"
                className="mx-5 mt-4 flex flex-col gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-[12px] text-danger">{subscribersError}</p>
                <Button variant="ghost" size="sm" onClick={() => refetchSubscribers()}>
                  Retry
                </Button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-line-1 text-bone-low">
                    <th className="px-5 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em]">Token</th>
                    <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em]">Valid</th>
                    <th className="px-5 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.14em]">Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {subscribersLoading && subscribers.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-5 py-10 text-center text-[13px] text-bone-mid">
                        Loading subscribers…
                      </td>
                    </tr>
                  ) : subscribers.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-5 py-10">
                        <EmptyState
                          icon={<Icon.Send size={18} />}
                          title="No subscribers yet"
                          description="Tokens appear after devices opt in to push for this app."
                        />
                      </td>
                    </tr>
                  ) : (
                    subscribers.map((s) => (
                      <tr key={s.id} className="border-b border-line-1/70 last:border-b-0 hover:bg-ink-2/60">
                        <td className="px-5 py-3 font-mono text-[11px] text-bone-mid">{s.fcm_token_redacted}</td>
                        <td className="px-4 py-3">
                          <Badge dot tone={s.is_valid ? "ok" : "danger"}>
                            {s.is_valid ? "valid" : "invalid"}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-right text-[12px] text-bone-mid">{relTime(s.last_seen_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {tab === "campaigns" && (
        <Card>
          <CardHeader
            title="Campaigns"
            description="Push notifications for this app"
            trailing={
              <div className="flex items-center gap-2">
                <Link to="/campaigns" className="text-[12px] text-bone-mid hover:text-bone">
                  All campaigns →
                </Link>
                <Link to="/campaigns/new">
                  <Button variant="primary" size="sm" leading={<Icon.Plus size={12} />}>
                    New
                  </Button>
                </Link>
              </div>
            }
          />
          <CardBody padded={false}>
            {appCampaigns.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={<Icon.Send size={18} />}
                  title="No campaigns for this app"
                  description="Create a campaign to reach your subscribers."
                  action={
                    <Link to="/campaigns/new">
                      <Button variant="primary" leading={<Icon.Plus size={14} />}>
                        Create campaign
                      </Button>
                    </Link>
                  }
                />
              </div>
            ) : (
              <ul>
                {appCampaigns.map((c) => (
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
                        <div className="mt-0.5 font-mono text-[10px] text-bone-low">{dateTime(c.created_at)}</div>
                      </div>
                      <StatusPill status={c.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}

      {tab === "events" && (
        <Card>
          <CardHeader title="Events" description="Device and messaging event stream" />
          <CardBody>
            <EmptyState
              icon={<Icon.Chart size={18} />}
              title="Event explorer is not on this page"
              description="Use Analytics for cross-app charts and rollups. Per-app event timelines will land in a later release."
              action={
                <Link to="/analytics">
                  <Button variant="primary" trailing={<Icon.ArrowRight size={12} />}>
                    Open analytics
                  </Button>
                </Link>
              }
            />
          </CardBody>
        </Card>
      )}

      {tab === "config" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="App identity" description="Read-only fields from your backend" />
            <CardBody className="space-y-3 text-[13px]">
              <div className="flex justify-between gap-3 border-b border-line-1/70 pb-2">
                <span className="text-bone-low">App ID</span>
                <span className="flex items-center gap-2 font-mono text-[11px] text-bone">{app.id}</span>
              </div>
              <div className="flex justify-between gap-3 border-b border-line-1/70 pb-2">
                <span className="text-bone-low">Package</span>
                <span className="font-mono text-[12px] text-bone">{app.package_name}</span>
              </div>
              <div className="flex justify-between gap-3 border-b border-line-1/70 pb-2">
                <span className="text-bone-low">App key</span>
                <span className="font-mono text-[11px] text-bone-mid">{app.app_key.slice(0, 16)}…</span>
              </div>
              <div className="flex justify-between gap-3 border-b border-line-1/70 pb-2">
                <span className="text-bone-low">FCM project</span>
                <span className="font-mono text-[12px] text-bone">{app.fcm_project_id ?? "—"}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-bone-low">Created</span>
                <span className="text-bone-mid">{dateTime(app.created_at)}</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="secondary" size="sm" onClick={() => void copyText("App ID", app.id)}>
                  Copy app ID
                </Button>
                <Button variant="secondary" size="sm" onClick={() => void copyText("Package name", app.package_name)}>
                  Copy package
                </Button>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Where to edit" description="Dashboard areas that change behavior" />
            <CardBody className="space-y-3 text-[13px] text-bone-mid">
              <p>
                Status, FCM linkage, and server keys are managed from{" "}
                <Link to="/keys" className="text-signal hover:underline">
                  API Keys
                </Link>{" "}
                and your deployment&apos;s admin API — not inline on this screen yet.
              </p>
              <Link to="/settings">
                <Button variant="ghost" size="sm" trailing={<Icon.ArrowRight size={12} />}>
                  Workspace settings
                </Button>
              </Link>
            </CardBody>
          </Card>
        </div>
      )}

      <Modal
        open={sdkOpen}
        onClose={() => setSdkOpen(false)}
        title="SDK integration"
        description="Wire the Android SDK with this app’s package name and an API key for server-side sends."
        footer={
          <Button variant="ghost" onClick={() => setSdkOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="space-y-4 text-[13px] text-bone-mid">
          <div className="rounded-lg border border-line-1 bg-ink-2/40 p-3 font-mono text-[11px] text-bone">
            <div>
              <span className="text-bone-low">packageName</span> {app.package_name}
            </div>
            <div className="mt-1">
              <span className="text-bone-low">appId</span> {app.id}
            </div>
          </div>
          <p>Initialize the SDK in your Application class, then register for push. Create a scoped API key for backend campaigns and webhooks.</p>
          <div className="flex flex-wrap gap-2">
            <Link to="/keys" onClick={() => setSdkOpen(false)}>
              <Button variant="primary" leading={<Icon.Key size={14} />}>
                API keys
              </Button>
            </Link>
            <Button variant="secondary" onClick={() => void copyText("App ID", app.id)}>
              Copy app ID
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={settingsOpen}
        onClose={() => {
          if (!settingsSaving && !deletingApp) setSettingsOpen(false);
        }}
        title="App settings"
        description="Edit dashboard metadata for this Android app."
        footer={
          <>
            <Button variant="danger" onClick={() => void handleDeleteApp()} disabled={settingsSaving || deletingApp} leading={<Icon.Trash size={14} />}>
              {deletingApp ? "Deleting…" : "Delete app"}
            </Button>
            <div className="flex-1" />
            <Button variant="ghost" onClick={() => setSettingsOpen(false)} disabled={settingsSaving || deletingApp}>
              Close
            </Button>
            <Button variant="primary" onClick={() => void saveSettings()} disabled={settingsSaving || deletingApp}>
              {settingsSaving ? "Saving…" : "Save settings"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {settingsError && (
            <div role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-[12px] text-danger">
              {settingsError}
            </div>
          )}
          <Field label="App name" required>
            <Input
              value={settingsName}
              onChange={(e) => setSettingsName(e.target.value)}
              disabled={settingsSaving || deletingApp}
              autoComplete="off"
            />
          </Field>
          <Field label="Package name">
            <Input value={app.package_name} disabled />
          </Field>
          <Field label="Status">
            <Select
              value={settingsStatus}
              onChange={(e) => setSettingsStatus(e.target.value)}
              disabled={settingsSaving || deletingApp}
              options={[
                { value: "active", label: "Active" },
                { value: "paused", label: "Paused" },
                { value: "suspended", label: "Suspended" },
              ]}
            />
          </Field>
          <Field label="FCM project ID">
            <Input
              value={settingsFcmProjectId}
              onChange={(e) => setSettingsFcmProjectId(e.target.value)}
              placeholder="firebase-project-id"
              disabled={settingsSaving || deletingApp}
              autoComplete="off"
            />
          </Field>
          <p className="text-[12px] leading-relaxed text-bone-low">
            Package names are locked after creation. Use API Keys for credentials and workspace Settings for account-level preferences.
          </p>
        </div>
      </Modal>
    </>
  );
}
