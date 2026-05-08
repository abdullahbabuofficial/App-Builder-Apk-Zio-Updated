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
import { apiFetch } from "@/lib/api";
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

  // Billing state
  const [subscription, setSubscription] = useState<any>(null);
  const [billingPlans, setBillingPlans] = useState<any[]>([]);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    setName(initialName);
    setEmail(initialEmail);
  }, [initialName, initialEmail]);

  // Load billing data
  useEffect(() => {
    async function loadBillingData() {
      if (!session?.user?.id) return;
      setLoadingBilling(true);
      try {
        // Fetch plans
        const plansRes = await fetch(`${APKZIO_API_URL}/api/billing/plans`);
        const plansData = await plansRes.json();
        if (plansData.plans) {
          setBillingPlans(plansData.plans);
        }

        // Fetch current subscription
        const subRes = await fetch(`${APKZIO_API_URL}/api/billing/subscription/${session.user.id}`);
        if (subRes.ok) {
          const subData = await subRes.json();
          setSubscription(subData);
        }
      } catch (error) {
        console.error('Failed to load billing data:', error);
      } finally {
        setLoadingBilling(false);
      }
    }
    void loadBillingData();
  }, [session?.user?.id]);

  // Handle upgrade
  async function handleUpgrade(planId: string) {
    if (!session?.user?.id) return;
    try {
      const res = await fetch(`${APKZIO_API_URL}/api/billing/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: session.user.id,
          plan_id: planId,
          interval: billingInterval,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Checkout failed:', error);
    }
  }

  // Handle cancel subscription
  async function handleCancelSubscription() {
    if (!subscription?.stripe_subscription_id) return;
    if (!confirm('Are you sure you want to cancel your subscription? It will remain active until the end of the billing period.')) {
      return;
    }
    try {
      const res = await fetch(`${APKZIO_API_URL}/api/billing/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription_id: subscription.stripe_subscription_id,
        }),
      });
      if (res.ok) {
        // Reload subscription data
        const subRes = await fetch(`${APKZIO_API_URL}/api/billing/subscription/${session?.user?.id}`);
        if (subRes.ok) {
          const subData = await subRes.json();
          setSubscription(subData);
        }
      }
    } catch (error) {
      console.error('Cancel failed:', error);
    }
  }

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

  // Team management state
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("member");
  const [inviting, setInviting] = useState(false);
  const [loadingTeam, setLoadingTeam] = useState(false);

  // Load team members
  useEffect(() => {
    if (tab === "team") {
      void loadTeamMembers();
    }
  }, [tab]);

  async function loadTeamMembers() {
    setLoadingTeam(true);
    try {
      const res = await apiFetch('/api/team/members', {
        headers: {
          'x-user-email': session?.user?.email || '',
        },
      });
      const data = await res.json();
      if (data.members) {
        setTeamMembers(data.members);
      }
    } catch (error) {
      console.error('Failed to load team members:', error);
    } finally {
      setLoadingTeam(false);
    }
  }

  async function inviteMember() {
    if (!inviteEmail || !inviteRole) return;
    
    setInviting(true);
    try {
      const res = await apiFetch('/api/team/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': session?.user?.email || '',
        },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      
      if (res.ok) {
        setShowInviteModal(false);
        setInviteEmail("");
        setInviteRole("member");
        await loadTeamMembers();
      } else {
        const data = await res.json();
        alert(data.error?.message || 'Failed to send invite');
      }
    } catch (error) {
      console.error('Failed to invite member:', error);
      alert('Failed to send invite');
    } finally {
      setInviting(false);
    }
  }

  async function removeMember(memberId: string) {
    if (!confirm('Are you sure you want to remove this team member?')) return;
    
    try {
      const res = await apiFetch(`/api/team/members/${memberId}`, {
        method: 'DELETE',
        headers: {
          'x-user-email': session?.user?.email || '',
        },
      });
      
      if (res.ok) {
        await loadTeamMembers();
      } else {
        const data = await res.json();
        alert(data.error?.message || 'Failed to remove member');
      }
    } catch (error) {
      console.error('Failed to remove member:', error);
      alert('Failed to remove member');
    }
  }

  async function updateRole(memberId: string, newRole: string) {
    try {
      const res = await apiFetch(`/api/team/members/${memberId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': session?.user?.email || '',
        },
        body: JSON.stringify({ role: newRole }),
      });
      
      if (res.ok) {
        await loadTeamMembers();
      } else {
        const data = await res.json();
        alert(data.error?.message || 'Failed to update role');
      }
    } catch (error) {
      console.error('Failed to update role:', error);
      alert('Failed to update role');
    }
  }

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
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Team members"
              description="Invite members and manage roles."
              trailing={
                <Button
                  variant="primary"
                  leading={<Icon.Plus size={14} />}
                  onClick={() => setShowInviteModal(true)}
                >
                  Invite member
                </Button>
              }
            />
            <CardBody>
              {loadingTeam ? (
                <div className="rounded-lg border border-line-1 bg-ink-2/40 p-4 text-[12px] text-bone-mid">
                  Loading team members...
                </div>
              ) : teamMembers.length === 0 ? (
                <EmptyState
                  icon={<Icon.Users size={20} />}
                  title="No team members yet"
                  description="Invite your first team member to start collaborating."
                  className="min-h-[260px]"
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-line-1 text-left">
                        <th className="pb-3 font-medium text-bone-low">Member</th>
                        <th className="pb-3 font-medium text-bone-low">Role</th>
                        <th className="pb-3 font-medium text-bone-low">Status</th>
                        <th className="pb-3 font-medium text-bone-low">Invited</th>
                        <th className="pb-3 font-medium text-bone-low text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamMembers.map((member) => (
                        <tr key={member.id} className="border-b border-line-1/50">
                          <td className="py-3">
                            <div className="flex items-center gap-3">
                              <Avatar glyph={member.email.charAt(0).toUpperCase()} size={32} />
                              <div>
                                <div className="font-medium text-bone">
                                  {member.full_name || member.email}
                                </div>
                                {member.full_name && (
                                  <div className="text-[11px] text-bone-mid">{member.email}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3">
                            <select
                              value={member.role}
                              onChange={(e) => { void updateRole(member.id, e.target.value); }}
                              className="rounded border border-line-1 bg-ink-2/40 px-2 py-1 text-[12px] text-bone"
                            >
                              <option value="owner">Owner</option>
                              <option value="admin">Admin</option>
                              <option value="developer">Developer</option>
                              <option value="analyst">Analyst</option>
                              <option value="member">Member</option>
                            </select>
                          </td>
                          <td className="py-3">
                            <Badge
                              tone={member.status === 'active' ? 'ok' : 'neutral'}
                            >
                              {member.status}
                            </Badge>
                          </td>
                          <td className="py-3 text-bone-mid">
                            {new Date(member.invited_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 text-right">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => { void removeMember(member.id); }}
                            >
                              Remove
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Role descriptions card */}
          <Card>
            <CardHeader title="Role permissions" />
            <CardBody className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border border-line-1 bg-ink-2/40 p-3">
                  <div className="text-[13px] font-medium text-bone mb-1">Owner</div>
                  <div className="text-[12px] text-bone-mid">
                    Full access to all features and settings, including billing and team management.
                  </div>
                </div>
                <div className="rounded-lg border border-line-1 bg-ink-2/40 p-3">
                  <div className="text-[13px] font-medium text-bone mb-1">Admin</div>
                  <div className="text-[12px] text-bone-mid">
                    Manage team, apps, and campaigns. Can invite and remove members.
                  </div>
                </div>
                <div className="rounded-lg border border-line-1 bg-ink-2/40 p-3">
                  <div className="text-[13px] font-medium text-bone mb-1">Developer</div>
                  <div className="text-[12px] text-bone-mid">
                    Build and update apps, campaigns, and builds. Create API keys.
                  </div>
                </div>
                <div className="rounded-lg border border-line-1 bg-ink-2/40 p-3">
                  <div className="text-[13px] font-medium text-bone mb-1">Analyst</div>
                  <div className="text-[12px] text-bone-mid">
                    View analytics, reports, and campaigns. Read-only access.
                  </div>
                </div>
                <div className="rounded-lg border border-line-1 bg-ink-2/40 p-3">
                  <div className="text-[13px] font-medium text-bone mb-1">Member</div>
                  <div className="text-[12px] text-bone-mid">
                    Basic read-only access to apps and campaigns.
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-line-1 bg-ink p-6">
            <div className="mb-4 text-[16px] font-medium text-bone">Invite team member</div>
            <div className="space-y-4">
              <Field label="Email address">
                <Input
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </Field>
              <Field label="Role">
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full rounded border border-line-1 bg-ink-2/40 px-3 py-2 text-[13px] text-bone"
                >
                  <option value="member">Member - Read-only access</option>
                  <option value="analyst">Analyst - View analytics</option>
                  <option value="developer">Developer - Build and update</option>
                  <option value="admin">Admin - Manage team</option>
                  <option value="owner">Owner - Full access</option>
                </select>
              </Field>
            </div>
            <div className="mt-6 flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteEmail("");
                  setInviteRole("member");
                }}
                disabled={inviting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => { void inviteMember(); }}
                disabled={!inviteEmail || inviting}
              >
                {inviting ? "Sending..." : "Send invite"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* === BILLING === */}
      {tab === "billing" && (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Current plan"
              description={subscription ? `${subscription.plan_name} - ${subscription.status}` : 'No active subscription'}
              trailing={
                subscription && subscription.status === 'active' ? (
                  <Button
                    variant="secondary"
                    onClick={() => { void handleCancelSubscription(); }}
                  >
                    Cancel subscription
                  </Button>
                ) : null
              }
            />
            <CardBody>
              {loadingBilling ? (
                <div className="rounded-lg border border-line-1 bg-ink-2/40 p-4 text-[12px] text-bone-mid">
                  Loading billing information...
                </div>
              ) : subscription ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-[13px]">
                    <div>
                      <div className="text-bone-low">Plan</div>
                      <div className="font-medium text-bone">{subscription.plan_name}</div>
                    </div>
                    <div>
                      <div className="text-bone-low">Status</div>
                      <div className="font-medium text-bone capitalize">{subscription.status}</div>
                    </div>
                    <div>
                      <div className="text-bone-low">Started</div>
                      <div className="font-medium text-bone">
                        {new Date(subscription.started_at).toLocaleDateString()}
                      </div>
                    </div>
                    {subscription.ends_at && (
                      <div>
                        <div className="text-bone-low">Ends</div>
                        <div className="font-medium text-bone">
                          {new Date(subscription.ends_at).toLocaleDateString()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-line-1 bg-ink-2/40 p-4 text-[12px] text-bone-mid">
                  You're currently on the free Starter plan. Upgrade to unlock more features.
                </div>
              )}
            </CardBody>
          </Card>

          {billingPlans.length > 0 && (
            <Card>
              <CardHeader 
                title="Available plans"
                trailing={
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setBillingInterval('monthly')}
                      className={`px-3 py-1 text-[12px] rounded ${billingInterval === 'monthly' ? 'bg-signal text-ink' : 'bg-ink-2/40 text-bone-mid'}`}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setBillingInterval('yearly')}
                      className={`px-3 py-1 text-[12px] rounded ${billingInterval === 'yearly' ? 'bg-signal text-ink' : 'bg-ink-2/40 text-bone-mid'}`}
                    >
                      Yearly
                    </button>
                  </div>
                }
              />
              <CardBody>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {billingPlans.map((plan) => {
                    const price = billingInterval === 'monthly' ? plan.priceMonthly : plan.priceYearly;
                    const isCurrentPlan = subscription?.plan_name === plan.name;
                    return (
                      <div
                        key={plan.id}
                        className={`rounded-lg border p-4 ${isCurrentPlan ? 'border-signal bg-signal/5' : 'border-line-1 bg-ink-2/40'}`}
                      >
                        <div className="text-[16px] font-medium text-bone mb-1">{plan.name}</div>
                        <div className="text-[24px] font-bold text-bone mb-4">
                          ${price}
                          <span className="text-[14px] text-bone-mid font-normal">
                            /{billingInterval === 'monthly' ? 'mo' : 'yr'}
                          </span>
                        </div>
                        <ul className="space-y-2 mb-4">
                          {plan.features.map((feature: string, idx: number) => (
                            <li key={idx} className="text-[12px] text-bone-mid flex items-center gap-2">
                              <Icon.Check size={14} className="text-signal" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                        {isCurrentPlan ? (
                          <Badge tone="signal" className="w-full justify-center">Current plan</Badge>
                        ) : plan.id === 'starter' ? (
                          <Button variant="secondary" disabled className="w-full">
                            Free plan
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            onClick={() => { void handleUpgrade(plan.id); }}
                            className="w-full"
                            disabled={!plan.stripePriceIdMonthly && !plan.stripePriceIdYearly}
                          >
                            Upgrade
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Invoices" />
            <CardBody>
              <EmptyState
                icon={<Icon.Zap size={20} />}
                title="No invoices yet"
                description="Your invoices will appear here once you have an active subscription."
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
      {tab === "webhooks" && <WebhooksTab />}
    </>
  );
}

// Webhook event types
const WEBHOOK_EVENTS = [
  { value: "campaign.sent", label: "Campaign Sent", desc: "Triggered when a campaign finishes sending" },
  { value: "campaign.delivered", label: "Campaign Delivered", desc: "Triggered when a message is delivered" },
  { value: "campaign.opened", label: "Campaign Opened", desc: "Triggered when a user opens a notification" },
  { value: "campaign.clicked", label: "Campaign Clicked", desc: "Triggered when a user clicks a notification" },
  { value: "campaign.failed", label: "Campaign Failed", desc: "Triggered when a campaign fails" },
  { value: "app.created", label: "App Created", desc: "Triggered when a new app is created" },
  { value: "build.completed", label: "Build Completed", desc: "Triggered when a build finishes successfully" },
  { value: "build.failed", label: "Build Failed", desc: "Triggered when a build fails" },
];

interface Webhook {
  id: string;
  url: string;
  secret: string;
  events: string[];
  is_active: boolean;
  created_at: string;
}

function WebhooksTab() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["campaign.sent"]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadWebhooks();
  }, []);

  async function loadWebhooks() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/webhooks");
      const data = await res.json() as { ok: boolean; webhooks: Webhook[] };
      setWebhooks(data.webhooks);
    } catch (err) {
      console.error("Failed to load webhooks:", err);
    } finally {
      setLoading(false);
    }
  }

  async function createWebhook() {
    if (!newUrl || !newUrl.startsWith("http")) {
      setError("Please enter a valid HTTP(S) URL");
      return;
    }
    if (selectedEvents.length === 0) {
      setError("Please select at least one event");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await apiFetch("/api/webhooks", {
        method: "POST",
        body: JSON.stringify({ url: newUrl, events: selectedEvents }),
      });

      setNewUrl("");
      setSelectedEvents(["campaign.sent"]);
      setShowAddForm(false);
      await loadWebhooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create webhook");
    } finally {
      setSaving(false);
    }
  }

  async function toggleWebhook(id: string, is_active: boolean) {
    try {
      await apiFetch(`/api/webhooks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active }),
      });
      await loadWebhooks();
    } catch (err) {
      console.error("Failed to toggle webhook:", err);
    }
  }

  async function deleteWebhook(id: string) {
    if (!confirm("Are you sure you want to delete this webhook?")) return;

    try {
      await apiFetch(`/api/webhooks/${id}`, { method: "DELETE" });
      await loadWebhooks();
    } catch (err) {
      console.error("Failed to delete webhook:", err);
    }
  }

  function copySecret(secret: string) {
    void navigator.clipboard.writeText(secret);
  }

  if (loading) {
    return (
      <Card>
        <CardBody>
          <div className="flex items-center justify-center py-12">
            <div className="text-bone-mid">Loading webhooks...</div>
          </div>
        </CardBody>
      </Card>
    );
  }

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
              onClick={() => setShowAddForm(!showAddForm)}
            >
              Add webhook
            </Button>
          }
        />
        <CardBody>
          {showAddForm && (
            <div className="mb-6 space-y-4 rounded-lg border border-line-1 bg-ink-2/40 p-4">
              <Field label="Webhook URL">
                <Input
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://api.example.com/webhooks"
                  type="url"
                />
              </Field>

              <div>
                <div className="mb-2 text-[13px] font-medium text-bone">Events</div>
                <div className="space-y-2">
                  {WEBHOOK_EVENTS.map((event) => (
                    <label
                      key={event.value}
                      className="flex items-start gap-3 rounded-lg border border-line-1 bg-ink-1/40 p-3 cursor-pointer hover:bg-ink-1/60"
                    >
                      <input
                        type="checkbox"
                        checked={selectedEvents.includes(event.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEvents([...selectedEvents, event.value]);
                          } else {
                            setSelectedEvents(selectedEvents.filter((ev) => ev !== event.value));
                          }
                        }}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="text-[13px] font-medium text-bone">{event.label}</div>
                        <div className="text-[12px] text-bone-mid">{event.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {error && <div className="text-[12px] text-danger">{error}</div>}

              <div className="flex gap-2">
                <Button variant="primary" onClick={() => { void createWebhook(); }} disabled={saving}>
                  {saving ? "Creating..." : "Create webhook"}
                </Button>
                <Button variant="secondary" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {webhooks.length === 0 ? (
            <EmptyState
              icon={<Icon.Globe size={20} />}
              title="No webhooks configured"
              description="Add your first webhook endpoint to receive real-time notifications about campaigns, builds, and app events."
              className="min-h-[260px]"
            />
          ) : (
            <div className="space-y-4">
              {webhooks.map((webhook) => (
                <div
                  key={webhook.id}
                  className="rounded-lg border border-line-1 bg-ink-2/40 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="text-[13px] font-medium text-bone truncate">
                          {webhook.url}
                        </div>
                        {webhook.is_active ? (
                          <Badge tone="ok">Active</Badge>
                        ) : (
                          <Badge tone="neutral">Inactive</Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-bone-mid">
                        Created {new Date(webhook.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={webhook.is_active}
                        onChange={(v) => { void toggleWebhook(webhook.id, v); }}
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => { void deleteWebhook(webhook.id); }}
                        title="Delete webhook"
                      >
                        <Icon.Trash size={14} />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-medium text-bone-mid mb-1">Events:</div>
                    <div className="flex flex-wrap gap-1">
                      {webhook.events.map((event) => (
                        <Badge key={event} tone="neutral" className="text-[10px]">
                          {event}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-medium text-bone-mid mb-1">Signing secret:</div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-[11px] font-mono text-bone-mid bg-ink-1 px-2 py-1 rounded truncate">
                        {webhook.secret.slice(0, 32)}...
                      </code>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => copySecret(webhook.secret)}
                        title="Copy secret"
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Webhook verification" />
        <CardBody className="space-y-4">
          <div className="text-[13px] text-bone-mid">
            All webhook requests include an <code className="text-bone font-mono text-[12px]">X-Webhook-Signature</code> header containing an HMAC SHA256 signature of the payload. Verify this signature using your signing secret to ensure the request came from ApkZio.
          </div>
          <div className="rounded-lg border border-line-1 bg-ink-1 p-3 font-mono text-[11px] text-bone-mid overflow-x-auto">
            <div>const crypto = require('crypto');</div>
            <div>const signature = crypto</div>
            <div>  .createHmac('sha256', YOUR_SECRET)</div>
            <div>  .update(JSON.stringify(payload))</div>
            <div>  .digest('hex');</div>
            <div className="mt-2">// Compare with X-Webhook-Signature header</div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
