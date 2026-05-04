import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Tabs } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { Table, type Column } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Avatar, EmptyState } from "@/components/ui/Misc";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { commas, relTime, dateTime, bytes } from "@/lib/format";

type Member = { id: string; name: string; email: string; role: string; lastActive: string; glyph: string };

const MEMBERS: Member[] = [
  { id: "1", name: "Abdullah Babu", email: "abdullah@pushcare.io", role: "owner", lastActive: new Date(Date.now() - 300_000).toISOString(), glyph: "A" },
  { id: "2", name: "Laila Shahrin", email: "laila@pushcare.io", role: "admin", lastActive: new Date(Date.now() - 3600_000 * 2).toISOString(), glyph: "L" },
  { id: "3", name: "Rehan Kabir", email: "rehan@pushcare.io", role: "developer", lastActive: new Date(Date.now() - 3600_000 * 18).toISOString(), glyph: "R" },
  { id: "4", name: "CI Bot", email: "ci@pushcare.io", role: "service", lastActive: new Date(Date.now() - 60_000 * 8).toISOString(), glyph: "🤖" },
];

const INVOICES = [
  { id: "INV-202504", amount: 249, status: "paid", date: "2025-04-01" },
  { id: "INV-202503", amount: 249, status: "paid", date: "2025-03-01" },
  { id: "INV-202502", amount: 199, status: "paid", date: "2025-02-01" },
  { id: "INV-202501", amount: 199, status: "paid", date: "2025-01-01" },
];

const WEBHOOKS = [
  { id: "1", url: "https://api.pushcare.io/webhooks/delivery", events: ["push.sent", "push.delivered", "push.failed"], active: true, lastDelivery: new Date(Date.now() - 120_000).toISOString() },
  { id: "2", url: "https://hooks.slack.com/services/T04/B08/xyz", events: ["push.failed"], active: true, lastDelivery: new Date(Date.now() - 3600_000 * 4).toISOString() },
  { id: "3", url: "https://staging.internal/hook", events: ["device.registered"], active: false, lastDelivery: null },
];

export function Settings() {
  const [tab, setTab] = useState("account");
  const [inviteOpen, setInviteOpen] = useState(false);
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

      {/* === ACCOUNT === */}
      {tab === "account" && (
        <div className="space-y-6">
          <Card>
            <CardHeader title="Profile" description="Your personal details and account avatar." />
            <CardBody className="space-y-5">
              <div className="flex items-center gap-5">
                <Avatar glyph="A" size={64} className="text-xl" />
                <div>
                  <Button variant="secondary" size="sm">Change avatar</Button>
                  <p className="mt-1 text-[11px] text-bone-low">JPG, PNG, or SVG. Max 2 MB.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Full name" required>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <Field label="Email" required>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
                </Field>
              </div>
            </CardBody>
            <CardFooter>
              <span />
              <Button variant="primary">Save changes</Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader title="Password" description="Change your password. We'll sign out all other sessions." />
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
                  <div className="text-[12px] text-bone-mid">Permanently remove your account and all associated data. This action cannot be undone.</div>
                </div>
                <Button variant="danger">Delete account</Button>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* === TEAM === */}
      {tab === "team" && (
        <Card>
          <CardHeader
            title="Team members"
            description={`${MEMBERS.length} people have access to this workspace.`}
            trailing={<Button variant="primary" leading={<Icon.Plus size={14} />} onClick={() => setInviteOpen(true)}>Invite</Button>}
          />
          <CardBody padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-line-1 text-bone-low">
                    <th className="px-5 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em]">Member</th>
                    <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em]">Role</th>
                    <th className="hidden px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em] md:table-cell">Last active</th>
                    <th className="px-5 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {MEMBERS.map((m) => (
                    <tr key={m.id} className="border-b border-line-1/70 last:border-b-0 hover:bg-ink-2/60">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar glyph={m.glyph} size={32} />
                          <div>
                            <div className="font-medium text-bone">{m.name}</div>
                            <div className="font-mono text-[11px] text-bone-low">{m.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          value={m.role}
                          onChange={() => {}}
                          options={[
                            { value: "owner", label: "Owner" },
                            { value: "admin", label: "Admin" },
                            { value: "developer", label: "Developer" },
                            { value: "viewer", label: "Viewer" },
                            { value: "service", label: "Service account" },
                          ]}
                          className="w-40"
                        />
                      </td>
                      <td className="hidden px-4 py-3 text-bone-mid md:table-cell">{relTime(m.lastActive)}</td>
                      <td className="px-5 py-3 text-right">
                        {m.role !== "owner" && (
                          <Button variant="ghost" size="icon" aria-label="More"><Icon.More size={14} /></Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>

          <Modal
            open={inviteOpen}
            onClose={() => setInviteOpen(false)}
            title="Invite team member"
            description="They'll receive an email invitation to join this workspace."
            footer={
              <>
                <Button variant="ghost" onClick={() => setInviteOpen(false)}>Cancel</Button>
                <Button variant="primary" onClick={() => setInviteOpen(false)}>Send invite</Button>
              </>
            }
          >
            <div className="space-y-4">
              <Field label="Email address" required>
                <Input type="email" placeholder="colleague@company.com" />
              </Field>
              <Field label="Role">
                <Select
                  options={[
                    { value: "admin", label: "Admin" },
                    { value: "developer", label: "Developer" },
                    { value: "viewer", label: "Viewer" },
                  ]}
                />
              </Field>
            </div>
          </Modal>
        </Card>
      )}

      {/* === BILLING === */}
      {tab === "billing" && (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Current plan"
              trailing={<Button variant="secondary">Change plan</Button>}
            />
            <CardBody>
              <div className="flex items-center gap-4 rounded-xl border border-signal/30 bg-signal/5 p-5">
                <div className="grid h-12 w-12 place-items-center rounded-lg bg-signal/20 text-signal">
                  <Icon.Zap size={20} />
                </div>
                <div className="flex-1">
                  <div className="font-display text-[20px] font-semibold text-bone">Pro</div>
                  <div className="text-[13px] text-bone-mid">Up to 50M pushes/month · 25 apps · 5 seats</div>
                </div>
                <div className="text-right">
                  <div className="font-display text-[28px] font-semibold text-bone num">$249</div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-low">/month</div>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <UsageBar label="Pushes sent" current={14_200_000} max={50_000_000} color="#CDFF3F" />
                <UsageBar label="Apps" current={7} max={25} color="#7CB7FF" />
                <UsageBar label="Seats" current={4} max={5} color="#FF8A4C" />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Invoices" />
            <CardBody padded={false}>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-line-1 text-bone-low">
                      <th className="px-5 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em]">Invoice</th>
                      <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em]">Date</th>
                      <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.14em]">Amount</th>
                      <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em]">Status</th>
                      <th className="px-5 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {INVOICES.map((inv) => (
                      <tr key={inv.id} className="border-b border-line-1/70 last:border-b-0 hover:bg-ink-2/60">
                        <td className="px-5 py-3 font-mono text-bone">{inv.id}</td>
                        <td className="px-4 py-3 text-bone-mid">{dateTime(inv.date)}</td>
                        <td className="px-4 py-3 text-right font-mono num text-bone">${inv.amount}.00</td>
                        <td className="px-4 py-3"><Badge tone="ok" dot>Paid</Badge></td>
                        <td className="px-5 py-3 text-right">
                          <Button variant="ghost" size="sm" leading={<Icon.External size={12} />}>PDF</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* === NOTIFICATIONS === */}
      {tab === "notifications" && (
        <Card>
          <CardHeader title="Notification preferences" description="Control which emails and alerts you receive." />
          <CardBody className="space-y-5">
            {[
              { label: "Campaign sent", desc: "Email when a campaign finishes dispatching.", on: true },
              { label: "Campaign failed", desc: "Email + in-app alert for any campaign that fails.", on: true },
              { label: "Weekly digest", desc: "Summary of installs, pushes, and engagement every Monday.", on: true },
              { label: "Billing alerts", desc: "Approaching plan limits or failed payments.", on: true },
              { label: "New device surges", desc: "Spike in installs above 2× rolling average.", on: false },
              { label: "Marketing updates", desc: "Occasional product announcements from PushCare.", on: false },
            ].map((n, i) => (
              <div key={i} className="flex items-center justify-between gap-4 rounded-lg border border-line-1 bg-ink-2/40 p-4">
                <div>
                  <div className="text-[13px] font-medium text-bone">{n.label}</div>
                  <div className="text-[12px] text-bone-mid">{n.desc}</div>
                </div>
                <Switch checked={n.on} onChange={() => {}} />
              </div>
            ))}
          </CardBody>
          <CardFooter>
            <span />
            <Button variant="primary">Save preferences</Button>
          </CardFooter>
        </Card>
      )}

      {/* === WEBHOOKS === */}
      {tab === "webhooks" && (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Webhook endpoints"
              description="HTTP callbacks for real-time delivery events."
              trailing={<Button variant="primary" leading={<Icon.Plus size={14} />} onClick={() => setWebhookOpen(true)}>Add endpoint</Button>}
            />
            <CardBody padded={false}>
              <ul>
                {WEBHOOKS.map((wh) => (
                  <li key={wh.id} className="flex items-start gap-4 border-b border-line-1/70 px-5 py-4 last:border-b-0">
                    <div className={cn("mt-1 grid h-8 w-8 place-items-center rounded-md border", wh.active ? "border-ok/30 bg-ok/10 text-ok" : "border-line-1 bg-ink-2 text-bone-low")}>
                      <Icon.Globe size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-[12px] text-bone">{wh.url}</div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {wh.events.map((e) => <Badge key={e} tone="neutral">{e}</Badge>)}
                      </div>
                      <div className="mt-2 text-[11px] text-bone-low">
                        {wh.lastDelivery ? `Last delivery ${relTime(wh.lastDelivery)}` : "No deliveries yet"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={wh.active} onChange={() => {}} size="sm" />
                      <Button variant="ghost" size="icon" aria-label="More"><Icon.More size={14} /></Button>
                    </div>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Signing secret" description="Verify webhook payloads using HMAC-SHA256." />
            <CardBody>
              <div className="flex items-center gap-3 rounded-lg border border-line-1 bg-ink-2/40 p-4">
                <div className="flex-1 font-mono text-[12px] tracking-wide text-bone">whsec_•••••••••••••••••••••••••</div>
                <Button variant="secondary" size="sm" leading={<Icon.Eye size={12} />}>Reveal</Button>
                <Button variant="secondary" size="sm" leading={<Icon.Copy size={12} />}>Copy</Button>
              </div>
            </CardBody>
          </Card>

          <Modal
            open={webhookOpen}
            onClose={() => setWebhookOpen(false)}
            title="Add webhook endpoint"
            description="PushCare will POST JSON to this URL when selected events fire."
            footer={
              <>
                <Button variant="ghost" onClick={() => setWebhookOpen(false)}>Cancel</Button>
                <Button variant="primary" onClick={() => setWebhookOpen(false)}>Create endpoint</Button>
              </>
            }
          >
            <div className="space-y-4">
              <Field label="Endpoint URL" required>
                <Input type="url" placeholder="https://yourserver.com/webhooks/pushcare" />
              </Field>
              <Field label="Events to subscribe" hint="Select which event types trigger this webhook.">
                <div className="flex flex-wrap gap-1.5">
                  {["push.sent", "push.delivered", "push.opened", "push.clicked", "push.failed", "device.registered", "device.unregistered"].map((e) => (
                    <label key={e} className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-line-1 bg-ink-2 px-2 py-1 font-mono text-[11px] text-bone-mid hover:border-line-2">
                      <input type="checkbox" className="h-3 w-3 rounded border-line-2 bg-ink-2 text-signal focus:ring-signal/30" />
                      {e}
                    </label>
                  ))}
                </div>
              </Field>
            </div>
          </Modal>
        </div>
      )}
    </>
  );
}

function UsageBar({ label, current, max, color }: { label: string; current: number; max: number; color: string }) {
  const ratio = Math.min(1, current / max);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[12px] text-bone-mid">{label}</span>
        <span className="font-mono text-[11px] tabular-nums text-bone">{commas(current)} / {commas(max)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-ink-3/60">
        <div className="h-full rounded-full transition-all" style={{ width: `${ratio * 100}%`, background: color }} />
      </div>
    </div>
  );
}
