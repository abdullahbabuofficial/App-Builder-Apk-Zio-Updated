import { useEffect, useState } from "react";
import { useApkzio } from "@/context/ApkzioDataContext";
import { APKZIO_ADMIN_API_KEY } from "@/lib/config";
import { Icon } from "@/lib/icons";

const SESSION_DISMISS_KEY = "apkzio.dismiss.admin_api_key_banner";

/**
 * Shown when the REST API reports `admin_auth_enforced` and the SPA has no `VITE_APKZIO_ADMIN_API_KEY`.
 */
export function AdminApiKeyRecommendationBanner() {
  const { adminAuthEnforced, dataSource, apiBaseUrl } = useApkzio();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(SESSION_DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, [adminAuthEnforced]);

  if (dataSource === "mock" || !apiBaseUrl) return null;
  if (APKZIO_ADMIN_API_KEY.length > 0) return null;
  if (adminAuthEnforced !== true) return null;
  if (dismissed) return null;

  function dismiss() {
    try {
      sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  return (
    <div
      role="status"
      className="border-b border-amber-500/30 bg-amber-950/40 px-4 py-3 sm:px-6 lg:px-10"
    >
      <div className="flex items-start gap-3">
        <Icon.Alert size={18} className="mt-0.5 shrink-0 text-amber-300" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-amber-100">Admin API key recommended</div>
          <p className="mt-1 text-[12px] leading-relaxed text-amber-100/85">
            This API has <span className="font-mono text-[11px]">ENFORCE_ADMIN_AUTH</span> enabled.
            Set <span className="font-mono text-[11px]">VITE_APKZIO_ADMIN_API_KEY</span> in{" "}
            <span className="font-mono text-[11px]">apkzio-admin/.env.local</span> to the same value as{" "}
            <span className="font-mono text-[11px]">APKZIO_ADMIN_API_KEY</span> on the server (internal /
            VPN consoles only). Without it, <span className="font-mono text-[11px]">/api/admin/*</span> routes
            (e.g. Clients CRM) return 403 unless you use an operator account the API accepts.
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss for this browser session"
          onClick={dismiss}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-amber-200/80 hover:bg-bone/10 hover:text-bone"
        >
          <Icon.X size={16} />
        </button>
      </div>
    </div>
  );
}
