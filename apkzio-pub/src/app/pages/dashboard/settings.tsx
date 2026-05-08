import { useEffect, useState } from 'react';
import { Bell, Lock, Palette, Globe, Shield, Trash2, Key, Plug } from 'lucide-react';
import { toast } from 'sonner';
import { DashboardLayout } from '../../components/dashboard/dashboard-layout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import {
  type ApiConnectionProbe,
  getApiBaseUrl,
  probeApiConnection,
  registerMyPushToken,
} from '../../lib/api';
import { registerBrowserPushToken } from '../../lib/firebase';
import { useAuth } from '../../contexts/auth-context';

export function SettingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('account');
  const [pushBusy, setPushBusy] = useState(false);
  const [probeBusy, setProbeBusy] = useState(false);
  const [probeResult, setProbeResult] = useState<ApiConnectionProbe | null>(null);
  const [liveProbe, setLiveProbe] = useState<ApiConnectionProbe | null>(null);
  const [liveBusy, setLiveBusy] = useState(false);

  useEffect(() => {
    if (tab !== 'connections') return;
    let cancelled = false;
    setLiveBusy(true);
    void (async () => {
      try {
        const r = await probeApiConnection(getApiBaseUrl());
        if (!cancelled) setLiveProbe(r);
      } finally {
        if (!cancelled) setLiveBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const tabs = [
    { id: 'account', label: 'Account', icon: Lock },
    { id: 'connections', label: 'Connections', icon: Plug },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'language', label: 'Language', icon: Globe },
  ];

  const firebaseConfigured = Boolean(import.meta.env.VITE_FIREBASE_API_KEY);

  return (
    <DashboardLayout currentPage="settings">
      <div className="space-y-6">
        <div>
          <h1 className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Settings</h1>
          <p className="text-muted-foreground mt-1">Customize your account and application preferences</p>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          <div className="bg-card border border-border rounded-2xl p-3 h-fit">
            {tabs.map((t) => {
              const Icon = t.icon;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    tab === t.id ? 'bg-gradient-to-r from-primary to-secondary text-white' : 'hover:bg-muted'
                  }`}>
                  <Icon className="h-4 w-4" />{t.label}
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-3 space-y-6">
            {tab === 'account' && (
              <>
                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="mb-4 font-semibold">Account Information</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Full name</Label>
                      <Input
                        defaultValue={user?.full_name ?? ''}
                        placeholder="Your full name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        defaultValue={user?.email ?? ''}
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="mb-4">Change Password</h3>
                  <div className="space-y-4">
                    <div className="space-y-2"><Label>Current Password</Label><Input type="password" /></div>
                    <div className="space-y-2"><Label>New Password</Label><Input type="password" /></div>
                    <div className="space-y-2"><Label>Confirm New Password</Label><Input type="password" /></div>
                    <Button className="bg-gradient-to-r from-primary to-secondary">Update Password</Button>
                  </div>
                </div>
                <div className="bg-card border border-destructive/30 rounded-2xl p-6">
                  <h3 className="text-destructive mb-2">Danger Zone</h3>
                  <p className="text-sm text-muted-foreground mb-4">Permanently delete your account and all data.</p>
                  <Button variant="outline" className="text-destructive border-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete Account</Button>
                </div>
              </>
            )}

            {tab === 'connections' && (
              <div className="space-y-6">
                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="mb-1 font-semibold">API &amp; backend</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    The dashboard reads the REST API URL only from your environment file at{' '}
                    <strong>build time</strong>: set{' '}
                    <span className="font-mono text-xs">VITE_APKZIO_API_URL</span> in{' '}
                    <span className="font-mono text-xs">.env.local</span> (or your host&apos;s env vars), then restart{' '}
                    <span className="font-mono text-xs">vite</span> / redeploy. Example for dev:{' '}
                    <span className="font-mono text-xs">http://127.0.0.1:8787</span> when the API runs locally.
                  </p>
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[13px] text-amber-950 dark:text-amber-100 mb-4">
                    Do not put database URLs or secret keys in the frontend env — only{' '}
                    <span className="font-mono text-[11px]">VITE_*</span> values belong here. Postgres and service secrets stay on the server
                    (for example <span className="font-mono text-[11px]">firebase-service</span> / Cloud Run).
                  </div>
                  <div className="space-y-2">
                    <Label>REST API base URL (from env)</Label>
                    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 font-mono text-sm break-all">
                      {getApiBaseUrl()}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={probeBusy}
                      onClick={async () => {
                        const u = getApiBaseUrl();
                        setProbeBusy(true);
                        setProbeResult(null);
                        try {
                          const r = await probeApiConnection(u);
                          setProbeResult(r);
                          if (r.ok) toast.success('API reachable');
                          else toast.error(r.message);
                        } finally {
                          setProbeBusy(false);
                        }
                      }}
                    >
                      {probeBusy ? 'Testing…' : 'Test connection'}
                    </Button>
                  </div>
                  {probeResult ? (
                    <div className="mt-3 text-sm" role="status">
                      {probeResult.ok ? (
                        probeResult.source === 'status' ? (
                          <ul className="space-y-1 rounded-lg border border-border bg-muted/20 p-3 text-[13px]">
                            <li className="font-medium text-green-600 dark:text-green-400">Connected (full status)</li>
                            <li>
                              <span className="text-muted-foreground">Service:</span> {probeResult.status.service}
                            </li>
                            {probeResult.status.persistence ? (
                              <li>
                                <span className="text-muted-foreground">Persistence:</span>{' '}
                                {probeResult.status.persistence}
                              </li>
                            ) : null}
                            {probeResult.status.role ? (
                              <li>
                                <span className="text-muted-foreground">Role:</span> {probeResult.status.role}
                              </li>
                            ) : null}
                            {probeResult.status.worker ? (
                              <li>
                                <span className="text-muted-foreground">Worker:</span>{' '}
                                {probeResult.status.worker.worker_concurrency ?? '—'} concurrent loops ·{' '}
                                {probeResult.status.worker.inflight_notifications ?? 0} in-flight
                              </li>
                            ) : null}
                            {probeResult.status.features ? (
                              <>
                                {probeResult.status.features.db_reachable !== undefined ? (
                                  <li>
                                    <span className="text-muted-foreground">Database (server):</span>{' '}
                                    <span
                                      className={
                                        probeResult.status.features.db_reachable
                                          ? 'text-green-600 dark:text-green-400'
                                          : 'text-amber-600 dark:text-amber-400'
                                      }
                                    >
                                      {probeResult.status.features.db_reachable ? 'reachable' : 'not reachable'}
                                    </span>
                                  </li>
                                ) : null}
                                <li>
                                  <span className="text-muted-foreground">Firebase Admin (server):</span>{' '}
                                  {probeResult.status.features.firebase_admin ? 'on' : 'off'}
                                </li>
                                <li>
                                  <span className="text-muted-foreground">Email (Resend):</span>{' '}
                                  {probeResult.status.features.email_via_resend ? 'on' : 'off'}
                                </li>
                                <li>
                                  <span className="text-muted-foreground">WebView ZIP builds:</span>{' '}
                                  {probeResult.status.features.webview_zip_pipeline ? 'on' : 'off'}
                                </li>
                                <li>
                                  <span className="text-muted-foreground">Gradle APK on host:</span>{' '}
                                  {probeResult.status.features.apk_gradle_pipeline ? 'on' : 'off'}
                                </li>
                                {!probeResult.status.features.apk_gradle_pipeline &&
                                probeResult.status.features.apk_pipeline_hint ? (
                                  <li className="text-muted-foreground">
                                    APK: {probeResult.status.features.apk_pipeline_hint}
                                  </li>
                                ) : null}
                              </>
                            ) : null}
                          </ul>
                        ) : (
                          <p className="text-green-600 dark:text-green-400">
                            Health OK
                            {probeResult.service ? ` (${probeResult.service})` : ''}. This host does not expose{' '}
                            <span className="font-mono text-xs">/api/status</span> — upgrade API or use apkzio-local-api.
                          </p>
                        )
                      ) : (
                        <p className="text-destructive">{probeResult.message}</p>
                      )}
                    </div>
                  ) : null}
                </div>

                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="mb-4 font-semibold">Status</h3>
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Active API base</span>
                      <span className="font-mono text-xs break-all text-right">{getApiBaseUrl()}</span>
                    </li>
                    <li className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Firebase (sign-in / push)</span>
                      <span className={firebaseConfigured ? 'text-green-600 dark:text-green-400' : 'text-amber-600'}>
                        {firebaseConfigured ? 'Configured at build (VITE_FIREBASE_*)' : 'Not set in this build'}
                      </span>
                    </li>
                  </ul>
                  <div className="mt-4 border-t border-border pt-4">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Current API (auto-checked)
                    </p>
                    {liveBusy ? (
                      <p className="text-sm text-muted-foreground">Checking…</p>
                    ) : liveProbe?.ok && liveProbe.source === 'status' ? (
                      <ul className="space-y-1 text-[13px] text-muted-foreground">
                        <li>
                          Backend: <span className="text-foreground">{liveProbe.status.service}</span> ·{' '}
                          {liveProbe.status.persistence ?? '—'}
                          {liveProbe.status.role ? ` · ${liveProbe.status.role}` : ''}
                        </li>
                        {liveProbe.status.features?.db_reachable !== undefined ? (
                          <li>
                            Database:{' '}
                            <span
                              className={
                                liveProbe.status.features.db_reachable
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }
                            >
                              {liveProbe.status.features.db_reachable ? 'reachable' : 'not reachable'}
                            </span>
                          </li>
                        ) : null}
                        <li>
                          Server Firebase Admin: {liveProbe.status.features?.firebase_admin ? 'on' : 'off'} · Gradle APK:{' '}
                          {liveProbe.status.features?.apk_gradle_pipeline ? 'on' : 'off'}
                        </li>
                      </ul>
                    ) : liveProbe?.ok && liveProbe.source === 'health' ? (
                      <p className="text-[13px] text-muted-foreground">
                        Reachable via <span className="font-mono text-xs">/health</span> only.
                      </p>
                    ) : liveProbe && !liveProbe.ok ? (
                      <p className="text-[13px] text-destructive">{liveProbe.message}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            )}

            {tab === 'notifications' && (
              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="mb-4">Notification Preferences</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-muted/30">
                    <div>
                      <p className="font-medium">Browser Push Notifications</p>
                      <p className="text-sm text-muted-foreground">Enable push alerts for build status updates on this device.</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pushBusy}
                      onClick={async () => {
                        setPushBusy(true);
                        try {
                          const token = await registerBrowserPushToken();
                          if (!token) {
                            toast.error('Could not enable push on this device. Check browser permissions and Firebase VAPID key.');
                            return;
                          }
                          await registerMyPushToken(token);
                          toast.success('Push notifications enabled');
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : 'Could not enable push notifications.');
                        } finally {
                          setPushBusy(false);
                        }
                      }}
                    >
                      Enable
                    </Button>
                  </div>
                  {[
                    { label: 'Build Completed', desc: 'Get notified when a build finishes', def: true },
                    { label: 'Build Failed', desc: 'Get alerts on build errors', def: true },
                    { label: 'Subscription Renewals', desc: 'Reminders before renewal', def: true },
                    { label: 'New Features', desc: 'Product announcements and updates', def: false },
                    { label: 'Marketing Emails', desc: 'Tips, news and promotions', def: false },
                  ].map((n) => (
                    <div key={n.label} className="flex items-center justify-between p-4 rounded-xl bg-muted/30">
                      <div>
                        <p className="font-medium">{n.label}</p>
                        <p className="text-sm text-muted-foreground">{n.desc}</p>
                      </div>
                      <Switch defaultChecked={n.def} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'appearance' && (
              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="mb-4">Appearance</h3>
                <div className="space-y-4">
                  <div>
                    <Label>Theme</Label>
                    <div className="grid grid-cols-3 gap-3 mt-2">
                      {['Light', 'Dark', 'System'].map((t) => (
                        <button key={t} className="p-4 rounded-xl border-2 border-border hover:border-primary">
                          <div className={`h-16 rounded-lg mb-2 ${
                            t === 'Light' ? 'bg-white border' : t === 'Dark' ? 'bg-gray-900' : 'bg-gradient-to-br from-white to-gray-900'
                          }`} />
                          <p className="text-sm">{t}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Accent Color</Label>
                    <div className="flex gap-2 mt-2">
                      {['#7C3AED', '#EC4899', '#3B82F6', '#10B981', '#F59E0B'].map((c) => (
                        <button key={c} style={{ background: c }} className="w-10 h-10 rounded-full ring-2 ring-offset-2 ring-transparent hover:ring-primary" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'security' && (
              <div className="space-y-6">
                <div className="bg-card border border-border rounded-2xl p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Key className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">Two-Factor Authentication</p>
                        <p className="text-sm text-muted-foreground">Add extra security to your account</p>
                      </div>
                    </div>
                    <Switch />
                  </div>
                </div>
                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="mb-2 font-semibold">Active Sessions</h3>
                  <p className="text-sm text-muted-foreground">
                    Your current browser session is signed in. Per-device session listing will
                    appear here once we ship multi-device session management.
                  </p>
                </div>
              </div>
            )}

            {tab === 'language' && (
              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="mb-4">Language & Region</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Language</Label>
                    <select className="w-full px-3 py-2 rounded-lg border border-border bg-background">
                      <option>English (US)</option>
                      <option>Español</option>
                      <option>Français</option>
                      <option>Deutsch</option>
                      <option>日本語</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Time Zone</Label>
                    <select className="w-full px-3 py-2 rounded-lg border border-border bg-background">
                      <option>(GMT-08:00) Pacific Time</option>
                      <option>(GMT-05:00) Eastern Time</option>
                      <option>(GMT+00:00) UTC</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
