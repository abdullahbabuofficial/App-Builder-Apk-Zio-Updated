import { Link } from "react-router-dom";
import { Card } from "@/components/Card";
import { Icon } from "@/lib/icons";

export function DeletedConfirmation() {
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
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-ok/15 text-ok">
            <Icon.Check size={20} />
          </span>
          <div className="min-w-0 space-y-2">
            <h1 className="font-display text-[20px] font-semibold leading-tight text-bone balance">
              Your data has been removed.
            </h1>
            <p className="text-[13px] leading-relaxed text-bone-mid pretty">
              We've deleted this device from the app's notification records.
              You won't receive any more pushes from us about it.
            </p>
            <p className="text-[12px] leading-relaxed text-bone-low pretty">
              The app may still send a push or two if it has cached your old
              token on its servers. Reinstalling the app will clear that cache
              and give you a fresh start.
            </p>
          </div>
        </div>
      </Card>

      <div className="text-center text-[12px] text-bone-low">
        You can safely close this tab.
        {" "}
        <Link to="/" className="text-bone-mid hover:text-signal hover:underline">
          Go home
        </Link>
      </div>
    </div>
  );
}
