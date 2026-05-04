import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Field } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/Misc";
import { Icon } from "@/lib/icons";
import { commas, dateTime, relTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { usePushcare } from "@/context/PushcareDataContext";

export function ApiKeys() {
  const { apiKeys, apps, appName } = usePushcare();
  const [createOpen, setCreateOpen] = useState(false);
  const [revealKey, setRevealKey] = useState<string | null>(null);

  return (
    <>
      <PageHeader
        eyebrow="DEVELOPERS"
        title="API Keys"
        description="Programmatic access to push, analytics, and admin endpoints. Keys are written once — store them in a secret manager."
        actions={
          <>
            <Button variant="secondary" leading={<Icon.External size={14} />}>API reference</Button>
            <Button variant="primary" leading={<Icon.Plus size={14} />} onClick={() => setCreateOpen(true)}>Create key</Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <InfoTile
          icon={<Icon.Key size={16} />}
          tone="signal"
          title="Live"
          desc="Server-side keys for production traffic"
          count={apiKeys.filter((k) => k.key_preview.startsWith("sk_live") && k.is_active).length}
        />
        <InfoTile
          icon={<Icon.Code size={16} />}
          tone="info"
          title="Test"
          desc="Sandbox keys for staging environments"
          count={apiKeys.filter((k) => k.key_preview.startsWith("sk_test")).length}
        />
        <InfoTile
          icon={<Icon.Alert size={16} />}
          tone="warn"
          title="Expiring soon"
          desc="Within the next 30 days"
          count={apiKeys.filter((k) => k.expires_at && +new Date(k.expires_at) - Date.now() < 30 * 86400_000).length}
        />
      </div>

      {apiKeys.length === 0 ? (
        <EmptyState icon={<Icon.Key size={18} />} title="No API keys yet" description="Create your first key to start integrating." action={<Button variant="primary" leading={<Icon.Plus size={14} />} onClick={() => setCreateOpen(true)}>Create key</Button>} />
      ) : (
        <Card>
          <CardHeader title={`${apiKeys.length} keys`} description="Sorted by most recently used" />
          <CardBody padded={false}>
            <ul>
              {apiKeys.map((k) => {
                const isLive = k.key_preview.startsWith("sk_live");
                return (
                  <li key={k.id} className="grid grid-cols-1 gap-3 border-b border-line-1/70 px-5 py-4 last:border-b-0 hover:bg-ink-2/60 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-[14px] font-semibold text-bone">{k.name}</span>
                        <Badge tone={isLive ? "signal" : "info"} dot>{isLive ? "live" : "test"}</Badge>
                        {!k.is_active && <Badge tone="danger" dot>Revoked</Badge>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[12px] text-bone-mid">
                        <span className="truncate">{k.key_preview}</span>
                        <button
                          type="button"
                          onClick={() => setRevealKey(k.id)}
                          className="text-bone-low hover:text-signal"
                          aria-label="Reveal"
                        >
                          <Icon.Eye size={12} />
                        </button>
                        <button type="button" className="text-bone-low hover:text-signal" aria-label="Copy">
                          <Icon.Copy size={12} />
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-bone-low">
                        <span>{appName(k.app_id)}</span>
                        <span>·</span>
                        <span>Last used {k.last_used_at ? relTime(k.last_used_at) : "never"}</span>
                        <span>·</span>
                        <span>{commas(k.rate_limit_rpm)}/min</span>
                        {k.expires_at && (<><span>·</span><span>Expires {dateTime(k.expires_at)}</span></>)}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        {k.scopes.map((s) => (
                          <span key={s} className="rounded bg-ink-3/60 px-1.5 py-0.5 font-mono text-[10px] text-bone-mid">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" leading={<Icon.Edit size={12} />}>Edit</Button>
                      <Button variant="danger" size="sm" leading={<Icon.Trash size={12} />}>Revoke</Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create a new API key"
        description="Keys are written once. Copy and store securely; you won't be able to see this value again."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="primary" leading={<Icon.Plus size={14} />} onClick={() => setCreateOpen(false)}>Create key</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name" required hint="A short, recognizable label.">
            <Input placeholder="ci-bot · production" />
          </Field>
          <Field label="App" required>
            <Select options={apps.map((a) => ({ value: a.id, label: a.name }))} />
          </Field>
          <Field label="Scopes" required>
            <div className="space-y-2 rounded-lg border border-line-1 bg-ink-2/40 p-3">
              {[
                { v: "push:send",       d: "Send notifications to subscribers" },
                { v: "analytics:read",  d: "Read events, devices, and dashboards" },
                { v: "admin:apps",      d: "Manage app configuration and FCM credentials" },
              ].map((s) => (
                <label key={s.v} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-ink-3/40">
                  <input type="checkbox" defaultChecked={s.v === "push:send"} className="h-3.5 w-3.5 rounded border-line-2 bg-ink-2 text-signal focus:ring-signal/30" />
                  <span className="flex-1 font-mono text-[12px] text-bone">{s.v}</span>
                  <span className="text-[11px] text-bone-low">{s.d}</span>
                </label>
              ))}
            </div>
          </Field>
          <Field label="Rate limit (req/min)" required>
            <Select options={[600, 1200, 2400, 6000].map((v) => ({ value: String(v), label: commas(v) + " req/min" }))} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={!!revealKey}
        onClose={() => setRevealKey(null)}
        title="Reveal API key"
        size="md"
        footer={<Button variant="primary" onClick={() => setRevealKey(null)}>Done</Button>}
      >
        <div className="rounded-lg border border-warn/30 bg-warn/5 p-3 text-[12px] text-bone-mid">
          <div className="flex items-start gap-2">
            <Icon.Alert size={14} className="mt-0.5 shrink-0 text-warn" />
            <span>This is the full secret — it won't be shown again. Copy and store it in a secret manager.</span>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-md border border-line-1 bg-ink-2 p-3 font-mono text-[12px]">
          <span className="flex-1 truncate text-bone">sk_live_<EXAMPLE-SECRET></span>
          <Button variant="secondary" size="sm" leading={<Icon.Copy size={12} />}>Copy</Button>
        </div>
      </Modal>
    </>
  );
}

function InfoTile({ icon, tone, title, desc, count }: { icon: React.ReactNode; tone: "signal" | "info" | "warn"; title: string; desc: string; count: number }) {
  return (
    <div className="rounded-xl border border-line-1 bg-ink-1 p-5">
      <div className="flex items-center gap-3">
        <div className={cn(
          "grid h-10 w-10 place-items-center rounded-md",
          tone === "signal" && "bg-signal/15 text-signal",
          tone === "info" && "bg-info/15 text-info",
          tone === "warn" && "bg-warn/15 text-warn",
        )}>
          {icon}
        </div>
        <div>
          <div className="text-[13px] font-medium text-bone">{title}</div>
          <div className="text-[11px] text-bone-low">{desc}</div>
        </div>
        <div className="ml-auto font-display text-[28px] font-semibold text-bone num">{count}</div>
      </div>
    </div>
  );
}
