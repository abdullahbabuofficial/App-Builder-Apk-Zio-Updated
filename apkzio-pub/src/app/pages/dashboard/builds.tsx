import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Package,
  Download,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  Eye,
  Copy,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { DashboardLayout } from '../../components/dashboard/dashboard-layout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { navigate } from '../../components/router';
import {
  getApiBaseUrl,
  getMyApps,
  getMyBuilds,
  type App,
  type Build,
  type BuildStatus,
} from '../../lib/api';
import { trackEvent } from '../../lib/firebase';

// TODO(Agent X): mirror the optional APK fields locally until they land on the
// shared `Build` type.
type BuildWithApk = Build & {
  apk_url?: string | null;
  apk_size_bytes?: number | null;
  apk_build_skipped?: boolean | null;
  apk_build_error?: string | null;
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

function isInflight(status: BuildStatus): boolean {
  return status === 'queued' || status === 'building';
}

const statusBadge = (s: BuildStatus) => {
  const map: Record<BuildStatus, { cls: string; icon: typeof CheckCircle2 }> = {
    success: { cls: 'bg-success text-white', icon: CheckCircle2 },
    building: { cls: 'bg-warning text-white', icon: RefreshCw },
    queued: { cls: 'bg-muted text-foreground', icon: Clock },
    failed: { cls: 'bg-destructive text-white', icon: XCircle },
  };
  const cfg = map[s];
  const Icon = cfg.icon;
  return (
    <Badge className={cfg.cls}>
      <Icon className="h-3 w-3 mr-1" />
      {s}
    </Badge>
  );
};

type StatusFilter = 'all' | BuildStatus;

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'success', label: 'Success' },
  { value: 'building', label: 'Building' },
  { value: 'queued', label: 'Queued' },
  { value: 'failed', label: 'Failed' },
];

export function BuildsPage() {
  const [builds, setBuilds] = useState<Build[] | null>(null);
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [appFilter, setAppFilter] = useState<string>('all');
  const [detailsBuild, setDetailsBuild] = useState<Build | null>(null);
  const pollStartedAtRef = useRef<number | null>(null);
  const statusRef = useRef<Map<string, BuildStatus>>(new Map());

  useEffect(() => {
    let cancelled = false;
    getMyApps()
      .then((next) => {
        if (!cancelled) setApps(next);
      })
      .catch(() => {
        if (!cancelled) setApps([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async (mode: 'initial' | 'refresh' | 'poll' = 'refresh') => {
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    try {
      const next = await getMyBuilds();
      setBuilds(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load builds.');
    } finally {
      if (mode === 'initial') setLoading(false);
      if (mode === 'refresh') setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load('initial');
  }, [load]);

  useEffect(() => {
    if (!builds) return;
    const map = statusRef.current;
    for (const b of builds) {
      const prev = map.get(b.id);
      if (prev && isInflight(prev) && !isInflight(b.status)) {
        void trackEvent('apkzio_build_completed', {
          build_id: b.id,
          app_id: b.app_id,
          status: b.status,
          version_name: b.version_name,
          version_code: b.version_code,
        });
      }
      map.set(b.id, b.status);
    }
  }, [builds]);

  const hasInflight = useMemo(
    () => (builds ?? []).some((b) => isInflight(b.status)),
    [builds],
  );

  useEffect(() => {
    if (!hasInflight) {
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
  }, [hasInflight, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = [...(builds ?? [])].sort(
      (a, b) =>
        new Date(b.build_started_at || 0).getTime() -
        new Date(a.build_started_at || 0).getTime(),
    );
    if (statusFilter !== 'all') {
      list = list.filter((b) => b.status === statusFilter);
    }
    if (appFilter !== 'all') {
      list = list.filter((b) => b.app_id === appFilter);
    }
    if (!q) return list;
    return list.filter(
      (b) =>
        b.id.toLowerCase().includes(q) ||
        b.app_name.toLowerCase().includes(q) ||
        b.package_name?.toLowerCase().includes(q) ||
        b.version_name?.toLowerCase().includes(q),
    );
  }, [builds, search, statusFilter, appFilter]);

  const totals = useMemo(() => {
    const list = builds ?? [];
    return {
      total: list.length,
      success: list.filter((b) => b.status === 'success').length,
      queued: list.filter((b) => b.status === 'queued' || b.status === 'building').length,
      failed: list.filter((b) => b.status === 'failed').length,
    };
  }, [builds]);

  const downloadHref = (build: Build) =>
    build.source_zip_url ? `${getApiBaseUrl()}${build.source_zip_url}` : null;

  const apkHref = (build: Build) => {
    const apkUrl = (build as BuildWithApk).apk_url;
    return apkUrl ? `${getApiBaseUrl()}${apkUrl}` : null;
  };

  const copyZipUrl = async (build: Build) => {
    const href = downloadHref(build);
    if (!href) return;
    try {
      await navigator.clipboard.writeText(href);
      toast.success('Link copied');
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  const stopRowClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
  };

  return (
    <DashboardLayout currentPage="builds">
      <div className="space-y-6">
        <div>
          <h1 className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Build History</h1>
          <p className="text-muted-foreground mt-1">Track and download all your APK builds</p>
        </div>

        {error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Couldn't load builds</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => void load('refresh')}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Builds', value: totals.total, color: 'from-primary to-secondary' },
            { label: 'Successful', value: totals.success, color: 'from-success to-green-400' },
            { label: 'In Queue', value: totals.queued, color: 'from-warning to-orange-400' },
            { label: 'Failed', value: totals.failed, color: 'from-destructive to-red-400' },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-2xl p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold bg-gradient-to-r ${s.color} bg-clip-text text-transparent mt-1`}>
                {loading ? '—' : s.value}
              </p>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by build id, app or version..."
                className="pl-9"
              />
            </div>
            <Select value={appFilter} onValueChange={setAppFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All apps" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All apps</SelectItem>
                {apps.map((app) => (
                  <SelectItem key={app.id} value={app.id}>
                    {app.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => void load('refresh')}
              disabled={refreshing}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((option) => {
              const active = statusFilter === option.value;
              return (
                <Button
                  key={option.value}
                  size="sm"
                  variant={active ? 'default' : 'outline'}
                  className={active ? 'bg-gradient-to-r from-primary to-secondary' : ''}
                  onClick={() => setStatusFilter(option.value)}
                >
                  {option.label}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="p-4">Build ID</th>
                  <th className="p-4">App</th>
                  <th className="p-4 hidden md:table-cell">Version</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 hidden lg:table-cell">Date</th>
                  <th className="p-4 hidden md:table-cell">Size</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="p-4"><Skeleton className="h-4 w-24" /></td>
                      <td className="p-4"><Skeleton className="h-4 w-32" /></td>
                      <td className="p-4 hidden md:table-cell"><Skeleton className="h-4 w-12" /></td>
                      <td className="p-4"><Skeleton className="h-5 w-20 rounded-full" /></td>
                      <td className="p-4 hidden lg:table-cell"><Skeleton className="h-4 w-32" /></td>
                      <td className="p-4 hidden md:table-cell"><Skeleton className="h-4 w-12" /></td>
                      <td className="p-4 text-right"><Skeleton className="h-8 w-20 ml-auto" /></td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">
                      {search ? 'No builds match your search.' : 'No builds yet.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((b) => {
                    const href = downloadHref(b);
                    const apk = apkHref(b);
                    const goToDetail = () => navigate(`/dashboard/builds/${b.id}`);
                    return (
                      <tr
                        key={b.id}
                        className="border-t border-border hover:bg-muted/30 cursor-pointer"
                        onClick={goToDetail}
                        role="link"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            goToDetail();
                          }
                        }}
                      >
                        <td className="p-4 font-mono text-xs">{b.id.slice(0, 8)}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-primary" />
                            {b.app_name}
                          </div>
                        </td>
                        <td className="p-4 hidden md:table-cell">v{b.version_name}</td>
                        <td className="p-4">
                          <div className="space-y-1">
                            {statusBadge(b.status)}
                            {b.status === 'building' && <Progress value={55} className="h-1 w-20" />}
                          </div>
                        </td>
                        <td className="p-4 hidden lg:table-cell text-muted-foreground">
                          {formatDateTime(b.build_started_at)}
                        </td>
                        <td className="p-4 hidden md:table-cell">
                          {formatBytes(b.size_bytes)}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-1" onClick={stopRowClick}>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailsBuild(b);
                              }}
                              aria-label="View build details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {href ? (
                              <a
                                href={href}
                                target="_blank"
                                rel="noreferrer"
                                download
                                onClick={stopRowClick}
                                aria-label="Download source ZIP"
                                title="Source ZIP"
                              >
                                <Button
                                  size="sm"
                                  disabled={b.status !== 'success'}
                                  className="bg-gradient-to-r from-primary to-secondary"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </a>
                            ) : (
                              <Button
                                size="sm"
                                disabled
                                onClick={stopRowClick}
                                className="bg-gradient-to-r from-primary to-secondary"
                                aria-label="Download source ZIP"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                            {apk && (
                              <a
                                href={apk}
                                target="_blank"
                                rel="noreferrer"
                                download
                                onClick={stopRowClick}
                                aria-label="Download APK"
                                title="APK"
                              >
                                <Button
                                  size="sm"
                                  className="bg-gradient-to-r from-primary to-secondary"
                                >
                                  <Download className="h-4 w-4 mr-1" />
                                  APK
                                </Button>
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <BuildDetailsDialog
        build={detailsBuild}
        onClose={() => setDetailsBuild(null)}
        onCopyZip={copyZipUrl}
      />
    </DashboardLayout>
  );
}

function BuildDetailsDialog({
  build,
  onClose,
  onCopyZip,
}: {
  build: Build | null;
  onClose: () => void;
  onCopyZip: (b: Build) => void;
}) {
  const open = build !== null;
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Build #{build?.id.slice(0, 8) ?? ''}</DialogTitle>
          <DialogDescription>
            Configuration captured at build time
          </DialogDescription>
        </DialogHeader>
        {build && (
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

            {build.source_zip_url && (
              <div className="flex justify-end pt-2 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCopyZip(build)}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy ZIP URL
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
