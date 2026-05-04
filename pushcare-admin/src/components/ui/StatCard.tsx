import type { ReactNode } from "react";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { delta as fmtDelta } from "@/lib/format";

type Props = {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  deltaPct?: number;
  hint?: ReactNode;
  trailing?: ReactNode; // e.g. <Sparkline ...>
  emphasis?: boolean; // brand glow
  className?: string;
};

export function StatCard({ label, value, unit, deltaPct, hint, trailing, emphasis, className }: Props) {
  const d = typeof deltaPct === "number" ? fmtDelta(deltaPct) : null;
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-ink-1 p-5",
        emphasis ? "border-signal/30 shadow-signal-glow" : "border-line-1",
        className
      )}
    >
      {emphasis && (
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-signal/10 blur-2xl" />
      )}
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-bone-low">{label}</div>
          <div className="mt-2 flex items-baseline gap-1.5 font-display num">
            <span className="text-[32px] font-semibold leading-none tracking-tight text-bone">{value}</span>
            {unit && <span className="text-[14px] text-bone-mid">{unit}</span>}
          </div>
          {(d || hint) && (
            <div className="mt-2 flex items-center gap-2 text-[12px]">
              {d && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 font-mono num",
                    d.sign === "up" ? "text-ok" : d.sign === "down" ? "text-danger" : "text-bone-low"
                  )}
                >
                  {d.sign === "up" ? <Icon.Trend size={12} /> : d.sign === "down" ? <Icon.Trend size={12} className="rotate-90 scale-x-[-1]" /> : null}
                  {d.label}
                </span>
              )}
              {hint && <span className="text-bone-low">{hint}</span>}
            </div>
          )}
        </div>
        {trailing && <div className="shrink-0">{trailing}</div>}
      </div>
    </div>
  );
}
