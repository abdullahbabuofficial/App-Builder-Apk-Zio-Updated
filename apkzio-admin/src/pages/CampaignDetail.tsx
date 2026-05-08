import { Link, useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusPill, Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { StatCard } from "@/components/ui/StatCard";
import { AndroidPreview } from "@/components/push/AndroidPreview";
import { DeliveryFunnel } from "@/components/push/DeliveryFunnel";
import { AreaChart } from "@/components/charts/AreaChart";
import { BarChart, DonutChart, Sparkline } from "@/components/charts/MiniCharts";
import { EmptyState } from "@/components/ui/Misc";
import { Icon } from "@/lib/icons";
import { commas, compact, dateTime, ms, pct, relTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApkzio } from "@/context/ApkzioDataContext";
import { useAnalyticsOverview } from "@/hooks/useAnalyticsOverview";
import { useToast } from "@/components/ui/Toast";
import type { CampaignErrorsResponse } from "@/lib/api";
import { fetchCampaignErrors } from "@/lib/api";

const REST_ACTIONS_HINT =
  "Pause, cancel, and duplicate require the ApkZio REST API (VITE_APKZIO_DATA_SOURCE=rest with VITE_APKZIO_API_URL). Not available in mock or Supabase-backed mode.";

export function CampaignDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { toast } = useToast();
  const {
    dataSource,
    findApp,
    findCampaign,
    pauseCampaignById,
    cancelCampaignById,
    duplicateCampaignById,
    sendCampaignById,
  } = useApkzio();
  const [actionBusy, setActionBusy] = useState<null | "pause" | "cancel" | "duplicate" | "send">(null);
  const c = findCampaign(id);
  const overview = useAnalyticsOverview(id ?? "campaign-detail");
  const [tab, setTab] = useState("overview");
  const [campaignErrors, setCampaignErrors] = useState<CampaignErrorsResponse | null>(null);
  const [errorsLoading, setErrorsLoading] = useState(false);

  // Fetch campaign errors when tab changes to errors or data source changes
  useEffect(() => {
    if (tab !== "errors" || !id || dataSource === "mock") {
      setCampaignErrors(null);
      return;
    }
    setErrorsLoading(true);
    fetchCampaignErrors(id)
      .then(setCampaignErrors)
      .catch(() => setCampaignErrors(null))
      .finally(() => setErrorsLoading(false));
  }, [id, tab, dataSource]);

  if (!c) {
    return (
      <EmptyState
        icon={<Icon.Send size={20} />}
        title="Campaign not found"
        description="It may have been deleted or you don't have access."
        action={<Link to="/campaigns"><Button variant="primary" leading={<Icon.ArrowLeft size={14} />}>Back to campaigns</Button></Link>}
      />
    );
  }

  const app = findApp(c.app_id);
  const hb = overview.hourlyHeartbeats.slice(-24);
  const geo = overview.geoBreakdown;

  if (!app) {
    return (
      <EmptyState
        icon={<Icon.Send size={20} />}
        title="App not found"
        description="This campaign references an app that is not in your workspace."
        action={<Link to="/campaigns"><Button variant="primary" leading={<Icon.ArrowLeft size={14} />}>Back to campaigns</Button></Link>}
      />
    );
  }

  const openRate = c.delivered_count > 0 ? (c.opened_count / c.delivered_count) * 100 : 0;
  const ctr = c.opened_count > 0 ? (c.clicked_count / c.opened_count) * 100 : 0;

  const restActions = dataSource === "rest";
  const canSendDraft = (dataSource === "rest" || dataSource === "mock") && c.status === "draft";
  const canPauseCancel = restActions && c.status === "scheduled";

  async function runAction(
    kind: "pause" | "cancel" | "duplicate" | "send",
    fn: () => Promise<{ id: string }>,
  ) {
    if (!id) return;
    setActionBusy(kind);
    try {
      const next = await fn();
      toast({
        tone: "success",
        title: kind === "pause" ? "Campaign paused" : kind === "cancel" ? "Campaign cancelled" : kind === "send" ? "Campaign sent" : "Campaign duplicated",
      });
      if (kind === "duplicate") nav(`/campaigns/${next.id}`);
    } catch (e) {
      toast({
        tone: "error",
        title: kind === "pause" ? "Could not pause" : kind === "cancel" ? "Could not cancel" : kind === "send" ? "Could not send" : "Could not duplicate",
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setActionBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Campaigns", to: "/campaigns" }, { label: c.title }]}
        title={
          <span className="flex items-center gap-3">
            <span className="truncate">{c.title}</span>
            <StatusPill status={c.status} />
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-2 font-mono text-[12px] text-bone-mid">
            <span>ID</span><span className="text-bone">{c.id.slice(0, 8)}…</span>
            <span>·</span>
            <span>{app.name}</span>
            <span>·</span>
            <span>{c.target_summary}</span>
          </span>
        }
        actions={
          <>
            {c.status === "scheduled" && (
              <>
                <Button
                  variant="secondary"
                  leading={<Icon.Pause size={14} />}
                  disabled={!canPauseCancel || actionBusy !== null}
                  title={canPauseCancel ? undefined : REST_ACTIONS_HINT}
                  onClick={() => void runAction("pause", () => pauseCampaignById(id!))}
                >
                  {actionBusy === "pause" ? "Pausing…" : "Pause"}
                </Button>
                <Button
                  variant="danger"
                  leading={<Icon.X size={14} />}
                  disabled={!canPauseCancel || actionBusy !== null}
                  title={canPauseCancel ? undefined : REST_ACTIONS_HINT}
                  onClick={() => void runAction("cancel", () => cancelCampaignById(id!))}
                >
                  {actionBusy === "cancel" ? "Cancelling…" : "Cancel"}
                </Button>
              </>
            )}
            {c.status === "draft" && (
              <Button
                variant="primary"
                leading={<Icon.Send size={14} />}
                disabled={!canSendDraft || actionBusy !== null}
                title={canSendDraft ? undefined : "Sending from campaign detail is available in REST/mock mode. Supabase users can send from Create campaign."}
                onClick={() => void runAction("send", () => sendCampaignById(id!))}
              >
                {actionBusy === "send" ? "Sending…" : "Send"}
              </Button>
            )}
            <Button
              variant="secondary"
              leading={<Icon.Copy size={14} />}
              disabled={!restActions || actionBusy !== null}
              title={restActions ? undefined : REST_ACTIONS_HINT}
              onClick={() => void runAction("duplicate", () => duplicateCampaignById(id!))}
            >
              {actionBusy === "duplicate" ? "Duplicating…" : "Duplicate"}
            </Button>
          </>
        }
      />

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "geo", label: "Geo" },
          { value: "errors", label: "Errors", count: c.failed_count > 0 ? c.failed_count : undefined },
          { value: "payload", label: "Payload" },
        ]}
        className="mb-6"
      />

      {tab === "overview" && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Recipients" value={compact(c.recipients_count)} hint="targeted" />
            <StatCard label="Delivered" value={compact(c.delivered_count)} deltaPct={(c.delivered_count / Math.max(1, c.sent_count)) * 100 - 100} hint={`${pct((c.delivered_count / Math.max(1, c.sent_count)) * 100, 1)} of sent`} />
            <StatCard label="Open rate" value={pct(openRate, 1)} hint={`${compact(c.opened_count)} opens`} emphasis trailing={<Sparkline data={hb} width={72} height={36} />} />
            <StatCard label="CTR" value={pct(ctr, 1)} hint={`${compact(c.clicked_count)} clicks`} trailing={<Sparkline data={hb} color="#FF8A4C" width={72} height={36} />} />
          </div>

          {/* Funnel + payload preview */}
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Delivery funnel" description="Recipients → sent → delivered → opened → clicked" />
              <CardBody>
                <DeliveryFunnel
                  recipients={c.recipients_count}
                  sent={c.sent_count}
                  delivered={c.delivered_count}
                  opened={c.opened_count}
                  clicked={c.clicked_count}
                />
                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Meta label="Median latency" value={ms(245)} />
                  <Meta label="Failed" value={commas(c.failed_count)} tone={c.failed_count > 0 ? "danger" : undefined} />
                  <Meta label={c.sent_at ? "Sent" : c.scheduled_at ? "Scheduled" : "Created"} value={dateTime(c.sent_at ?? c.scheduled_at ?? c.created_at)} />
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Notification" description="As recipients see it" />
              <CardBody>
                <AndroidPreview
                  appName={app.name}
                  appGlyph={app.icon_glyph}
                  iconColor={app.icon_color}
                  title={c.title}
                  body={c.body}
                  imageUrl={c.image_url}
                  variant="banner"
                />
                {c.click_url && (
                  <div className="mt-3 rounded-md border border-line-1 bg-ink-2/40 p-3">
                    <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-low">Click URL</div>
                    <div className="mt-1 truncate font-mono text-[12px] text-bone">{c.click_url}</div>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          {/* Opens over time */}
          <div className="mt-6">
            <Card>
              <CardHeader title="Engagement over time" description="Opens and clicks in the 24h after dispatch" />
              <CardBody>
                <AreaChart data={hb} color="#CDFF3F" height={220} />
              </CardBody>
              <CardFooter>
                <div className="flex items-center gap-4 font-mono text-[11px] text-bone-low">
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-signal" /> Opens</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-info" /> Clicks</span>
                </div>
                <div className="font-mono text-[11px] text-bone-low">UTC</div>
              </CardFooter>
            </Card>
          </div>
        </>
      )}

      {tab === "geo" && (
        <Card>
          <CardHeader title="Geographic breakdown" description="Delivered notifications by country" />
          <CardBody>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_1fr] lg:items-center">
              <div className="flex justify-center">
                <DonutChart
                  size={180}
                  thickness={16}
                  centerLabel="Delivered"
                  centerValue={compact(c.delivered_count)}
                  segments={geo.slice(0, 5).map((g, i) => ({ value: g.v, color: ["#CDFF3F", "#7CB7FF", "#FF8A4C", "#5DCFA3", "#E280C9"][i] }))}
                />
              </div>
              <div>
                <BarChart
                  rows={geo.slice(0, 10).map((g, i) => ({
                    label: g.name,
                    value: g.v,
                    color: ["#CDFF3F", "#7CB7FF", "#FF8A4C", "#5DCFA3", "#E280C9", "#FFB547", "#CDFF3F", "#7CB7FF", "#FF8A4C", "#5DCFA3"][i],
                  }))}
                  format={compact}
                />
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {tab === "errors" && (
        c.failed_count === 0 ? (
          <EmptyState icon={<Icon.Check size={18} />} title="No errors" description="All sent messages were accepted by FCM." />
        ) : errorsLoading ? (
          <Card>
            <CardHeader title="Errors" description="Loading error details…" />
            <CardBody>
              <div className="py-8 text-center text-bone-mid">
                <div className="mb-2">Loading campaign errors…</div>
              </div>
            </CardBody>
          </Card>
        ) : dataSource !== "mock" && campaignErrors && campaignErrors.by_code.length > 0 ? (
          <Card>
            <CardHeader
              title="Errors"
              description={`${commas(campaignErrors.total)} deliveries failed`}
            />
            <CardBody padded={false}>
              <ul>
                {campaignErrors.by_code.map((e) => (
                  <li key={e.code} className="flex items-center gap-4 border-b border-line-1/70 px-5 py-4 last:border-b-0">
                    <Icon.Alert size={16} className="text-warn" />
                    <div className="flex-1">
                      <div className="font-mono text-[12px] text-bone">{e.code}</div>
                      <div className="text-[12px] text-bone-mid">{e.message || "No description"}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="font-mono text-[13px] tabular-nums text-bone">{commas(e.count)}</div>
                      <div className="text-[11px] text-bone-low">{pct(e.pct, 1)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardHeader
              title="Errors"
              description={`${commas(c.failed_count)} deliveries failed`}
              trailing={<Badge tone="warn">Sample data</Badge>}
            />
            <CardBody padded={false}>
              <div role="note" className="mb-3 rounded-md border border-warn/30 bg-warn/5 px-3 py-2 text-[12px] text-bone-mid">
                Sample distribution &mdash; counts are illustrative until the campaign-errors API ships.
              </div>
              <ul>
                {[
                  { code: "UNREGISTERED", count: Math.floor(c.failed_count * 0.6), desc: "Token no longer valid; subscriber removed." },
                  { code: "INVALID_ARGUMENT", count: Math.floor(c.failed_count * 0.2), desc: "Token format rejected by FCM." },
                  { code: "QUOTA_EXCEEDED", count: Math.floor(c.failed_count * 0.12), desc: "Project send quota hit; retried with backoff." },
                  { code: "UNAVAILABLE", count: Math.floor(c.failed_count * 0.08), desc: "FCM transient unavailability." },
                ].map((e) => (
                  <li key={e.code} className="flex items-center gap-4 border-b border-line-1/70 px-5 py-4 last:border-b-0">
                    <Icon.Alert size={16} className="text-warn" />
                    <div className="flex-1">
                      <div className="font-mono text-[12px] text-bone">{e.code}</div>
                      <div className="text-[12px] text-bone-mid">{e.desc}</div>
                    </div>
                    <div className="font-mono text-[13px] tabular-nums text-bone">{commas(e.count)}</div>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        )
      )}

      {tab === "payload" && (
        <Card>
          <CardHeader title="FCM payload" description="The exact JSON sent to Firebase Cloud Messaging" />
          <CardBody padded={false}>
            <pre className="overflow-x-auto bg-ink-0 p-5 font-mono text-[12px] leading-relaxed text-bone">
{`{
  "message": {
    "topic": "${c.target_type === 'all' ? 'all' : 'targeted'}",
    "notification": {
      "title": ${JSON.stringify(c.title)},
      "body":  ${JSON.stringify(c.body)}${c.image_url ? `,
      "image": "${c.image_url}"` : ""}
    },
    "android": {
      "priority": "high",
      "notification": {
        "channel_id": "default",
        "click_action": ${JSON.stringify(c.click_url ?? "")}
      }
    },
    "data": {
      "campaign_id": "${c.id}",
      "app_id": "${app.id}"
    }
  }
}`}
            </pre>
          </CardBody>
          <CardFooter>
            <Badge dot>application/json</Badge>
            <Button variant="ghost" size="sm" leading={<Icon.Copy size={12} />}>Copy</Button>
          </CardFooter>
        </Card>
      )}
    </>
  );
}

function Meta({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <div className="rounded-lg border border-line-1 bg-ink-2/40 p-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-low">{label}</div>
      <div className={cn("mt-1 font-display text-[16px] font-semibold leading-none num", tone === "danger" ? "text-danger" : "text-bone")}>{value}</div>
    </div>
  );
}
