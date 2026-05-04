import { Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";

type Props = {
  appName: string;
  appGlyph: string;
  iconColor: string;
  title: string;
  body: string;
  imageUrl?: string | null;
  variant?: "lockscreen" | "banner";
  className?: string;
};

// Android-ish notification preview rendered as SVG-styled HTML
export function AndroidPreview({
  appName,
  appGlyph,
  iconColor,
  title,
  body,
  imageUrl,
  variant = "lockscreen",
  className,
}: Props) {
  if (variant === "banner") {
    return (
      <div className={cn("rounded-[26px] border border-line-1 bg-ink-2 p-3 shadow-raise", className)}>
        <div className="flex items-start gap-2.5">
          <div className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-md bg-gradient-to-br font-mono text-[10px] font-medium text-bone", iconColor)}>
            {appGlyph}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[10px] text-bone-low">
              <span>{appName}</span>
              <span>·</span>
              <span>now</span>
            </div>
            <div className="mt-0.5 truncate text-[12.5px] font-medium text-bone">{title}</div>
            <div className="line-clamp-2 text-[12px] text-bone-mid">{body}</div>
          </div>
          {imageUrl && (
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-ink-3 bg-stripes" aria-hidden />
          )}
        </div>
      </div>
    );
  }

  // Lockscreen variant — phone frame
  return (
    <div className={cn("relative mx-auto w-full max-w-[280px]", className)}>
      <div
        className="relative overflow-hidden rounded-[44px] border border-line-2 bg-ink-2 shadow-raise"
        style={{ aspectRatio: "9 / 19.5" }}
      >
        {/* Wallpaper */}
        <div className="absolute inset-0 bg-gradient-to-br from-ink-3 via-ink-2 to-ink-1" />
        <div className="absolute inset-0 bg-grid bg-grid-fade opacity-60" />
        {/* Notch */}
        <div className="absolute left-1/2 top-2 h-5 w-20 -translate-x-1/2 rounded-full bg-ink-0" />
        {/* Time */}
        <div className="absolute left-0 right-0 top-12 text-center">
          <div className="font-display text-[44px] font-light leading-none text-bone">9:41</div>
          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-bone-mid">Sun, Jan 14</div>
        </div>
        {/* Notification card */}
        <div className="absolute inset-x-3 bottom-20">
          <div className="rounded-2xl border border-white/10 bg-ink-1/90 p-3 backdrop-blur-md shadow-modal">
            <div className="flex items-center gap-2">
              <div className={cn("grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br font-mono text-[9px] font-medium text-bone", iconColor)}>
                {appGlyph}
              </div>
              <span className="text-[10px] uppercase tracking-[0.10em] text-bone-low">{appName}</span>
              <span className="ml-auto text-[10px] text-bone-low">now</span>
            </div>
            <div className="mt-2 line-clamp-2 text-[13px] font-medium leading-snug text-bone">{title}</div>
            <div className="mt-1 line-clamp-3 text-[12px] leading-relaxed text-bone-mid">{body}</div>
            {imageUrl && (
              <div className="mt-2.5 h-24 w-full overflow-hidden rounded-md border border-line-1 bg-ink-3 bg-stripes" aria-hidden />
            )}
          </div>
        </div>
        {/* Home indicator */}
        <div className="absolute inset-x-0 bottom-1.5 flex justify-center">
          <div className="h-1 w-20 rounded-full bg-bone-low/40" />
        </div>
      </div>
      {/* Side buttons */}
      <div className="absolute -left-1 top-32 h-12 w-1 rounded-r bg-line-2" />
      <div className="absolute -left-1 top-48 h-16 w-1 rounded-r bg-line-2" />
      <div className="absolute -right-1 top-40 h-20 w-1 rounded-l bg-line-2" />
    </div>
  );
}
