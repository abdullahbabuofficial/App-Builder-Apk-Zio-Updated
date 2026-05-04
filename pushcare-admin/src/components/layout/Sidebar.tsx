import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { compact } from "@/lib/format";
import { usePushcare } from "@/context/PushcareDataContext";
import type { AndroidApp } from "@/lib/mock-data";

const SECTIONS: Array<{
  label: string;
  items: { to: string; label: string; icon: keyof typeof Icon; badge?: string }[];
}> = [
  {
    label: "OVERVIEW",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: "Chart" },
      { to: "/analytics", label: "Analytics", icon: "Trend" },
    ],
  },
  {
    label: "AUDIENCE",
    items: [
      { to: "/apps", label: "Apps", icon: "Layers" },
    ],
  },
  {
    label: "MESSAGING",
    items: [
      { to: "/campaigns", label: "Campaigns", icon: "Send", badge: "3 sending" },
    ],
  },
  {
    label: "DEVELOPERS",
    items: [
      { to: "/builder", label: "APK Builder", icon: "Hammer" },
      { to: "/keys", label: "API Keys", icon: "Key" },
    ],
  },
];

export function Sidebar({ onSignOut, onClose }: { onSignOut: () => void; onClose?: () => void }) {
  const navigate = useNavigate();
  const { apps } = usePushcare();
  const [appPickerOpen, setAppPickerOpen] = useState(false);
  const [activeApp, setActiveApp] = useState<AndroidApp | null>(null);

  useEffect(() => {
    if (!apps.length) return;
    setActiveApp((prev) => (prev && apps.some((a) => a.id === prev.id) ? prev : apps[0]!));
  }, [apps]);

  if (!activeApp) {
    return (
      <aside className="flex h-full w-full flex-col bg-ink-1 px-5 py-6 text-bone-mid">
        <div className="font-mono text-[11px]">Loading apps…</div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-full flex-col bg-ink-1 text-bone">
      {/* Brand */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-signal text-ink-0">
            <Icon.Logo size={18} />
          </div>
          <div className="leading-tight">
            <div className="font-display text-[17px] font-semibold tracking-tight">PushCare</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-low">v1.4 · stable</div>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-md text-bone-mid hover:bg-ink-3 hover:text-bone lg:hidden"
            aria-label="Close menu"
          >
            <Icon.X size={18} />
          </button>
        )}
      </div>

      {/* App switcher */}
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={() => setAppPickerOpen((v) => !v)}
          className="flex w-full items-center gap-2.5 rounded-lg border border-line-1 bg-ink-2/60 px-2.5 py-2 text-left transition hover:border-line-2 hover:bg-ink-3"
        >
          <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-md bg-gradient-to-br font-mono text-[12px] font-medium text-bone", activeApp.icon_color)}>
            {activeApp.icon_glyph}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium leading-tight">{activeApp.name}</div>
            <div className="truncate font-mono text-[10px] leading-tight text-bone-low">{activeApp.package_name}</div>
          </div>
          <Icon.ChevronDown size={14} className={cn("shrink-0 text-bone-low transition", appPickerOpen && "rotate-180")} />
        </button>

        {appPickerOpen && (
          <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-line-1 bg-ink-2 p-1 shadow-raise animate-fade-in">
            {apps.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setActiveApp(a);
                  setAppPickerOpen(false);
                  navigate(`/apps/${a.id}`);
                  onClose?.();
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left hover:bg-ink-3"
              >
                <div className={cn("grid h-7 w-7 place-items-center rounded bg-gradient-to-br font-mono text-[10px] font-medium text-bone", a.icon_color)}>
                  {a.icon_glyph}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-medium">{a.name}</div>
                  <div className="font-mono text-[10px] text-bone-low">{compact(a.live_users)} live</div>
                </div>
                {a.id === activeApp.id && <Icon.Check size={14} className="text-signal" />}
              </button>
            ))}
            <div className="mt-1 border-t border-line-1 pt-1">
              <button
                type="button"
                onClick={() => { setAppPickerOpen(false); navigate("/apps"); onClose?.(); }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-[12px] text-bone-mid hover:bg-ink-3"
              >
                <Icon.Layers size={14} /> View all apps
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4 no-scrollbar">
        {SECTIONS.map((sec) => (
          <div key={sec.label} className="mb-5">
            <div className="px-2 pb-2 font-mono text-[10px] font-medium tracking-[0.18em] text-bone-low">
              {sec.label}
            </div>
            <div className="space-y-0.5">
              {sec.items.map((it) => {
                const Ic = Icon[it.icon];
                return (
                  <NavLink
                    key={it.to}
                    to={it.to}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        "group relative flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition",
                        isActive
                          ? "bg-ink-3 text-bone"
                          : "text-bone-mid hover:bg-ink-2 hover:text-bone"
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span className="absolute -left-3 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r bg-signal" />
                        )}
                        <Ic size={16} className={cn(isActive ? "text-signal" : "text-bone-low group-hover:text-bone-mid")} />
                        <span className="flex-1">{it.label}</span>
                        {it.badge && (
                          <span className="rounded-full bg-signal/15 px-1.5 py-0.5 font-mono text-[10px] font-medium text-signal">
                            {it.badge}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer / user pod */}
      <div className="border-t border-line-1 p-3">
        <NavLink
          to="/settings"
          onClick={onClose}
          className="mb-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-bone-mid hover:bg-ink-2 hover:text-bone"
        >
          <Icon.Cog size={16} /> Settings
        </NavLink>
        <div className="flex items-center gap-2.5 rounded-md border border-line-1 bg-ink-2/60 p-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-bone text-ink-0 font-display font-semibold">
            A
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-medium">Abdullah Babu</div>
            <div className="truncate font-mono text-[10px] text-bone-low">abdullah@pushcare.io</div>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="grid h-7 w-7 place-items-center rounded-md text-bone-low hover:bg-ink-3 hover:text-bone"
            aria-label="Sign out"
            title="Sign out"
          >
            <Icon.Logout size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
