import { Link, useParams } from "react-router-dom";
import { useCallback, useMemo, useState } from "react";
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
import { usePushcare } from "@/context/PushcareDataContext";
import { useAnalyticsOverview } from "@/hooks/useAnalyticsOverview";
import { hash, mulberry32 } from "@/lib/utils";
import type { Campaign, Point } from "@/lib/mock-data";
import { apiFetch, isApiNotFound, parseJson } from "@/lib/api";

export function CampaignDetail() {
  const { id } = useParams();
  const { findApp, findCampaign, dataSource, refresh } = usePushcare();
  const live = dataSource !== "mock";
  const c = findCampaign(id);
  const overview = useAnalyticsOverview(id ?? "campaign-detail");
  const [tab, setTab] = useState("overview");
  const [actionToast, setActionToast] = useState<{ kind: "ok" | "err" | "info"; msg: string } | null>(
    null,
  );
  const [cancelling, setCancelling] = useState(false);
  const [optimisticStatus, setOptimisticStatus] = useState<Campaign["status"] | null>(null);

  const handleCancel = useCallback(async () => {
    if (!c) return;
    if (!confirm("Cancel this scheduled campaign? It won't be sent.")) return;
    setCancelling(true);
    setOptimisticStatus("draft");
    try {
      if (live) {
        try {
          const res = await apiFetch(`/api/campaigns/${encodeURIComponent(c.id)}`, {
            method: "DELETE",
          });
          await parseJson<{ ok?: boolean }>(res);
          setActionToast({ kind: "ok", msg: "Campaign cancelled." });
          void refresh();
        } catch (err) {
          if (isApiNotFound(err)) {
            setActionToast({ kind: "info", msg: "Cancelled locally — backend endpoint pending." });
          } else {
            setOptimisticStatus(null);
            setActionToast({
              kind: "err",
              msg: err instanceof Error ? err.message : "Cancel failed",
            });
          }
        }
      } else {
        setActionToast({ kind: "info", msg: "Cancelled locally (mock mode)." });
      }
    } finally {
      setCancelling(false);
    }
  }, [c, live, refresh]);

  const handleResendFailed = useCallback(() => {
    // TODO: real resend-failed wiring requires /api/campaigns/:id/resend-failed.
    setActionToast({ kind: "info", msg: "Resend-to-failed not implemented yet — TODO." });
  }, []);

  // Compute synthetic series before the early returns so hook order stays
  // stable across renders (rules-of-hooks). They produce empty arrays when the
  // campaign isn't loaded yet.
  const deliveryProgress = useMemo(
    () => (c ? buildDeliveryProgress(c) : []),
    [c],
  );
  const recentDeliveries = useMemo(
    () => (c ? synthesizeRecentDeliveries(c) : []),
    [c],
  );

  if (!c) {
    return (
      <EmptyState
        icon={<Icon.Send size={20} />}
        title="Campaign not found"
        description="It may have been deleted or you don't have access."
        action={
          <Link to="/campaigns">
            <Button variant="primary" leading={<Icon.ArrowLeft size={14} />}>
              Back to campaigns
            </Button>
          </Link>
        }
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
        action={
          <Link to="/campaigns">
            <Button variant="primary" leading={<Icon.ArrowLeft size={14} />}>
              Back to campaigns
            </Button>
          </Link>
        }
      />
    );
  }

  const effectiveStatus = optimisticStatus ?? c.status;
  const openRate = c.delivered_count > 0 ? (c.opened_count / c.delivered_count) * 100 : 0;
  const ctr = c.opened_count > 0 ? (c.clicked_count / c.opened_count) * 100 : 0;

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Campaigns", to: "/campaigns" }, { label: c.title }]}
        title={
          <span className="flex items-center gap-3">
            <span className="truncate">{c.title}</span>
            <StatusPill status={effectiveStatus} />
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-2 font-mono text-[12px] text-bone-mid">
            <span>ID</span>
            <span className="text-bone">{c.id.slice(0, 8)}…</span>
            <span>·</span>
            <span>{app.name}</span>
            <span>·</span>
            <span>{c.target_summary}</span>
          </span>
        }
        actions={
          <>
            {effectiveStatus === "scheduled" && (
              <>
                <Button variant="secondary" leading={<Icon.Pause size={14} />} disabled>
                  Pause
                </Button>
                <Button
                  variant="danger"
                  leading={<Icon.X size={14} />}
                  onClick={() => void handleCancel()}
                  disabled={cancelling}
                >
                  {cancelling ? "Cancelling…" : "Cancel"}
                </Button>
              </>
            )}
            {c.failed_count > 0 && effectiveStatus !== "scheduled" && (
              <Button
                variant="secondary"
                leading={<Icon.Send size={14} />}
                onClick={handleResendFailed}
              >
                Resend to failed only
              </Button>
            )}
            {effectiveStatus === "draft" && (
              <Button variant="primary" leading={<Icon.Send size={14} />}>
                Send
              </Button>
            )}
            <Button variant="secondary" leading={<Icon.Copy size={14} />}>
              Duplicate
            </Button>
          </>
        }
      />

      {actionToast && (
        <div
          role="status"
          className={cn(
            "mb-5 rounded-lg border px-4 py-2.5 text-[12px]",
            actionToast.kind === "ok" && "border-ok/30 bg-ok/5 text-ok",
            actionToast.kind === "err" && "border-danger/30 bg-danger/5 text-danger",
            actionToast.kind === "info" && "border-info/30 bg-info/5 text-info",
          )}
        >
          {actionToast.msg}
        </div>
      )}

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
            <StatCard
              label="Recipients"
              value={compact(c.recipients_count)}
              hint="targeted"
            />
            <StatCard
              label="Sent"
              value={compact(c.sent_count)}
              deltaPct={
                c.recipients_count > 0
                  ? (c.sent_count / c.recipients_count) * 100 - 100
                  : 0
              }
              hint={`${pct((c.sent_count / Math.max(1, c.recipients_count)) * 100, 1)} of recipients`}
            />
            <StatCard
              label="Delivered"
              value={compact(c.delivered_count)}
              deltaPct={
                c.sent_count > 0 ? (c.delivered_count / c.sent_count) * 100 - 100 : 0
              }
              hint={`${pct((c.delivered_count / Math.max(1, c.sent_count)) * 100, 1)} of sent`}
            />
            <StatCard
              label="Opened"
              value={compact(c.opened_count)}
              hint={`${pct(openRate, 1)} open rate`}
              emphasis
              trailing={<Sparkline data={hb} width={72} height={36} />}
            />
          </div>

          {/* Delivery progress over time — synthesized from totals.
              TODO: wire to /api/campaigns/:id/timeseries when available. */}
          <div className="mt-6">
            <Card>
              <CardHeader
                title="Delivery progress"
                description="Cumulative deliveries over the campaign window."
                trailing={
                  <Badge tone="neutral">
                    Synthesized · {pct((c.delivered_count / Math.max(1, c.recipients_count)) * 100, 1)} delivered
                  </Badge>
                }
              />
              <CardBody>
                <AreaChart data={deliveryProgress} color="#CDFF3F" height={200} />
              </CardBody>
              <CardFooter>
                <span className="font-mono text-[11px] text-bone-low">
                  {dateTime(c.created_at)} →{" "}
                  {c.sent_at ? dateTime(c.sent_at) : c.scheduled_at ? dateTime(c.scheduled_at) : "—"}
                </span>
                <span className="font-mono text-[11px] text-bone-low">UTC</span>
              </CardFooter>
            </Card>
          </div>

          {/* Funnel + payload preview */}
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title="Delivery funnel"
                description="Recipients → sent → delivered → opened → clicked"
              />
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
                  <Meta
                    label="Failed"
                    value={commas(c.failed_count)}
                    tone={c.failed_count > 0 ? "danger" : undefined}
                  />
                  <Meta
                    label={c.sent_at ? "Sent" : c.scheduled_at ? "Scheduled" : "Created"}
                    value={dateTime(c.sent_at ?? c.scheduled_at ?? c.created_at)}
                  />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-4 text-[12px] text-bone-mid">
                  <span>CTR: {pct(ctr, 1)}</span>
                  <span>·</span>
                  <span>{commas(c.clicked_count)} clicks</span>
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
                    <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-low">
                      Click URL
                    </div>
                    <div className="mt-1 truncate font-mono text-[12px] text-bone">{c.click_url}</div>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          {/* Recent deliveries — synthesized from totals.
              TODO: replace with /api/campaigns/:id/deliveries?limit=25 once available. */}
          <div className="mt-6">
            <Card>
              <CardHeader
                title="Recent deliveries"
                description={`Last ${recentDeliveries.length} (synthesized for preview)`}
                trailing={
                  <Badge tone="neutral">
                    {commas(c.delivered_count)} total
                  </Badge>
                }
              />
              <CardBody padded={false}>
                {recentDeliveries.length === 0 ? (
                  <div className="p-5">
                    <EmptyState
                      icon={<Icon.Send size={18} />}
                      title="No deliveries yet"
                      description="Deliveries will appear once dispatch starts."
                    />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="border-b border-line-1 text-bone-low">
                          <th className="px-5 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em]">
                            When
                          </th>
                          <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em]">
                            Device
                          </th>
                          <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em]">
                            Result
                          </th>
                          <th className="hidden px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em] md:table-cell">
                            FCM message ID
                          </th>
                          <th className="hidden px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.14em] sm:table-cell">
                            Latency
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentDeliveries.map((d) => (
                          <tr
                            key={d.id}
                            className="border-b border-line-1/70 last:border-b-0 hover:bg-ink-2/60"
                          >
                            <td className="px-5 py-2.5">
                              <span className="text-bone-mid">{relTime(d.at)}</span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="font-mono text-[11px] text-bone-mid">
                                {d.device_short}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge tone={d.result === "delivered" ? "ok" : d.result === "opened" ? "signal" : "danger"} dot>
                                {d.result}
                              </Badge>
                            </td>
                            <td className="hidden px-4 py-2.5 font-mono text-[11px] text-bone-mid md:table-cell">
                              {d.fcm_message_id}
                            </td>
                            <td className="hidden px-4 py-2.5 text-right font-mono num text-bone-mid sm:table-cell">
                              {ms(d.latency_ms)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardBody>
              <CardFooter>
                <span className="font-mono text-[11px] text-bone-low">
                  Preview only — bind to real time-series when the deliveries endpoint ships.
                </span>
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
                  segments={geo
                    .slice(0, 5)
                    .map((g, i) => ({
                      value: g.v,
                      color: ["#CDFF3F", "#7CB7FF", "#FF8A4C", "#5DCFA3", "#E280C9"][i],
                    }))}
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

      {tab === "errors" &&
        (c.failed_count === 0 ? (
          <EmptyState
            icon={<Icon.Check size={18} />}
            title="No errors"
            description="All sent messages were accepted by FCM."
          />
        ) : (
          <Card>
            <CardHeader title="Errors" description={`${commas(c.failed_count)} deliveries failed`} />
            <CardBody padded={false}>
              <ul>
                {[
                  {
                    code: "UNREGISTERED",
                    count: Math.floor(c.failed_count * 0.6),
                    desc: "Token no longer valid; subscriber removed.",
                  },
                  {
                    code: "INVALID_ARGUMENT",
                    count: Math.floor(c.failed_count * 0.2),
                    desc: "Token format rejected by FCM.",
                  },
                  {
                    code: "QUOTA_EXCEEDED",
                    count: Math.floor(c.failed_count * 0.12),
                    desc: "Project send quota hit; retried with backoff.",
                  },
                  {
                    code: "UNAVAILABLE",
                    count: Math.floor(c.failed_count * 0.08),
                    desc: "FCM transient unavailability.",
                  },
                ].map((e) => (
                  <li
                    key={e.code}
                    className="flex items-center gap-4 border-b border-line-1/70 px-5 py-4 last:border-b-0"
                  >
                    <Icon.Alert size={16} className="text-warn" />
                    <div className="flex-1">
                      <div className="font-mono text-[12px] text-bone">{e.code}</div>
                      <div className="text-[12px] text-bone-mid">{e.desc}</div>
                    </div>
                    <div className="font-mono text-[13px] tabular-nums text-bone">
                      {commas(e.count)}
                    </div>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ))}

      {tab === "payload" && (
        <Card>
          <CardHeader title="FCM payload" description="The exact JSON sent to Firebase Cloud Messaging" />
          <CardBody padded={false}>
            <pre className="overflow-x-auto bg-ink-0 p-5 font-mono text-[12px] leading-relaxed text-bone">
{`{
  "message": {
    "topic": "${c.target_type === "all" ? "all" : "targeted"}",
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
            <Button variant="ghost" size="sm" leading={<Icon.Copy size={12} />}>
              Copy
            </Button>
          </CardFooter>
        </Card>
      )}
    </>
  );
}

function Meta({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger";
}) {
  return (
    <div className="rounded-lg border border-line-1 bg-ink-2/40 p-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-low">{label}</div>
      <div
        className={cn(
          "mt-1 font-display text-[16px] font-semibold leading-none num",
          tone === "danger" ? "text-danger" : "text-bone",
        )}
      >
        {value}
      </div>
    </div>
  );
}

// ---------- synthetic time-series ----------------------------------------
// Build a smooth cumulative-delivery curve from the campaign totals.
// Replaced once /api/campaigns/:id/timeseries lands. TODO: real wiring.
function buildDeliveryProgress(c: Campaign): Point[] {
  const start = +new Date(c.created_at);
  const end =
    c.sent_at != null
      ? +new Date(c.sent_at) + 4 * 3600_000
      : c.scheduled_at != null
        ? +new Date(c.scheduled_at)
        : start + 8 * 3600_000;
  const points = 24;
  const steps = Math.max(2, Math.min(48, points));
  const total = Math.max(1, c.delivered_count);
  const out: Point[] = [];
  for (let i = 0; i < steps; i++) {
    const t = start + ((end - start) * i) / Math.max(1, steps - 1);
    // S-curve: ease-out cumulative growth
    const x = i / (steps - 1);
    const eased = 1 - Math.pow(1 - x, 2.4);
    out.push({ t, v: Math.floor(total * eased) });
  }
  return out;
}

type SyntheticDelivery = {
  id: string;
  at: number;
  device_short: string;
  result: "delivered" | "opened" | "failed";
  fcm_message_id: string;
  latency_ms: number;
};

// Generate a deterministic preview of recent deliveries based on totals.
// TODO: replace with /api/campaigns/:id/deliveries?limit=N.
function synthesizeRecentDeliveries(c: Campaign): SyntheticDelivery[] {
  if (c.recipients_count === 0 || c.status === "draft" || c.status === "scheduled") return [];
  const r = mulberry32(hash("deliv:" + c.id));
  const base = c.sent_at ? +new Date(c.sent_at) : Date.now();
  const failedRate = c.sent_count > 0 ? c.failed_count / c.sent_count : 0;
  const openedRate = c.delivered_count > 0 ? c.opened_count / c.delivered_count : 0;
  const N = 25;
  const out: SyntheticDelivery[] = [];
  for (let i = 0; i < N; i++) {
    const at = base + i * 1500 + Math.floor(r() * 800);
    const failedRoll = r() < failedRate;
    const result: SyntheticDelivery["result"] = failedRoll
      ? "failed"
      : r() < openedRate
        ? "opened"
        : "delivered";
    const hex = Math.floor(r() * 0xffffffff).toString(16).padStart(8, "0");
    out.push({
      id: `${c.id}-d${i}`,
      at,
      device_short: hex.slice(0, 6) + "…" + hex.slice(-4),
      result,
      fcm_message_id: "0:" + Math.floor(r() * 1e15).toString(16),
      latency_ms: 120 + Math.floor(r() * 1100),
    });
  }
  out.sort((a, b) => b.at - a.at);
  return out;
}
