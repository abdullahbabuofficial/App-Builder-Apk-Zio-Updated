import { useEffect, useMemo, useState, type FormEvent } from "react";
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
import { cn, copyToClipboard } from "@/lib/utils";
import { useApkzio } from "@/context/ApkzioDataContext";
import { useToast } from "@/components/ui/Toast";
import * as api from "@/lib/api";
import type { ApiKey } from "@/lib/mock-data";

const SCOPE_OPTIONS = [
  { v: "push:send", d: "Send notifications to subscribers" },
  { v: "analytics:read", d: "Read events, devices, and dashboards" },
  { v: "admin:apps", d: "Manage app configuration and FCM credentials" },
] as const;

function syntheticApiKey(input: {
  app_id: string;
  name: string;
  scopes: string[];
  rate_limit_rpm: number;
}): { api_key: ApiKey; secret: string } {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const tail = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const secret = `sk_test_${tail}`;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  return {
    secret,
    api_key: {
      id,
      app_id: input.app_id,
      name: input.name,
      key_preview: `${secret.slice(0, 12)}…`,
      scopes: input.scopes,
      rate_limit_rpm: input.rate_limit_rpm,
      is_active: true,
      last_used_at: null,
      expires_at: null,
      created_at: now,
    },
  };
}

export function ApiKeys() {
  const { apiKeys, apps, appName, refresh, dataSource } = useApkzio();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [keyName, setKeyName] = useState("");
  const [appId, setAppId] = useState("");
  const [scopes, setScopes] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SCOPE_OPTIONS.map((s) => [s.v, s.v === "push:send"])),
  );
  const [rateLimitRpm, setRateLimitRpm] = useState(600);

  const [oneTimeSecret, setOneTimeSecret] = useState<{ secret: string; label: string } | null>(null);

  const [mockCreatedKeys, setMockCreatedKeys] = useState<ApiKey[]>([]);
  const [mockRevokedIds, setMockRevokedIds] = useState<Set<string>>(() => new Set());

  const [pendingRevokeId, setPendingRevokeId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const displayKeys = useMemo(() => {
    let list: ApiKey[];
    if (dataSource === "mock") {
      const merged = [...mockCreatedKeys, ...apiKeys];
      const byId = new Map(merged.map((k) => [k.id, k]));
      list = Array.from(byId.values()).map((k) =>
        mockRevokedIds.has(k.id) ? { ...k, is_active: false } : k,
      );
    } else {
      list = apiKeys.map((k) => ({ ...k }));
    }
    return list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  }, [dataSource, apiKeys, mockCreatedKeys, mockRevokedIds]);

  const canCreateViaRest = dataSource === "rest";
  const keysMutable = dataSource === "rest" || dataSource === "mock";

  useEffect(() => {
    if (!createOpen) return;
    setKeyName("");
    setAppId(apps[0]?.id ?? "");
    setScopes(Object.fromEntries(SCOPE_OPTIONS.map((s) => [s.v, s.v === "push:send"])));
    setRateLimitRpm(600);
    setCreateError(null);
  }, [createOpen, apps]);

  useEffect(() => {
    if (createOpen && apps.length && !appId) {
      setAppId(apps[0]!.id);
    }
  }, [createOpen, apps, appId]);

  async function handleCopyPreview(text: string) {
    const ok = await copyToClipboard(text);
    if (ok) toast({ tone: "success", title: "Preview copied" });
    else toast({ tone: "error", title: "Could not copy" });
  }

  async function handleCopySecret(secret: string) {
    const ok = await copyToClipboard(secret);
    if (ok) toast({ tone: "success", title: "Secret copied to clipboard" });
    else toast({ tone: "error", title: "Could not copy secret" });
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const trimmed = keyName.trim();
    if (!trimmed) {
      setCreateError("Name is required.");
      return;
    }
    if (!appId) {
      setCreateError("Select an app.");
      return;
    }
    const scopeList = SCOPE_OPTIONS.filter((s) => scopes[s.v]).map((s) => s.v);
    if (!scopeList.length) {
      setCreateError("Select at least one scope.");
      return;
    }

    if (dataSource === "supabase") {
      toast({
        tone: "error",
        title: "Not available in Supabase mode",
        description: "Set VITE_APKZIO_DATA_SOURCE=rest and configure the HTTP API to create keys.",
      });
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      if (canCreateViaRest) {
        const { api_key, secret } = await api.createApiKey({
          app_id: appId,
          name: trimmed,
          scopes: scopeList,
          rate_limit_rpm: rateLimitRpm,
        });
        setCreateOpen(false);
        setOneTimeSecret({ secret, label: api_key.name });
        await refresh();
        toast({ tone: "success", title: "API key created" });
      } else {
        const { api_key, secret } = syntheticApiKey({
          app_id: appId,
          name: trimmed,
          scopes: scopeList,
          rate_limit_rpm: rateLimitRpm,
        });
        setMockCreatedKeys((prev) => [api_key, ...prev]);
        setCreateOpen(false);
        setOneTimeSecret({ secret, label: api_key.name });
        toast({ tone: "success", title: "API key created (demo)" });
      }
    } catch (err) {
      toast({
        tone: "error",
        title: "Could not create key",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setCreating(false);
    }
  }

  async function runRevoke(id: string) {
    if (dataSource === "supabase") {
      toast({
        tone: "error",
        title: "Not available in Supabase mode",
        description: "Use REST data source to revoke keys on the API.",
      });
      setPendingRevokeId(null);
      return;
    }

    setRevokingId(id);
    try {
      if (canCreateViaRest) {
        await api.revokeApiKey(id);
        await refresh();
        toast({ tone: "success", title: "Key revoked" });
      } else {
        setMockRevokedIds((prev) => new Set(prev).add(id));
        toast({ tone: "success", title: "Key revoked" });
      }
    } catch (err) {
      toast({
        tone: "error",
        title: "Could not revoke key",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setRevokingId(null);
      setPendingRevokeId(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="DEVELOPERS"
        title="API Keys"
        description="Programmatic access to push, analytics, and admin endpoints. Keys are written once — store them in a secret manager."
        actions={
          <>
            <Button variant="secondary" leading={<Icon.External size={14} />}>API reference</Button>
            <Button
              variant="primary"
              leading={<Icon.Plus size={14} />}
              onClick={() => (keysMutable ? setCreateOpen(true) : toast({
                tone: "error",
                title: "Not available",
                description: "Create keys when using mock data or the REST API data source.",
              }))}
            >
              Create key
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <InfoTile
          icon={<Icon.Key size={16} />}
          tone="signal"
          title="Live"
          desc="Server-side keys for production traffic"
          count={displayKeys.filter((k) => k.key_preview.startsWith("sk_live") && k.is_active).length}
        />
        <InfoTile
          icon={<Icon.Code size={16} />}
          tone="info"
          title="Test"
          desc="Sandbox keys for staging environments"
          count={displayKeys.filter((k) => k.key_preview.startsWith("sk_test")).length}
        />
        <InfoTile
          icon={<Icon.Alert size={16} />}
          tone="warn"
          title="Expiring soon"
          desc="Within the next 30 days"
          count={displayKeys.filter((k) => k.expires_at && +new Date(k.expires_at) - Date.now() < 30 * 86400_000).length}
        />
      </div>

      {displayKeys.length === 0 ? (
        <EmptyState icon={<Icon.Key size={18} />} title="No API keys yet" description="Create your first key to start integrating." action={<Button variant="primary" leading={<Icon.Plus size={14} />} onClick={() => (keysMutable ? setCreateOpen(true) : toast({
          tone: "error",
          title: "Not available",
          description: "Create keys when using mock data or the REST API data source.",
        }))}>Create key</Button>} />
      ) : (
        <Card>
          <CardHeader title={`${displayKeys.length} keys`} description="Sorted by most recently used" />
          <CardBody padded={false}>
            <ul>
              {displayKeys.map((k) => {
                const isLive = k.key_preview.startsWith("sk_live");
                return (
                  <li key={k.id} className="grid grid-cols-1 gap-3 border-b border-line-1/70 px-5 py-4 last:border-b-0 hover:bg-ink-2/60 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-[14px] font-semibold text-bone">{k.name}</span>
                        <Badge tone={isLive ? "signal" : "info"} dot>{isLive ? "live" : "test"}</Badge>
                        {!k.is_active && <Badge tone="danger" dot>Revoked</Badge>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[12px] text-bone-mid">
                        <span className="truncate">{k.key_preview}</span>
                        <button
                          type="button"
                          onClick={() =>
                            toast({
                              tone: "info",
                              title: "Secret not available",
                              description: "The full secret is shown only once when the key is created.",
                            })}
                          className="text-bone-low hover:text-signal"
                          aria-label="About reveal"
                        >
                          <Icon.Eye size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleCopyPreview(k.key_preview)}
                          className="text-bone-low hover:text-signal"
                          aria-label="Copy preview"
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
                        {k.expires_at && (<><span>·</span><span>Expires {dateTime(k.expires_at)}</span></>)}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        {k.scopes.map((s) => (
                          <span key={s} className="rounded bg-ink-3/60 px-1.5 py-0.5 font-mono text-[10px] text-bone-mid">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="ghost" size="sm" leading={<Icon.Edit size={12} />}>Edit</Button>
                      {pendingRevokeId === k.id ? (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => setPendingRevokeId(null)} disabled={revokingId === k.id}>
                            Cancel
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => void runRevoke(k.id)}
                            disabled={!k.is_active || revokingId === k.id}
                          >
                            {revokingId === k.id ? "Revoking…" : "Confirm revoke"}
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="danger"
                          size="sm"
                          leading={<Icon.Trash size={12} />}
                          disabled={!k.is_active || !keysMutable}
                          onClick={() => {
                            if (!keysMutable) {
                              toast({
                                tone: "error",
                                title: "Not available",
                                description: "Revoke keys when using mock data or the REST API data source.",
                              });
                              return;
                            }
                            setPendingRevokeId(k.id);
                          }}
                        >
                          Revoke
                        </Button>
                      )}
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
          if (!creating) setCreateOpen(false);
        }}
        title="Create a new API key"
        description="Keys are written once. Copy and store securely; you won't be able to see this value again."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button>
            <Button
              variant="primary"
              type="submit"
              form="create-api-key-form"
              leading={<Icon.Plus size={14} />}
              disabled={creating || !apps.length}
            >
              {creating ? "Creating…" : "Create key"}
            </Button>
          </>
        }
      >
        <form id="create-api-key-form" onSubmit={(e) => void handleCreate(e)} className="space-y-4">
          {createError && (
            <div className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-[12px] text-danger">
              {createError}
            </div>
          )}
          <Field label="Name" required hint="A short, recognizable label.">
            <Input
              placeholder="ci-bot · production"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              disabled={creating}
            />
          </Field>
          <Field label="App" required>
            <Select
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              disabled={creating || !apps.length}
              options={
                apps.length
                  ? apps.map((a) => ({ value: a.id, label: a.name }))
                  : [{ value: "", label: "No apps available" }]
              }
            />
          </Field>
          <Field label="Scopes" required>
            <div className="space-y-2 rounded-lg border border-line-1 bg-ink-2/40 p-3">
              {SCOPE_OPTIONS.map((s) => (
                <label key={s.v} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-ink-3/40">
                  <input
                    type="checkbox"
                    checked={Boolean(scopes[s.v])}
                    onChange={() => setScopes((prev) => ({ ...prev, [s.v]: !prev[s.v] }))}
                    disabled={creating}
                    className="h-3.5 w-3.5 rounded border-line-2 bg-ink-2 text-signal focus:ring-signal/30"
                  />
                  <span className="flex-1 font-mono text-[12px] text-bone">{s.v}</span>
                  <span className="text-[11px] text-bone-low">{s.d}</span>
                </label>
              ))}
            </div>
          </Field>
          <Field label="Rate limit (req/min)" required>
            <Select
              value={String(rateLimitRpm)}
              onChange={(e) => setRateLimitRpm(Number(e.target.value))}
              disabled={creating}
              options={[600, 1200, 2400, 6000].map((v) => ({ value: String(v), label: commas(v) + " req/min" }))}
            />
          </Field>
        </form>
      </Modal>

      <Modal
        open={!!oneTimeSecret}
        onClose={() => setOneTimeSecret(null)}
        title="Your new API key"
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              leading={<Icon.Copy size={12} />}
              onClick={() => oneTimeSecret && void handleCopySecret(oneTimeSecret.secret)}
            >
              Copy secret
            </Button>
            <Button variant="primary" onClick={() => setOneTimeSecret(null)}>Done</Button>
          </>
        }
      >
        {oneTimeSecret && (
          <>
            <p className="text-[13px] text-bone-mid">
              <span className="font-medium text-bone">{oneTimeSecret.label}</span>
            </p>
            <div className="mt-3 rounded-lg border border-warn/30 bg-warn/5 p-3 text-[12px] text-bone-mid">
              <div className="flex items-start gap-2">
                <Icon.Alert size={14} className="mt-0.5 shrink-0 text-warn" />
                <span>This secret is shown only now. Copy it before closing — you will not see it again.</span>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-md border border-line-1 bg-ink-2 p-3 font-mono text-[12px]">
              <span className="flex-1 break-all text-bone">{oneTimeSecret.secret}</span>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}

function InfoTile({ icon, tone, title, desc, count }: { icon: React.ReactNode; tone: "signal" | "info" | "warn"; title: string; desc: string; count: number }) {
  return (
    <div className="rounded-xl border border-line-1 bg-ink-1 p-5">
      <div className="flex items-center gap-3">
        <div className={cn(
          "grid h-10 w-10 place-items-center rounded-md",
          tone === "signal" && "bg-signal/15 text-signal",
          tone === "info" && "bg-info/15 text-info",
          tone === "warn" && "bg-warn/15 text-warn",
        )}>
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
