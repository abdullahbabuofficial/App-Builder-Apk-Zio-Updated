import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { useApkzio } from "@/context/ApkzioDataContext";

type IconKey = keyof typeof Icon;

type Item = {
  id: string;
  label: string;
  sub?: string;
  to: string;
  icon: IconKey;
};

type Group = {
  name: string;
  items: Item[];
};

const PAGES: Array<{ label: string; to: string; icon: IconKey }> = [
  { label: "Dashboard", to: "/dashboard", icon: "Chart" },
  { label: "Clients", to: "/clients", icon: "Users" },
  { label: "Apps", to: "/apps", icon: "Layers" },
  { label: "Campaigns", to: "/campaigns", icon: "Send" },
  { label: "New campaign", to: "/campaigns/new", icon: "Plus" },
  { label: "Analytics", to: "/analytics", icon: "Trend" },
  { label: "Plugins", to: "/plugins", icon: "Globe" },
  { label: "APK Builder", to: "/builder", icon: "Hammer" },
  { label: "API Keys", to: "/keys", icon: "Key" },
  { label: "Settings", to: "/settings", icon: "Cog" },
];

const PER_SECTION = 8;

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { apps, campaigns } = useApkzio();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const groups: Group[] = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matches = (...vals: Array<string | undefined | null>) =>
      term === "" || vals.some((v) => (v ?? "").toLowerCase().includes(term));

    const pageItems: Item[] = PAGES.filter((p) => matches(p.label))
      .slice(0, PER_SECTION)
      .map((p) => ({ id: `page:${p.to}`, label: p.label, to: p.to, icon: p.icon }));

    const appItems: Item[] = apps
      .filter((a) => matches(a.name, a.package_name))
      .slice(0, PER_SECTION)
      .map((a) => ({
        id: `app:${a.id}`,
        label: a.name,
        sub: a.package_name,
        to: `/apps/${a.id}`,
        icon: "Layers",
      }));

    const campaignItems: Item[] = campaigns
      .filter((c) => {
        const app = apps.find((a) => a.id === c.app_id);
        return matches(c.title, app?.name, app?.package_name);
      })
      .slice(0, PER_SECTION)
      .map((c) => ({
        id: `campaign:${c.id}`,
        label: c.title,
        sub: apps.find((a) => a.id === c.app_id)?.name ?? undefined,
        to: `/campaigns/${c.id}`,
        icon: "Send",
      }));

    return [
      { name: "Pages", items: pageItems },
      { name: "Apps", items: appItems },
      { name: "Campaigns", items: campaignItems },
    ].filter((g) => g.items.length > 0);
  }, [query, apps, campaigns]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => (flat.length === 0 ? 0 : Math.min(i + 1, flat.length - 1)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        const item = flat[active];
        if (item) {
          e.preventDefault();
          navigate(item.to);
          onClose();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose, flat, active, navigate]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  if (!open) return null;

  let cursor = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh] sm:px-6 animate-fade-in">
      <button
        type="button"
        aria-label="Close command palette"
        onClick={onClose}
        className="absolute inset-0 bg-ink-0/70 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative flex w-full max-w-[640px] flex-col overflow-hidden rounded-xl border border-line-1 bg-ink-1 shadow-modal animate-slide-up"
      >
        <div className="flex items-center gap-2 border-b border-line-1 px-4">
          <Icon.Search size={14} className="shrink-0 text-bone-low" />
          <input
            ref={inputRef}
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            spellCheck={false}
            className="block h-12 flex-1 bg-transparent font-mono text-[13px] text-bone placeholder:text-bone-low focus:outline-none"
          />
          <kbd className="rounded border border-line-2 bg-ink-3 px-1.5 py-0.5 font-mono text-[10px] text-bone-low">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2">
          {groups.length === 0 ? (
            <div className="px-3 py-10 text-center font-mono text-[12px] text-bone-low">
              No results
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.name} className="mb-2 last:mb-0">
                <div className="px-2 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-low">
                  {g.name}
                </div>
                <ul>
                  {g.items.map((it) => {
                    const i = cursor++;
                    const Ico = Icon[it.icon];
                    const isActive = i === active;
                    return (
                      <li key={it.id}>
                        <button
                          type="button"
                          data-index={i}
                          onMouseEnter={() => setActive(i)}
                          onClick={() => {
                            navigate(it.to);
                            onClose();
                          }}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition",
                            isActive ? "bg-ink-3 text-bone" : "text-bone-mid hover:bg-ink-2",
                          )}
                        >
                          <span
                            className={cn(
                              "grid h-7 w-7 shrink-0 place-items-center rounded-md border border-line-1 transition",
                              isActive ? "bg-ink-2 text-bone" : "bg-ink-2 text-bone-mid",
                            )}
                          >
                            <Ico size={13} />
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[13px]">{it.label}</span>
                          {it.sub ? (
                            <span className="hidden truncate font-mono text-[11px] text-bone-low sm:inline-block max-w-[40%]">
                              {it.sub}
                            </span>
                          ) : null}
                          {isActive ? (
                            <Icon.ArrowRight size={13} className="shrink-0 text-bone-low" />
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line-1 px-4 py-2 font-mono text-[10px] text-bone-low">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-line-2 bg-ink-3 px-1 py-0.5">↑</kbd>
              <kbd className="rounded border border-line-2 bg-ink-3 px-1 py-0.5">↓</kbd>
              navigate
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-line-2 bg-ink-3 px-1 py-0.5">↵</kbd>
              open
            </span>
          </div>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border border-line-2 bg-ink-3 px-1 py-0.5">esc</kbd>
            close
          </span>
        </div>
      </div>
    </div>
  );
}
