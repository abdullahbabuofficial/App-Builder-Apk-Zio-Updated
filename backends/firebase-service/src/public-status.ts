// Safe JSON for GET /api/status — no secrets, no connection strings.

export type DispatcherPublicStatus = {
  ok: true;
  service: 'apkzio-firebase-dispatcher';
  persistence: 'postgres';
  /** Distinguishes this worker from the REST `local-api` image. */
  role: 'fcm_dispatcher';
  features: {
    db_reachable: boolean;
    /** Default Firebase credentials env is non-empty (JSON not validated here). */
    firebase_default_credentials: boolean;
    /**
     * Mirrors local-api field name so dashboard copy can reuse labels.
     * True when default FCM credentials are present.
     */
    firebase_admin: boolean;
    email_via_resend: false;
    webview_zip_pipeline: false;
    apk_gradle_pipeline: false;
    apk_pipeline_hint: null;
    /** Dispatcher has no `/api/admin/*`; always false at runtime. */
    admin_auth_enforced: boolean;
  };
  worker: {
    inflight_notifications: number;
    worker_concurrency: number;
  };
};

export function buildDispatcherStatusPayload(
  dbReachable: boolean,
  inflightNotifications: number,
  workerConcurrency: number,
): DispatcherPublicStatus {
  const hasDefaultFcm = Boolean(process.env.DEFAULT_FCM_CREDENTIALS?.trim());
  return {
    ok: true,
    service: 'apkzio-firebase-dispatcher',
    persistence: 'postgres',
    role: 'fcm_dispatcher',
    features: {
      db_reachable: dbReachable,
      firebase_default_credentials: hasDefaultFcm,
      firebase_admin: hasDefaultFcm,
      email_via_resend: false,
      webview_zip_pipeline: false,
      apk_gradle_pipeline: false,
      apk_pipeline_hint: null,
      admin_auth_enforced: false,
    },
    worker: {
      inflight_notifications: inflightNotifications,
      worker_concurrency: workerConcurrency,
    },
  };
}
