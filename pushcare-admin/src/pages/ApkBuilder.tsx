import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Field, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Tabs } from "@/components/ui/Tabs";
import { StatusPill, Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState, Avatar } from "@/components/ui/Misc";
import { Icon } from "@/lib/icons";
import { bytes, commas, ms, relTime } from "@/lib/format";
import type { ApkBuild } from "@/lib/mock-data";
import { usePushcare } from "@/context/PushcareDataContext";
import { createBuild } from "@/lib/builds";
import { isApiNotFound } from "@/lib/api";

type StatusFilter = "all" | ApkBuild["status"];

export function ApkBuilder() {
  const navigate = useNavigate();
  const { builds, apps, appName, dataSource, refresh } = usePushcare();
  const live = dataSource !== "mock";

  const [tab, setTab] = useState<StatusFilter>("all");
  const [appFilter, setAppFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);

  // Local optimistic builds (for mock-mode and the brief window before refresh)
  const [optimistic, setOptimistic] = useState<ApkBuild[]>([]);

  // Modal form state
  const [formAppId, setFormAppId] = useState<string>(apps[0]?.id ?? "");
  const [formVersionCode, setFormVersionCode] = useState<string>("241");
  const [formVersionName, setFormVersionName] = useState<string>("2.4.1");
  const [formBranch, setFormBranch] = useState<string>("main");
  const [formNotes, setFormNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const allBuilds = useMemo<ApkBuild[]>(() => {
    // Merge optimistic on top, dedupe by id.
    const seen = new Set(builds.map((b) => b.id));
    return [...optimistic.filter((b) => !seen.has(b.id)), ...builds];
  }, [builds, optimistic]);

  const filtered = useMemo(() => {
    return allBuilds.filter((b) => {
      if (tab !== "all" && b.status !== tab) return false;
      if (appFilter !== "all" && b.app_id !== appFilter) return false;
      return true;
    });
  }, [tab, appFilter, allBuilds]);

  const stats = useMemo(() => {
    const lastWeek = allBuilds.filter(
      (b) => Date.now() - +new Date(b.build_started_at) < 7 * 86400_000,
    );
    return {
      total: allBuilds.length,
      success: allBuilds.filter((b) => b.status === "success").length,
      failed: allBuilds.filter((b) => b.status === "failed").length,
      inflight: allBuilds.filter((b) => b.status === "building" || b.status === "queued").length,
      lastWeek: lastWeek.length,
      avgDuration: Math.round(
        allBuilds.filter((b) => b.duration_ms).reduce((s, b) => s + (b.duration_ms ?? 0), 0) /
          Math.max(1, allBuilds.filter((b) => b.duration_ms).length),
      ),
    };
  }, [allBuilds]);

  const resetForm = useCallback(() => {
    setFormAppId(apps[0]?.id ?? "");
    setFormVersionCode("241");
    setFormVersionName("2.4.1");
    setFormBranch("main");
    setFormNotes("");
    setFormError(null);
  }, [apps]);

  const openModal = useCallback(() => {
    resetForm();
    setOpen(true);
  }, [resetForm]);

  const synthBuild = useCallback((): ApkBuild => {
    return {
      id: crypto.randomUUID(),
      app_id: formAppId,
      version_code: parseInt(formVersionCode, 10) || 0,
      version_name: formVersionName.trim() || "0.0.0",
      status: "queued",
      build_started_at: new Date().toISOString(),
      build_completed_at: null,
      duration_ms: null,
      size_bytes: null,
      output_url: null,
      triggered_by: "you",
    };
  }, [formAppId, formVersionCode, formVersionName]);

  const handleSubmit = useCallback(async () => {
    const versionCodeInt = parseInt(formVersionCode, 10);
    if (!formAppId || !formVersionName.trim() || !Number.isFinite(versionCodeInt)) {
      setFormError("App, version name, and integer version code are required.");
      return;
    }

    setSubmitting(true);
    setFormError(null);

    // Optimistic insert
    const optimisticRow = synthBuild();
    setOptimistic((prev) => [optimisticRow, ...prev]);

    try {
      if (live) {
        try {
          const created = await createBuild({
            app_id: formAppId,
            version_name: formVersionName.trim(),
            version_code: versionCodeInt,
            branch: formBranch.trim() || undefined,
            release_notes: formNotes.trim() || undefined,
          });
          // Replace optimistic with the real row
          setOptimistic((prev) => prev.map((b) => (b.id === optimisticRow.id ? created : b)));
          void refresh();
        } catch (err) {
          if (!isApiNotFound(err)) {
            // Roll back on real errors
            setOptimistic((prev) => prev.filter((b) => b.id !== optimisticRow.id));
            throw err;
          }
          console.warn("[apkBuilder] /api/builds POST not implemented yet — keeping local row");
        }
      }
      setOpen(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Build failed");
    } finally {
      setSubmitting(false);
    }
  }, [
    formAppId,
    formVersionCode,
    formVersionName,
    formBranch,
    formNotes,
    live,
    synthBuild,
    refresh,
  ]);

  return (
    <>
      <PageHeader
        eyebrow="DEVELOPERS"
        title="APK Builder"
        description="Build, sign, and distribute Android packages from any branch. Cached layers, parallel jobs, and reproducible outputs."
        actions={
          <>
            <Button variant="secondary" leading={<Icon.External size={14} />}>
              Open docs
            </Button>
            <Button variant="primary" leading={<Icon.Plus size={14} />} onClick={openModal}>
              New build
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Builds · 7d"
          value={commas(stats.lastWeek)}
          hint={`${stats.total} total`}
          emphasis
        />
        <StatCard
          label="Success rate"
          value={`${((stats.success / Math.max(1, stats.total)) * 100).toFixed(1)}%`}
          deltaPct={1.4}
        />
        <StatCard label="Avg duration" value={ms(stats.avgDuration)} hint="median per job" />
        <StatCard label="In flight" value={String(stats.inflight)} hint={`${stats.failed} failed`} />
      </div>

      <Card className="mt-6 mb-5">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <Select
            value={appFilter}
            onChange={(e) => setAppFilter(e.target.value)}
            options={[
              { value: "all", label: "All apps" },
              ...apps.map((a) => ({ value: a.id, label: a.name })),
            ]}
            className="sm:w-56"
          />
          <Tabs
            variant="segmented"
            value={tab}
            onChange={(v) => setTab(v as StatusFilter)}
            tabs={[
              { value: "all", label: "All", count: allBuilds.length },
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
          action={
            <Button variant="primary" leading={<Icon.Plus size={14} />} onClick={openModal}>
              New build
            </Button>
          }
        />
      ) : (
        <Card>
          <CardHeader title={`${commas(filtered.length)} builds`} />
          <CardBody padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-line-1 text-bone-low">
                    <th className="px-5 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em]">
                      Build
                    </th>
                    <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em]">
                      Status
                    </th>
                    <th className="hidden px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em] sm:table-cell">
                      App
                    </th>
                    <th className="hidden px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.14em] md:table-cell">
                      Duration
                    </th>
                    <th className="hidden px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.14em] lg:table-cell">
                      Size
                    </th>
                    <th className="hidden px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.14em] xl:table-cell">
                      By
                    </th>
                    <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.14em]">
                      Started
                    </th>
                    <th className="px-5 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b) => (
                    <tr
                      key={b.id}
                      onClick={() => navigate(`/builder/${b.id}`)}
                      className="cursor-pointer border-b border-line-1/70 last:border-b-0 hover:bg-ink-2/60"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="grid h-9 w-9 shrink-0 place-items-center rounded border border-line-1 bg-ink-2 text-bone-low">
                            <Icon.Hammer size={14} />
                          </div>
                          <div>
                            <div className="font-mono text-[12px] font-medium text-bone">
                              {b.version_name}
                            </div>
                            <div className="font-mono text-[10px] text-bone-low">
                              code {b.version_code} · {b.id.slice(0, 8)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={b.status} />
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <span className="text-bone-mid">{appName(b.app_id)}</span>
                      </td>
                      <td className="hidden px-4 py-3 text-right font-mono num text-bone-mid md:table-cell">
                        {b.duration_ms ? ms(b.duration_ms) : "—"}
                      </td>
                      <td className="hidden px-4 py-3 text-right font-mono num text-bone-mid lg:table-cell">
                        {b.size_bytes ? bytes(b.size_bytes) : "—"}
                      </td>
                      <td className="hidden px-4 py-3 xl:table-cell">
                        <div className="flex items-center gap-2">
                          <Avatar
                            glyph={(b.triggered_by[0] ?? "?").toUpperCase()}
                            size={22}
                          />
                          <span className="font-mono text-[11px] text-bone-mid">
                            {b.triggered_by}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-bone-mid">{relTime(b.build_started_at)}</span>
                      </td>
                      <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {b.output_url ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            leading={<Icon.External size={12} />}
                            onClick={() => window.open(b.output_url!, "_blank")}
                          >
                            Download
                          </Button>
                        ) : b.status === "failed" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            leading={<Icon.Code size={12} />}
                            onClick={() => navigate(`/builder/${b.id}`)}
                            title="View build log"
                          >
                            Logs
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="View build"
                            onClick={() => navigate(`/builder/${b.id}`)}
                          >
                            <Icon.ArrowRight size={14} />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
          <CardFooter>
            <Badge dot tone="signal">
              Signed APKs · v2 signing scheme
            </Badge>
            <span className="font-mono text-[11px] text-bone-low">
              Artifacts retained 90d · Cache warmed nightly
            </span>
          </CardFooter>
        </Card>
      )}

      <Modal
        open={open}
        onClose={() => {
          if (submitting) return;
          setOpen(false);
        }}
        title="Trigger a new build"
        description="Builds run in an isolated container. You'll get a download link when they complete."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              leading={<Icon.Hammer size={14} />}
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "Starting…" : "Start build"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-[12px] text-danger">
              {formError}
            </div>
          )}
          <Field label="App" required>
            <Select
              value={formAppId}
              onChange={(e) => setFormAppId(e.target.value)}
              options={apps.map((a) => ({
                value: a.id,
                label: `${a.name} · ${a.package_name}`,
              }))}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Version code" required hint="Integer, must be greater than the last shipped">
              <Input
                type="number"
                value={formVersionCode}
                onChange={(e) => setFormVersionCode(e.target.value)}
              />
            </Field>
            <Field label="Version name" required>
              <Input
                value={formVersionName}
                onChange={(e) => setFormVersionName(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Branch" required>
            <Input
              value={formBranch}
              onChange={(e) => setFormBranch(e.target.value)}
              leading={<Icon.Code size={13} />}
            />
          </Field>
          <Field label="Release notes" optional>
            <Textarea
              rows={3}
              placeholder="Visible to the user after install. Markdown supported."
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}
