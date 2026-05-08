import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, BatteryFull, Bell, CheckCircle2, ChevronLeft, ChevronRight, Download,
  ExternalLink, Globe, Home, Image, Loader2, LockKeyhole, Palette, RefreshCw, Rocket,
  ShieldCheck, SignalHigh, Smartphone, Sparkles, Square, Upload, Wifi, WifiOff, Zap,
} from 'lucide-react';
import { Header } from '../../components/header';
import { Footer } from '../../components/footer';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Switch } from '../../components/ui/switch';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import {
  getApiBaseUrl,
  BuilderApiError,
  getBuilderBuild,
  submitBuilderBuild,
  type BuilderBuild,
  type BuilderApiErrorCode,
} from '../../lib/api';
import { Link } from '../../components/router';
import { useAuth } from '../../contexts/auth-context';

type FormState = {
  websiteUrl: string;
  appName: string;
  packageName: string;
  description: string;
  primaryColor: string;
  accentColor: string;
  iconDataUrl: string | null;
  iconName: string | null;
  splashStyle: string;
  orientation: string;
  pullToRefresh: boolean;
  pushNotifications: boolean;
  offlineMode: boolean;
  statusBarStyle: string;
  buildType: string;
  versionCode: string;
  versionName: string;
};

type GeneratedIcon = {
  name: string;
  path: string;
  size: number;
  density: string;
  purpose: string;
  dataUrl: string;
};

const iconTargets = [
  { name: 'ic_launcher.png', path: 'res/mipmap-mdpi/ic_launcher.png', size: 48, density: 'mdpi', purpose: 'legacy launcher' },
  { name: 'ic_launcher.png', path: 'res/mipmap-hdpi/ic_launcher.png', size: 72, density: 'hdpi', purpose: 'legacy launcher' },
  { name: 'ic_launcher.png', path: 'res/mipmap-xhdpi/ic_launcher.png', size: 96, density: 'xhdpi', purpose: 'legacy launcher' },
  { name: 'ic_launcher.png', path: 'res/mipmap-xxhdpi/ic_launcher.png', size: 144, density: 'xxhdpi', purpose: 'legacy launcher' },
  { name: 'ic_launcher.png', path: 'res/mipmap-xxxhdpi/ic_launcher.png', size: 192, density: 'xxxhdpi', purpose: 'legacy launcher' },
  { name: 'ic_launcher_round.png', path: 'res/mipmap-mdpi/ic_launcher_round.png', size: 48, density: 'mdpi', purpose: 'round launcher' },
  { name: 'ic_launcher_round.png', path: 'res/mipmap-hdpi/ic_launcher_round.png', size: 72, density: 'hdpi', purpose: 'round launcher' },
  { name: 'ic_launcher_round.png', path: 'res/mipmap-xhdpi/ic_launcher_round.png', size: 96, density: 'xhdpi', purpose: 'round launcher' },
  { name: 'ic_launcher_round.png', path: 'res/mipmap-xxhdpi/ic_launcher_round.png', size: 144, density: 'xxhdpi', purpose: 'round launcher' },
  { name: 'ic_launcher_round.png', path: 'res/mipmap-xxxhdpi/ic_launcher_round.png', size: 192, density: 'xxxhdpi', purpose: 'round launcher' },
  { name: 'ic_launcher_foreground.png', path: 'res/mipmap-xxxhdpi/ic_launcher_foreground.png', size: 432, density: 'xxxhdpi', purpose: 'adaptive foreground' },
  { name: 'ic_splash_brand.png', path: 'res/drawable-nodpi/ic_splash_brand.png', size: 512, density: 'nodpi', purpose: 'splash icon' },
  { name: 'ic_launcher-playstore.png', path: 'src/main/ic_launcher-playstore.png', size: 512, density: 'play', purpose: 'Play Store icon' },
] as const;

async function generateIconAssets(file: File, background: string): Promise<{ source: string; assets: GeneratedIcon[] }> {
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read logo file.'));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not prepare logo image.'));
    img.src = source;
  });

  const draw = (target: typeof iconTargets[number]) => {
    const canvas = document.createElement('canvas');
    canvas.width = target.size;
    canvas.height = target.size;
    const ctx = canvas.getContext('2d')!;
    const radius = target.purpose.includes('round') ? target.size / 2 : Math.max(10, target.size * 0.2);

    ctx.fillStyle = background;
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.arcTo(target.size, 0, target.size, target.size, radius);
    ctx.arcTo(target.size, target.size, 0, target.size, radius);
    ctx.arcTo(0, target.size, 0, 0, radius);
    ctx.arcTo(0, 0, target.size, 0, radius);
    ctx.closePath();
    ctx.fill();

    const pad = target.purpose.includes('adaptive') ? target.size * 0.18 : target.size * 0.14;
    const box = target.size - pad * 2;
    const scale = Math.min(box / image.width, box / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    ctx.drawImage(image, (target.size - w) / 2, (target.size - h) / 2, w, h);
    return {
      ...target,
      dataUrl: canvas.toDataURL('image/png'),
    };
  };

  return { source, assets: iconTargets.map(draw) };
}

const initialState: FormState = {
  websiteUrl: '',
  appName: '',
  packageName: '',
  description: '',
  primaryColor: '#14B8A6',
  accentColor: '#F97316',
  iconDataUrl: null,
  iconName: null,
  splashStyle: 'gradient',
  orientation: 'portrait',
  pullToRefresh: true,
  pushNotifications: true,
  offlineMode: false,
  statusBarStyle: 'dark',
  buildType: 'APK',
  versionCode: '1',
  versionName: '1.0.0',
};

// Derive a reasonable Android applicationId from the typed URL (and app name as
// a fallback). Returns '' when neither input has anything usable yet — so the
// form starts empty instead of fighting the user with placeholders.
function safePackageName(url: string, appName: string) {
  let host = '';
  try {
    const trimmed = url.trim();
    if (trimmed) {
      host = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
        .hostname.replace(/^www\./, '');
    }
  } catch {
    host = '';
  }
  const fromHost = host.replace(/[^a-z0-9]+/gi, '.').replace(/^\.+|\.+$/g, '').toLowerCase();
  if (fromHost && fromHost.includes('.')) return `com.${fromHost}`.replace(/\.+/g, '.');
  const fromName = (appName || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  return fromName ? `com.${fromName}.app` : '';
}

function hostFromUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return '';
  try {
    return new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
      .hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// Resolve a user-typed value (e.g. "example.com", "https://example.com/") into
// a URL that's safe to feed an <iframe>. Returns null if the input doesn't look
// like a real http(s) URL yet — we don't want to slam the iframe with bogus
// loads while the user is still typing.
function normalizeWebsiteUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  // Reject obvious junk and intra-form placeholders.
  if (v === 'https://' || v === 'http://') return null;
  const candidate = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(candidate);
    if (!u.hostname) return null;
    // Require at least one dot in the hostname so "abc" doesn't trigger loads.
    if (!u.hostname.includes('.')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

// Pick a readable foreground for a given hex background.
function readableOn(hex: string): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#0B1220';
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 160 ? '#0B1220' : '#FFFFFF';
}

function AppPreview({ form }: { form: FormState }) {
  const host = hostFromUrl(form.websiteUrl);
  const brandStyle = { background: `linear-gradient(135deg, ${form.primaryColor}, ${form.accentColor})` };
  const splashStyle =
    form.splashStyle === 'solid'
      ? { background: form.primaryColor }
      : form.splashStyle === 'minimal'
        ? { background: '#0B1220' }
        : brandStyle;

  // Status bar tint follows the user's pick.
  const statusBarFg = form.statusBarStyle === 'light' ? '#FFFFFF' : '#0B1220';

  // Debounce raw form.websiteUrl into a "ready to load" preview URL so fast
  // typing doesn't reload the iframe on every keystroke.
  const [previewUrl, setPreviewUrl] = useState<string | null>(() =>
    normalizeWebsiteUrl(form.websiteUrl),
  );
  useEffect(() => {
    const handle = window.setTimeout(() => {
      setPreviewUrl(normalizeWebsiteUrl(form.websiteUrl));
    }, 350);
    return () => window.clearTimeout(handle);
  }, [form.websiteUrl]);

  // The iframe gets a key composed of the URL + a manual reload counter so
  // remounts happen cleanly on URL change and on Reload click.
  const [reloadCounter, setReloadCounter] = useState(0);
  const iframeKey = previewUrl ? `${previewUrl}#${reloadCounter}` : 'splash';

  // Track whether the iframe successfully loaded so we can fade the splash
  // overlay. Cross-origin iframes don't reliably fire onerror, so we also
  // arm a 6s timeout that flips to "blocked" if onLoad never fires.
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const blockedTimerRef = useRef<number | null>(null);
  useEffect(() => {
    setIframeLoaded(false);
    setIframeBlocked(false);
    if (!previewUrl) return;
    if (blockedTimerRef.current) window.clearTimeout(blockedTimerRef.current);
    blockedTimerRef.current = window.setTimeout(() => {
      setIframeBlocked((prev) => (prev || !iframeLoaded));
    }, 6000);
    return () => {
      if (blockedTimerRef.current) window.clearTimeout(blockedTimerRef.current);
    };
    // We deliberately don't depend on iframeLoaded here — the timer is armed
    // each time the URL changes and disarmed inside onLoad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iframeKey, previewUrl]);

  const onIframeLoad = () => {
    setIframeLoaded(true);
    setIframeBlocked(false);
    if (blockedTimerRef.current) {
      window.clearTimeout(blockedTimerRef.current);
      blockedTimerRef.current = null;
    }
  };

  const onReload = () => setReloadCounter((n) => n + 1);

  // Landscape preview rotates the inner aspect ratio.
  const aspectClass =
    form.orientation === 'landscape' ? 'aspect-[19.3/9]' : 'aspect-[9/19.3]';

  // Initials fallback for the launcher icon.
  const initials = (form.appName || 'App')
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'AP';

  return (
    <div className="lg:sticky lg:top-24">
      <div className="mx-auto w-full max-w-[390px]">
        <div className="relative rounded-[2.6rem] bg-[#0A0F1D] p-2 shadow-[0_28px_90px_rgba(2,6,23,0.34)] ring-1 ring-white/10">
          <div className="absolute -left-1 top-28 h-14 w-1 rounded-l bg-[#151B2A]" />
          <div className="absolute -right-1 top-36 h-20 w-1 rounded-r bg-[#151B2A]" />
          <div className="absolute left-1/2 top-3 z-30 h-6 w-28 -translate-x-1/2 rounded-full bg-[#05070D]" />

          <div className={`relative ${aspectClass} overflow-hidden rounded-[2.15rem] bg-[#0B1220]`}>
            {/* Status bar */}
            <div
              className="absolute inset-x-0 top-0 z-20 flex h-9 items-center justify-between px-7 text-[11px] font-semibold"
              style={{ color: statusBarFg }}
            >
              <span>9:41</span>
              <div className="flex items-center gap-1.5">
                <SignalHigh className="h-3.5 w-3.5" />
                {form.offlineMode ? <WifiOff className="h-3.5 w-3.5 opacity-70" /> : <Wifi className="h-3.5 w-3.5" />}
                <BatteryFull className="h-4 w-4" />
              </div>
            </div>

            <div className="flex h-full flex-col bg-background pt-9">
              {/* App-shell header. We only paint the branded title bar once
                  the user has typed a name or URL — otherwise the preview
                  shows a clean marketing card instead of a fake "Your App".  */}
              {(form.appName || host) && (
                <div
                  className="flex items-center gap-2 px-3 pb-2 pt-1"
                  style={{ background: form.primaryColor, color: readableOn(form.primaryColor) }}
                >
                  <div className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-lg bg-white/95 text-[11px] font-bold text-slate-950 shadow">
                    {form.iconDataUrl ? (
                      <img src={form.iconDataUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      initials
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    {form.appName && (
                      <div className="truncate text-[12px] font-semibold">{form.appName}</div>
                    )}
                    {host && (
                      <div className="mt-0.5 flex items-center gap-1 truncate text-[10px] opacity-85">
                        <LockKeyhole className="h-3 w-3" />
                        <span className="truncate">{host}</span>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={onReload}
                    className="grid h-7 w-7 place-items-center rounded-md bg-white/15 hover:bg-white/25"
                    aria-label="Reload preview"
                    title="Reload preview"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${previewUrl && !iframeLoaded ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              )}

              {/* Body — actual website iframe with branded splash overlay until load */}
              <div className="relative flex-1 overflow-hidden bg-white">
                {previewUrl ? (
                  <iframe
                    key={iframeKey}
                    src={previewUrl}
                    title={`${form.appName || 'WebView'} preview`}
                    referrerPolicy="no-referrer"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                    onLoad={onIframeLoad}
                    className="absolute inset-0 h-full w-full border-0 bg-white"
                  />
                ) : (
                  // Empty state — branded marketing card. No "example.com" or
                  // fake screenshots; this should *sell* the builder, not
                  // double as a Chrome tab.
                  <div className="absolute inset-0 overflow-hidden" style={splashStyle}>
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0))]" />
                    <div className="relative flex h-full flex-col items-center justify-between px-5 py-6 text-center text-white">
                      <div className="flex flex-col items-center gap-3">
                        <div className="grid h-14 w-14 place-items-center rounded-[1.15rem] bg-white/95 text-slate-950 shadow-xl">
                          <Smartphone className="h-7 w-7" />
                        </div>
                        <div className="space-y-1">
                          <div className="text-[15px] font-semibold leading-tight">Your website. Your app.</div>
                          <div className="text-[11px] opacity-85">Live preview appears here as you type.</div>
                        </div>
                      </div>
                      <div className="grid w-full grid-cols-1 gap-1.5 text-[10.5px]">
                        <div className="flex items-center gap-2 rounded-md bg-white/12 px-2 py-1.5 backdrop-blur">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          <span>Free signed APK / AAB</span>
                        </div>
                        <div className="flex items-center gap-2 rounded-md bg-white/12 px-2 py-1.5 backdrop-blur">
                          <Bell className="h-3.5 w-3.5" />
                          <span>Push notifications, ready to send</span>
                        </div>
                        <div className="flex items-center gap-2 rounded-md bg-white/12 px-2 py-1.5 backdrop-blur">
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Custom icon, splash, and theme</span>
                        </div>
                      </div>
                      <div className="text-[10px] opacity-80">Step 1 — paste your website URL on the left.</div>
                    </div>
                  </div>
                )}

                {/* Splash overlay — fades out once the iframe loads. */}
                {previewUrl && !iframeLoaded && !iframeBlocked && (
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center text-white"
                    style={splashStyle}
                  >
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0))]" />
                    <div className="relative flex flex-col items-center gap-3 px-6 text-center">
                      <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-[1.25rem] bg-white text-xl font-bold text-slate-950 shadow-xl">
                        {form.iconDataUrl ? (
                          <img src={form.iconDataUrl} alt="" className="h-full w-full object-cover" />
                        ) : form.appName ? (
                          initials
                        ) : (
                          <Smartphone className="h-7 w-7" />
                        )}
                      </div>
                      {form.appName && (
                        <div className="text-base font-semibold leading-tight">{form.appName}</div>
                      )}
                      <div className="flex items-center gap-2 text-[11px] opacity-90">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Loading{host ? ` ${host}` : ''}…</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Embed-blocked fallback. Many sites set X-Frame-Options or
                   strict CSP frame-ancestors and the iframe never finishes. */}
                {previewUrl && iframeBlocked && !iframeLoaded && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/95 px-5 text-center">
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-muted/30">
                      <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="text-[12px] font-medium">This site blocks embedding</div>
                    <p className="text-[11px] text-muted-foreground">
                      X-Frame-Options or CSP prevents the in-browser preview. The packaged Android WebView is not affected.
                    </p>
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-1 inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground"
                    >
                      <ExternalLink className="h-3 w-3" /> Open in new tab
                    </a>
                  </div>
                )}

                {/* Offline mode preview — translucent overlay with branded copy. */}
                {form.offlineMode && previewUrl && iframeLoaded && (
                  <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center pt-1">
                    <span className="rounded-full bg-foreground/80 px-2 py-0.5 text-[10px] text-background">
                      Offline fallback armed
                    </span>
                  </div>
                )}
              </div>

              {/* System nav */}
              <div className="border-t border-border bg-card px-10 py-3">
                <div className="flex items-center justify-between text-muted-foreground">
                  <ArrowLeft className="h-4 w-4" />
                  <Home className="h-4 w-4" />
                  <Square className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px]">
          <div className="rounded-md border border-border bg-card p-2">
            <div className="font-semibold">{form.buildType}</div>
            <div className="text-muted-foreground">output</div>
          </div>
          <div className="rounded-md border border-border bg-card p-2">
            <div className="font-semibold capitalize">{form.orientation}</div>
            <div className="text-muted-foreground">layout</div>
          </div>
          <div className="rounded-md border border-border bg-card p-2">
            <div className="font-semibold capitalize">{form.statusBarStyle}</div>
            <div className="text-muted-foreground">bars</div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className={`inline-block h-2 w-2 rounded-full ${previewUrl ? (iframeLoaded ? 'bg-success' : iframeBlocked ? 'bg-yellow-500' : 'bg-primary animate-pulse') : 'bg-muted-foreground/40'}`} />
            <span>
              {!previewUrl
                ? 'Paste your website URL to start'
                : iframeLoaded
                  ? 'Live preview ready'
                  : iframeBlocked
                    ? 'Embed blocked by site'
                    : 'Loading preview…'}
            </span>
          </div>
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> Open
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

type SubmitErrorState =
  | { code: BuilderApiErrorCode; message: string; recoverable: boolean }
  | { code: 'validation'; message: string; recoverable: false }
  | null;

const PENDING_BUILD_STORAGE_KEY = 'apkzio.builder.pending';

export function CreateAppPage() {
  const { isAuthenticated } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BuilderBuild | null>(null);
  const [error, setError] = useState<SubmitErrorState>(null);
  const [generatedIcons, setGeneratedIcons] = useState<GeneratedIcon[]>([]);
  const [pollError, setPollError] = useState<string | null>(null);

  // Poll the build until it leaves the queued/building state so the success
  // card can swap in the real Download buttons.
  useEffect(() => {
    if (!result) return;
    if (result.build_status !== 'queued' && result.build_status !== 'building') return;
    let cancelled = false;
    let attempts = 0;
    const tick = async () => {
      if (cancelled) return;
      attempts += 1;
      try {
        const next = await getBuilderBuild(result.build_id);
        if (cancelled) return;
        setPollError(null);
        setResult(next);
      } catch (e) {
        if (cancelled) return;
        setPollError(e instanceof Error ? e.message : 'Could not refresh build status.');
      }
      // Stop after ~5 minutes (150 attempts × 2s) — Gradle should finish well
      // before that. We expose a manual Refresh button as a backstop.
      if (!cancelled && attempts < 150) {
        window.setTimeout(tick, 2000);
      }
    };
    const handle = window.setTimeout(tick, 2000);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [result]);

  const refreshBuildStatus = async () => {
    if (!result) return;
    try {
      const next = await getBuilderBuild(result.build_id);
      setResult(next);
      setPollError(null);
    } catch (e) {
      setPollError(e instanceof Error ? e.message : 'Could not refresh build status.');
    }
  };

  const steps = [
    { num: 1, label: 'Website', icon: Globe },
    { num: 2, label: 'Branding', icon: Palette },
    { num: 3, label: 'Features', icon: Zap },
    { num: 4, label: 'Build', icon: Smartphone },
    { num: 5, label: 'Review', icon: Rocket },
  ];

  const canSubmit = useMemo(() => {
    return form.websiteUrl.trim().length > 8 && form.appName.trim().length > 1 && /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i.test(form.packageName);
  }, [form]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleUrl = (value: string) => {
    update('websiteUrl', value);
    if (!form.packageName || form.packageName === safePackageName(form.websiteUrl, form.appName)) {
      setForm((prev) => ({ ...prev, websiteUrl: value, packageName: safePackageName(value, prev.appName) }));
    }
  };

  const handleIcon = async (file?: File) => {
    if (!file) return;
    setError(null);
    try {
      const generated = await generateIconAssets(file, form.primaryColor);
      setGeneratedIcons(generated.assets);
      setForm((prev) => ({ ...prev, iconDataUrl: generated.source, iconName: file.name }));
    } catch (e) {
      setError({
        code: 'validation',
        message: e instanceof Error ? e.message : 'Could not generate app icons.',
        recoverable: false,
      });
    }
  };

  const submit = async () => {
    setError(null);
    if (!canSubmit) {
      setError({
        code: 'validation',
        message: 'Check your website URL, app name, and package name before building.',
        recoverable: false,
      });
      return;
    }
    setSubmitting(true);
    try {
      // The 13 base64 PNGs in `generatedIcons` are kept client-side for the
      // preview only — the backend regenerates them server-side from the
      // source logo. Sending them here used to push the request past 1 MB
      // and trigger a 413 that surfaced as "Failed to fetch" in the browser.
      // We send only the source icon (and its filename) plus the metadata
      // for each density so the server knows what was rendered locally.
      const build = await submitBuilderBuild({
        website_url: form.websiteUrl,
        app_name: form.appName,
        package_name: form.packageName,
        description: form.description,
        primary_color: form.primaryColor,
        accent_color: form.accentColor,
        icon_data_url: form.iconDataUrl,
        icon_name: form.iconName,
        icon_assets: generatedIcons.map((asset) => ({
          name: asset.name,
          path: asset.path,
          size: asset.size,
          density: asset.density,
          purpose: asset.purpose,
        })),
        splash_style: form.splashStyle,
        orientation: form.orientation,
        pull_to_refresh: form.pullToRefresh,
        offline_mode: form.offlineMode,
        push_notifications: form.pushNotifications,
        status_bar_style: form.statusBarStyle,
        build_type: form.buildType,
        version_code: Number(form.versionCode) || 1,
        version_name: form.versionName,
      });
      setResult(build);
      setStep(5);
      // Build accepted — no need to keep a pending payload around.
      try {
        window.localStorage?.removeItem(PENDING_BUILD_STORAGE_KEY);
      } catch {
        /* localStorage may be disabled — ignore */
      }
    } catch (e) {
      const apiErr = e instanceof BuilderApiError ? e : null;
      const code = apiErr?.code ?? 'server';
      const recoverable = code === 'network' || code === 'timeout' || code === 'server';
      const message = apiErr?.message
        ?? (e instanceof Error ? e.message : 'Build request failed.');

      // Preserve the user's work locally so a transient outage doesn't burn
      // their config. We strip the heavy icon data URLs before saving so we
      // stay well under any per-key localStorage quota.
      try {
        const safe = {
          savedAt: new Date().toISOString(),
          form: { ...form, iconDataUrl: form.iconDataUrl ? '__icon_omitted__' : null },
        };
        window.localStorage?.setItem(PENDING_BUILD_STORAGE_KEY, JSON.stringify(safe));
      } catch {
        /* over quota or disabled — fine */
      }

      setError({ code, message, recoverable });
      // Surface the error block on the Review step where it has space.
      setStep(5);
    } finally {
      setSubmitting(false);
    }
  };

  const buildBuildRequestMailto = () => {
    const subject = `Build request — ${form.appName || 'WebView'}`;
    const lines = [
      'Hi ApkZio team,',
      '',
      "I tried submitting a build on apkzio.com/builders but the request didn't go through. Here's my configuration:",
      '',
      `• App name: ${form.appName}`,
      `• Package: ${form.packageName}`,
      `• Website: ${form.websiteUrl}`,
      `• Version: ${form.versionName} (${form.versionCode})`,
      `• Build type: ${form.buildType}`,
      `• Primary color: ${form.primaryColor}`,
      `• Accent color: ${form.accentColor}`,
      `• Splash style: ${form.splashStyle}`,
      `• Orientation: ${form.orientation}`,
      `• Status bar: ${form.statusBarStyle}`,
      `• Pull-to-refresh: ${form.pullToRefresh ? 'yes' : 'no'}`,
      `• Push: ${form.pushNotifications ? 'yes' : 'no'}`,
      `• Offline fallback: ${form.offlineMode ? 'yes' : 'no'}`,
      '',
      form.description ? `Notes: ${form.description}` : '',
      '',
      'Thanks!',
    ].filter(Boolean);
    return `mailto:support@apkzio.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
      lines.join('\n'),
    )}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 lg:px-6 lg:py-12">
        <section className="mb-8 grid gap-6 xl:grid-cols-[1fr_400px] xl:items-end">
          <div>
            <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/10">Free public builder</Badge>
            <h1 className="max-w-4xl text-4xl font-semibold leading-tight tracking-normal md:text-6xl">
              Build a branded Android app from your website.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
              Create an account to track your builds and receive build status emails. You can also submit a free web-to-Android build request with custom logo, colors, splash style, and push-ready settings.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 rounded-lg border border-border bg-card p-4">
            {[
              ['Free', 'public queue'],
              ['APK/AAB', 'build types'],
              ['Push', 'ready shell'],
            ].map(([a, b]) => (
              <div key={a} className="rounded-md bg-muted/20 p-3 text-center">
                <div className="font-semibold">{a}</div>
                <div className="mt-1 text-xs text-muted-foreground">{b}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="space-y-5">
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Step {step} of {steps.length}</span>
                <span className="text-sm font-medium">{Math.round((step / steps.length) * 100)}% complete</span>
              </div>
              <Progress value={(step / steps.length) * 100} className="mb-5 h-2" />
              <div className="grid grid-cols-5 gap-2">
                {steps.map((s) => {
                  const Icon = s.icon;
                  const active = s.num === step;
                  const done = s.num < step || (result && s.num === 5);
                  return (
                    <button
                      key={s.num}
                      onClick={() => setStep(s.num)}
                      className={`rounded-md border p-3 text-center transition-all ${active ? 'border-primary bg-primary/10 text-primary' : done ? 'border-success/40 bg-success/10 text-success' : 'border-border bg-muted/10 hover:bg-muted/30'}`}
                    >
                      {done ? <CheckCircle2 className="mx-auto mb-1 h-5 w-5" /> : <Icon className="mx-auto mb-1 h-5 w-5" />}
                      <span className="block text-[11px]">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-5 md:p-7">
              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-2xl font-semibold">Website And App Identity</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Enter the website you want to wrap and the Android package identity.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label>Website URL</Label>
                      <Input value={form.websiteUrl} onChange={(e) => handleUrl(e.target.value)} placeholder="https://yourwebsite.com" />
                    </div>
                    <div className="space-y-2">
                      <Label>App Name</Label>
                      <Input value={form.appName} onChange={(e) => update('appName', e.target.value)} placeholder="Your App" />
                    </div>
                    <div className="space-y-2">
                      <Label>Package Name</Label>
                      <Input value={form.packageName} onChange={(e) => update('packageName', e.target.value.toLowerCase())} placeholder="com.company.app" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Description</Label>
                      <Textarea value={form.description} onChange={(e) => update('description', e.target.value)} rows={3} placeholder="Short store-ready app description" />
                    </div>
                  </div>
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <div className="mb-2 flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4 text-primary" /> Example app behavior</div>
                    <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                      <span>Browser-grade WebView settings</span>
                      <span>Popup and target blank support</span>
                      <span>Camera/gallery file uploads</span>
                      <span>DownloadManager with cookies</span>
                      <span>Offline fallback page</span>
                      <span>Cookie session persistence</span>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-2xl font-semibold">Logo, Theme, And Splash</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Customize the app shell users see before the website loads.</p>
                  </div>
                  <div className="grid gap-5 md:grid-cols-[220px_1fr]">
                    <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/10 p-6 text-center hover:border-primary">
                      {form.iconDataUrl ? (
                        <img src={form.iconDataUrl} alt="" className="mb-3 h-24 w-24 rounded-2xl object-cover shadow-md" />
                      ) : (
                        <Upload className="mb-3 h-9 w-9 text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium">{form.iconName || 'Upload app logo'}</span>
                      <span className="mt-1 text-xs text-muted-foreground">PNG/JPG, 512x512 preferred</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleIcon(e.target.files?.[0])} />
                    </label>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Primary Color</Label>
                        <div className="flex gap-2">
                          <input type="color" value={form.primaryColor} onChange={(e) => update('primaryColor', e.target.value)} className="h-10 w-14 rounded-md border border-border bg-card" />
                          <Input value={form.primaryColor} onChange={(e) => update('primaryColor', e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Accent Color</Label>
                        <div className="flex gap-2">
                          <input type="color" value={form.accentColor} onChange={(e) => update('accentColor', e.target.value)} className="h-10 w-14 rounded-md border border-border bg-card" />
                          <Input value={form.accentColor} onChange={(e) => update('accentColor', e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Splash Style</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {['gradient', 'solid', 'minimal'].map((style) => (
                            <button key={style} onClick={() => update('splashStyle', style)} className={`rounded-md border px-3 py-3 capitalize ${form.splashStyle === style ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}>
                              {style}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/10 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">Generated Android icon set</div>
                        <div className="text-xs text-muted-foreground">Matches the example WebView template resources.</div>
                      </div>
                      <Badge variant="outline">{generatedIcons.length || iconTargets.length} assets</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                      {(generatedIcons.length ? generatedIcons : iconTargets.slice(0, 10).map((target) => ({ ...target, dataUrl: '' }))).slice(0, 10).map((asset) => (
                        <div key={`${asset.path}-${asset.size}`} className="rounded-md border border-border bg-card p-2 text-center">
                          <div className="mx-auto grid h-12 w-12 place-items-center overflow-hidden rounded-lg" style={{ background: form.primaryColor }}>
                            {'dataUrl' in asset && asset.dataUrl ? <img src={asset.dataUrl} alt="" className="h-full w-full object-cover" /> : <Image className="h-5 w-5 text-white" />}
                          </div>
                          <div className="mt-2 text-[11px] font-medium">{asset.density}</div>
                          <div className="text-[10px] text-muted-foreground">{asset.size}x{asset.size}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-2xl font-semibold">App Features</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Pick the webview behavior for the Android shell.</p>
                  </div>
                  {[
                    ['pullToRefresh', 'Pull to refresh', 'Let users reload the current page with a native swipe.'],
                    ['pushNotifications', 'Push-ready app', 'Prepare the shell for ApkZio notifications and subscribers.'],
                    ['offlineMode', 'Offline fallback', 'Show a branded offline screen when the site is unreachable.'],
                  ].map(([key, title, desc]) => (
                    <div key={key} className="flex items-center justify-between rounded-lg border border-border p-4">
                      <div>
                        <div className="font-medium">{title}</div>
                        <div className="text-sm text-muted-foreground">{desc}</div>
                      </div>
                      <Switch checked={Boolean(form[key as keyof FormState])} onCheckedChange={(v) => update(key as keyof FormState, v as never)} />
                    </div>
                  ))}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Orientation</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {['portrait', 'landscape', 'auto'].map((value) => (
                          <button key={value} onClick={() => update('orientation', value)} className={`rounded-md border px-3 py-2 capitalize ${form.orientation === value ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}>{value}</button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Status Bar Icons</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {['dark', 'light'].map((value) => (
                          <button key={value} onClick={() => update('statusBarStyle', value)} className={`rounded-md border px-3 py-2 capitalize ${form.statusBarStyle === value ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}>{value}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-2xl font-semibold">Build Configuration</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Choose output type and version. Free builds enter the public queue.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {['APK', 'AAB'].map((type) => (
                      <button key={type} onClick={() => update('buildType', type)} className={`rounded-lg border p-5 text-left ${form.buildType === type ? 'border-primary bg-primary/10' : 'border-border'}`}>
                        <div className="flex items-center gap-3">
                          {type === 'APK' ? <Download className="h-5 w-5 text-primary" /> : <ShieldCheck className="h-5 w-5 text-primary" />}
                          <div>
                            <div className="font-semibold">{type}</div>
                            <div className="text-sm text-muted-foreground">{type === 'APK' ? 'Direct install package' : 'Play Store bundle format'}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Version Name</Label>
                      <Input value={form.versionName} onChange={(e) => update('versionName', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Version Code</Label>
                      <Input
                        inputMode="numeric"
                        value={form.versionCode}
                        onChange={(e) => update('versionCode', e.target.value.replace(/\D/g, ''))}
                        onBlur={() => {
                          if (!form.versionCode) update('versionCode', '1');
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-2xl font-semibold">{result ? 'Build Queued' : 'Review And Build'}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Confirm everything, then submit your free build request.</p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {[
                      ['Website', form.websiteUrl],
                      ['App', form.appName],
                      ['Package', form.packageName],
                      ['Version', `${form.versionName} (${form.versionCode})`],
                      ['Type', form.buildType],
                      ['Template', 'PakClub-style Kotlin WebView'],
                      ['Icons', `${generatedIcons.length || iconTargets.length} generated assets`],
                      ['Push', form.pushNotifications ? 'Enabled' : 'Disabled'],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-md border border-border bg-muted/10 p-3">
                        <div className="text-xs text-muted-foreground">{label}</div>
                        <div className="mt-1 truncate font-medium">{value}</div>
                      </div>
                    ))}
                  </div>
                  {result && (
                    <BuildResultCard
                      result={result}
                      pollError={pollError}
                      onRefresh={() => { void refreshBuildStatus(); }}
                      isAuthenticated={isAuthenticated}
                    />
                  )}
                  {error && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-5">
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-destructive/15 text-destructive">
                          <ShieldCheck className="h-4 w-4" />
                        </div>
                        <div className="flex-1 space-y-2 text-sm">
                          <div className="text-base font-semibold text-destructive">
                            {error.code === 'network'
                              ? "We couldn't reach the build service"
                              : error.code === 'timeout'
                                ? 'The build service is taking too long to respond'
                                : error.code === 'server'
                                  ? 'The build service hit an error'
                                  : error.code === 'validation'
                                    ? 'Please review your build details'
                                    : "Your build request wasn't accepted"}
                          </div>
                          <p className="text-muted-foreground">{error.message}</p>
                          {error.code !== 'validation' && (
                            <p className="text-xs text-muted-foreground">
                              Your configuration is saved on this device — you won't lose it if you reload the page.
                            </p>
                          )}
                          <div className="flex flex-wrap gap-2 pt-1">
                            {error.code !== 'validation' && error.recoverable && (
                              <Button
                                size="sm"
                                onClick={() => { void submit(); }}
                                disabled={submitting}
                                className="bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                              >
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                Try again
                              </Button>
                            )}
                            {error.code !== 'validation' && (
                              <a
                                href={buildBuildRequestMailto()}
                                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted/40"
                              >
                                <ExternalLink className="h-3.5 w-3.5" /> Email us your build request
                              </a>
                            )}
                            {error.code === 'validation' && (
                              <Button variant="outline" size="sm" onClick={() => setStep(1)}>
                                Back to step 1
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-between gap-3">
              <Button variant="outline" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1 || submitting}>
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              {step < 5 ? (
                <Button onClick={() => setStep(Math.min(5, step + 1))} className="bg-gradient-to-r from-primary to-secondary hover:opacity-90">
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={submit} disabled={submitting || !canSubmit} className="bg-gradient-to-r from-primary to-secondary hover:opacity-90">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                  {result ? 'Submit Another Build' : 'Generate Free Build'}
                </Button>
              )}
            </div>
          </div>

          <aside className="order-first space-y-5 xl:order-none">
            <AppPreview form={form} />
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="mb-3 flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-primary" /> Included in free builder</div>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex gap-2"><Image className="h-4 w-4 text-primary" /> Custom icon and splash theme</div>
                <div className="flex gap-2"><Bell className="h-4 w-4 text-primary" /> ApkZio-ready subscriber support</div>
                <div className="flex gap-2"><RefreshCw className="h-4 w-4 text-primary" /> Pull-to-refresh and offline fallback options</div>
              </div>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}

// ---- Build result card ---------------------------------------------------

function formatBytes(n: number | null | undefined): string | null {
  if (!n || n <= 0) return null;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

function buildArtifactHref(relativeOrAbsolute: string): string {
  if (/^https?:\/\//i.test(relativeOrAbsolute)) return relativeOrAbsolute;
  return `${getApiBaseUrl()}${relativeOrAbsolute.startsWith('/') ? '' : '/'}${relativeOrAbsolute}`;
}

function BuildResultCard({
  result,
  pollError,
  onRefresh,
  isAuthenticated,
}: {
  result: BuilderBuild;
  pollError: string | null;
  onRefresh: () => void;
  isAuthenticated: boolean;
}) {
  const status = result.build_status;
  const inflight = status === 'queued' || status === 'building';
  const success = status === 'success';
  const failed = status === 'failed';
  const apkHref = result.apk_url ? buildArtifactHref(result.apk_url) : null;
  const zipHref = result.source_zip_url ? buildArtifactHref(result.source_zip_url) : null;
  const apkSize = formatBytes(result.apk_size_bytes);

  const tone = failed
    ? 'border-destructive/30 bg-destructive/10'
    : success
      ? 'border-success/30 bg-success/10'
      : 'border-primary/30 bg-primary/5';

  const icon = failed ? (
    <ShieldCheck className="mt-1 h-5 w-5 text-destructive" />
  ) : success ? (
    <CheckCircle2 className="mt-1 h-5 w-5 text-success" />
  ) : (
    <Loader2 className="mt-1 h-5 w-5 animate-spin text-primary" />
  );

  const headline = failed
    ? 'Build failed'
    : success
      ? 'Your build is ready'
      : status === 'building'
        ? 'Building your app…'
        : 'Your build is queued';

  const subhead = failed
    ? 'See the error below or email support — we’ll get you sorted.'
    : success
      ? apkHref
        ? 'Your installable APK is below. Use the source ZIP only if you want to edit the project in Android Studio.'
        : result.apk_build_skipped || !result.apk_url
          ? 'This server delivered the Android Studio source ZIP. Install JDK + Gradle + ANDROID_HOME on the API host for automatic APK output, or build locally with ./gradlew assembleDebug.'
          : 'Download the APK below, or grab the Android Studio source ZIP.'
      : 'This usually takes 30–90 seconds. We’ll refresh automatically.';

  return (
    <div className={`rounded-lg border p-5 ${tone}`}>
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="flex items-start gap-3 md:flex-1">
          {icon}
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold">{headline}</div>
            <div className="mt-1 text-sm text-muted-foreground">{subhead}</div>
            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              <div className="rounded-md border border-border bg-card/60 px-3 py-2">
                <div className="text-muted-foreground">Build ID</div>
                <div className="mt-0.5 truncate font-mono">{result.build_id}</div>
              </div>
              <div className="rounded-md border border-border bg-card/60 px-3 py-2">
                <div className="text-muted-foreground">App</div>
                <div className="mt-0.5 truncate font-medium">
                  {result.app_name || result.package_name || '—'}
                </div>
              </div>
            </div>
            {pollError && inflight && (
              <div className="mt-3 text-xs text-muted-foreground">
                Couldn't auto-refresh ({pollError}). Use the refresh button below.
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-2 md:w-56">
          {success && apkHref && (
            <a
              href={apkHref}
              download
              className="inline-flex items-center justify-center gap-2 rounded-md bg-gradient-to-r from-primary to-secondary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md hover:opacity-90"
            >
              <Download className="h-4 w-4" />
              Download APK{apkSize ? ` (${apkSize})` : ''}
            </a>
          )}
          {success && !apkHref && result.apk_build_skipped && (
            <div className="rounded-md border border-border bg-card/60 px-3 py-2 text-[11px] text-muted-foreground">
              APK build was skipped on this host. Download the source ZIP and run
              <span className="mx-1 font-mono">gradle assembleDebug</span>
              (or <span className="font-mono">./gradlew assembleDebug</span> if you add a wrapper)
              locally.
            </div>
          )}
          {success && !apkHref && result.apk_build_error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
              APK packaging failed: {result.apk_build_error}. The source ZIP below is still buildable.
            </div>
          )}
          {zipHref && (
            <a
              href={zipHref}
              download
              className={`inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted/40 ${
                success && apkHref
                  ? 'border-border bg-card'
                  : 'border-primary/40 bg-gradient-to-r from-primary/15 to-secondary/15 font-semibold'
              }`}
            >
              <Download className="h-4 w-4" />
              {success && apkHref ? 'Source ZIP (optional)' : 'Download source ZIP'}
            </a>
          )}
          {inflight && (
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted/40"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh status
            </button>
          )}
        </div>
      </div>

      {/* Sign-up CTA — only when the user isn't already signed in. The plan
          is to associate this build_id with their account on register so it
          shows up in their dashboard. */}
      {!isAuthenticated && (success || inflight) && (
        <div className="mt-5 flex flex-col gap-3 rounded-md border border-border bg-card/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <div className="font-medium">Save this build to your account</div>
            <div className="text-xs text-muted-foreground">
              Sign up free to track builds, get notified by email when they're ready,
              and rebuild any time.
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              to={`/auth/register?claim=${encodeURIComponent(result.build_id)}`}
              className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Create account
            </Link>
            <Link
              to="/auth/login"
              className="inline-flex items-center justify-center rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted/40"
            >
              Sign in
            </Link>
          </div>
        </div>
      )}

      {failed && (
        <div className="mt-4 text-xs text-muted-foreground">
          Need help? <a href="mailto:support@apkzio.com" className="text-primary hover:underline">Email support</a> with this build ID.
        </div>
      )}
    </div>
  );
}
