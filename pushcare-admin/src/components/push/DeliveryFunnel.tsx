import { commas, pct } from "@/lib/format";
import { cn } from "@/lib/utils";

type Stage = { key: string; label: string; value: number; color: string };

export function DeliveryFunnel({
  recipients,
  sent,
  delivered,
  opened,
  clicked,
  className,
}: {
  recipients: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  className?: string;
}) {
  const base = Math.max(recipients, sent, 1);
  const stages: Stage[] = [
    { key: "recipients", label: "Recipients", value: recipients, color: "#52503F" },
    { key: "sent", label: "Sent", value: sent, color: "#7CB7FF" },
    { key: "delivered", label: "Delivered", value: delivered, color: "#5DCFA3" },
    { key: "opened", label: "Opened", value: opened, color: "#CDFF3F" },
    { key: "clicked", label: "Clicked", value: clicked, color: "#FF8A4C" },
  ];
  return (
    <div className={cn("space-y-3", className)}>
      {stages.map((s, i) => {
        const ratio = s.value / base;
        const pctVsRecipients = recipients > 0 ? (s.value / recipients) * 100 : 0;
        const pctVsPrev = i > 0 && stages[i - 1].value > 0 ? (s.value / stages[i - 1].value) * 100 : 100;
        return (
          <div key={s.key}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                <span className="text-[12px] text-bone-mid">{s.label}</span>
              </div>
              <div className="flex items-baseline gap-2 font-mono text-[11px] tabular-nums">
                <span className="text-bone">{commas(s.value)}</span>
                {i > 0 && (
                  <span className="text-bone-low">
                    {pct(pctVsPrev)} vs prev
                  </span>
                )}
                <span className="text-bone-low">{pct(pctVsRecipients)}</span>
              </div>
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-ink-3/60">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.max(2, ratio * 100)}%`, background: s.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
