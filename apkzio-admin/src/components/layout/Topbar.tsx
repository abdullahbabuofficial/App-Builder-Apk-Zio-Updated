import { useNavigate } from "react-router-dom";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { useApkzio } from "@/context/ApkzioDataContext";
import { APKZIO_ADMIN_API_KEY, apkzioApiHostname } from "@/lib/config";
import { NotificationsPopover } from "./NotificationsPopover";
import { DocsPopover } from "./DocsPopover";

export function Topbar({ onMenu, onOpenCommandPalette }: { onMenu: () => void; onOpenCommandPalette: () => void }) {
  const navigate = useNavigate();
  const { dataSource, loading, adminAuthEnforced } = useApkzio();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line-1 bg-ink-1/85 px-4 backdrop-blur-md sm:h-[60px] sm:px-6">
      <button
        type="button"
        onClick={onMenu}
        className="grid h-9 w-9 place-items-center rounded-md text-bone-mid hover:bg-ink-3 hover:text-bone lg:hidden"
        aria-label="Open menu"
      >
        <Icon.Menu size={18} />
      </button>

      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Icon.Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-bone-low" />
        <button
          type="button"
          onClick={onOpenCommandPalette}
          onFocus={onOpenCommandPalette}
          aria-label="Open command palette"
          className="block h-9 w-full rounded-md border border-line-1 bg-ink-2/60 pl-9 pr-16 text-[13px] text-bone placeholder:text-bone-low transition hover:border-line-2 focus:border-signal/50 focus:bg-ink-2 focus:outline-none focus:ring-2 focus:ring-signal/20"
        >
          <span className="block truncate text-left text-bone-low">Search apps, campaigns, devices…</span>
        </button>
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-line-2 bg-ink-3 px-1.5 py-0.5 font-mono text-[10px] text-bone-low sm:inline-block">
          ⌘ K
        </kbd>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <EnvBadge dataSource={dataSource} loading={loading} />
        {adminAuthEnforced === true && APKZIO_ADMIN_API_KEY.length === 0 ? (
          <button
            type="button"
            onClick={() => navigate("/settings")}
            title="API requires an admin key for /api/admin/* — open Settings → Workspace"
            className="hidden h-7 max-w-[140px] items-center gap-1 rounded-md border border-amber-500/35 bg-amber-950/40 px-2 sm:inline-flex"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden />
            <span className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-amber-100">
              Admin key
            </span>
          </button>
        ) : null}
        <NotificationsPopover />
        <DocsPopover />
        <button
          type="button"
          onClick={() => navigate("/campaigns/new")}
          className="hidden h-9 items-center gap-2 rounded-md bg-signal pl-3 pr-3.5 font-medium text-ink-0 transition hover:bg-signal-300 sm:inline-flex"
        >
          <Icon.Plus size={15} />
          <span className="text-[13px]">New campaign</span>
        </button>
        <button
          type="button"
          onClick={() => navigate("/campaigns/new")}
          className="grid h-9 w-9 place-items-center rounded-md bg-signal text-ink-0 hover:bg-signal-300 sm:hidden"
          aria-label="New campaign"
        >
          <Icon.Plus size={18} />
        </button>
      </div>
    </header>
  );
}

function EnvBadge({
  dataSource,
  loading,
}: {
  dataSource: string;
  loading: boolean;
}) {
  const label =
    dataSource === "rest" ? "REST" : dataSource === "supabase" ? "SUPABASE" : dataSource === "mock" ? "MOCK" : dataSource.toUpperCase();
  const host = dataSource === "rest" ? apkzioApiHostname() : null;

  return (
    <div
      className="hidden max-w-[220px] h-7 items-center gap-1.5 rounded-md border border-line-1 bg-ink-2/60 px-2 sm:inline-flex"
      title={host || undefined}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          loading ? "animate-pulse bg-bone-low" : "bg-signal",
        )}
      />
      <span className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-bone-mid">
        {label}
        {host ? ` · ${host}` : ""}
      </span>
    </div>
  );
}
