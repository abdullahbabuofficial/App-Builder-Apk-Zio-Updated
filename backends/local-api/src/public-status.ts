import { getApkBuildCapabilitySummary } from "./builder/runner.js";
import { isFirebaseAdminConfigured } from "./firebase-admin.js";
import { isResendConfigured } from "./resend.js";

function adminAuthEnforcedFromEnv(): boolean {
  return (
    (process.env.ENFORCE_ADMIN_AUTH ?? (process.env.NODE_ENV === "production" ? "1" : "0")) === "1"
  );
}

export type PublicStatusPayload = {
  ok: true;
  service: "apkzio-local-api";
  persistence: "memory";
  features: {
    firebase_admin: boolean;
    email_via_resend: boolean;
    webview_zip_pipeline: true;
    apk_gradle_pipeline: boolean;
    /** Present when `apk_gradle_pipeline` is false — operator-facing hint, no secrets. */
    apk_pipeline_hint: string | null;
    /** Gradle task for APK output (debug / sideload only — `assembleDebug`). */
    apk_gradle_task: string;
    apk_gradle_timeout_ms: number;
    apk_max_concurrent_gradle: number;
    /** Mirrors `ENFORCE_ADMIN_AUTH` — admin SPA should send `X-Apkzio-Admin-Key` when true. */
    admin_auth_enforced: boolean;
  };
};

export function buildPublicStatusPayload(): PublicStatusPayload {
  const apk = getApkBuildCapabilitySummary();
  return {
    ok: true,
    service: "apkzio-local-api",
    persistence: "memory",
    features: {
      firebase_admin: isFirebaseAdminConfigured(),
      email_via_resend: isResendConfigured(),
      webview_zip_pipeline: true,
      apk_gradle_pipeline: apk.enabled,
      apk_pipeline_hint: apk.enabled ? null : apk.reason,
      apk_gradle_task: apk.gradle_task,
      apk_gradle_timeout_ms: apk.gradle_timeout_ms,
      apk_max_concurrent_gradle: apk.max_concurrent_gradle,
      admin_auth_enforced: adminAuthEnforcedFromEnv(),
    },
  };
}
