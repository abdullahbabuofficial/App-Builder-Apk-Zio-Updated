import { relTime } from "@/lib/format";

type Props = {
  appName: string;
  appPackage: string;
  iconColor: string; // hex
  iconGlyph: string; // single character; we render it big
  subscribedAt: string; // ISO
};

// The app-name + icon panel rendered at the top of /preferences. Mobile-first:
// icon next to a stacked name + package. The icon is a flat color block with a
// vertically-centered glyph — keeps it brand-flexible without needing assets.
export function AppHeader({ appName, appPackage, iconColor, iconGlyph, subscribedAt }: Props) {
  return (
    <div className="flex items-center gap-4">
      <div
        className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-line-1 font-display text-[26px] font-semibold leading-none text-ink-0 shadow-panel"
        style={{
          backgroundImage: `linear-gradient(140deg, ${iconColor} 0%, ${iconColor}cc 60%, ${iconColor}99 100%)`,
        }}
        aria-hidden
      >
        {iconGlyph || "?"}
      </div>
      <div className="min-w-0">
        <div className="font-display text-[19px] font-semibold leading-tight text-bone">
          {appName}
        </div>
        <div className="mt-0.5 truncate font-mono text-[11px] text-bone-low">{appPackage}</div>
        <div className="mt-1 text-[12px] text-bone-mid">
          Subscribed {relTime(subscribedAt)}
        </div>
      </div>
    </div>
  );
}
