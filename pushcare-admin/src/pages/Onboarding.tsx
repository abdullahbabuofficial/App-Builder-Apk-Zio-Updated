import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { usePushcare } from "@/context/PushcareDataContext";
import { PUSHCARE_API_URL } from "@/lib/config";

const STEPS = [
  { key: "create", label: "Create app",      icon: "Layers" as const },
  { key: "key",    label: "App key",         icon: "Key"    as const },
  { key: "fcm",    label: "Connect Firebase", icon: "Globe"  as const },
  { key: "push",   label: "First push",      icon: "Send"   as const },
];

const STORAGE_KEY = "pc_onboarding_v1";

type Saved = {
  step: number;
  appId?: string | null;
  appKey?: string | null;
  packageName?: string;
  appName?: string;
  fcmConnected?: boolean;
};

function loadSaved(): Saved | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function saveProgress(s: Saved): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

async function postCreateApp(payload: { package_name: string; app_name: string }, token: string | null): Promise<{
  id: string;
  app_key: string;
} | null> {
  if (!PUSHCARE_API_URL) return null;
  const res = await fetch(`${PUSHCARE_API_URL}/api/apps`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { app?: { id?: string; app_key?: string } };
  if (!data.app?.id || !data.app.app_key) return null;
  return { id: data.app.id, app_key: data.app.app_key };
}

async function patchAppFcm(appId: string, fcmJson: string, token: string | null): Promise<void> {
  if (!PUSHCARE_API_URL) return;
  let parsed: { project_id?: string } = {};
  try {
    parsed = JSON.parse(fcmJson) as { project_id?: string };
  } catch {
    throw new Error("Service-account JSON is invalid");
  }
  const res = await fetch(`${PUSHCARE_API_URL}/api/apps/${encodeURIComponent(appId)}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      fcm_credentials: parsed,
      fcm_project_id: parsed.project_id ?? null,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
}

export function Onboarding() {
  const navigate = useNavigate();
  const { apps, createCampaign, refresh, dataSource, loading } = usePushcare();
  const [saved] = useState<Saved | null>(() => loadSaved());
  const [step, setStep] = useState(saved?.step ?? 0);
  const [packageName, setPackageName] = useState(saved?.packageName ?? "");
  const [appName, setAppName] = useState(saved?.appName ?? "");
  const [appId, setAppId] = useState<string | null>(saved?.appId ?? null);
  const [appKey, setAppKey] = useState<string | null>(saved?.appKey ?? null);
  const [fcmJson, setFcmJson] = useState("");
  const [pushTitle, setPushTitle] = useState("Welcome to your first push");
  const [pushBody, setPushBody] = useState("Tap to open the app and explore.");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // If user already has apps, exit onboarding (unless mid-flow with localStorage state).
  useEffect(() => {
    if (loading) return;
    if (apps.length > 0 && saved === null) {
      navigate("/dashboard", { replace: true });
    }
  }, [apps, loading, saved, navigate]);

  useEffect(() => {
    saveProgress({ step, appId, appKey, packageName, appName });
  }, [step, appId, appKey, packageName, appName]);

  const currentApp = useMemo(() => apps.find((a) => a.id === appId), [apps, appId]);

  function gotoStep(i: number) {
    setStep(Math.max(0, Math.min(STEPS.length - 1, i)));
    setErr(null);
  }

  async function handleCreateApp() {
    setErr(null);
    if (!packageName.trim() || !appName.trim()) {
      setErr("Both package name and app name are required.");
      return;
    }
    setBusy(true);
    try {
      // Try the live API when available; otherwise synthesize for mock mode.
      if (dataSource === "rest") {
        const out = await postCreateApp(
          { package_name: packageName.trim(), app_name: appName.trim() },
          null, // token already attached by api.ts in app calls; here we use plain fetch
        );
        if (out) {
          setAppId(out.id);
          setAppKey(out.app_key);
        } else {
          throw new Error("API did not return the new app");
        }
        await refresh();
      } else {
        const id = `app_${Math.random().toString(36).slice(2, 10)}`;
        const key = `pk_test_${Math.random().toString(36).slice(2, 14)}${Math.random()
          .toString(36)
          .slice(2, 10)}`;
        setAppId(id);
        setAppKey(key);
      }
      gotoStep(1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create app");
    } finally {
      setBusy(false);
    }
  }

  async function copyKey() {
    if (!appKey) return;
    try {
      await navigator.clipboard.writeText(appKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  async function handleConnectFcm() {
    setErr(null);
    if (!appId) {
      gotoStep(0);
      return;
    }
    if (!fcmJson.trim()) {
      // Skip
      gotoStep(3);
      return;
    }
    setBusy(true);
    try {
      if (dataSource === "rest") {
        await patchAppFcm(appId, fcmJson.trim(), null);
      }
      gotoStep(3);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save Firebase credentials");
    } finally {
      setBusy(false);
    }
  }

  async function handleSendPush() {
    setErr(null);
    if (!appId) {
      gotoStep(0);
      return;
    }
    setBusy(true);
    try {
      // currentApp may be undefined in REST mode if refresh hasn't completed; createCampaign
      // accepts a string app_id and the data layer will resolve owner.
      const targetAppId = currentApp?.id ?? appId;
      await createCampaign({
        app_id: targetAppId,
        title: pushTitle,
        body: pushBody,
        target_type: "all",
        scheduled_at: null,
      });
      // Clear local progress on success and head to dashboard.
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      navigate("/dashboard");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not send push");
    } finally {
      setBusy(false);
    }
  }

  function clearAndExit() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    navigate("/dashboard");
  }

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-bone-low">
            Step {step + 1} of {STEPS.length}
          </span>
        }
        title="Welcome to PushCare"
        description="A four-step setup gets your first push to a real device."
        actions={
          <Button variant="ghost" leading={<Icon.X size={14} />} onClick={clearAndExit}>
            Skip for now
          </Button>
        }
      />

      {/* Stepper */}
      <Card className="mb-6">
        <div className="grid grid-cols-1 divide-y divide-line-1 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          {STEPS.map((s, i) => {
            const Ic = Icon[s.icon];
            const status: "done" | "active" | "todo" = i < step ? "done" : i === step ? "active" : "todo";
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => i <= step && gotoStep(i)}
                disabled={i > step}
                className={cn(
                  "flex items-center gap-3 px-4 py-3.5 text-left transition-colors",
                  i <= step ? "hover:bg-ink-2/60" : "cursor-not-allowed opacity-60",
                )}
              >
                <span
                  className={cn(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-full border font-mono text-[12px] font-medium tabular-nums",
                    status === "done" && "border-signal/40 bg-signal/15 text-signal",
                    status === "active" && "border-signal bg-signal text-ink-0",
                    status === "todo" && "border-line-2 bg-ink-2 text-bone-low",
                  )}
                >
                  {status === "done" ? <Icon.Check size={14} /> : i + 1}
                </span>
                <div className="min-w-0">
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-low">Step {i + 1}</div>
                  <div className={cn("text-[13px] font-medium", status === "active" ? "text-bone" : "text-bone-mid")}>
                    {s.label}
                  </div>
                </div>
                <Ic size={14} className={cn("ml-auto shrink-0", status === "active" ? "text-signal" : "text-bone-low")} />
              </button>
            );
          })}
        </div>
      </Card>

      {/* Step content */}
      {step === 0 && (
        <Card>
          <CardHeader title="Create your first app" description="Each app maps to one Android package." />
          <CardBody className="space-y-5">
            <Field label="App name" required>
              <Input value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="Acme News" />
            </Field>
            <Field label="Package name" required hint="The exact value from your AndroidManifest.xml.">
              <Input
                value={packageName}
                onChange={(e) => setPackageName(e.target.value)}
                placeholder="io.acme.news"
                className="font-mono"
              />
            </Field>
            {err && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">{err}</div>
            )}
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] text-bone-low">You can rename this any time.</span>
              <Button
                variant="primary"
                trailing={<Icon.ArrowRight size={14} />}
                disabled={busy || !packageName.trim() || !appName.trim()}
                onClick={() => void handleCreateApp()}
              >
                {busy ? "Creating…" : "Create app"}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader
            title="Get your app key"
            description="Use this in your Android app's PushCare.init(...) call."
          />
          <CardBody className="space-y-5">
            <div className="rounded-lg border border-signal/30 bg-signal/5 p-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-low">App key</div>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 select-all rounded-md border border-line-1 bg-ink-0 px-3 py-2 font-mono text-[13px] text-bone">
                  {appKey ?? "—"}
                </code>
                <Button
                  variant="secondary"
                  size="md"
                  leading={<Icon.Copy size={13} />}
                  onClick={() => void copyKey()}
                  disabled={!appKey}
                >
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
            <div className="rounded-lg border border-line-1 bg-ink-2/40 p-4 text-[12.5px] leading-relaxed text-bone-mid">
              Keep this key in your Android source — it's safe to ship in the client. Server-side calls use a separate
              <span className="mx-1 rounded bg-ink-3 px-1.5 py-0.5 font-mono text-[11px] text-bone">sk_…</span>
              secret you'll find under <Link to="/keys" className="text-signal hover:underline">API Keys</Link>.
            </div>
            <div className="flex items-center justify-between">
              <Button variant="ghost" leading={<Icon.ArrowLeft size={14} />} onClick={() => gotoStep(0)}>Back</Button>
              <Button variant="primary" trailing={<Icon.ArrowRight size={14} />} onClick={() => gotoStep(2)}>
                Continue
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader
            title="Connect Firebase"
            description="Paste your Firebase service account JSON to enable real deliveries. You can do this later from app settings."
          />
          <CardBody className="space-y-5">
            <Field
              label="Service account JSON"
              hint="Download from Firebase Console → Project settings → Service accounts → Generate new private key."
            >
              <Textarea
                value={fcmJson}
                onChange={(e) => setFcmJson(e.target.value)}
                rows={10}
                placeholder={`{\n  "type": "service_account",\n  "project_id": "your-project",\n  …\n}`}
                className="font-mono text-[12px]"
              />
            </Field>
            {err && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">{err}</div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="ghost" leading={<Icon.ArrowLeft size={14} />} onClick={() => gotoStep(1)}>Back</Button>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => gotoStep(3)}>Skip</Button>
                <Button
                  variant="primary"
                  trailing={<Icon.ArrowRight size={14} />}
                  onClick={() => void handleConnectFcm()}
                  disabled={busy}
                >
                  {fcmJson.trim() ? "Save & continue" : "Continue without FCM"}
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader title="Send your first push" description="A test send to all devices for this app." />
          <CardBody className="space-y-5">
            <Field label="Title" required>
              <Input value={pushTitle} onChange={(e) => setPushTitle(e.target.value)} maxLength={120} />
            </Field>
            <Field label="Body" required>
              <Textarea value={pushBody} onChange={(e) => setPushBody(e.target.value)} rows={3} maxLength={300} />
            </Field>
            {err && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">{err}</div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="ghost" leading={<Icon.ArrowLeft size={14} />} onClick={() => gotoStep(2)}>Back</Button>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={clearAndExit}>Skip & finish</Button>
                <Button
                  variant="primary"
                  leading={<Icon.Send size={14} />}
                  onClick={() => void handleSendPush()}
                  disabled={busy || !pushTitle.trim() || !pushBody.trim()}
                >
                  {busy ? "Sending…" : "Send push"}
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      <Card className="mt-6">
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-md border border-signal/30 bg-signal/10 text-signal">
              <Icon.Sparkles size={14} />
            </span>
            <div className="text-[12px] text-bone-mid">
              You can leave at any time — your progress is saved on this device.
            </div>
          </div>
          <Button variant="secondary" trailing={<Icon.ArrowRight size={13} />} onClick={clearAndExit}>
            Go to dashboard
          </Button>
        </CardBody>
      </Card>
    </>
  );
}
