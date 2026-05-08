import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tab = { value: string; label: ReactNode; count?: number; trailing?: ReactNode };

type Props = {
  tabs: Tab[];
  value: string;
  onChange: (v: string) => void;
  variant?: "segmented" | "underline";
  className?: string;
};

export function Tabs({ tabs, value, onChange, variant = "underline", className }: Props) {
  if (variant === "segmented") {
    return (
      <div
        className={cn(
          "inline-flex rounded-md border border-line-1 bg-ink-2/60 p-0.5",
          className
        )}
      >
        {tabs.map((t) => {
          const active = t.value === value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange(t.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[5px] px-3 py-1.5 text-[12px] font-medium transition-all",
                active
                  ? "bg-ink-3 text-bone shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
                  : "text-bone-mid hover:text-bone"
              )}
            >
              {t.label}
              {typeof t.count === "number" && (
                <span
                  className={cn(
                    "rounded px-1 font-mono text-[10px]",
                    active ? "bg-signal/15 text-signal" : "bg-ink-3 text-bone-low"
                  )}
                >
                  {t.count}
                </span>
              )}
              {t.trailing}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div className={cn("flex gap-1 border-b border-line-1", className)}>
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={cn(
              "relative inline-flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium transition-colors",
              active ? "text-bone" : "text-bone-mid hover:text-bone"
            )}
          >
            {t.label}
            {typeof t.count === "number" && (
              <span className="rounded bg-ink-3 px-1 font-mono text-[10px] text-bone-low">{t.count}</span>
            )}
            {t.trailing}
            {active && (
              <span className="absolute -bottom-px left-1.5 right-1.5 h-[2px] rounded-t-full bg-signal" />
            )}
          </button>
        );
      })}
    </div>
  );
}
