import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Field, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Tabs } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Table, type Column } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/Misc";
import { Icon } from "@/lib/icons";
import { commas, relTime } from "@/lib/format";
import { COUNTRIES, COUNTRY_NAMES } from "@/lib/mock-data";
import type { Device } from "@/lib/mock-data";
import { usePushcare } from "@/context/PushcareDataContext";
import { useDevices } from "@/hooks/useAppCollections";

const PAGE_SIZE = 25;

export function Devices() {
  const { appId } = useParams();
  const { findApp, createCampaign } = usePushcare();
  const app = findApp(appId);
  const {
    data: all,
    error: collectionError,
    loading: collectionLoading,
    refetch,
  } = useDevices(app?.id, 240);
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("all");
  const [active, setActive] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);

  // Action menu state
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [pushTarget, setPushTarget] = useState<Device | null>(null);
  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");
  const [pushSending, setPushSending] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  // Auto-clear toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    return all.filter((d) => {
      if (country !== "all" && d.country_code !== country) return false;
      if (active === "active" && !d.is_active) return false;
      if (active === "inactive" && d.is_active) return false;
      if (
        q &&
        !`${d.manufacturer} ${d.model} ${d.install_hash}`.toLowerCase().includes(q.toLowerCase())
      )
        return false;
      return true;
    });
  }, [all, country, active, q]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleCopyHash = async (d: Device) => {
    try {
      await navigator.clipboard?.writeText(d.install_hash);
      setToast({ kind: "ok", msg: `Copied install hash for ${d.manufacturer} ${d.model}` });
    } catch {
      setToast({ kind: "err", msg: "Could not copy to clipboard" });
    } finally {
      setOpenMenuId(null);
    }
  };

  const openTestPush = (d: Device) => {
    setPushTarget(d);
    setPushTitle("Test from PushCare");
    setPushBody("This is a test notification sent to your device.");
    setOpenMenuId(null);
  };

  const sendTestPush = async () => {
    if (!pushTarget || !app) return;
    setPushSending(true);
    try {
      await createCampaign({
        app_id: app.id,
        title: pushTitle.trim() || "Test push",
        body: pushBody.trim() || "Sent from the admin console.",
        target_type: "device_list",
        device_ids: [pushTarget.id],
      });
      setToast({ kind: "ok", msg: `Push queued for ${pushTarget.manufacturer} ${pushTarget.model}` });
      setPushTarget(null);
    } catch (e) {
      setToast({
        kind: "err",
        msg: e instanceof Error ? e.message : "Failed to queue push",
      });
    } finally {
      setPushSending(false);
    }
  };

  const columns: Column<Device>[] = [
    {
      key: "device",
      header: "Device",
      width: "min-w-[260px]",
      cell: (d) => (
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded border border-line-1 bg-ink-2 text-bone-low">
            <Icon.Phone size={14} />
          </div>
          <div className="min-w-0">
            <div className="truncate font-medium text-bone">
              {d.manufacturer} {d.model}
            </div>
            <div className="truncate font-mono text-[10px] text-bone-low">{d.install_hash}</div>
          </div>
        </div>
      ),
    },
    {
      key: "country",
      header: "Country",
      hideBelow: "sm",
      cell: (d) => (
        <Badge dot>
          {d.country_code} <span className="text-bone-low">·</span>{" "}
          {COUNTRY_NAMES[d.country_code] ?? "Unknown"}
        </Badge>
      ),
    },
    {
      key: "ver",
      header: "App ver.",
      hideBelow: "md",
      cell: (d) => <span className="font-mono text-bone-mid">{d.app_version}</span>,
    },
    {
      key: "os",
      header: "OS",
      hideBelow: "md",
      cell: (d) => <span className="font-mono text-bone-mid">Android {d.os_version}</span>,
    },
    {
      key: "first",
      header: "First seen",
      hideBelow: "lg",
      cell: (d) => <span className="text-bone-mid">{relTime(d.first_seen_at)}</span>,
    },
    {
      key: "last",
      header: "Last seen",
      align: "right",
      cell: (d) => (
        <span className="inline-flex items-center gap-1.5">
          {d.is_active && <span className="live-dot scale-75" />}
          <span className={d.is_active ? "text-bone" : "text-bone-mid"}>
            {relTime(d.last_seen_at)}
          </span>
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (d) => (
        <DeviceActionMenu
          open={openMenuId === d.id}
          onOpen={() => setOpenMenuId(d.id)}
          onClose={() => setOpenMenuId(null)}
          onSendPush={() => openTestPush(d)}
          onCopyHash={() => void handleCopyHash(d)}
        />
      ),
    },
  ];

  if (!app)
    return (
      <EmptyState
        icon={<Icon.Layers size={20} />}
        title="App not found"
        description="Pick an app first."
        action={
          <Link to="/apps">
            <Button variant="primary">Back to apps</Button>
          </Link>
        }
      />
    );

  return (
    <>
      <PageHeader
        crumbs={[
          { label: "Apps", to: "/apps" },
          { label: app.name, to: `/apps/${app.id}` },
          { label: "Devices" },
        ]}
        title="Devices"
        description="Every Android device that's ever installed your app, with realtime activity."
        actions={
          <>
            <Button variant="secondary" leading={<Icon.External size={14} />}>
              Export CSV
            </Button>
            <Button variant="secondary" leading={<Icon.Filter size={14} />}>
              More filters
            </Button>
          </>
        }
      />

      {toast && (
        <div
          role="status"
          className={
            "mb-5 rounded-lg border px-4 py-2.5 text-[12px] " +
            (toast.kind === "ok"
              ? "border-ok/30 bg-ok/5 text-ok"
              : "border-danger/30 bg-danger/5 text-danger")
          }
        >
          {toast.msg}
        </div>
      )}

      {collectionError && (
        <div
          role="alert"
          className="mb-5 flex flex-col gap-3 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 sm:flex-row sm:items-center"
        >
          <p className="flex-1 text-[13px] text-danger">{collectionError}</p>
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      <Card className="mb-5">
        <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[1fr_auto_auto] md:items-center">
          <Input
            placeholder="Search by manufacturer, model, or install hash…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            leading={<Icon.Search size={14} />}
          />
          <Select
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              setPage(1);
            }}
            options={[
              { value: "all", label: "All countries" },
              ...COUNTRIES.map((c) => ({ value: c, label: `${c} · ${COUNTRY_NAMES[c]}` })),
            ]}
            className="md:w-56"
          />
          <Tabs
            variant="segmented"
            value={active}
            onChange={(v) => {
              setActive(v as "all" | "active" | "inactive");
              setPage(1);
            }}
            tabs={[
              { value: "all", label: "All" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Idle" },
            ]}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title={`${commas(filtered.length)} devices`}
          description={`Showing page ${page} of ${totalPages}`}
        />
        <CardBody padded={false}>
          <Table
            rows={paged}
            columns={columns}
            rowKey={(d) => d.id}
            emptyState={
              collectionLoading && all.length === 0 ? (
                <div className="p-8 text-center text-[13px] text-bone-mid">Loading devices…</div>
              ) : (
                <div className="p-5">
                  <EmptyState
                    icon={<Icon.Phone size={18} />}
                    title="No matches"
                    description="Try widening your filters."
                  />
                </div>
              )
            }
          />
        </CardBody>
        <CardFooter>
          <div className="font-mono text-[11px] text-bone-low">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of{" "}
            {commas(filtered.length)}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              leading={<Icon.ArrowLeft size={12} />}
            >
              Prev
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              trailing={<Icon.ArrowRight size={12} />}
            >
              Next
            </Button>
          </div>
        </CardFooter>
      </Card>

      <Modal
        open={!!pushTarget}
        onClose={() => {
          if (pushSending) return;
          setPushTarget(null);
        }}
        title="Send test push"
        description={
          pushTarget
            ? `Targeting ${pushTarget.manufacturer} ${pushTarget.model} · ${pushTarget.install_hash.slice(0, 12)}…`
            : ""
        }
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setPushTarget(null)}
              disabled={pushSending}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              leading={<Icon.Send size={14} />}
              onClick={() => void sendTestPush()}
              disabled={pushSending || !pushTitle.trim()}
            >
              {pushSending ? "Sending…" : "Send"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Title" required>
            <Input value={pushTitle} onChange={(e) => setPushTitle(e.target.value)} />
          </Field>
          <Field label="Body" required>
            <Textarea
              rows={3}
              value={pushBody}
              onChange={(e) => setPushBody(e.target.value)}
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}

// =============================================================================
// Per-row action menu
// =============================================================================
function DeviceActionMenu({
  open,
  onOpen,
  onClose,
  onSendPush,
  onCopyHash,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSendPush: () => void;
  onCopyHash: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <div ref={ref} className="relative inline-block text-left">
      <Button
        variant="ghost"
        size="icon"
        aria-label="More"
        onClick={(e) => {
          e.stopPropagation();
          if (open) onClose();
          else onOpen();
        }}
      >
        <Icon.More size={14} />
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-md border border-line-1 bg-ink-1 shadow-raise">
          <button
            type="button"
            onClick={onSendPush}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-bone hover:bg-ink-2"
          >
            <Icon.Send size={13} className="text-bone-low" />
            Send test push
          </button>
          <button
            type="button"
            onClick={onCopyHash}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-bone hover:bg-ink-2"
          >
            <Icon.Copy size={13} className="text-bone-low" />
            Copy install hash
          </button>
          <button
            type="button"
            disabled
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-bone-low opacity-60"
            title="TODO — backend endpoint pending"
          >
            <Icon.Pause size={13} />
            Mark inactive
          </button>
        </div>
      )}
    </div>
  );
}
