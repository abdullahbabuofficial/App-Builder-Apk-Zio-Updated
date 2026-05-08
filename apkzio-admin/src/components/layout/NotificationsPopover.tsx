import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { relTime } from "@/lib/format";
import { useApkzio } from "@/context/ApkzioDataContext";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { Popover } from "@/components/ui/Popover";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Misc";

const READ_STORAGE_KEY = "pc_notif_read_v1";

// Persists ids whose terminal-status transitions have already been toasted.
// Survives reloads so we don't re-toast the same "Build success" every refresh.
const REAL_SEEN_STORAGE_KEY = "pc_notif_real_seen";

// Refetch the workspace every 30s while the user is signed in.
const POLL_INTERVAL_MS = 30_000;

// Cap on how many ids we keep in the seen set so the localStorage payload stays small.
const REAL_SEEN_MAX = 200;

type CampaignSnap = { id: string; status: string; title: string };
type BuildSnap = { id: string; status: string; version_name: string; appName: string };

function readSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(REAL_SEEN_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === "string"));
  } catch {
    return new Set();
  }
}

function writeSeenIds(ids: Set<string>): void {
  try {
    const arr = Array.from(ids);
    const trimmed = arr.length > REAL_SEEN_MAX ? arr.slice(arr.length - REAL_SEEN_MAX) : arr;
    localStorage.setItem(REAL_SEEN_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore */
  }
}

type Tone = "success" | "danger" | "info" | "default";

type NotifItem = {
  id: string;
  tone: Tone;
  title: string;
  description: string;
  time: number;
  href: string;
};

const toneDot: Record<Tone, string> = {
  success: "bg-ok",
  danger: "bg-danger",
  info: "bg-info",
  default: "bg-bone-mid",
};

function readStoredIds(): string[] {
  try {
    const raw = localStorage.getItem(READ_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeStoredIds(ids: string[]): void {
  try {
    localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export function NotificationsPopover() {
  const { campaigns, builds, dataSource, appName, refresh } = useApkzio();
  const { signedIn } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<string[]>(() => readStoredIds());

  useEffect(() => {
    writeStoredIds(readIds);
  }, [readIds]);

  // Background polling: while signed in, re-fetch the workspace every 30s so the
  // bell + counts stay fresh without forcing the user to navigate.
  useEffect(() => {
    if (!signedIn) return;
    const handle = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(handle);
  }, [signedIn, refresh]);

  // Snapshot the previous campaign/build status set so we can detect terminal
  // transitions and toast on them. The very first hydration is silent — it just
  // initializes the snapshot — so we never spam toasts for state we already had.
  const initializedRef = useRef(false);
  const campaignSnapRef = useRef<Map<string, CampaignSnap>>(new Map());
  const buildSnapRef = useRef<Map<string, BuildSnap>>(new Map());
  const seenIdsRef = useRef<Set<string>>(readSeenIds());

  useEffect(() => {
    const nextCampaigns = new Map<string, CampaignSnap>();
    for (const c of campaigns) {
      nextCampaigns.set(c.id, { id: c.id, status: c.status, title: c.title });
    }
    const nextBuilds = new Map<string, BuildSnap>();
    for (const b of builds) {
      nextBuilds.set(b.id, {
        id: b.id,
        status: b.status,
        version_name: b.version_name,
        appName: appName(b.app_id),
      });
    }

    if (!initializedRef.current) {
      campaignSnapRef.current = nextCampaigns;
      buildSnapRef.current = nextBuilds;
      initializedRef.current = true;
      return;
    }

    const seen = seenIdsRef.current;
    let seenChanged = false;

    for (const [id, snap] of nextCampaigns) {
      const prev = campaignSnapRef.current.get(id);
      const becameTerminal =
        (snap.status === "sent" || snap.status === "failed") &&
        (!prev || prev.status !== snap.status);
      // Toast key includes status so the same campaign can toast once for "sent" and once for "failed".
      const toastKey = `c:${id}:${snap.status}`;
      if (becameTerminal && !seen.has(toastKey)) {
        toast({
          tone: snap.status === "sent" ? "success" : "error",
          title: snap.status === "sent" ? "Campaign sent" : "Campaign failed",
          description: snap.title,
        });
        seen.add(toastKey);
        seenChanged = true;
      }
    }

    for (const [id, snap] of nextBuilds) {
      const prev = buildSnapRef.current.get(id);
      const becameTerminal =
        (snap.status === "success" || snap.status === "failed") &&
        (!prev || prev.status !== snap.status);
      const toastKey = `b:${id}:${snap.status}`;
      if (becameTerminal && !seen.has(toastKey)) {
        toast({
          tone: snap.status === "success" ? "success" : "error",
          title: snap.status === "success" ? "Build success" : "Build failed",
          description: `${snap.version_name} · ${snap.appName}`,
        });
        seen.add(toastKey);
        seenChanged = true;
      }
    }

    campaignSnapRef.current = nextCampaigns;
    buildSnapRef.current = nextBuilds;

    if (seenChanged) {
      writeSeenIds(seen);
    }
  }, [campaigns, builds, appName, toast]);

  const items = useMemo<NotifItem[]>(() => {
    const out: NotifItem[] = [];

    const campaignEvents = campaigns
      .filter((c) =>
        c.status === "scheduled" ||
        c.status === "dispatching" ||
        c.status === "sent" ||
        c.status === "failed",
      )
      .map((c) => {
        const stamp = c.sent_at ?? c.scheduled_at ?? c.created_at;
        const t = new Date(stamp).getTime();
        let tone: Tone = "default";
        let title = "Campaign update";
        if (c.status === "sent") { tone = "success"; title = "Campaign sent"; }
        else if (c.status === "failed") { tone = "danger"; title = "Campaign failed"; }
        else if (c.status === "scheduled") { tone = "info"; title = "Campaign scheduled"; }
        else if (c.status === "dispatching") { tone = "default"; title = "Campaign dispatching"; }
        return {
          id: c.id,
          tone,
          title,
          description: c.title,
          time: Number.isFinite(t) ? t : 0,
          href: `/campaigns/${c.id}`,
        } satisfies NotifItem;
      })
      .sort((a, b) => b.time - a.time)
      .slice(0, 12);

    const buildEvents = builds
      .slice()
      .sort((a, b) => new Date(b.build_started_at).getTime() - new Date(a.build_started_at).getTime())
      .slice(0, 6)
      .map((b) => {
        let tone: Tone = "default";
        let title = "Build queued";
        if (b.status === "success") { tone = "success"; title = "Build success"; }
        else if (b.status === "failed") { tone = "danger"; title = "Build failed"; }
        else if (b.status === "building") { tone = "info"; title = "Build building"; }
        return {
          id: b.id,
          tone,
          title,
          description: `${b.version_name} · ${appName(b.app_id)}`,
          time: new Date(b.build_started_at).getTime(),
          href: "/builder",
        } satisfies NotifItem;
      });

    out.push(...campaignEvents, ...buildEvents);
    return out.sort((a, b) => b.time - a.time).slice(0, 14);
  }, [campaigns, builds, appName]);

  const hasUnread = useMemo(() => {
    if (items.length === 0) return false;
    const readSet = new Set(readIds);
    return items.some((it) => !readSet.has(it.id));
  }, [items, readIds]);

  const handleMarkAllRead = () => {
    setReadIds(items.map((it) => it.id));
  };

  const handleNavigate = () => {
    setOpen(false);
  };

  const trigger = (
    <button
      type="button"
      aria-label="Notifications"
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={() => setOpen((v) => !v)}
      className="relative grid h-9 w-9 place-items-center rounded-md text-bone-mid transition hover:bg-ink-3 hover:text-bone"
    >
      <Icon.Bell size={16} />
      {hasUnread && (
        <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-signal ring-2 ring-ink-1" />
      )}
    </button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen} trigger={trigger} align="right" width={360}>
      <div className="flex items-center justify-between gap-2 border-b border-line-1 px-3.5 py-2.5">
        <div className="font-display text-[13px] font-semibold text-bone">Notifications</div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleMarkAllRead}
          disabled={!hasUnread}
        >
          Mark all as read
        </Button>
      </div>

      <div className="max-h-[360px] overflow-y-auto">
        {items.length === 0 ? (
          <div className="p-3.5">
            <EmptyState
              icon={<Icon.Bell size={20} />}
              title="No activity"
              description="Nothing to report yet — scheduled and sent campaigns show up here."
              className="px-4 py-8"
            />
          </div>
        ) : (
          <ul className="divide-y divide-line-1">
            {items.map((it) => (
              <li key={it.id}>
                <Link
                  to={it.href}
                  onClick={handleNavigate}
                  className="flex items-start gap-3 px-3.5 py-2.5 transition hover:bg-ink-2"
                >
                  <span
                    aria-hidden="true"
                    className={cn("mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full", toneDot[it.tone])}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-[13px] font-medium text-bone">{it.title}</div>
                      <div className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-bone-low">
                        {relTime(it.time)}
                      </div>
                    </div>
                    <div className="truncate text-[12px] text-bone-mid">{it.description}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-line-1 px-3.5 py-2 text-[11px] text-bone-low">
        <div>Live from your workspace · {dataSource.toUpperCase()}</div>
        <div className="mt-0.5 text-bone-low/70">Local to this browser</div>
      </div>
    </Popover>
  );
}
