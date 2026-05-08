import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-dashed border-line-2 bg-stripes px-6 py-14 text-center",
        className
      )}
    >
      {icon && (
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl border border-line-1 bg-ink-2 text-bone-low">
          {icon}
        </div>
      )}
      <div className="font-display text-[18px] font-semibold text-bone">{title}</div>
      {description && <p className="mx-auto mt-1.5 max-w-md text-[13px] text-bone-mid">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function Avatar({
  glyph,
  src,
  size = 32,
  className,
}: {
  glyph?: string;
  src?: string;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full border border-line-1 bg-ink-3 text-bone font-display font-semibold",
        className
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : (glyph ?? "?")}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}
