import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "signal" | "ok" | "warn" | "danger" | "info";

export function Badge({
  children,
  tone = "neutral",
  dot = false,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      data-tone={tone === "neutral" ? undefined : tone}
      className={cn("chip", className)}
    >
      {dot && (
        <span
          className={cn(
            "inline-block h-1.5 w-1.5 rounded-full",
            tone === "signal" && "bg-signal",
            tone === "ok" && "bg-ok",
            tone === "warn" && "bg-warn",
            tone === "danger" && "bg-danger",
            tone === "info" && "bg-info",
            tone === "neutral" && "bg-bone-mid"
          )}
        />
      )}
      {children}
    </span>
  );
}

// Status pill that maps campaign/build/key status strings to tones
export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { tone: Tone; label: string; pulse?: boolean }> = {
    sent: { tone: "ok", label: "Sent" },
    delivered: { tone: "ok", label: "Delivered" },
    success: { tone: "ok", label: "Success" },
    active: { tone: "ok", label: "Active" },
    scheduled: { tone: "info", label: "Scheduled" },
    queued: { tone: "info", label: "Queued" },
    dispatching: { tone: "signal", label: "Sending", pulse: true },
    building: { tone: "signal", label: "Building", pulse: true },
    paused: { tone: "warn", label: "Paused" },
    draft: { tone: "neutral", label: "Draft" },
    failed: { tone: "danger", label: "Failed" },
    suspended: { tone: "danger", label: "Suspended" },
  };
  const cfg = map[status] ?? { tone: "neutral" as Tone, label: status };
  return (
    <Badge tone={cfg.tone} className={cfg.pulse ? "relative" : undefined}>
      <span
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full",
          cfg.tone === "signal" && "bg-signal",
          cfg.tone === "ok" && "bg-ok",
          cfg.tone === "warn" && "bg-warn",
          cfg.tone === "danger" && "bg-danger",
          cfg.tone === "info" && "bg-info",
          cfg.tone === "neutral" && "bg-bone-mid",
          cfg.pulse && "animate-pulse"
        )}
      />
      {cfg.label}
    </Badge>
  );
}
