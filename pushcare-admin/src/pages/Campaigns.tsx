import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Tabs } from "@/components/ui/Tabs";
import { StatusPill } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/Misc";
import { Icon } from "@/lib/icons";
import { commas, compact, dateTime, pct, relTime } from "@/lib/format";
import type { CampaignStatus } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { usePushcare } from "@/context/PushcareDataContext";

const PAGE_SIZE = 12;

const TABS: { value: "all" | CampaignStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "scheduled", label: "Scheduled" },
  { value: "dispatching", label: "Sending" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
];

export function Campaigns() {
  const { campaigns, appName } = usePushcare();
  const [tab, setTab] = useState<typeof TABS[number]["value"]>("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return campaigns.filter((c) => {
      if (tab !== "all" && c.status !== tab) return false;
      if (q && !`${c.title} ${c.body}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [tab, q, campaigns]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const counts = TABS.reduce<Record<string, number>>((m, t) => {
    m[t.value] = t.value === "all" ? campaigns.length : campaigns.filter((c) => c.status === t.value).length;
    return m;
  }, {});

  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Every push sent through PushCare. Click a row to drill into delivery, opens, and clicks."
        actions={
          <>
            <Button variant="secondary" leading={<Icon.External size={14} />}>Export</Button>
            <Link to="/campaigns/new"><Button variant="primary" leading={<Icon.Plus size={14} />}>New campaign</Button></Link>
          </>
        }
      />

      <Card className="mb-5">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <Input
            placeholder="Search title or body copy…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            leading={<Icon.Search size={14} />}
            className="flex-1"
          />
          <Tabs
            variant="segmented"
            value={tab}
            onChange={(v) => { setTab(v as typeof tab); setPage(1); }}
            tabs={TABS.map((t) => ({ value: t.value, label: t.label, count: counts[t.value] }))}
            className="overflow-x-auto"
          />
        </div>
      </Card>

      {paged.length === 0 ? (
        <EmptyState
          icon={<Icon.Send size={18} />}
          title="No campaigns match"
          description="Try a different filter or send your first push."
          action={<Link to="/campaigns/new"><Button variant="primary" leading={<Icon.Plus size={14} />}>New campaign</Button></Link>}
        />
      ) : (
        <Card>
          <CardHeader title={`${commas(filtered.length)} campaigns`} />
          <CardBody padded={false}>
            <ul>
              {paged.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/campaigns/${c.id}`}
                    className="grid grid-cols-1 gap-4 border-b border-line-1/70 px-5 py-4 transition-colors last:border-b-0 hover:bg-ink-2/60 sm:grid-cols-[1fr_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-[14px] font-medium text-bone">{c.title}</span>
                        <StatusPill status={c.status} />
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-low">
                          {c.target_summary}
                        </span>
                      </div>
                      <div className="mt-1 line-clamp-1 text-[12px] text-bone-mid">{c.body}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-bone-low">
                        <span className="inline-flex items-center gap-1.5"><Icon.Layers size={11} /> {appName(c.app_id)}</span>
                        <span>·</span>
                        <span>{c.sent_at ? `Sent ${relTime(c.sent_at)}` : c.scheduled_at ? `Scheduled ${dateTime(c.scheduled_at)}` : `Created ${relTime(c.created_at)}`}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-px overflow-hidden rounded-lg border border-line-1 bg-line-1 sm:w-[460px]">
                      <Metric label="Sent" value={c.sent_count} />
                      <Metric label="Delivered" value={c.delivered_count} highlight={c.status === "sent"} />
                      <Metric label="Open rate" value={pct((c.opened_count / Math.max(1, c.delivered_count)) * 100)} text />
                      <Metric label="CTR" value={pct((c.clicked_count / Math.max(1, c.opened_count)) * 100)} text />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
          <CardFooter>
            <div className="font-mono text-[11px] text-bone-low">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {commas(filtered.length)}</div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} leading={<Icon.ArrowLeft size={12} />}>Prev</Button>
              <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)} trailing={<Icon.ArrowRight size={12} />}>Next</Button>
            </div>
          </CardFooter>
        </Card>
      )}
    </>
  );
}

function Metric({ label, value, highlight, text }: { label: string; value: number | string; highlight?: boolean; text?: boolean }) {
  return (
    <div className={cn("bg-ink-1 p-3", highlight && "bg-ink-2")}>
      <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-bone-low">{label}</div>
      <div className="mt-0.5 font-display text-[16px] font-semibold leading-none text-bone num">
        {text ? value : compact(value as number)}
      </div>
    </div>
  );
}
