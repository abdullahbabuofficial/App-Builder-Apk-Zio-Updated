import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { Tabs } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { Avatar, EmptyState } from "@/components/ui/Misc";
import { Icon } from "@/lib/icons";
import { useAuth } from "@/context/AuthContext";
import { useApkzio } from "@/context/ApkzioDataContext";
import { APKZIO_ADMIN_API_KEY, APKZIO_API_URL, apkzioApiHostname } from "@/lib/config";
import { isSupabaseConfigured, supabaseBrowser } from "@/lib/supabase/client";

// Tooltip copy used on every disabled action so hover always explains the gating reason.
const COMING_SOON_TITLE = "Not available yet — this lands in a future release.";

const NOTIFICATION_PREFS: { key: string; label: string; desc: string; default: boolean }[] = [
  { key: "campaign_sent", label: "Campaign sent", desc: "Email when a campaign finishes dispatching.", default: true },
  { key: "campaign_failed", label: "Campaign failed", desc: "Email + in-app alert for any campaign that fails.", default: true },
  { key: "weekly_digest", label: "Weekly digest", desc: "Summary of installs, pushes, and engagement every Monday.", default: true },
  { key: "billing_alerts", label: "Billing alerts", desc: "Approaching plan limits or failed payments.", default: true },
  { key: "device_surges", label: "New device surges", desc: "Spike in installs above 2x rolling average.", default: false },
  { key: "marketing", label: "Marketing updates", desc: "Occasional product announcements from ApkZio.", default: false },
];

const NOTIF_PREFS_STORAGE_KEY = "pc_notif_prefs_v1";

function readPrefs(): Record<string, boolean> {
  const defaults = Object.fromEntries(NOTIFICATION_PREFS.map((p) => [p.key, p.default]));
  try {
    const raw = localStorage.getItem(NOTIF_PREFS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const merged: Record<string, boolean> = { ...defaults };
    for (const k of Object.keys(defaults)) {
      if (typeof parsed[k] === "boolean") merged[k] = parsed[k] as boolean;
    }
    return merged;
  } catch {
    return defaults;
  }
}

function writePrefs(prefs: Record<string, boolean>): void {
  try {
    localStorage.setItem(NOTIF_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

export function Settings() {
  const [tab, setTab] = useState("account");
  const { session } = useAuth();
  const { adminAuthEnforced } = useApkzio();

  const initialName = useMemo(() => {
    const meta = session?.user?.user_metadata as { full_name?: string; name?: string } | undefined;
    return meta?.full_name ?? meta?.name ?? "";
  }, [session]);
  const initialEmail = session?.user?.email ?? "";

  // Profile form
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    setName(initialName);
    setEmail(initialEmail);
  }, [initialName, initialEmail]);

  useEffect(() => {
    if (!profileSaved) return;
    const t = window.setTimeout(() => setProfileSaved(false), 3000);
    return () => window.clearTimeout(t);
  }, [profileSaved]);

  // Password form
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  useEffect(() => {
    if (!pwSaved) return;
    const t = window.setTimeout(() => setPwSaved(false), 3000);
    return () => window.clearTimeout(t);
  }, [pwSaved]);

  // Notifications (local-only). Persisted in localStorage so a refresh doesn't reset them,
  // but never hits the server — that's what the muted note in the tab makes explicit.
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => readPrefs());
  useEffect(() => {
    writePrefs(prefs);
  }, [prefs]);

  const supabaseReady = isSupabaseConfigured && Boolean(supabaseBrowser);
  const profileTooltip = supabaseReady
    ? undefined
    : "Connect Supabase to edit your profile.";

  async function onSaveProfile() {
    if (!supabaseBrowser) return;
    setProfileError(null);
    setProfileSaving(true);
    const { error } = await supabaseBrowser.auth.updateUser({
      email,
      data: { full_name: name },
    });
    setProfileSaving(false);
    if (error) {
      setProfileError(error.message);
      return;
    }
    setProfileSaved(true);
  }

  async function onUpdatePassword() {
    if (!supabaseBrowser) return;
    setPwError(null);
    if (newPassword.length < 12) {
      setPwError("Password must be at least 12 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("Passwords do not match.");
      return;
    }
    setPwSaving(true);
    const { error } = await supabaseBrowser.auth.updateUser({ password: newPassword });
    setPwSaving(false);
    if (error) {
      setPwError(error.message);
      return;
    }
    setPwSaved(true);
    setNewPassword("");
    setConfirmPassword("");
  }

  const avatarGlyph = (initialName || initialEmail || "?").trim().charAt(0).toUpperCase() || "?";

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
          { value: "workspace", label: "Workspace" },
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
                <Avatar glyph={avatarGlyph} size={64} className="text-xl" />
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled
                    title="Avatar upload requires the storage API (coming soon)."
                  >
                    Change avatar
                  </Button>
                  <Badge tone="neutral">Coming soon</Badge>
                </div>
              </div>
              <p className="text-[11px] text-bone-low">JPG, PNG, or SVG. Max 2 MB.</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Full name">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={!supabaseReady}
                    title={profileTooltip}
                    placeholder={supabaseReady ? "Your full name" : "Sign in with Supabase to edit"}
                  />
                </Field>
                <Field label="Email">
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    disabled={!supabaseReady}
                    title={profileTooltip}
                  />
                </Field>
              </div>
              {profileError && (
                <div className="text-[12px] text-danger">{profileError}</div>
              )}
              {profileSaved && (
                <div className="rounded-md border border-signal/20 bg-signal/15 px-3 py-2 text-[12px] text-signal">
                  Saved.
                </div>
              )}
            </CardBody>
            <CardFooter>
              <span className="text-[11px] text-bone-low">
                {supabaseReady ? "Updates apply to your Supabase auth user." : "Supabase auth is not configured."}
              </span>
              <Button
                variant="primary"
                onClick={() => { void onSaveProfile(); }}
                disabled={!supabaseReady || profileSaving}
                title={profileTooltip}
              >
                {profileSaving ? "Saving..." : "Save changes"}
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader title="Password" description="Change your password. Minimum 12 characters." />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="New password">
                  <Input
                    type="password"
                    placeholder="At least 12 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={!supabaseReady}
                    title={profileTooltip}
                  />
                </Field>
                <Field label="Confirm new password">
                  <Input
                    type="password"
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={!supabaseReady}
                    title={profileTooltip}
                  />
                </Field>
              </div>
              {pwError && (
                <div className="text-[12px] text-danger">{pwError}</div>
              )}
              {pwSaved && (
                <div className="rounded-md border border-signal/20 bg-signal/15 px-3 py-2 text-[12px] text-signal">
                  Saved.
                </div>
              )}
            </CardBody>
            <CardFooter>
              <span className="text-[11px] text-bone-low">
                {supabaseReady ? "You'll stay signed in on this device." : "Connect Supabase to change your password."}
              </span>
              <Button
                variant="secondary"
                onClick={() => { void onUpdatePassword(); }}
                disabled={!supabaseReady || pwSaving}
                title={profileTooltip}
              >
                {pwSaving ? "Updating..." : "Update password"}
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader title="Danger zone" />
            <CardBody>
              <div className="flex items-center justify-between gap-4 rounded-lg border border-danger/30 bg-danger/5 p-4">
                <div>
                  <div className="text-[13px] font-medium text-bone">Delete account</div>
                  <div className="text-[12px] text-bone-mid">
                    Permanently remove your account and all associated data. This action cannot be undone.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="danger"
                    disabled
                    title="Account deletion is not available yet."
                  >
                    Delete account
                  </Button>
                  <Badge tone="neutral">Coming soon</Badge>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* === WORKSPACE (API / admin key) === */}
      {tab === "workspace" && (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="REST API & operator access"
              description="Browser reads only anon/Vite vars; admin secrets stay on the API server."
            />
            <CardBody className="space-y-5 text-[13px]">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-low">
                  VITE_APKZIO_API_URL
                </div>
                <div className="mt-1 break-all font-mono text-[12px] text-bone">
                  {APKZIO_API_URL.length > 0 ? APKZIO_API_URL : "— not set"}
                </div>
                {APKZIO_API_URL.length > 0 ? (
                  <div className="mt-1 text-[11px] text-bone-mid">Host: {apkzioApiHostname()}</div>
                ) : null}
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-low">
                  GET /api/status → admin_auth_enforced
                </div>
                <div className="mt-1 text-bone">
                  {adminAuthEnforced === null && (
                    <span className="text-bone-mid">
                      Unknown — endpoint missing, blocked, or non‑Apkzio API (banner uses this to detect{" "}
                      <span className="font-mono text-[11px]">ENFORCE_ADMIN_AUTH</span> on local-api).
                    </span>
                  )}
                  {adminAuthEnforced === false && (
                    <span className="text-bone-mid">
                      <span className="text-signal">Off</span> — admin routes do not require{" "}
                      <span className="font-mono text-[11px]">X-Apkzio-Admin-Key</span> from this policy (still follow
                      API docs).
                    </span>
                  )}
                  {adminAuthEnforced === true && (
                    <span className="text-warn">
                      <span className="font-semibold">On</span> — set{" "}
                      <span className="font-mono text-[11px]">VITE_APKZIO_ADMIN_API_KEY</span> in{" "}
                      <span className="font-mono text-[11px]">.env.local</span> (same value as server{" "}
                      <span className="font-mono text-[11px]">APKZIO_ADMIN_API_KEY</span>) for{" "}
                      <span className="font-mono text-[11px]">/api/admin/*</span>, or use an operator account the API
                      accepts.
                    </span>
                  )}
                </div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-low">
                  VITE_APKZIO_ADMIN_API_KEY
                </div>
                <div className="mt-1 text-bone">
                  {APKZIO_ADMIN_API_KEY.length > 0 ? (
                    <span className="text-signal">Set</span>
                  ) : (
                    <span className="text-bone-mid">Not set</span>
                  )}{" "}
                  <span className="text-bone-mid">(sent as request header, never commit to public sites.)</span>
                </div>
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
            description="Workspace member management."
            trailing={
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  leading={<Icon.Plus size={14} />}
                  disabled
                  title={COMING_SOON_TITLE}
                >
                  Invite
                </Button>
                <Badge tone="neutral">Coming soon</Badge>
              </div>
            }
          />
          <CardBody>
            <EmptyState
              icon={<Icon.Users size={20} />}
              title="Team management is coming soon"
              description="Invite, role, and SSO provisioning will land with the workspace API."
              className="min-h-[260px]"
            />
          </CardBody>
        </Card>
      )}

      {/* === BILLING === */}
      {tab === "billing" && (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Current plan"
              trailing={
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    disabled
                    title="Plan changes will be available once billing is connected."
                  >
                    Change plan
                  </Button>
                  <Badge tone="neutral">Coming soon</Badge>
                </div>
              }
            />
            <CardBody>
              <div className="rounded-lg border border-line-1 bg-ink-2/40 p-4 text-[12px] text-bone-mid">
                Plan and usage metrics will appear here once billing is connected.
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Invoices" />
            <CardBody>
              <EmptyState
                icon={<Icon.Zap size={20} />}
                title="Billing is not connected"
                description="Stripe and the customer billing portal will be wired up in a separate workstream. Invoices will appear here once that's ready."
                className="min-h-[220px]"
              />
            </CardBody>
          </Card>
        </div>
      )}

      {/* === NOTIFICATIONS === */}
      {tab === "notifications" && (
        <Card>
          <CardHeader
            title="Notification preferences"
            description="Control which emails and alerts you'd like to receive."
            trailing={<Badge tone="neutral">Local only</Badge>}
          />
          <CardBody className="space-y-5">
            {NOTIFICATION_PREFS.map((n) => (
              <div
                key={n.key}
                className="flex items-center justify-between gap-4 rounded-lg border border-line-1 bg-ink-2/40 p-4"
              >
                <div>
                  <div className="text-[13px] font-medium text-bone">{n.label}</div>
                  <div className="text-[12px] text-bone-mid">{n.desc}</div>
                </div>
                <Switch
                  checked={prefs[n.key] ?? n.default}
                  onChange={(v) => setPrefs((p) => ({ ...p, [n.key]: v }))}
                />
              </div>
            ))}
            <p className="text-[12px] text-bone-mid">
              Preferences are saved to this browser only and won't trigger any emails until the
              notifications API ships.
            </p>
          </CardBody>
        </Card>
      )}

      {/* === WEBHOOKS === */}
      {tab === "webhooks" && (
        <Card>
          <CardHeader
            title="Webhook endpoints"
            description="HTTP callbacks for real-time delivery events."
            trailing={
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  leading={<Icon.Plus size={14} />}
                  disabled
                  title="Webhook delivery is not wired up yet."
                >
                  Add webhook
                </Button>
                <Badge tone="neutral">Coming soon</Badge>
              </div>
            }
          />
          <CardBody>
            <EmptyState
              icon={<Icon.Globe size={20} />}
              title="Webhooks pending"
              description="Endpoint configuration, signing secrets, and delivery logs will be available once the webhook delivery service is live."
              className="min-h-[260px]"
            />
          </CardBody>
        </Card>
      )}
    </>
  );
}
