import { useCallback, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Field } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/Misc";
import { Icon } from "@/lib/icons";
import { commas, dateTime, relTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { usePushcare } from "@/context/PushcareDataContext";
import { createApiKey, revokeApiKey } from "@/lib/apiKeys";
import { isApiNotFound } from "@/lib/api";
import type { ApiKey } from "@/lib/mock-data";

const SCOPE_OPTIONS = [
  { v: "push:send", d: "Send notifications to subscribers" },
  { v: "analytics:read", d: "Read events, devices, and dashboards" },
  { v: "admin:apps", d: "Manage app configuration and FCM credentials" },
] as const;

const RATE_OPTIONS = [600, 1200, 2400, 6000] as const;

export function ApiKeys() {
  const { apiKeys, apps, appName, dataSource, refresh } = usePushcare();
  const live = dataSource !== "mock";

  const [createOpen, setCreateOpen] = useState(false);
  const [revealKey, setRevealKey] = useState<{ key: ApiKey; full: string } | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formAppId, setFormAppId] = useState<string>(apps[0]?.id ?? "");
  const [formScopes, setFormScopes] = useState<Set<string>>(new Set(["push:send"]));
  const [formRate, setFormRate] = useState<number>(600);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Pending UI state for revoke
  const [revoking, setRevoking] = useState<Set<string>>(new Set());
  const [pageError, setPageError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setFormName("");
    setFormAppId(apps[0]?.id ?? "");
    setFormScopes(new Set(["push:send"]));
    setFormRate(600);
    setFormError(null);
  }, [apps]);

  const openCreate = useCallback(() => {
    resetForm();
    setCreateOpen(true);
  }, [resetForm]);

  const handleSubmit = useCallback(async () => {
    if (!formName.trim() || !formAppId || formScopes.size === 0) {
      setFormError("Name, app, and at least one scope are required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      if (live) {
        try {
          const result = await createApiKey({
            name: formName.trim(),
            app_id: formAppId,
            scopes: Array.from(formScopes),
            rate_limit_rpm: formRate,
          });
          setCreateOpen(false);
          setRevealKey({ key: result.key, full: result.key_full });
          void refresh();
          return;
        } catch (err) {
          if (!isApiNotFound(err)) throw err;
          // 404 — local-api hasn't shipped /api/api-keys POST yet. Fall through
          // to the mock branch with a console warning so we don't block UI.
          console.warn("[apiKeys] /api/api-keys not implemented yet — using mock fallback");
        }
      }

      // Mock fallback (or no live API at all): synthesize a key locally so the
      // user sees the reveal UX. The new key won't persist to refresh().
      const id = crypto.randomUUID();
      const fakeFull =
        "sk_live_" + Array.from({ length: 48 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
      const fakeKey: ApiKey = {
        id,
        app_id: formAppId,
        name: formName.trim(),
        key_preview: fakeFull.slice(0, 12) + "…" + fakeFull.slice(-4),
        scopes: Array.from(formScopes),
        rate_limit_rpm: formRate,
        is_active: true,
        last_used_at: null,
        expires_at: null,
        created_at: new Date().toISOString(),
      };
      setCreateOpen(false);
      setRevealKey({ key: fakeKey, full: fakeFull });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSubmitting(false);
    }
  }, [formName, formAppId, formScopes, formRate, live, refresh]);

  const handleRevoke = useCallback(
    async (k: ApiKey) => {
      if (!confirm(`Revoke ${k.name}? This cannot be undone.`)) return;
      setRevoking((prev) => new Set(prev).add(k.id));
      setPageError(null);
      try {
        if (live) {
          try {
            await revokeApiKey(k.id);
            void refresh();
          } catch (err) {
            if (!isApiNotFound(err)) throw err;
            console.warn("[apiKeys] /api/api-keys/:id DELETE not implemented yet");
          }
        }
      } catch (e) {
        setPageError(e instanceof Error ? e.message : "Revoke failed");
      } finally {
        setRevoking((prev) => {
          const next = new Set(prev);
          next.delete(k.id);
          return next;
        });
      }
    },
    [live, refresh],
  );

  const liveCount = useMemo(
    () => apiKeys.filter((k) => k.key_preview.startsWith("sk_live") && k.is_active).length,
    [apiKeys],
  );
  const testCount = useMemo(
    () => apiKeys.filter((k) => k.key_preview.startsWith("sk_test")).length,
    [apiKeys],
  );
  const expiringCount = useMemo(
    () =>
      apiKeys.filter(
        (k) => k.expires_at && +new Date(k.expires_at) - Date.now() < 30 * 86400_000,
      ).length,
    [apiKeys],
  );

  return (
    <>
      <PageHeader
        eyebrow="DEVELOPERS"
        title="API Keys"
        description="Programmatic access to push, analytics, and admin endpoints. Keys are written once — store them in a secret manager."
        actions={
          <>
            <Button variant="secondary" leading={<Icon.External size={14} />}>
              API reference
            </Button>
            <Button
              variant="primary"
              leading={<Icon.Plus size={14} />}
              onClick={openCreate}
            >
              Create key
            </Button>
          </>
        }
      />

      {pageError && (
        <div className="mb-5 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-[12px] text-danger">
          {pageError}
        </div>
      )}

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <InfoTile
          icon={<Icon.Key size={16} />}
          tone="signal"
          title="Live"
          desc="Server-side keys for production traffic"
          count={liveCount}
        />
        <InfoTile
          icon={<Icon.Code size={16} />}
          tone="info"
          title="Test"
          desc="Sandbox keys for staging environments"
          count={testCount}
        />
        <InfoTile
          icon={<Icon.Alert size={16} />}
          tone="warn"
          title="Expiring soon"
          desc="Within the next 30 days"
          count={expiringCount}
        />
      </div>

      {apiKeys.length === 0 ? (
        <EmptyState
          icon={<Icon.Key size={18} />}
          title="No API keys yet"
          description="Create your first key to start integrating."
          action={
            <Button
              variant="primary"
              leading={<Icon.Plus size={14} />}
              onClick={openCreate}
            >
              Create key
            </Button>
          }
        />
      ) : (
        <Card>
          <CardHeader title={`${apiKeys.length} keys`} description="Sorted by most recently used" />
          <CardBody padded={false}>
            <ul>
              {apiKeys.map((k) => {
                const isLive = k.key_preview.startsWith("sk_live");
                return (
                  <li
                    key={k.id}
                    className="grid grid-cols-1 gap-3 border-b border-line-1/70 px-5 py-4 last:border-b-0 hover:bg-ink-2/60 sm:grid-cols-[1fr_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-[14px] font-semibold text-bone">
                          {k.name}
                        </span>
                        <Badge tone={isLive ? "signal" : "info"} dot>
                          {isLive ? "live" : "test"}
                        </Badge>
                        {!k.is_active && (
                          <Badge tone="danger" dot>
                            Revoked
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[12px] text-bone-mid">
                        <span className="truncate">{k.key_preview}</span>
                        <button
                          type="button"
                          className="text-bone-low hover:text-signal"
                          aria-label="Copy preview"
                          onClick={() => void navigator.clipboard?.writeText(k.key_preview)}
                        >
                          <Icon.Copy size={12} />
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-bone-low">
                        <span>{appName(k.app_id)}</span>
                        <span>·</span>
                        <span>Last used {k.last_used_at ? relTime(k.last_used_at) : "never"}</span>
                        <span>·</span>
                        <span>{commas(k.rate_limit_rpm)}/min</span>
                        {k.expires_at && (
                          <>
                            <span>·</span>
                            <span>Expires {dateTime(k.expires_at)}</span>
                          </>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        {k.scopes.map((s) => (
                          <span
                            key={s}
                            className="rounded bg-ink-3/60 px-1.5 py-0.5 font-mono text-[10px] text-bone-mid"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* TODO: edit modal — wire when /api/api-keys/:id PATCH lands */}
                      <Button variant="ghost" size="sm" leading={<Icon.Edit size={12} />} disabled>
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        leading={<Icon.Trash size={12} />}
                        disabled={!k.is_active || revoking.has(k.id)}
                        onClick={() => handleRevoke(k)}
                      >
                        {revoking.has(k.id) ? "Revoking…" : "Revoke"}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      )}

      <Modal
        open={createOpen}
        onClose={() => {
          if (submitting) return;
          setCreateOpen(false);
        }}
        title="Create a new API key"
        description="Keys are written once. Copy and store securely; you won't be able to see this value again."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              leading={<Icon.Plus size={14} />}
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "Creating…" : "Create key"}
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
          <Field label="Name" required hint="A short, recognizable label.">
            <Input
              placeholder="ci-bot · production"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
          </Field>
          <Field label="App" required>
            <Select
              value={formAppId}
              onChange={(e) => setFormAppId(e.target.value)}
              options={apps.map((a) => ({ value: a.id, label: a.name }))}
            />
          </Field>
          <Field label="Scopes" required>
            <div className="space-y-2 rounded-lg border border-line-1 bg-ink-2/40 p-3">
              {SCOPE_OPTIONS.map((s) => {
                const checked = formScopes.has(s.v);
                return (
                  <label
                    key={s.v}
                    className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-ink-3/40"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setFormScopes((prev) => {
                          const next = new Set(prev);
                          if (next.has(s.v)) next.delete(s.v);
                          else next.add(s.v);
                          return next;
                        })
                      }
                      className="h-3.5 w-3.5 rounded border-line-2 bg-ink-2 text-signal focus:ring-signal/30"
                    />
                    <span className="flex-1 font-mono text-[12px] text-bone">{s.v}</span>
                    <span className="text-[11px] text-bone-low">{s.d}</span>
                  </label>
                );
              })}
            </div>
          </Field>
          <Field label="Rate limit (req/min)" required>
            <Select
              value={String(formRate)}
              onChange={(e) => setFormRate(Number(e.target.value))}
              options={RATE_OPTIONS.map((v) => ({
                value: String(v),
                label: commas(v) + " req/min",
              }))}
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={!!revealKey}
        onClose={() => setRevealKey(null)}
        title="Reveal API key"
        size="md"
        footer={
          <Button variant="primary" onClick={() => setRevealKey(null)}>
            Done
          </Button>
        }
      >
        <div className="rounded-lg border border-warn/30 bg-warn/5 p-3 text-[12px] text-bone-mid">
          <div className="flex items-start gap-2">
            <Icon.Alert size={14} className="mt-0.5 shrink-0 text-warn" />
            <span>
              This is the full secret — it won't be shown again. Copy and store it in a secret
              manager.
            </span>
          </div>
        </div>
        {revealKey && (
          <div className="mt-4 space-y-3">
            <div className="font-mono text-[11px] text-bone-low">
              {revealKey.key.name} · {appName(revealKey.key.app_id)}
            </div>
            <div className="flex items-center gap-2 rounded-md border border-line-1 bg-ink-2 p-3 font-mono text-[12px]">
              <span className="flex-1 break-all text-bone">{revealKey.full}</span>
              <Button
                variant="secondary"
                size="sm"
                leading={<Icon.Copy size={12} />}
                onClick={() => void navigator.clipboard?.writeText(revealKey.full)}
              >
                Copy
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function InfoTile({
  icon,
  tone,
  title,
  desc,
  count,
}: {
  icon: React.ReactNode;
  tone: "signal" | "info" | "warn";
  title: string;
  desc: string;
  count: number;
}) {
  return (
    <div className="rounded-xl border border-line-1 bg-ink-1 p-5">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "grid h-10 w-10 place-items-center rounded-md",
            tone === "signal" && "bg-signal/15 text-signal",
            tone === "info" && "bg-info/15 text-info",
            tone === "warn" && "bg-warn/15 text-warn",
          )}
        >
          {icon}
        </div>
        <div>
          <div className="text-[13px] font-medium text-bone">{title}</div>
          <div className="text-[11px] text-bone-low">{desc}</div>
        </div>
        <div className="ml-auto font-display text-[28px] font-semibold text-bone num">{count}</div>
      </div>
    </div>
  );
}
