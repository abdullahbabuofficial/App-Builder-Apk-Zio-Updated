import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/Misc";
import { Icon } from "@/lib/icons";
import { bytes, dateTime, ms, relTime } from "@/lib/format";
import { createBuild, fetchBuild } from "@/lib/builds";
import { usePushcare } from "@/context/PushcareDataContext";
import type { ApkBuild } from "@/lib/mock-data";

const REFRESH_MS = 3000;

export function BuildDetail() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { appName, refresh, builds: cachedBuilds } = usePushcare();
  const [build, setBuild] = useState<ApkBuild | null>(() =>
    id ? cachedBuilds.find((b) => b.id === id) ?? null : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [copied, setCopied] = useState<"sha" | "id" | null>(null);
  const pollTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const next = await fetchBuild(id);
      setBuild(next);
      setError(null);
    } catch (err) {
      const cached = cachedBuilds.find((b) => b.id === id) ?? null;
      if (cached) {
        setBuild(cached);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : "Could not load build");
      }
    } finally {
      setLoading(false);
    }
  }, [id, cachedBuilds]);

  useEffect(() => {
    void load();
  }, [load]);

  const isInflight = build?.status === "queued" || build?.status === "building";

  useEffect(() => {
    if (!isInflight) {
      if (pollTimer.current) {
        window.clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
      return;
    }
    pollTimer.current = window.setInterval(() => void load(), REFRESH_MS);
    return () => {
      if (pollTimer.current) {
        window.clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    };
  }, [isInflight, load]);

  const onCopy = useCallback(async (kind: "sha" | "id", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard API unavailable — silent ignore.
    }
  }, []);

  const onRetry = useCallback(async () => {
    if (!build) return;
    setRetrying(true);
    try {
      const next = await createBuild({
        app_id: build.app_id,
        version_name: build.version_name,
        version_code: build.version_code + 1,
        branch: build.branch ?? undefined,
        release_notes: build.release_notes ?? undefined,
      });
      void refresh();
      nav(`/builder/${next.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setRetrying(false);
    }
  }, [build, nav, refresh]);

  const durationLabel = useMemo(() => {
    if (build?.duration_ms != null) return ms(build.duration_ms);
    if (build?.build_started_at && !build.build_completed_at) {
      const elapsed = Date.now() - new Date(build.build_started_at).getTime();
      return `${ms(elapsed)} (running)`;
    }
    return "—";
  }, [build]);

  if (!id) return <EmptyState icon={<Icon.Hammer size={18} />} title="Missing build id" />;

  if (loading && !build) {
    return (
      <>
        <PageHeader
          crumbs={[{ label: "APK Builder", to: "/builder" }, { label: "Loading…" }]}
          title="Loading build…"
        />
        <Card>
          <CardBody>
            <div className="p-8 text-center text-[13px] text-bone-mid">
              Fetching build details…
            </div>
          </CardBody>
        </Card>
      </>
    );
  }

  if (!build) {
    return (
      <EmptyState
        icon={<Icon.Hammer size={18} />}
        title="Build not found"
        description={error ?? "The build you're looking for doesn't exist or you don't have access."}
        action={
          <Link to="/builder">
            <Button variant="primary" leading={<Icon.ArrowLeft size={14} />}>
              Back to APK builder
            </Button>
          </Link>
        }
      />
    );
  }

  const log = build.build_log ?? null;

  return (
    <>
      <PageHeader
        crumbs={[
          { label: "APK Builder", to: "/builder" },
          { label: `${build.version_name} (${build.version_code})` },
        ]}
        title={
          <span className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md border border-line-1 bg-ink-2 text-bone-mid">
              <Icon.Hammer size={16} />
            </div>
            <span>{build.version_name}</span>
            <StatusPill status={build.status} />
          </span>
        }
        description={
          <span className="font-mono text-[12px] text-bone-mid">
            code {build.version_code} · {appName(build.app_id)} · {build.id}
          </span>
        }
        actions={
          <>
            {build.output_url && (
              <a href={build.output_url} target="_blank" rel="noreferrer">
                <Button variant="primary" leading={<Icon.External size={14} />}>
                  Download APK
                </Button>
              </a>
            )}
            {build.status === "failed" && (
              <Button
                variant="secondary"
                leading={<Icon.Hammer size={14} />}
                onClick={() => void onRetry()}
                disabled={retrying}
              >
                {retrying ? "Retrying…" : "Retry build"}
              </Button>
            )}
            <Link to="/builder">
              <Button variant="ghost" leading={<Icon.ArrowLeft size={14} />}>
                All builds
              </Button>
            </Link>
          </>
        }
      />

      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-[12px] text-danger">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Build output" description="Captured stdout/stderr from the build worker." />
          <CardBody padded={false}>
            {isInflight ? (
              <div className="flex items-center gap-3 px-5 py-4 text-[12px] text-bone-mid">
                <span className="live-dot" />
                <span>
                  Auto-refreshing every {Math.round(REFRESH_MS / 1000)}s while the build is{" "}
                  <span className="font-mono text-bone">{build.status}</span>.
                </span>
              </div>
            ) : null}
            {log ? (
              <pre className="max-h-[480px] overflow-auto rounded-b-xl bg-ink-0 px-5 py-4 font-mono text-[11px] leading-relaxed text-bone">
                {log}
              </pre>
            ) : (
              <div className="px-5 py-10 text-center text-[12px] text-bone-low">
                {isInflight ? "Logs will appear once the build emits output." : "No log captured for this build."}
              </div>
            )}
          </CardBody>
          <CardFooter>
            <Badge dot tone="signal">
              {build.status === "success" ? "Done" : isInflight ? "Streaming" : "Final"}
            </Badge>
            {build.error_message ? (
              <span className="font-mono text-[11px] text-danger">{build.error_message}</span>
            ) : (
              <span className="font-mono text-[11px] text-bone-low">build_id {build.id.slice(0, 8)}…</span>
            )}
          </CardFooter>
        </Card>

        <Card>
          <CardHeader title="Metadata" description="What and where this build came from." />
          <CardBody>
            <dl className="space-y-3 text-[12px]">
              <Row label="App" value={appName(build.app_id)} />
              <Row label="Branch" value={build.branch ?? "—"} mono />
              <Row label="Version" value={`${build.version_name} · code ${build.version_code}`} mono />
              <Row label="Triggered by" value={build.triggered_by} mono />
              <Row label="Started" value={dateTime(build.build_started_at)} hint={relTime(build.build_started_at)} />
              <Row
                label="Completed"
                value={build.build_completed_at ? dateTime(build.build_completed_at) : "—"}
                hint={build.build_completed_at ? relTime(build.build_completed_at) : undefined}
              />
              <Row label="Duration" value={durationLabel} />
              <Row label="APK size" value={build.size_bytes != null ? bytes(build.size_bytes) : "—"} />
              <Row
                label="SHA-256"
                value={build.apk_sha256 ?? "—"}
                mono
                action={
                  build.apk_sha256 ? (
                    <button
                      type="button"
                      onClick={() => void onCopy("sha", build.apk_sha256 as string)}
                      className="text-bone-low hover:text-signal"
                      title="Copy SHA-256"
                    >
                      <Icon.Copy size={12} />
                    </button>
                  ) : undefined
                }
                hint={copied === "sha" ? "Copied" : undefined}
              />
              <Row
                label="Build ID"
                value={build.id}
                mono
                action={
                  <button
                    type="button"
                    onClick={() => void onCopy("id", build.id)}
                    className="text-bone-low hover:text-signal"
                    title="Copy build id"
                  >
                    <Icon.Copy size={12} />
                  </button>
                }
                hint={copied === "id" ? "Copied" : undefined}
              />
            </dl>
            {build.release_notes ? (
              <div className="mt-5 rounded-lg border border-line-1 bg-ink-2/40 p-3 text-[12px] text-bone-mid">
                <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-bone-low">
                  Release notes
                </div>
                <div className="whitespace-pre-wrap">{build.release_notes}</div>
              </div>
            ) : null}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function Row({
  label,
  value,
  mono,
  action,
  hint,
}: {
  label: string;
  value: string;
  mono?: boolean;
  action?: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-start gap-2 border-b border-line-1/70 pb-2 last:border-b-0 last:pb-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-low">{label}</dt>
      <dd className={`flex items-start gap-2 ${mono ? "font-mono" : ""} text-bone`}>
        <span className="min-w-0 flex-1 break-all">{value}</span>
        {action}
        {hint ? <span className="text-[10px] text-bone-low">{hint}</span> : null}
      </dd>
    </div>
  );
}
