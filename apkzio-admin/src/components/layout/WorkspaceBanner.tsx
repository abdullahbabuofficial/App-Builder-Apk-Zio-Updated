import { useEffect, useState } from "react";
import { useApkzio } from "@/context/ApkzioDataContext";
import { Icon } from "@/lib/icons";

/** Enterprise-wide load failures — surfaced on every authenticated route. */
export function WorkspaceBanner() {
  const { error, refresh } = useApkzio();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [error]);

  if (!error || dismissed) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="border-b border-rose-500/35 bg-rose-950/50 px-4 py-3 sm:px-6 lg:px-10"
    >
      <div className="flex items-start gap-3">
        <Icon.Alert size={18} className="mt-0.5 shrink-0 text-rose-300" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-rose-100">Workspace data unavailable</div>
          <p className="mt-1 text-[12px] leading-relaxed text-rose-200/90">{error}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-md bg-bone/10 px-3 py-1.5 font-mono text-[11px] font-medium text-bone transition hover:bg-bone/15"
          >
            Retry
          </button>
          <button
            type="button"
            aria-label="Dismiss alert"
            onClick={() => setDismissed(true)}
            className="grid h-8 w-8 place-items-center rounded-md text-rose-200/80 hover:bg-bone/10 hover:text-bone"
          >
            <Icon.X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
