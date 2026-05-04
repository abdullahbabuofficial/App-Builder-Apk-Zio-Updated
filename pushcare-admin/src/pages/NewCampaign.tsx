import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Tabs } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { AndroidPreview } from "@/components/push/AndroidPreview";
import { Icon } from "@/lib/icons";
import { compact, commas, dateTime } from "@/lib/format";
import { COUNTRIES, COUNTRY_NAMES } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { usePushcare } from "@/context/PushcareDataContext";

const STEPS = [
  { key: "audience", label: "Audience", icon: "Target" as const },
  { key: "content",  label: "Content",  icon: "Edit" as const },
  { key: "schedule", label: "Schedule", icon: "Calendar" as const },
  { key: "review",   label: "Review",   icon: "Check" as const },
];

type TargetType = "all" | "active" | "country" | "device_list";

export function NewCampaign() {
  const nav = useNavigate();
  const { apps, createCampaign } = usePushcare();
  const [step, setStep] = useState(0);

  // form state
  const [appId, setAppId] = useState("");
  useEffect(() => {
    if (!appId && apps[0]) setAppId(apps[0].id);
  }, [apps, appId]);
  const [target, setTarget] = useState<TargetType>("active");
  const [activeMin, setActiveMin] = useState(60 * 24);
  const [countries, setCountries] = useState<string[]>(["BD", "IN", "PK"]);
  const [title, setTitle] = useState("Flash sale ends in 2 hours");
  const [body, setBody] = useState("Tap now to grab the discount before midnight. Use code FLASH30.");
  const [withImage, setWithImage] = useState(false);
  const [clickUrl, setClickUrl] = useState("myapp://promo/flash");
  const [when, setWhen] = useState<"now" | "schedule">("now");
  const [scheduleAt, setScheduleAt] = useState<string>(() => new Date(Date.now() + 3600_000).toISOString().slice(0, 16));
  const [tz, setTz] = useState("Asia/Dhaka");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const app = useMemo(() => apps.find((a) => a.id === appId), [apps, appId]);

  // estimated reach
  const estimatedReach = useMemo(() => {
    if (!app) return 0;
    if (target === "all") return Math.floor(app.active_devices_24h * 1.4);
    if (target === "active") return Math.floor(app.active_devices_24h * (activeMin <= 60 ? 0.45 : activeMin <= 60 * 6 ? 0.7 : 1.0));
    if (target === "country") return Math.floor(app.active_devices_24h * Math.min(1, countries.length * 0.18));
    return 250;
  }, [target, activeMin, countries.length, app]);

  function next() { setStep((s) => Math.min(STEPS.length - 1, s + 1)); }
  function prev() { setStep((s) => Math.max(0, s - 1)); }

  if (!app) {
    return (
      <>
        <PageHeader
          crumbs={[{ label: "Campaigns", to: "/campaigns" }, { label: "New" }]}
          title="Create campaign"
          description="Loading apps…"
          actions={
            <Button variant="ghost" leading={<Icon.X size={14} />} onClick={() => nav("/campaigns")}>Cancel</Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Campaigns", to: "/campaigns" }, { label: "New" }]}
        title="Create campaign"
        description="Compose a push notification, target an audience, and schedule the send."
        actions={
          <Button variant="ghost" leading={<Icon.X size={14} />} onClick={() => nav("/campaigns")}>Cancel</Button>
        }
      />

      {/* Stepper */}
      <Card className="mb-6">
        <div className="grid grid-cols-4 divide-x divide-line-1">
          {STEPS.map((s, i) => {
            const Ic = Icon[s.icon];
            const status: "done" | "active" | "todo" = i < step ? "done" : i === step ? "active" : "todo";
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => i <= step && setStep(i)}
                disabled={i > step}
                className={cn(
                  "flex items-center gap-3 px-4 py-3.5 text-left transition-colors",
                  i <= step ? "hover:bg-ink-2/60" : "cursor-not-allowed opacity-60"
                )}
              >
                <span
                  className={cn(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-full border font-mono text-[12px] font-medium tabular-nums",
                    status === "done" && "border-signal/40 bg-signal/15 text-signal",
                    status === "active" && "border-signal bg-signal text-ink-0",
                    status === "todo" && "border-line-2 bg-ink-2 text-bone-low"
                  )}
                >
                  {status === "done" ? <Icon.Check size={14} /> : i + 1}
                </span>
                <div className="min-w-0">
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-low">Step {i + 1}</div>
                  <div className={cn("text-[13px] font-medium", status === "active" ? "text-bone" : "text-bone-mid")}>{s.label}</div>
                </div>
                <Ic size={14} className={cn("ml-auto shrink-0", status === "active" ? "text-signal" : "text-bone-low")} />
              </button>
            );
          })}
        </div>
      </Card>

      {/* Body: form left, preview right */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {step === 0 && (
            <Card>
              <CardHeader title="Audience" description="Choose which subscribers receive this push." />
              <CardBody>
                <Field label="App" required>
                  <Select
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    options={apps.map((a) => ({ value: a.id, label: `${a.name} · ${a.package_name}` }))}
                  />
                </Field>

                <div className="mt-6">
                  <div className="mb-2 text-[12px] font-medium text-bone">Target</div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <TargetCard
                      selected={target === "all"}
                      onClick={() => setTarget("all")}
                      icon={<Icon.Globe size={16} />}
                      title="All subscribers"
                      desc="Every valid token for this app."
                      meta={`${compact(app.active_devices_24h * 1.4)} reach`}
                    />
                    <TargetCard
                      selected={target === "active"}
                      onClick={() => setTarget("active")}
                      icon={<Icon.Zap size={16} />}
                      title="Active recently"
                      desc="Only devices seen in the last N minutes."
                      meta="Recommended"
                    />
                    <TargetCard
                      selected={target === "country"}
                      onClick={() => setTarget("country")}
                      icon={<Icon.Target size={16} />}
                      title="By country"
                      desc="Geo-target by ISO country code."
                      meta={`${countries.length} selected`}
                    />
                    <TargetCard
                      selected={target === "device_list"}
                      onClick={() => setTarget("device_list")}
                      icon={<Icon.Phone size={16} />}
                      title="Device list"
                      desc="Paste a list of install hashes."
                      meta="CSV / list"
                    />
                  </div>
                </div>

                {target === "active" && (
                  <div className="mt-6 rounded-lg border border-line-1 bg-ink-2/40 p-4">
                    <div className="mb-2 text-[12px] font-medium text-bone">Active within</div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { l: "15 min", v: 15 },
                        { l: "1 hour", v: 60 },
                        { l: "6 hours", v: 360 },
                        { l: "24 hours", v: 1440 },
                        { l: "7 days", v: 10080 },
                      ].map((x) => (
                        <button
                          key={x.v}
                          type="button"
                          onClick={() => setActiveMin(x.v)}
                          className={cn(
                            "rounded-md border px-2.5 py-1 text-[12px] transition-colors",
                            activeMin === x.v
                              ? "border-signal/50 bg-signal/10 text-signal"
                              : "border-line-1 bg-ink-2 text-bone-mid hover:border-line-2 hover:text-bone"
                          )}
                        >
                          {x.l}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {target === "country" && (
                  <div className="mt-6 rounded-lg border border-line-1 bg-ink-2/40 p-4">
                    <div className="mb-2 text-[12px] font-medium text-bone">Countries</div>
                    <div className="flex flex-wrap gap-1.5">
                      {COUNTRIES.map((c) => {
                        const selected = countries.includes(c);
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setCountries((cs) => selected ? cs.filter((x) => x !== c) : [...cs, c])}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] uppercase tracking-wide transition-colors",
                              selected
                                ? "border-signal/50 bg-signal/10 text-signal"
                                : "border-line-1 bg-ink-2 text-bone-mid hover:border-line-2"
                            )}
                          >
                            {selected && <Icon.Check size={10} />}
                            {c} <span className="text-bone-low">{COUNTRY_NAMES[c]}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mt-6 flex items-center gap-3 rounded-lg border border-signal/20 bg-signal/5 p-4">
                  <div className="grid h-9 w-9 place-items-center rounded-md bg-signal/15 text-signal"><Icon.Target size={16} /></div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-bone">Estimated reach</div>
                    <div className="font-mono text-[11px] text-bone-mid">Based on current audience definition</div>
                  </div>
                  <div className="ml-auto font-display text-[26px] font-semibold text-bone num">{compact(estimatedReach)}</div>
                </div>
              </CardBody>
            </Card>
          )}

          {step === 1 && (
            <Card>
              <CardHeader title="Content" description="What appears on the lockscreen and notification shade." />
              <CardBody className="space-y-5">
                <Field label="Title" required hint="Up to 65 characters render reliably across devices.">
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
                </Field>
                <Field label="Body" required hint="Plain text. Emojis and basic ASCII supported.">
                  <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={300} />
                </Field>
                <Field label="Click destination" optional hint="Deep link or HTTPS URL opened on tap.">
                  <Input value={clickUrl} onChange={(e) => setClickUrl(e.target.value)} placeholder="myapp://path  or  https://…" leading={<Icon.External size={13} />} />
                </Field>
                <div className="flex items-center justify-between rounded-lg border border-line-1 bg-ink-2/40 p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-md border border-line-1 bg-ink-2 text-bone-mid"><Icon.Image size={16} /></div>
                    <div>
                      <div className="text-[13px] font-medium text-bone">Add a hero image</div>
                      <div className="text-[11px] text-bone-low">Big-picture style. Adds ~2x weight on slow networks.</div>
                    </div>
                  </div>
                  <Switch checked={withImage} onChange={setWithImage} />
                </div>
              </CardBody>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <CardHeader title="Schedule" description="Send right away or queue for a later moment." />
              <CardBody>
                <Tabs
                  variant="segmented"
                  value={when}
                  onChange={(v) => setWhen(v as "now" | "schedule")}
                  tabs={[
                    { value: "now", label: "Send now" },
                    { value: "schedule", label: "Schedule" },
                  ]}
                />

                {when === "now" ? (
                  <div className="mt-5 flex items-start gap-3 rounded-lg border border-signal/20 bg-signal/5 p-4">
                    <div className="grid h-9 w-9 place-items-center rounded-md bg-signal/15 text-signal"><Icon.Zap size={16} /></div>
                    <div>
                      <div className="text-[13px] font-medium text-bone">Send immediately on confirm</div>
                      <div className="mt-0.5 text-[12px] text-bone-mid">Median dispatch latency: <span className="num text-bone">245ms</span>.</div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Send at" required>
                      <Input
                        type="datetime-local"
                        value={scheduleAt}
                        onChange={(e) => setScheduleAt(e.target.value)}
                        leading={<Icon.Calendar size={13} />}
                      />
                    </Field>
                    <Field label="Time zone">
                      <Select
                        value={tz}
                        onChange={(e) => setTz(e.target.value)}
                        options={[
                          { value: "Asia/Dhaka", label: "Asia/Dhaka (BST)" },
                          { value: "Asia/Kolkata", label: "Asia/Kolkata (IST)" },
                          { value: "UTC", label: "UTC" },
                          { value: "America/New_York", label: "America/New_York (ET)" },
                          { value: "Europe/Berlin", label: "Europe/Berlin (CET)" },
                        ]}
                      />
                    </Field>
                  </div>
                )}

                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-line-1 bg-ink-2/40 p-4">
                    <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-low">Quiet hours</div>
                    <div className="mt-1 text-[13px] text-bone">Suppress 22:00 — 07:00 in recipient's local time</div>
                    <div className="mt-3"><Switch checked={true} onChange={() => {}} /></div>
                  </div>
                  <div className="rounded-lg border border-line-1 bg-ink-2/40 p-4">
                    <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-low">Throttle</div>
                    <div className="mt-1 text-[13px] text-bone">Cap at 50,000 deliveries / second</div>
                    <div className="mt-3"><Switch checked={false} onChange={() => {}} /></div>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {step === 3 && (
            <Card>
              <CardHeader title="Review & send" description="Last check before this goes to live devices." />
              <CardBody className="space-y-5">
                <SummaryRow label="App" value={app.name} hint={app.package_name} />
                <SummaryRow label="Audience" value={
                  target === "all" ? "All subscribers" :
                  target === "active" ? `Active in last ${activeMin >= 1440 ? `${activeMin / 1440}d` : `${activeMin}m`}` :
                  target === "country" ? `${countries.length} countries: ${countries.join(", ")}` :
                  "Custom device list"
                } hint={`Estimated reach · ${compact(estimatedReach)}`} />
                <SummaryRow label="Title" value={title} />
                <SummaryRow label="Body" value={body} />
                {clickUrl && <SummaryRow label="Click URL" value={clickUrl} mono />}
                <SummaryRow label="Schedule" value={when === "now" ? "Send immediately" : `${dateTime(new Date(scheduleAt))} (${tz})`} />
                <div className="rounded-lg border border-warn/30 bg-warn/5 p-4">
                  <div className="flex items-start gap-3">
                    <Icon.Alert size={16} className="mt-0.5 text-warn" />
                    <div className="text-[12px] text-bone-mid">
                      Once sent, this push <span className="text-bone">cannot be recalled</span>. Quiet-hours suppression and per-device throttling apply automatically.
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Nav */}
          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" disabled={step === 0} onClick={prev} leading={<Icon.ArrowLeft size={14} />}>
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button variant="primary" onClick={next} trailing={<Icon.ArrowRight size={14} />}>
                Continue
              </Button>
            ) : (
              <Button variant="primary" onClick={() => setConfirmOpen(true)} trailing={<Icon.Send size={14} />}>
                {when === "now" ? "Send now" : "Schedule"}
              </Button>
            )}
          </div>
        </div>

        {/* Live preview */}
        <aside className="xl:sticky xl:top-20 xl:h-fit">
          <Card>
            <CardHeader title="Live preview" description="How it will appear to a recipient." />
            <CardBody>
              <div className="mb-4 flex items-center gap-2">
                <Badge tone="signal" dot>Lockscreen</Badge>
                <Badge tone="neutral">Banner</Badge>
              </div>
              <AndroidPreview
                appName={app.name}
                appGlyph={app.icon_glyph}
                iconColor={app.icon_color}
                title={title || "Your push title"}
                body={body || "Your push body copy will appear here, wrapped to roughly three lines on the lockscreen."}
                imageUrl={withImage ? "/img/promo.jpg" : null}
                variant="lockscreen"
              />
              <div className="mt-4 rounded-lg border border-line-1 bg-ink-2/40 p-3 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-low">
                Reach · <span className="text-bone num normal-case">{commas(estimatedReach)}</span>
                <span className="mx-2">·</span>
                Latency · <span className="text-bone normal-case">~245ms p99</span>
              </div>
            </CardBody>
          </Card>
        </aside>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={when === "now" ? "Send this push now?" : "Schedule this push?"}
        description={when === "now"
          ? `It will reach roughly ${compact(estimatedReach)} devices in the next minute.`
          : `It will dispatch at ${dateTime(new Date(scheduleAt))} (${tz}).`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              leading={<Icon.Send size={14} />}
              onClick={() => {
                void (async () => {
                  await createCampaign({
                    app_id: appId,
                    title,
                    body,
                    image_url: withImage ? "/img/promo.jpg" : null,
                    click_url: clickUrl || null,
                    target_type: target,
                    active_within_minutes: activeMin,
                    country_codes: countries,
                    scheduled_at:
                      when === "schedule" ? new Date(scheduleAt).toISOString() : null,
                    recipients_hint: estimatedReach,
                  });
                  setConfirmOpen(false);
                  nav("/campaigns");
                })();
              }}
            >
              {when === "now" ? "Send" : "Schedule"}
            </Button>
          </>
        }
      >
        <div className="rounded-lg border border-line-1 bg-ink-2/60 p-4">
          <div className="text-[12px] font-medium text-bone">{title}</div>
          <div className="mt-1 text-[12px] text-bone-mid">{body}</div>
        </div>
      </Modal>
    </>
  );
}

function TargetCard({
  selected, onClick, icon, title, desc, meta,
}: {
  selected: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string; meta?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex items-start gap-3 rounded-lg border bg-ink-2/40 p-4 text-left transition-colors",
        selected ? "border-signal/40 bg-signal/5 ring-1 ring-signal/30" : "border-line-1 hover:border-line-2"
      )}
    >
      <div className={cn("grid h-9 w-9 place-items-center rounded-md border", selected ? "border-signal/40 bg-signal/15 text-signal" : "border-line-1 bg-ink-2 text-bone-mid")}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[13px] font-medium text-bone">{title}</div>
          {selected && <Icon.Check size={14} className="text-signal" />}
        </div>
        <div className="mt-0.5 text-[12px] text-bone-mid">{desc}</div>
        {meta && <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-low">{meta}</div>}
      </div>
    </button>
  );
}

function SummaryRow({ label, value, hint, mono }: { label: string; value: string; hint?: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-line-1 pb-4 last:border-b-0 last:pb-0 sm:grid-cols-[160px_1fr]">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-low">{label}</div>
      <div>
        <div className={cn("text-[13px] text-bone", mono && "font-mono")}>{value}</div>
        {hint && <div className="mt-0.5 text-[11px] text-bone-low">{hint}</div>}
      </div>
    </div>
  );
}
