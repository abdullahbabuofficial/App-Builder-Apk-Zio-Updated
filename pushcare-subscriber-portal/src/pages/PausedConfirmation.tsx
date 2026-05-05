import { Link, useSearchParams } from "react-router-dom";
import { Card } from "@/components/Card";
import { Icon } from "@/lib/icons";
import { dateTime } from "@/lib/format";
import { pauseUntilFromKey, type PauseDuration } from "@/lib/api";

const COPY: Record<PauseDuration, string> = {
  off: "Notifications resumed.",
  "1h": "Notifications paused for the next hour.",
  "1d": "Notifications paused for the next 24 hours.",
  "1w": "Notifications paused for the next week.",
  forever: "Notifications paused until you turn them back on.",
};

export function PausedConfirmation() {
  const [params] = useSearchParams();
  const duration = (params.get("duration") || "1h") as PauseDuration;
  const until = pauseUntilFromKey(duration);
  const token = params.get("token") || "";

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-2 text-bone">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-signal text-ink-0">
          <Icon.Logo size={16} />
        </span>
        <span className="font-display text-[16px] font-semibold tracking-tight">PushCare</span>
      </header>

      <Card>
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-signal/15 text-signal">
            <Icon.Pause size={18} />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-[20px] font-semibold leading-tight text-bone balance">
              {COPY[duration]}
            </h1>
            {until ? (
              <p className="mt-1 text-[13px] leading-relaxed text-bone-mid">
                You'll start seeing them again on{" "}
                <span className="text-bone">{dateTime(until)}</span>.
              </p>
            ) : duration === "forever" ? (
              <p className="mt-1 text-[13px] leading-relaxed text-bone-mid">
                Come back any time and tap "Off" to resume.
              </p>
            ) : null}
          </div>
        </div>
      </Card>

      <div className="text-center text-[13px]">
        <Link
          to={token ? `/preferences?token=${encodeURIComponent(token)}` : "/"}
          className="text-signal hover:underline"
        >
          Back to preferences
        </Link>
      </div>
    </div>
  );
}
