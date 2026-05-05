import { Link } from "react-router-dom";
import { Card } from "@/components/Card";
import { Icon } from "@/lib/icons";

// Shown when someone hits the portal without a token — usually because they
// shared the URL or bookmarked it. We explain how to get back to the right
// place and offer a soft escape hatch.
export function Landing() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-bone">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-signal text-ink-0">
          <Icon.Logo size={20} />
        </span>
        <span className="font-display text-[18px] font-semibold tracking-tight">PushCare</span>
      </div>

      <header className="space-y-3">
        <h1 className="font-display text-[28px] font-semibold leading-[1.1] text-bone balance sm:text-[32px]">
          Notification preferences
        </h1>
        <p className="text-[14px] leading-relaxed text-bone-mid pretty">
          This page is normally opened by tapping a notification or
          {" "}<span className="text-bone">"manage preferences"</span> inside an
          app that uses PushCare. It looks like you arrived here without a
          link, so there's nothing for us to manage yet.
        </p>
      </header>

      <Card>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md border border-line-1 bg-ink-2 text-bone-mid">
            <Icon.Bell size={16} />
          </span>
          <div className="text-[13px] leading-relaxed text-bone-mid">
            Open the link from inside the app's notification settings — it
            includes a short token that tells us which device's preferences
            to load.
          </div>
        </div>
      </Card>

      <div className="text-center text-[13px] text-bone-low">
        Lost the link? <Link to="/" className="text-signal hover:underline">Contact the app's support team.</Link>
      </div>
    </div>
  );
}
