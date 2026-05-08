import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Field, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Tabs } from "@/components/ui/Tabs";
import { StatusPill, Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState, Avatar } from "@/components/ui/Misc";
import { Icon } from "@/lib/icons";
import { bytes, commas, dateTime, ms, relTime } from "@/lib/format";
import type { ApkBuild, AndroidApp, WebViewBuildConfig } from "@/lib/mock-data";
import { useApkzio } from "@/context/ApkzioDataContext";
import { useToast } from "@/components/ui/Toast";
import { cn, copyToClipboard } from "@/lib/utils";
import * as api from "@/lib/api";

// Mirrors `<Button variant="secondary" size="sm">` so an <a> can render the same affordance.
const DOWNLOAD_LINK_CLASSES =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium transition-all duration-150 h-7 px-2.5 text-[12px] border border-line-1 bg-ink-2/60 text-bone hover:border-line-2 hover:bg-ink-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-0";

// Mirrors `<Button variant="primary" size="sm">` for the APK row anchor — APK is the headline artifact.
const APK_ROW_LINK_CLASSES =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium transition-all duration-150 h-7 px-2.5 text-[12px] bg-signal text-ink-0 hover:bg-signal-300 active:bg-signal-600 shadow-[0_0_0_1px_rgba(205,255,63,0.18),0_4px_16px_-4px_rgba(205,255,63,0.25)] focus:outline-none focus-visible:ring-2 focus-visible:ring-signal/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-0";

// Mirrors `<Button variant="secondary">` (default md size) for header anchors and overview download.
const DOCS_LINK_CLASSES =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium transition-all duration-150 h-9 px-3.5 text-[13px] border border-line-1 bg-ink-2/60 text-bone hover:border-line-2 hover:bg-ink-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-0";

// Mirrors `<Button variant="primary">` (default md size) for the APK download in the details modal.
const APK_DETAILS_LINK_CLASSES =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium transition-all duration-150 h-9 px-3.5 text-[13px] bg-signal text-ink-0 hover:bg-signal-300 active:bg-signal-600 shadow-[0_0_0_1px_rgba(205,255,63,0.18),0_4px_16px_-4px_rgba(205,255,63,0.25)] focus:outline-none focus-visible:ring-2 focus-visible:ring-signal/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-0";

// `ApkBuild` already declares the WebView-specific fields and the four
// `apk_*` fields. This local alias just keeps the rest of the file readable
// while we still call out the shape used in modals.
type BuildWithConfig = ApkBuild;

// Tooltip + body copy for the "APK skipped" affordance — host doesn't have JDK/Android SDK.
const APK_SKIPPED_TITLE =
  "No APK on this host — JDK / Gradle / ANDROID_HOME missing, or APK builds disabled (APKZIO_ENABLE_APK_BUILD=0). Source ZIP is ready.";
const APK_ENABLE_HINT =
  "When unset, the API builds an APK automatically if Java, Gradle, and ANDROID_HOME are available. Otherwise set APKZIO_ENABLE_APK_BUILD=1 after fixing tooling, or use APKZIO_ENABLE_APK_BUILD=0 for ZIP-only.";

const DEFAULT_PRIMARY = "#CDFF3F";
const DEFAULT_BACKGROUND = "#0B0F0E";
const DEFAULT_SPLASH = "#0B0F0E";
const DEFAULT_OFFLINE_MESSAGE = "You're offline. Reconnect to load this app.";
// Two-segment min (e.g. "com.foo"); accepts uppercase but Android conventions favour lowercase.
const PACKAGE_RE = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/i;
const HEX_RE = /^#([0-9a-f]{6}|[0-9a-f]{3})$/i;

const POLL_INTERVAL_MS = 1500;
const STALE_INFLIGHT_MS = 5 * 60 * 1000;

type NewBuildTab = "identity" | "webview" | "branding" | "permissions" | "notes";
type DetailsTab = "overview" | "configuration" | "logs";

export function ApkBuilder() {
  const { builds: rawBuilds, apps, appName, refresh, apiBaseUrl } = useApkzio();
  const builds = rawBuilds as BuildWithConfig[];
  const { toast } = useToast();
  const [tab, setTab] = useState<"all" | ApkBuild["status"]>("all");
  const [appFilter, setAppFilter] = useState<string>("all");
  const [openNew, setOpenNew] = useState(false);

  // Build details modal state — opens for any row click and the per-row Logs button.
  const [detailsBuild, setDetailsBuild] = useState<BuildWithConfig | null>(null);
  const [detailsTab, setDetailsTab] = useState<DetailsTab>("overview");

  // Keep details modal in sync with the latest server data while it's open.
  useEffect(() => {
    if (!detailsBuild) return;
    const fresh = builds.find((b) => b.id === detailsBuild.id);
    if (fresh && fresh !== detailsBuild) setDetailsBuild(fresh);
  }, [builds, detailsBuild]);

  // ---- Live status polling for inflight builds ----
  const inflightFirstSeen = useRef<Map<string, number>>(new Map());
  const [staleCount, setStaleCount] = useState(0);

  useEffect(() => {
    const now = Date.now();
    for (const b of builds) {
      const inflight = b.status === "queued" || b.status === "building";
      if (inflight) {
        if (!inflightFirstSeen.current.has(b.id)) {
          inflightFirstSeen.current.set(b.id, now);
        }
      } else if (inflightFirstSeen.current.has(b.id)) {
        inflightFirstSeen.current.delete(b.id);
      }
    }

    let active = 0;
    let stale = 0;
    for (const b of builds) {
      if (b.status !== "queued" && b.status !== "building") continue;
      const seen = inflightFirstSeen.current.get(b.id) ?? now;
      if (now - seen >= STALE_INFLIGHT_MS) stale++;
      else active++;
    }
    setStaleCount(stale);

    if (active === 0) return;
    const handle = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(handle);
  }, [builds, refresh]);

  const filtered = useMemo(() => {
    return builds.filter((b) => {
      if (tab !== "all" && b.status !== tab) return false;
      if (appFilter !== "all" && b.app_id !== appFilter) return false;
      return true;
    });
  }, [tab, appFilter, builds]);

  const stats = useMemo(() => {
    const lastWeek = builds.filter((b) => Date.now() - +new Date(b.build_started_at) < 7 * 86400_000);
    return {
      total: builds.length,
      success: builds.filter((b) => b.status === "success").length,
      failed: builds.filter((b) => b.status === "failed").length,
      inflight: builds.filter((b) => b.status === "building" || b.status === "queued").length,
      lastWeek: lastWeek.length,
      avgDuration: Math.round(
        builds.filter((b) => b.duration_ms).reduce((s, b) => s + (b.duration_ms ?? 0), 0) /
        Math.max(1, builds.filter((b) => b.duration_ms).length)
      ),
    };
  }, [builds]);

  function openDetails(b: BuildWithConfig, initialTab: DetailsTab = "overview") {
    setDetailsBuild(b);
    setDetailsTab(initialTab);
  }

  return (
    <>
      <PageHeader
        eyebrow="DEVELOPERS"
        title="WebView App Builder"
        description="Generate signed Android WebView wrappers from a URL. Configure branding, permissions, and offline copy — we ship a buildable Android Studio project + APK."
        actions={
          <>
            <a
              href="https://docs.apkzio.dev/builder"
              target="_blank"
              rel="noreferrer"
              className={DOCS_LINK_CLASSES}
            >
              <Icon.External size={14} />
              Open docs
            </a>
            <Button variant="primary" leading={<Icon.Plus size={14} />} onClick={() => setOpenNew(true)}>New build</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Builds · 7d" value={commas(stats.lastWeek)} hint={`${stats.total} total`} emphasis />
        <StatCard
          label="Success rate"
          value={`${((stats.success / Math.max(1, stats.total)) * 100).toFixed(1)}%`}
          hint={`${stats.success} of ${stats.total}`}
        />
        <StatCard label="Avg duration" value={ms(stats.avgDuration)} hint="median per job" />
        <StatCard label="In flight" value={String(stats.inflight)} hint={`${stats.failed} failed`} />
      </div>

      {staleCount > 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-line-1 bg-ink-2/40 px-3 py-2 text-[12px] text-bone-low">
          <Icon.Info size={12} />
          {staleCount === 1
            ? "1 build has been running for more than 5 minutes — open the row to refetch logs."
            : `${staleCount} builds have been running for more than 5 minutes — open a row to refetch logs.`}
        </div>
      )}

      <Card className="mt-6 mb-5">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <Select
            value={appFilter}
            onChange={(e) => setAppFilter(e.target.value)}
            options={[{ value: "all", label: "All apps" }, ...apps.map((a) => ({ value: a.id, label: a.name }))]}
            className="sm:w-56"
          />
          <Tabs
            variant="segmented"
            value={tab}
            onChange={(v) => setTab(v as "all" | ApkBuild["status"])}
            tabs={[
              { value: "all", label: "All", count: builds.length },
              { value: "success", label: "Success", count: stats.success },
              { value: "failed", label: "Failed", count: stats.failed },
              { value: "building", label: "Building" },
              { value: "queued", label: "Queued" },
            ]}
            className="overflow-x-auto"
          />
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Icon.Hammer size={18} />}
          title="No builds match"
          description="Try removing some filters or trigger a new build."
          action={<Button variant="primary" leading={<Icon.Plus size={14} />} onClick={() => setOpenNew(true)}>New build</Button>}
        />
      ) : (
        <Card>
          <CardHeader title={`${commas(filtered.length)} builds`} />
          <CardBody padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-line-1 text-bone-low">
                    <th className="px-5 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em]">Build</th>
                    <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em]">Status</th>
                    <th className="hidden px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em] sm:table-cell">App</th>
                    <th className="hidden px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.14em] md:table-cell">Duration</th>
                    <th className="hidden px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.14em] lg:table-cell">Size</th>
                    <th className="hidden px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em] xl:table-cell">By</th>
                    <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.14em]">Started</th>
                    <th className="px-5 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b) => {
                    const showLogs = b.status === "success" || b.status === "failed" || b.status === "building";
                    const zipHref = b.source_zip_url ? `${apiBaseUrl}${b.source_zip_url}` : null;
                    const apkHref = b.apk_url ? `${apiBaseUrl}${b.apk_url}` : null;
                    const showApkSkipped =
                      !apkHref && b.apk_build_skipped === true && b.status === "success";
                    return (
                      <tr
                        key={b.id}
                        className="cursor-pointer border-b border-line-1/70 last:border-b-0 hover:bg-ink-2/60"
                        onClick={() => openDetails(b, "overview")}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="grid h-9 w-9 shrink-0 place-items-center rounded border border-line-1 bg-ink-2 text-bone-low">
                              <Icon.Hammer size={14} />
                            </div>
                            <div>
                              <div className="font-mono text-[12px] font-medium text-bone">{b.version_name}</div>
                              <div className="font-mono text-[10px] text-bone-low">code {b.version_code} · {b.id.slice(0, 8)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3"><StatusPill status={b.status} /></td>
                        <td className="hidden px-4 py-3 sm:table-cell"><span className="text-bone-mid">{appName(b.app_id)}</span></td>
                        <td className="hidden px-4 py-3 text-right font-mono num text-bone-mid md:table-cell">{b.duration_ms ? ms(b.duration_ms) : "—"}</td>
                        <td className="hidden px-4 py-3 text-right font-mono num text-bone-mid lg:table-cell">{b.size_bytes ? bytes(b.size_bytes) : "—"}</td>
                        <td className="hidden px-4 py-3 xl:table-cell">
                          <div className="flex items-center gap-2">
                            <Avatar glyph={b.triggered_by[0].toUpperCase()} size={22} />
                            <span className="font-mono text-[11px] text-bone-mid">{b.triggered_by}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-bone-mid">{relTime(b.build_started_at)}</span>
                        </td>
                        <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {zipHref && (
                              <a
                                href={zipHref}
                                download
                                target="_blank"
                                rel="noreferrer"
                                className={DOWNLOAD_LINK_CLASSES}
                              >
                                <Icon.External size={12} />
                                Download
                              </a>
                            )}
                            {apkHref && (
                              <a
                                href={apkHref}
                                download
                                target="_blank"
                                rel="noreferrer"
                                className={APK_ROW_LINK_CLASSES}
                                title={
                                  b.apk_size_bytes
                                    ? `Signed APK · ${bytes(b.apk_size_bytes)}`
                                    : "Signed APK"
                                }
                              >
                                <Icon.External size={12} />
                                APK
                              </a>
                            )}
                            {showApkSkipped && (
                              <span
                                className="font-mono text-[11px] text-bone-low"
                                title={APK_SKIPPED_TITLE}
                              >
                                APK skipped
                              </span>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              leading={<Icon.Eye size={12} />}
                              onClick={() => openDetails(b, "overview")}
                              aria-label="Open build details"
                            >
                              Details
                            </Button>
                            {showLogs && (
                              <Button
                                variant="ghost"
                                size="sm"
                                leading={<Icon.Code size={12} />}
                                onClick={() => openDetails(b, "logs")}
                              >
                                Logs
                              </Button>
                            )}
                            {b.status === "queued" && (
                              <span className="font-mono text-[12px] text-bone-low" aria-hidden="true">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardBody>
          <CardFooter>
            <Badge dot tone="signal">Signed APKs · v2 signing scheme</Badge>
            <span className="font-mono text-[11px] text-bone-low">Artifacts retained 90d · Cache warmed nightly</span>
          </CardFooter>
        </Card>
      )}

      <NewBuildModal
        open={openNew}
        onClose={() => setOpenNew(false)}
        apps={apps}
        onCreated={(payload) => {
          toast({
            tone: "success",
            title: "Build queued",
            description: `${payload.app_name} · v${payload.version_name} (${payload.version_code})`,
          });
          // Pick up queued → building → success transitions emitted by the backend.
          void refresh();
          window.setTimeout(() => { void refresh(); }, 800);
        }}
        onError={(message) => {
          toast({
            tone: "error",
            title: "Could not queue build",
            description: message,
          });
        }}
      />

      <BuildDetailsModal
        build={detailsBuild}
        apiBaseUrl={apiBaseUrl}
        appName={detailsBuild ? appName(detailsBuild.app_id) : ""}
        tab={detailsTab}
        onTabChange={setDetailsTab}
        onClose={() => setDetailsBuild(null)}
      />
    </>
  );
}

// ===========================================================================
// New Build modal
// ===========================================================================

type NewBuildErrors = Partial<{
  app_id: string;
  app_name: string;
  package_name: string;
  version_code: string;
  version_name: string;
  start_url: string;
  primary_color: string;
  background_color: string;
  splash_color: string;
  branch: string;
}>;

const TAB_FIELD_MAP: Record<NewBuildTab, Array<keyof NewBuildErrors>> = {
  identity: ["app_id", "app_name", "package_name", "version_code", "version_name"],
  webview: ["start_url"],
  branding: ["primary_color", "background_color", "splash_color"],
  permissions: [],
  notes: ["branch"],
};

const TAB_ORDER: NewBuildTab[] = ["identity", "webview", "branding", "permissions", "notes"];

type NewBuildModalProps = {
  open: boolean;
  onClose: () => void;
  apps: AndroidApp[];
  onCreated: (payload: Required<Pick<api.CreateBuildInput, "app_id" | "version_code" | "version_name">> & {
    app_name: string;
  }) => void;
  onError: (message: string) => void;
};

function NewBuildModal({ open, onClose, apps, onCreated, onError }: NewBuildModalProps) {
  const [activeTab, setActiveTab] = useState<NewBuildTab>("identity");
  const [appId, setAppId] = useState<string>("");
  const [appNameField, setAppNameField] = useState<string>("");
  const [packageName, setPackageName] = useState<string>("");
  const [versionCode, setVersionCode] = useState<number>(241);
  const [versionName, setVersionName] = useState<string>("2.4.1");
  const [startUrl, setStartUrl] = useState<string>("https://");
  const [offlineMessage, setOfflineMessage] = useState<string>(DEFAULT_OFFLINE_MESSAGE);
  const [primaryColor, setPrimaryColor] = useState<string>(DEFAULT_PRIMARY);
  const [backgroundColor, setBackgroundColor] = useState<string>(DEFAULT_BACKGROUND);
  const [splashColor, setSplashColor] = useState<string>(DEFAULT_SPLASH);
  const [allowFileUploads, setAllowFileUploads] = useState<boolean>(true);
  const [allowGeolocation, setAllowGeolocation] = useState<boolean>(false);
  const [allowCamera, setAllowCamera] = useState<boolean>(false);
  const [pullToRefresh, setPullToRefresh] = useState<boolean>(true);
  const [swipeBack, setSwipeBack] = useState<boolean>(true);
  const [branch, setBranch] = useState<string>("main");
  const [releaseNotes, setReleaseNotes] = useState<string>("");
  const [errors, setErrors] = useState<NewBuildErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Track whether the user manually edited app_name / package_name so we don't clobber their edits
  // when they re-pick an app.
  const [appNameDirty, setAppNameDirty] = useState(false);
  const [packageDirty, setPackageDirty] = useState(false);

  // Initialize / reset on open.
  useEffect(() => {
    if (!open) return;
    setActiveTab("identity");
    setErrors({});
    setSubmitting(false);
    setAppNameDirty(false);
    setPackageDirty(false);
    setStartUrl("https://");
    setOfflineMessage(DEFAULT_OFFLINE_MESSAGE);
    setPrimaryColor(DEFAULT_PRIMARY);
    setBackgroundColor(DEFAULT_BACKGROUND);
    setSplashColor(DEFAULT_SPLASH);
    setAllowFileUploads(true);
    setAllowGeolocation(false);
    setAllowCamera(false);
    setPullToRefresh(true);
    setSwipeBack(true);
    setBranch("main");
    setReleaseNotes("");
  }, [open]);

  // Sync app_id default + derive defaults for app_name + package_name from the picked app.
  useEffect(() => {
    if (apps.length === 0) return;
    setAppId((prev) => (prev && apps.some((a) => a.id === prev) ? prev : apps[0]!.id));
  }, [apps]);

  useEffect(() => {
    const app = apps.find((a) => a.id === appId);
    if (!app) return;
    if (!appNameDirty) setAppNameField(app.name);
    if (!packageDirty) setPackageName(app.package_name);
  }, [appId, apps, appNameDirty, packageDirty]);

  function validate(): { ok: boolean; errors: NewBuildErrors; firstTab: NewBuildTab | null } {
    const e: NewBuildErrors = {};
    if (!appId) e.app_id = "Pick an app";
    if (!appNameField.trim()) e.app_name = "Required";
    const pkg = packageName.trim();
    if (!pkg) e.package_name = "Required";
    else if (!PACKAGE_RE.test(pkg)) e.package_name = "Use reverse-domain form, e.g. com.example.app";
    if (!Number.isInteger(versionCode) || versionCode < 1) e.version_code = "Must be an integer ≥ 1";
    if (!versionName.trim()) e.version_name = "Required";

    const url = startUrl.trim();
    if (!url) e.start_url = "Required";
    else if (!/^https?:\/\//i.test(url)) e.start_url = "Must start with http:// or https://";

    if (!HEX_RE.test(primaryColor)) e.primary_color = "Hex like #CDFF3F";
    if (!HEX_RE.test(backgroundColor)) e.background_color = "Hex like #0B0F0E";
    if (!HEX_RE.test(splashColor)) e.splash_color = "Hex like #0B0F0E";

    if (!branch.trim()) e.branch = "Required";

    let firstTab: NewBuildTab | null = null;
    for (const t of TAB_ORDER) {
      if (TAB_FIELD_MAP[t].some((f) => e[f])) {
        firstTab = t;
        break;
      }
    }

    return { ok: Object.keys(e).length === 0, errors: e, firstTab };
  }

  async function submit() {
    if (submitting) return;
    const v = validate();
    setErrors(v.errors);
    if (!v.ok) {
      if (v.firstTab) setActiveTab(v.firstTab);
      return;
    }
    setSubmitting(true);
    const payload: api.CreateBuildInput = {
      app_id: appId,
      app_name: appNameField.trim(),
      package_name: packageName.trim(),
      version_code: versionCode,
      version_name: versionName.trim(),
      start_url: startUrl.trim(),
      primary_color: primaryColor,
      background_color: backgroundColor,
      splash_color: splashColor,
      allow_file_uploads: allowFileUploads,
      allow_geolocation: allowGeolocation,
      allow_camera: allowCamera,
      pull_to_refresh: pullToRefresh,
      swipe_back: swipeBack,
      offline_message: offlineMessage.trim() || DEFAULT_OFFLINE_MESSAGE,
      branch: branch.trim(),
      release_notes: releaseNotes.trim() ? releaseNotes.trim() : undefined,
    };
    try {
      await api.createBuild(payload);
      onCreated({
        app_id: payload.app_id,
        app_name: payload.app_name ?? appNameField.trim(),
        version_code: payload.version_code,
        version_name: payload.version_name,
      });
      onClose();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const dot = (id: NewBuildTab): ReactNode =>
    TAB_FIELD_MAP[id].some((f) => errors[f]) ? (
      <span aria-hidden="true" className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-danger" />
    ) : undefined;

  const tabs = [
    { value: "identity", label: "Identity", trailing: dot("identity") },
    { value: "webview", label: "WebView", trailing: dot("webview") },
    { value: "branding", label: "Branding", trailing: dot("branding") },
    { value: "permissions", label: "Permissions", trailing: dot("permissions") },
    { value: "notes", label: "Notes", trailing: dot("notes") },
  ];

  return (
    <Modal
      open={open}
      onClose={() => { if (!submitting) onClose(); }}
      title="New WebView build"
      description="Configure the wrapper, branding, and permissions. The build runs in an isolated container."
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button
            variant="primary"
            leading={<Icon.Hammer size={14} />}
            onClick={() => { void submit(); }}
            disabled={submitting || apps.length === 0}
          >
            {submitting ? "Queuing…" : "Start build"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Tabs
          value={activeTab}
          onChange={(v) => setActiveTab(v as NewBuildTab)}
          tabs={tabs}
        />

        {activeTab === "identity" && (
          <div className="space-y-4">
            <Field label="App" required error={errors.app_id}>
              <Select
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                options={
                  apps.length === 0
                    ? [{ value: "", label: "No apps available" }]
                    : apps.map((a) => ({ value: a.id, label: `${a.name} · ${a.package_name}` }))
                }
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="App name" required error={errors.app_name} hint="Shown under the launcher icon.">
                <Input
                  value={appNameField}
                  onChange={(e) => { setAppNameField(e.target.value); setAppNameDirty(true); }}
                  invalid={Boolean(errors.app_name)}
                />
              </Field>
              <Field
                label="Package name"
                required
                error={errors.package_name}
                hint="Reverse-domain. Used as the Android applicationId."
              >
                <Input
                  value={packageName}
                  onChange={(e) => { setPackageName(e.target.value); setPackageDirty(true); }}
                  invalid={Boolean(errors.package_name)}
                  placeholder="com.example.app"
                  spellCheck={false}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Version code"
                required
                hint="Integer, must be greater than the last shipped"
                error={errors.version_code}
              >
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={Number.isFinite(versionCode) ? versionCode : 0}
                  onChange={(e) => setVersionCode(e.target.value === "" ? 0 : Number(e.target.value))}
                  invalid={Boolean(errors.version_code)}
                />
              </Field>
              <Field label="Version name" required error={errors.version_name}>
                <Input
                  value={versionName}
                  onChange={(e) => setVersionName(e.target.value)}
                  invalid={Boolean(errors.version_name)}
                  placeholder="2.4.1"
                />
              </Field>
            </div>
          </div>
        )}

        {activeTab === "webview" && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              <Field
                label="Start URL"
                required
                error={errors.start_url}
                hint="The first page the WebView loads on launch."
              >
                <Input
                  type="url"
                  value={startUrl}
                  onChange={(e) => setStartUrl(e.target.value)}
                  invalid={Boolean(errors.start_url)}
                  leading={<Icon.Globe size={13} />}
                  placeholder="https://app.example.com"
                  spellCheck={false}
                />
              </Field>
              <Field
                label="Offline message"
                optional
                hint="Shown when the device has no connectivity."
              >
                <Textarea
                  rows={3}
                  value={offlineMessage}
                  onChange={(e) => setOfflineMessage(e.target.value)}
                  placeholder={DEFAULT_OFFLINE_MESSAGE}
                />
              </Field>
            </div>
            <div className="lg:sticky lg:top-2">
              <MobilePreview
                appName={appNameField || "App"}
                startUrl={startUrl}
                primaryColor={primaryColor}
                backgroundColor={backgroundColor}
                splashColor={splashColor}
              />
            </div>
          </div>
        )}

        {activeTab === "branding" && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              <ColorField
                label="Primary color"
                hint="Status bar tint and accent in the launch screen."
                value={primaryColor}
                onChange={setPrimaryColor}
                error={errors.primary_color}
              />
              <ColorField
                label="Background color"
                hint="Window background while the WebView is loading."
                value={backgroundColor}
                onChange={setBackgroundColor}
                error={errors.background_color}
              />
              <ColorField
                label="Splash color"
                hint="Solid color behind the splash icon."
                value={splashColor}
                onChange={setSplashColor}
                error={errors.splash_color}
              />
            </div>
            <div className="lg:sticky lg:top-2">
              <MobilePreview
                appName={appNameField || "App"}
                startUrl={startUrl}
                primaryColor={primaryColor}
                backgroundColor={backgroundColor}
                splashColor={splashColor}
                compact
              />
            </div>
          </div>
        )}

        {activeTab === "permissions" && (
          <div className="space-y-3">
            <PermissionRow
              label="Allow file uploads"
              description={'Lets the WebView open the system file picker for <input type="file">.'}
              checked={allowFileUploads}
              onChange={setAllowFileUploads}
            />
            <PermissionRow
              label="Allow geolocation"
              description="Adds ACCESS_FINE_LOCATION and prompts the user when requested."
              checked={allowGeolocation}
              onChange={setAllowGeolocation}
            />
            <PermissionRow
              label="Allow camera"
              description="Adds CAMERA + RECORD_AUDIO so getUserMedia works."
              checked={allowCamera}
              onChange={setAllowCamera}
            />
            <PermissionRow
              label="Pull to refresh"
              description="Wraps the WebView in a SwipeRefreshLayout."
              checked={pullToRefresh}
              onChange={setPullToRefresh}
            />
            <PermissionRow
              label="Swipe back"
              description="Edge-swipe gesture navigates WebView history back."
              checked={swipeBack}
              onChange={setSwipeBack}
            />
            <p className="text-[11px] text-bone-low">
              Permissions you disable will not be requested in the manifest.
            </p>
          </div>
        )}

        {activeTab === "notes" && (
          <div className="space-y-4">
            <Field label="Branch" required error={errors.branch}>
              <Input
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                leading={<Icon.Code size={13} />}
                invalid={Boolean(errors.branch)}
              />
            </Field>
            <Field label="Release notes" optional>
              <Textarea
                rows={4}
                placeholder="Visible to the user after install. Markdown supported."
                value={releaseNotes}
                onChange={(e) => setReleaseNotes(e.target.value)}
              />
            </Field>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ===========================================================================
// Mobile preview — renders the start URL inside a phone frame, tinted with
// the chosen branding colors. Many origins block iframe embedding via
// X-Frame-Options or CSP frame-ancestors; we surface that with a clear note
// and an "Open in new tab" affordance instead of trying to detect it
// (cross-origin iframes don't expose load/error reliably).
// ===========================================================================
function MobilePreview({
  appName,
  startUrl,
  primaryColor,
  backgroundColor,
  splashColor,
  compact = false,
  className,
}: {
  appName: string;
  startUrl: string;
  primaryColor: string;
  backgroundColor: string;
  splashColor: string;
  compact?: boolean;
  className?: string;
}) {
  const safePrimary = HEX_RE.test(primaryColor) ? primaryColor : DEFAULT_PRIMARY;
  const safeBackground = HEX_RE.test(backgroundColor) ? backgroundColor : DEFAULT_BACKGROUND;
  const safeSplash = HEX_RE.test(splashColor) ? splashColor : DEFAULT_SPLASH;

  const trimmed = startUrl.trim();
  const previewable =
    /^https?:\/\//i.test(trimmed) && trimmed !== "https://" && trimmed !== "http://";

  // Per-URL iframe key so it remounts when the URL changes (no "Refresh" needed).
  const iframeKey = previewable ? trimmed : "splash";
  const [iframeError, setIframeError] = useState(false);

  useEffect(() => {
    setIframeError(false);
  }, [iframeKey]);

  // Phone-frame dimensions. Compact = small swatch in dense layouts.
  const w = compact ? 240 : 280;
  const h = compact ? 500 : 580;
  const initials =
    appName
      .trim()
      .split(/\s+/)
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "AP";

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-low">
        Mobile preview
      </div>
      <div
        aria-label={`Preview of ${appName}`}
        className="relative shrink-0 rounded-[36px] border-[10px] border-ink-3 bg-ink-3 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.6)]"
        style={{ width: w, height: h }}
      >
        {/* Notch */}
        <div className="absolute left-1/2 top-0 z-10 h-5 w-24 -translate-x-1/2 rounded-b-2xl bg-ink-3" />
        {/* Inner screen */}
        <div
          className="relative h-full w-full overflow-hidden rounded-[26px]"
          style={{ backgroundColor: safeBackground }}
        >
          {/* Status bar — tinted with primary color */}
          <div
            className="flex items-center justify-between px-4 pt-1.5 pb-1 font-mono text-[10px]"
            style={{
              backgroundColor: safePrimary,
              color: contrastOn(safePrimary),
            }}
          >
            <span>9:41</span>
            <span className="flex items-center gap-1">
              <span aria-hidden="true">●●●</span>
              <span aria-hidden="true">▮</span>
            </span>
          </div>
          {/* App bar */}
          <div
            className="flex items-center justify-center border-b border-black/10 px-3 py-2 font-display text-[12px] font-semibold"
            style={{
              backgroundColor: safePrimary,
              color: contrastOn(safePrimary),
            }}
          >
            {appName}
          </div>

          {/* Body */}
          <div
            className="relative h-[calc(100%-48px)] w-full"
            style={{ backgroundColor: safeBackground }}
          >
            {!previewable && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center"
                style={{ backgroundColor: safeSplash }}
              >
                <div
                  className="grid h-12 w-12 place-items-center rounded-2xl font-mono text-[14px] font-semibold"
                  style={{
                    backgroundColor: safePrimary,
                    color: contrastOn(safePrimary),
                  }}
                >
                  {initials}
                </div>
                <div
                  className="font-display text-[12px] font-semibold"
                  style={{ color: contrastOn(safeSplash) }}
                >
                  {appName}
                </div>
                <div
                  className="px-4 text-[10px] opacity-70"
                  style={{ color: contrastOn(safeSplash) }}
                >
                  Enter a Start URL to preview the live page.
                </div>
              </div>
            )}

            {previewable && (
              <iframe
                key={iframeKey}
                src={trimmed}
                title={`${appName} preview`}
                referrerPolicy="no-referrer"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                onError={() => setIframeError(true)}
                className="absolute inset-0 h-full w-full border-0 bg-white"
              />
            )}

            {previewable && iframeError && (
              <div className="absolute inset-0 grid place-items-center bg-ink-1/90 p-4 text-center text-[11px] text-bone-mid">
                Could not load the page in the preview.
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex w-full max-w-[280px] flex-col items-center gap-1">
        {previewable ? (
          <a
            href={trimmed}
            target="_blank"
            rel="noreferrer noopener"
            className="font-mono text-[10px] text-signal hover:underline"
          >
            <Icon.External size={10} className="mr-1 inline -translate-y-px" />
            Open in new tab
          </a>
        ) : (
          <span className="font-mono text-[10px] text-bone-low">Awaiting URL…</span>
        )}
        <span className="text-center text-[10px] text-bone-low">
          Some sites block embedding (X-Frame-Options / CSP). The actual app
          bypasses that — use “Open in new tab” if the preview is blank.
        </span>
      </div>
    </div>
  );
}

// Pick a readable foreground for a given hex background. Accepts #RGB or #RRGGBB.
function contrastOn(hex: string): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#0B0F0E";
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // YIQ luminance: dark fg on light bg, light fg on dark bg.
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 160 ? "#0B0F0E" : "#F5F5EE";
}

function ColorField({
  label,
  value,
  onChange,
  hint,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  error?: string;
}) {
  // The native color picker only accepts 6-digit hex. Fall back to the default if the user has
  // typed something invalid into the text input so the swatch never goes blank.
  const safeColor = HEX_RE.test(value) ? (value.length === 4
    ? `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
    : value) : "#000000";
  return (
    <Field label={label} hint={hint} error={error}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={safeColor}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-9 w-12 cursor-pointer rounded-md border border-line-1 bg-ink-2/60 p-1"
          aria-label={`${label} swatch`}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          invalid={Boolean(error)}
          spellCheck={false}
          className="font-mono uppercase"
          placeholder="#CDFF3F"
        />
      </div>
    </Field>
  );
}

function PermissionRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-line-1 bg-ink-2/40 p-3">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-bone">{label}</div>
        <p className="mt-0.5 text-[11px] text-bone-low">{description}</p>
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

// ===========================================================================
// Build details modal
// ===========================================================================

type BuildDetailsModalProps = {
  build: BuildWithConfig | null;
  apiBaseUrl: string;
  appName: string;
  tab: DetailsTab;
  onTabChange: (t: DetailsTab) => void;
  onClose: () => void;
};

function BuildDetailsModal({ build, apiBaseUrl, appName, tab, onTabChange, onClose }: BuildDetailsModalProps) {
  const open = build !== null;
  const buildId = build?.id ?? null;

  const [logs, setLogs] = useState<string[] | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const { toast } = useToast();

  // Reset logs whenever the modal opens for a different build.
  useEffect(() => {
    if (!open) {
      setLogs(null);
      setLogsError(null);
      setLogsLoading(false);
    }
  }, [open]);

  // Lazy-fetch logs the first time the user lands on the Logs tab for this build.
  useEffect(() => {
    if (!buildId) return;
    if (tab !== "logs") return;
    let cancelled = false;
    setLogs(null);
    setLogsError(null);
    setLogsLoading(true);
    api
      .fetchBuildLogs(buildId)
      .then((lines) => { if (!cancelled) setLogs(lines); })
      .catch((e) => { if (!cancelled) setLogsError(e instanceof Error ? e.message : "Failed to fetch logs"); })
      .finally(() => { if (!cancelled) setLogsLoading(false); });
    return () => { cancelled = true; };
  }, [buildId, tab]);

  async function copyLogs() {
    if (!logs || logs.length === 0) return;
    const ok = await copyToClipboard(logs.join("\n"));
    if (ok) toast({ tone: "success", title: "Logs copied to clipboard" });
    else toast({ tone: "error", title: "Could not copy logs" });
  }

  async function copyZipUrl(href: string) {
    const ok = await copyToClipboard(href);
    if (ok) toast({ tone: "success", title: "ZIP URL copied" });
    else toast({ tone: "error", title: "Could not copy URL" });
  }

  async function copyApkUrl(href: string) {
    const ok = await copyToClipboard(href);
    if (ok) toast({ tone: "success", title: "APK URL copied" });
    else toast({ tone: "error", title: "Could not copy URL" });
  }

  if (!build) return null;

  const zipHref = build.source_zip_url ? `${apiBaseUrl}${build.source_zip_url}` : null;
  const apkHref = build.apk_url ? `${apiBaseUrl}${build.apk_url}` : null;
  const apkSkipped = build.apk_build_skipped === true;
  const apkError = build.apk_build_error ?? null;
  const showApkSection = apkHref !== null || apkSkipped || apkError !== null;
  const cfg = build.config ?? null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${appName || "Build"} · v${build.version_name}`}
      description={`code ${build.version_code} · ${build.id.slice(0, 8)}`}
      size="lg"
      footer={
        tab === "logs" ? (
          <>
            <Button
              variant="secondary"
              size="sm"
              leading={<Icon.Copy size={12} />}
              onClick={() => { void copyLogs(); }}
              disabled={!logs || logs.length === 0}
            >
              Copy logs
            </Button>
            <Button variant="ghost" onClick={onClose}>Close</Button>
          </>
        ) : (
          <Button variant="ghost" onClick={onClose}>Close</Button>
        )
      }
    >
      <div className="space-y-5">
        <Tabs
          value={tab}
          onChange={(v) => onTabChange(v as DetailsTab)}
          tabs={[
            { value: "overview", label: "Overview" },
            { value: "configuration", label: "Configuration" },
            { value: "logs", label: "Logs" },
          ]}
        />

        {tab === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailRow label="Status">
                <StatusPill status={build.status} />
              </DetailRow>
              <DetailRow label="Triggered by">
                <div className="flex items-center gap-2">
                  <Avatar glyph={build.triggered_by[0].toUpperCase()} size={20} />
                  <span className="font-mono text-[12px] text-bone-mid">{build.triggered_by}</span>
                </div>
              </DetailRow>
              <DetailRow label="Started">
                <span className="font-mono text-[12px] text-bone-mid">
                  {dateTime(build.build_started_at)} · {relTime(build.build_started_at)}
                </span>
              </DetailRow>
              <DetailRow label="Completed">
                <span className="font-mono text-[12px] text-bone-mid">
                  {build.build_completed_at
                    ? `${dateTime(build.build_completed_at)} · ${relTime(build.build_completed_at)}`
                    : "—"}
                </span>
              </DetailRow>
              <DetailRow label="Version">
                <span className="font-mono text-[12px] text-bone-mid">
                  {build.version_name} <span className="text-bone-low">(code {build.version_code})</span>
                </span>
              </DetailRow>
              <DetailRow label="Duration">
                <span className="font-mono text-[12px] text-bone-mid">
                  {build.duration_ms ? ms(build.duration_ms) : "—"}
                </span>
              </DetailRow>
            </div>

            <div className="rounded-lg border border-line-1 bg-ink-2/40 p-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-low">Source ZIP</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {zipHref ? (
                  <>
                    <a
                      href={zipHref}
                      download
                      target="_blank"
                      rel="noreferrer"
                      className={DOCS_LINK_CLASSES}
                    >
                      <Icon.External size={14} />
                      Download ZIP
                    </a>
                    <Button
                      variant="ghost"
                      leading={<Icon.Copy size={12} />}
                      onClick={() => { void copyZipUrl(zipHref); }}
                    >
                      Copy ZIP URL
                    </Button>
                  </>
                ) : (
                  <span className="text-[12px] text-bone-low">Source not yet available.</span>
                )}
              </div>
              <p className="mt-3 text-[11px] text-bone-low">
                Unzip and open in Android Studio. Run on a connected device or emulator.
              </p>
            </div>
          </div>
        )}

        {tab === "configuration" && (
          <div className="space-y-5">
            {cfg ? (
              <>
                <MobilePreview
                  appName={cfg.app_name}
                  startUrl={cfg.start_url}
                  primaryColor={cfg.primary_color}
                  backgroundColor={cfg.background_color}
                  splashColor={cfg.splash_color}
                  compact
                  className="mx-auto"
                />
                <ConfigSection
                  title="Identity"
                  rows={[
                    ["App name", <span key="n" className="font-mono text-[12px] text-bone">{cfg.app_name}</span>],
                    ["Package", <span key="p" className="font-mono text-[12px] text-bone">{cfg.package_name}</span>],
                    ["Version", <span key="v" className="font-mono text-[12px] text-bone">{build.version_name} <span className="text-bone-low">(code {build.version_code})</span></span>],
                  ]}
                />
                <ConfigSection
                  title="WebView"
                  rows={[
                    ["Start URL", (
                      <a
                        key="u"
                        href={cfg.start_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[12px] text-signal hover:underline break-all"
                      >
                        {cfg.start_url}
                      </a>
                    )],
                    ["Offline message", <span key="om" className="text-[12px] text-bone-mid">{cfg.offline_message}</span>],
                  ]}
                />
                <ConfigSection
                  title="Branding"
                  rows={[
                    ["Primary", <ColorSwatch key="pc" hex={cfg.primary_color} />],
                    ["Background", <ColorSwatch key="bc" hex={cfg.background_color} />],
                    ["Splash", <ColorSwatch key="sc" hex={cfg.splash_color} />],
                  ]}
                />
                <ConfigSection
                  title="Permissions"
                  rows={[
                    ["File uploads", <BoolBadge key="fu" value={cfg.allow_file_uploads} />],
                    ["Geolocation", <BoolBadge key="ge" value={cfg.allow_geolocation} />],
                    ["Camera", <BoolBadge key="cm" value={cfg.allow_camera} />],
                    ["Pull to refresh", <BoolBadge key="ptr" value={cfg.pull_to_refresh} />],
                    ["Swipe back", <BoolBadge key="sb" value={cfg.swipe_back} />],
                  ]}
                />
                <ConfigSection
                  title="Notes"
                  rows={[
                    ["Release notes", (
                      <span key="rn" className="text-[12px] text-bone-mid whitespace-pre-wrap">
                        {cfg.release_notes && cfg.release_notes.trim().length > 0 ? cfg.release_notes : "—"}
                      </span>
                    )],
                  ]}
                />
              </>
            ) : (
              <div className="rounded-md border border-line-1 bg-ink-2/40 px-3 py-6 text-center text-[12px] text-bone-low">
                Configuration not yet available for this build.
              </div>
            )}
          </div>
        )}

        {tab === "logs" && (
          <div>
            {logsLoading && (
              <div className="font-mono text-[12px] text-bone-low">Loading logs…</div>
            )}
            {!logsLoading && logsError && (
              <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[12px] text-danger">
                {logsError}
              </div>
            )}
            {!logsLoading && !logsError && logs && (
              <pre className="max-h-[420px] overflow-auto rounded-md border border-line-1 bg-ink-2/60 px-3 py-2.5 font-mono text-[12px] leading-relaxed text-bone-mid whitespace-pre-wrap break-words">
                {logs.join("\n")}
              </pre>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-line-1 bg-ink-2/40 px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-low">{label}</div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function ConfigSection({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, ReactNode]>;
}) {
  return (
    <div>
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-low">{title}</div>
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-line-1 bg-line-1 sm:grid-cols-[160px_1fr]">
        {rows.map(([label, value]) => (
          <DetailKV key={label} label={label}>{value}</DetailKV>
        ))}
      </div>
    </div>
  );
}

function DetailKV({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <div className="bg-ink-1 px-3 py-2 font-mono text-[11px] text-bone-low">{label}</div>
      <div className="bg-ink-1 px-3 py-2">{children}</div>
    </>
  );
}

function ColorSwatch({ hex }: { hex: string }) {
  const safe = HEX_RE.test(hex) ? hex : "#000000";
  return (
    <div className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className="inline-block h-5 w-5 rounded border border-line-2"
        style={{ backgroundColor: safe }}
      />
      <span className="font-mono text-[12px] uppercase text-bone">{hex}</span>
    </div>
  );
}

function BoolBadge({ value }: { value: boolean }) {
  return (
    <Badge tone={value ? "signal" : "neutral"} dot>
      {value ? "Yes" : "No"}
    </Badge>
  );
}
