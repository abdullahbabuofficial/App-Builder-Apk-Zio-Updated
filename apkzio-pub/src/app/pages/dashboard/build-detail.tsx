import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileArchive,
  FileDown,
  Package,
  RefreshCw,
  Smartphone,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { DashboardLayout } from '../../components/dashboard/dashboard-layout';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { Link, navigate, useRouter } from '../../components/router';
import {
  getApiBaseUrl,
  getMyBuild,
  type Build,
  type BuildStatus,
} from '../../lib/api';

// TODO(Agent X): the optional APK + log fields below are part of an in-flight
// extension to the shared `Build` type. Mirror the shape locally so this page
// type-checks even if `Build` doesn't carry them yet.
type BuildDetail = Build & {
  apk_url?: string | null;
  apk_size_bytes?: number | null;
  apk_build_skipped?: boolean | null;
  apk_build_error?: string | null;
  logs?: string[] | null;
  triggered_by?: string | null;
};

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_MS = 5 * 60 * 1000;

function formatBytes(bytes?: number | null): string {
  if (bytes == null || Number.isNaN(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function formatDuration(startIso?: string | null, endIso?: string | null): string {
  if (!startIso) return '—';
  const start = new Date(startIso).getTime();
  if (Number.isNaN(start)) return '—';
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  if (Number.isNaN(end)) return '—';
  const diff = Math.max(0, end - start);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rest = sec % 60;
  if (min < 60) return `${min}m ${rest}s`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}

function isInflight(status: BuildStatus | undefined): boolean {
  return status === 'queued' || status === 'building';
}

function shortId(id: string): string {
  if (!id) return '';
  return id.slice(0, 8);
}

function StatusPill({ status }: { status: BuildStatus }) {
  const map: Record<BuildStatus, { cls: string; icon: typeof CheckCircle2 }> = {
    success: { cls: 'bg-success text-white', icon: CheckCircle2 },
    building: { cls: 'bg-warning text-white', icon: RefreshCw },
    queued: { cls: 'bg-muted text-foreground', icon: Clock },
    failed: { cls: 'bg-destructive text-white', icon: XCircle },
  };
  const cfg = map[status];
  const Icon = cfg.icon;
  return (
    <Badge className={cfg.cls}>
      <Icon className={`h-3 w-3 mr-1 ${status === 'building' ? 'animate-spin' : ''}`} />
      {status}
    </Badge>
  );
}

function extractBuildId(path: string): string {
  const clean = path.split('?')[0].replace(/\/+$/, '');
  const tail = clean.split('/').pop() ?? '';
  try {
    return decodeURIComponent(tail);
  } catch {
    return tail;
  }
}

async function copyToClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function BuildDetailPage() {
  const { path } = useRouter();
  const buildId = useMemo(() => extractBuildId(path), [path]);

  const [build, setBuild] = useState<BuildDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const pollStartedAtRef = useRef<number | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'poll' = 'refresh') => {
      if (!buildId) return;
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      try {
        const next = (await getMyBuild(buildId)) as BuildDetail;
        setBuild(next);
        setError(null);
        setNotFound(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load build.';
        if (/404/.test(message) || /not found/i.test(message)) {
          setNotFound(true);
          setError(null);
        } else if (mode !== 'poll') {
          setError(message);
        }
      } finally {
        if (mode === 'initial') setLoading(false);
        if (mode === 'refresh') setRefreshing(false);
      }
    },
    [buildId],
  );

  useEffect(() => {
    if (!buildId) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    void load('initial');
  }, [buildId, load]);

  useEffect(() => {
    if (!build || !isInflight(build.status)) {
      pollStartedAtRef.current = null;
      return;
    }
    if (pollStartedAtRef.current == null) {
      pollStartedAtRef.current = Date.now();
    }
    const interval = window.setInterval(() => {
      const startedAt = pollStartedAtRef.current ?? Date.now();
      if (Date.now() - startedAt > POLL_MAX_MS) {
        window.clearInterval(interval);
        return;
      }
      void load('poll');
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [build, load]);

  if (notFound) {
    return (
      <DashboardLayout currentPage="builds">
        <div className="max-w-2xl mx-auto py-12">
          <div className="rounded-2xl border border-border bg-card p-10 text-center">
            <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Package className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Build not found</h2>
            <p className="text-sm text-muted-foreground mb-6">
              We couldn't find a build with id{' '}
              <span className="font-mono">{shortId(buildId)}</span>. It may have been deleted
              or belongs to another account.
            </p>
            <div className="flex justify-center">
              <Link
                to="/dashboard/builds"
                className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-primary to-secondary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to builds
              </Link>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout currentPage="builds">
      <div className="space-y-6 max-w-5xl">
        <BuildHeader
          build={build}
          loading={loading}
          refreshing={refreshing}
          onRefresh={() => void load('refresh')}
        />

        {error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Couldn't load this build</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => void load('refresh')}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        )}

        <StatusPanel build={build} loading={loading} />
        <DownloadsCard build={build} loading={loading} />
        <ConfigurationCard build={build} loading={loading} />
        <LogsCard build={build} loading={loading} />
      </div>
    </DashboardLayout>
  );
}

function BuildHeader({
  build,
  loading,
  refreshing,
  onRefresh,
}: {
  build: BuildDetail | null;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/dashboard/builds')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to builds
        </Button>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Build {loading || !build ? '…' : shortId(build.id)}
        </h1>
        {build && <StatusPill status={build.status} />}
      </div>
      <Button variant="ghost" size="sm" onClick={onRefresh} disabled={refreshing}>
        <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        Refresh
      </Button>
    </div>
  );
}

function StatusPanel({
  build,
  loading,
}: {
  build: BuildDetail | null;
  loading: boolean;
}) {
  const items: Array<{ label: string; value: React.ReactNode }> = build
    ? [
        { label: 'Started', value: formatDateTime(build.build_started_at) },
        { label: 'Completed', value: formatDateTime(build.build_completed_at) },
        {
          label: 'Duration',
          value: formatDuration(build.build_started_at, build.build_completed_at),
        },
        {
          label: 'Triggered by',
          value: build.triggered_by ?? 'You',
        },
        {
          label: 'App',
          value: (
            <span className="inline-flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-primary" />
              {build.app_name}
            </span>
          ),
        },
        {
          label: 'Version',
          value: `v${build.version_name} (${build.version_code})`,
        },
      ]
    : [];

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-base font-semibold mb-4">Status</h2>
      {loading || !build ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
      ) : (
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          {items.map((item) => (
            <div key={item.label}>
              <dt className="text-xs text-muted-foreground">{item.label}</dt>
              <dd className="font-medium mt-1">{item.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function DownloadsCard({
  build,
  loading,
}: {
  build: BuildDetail | null;
  loading: boolean;
}) {
  const sourceHref = build?.source_zip_url ? `${getApiBaseUrl()}${build.source_zip_url}` : null;
  const apkHref = build?.apk_url ? `${getApiBaseUrl()}${build.apk_url}` : null;

  const handleCopy = async (label: string, value: string | null) => {
    if (!value) return;
    const ok = await copyToClipboard(value);
    if (ok) toast.success('Link copied');
    else toast.error("Couldn't copy link");
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Downloads</h2>
        {build && (
          <span className="text-xs text-muted-foreground">
            Source size: {formatBytes(build.size_bytes)}
            {build.apk_size_bytes != null && (
              <> · APK size: {formatBytes(build.apk_size_bytes)}</>
            )}
          </span>
        )}
      </div>

      {loading || !build ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Source ZIP */}
          <div className="rounded-xl border border-border p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <FileArchive className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Source ZIP</p>
                <p className="text-xs text-muted-foreground">
                  Android Studio project source
                </p>
              </div>
            </div>
            {sourceHref ? (
              <a
                href={sourceHref}
                target="_blank"
                rel="noreferrer"
                download
                className="inline-flex items-center justify-center rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              >
                <Download className="mr-2 h-4 w-4" />
                Download ZIP
              </a>
            ) : (
              <Button variant="outline" disabled>
                <Download className="mr-2 h-4 w-4" />
                Download ZIP
              </Button>
            )}
          </div>

          {/* APK */}
          <div className="rounded-xl border border-border p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <FileDown className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="font-medium flex items-center gap-2">
                  APK
                  {apkHref && (
                    <Badge className="bg-gradient-to-r from-primary to-secondary text-white">
                      Recommended
                    </Badge>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  Installable Android package
                </p>
              </div>
            </div>
            {apkHref ? (
              <a
                href={apkHref}
                target="_blank"
                rel="noreferrer"
                download
                className="inline-flex items-center justify-center rounded-md bg-gradient-to-r from-primary to-secondary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                <Download className="mr-2 h-4 w-4" />
                Download APK
              </a>
            ) : (
              <Button variant="outline" disabled>
                <Download className="mr-2 h-4 w-4" />
                Download APK
              </Button>
            )}
            {!apkHref && build.apk_build_skipped && (
              <p className="text-xs text-muted-foreground">
                APK build skipped on this host. Download the source ZIP and run{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                  gradle assembleDebug
                </code>{' '}
                locally.
              </p>
            )}
            {!apkHref && build.apk_build_error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive">APK build failed</p>
                    <p className="text-muted-foreground mt-1 break-words">
                      {build.apk_build_error}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {build && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleCopy('zip', sourceHref)}
            disabled={!sourceHref}
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy ZIP URL
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleCopy('apk', apkHref)}
            disabled={!apkHref}
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy APK URL
          </Button>
        </div>
      )}
    </div>
  );
}

function ConfigurationCard({
  build,
  loading,
}: {
  build: BuildDetail | null;
  loading: boolean;
}) {
  const config = build?.config ?? {};

  const swatches: Array<{ label: string; key: keyof typeof config }> = [
    { label: 'Primary', key: 'primary_color' },
    { label: 'Background', key: 'background_color' },
    { label: 'Splash', key: 'splash_color' },
  ];

  const permissions: Array<[string, boolean | undefined]> = build
    ? [
        ['Pull to refresh', Boolean(config.pull_to_refresh)],
        ['Offline mode', Boolean(config.offline_mode)],
        ['Push notifications', Boolean(config.push_notifications)],
      ]
    : [];

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
      <h2 className="text-base font-semibold">Configuration</h2>
      {loading || !build ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-5 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-muted-foreground text-xs">App name</p>
              <p className="font-medium">{config.app_name ?? build.app_name}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Package name</p>
              <p className="font-medium">{config.package_name ?? build.package_name}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Start URL</p>
              <p className="font-medium break-all">
                {(config.start_url as string | undefined) ??
                  (config.website_url as string | undefined) ??
                  '—'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Version</p>
              <p className="font-medium">
                v{config.version_name ?? build.version_name} (
                {config.version_code ?? build.version_code})
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Orientation</p>
              <p className="font-medium">
                {(config.orientation as string | undefined) ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Build type</p>
              <p className="font-medium">
                {(config.build_type as string | undefined) ?? '—'}
              </p>
            </div>
          </div>

          <div>
            <p className="text-muted-foreground text-xs mb-2">Colors</p>
            <div className="flex flex-wrap gap-3">
              {swatches.map((s) => {
                const value = (config[s.key] as string | undefined) ?? '';
                return (
                  <div key={s.label} className="flex items-center gap-2">
                    <span
                      className="inline-block h-6 w-6 rounded-md border border-border"
                      style={{ background: value || 'transparent' }}
                      aria-hidden
                    />
                    <span className="text-xs">
                      <span className="text-muted-foreground">{s.label}: </span>
                      <span className="font-mono">{value || '—'}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-muted-foreground text-xs mb-2">Permissions</p>
            <ul className="space-y-1">
              {permissions.map(([label, enabled]) => (
                <li key={label} className="flex items-center justify-between">
                  <span>{label}</span>
                  <Badge
                    className={
                      enabled
                        ? 'bg-success text-white'
                        : 'bg-muted text-muted-foreground'
                    }
                  >
                    {enabled ? 'Yes' : 'No'}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function LogsCard({
  build,
  loading,
}: {
  build: BuildDetail | null;
  loading: boolean;
}) {
  const logs = useMemo(() => build?.logs ?? [], [build]);
  const logText = logs.join('\n');

  const handleCopyLogs = async () => {
    if (!logText) return;
    const ok = await copyToClipboard(logText);
    if (ok) toast.success('Logs copied');
    else toast.error("Couldn't copy logs");
  };

  const live = build && isInflight(build.status);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold flex items-center gap-2">
          Logs
          {live && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-warning animate-pulse" />
              Live
            </span>
          )}
        </h2>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCopyLogs}
          disabled={!logText}
        >
          <Copy className="mr-2 h-4 w-4" />
          Copy logs
        </Button>
      </div>
      {loading || !build ? (
        <Skeleton className="h-48 w-full rounded-lg" />
      ) : logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No logs captured for this build.</p>
      ) : (
        <pre className="max-h-96 overflow-auto rounded-lg border border-border bg-muted/40 p-4 text-xs leading-relaxed font-mono whitespace-pre-wrap break-words">
          {logText}
        </pre>
      )}
    </div>
  );
}
