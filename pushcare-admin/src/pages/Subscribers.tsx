import { Link, useParams } from "react-router-dom";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Tabs } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { Table, type Column } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/Misc";
import { Icon } from "@/lib/icons";
import { commas, relTime } from "@/lib/format";
import type { Subscriber } from "@/lib/mock-data";
import { usePushcare } from "@/context/PushcareDataContext";
import { useSubscribers } from "@/hooks/useAppCollections";

const PAGE_SIZE = 25;

export function Subscribers() {
  const { appId } = useParams();
  const { findApp } = usePushcare();
  const app = findApp(appId);
  const { data: all, error: collectionError, loading: collectionLoading, refetch } = useSubscribers(app?.id, 240);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "valid" | "invalid">("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() =>
    all.filter((s) => {
      if (filter === "valid" && !s.is_valid) return false;
      if (filter === "invalid" && s.is_valid) return false;
      if (q && !s.fcm_token_redacted.includes(q.toLowerCase())) return false;
      return true;
    }), [all, filter, q]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: Column<Subscriber>[] = [
    {
      key: "token",
      header: "FCM token",
      width: "min-w-[260px]",
      cell: (s) => (
        <div className="flex items-center gap-2">
          <Icon.Key size={14} className="text-bone-low" />
          <span className="font-mono text-[12px] text-bone">{s.fcm_token_redacted}</span>
        </div>
      ),
    },
    {
      key: "valid",
      header: "Status",
      hideBelow: "sm",
      cell: (s) => (s.is_valid ? <Badge tone="ok" dot>Valid</Badge> : <Badge tone="danger" dot>Invalid</Badge>),
    },
    {
      key: "device",
      header: "Device ID",
      hideBelow: "md",
      cell: (s) => <span className="font-mono text-[11px] text-bone-mid">{s.device_id.slice(0, 8)}…{s.device_id.slice(-4)}</span>,
    },
    {
      key: "last",
      header: "Last seen",
      align: "right",
      cell: (s) => <span className="text-bone-mid">{relTime(s.last_seen_at)}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (_) => (
        <Button variant="ghost" size="icon" aria-label="More"><Icon.More size={14} /></Button>
      ),
    },
  ];

  if (!app) return <EmptyState icon={<Icon.Layers size={20} />} title="App not found" description="Pick an app first." action={<Link to="/apps"><Button variant="primary">Back to apps</Button></Link>} />;

  const validCount = all.filter((s) => s.is_valid).length;

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Apps", to: "/apps" }, { label: app.name, to: `/apps/${app.id}` }, { label: "Subscribers" }]}
        title="Subscribers"
        description="Devices opted-in to receive push notifications. Tokens are redacted by default."
        actions={
          <>
            <Button variant="secondary" leading={<Icon.External size={14} />}>Export</Button>
            <Link to="/campaigns/new"><Button variant="primary" leading={<Icon.Send size={14} />}>Send to subset</Button></Link>
          </>
        }
      />

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

      <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Total subscribers" value={commas(all.length)} />
        <Stat label="Valid tokens" value={commas(validCount)} hint="reachable" />
        <Stat label="Invalid" value={commas(all.length - validCount)} hint="will skip on send" />
        <Stat label="Opt-in rate" value={`${((all.length / (app.total_installs || 1)) * 100).toFixed(1)}%`} />
      </div>

      <Card className="mb-5">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <Input
            placeholder="Search by token fragment…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            leading={<Icon.Search size={14} />}
            className="flex-1"
          />
          <Tabs
            variant="segmented"
            value={filter}
            onChange={(v) => { setFilter(v as typeof filter); setPage(1); }}
            tabs={[
              { value: "all", label: "All", count: all.length },
              { value: "valid", label: "Valid", count: validCount },
              { value: "invalid", label: "Invalid", count: all.length - validCount },
            ]}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title={`${commas(filtered.length)} results`} />
        <CardBody padded={false}>
          <Table
            rows={paged}
            columns={columns}
            rowKey={(s) => s.id}
            emptyState={
              collectionLoading && all.length === 0 ? (
                <div className="p-8 text-center text-[13px] text-bone-mid">Loading subscribers…</div>
              ) : (
                <div className="p-5">
                  <EmptyState
                    icon={<Icon.Key size={18} />}
                    title="No subscribers match"
                    description="Adjust search or filters to see more rows."
                  />
                </div>
              )
            }
          />
        </CardBody>
        <CardFooter>
          <div className="font-mono text-[11px] text-bone-low">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {commas(filtered.length)}</div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} leading={<Icon.ArrowLeft size={12} />}>Prev</Button>
            <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)} trailing={<Icon.ArrowRight size={12} />}>Next</Button>
          </div>
        </CardFooter>
      </Card>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-line-1 bg-ink-1 p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-low">{label}</div>
      <div className="mt-1 font-display text-[24px] font-semibold leading-none text-bone num">{value}</div>
      {hint && <div className="mt-1 text-[11px] text-bone-low">{hint}</div>}
    </div>
  );
}
