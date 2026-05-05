import { Link, useSearchParams } from "react-router-dom";
import { Card } from "@/components/Card";
import { Icon } from "@/lib/icons";

export function ErrorPage() {
  const [params] = useSearchParams();
  const code = params.get("code") || "unknown";
  const message =
    params.get("message") ||
    "Something went wrong while loading your preferences.";

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-2 text-bone">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-signal text-ink-0">
          <Icon.Logo size={16} />
        </span>
        <span className="font-display text-[16px] font-semibold tracking-tight">PushCare</span>
      </header>

      <Card tone="danger">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-danger/15 text-danger">
            <Icon.AlertTriangle size={18} />
          </span>
          <div className="min-w-0 space-y-2">
            <h1 className="font-display text-[20px] font-semibold leading-tight text-bone balance">
              We can't open your preferences
            </h1>
            <p className="text-[13px] leading-relaxed text-bone-mid pretty">
              {message}
            </p>
            <p className="font-mono text-[11px] uppercase tracking-wider text-bone-low">
              error code: {code}
            </p>
          </div>
        </div>
      </Card>

      <div className="text-center text-[13px]">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-signal hover:underline"
        >
          <Icon.ArrowLeft size={14} /> Back to landing
        </Link>
      </div>
    </div>
  );
}
