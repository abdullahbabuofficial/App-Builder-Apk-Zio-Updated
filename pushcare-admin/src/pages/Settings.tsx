import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { Tabs } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Avatar, EmptyState } from "@/components/ui/Misc";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { relTime } from "@/lib/format";
import { usePushcare } from "@/context/PushcareDataContext";
import {
  createWebhook,
  deleteWebhook,
  fetchWebhooks,
  testWebhook,
  updateWebhook,
  type Webhook,
  type WebhookDelivery,
  type WebhookEventType,
} from "@/lib/webhooks";

const WEBHOOK_EVENTS: WebhookEventType[] = [
  "push.sent",
  "push.delivered",
  "push.opened",
  "push.clicked",
  "push.failed",
  "device.registered",
  "device.unregistered",
];

// Fallback mock webhooks (used when dataSource === "mock" or REST endpoints are absent).
const MOCK_WEBHOOKS: Webhook[] = [
  {
    id: "1",
    app_id: null,
    url: "https://api.pushcare.io/webhooks/delivery",
    signing_secret_prefix: "whsec_demo1",
    event_types: ["push.sent", "push.delivered", "push.failed"],
    is_active: true,
    last_delivery_at: new Date(Date.now() - 120_000).toISOString(),
    last_status: 200,
    created_at: new Date(Date.now() - 86400_000 * 12).toISOString(),
    updated_at: new Date(Date.now() - 86400_000 * 4).toISOString(),
  },
  {
    id: "2",
    app_id: null,
    url: "https://hooks.slack.com/services/T04/B08/xyz",
    signing_secret_prefix: "whsec_demo2",
    event_types: ["push.failed"],
    is_active: true,
    last_delivery_at: new Date(Date.now() - 3600_000 * 4).toISOString(),
    last_status: 200,
    created_at: new Date(Date.now() - 86400_000 * 6).toISOString(),
    updated_at: new Date(Date.now() - 86400_000 * 1).toISOString(),
  },
  {
    id: "3",
    app_id: null,
    url: "https://staging.internal/hook",
    signing_secret_prefix: "whsec_demo3",
    event_types: ["device.registered"],
    is_active: false,
    last_delivery_at: null,
    last_status: null,
    created_at: new Date(Date.now() - 86400_000 * 30).toISOString(),
    updated_at: new Date(Date.now() - 86400_000 * 30).toISOString(),
  },
];

export function Settings() {
  const [tab, setTab] = useState("account");
  const [webhookOpen, setWebhookOpen] = useState(false);

  // Account form
  const [name, setName] = useState("Abdullah Babu");
  const [email, setEmail] = useState("abdullah@pushcare.io");

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your account, team, billing, notifications, and webhook integrations."
      />

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "account", label: "Account" },
          { value: "team", label: "Team" },
          { value: "billing", label: "Billing" },
          { value: "notifications", label: "Notifications" },
          { value: "webhooks", label: "Webhooks" },
        ]}
        className="mb-6"
      />

      {tab === "account" && (
        <AccountTab
          name={name}
          email={email}
          onName={setName}
          onEmail={setEmail}
        />
      )}
      {tab === "team" && <TeamTab />}
      {tab === "billing" && <BillingTab />}
      {tab === "notifications" && <NotificationsTab />}
      {tab === "webhooks" && (
        <WebhooksTab
          createOpen={webhookOpen}
          onOpenCreate={() => setWebhookOpen(true)}
          onCloseCreate={() => setWebhookOpen(false)}
        />
      )}
    </>
  );
}

// =============================================================================
// Account
// =============================================================================
// NOTE: real persistence is wired in `pages/Account.tsx` (Lane 5). This Settings
// tab is a thin alias and posts to PATCH /api/auth/me when implemented; until
// then the Save button is local-only.
function AccountTab({
  name,
  email,
  onName,
  onEmail,
}: {
  name: string;
  email: string;
  onName: (v: string) => void;
  onEmail: (v: string) => void;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Profile" description="Your personal details and account avatar." />
        <CardBody className="space-y-5">
          <div className="flex items-center gap-5">
            <Avatar glyph="A" size={64} className="text-xl" />
            <div>
              <Button variant="secondary" size="sm">
                Change avatar
              </Button>
              <p className="mt-1 text-[11px] text-bone-low">JPG, PNG, or SVG. Max 2 MB.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Full name" required>
              <Input value={name} onChange={(e) => onName(e.target.value)} />
            </Field>
            <Field label="Email" required>
              <Input value={email} onChange={(e) => onEmail(e.target.value)} type="email" />
            </Field>
          </div>
        </CardBody>
        <CardFooter>
          <span />
          <Button variant="primary">Save changes</Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader
          title="Password"
          description="Change your password. We'll sign out all other sessions."
        />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Current password" required>
              <Input type="password" placeholder="••••••••" />
            </Field>
            <div />
            <Field label="New password" required>
              <Input type="password" placeholder="At least 12 characters" />
            </Field>
            <Field label="Confirm new password" required>
              <Input type="password" placeholder="Re-enter new password" />
            </Field>
          </div>
        </CardBody>
        <CardFooter>
          <span />
          <Button variant="secondary">Update password</Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader title="Danger zone" />
        <CardBody>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-danger/30 bg-danger/5 p-4">
            <div>
              <div className="text-[13px] font-medium text-bone">Delete account</div>
              <div className="text-[12px] text-bone-mid">
                Permanently remove your account and all associated data. This action cannot be
                undone.
              </div>
            </div>
            <Button variant="danger">Delete account</Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// =============================================================================
// Team — link out to /account/team (the dedicated page handles the rich UI).
// =============================================================================
function TeamTab() {
  return (
    <Card>
      <CardHeader title="Team" description="Members, invites, and roles." />
      <CardBody>
        <div className="flex items-center gap-3 rounded-lg border border-line-1 bg-ink-2/40 p-4">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-signal/15 text-signal">
            <Icon.Users size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-bone">
              Team management has moved
            </div>
            <div className="text-[12px] text-bone-mid">
              View members, invites, and roles on the dedicated team page.
            </div>
          </div>
          <Link to="/account/team">
            <Button variant="primary" trailing={<Icon.ArrowRight size={12} />}>
              Open team
            </Button>
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}

// =============================================================================
// Billing — link out to /account/billing (the dedicated page handles the rich UI).
// =============================================================================
function BillingTab() {
  return (
    <Card>
      <CardHeader title="Billing" description="Plans, usage, and invoices." />
      <CardBody>
        <div className="flex items-center gap-3 rounded-lg border border-line-1 bg-ink-2/40 p-4">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-signal/15 text-signal">
            <Icon.Zap size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-bone">
              Billing has moved
            </div>
            <div className="text-[12px] text-bone-mid">
              See your plan, usage, and invoices on the dedicated billing page.
            </div>
          </div>
          <Link to="/account/billing">
            <Button variant="primary" trailing={<Icon.ArrowRight size={12} />}>
              Open billing
            </Button>
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}

// =============================================================================
// Notifications
// =============================================================================
// TODO: wire to /api/notification_preferences once the endpoint exists. For
// now the toggles are local-state only.
function NotificationsTab() {
  const initial = [
    {
      key: "campaign_sent",
      label: "Campaign sent",
      desc: "Email when a campaign finishes dispatching.",
      on: true,
    },
    {
      key: "campaign_failed",
      label: "Campaign failed",
      desc: "Email + in-app alert for any campaign that fails.",
      on: true,
    },
    {
      key: "weekly_digest",
      label: "Weekly digest",
      desc: "Summary of installs, pushes, and engagement every Monday.",
      on: true,
    },
    {
      key: "billing_alerts",
      label: "Billing alerts",
      desc: "Approaching plan limits or failed payments.",
      on: true,
    },
    {
      key: "device_surges",
      label: "New device surges",
      desc: "Spike in installs above 2× rolling average.",
      on: false,
    },
    {
      key: "marketing",
      label: "Marketing updates",
      desc: "Occasional product announcements from PushCare.",
      on: false,
    },
  ];
  const [prefs, setPrefs] = useState(initial);
  return (
    <Card>
      <CardHeader
        title="Notification preferences"
        description="Control which emails and alerts you receive."
      />
      <CardBody className="space-y-5">
        {prefs.map((n, i) => (
          <div
            key={n.key}
            className="flex items-center justify-between gap-4 rounded-lg border border-line-1 bg-ink-2/40 p-4"
          >
            <div>
              <div className="text-[13px] font-medium text-bone">{n.label}</div>
              <div className="text-[12px] text-bone-mid">{n.desc}</div>
            </div>
            <Switch
              checked={n.on}
              onChange={(v) =>
                setPrefs((prev) => prev.map((p, j) => (j === i ? { ...p, on: v } : p)))
              }
            />
          </div>
        ))}
      </CardBody>
      <CardFooter>
        <span />
        <Button variant="primary">Save preferences</Button>
      </CardFooter>
    </Card>
  );
}

// =============================================================================
// Webhooks
// =============================================================================
function WebhooksTab({
  createOpen,
  onOpenCreate,
  onCloseCreate,
}: {
  createOpen: boolean;
  onOpenCreate: () => void;
  onCloseCreate: () => void;
}) {
  const { dataSource } = usePushcare();
  const live = dataSource !== "mock";

  const [items, setItems] = useState<Webhook[]>(live ? [] : MOCK_WEBHOOKS);
  const [loading, setLoading] = useState(live);
  const [error, setError] = useState<string | null>(null);

  // Inline test-delivery cache, keyed by webhook id.
  const [lastDelivery, setLastDelivery] = useState<Record<string, WebhookDelivery>>({});

  // Create-form state
  const [newUrl, setNewUrl] = useState("");
  const [newEvents, setNewEvents] = useState<Set<WebhookEventType>>(
    new Set<WebhookEventType>(["push.sent", "push.delivered", "push.failed"]),
  );
  const [creating, setCreating] = useState(false);

  // Reveal-secret modal
  const [revealSecret, setRevealSecret] = useState<{ url: string; secret: string } | null>(null);

  const reload = useCallback(async () => {
    if (!live) {
      setItems(MOCK_WEBHOOKS);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await fetchWebhooks();
      setItems(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load webhooks");
    } finally {
      setLoading(false);
    }
  }, [live]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleCreate = useCallback(async () => {
    if (!newUrl.trim() || newEvents.size === 0) return;
    setCreating(true);
    setError(null);
    try {
      if (live) {
        const created = await createWebhook({
          url: newUrl.trim(),
          event_types: Array.from(newEvents),
          is_active: true,
        });
        setItems((prev) => [created, ...prev]);
        if (created.whsec_full) {
          setRevealSecret({ url: created.url, secret: created.whsec_full });
        }
      } else {
        // mock-mode: synthesize a row + show a fake reveal for UX parity
        const fake: Webhook = {
          id: crypto.randomUUID(),
          app_id: null,
          url: newUrl.trim(),
          signing_secret_prefix: `whsec_${Math.random().toString(36).slice(2, 8)}`,
          event_types: Array.from(newEvents),
          is_active: true,
          last_delivery_at: null,
          last_status: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setItems((prev) => [fake, ...prev]);
        setRevealSecret({
          url: fake.url,
          secret: `${fake.signing_secret_prefix}_${Math.random().toString(36).slice(2)}_demo`,
        });
      }
      setNewUrl("");
      setNewEvents(new Set<WebhookEventType>(["push.sent", "push.delivered", "push.failed"]));
      onCloseCreate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }, [newUrl, newEvents, live, onCloseCreate]);

  const handleToggle = useCallback(
    async (wh: Webhook, next: boolean) => {
      // optimistic
      setItems((prev) => prev.map((w) => (w.id === wh.id ? { ...w, is_active: next } : w)));
      if (!live) return;
      try {
        await updateWebhook(wh.id, { is_active: next });
      } catch (e) {
        setItems((prev) => prev.map((w) => (w.id === wh.id ? wh : w)));
        setError(e instanceof Error ? e.message : "Toggle failed");
      }
    },
    [live],
  );

  const handleDelete = useCallback(
    async (wh: Webhook) => {
      if (!confirm(`Delete webhook for ${wh.url}?`)) return;
      const before = items;
      setItems((prev) => prev.filter((w) => w.id !== wh.id));
      if (!live) return;
      try {
        await deleteWebhook(wh.id);
      } catch (e) {
        setItems(before);
        setError(e instanceof Error ? e.message : "Delete failed");
      }
    },
    [items, live],
  );

  const handleTest = useCallback(
    async (wh: Webhook) => {
      if (!live) return;
      try {
        const delivery = await testWebhook(wh.id);
        setLastDelivery((prev) => ({ ...prev, [wh.id]: delivery }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Test failed");
      }
    },
    [live],
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Webhook endpoints"
          description="HTTP callbacks for real-time delivery events."
          trailing={
            <Button
              variant="primary"
              leading={<Icon.Plus size={14} />}
              onClick={onOpenCreate}
            >
              Add endpoint
            </Button>
          }
        />
        <CardBody padded={false}>
          {error && (
            <div className="border-b border-line-1 bg-danger/5 px-5 py-2.5 text-[12px] text-danger">
              {error}
            </div>
          )}
          {loading ? (
            <div className="p-8 text-center text-[13px] text-bone-mid">Loading webhooks…</div>
          ) : items.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<Icon.Globe size={18} />}
                title="No webhook endpoints"
                description="Add an endpoint to receive POST callbacks for delivery events."
                action={
                  <Button
                    variant="primary"
                    leading={<Icon.Plus size={14} />}
                    onClick={onOpenCreate}
                  >
                    Add endpoint
                  </Button>
                }
              />
            </div>
          ) : (
            <ul>
              {items.map((wh) => {
                const delivery = lastDelivery[wh.id];
                return (
                  <li
                    key={wh.id}
                    className="border-b border-line-1/70 px-5 py-4 last:border-b-0"
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={cn(
                          "mt-1 grid h-8 w-8 place-items-center rounded-md border",
                          wh.is_active
                            ? "border-ok/30 bg-ok/10 text-ok"
                            : "border-line-1 bg-ink-2 text-bone-low",
                        )}
                      >
                        <Icon.Globe size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-mono text-[12px] text-bone">{wh.url}</div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {wh.event_types.map((e) => (
                            <Badge key={e} tone="neutral">
                              {e}
                            </Badge>
                          ))}
                        </div>
                        <div className="mt-2 text-[11px] text-bone-low">
                          {wh.last_delivery_at
                            ? `Last delivery ${relTime(wh.last_delivery_at)}${
                                wh.last_status ? ` · ${wh.last_status}` : ""
                              }`
                            : "No deliveries yet"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={wh.is_active}
                          onChange={(v) => handleToggle(wh, v)}
                          size="sm"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          leading={<Icon.Send size={12} />}
                          onClick={() => handleTest(wh)}
                          disabled={!live}
                        >
                          Test
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete"
                          onClick={() => handleDelete(wh)}
                        >
                          <Icon.Trash size={14} />
                        </Button>
                      </div>
                    </div>
                    {delivery && (
                      <div className="mt-3 rounded-md border border-line-1 bg-ink-2/40 p-3">
                        <div className="flex items-center gap-2">
                          <Badge
                            tone={delivery.succeeded ? "ok" : "danger"}
                            dot
                          >
                            {delivery.response_status ?? "—"} ·{" "}
                            {delivery.succeeded ? "delivered" : "failed"}
                          </Badge>
                          <span className="font-mono text-[11px] text-bone-low">
                            {delivery.event_type}
                          </span>
                          <span className="font-mono text-[11px] text-bone-low">
                            attempt {delivery.attempt_count}
                          </span>
                        </div>
                        {delivery.response_body && (
                          <pre className="mt-2 overflow-x-auto font-mono text-[11px] text-bone-mid">
                            {String(delivery.response_body).slice(0, 400)}
                          </pre>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Signing secret"
          description="Verify webhook payloads using HMAC-SHA256."
        />
        <CardBody>
          <div className="flex items-center gap-3 rounded-lg border border-line-1 bg-ink-2/40 p-4">
            <div className="flex-1 font-mono text-[12px] tracking-wide text-bone">
              {items[0]?.signing_secret_prefix
                ? `${items[0].signing_secret_prefix}…`
                : "whsec_•••••••••••••••••••••••••"}
            </div>
            <Badge tone="neutral">
              {items.length} endpoint{items.length === 1 ? "" : "s"}
            </Badge>
          </div>
          <p className="mt-3 text-[12px] text-bone-mid">
            The full signing secret is shown once when you add an endpoint. Keep it in a secret
            manager — we don't store it server-side after creation.
          </p>
        </CardBody>
      </Card>

      <Modal
        open={createOpen}
        onClose={() => {
          if (creating) return;
          onCloseCreate();
        }}
        title="Add webhook endpoint"
        description="PushCare will POST JSON to this URL when selected events fire."
        footer={
          <>
            <Button variant="ghost" onClick={onCloseCreate} disabled={creating}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreate}
              disabled={creating || !newUrl.trim() || newEvents.size === 0}
            >
              {creating ? "Creating…" : "Create endpoint"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Endpoint URL" required>
            <Input
              type="url"
              placeholder="https://yourserver.com/webhooks/pushcare"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
            />
          </Field>
          <Field label="Events to subscribe" hint="Select which event types trigger this webhook.">
            <div className="flex flex-wrap gap-1.5">
              {WEBHOOK_EVENTS.map((e) => {
                const checked = newEvents.has(e);
                return (
                  <label
                    key={e}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-line-1 bg-ink-2 px-2 py-1 font-mono text-[11px] text-bone-mid hover:border-line-2"
                  >
                    <input
                      type="checkbox"
                      className="h-3 w-3 rounded border-line-2 bg-ink-2 text-signal focus:ring-signal/30"
                      checked={checked}
                      onChange={() =>
                        setNewEvents((prev) => {
                          const next = new Set(prev);
                          if (next.has(e)) next.delete(e);
                          else next.add(e);
                          return next;
                        })
                      }
                    />
                    {e}
                  </label>
                );
              })}
            </div>
          </Field>
        </div>
      </Modal>

      <Modal
        open={!!revealSecret}
        onClose={() => setRevealSecret(null)}
        title="Save your signing secret"
        size="md"
        footer={
          <Button variant="primary" onClick={() => setRevealSecret(null)}>
            Done
          </Button>
        }
      >
        <div className="rounded-lg border border-warn/30 bg-warn/5 p-3 text-[12px] text-bone-mid">
          <div className="flex items-start gap-2">
            <Icon.Alert size={14} className="mt-0.5 shrink-0 text-warn" />
            <span>
              This is the only time the full secret is shown. Copy it and store it in a secret
              manager — re-creating it requires re-adding the endpoint.
            </span>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <div className="font-mono text-[11px] text-bone-low">{revealSecret?.url}</div>
          <div className="flex items-center gap-2 rounded-md border border-line-1 bg-ink-2 p-3 font-mono text-[12px]">
            <span className="flex-1 break-all text-bone">{revealSecret?.secret}</span>
            <Button
              variant="secondary"
              size="sm"
              leading={<Icon.Copy size={12} />}
              onClick={() => {
                if (revealSecret) void navigator.clipboard?.writeText(revealSecret.secret);
              }}
            >
              Copy
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

