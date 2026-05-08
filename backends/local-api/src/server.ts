import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs, createReadStream } from "node:fs";
import { randomBytes } from "node:crypto";
import archiver from "archiver";
import {
  ApkZioStore,
  type ApkBuild,
  type StoredUser,
  type WebViewBuildConfig,
  type WpPluginRange,
} from "./store.js";
import { BuildRunner, BUILDS_DIR } from "./builder/runner.js";
import {
  bearerFromHeader,
  signToken,
  verifyPassword,
  verifyToken,
  hashPassword,
} from "./auth.js";
import { createCheckoutSession, cancelSubscription, getSubscriptionDetails } from './billing-api.js';
import { handleStripeWebhook } from './stripe-webhooks.js';
import { BILLING_PLANS } from './billing-plans.js';
import { hasAdminAccess, isAdminApiRoute } from "./security.js";
import {
  buildResetPasswordEmail,
  buildVerifyEmail,
  isResendConfigured,
  sendResendEmail,
} from "./resend.js";
import {
  isFirebaseAdminConfigured,
  sendFcmMulticast,
  verifyFirebaseIdToken,
} from "./firebase-admin.js";
import { buildPublicStatusPayload } from "./public-status.js";
import { createBuilderRateLimitMiddleware } from "./builder-rate-limit.js";
import type { AnalyticsEvent, EventBatch } from "./events.js";
import { validateEvent, deduplicateEvents } from "./event-validator.js";
import { EventBuffer } from "./event-buffer.js";
import { apiLimiter, authLimiter, eventLimiter } from "./security/rate-limiter.js";
import { setupSecurityHeaders } from "./security/headers.js";
// import { setupCsrf } from "./security/csrf.js"; // Unused - commented out
import { aggregator } from "./aggregator.js";
import { getGeoBreakdown } from "./geo-aggregator.js";
import publicSdkRoutes from "./routes/public-sdk.js";
import {
  getDailyInstalls,
  getHourlyHeartbeats,
  getAppSummary,
  getPushStats,
  getRecentEvents,
  getGlobalAnalyticsOverview,
  getCrashAnalytics as queryCrashAnalytics,
  getCampaignErrors as queryCampaignErrors,
  getEventTrend,
} from "./analytics-queries.js";
import { initSentry, sentryErrorHandler } from "./monitoring/sentry.js";
// import { register } from "./monitoring/metrics.js"; // Unused - commented out
// Remove unused health check import
// import { checkHealth, checkDetailedHealth } from "./monitoring/health.js";
import { metricsMiddleware } from "./monitoring/middleware.js";

const _serverFileDir = path.dirname(fileURLToPath(import.meta.url));
/** Repo `backends/.env` then package `local-api/.env`. Second file wins (override), including over a stale `PORT` exported in the shell. */
dotenv.config({ path: path.resolve(_serverFileDir, "../../.env") });
dotenv.config({ path: path.resolve(_serverFileDir, "../.env"), override: true });

const PORT = Number(process.env.PORT ?? 3001);
const DEMO_SERVICE_KEY = process.env.APKZIO_SERVICE_KEY ?? "sk_live_demo_apkzio_local";
const ENFORCE_ADMIN_AUTH =
  (process.env.ENFORCE_ADMIN_AUTH ?? (process.env.NODE_ENV === "production" ? "1" : "0")) === "1";
const ADMIN_API_KEY = process.env.APKZIO_ADMIN_API_KEY ?? DEMO_SERVICE_KEY;
const USE_DATABASE = process.env.USE_DATABASE === "true";

// Initialize database if USE_DATABASE=true
if (USE_DATABASE) {
  const { runMigrations } = await import("./migrate.js");
  const { pool } = await import("./db.js");
  
  console.log('🔌 Connecting to database...');
  await pool.query('SELECT 1');
  console.log('✅ Database connected');
  
  console.log('🔄 Running migrations...');
  await runMigrations();
  console.log('✅ Migrations complete');
}

const store = new ApkZioStore(DEMO_SERVICE_KEY, USE_DATABASE);
const buildRunner = new BuildRunner(store);

const builderRateLimit = createBuilderRateLimitMiddleware();

// Event buffer for analytics ingestion
const eventBuffer = new EventBuffer({
  maxSize: 1000,
  flushIntervalMs: 5000,
  onFlush: async (events: AnalyticsEvent[]) => {
    store.insertEvents(events);
  },
});

// Create event rate limiter (100 requests per minute per IP)
import { createFixedWindowLimiter } from "./builder-rate-limit.js";
const eventRateLimiter = createFixedWindowLimiter(100, 60000);

function eventRateLimitMiddleware(): express.RequestHandler {
  return (req, res, next): void => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    if (!eventRateLimiter(ip)) {
      res.status(429).json({
        ok: false,
        error: {
          code: "rate_limited",
          message: "Too many event requests. Try again later.",
        },
      });
      return;
    }
    next();
  };
}

/** Source tree for the distributable WordPress plugin (sibling of `src/` / `dist/`). */
const WP_PLUGIN_SRC_DIR = path.resolve(_serverFileDir, "..", "wordpress-plugin", "apkzio-telemetry");
const app = express();

// Initialize Sentry error tracking (must be first)
initSentry(app);

if ((process.env.APKZIO_TRUST_PROXY ?? "").trim() === "1") {
  app.set("trust proxy", 1);
}

// Apply security headers
setupSecurityHeaders(app);

app.use(
  cors({
    origin: true,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "X-Apkzio-Admin-Key",
      "x-apkzio-admin-key",
      "stripe-signature",
      "X-CSRF-Token",
    ],
    credentials: true,
  }),
);

// Stripe webhook needs raw body for signature verification
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);

// Builder requests can include a source logo data URL (a few hundred KB) and
// occasional generated icon assets — bump the JSON limit so legitimate uploads
// don't hit 413. Anything larger than this is genuinely abusive.
app.use(express.json({ limit: "5mb" }));

// When `express.json` rejects an oversize body it throws *before* the route
// handler runs, which means CORS headers from individual responses never get
// set and the browser reports a generic "Failed to fetch". Catch that here
// and emit a clean JSON error with the right headers.
app.use((errInstance: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (errInstance && typeof errInstance === "object" && "type" in errInstance) {
    const typed = errInstance as { type?: string; status?: number; message?: string };
    if (typed.type === "entity.too.large") {
      res.status(413).json({
        ok: false,
        error: { code: "payload_too_large", message: "Build request payload is too large." },
      });
      return;
    }
  }
  next(errInstance);
});

// Metrics middleware (after JSON parsing, before request logging)
app.use(metricsMiddleware);

function log(level: "info" | "warn" | "error", event: string, payload: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      level,
      event,
      service: "apkzio-local-api",
      ...payload,
    }),
  );
}

app.use((req, res, next) => {
  const startedAt = Date.now();
  const requestId = randomBytes(8).toString("hex");
  res.setHeader("x-request-id", requestId);
  res.on("finish", () => {
    log("info", "http_request", {
      request_id: requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: Date.now() - startedAt,
      ip: req.ip,
    });
  });
  next();
});

app.use((req, res, next) => {
  if (!isAdminApiRoute(req.path)) return next();
  const providedAdminKey =
    typeof req.headers["x-apkzio-admin-key"] === "string"
      ? req.headers["x-apkzio-admin-key"]
      : null;
  const allowed = hasAdminAccess({
    enforce: ENFORCE_ADMIN_AUTH,
    adminApiKey: ADMIN_API_KEY,
    providedApiKey: providedAdminKey,
    user: optionalUser(req),
  });
  if (!allowed) {
    return err(
      res,
      "forbidden",
      "Admin access required. Provide x-apkzio-admin-key or use a verified business/enterprise account.",
      403,
    );
  }
  return next();
});

function ok(res: express.Response, body: unknown, status = 200) {
  res.status(status).json(body);
}

function err(res: express.Response, code: string, message: string, status: number) {
  res.status(status).json({ ok: false, error: { code, message } });
}

// --- Dashboard REST (used by apkzio-admin when VITE_APKZIO_API_URL is set) ---

app.get("/health", (_req, res) => ok(res, { ok: true, service: "apkzio-local-api" }));

/** Safe capability snapshot for dashboards (no secrets). Older deployments may omit this route. */
app.get("/api/status", (_req, res) => ok(res, buildPublicStatusPayload()));

app.get("/api/apps", async (_req, res) => {
  ok(res, { ok: true, apps: await store.listApps() });
});

app.get("/api/apps/:appId", async (req, res) => {
  const appRow = store.apps.get(req.params.appId);
  if (!appRow) return err(res, "not_found", "App not found", 404);
  ok(res, { ok: true, app: appRow });
});

app.post("/api/apps", async (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  try {
    const created = await store.createApp({
      name: typeof b.name === "string" ? b.name : "",
      package_name: typeof b.package_name === "string" ? b.package_name : "",
      fcm_project_id: typeof b.fcm_project_id === "string" ? b.fcm_project_id : null,
      icon_glyph: typeof b.icon_glyph === "string" ? b.icon_glyph : undefined,
      icon_color: typeof b.icon_color === "string" ? b.icon_color : undefined,
    });
    
    // Trigger webhook
    void import("./webhooks/trigger.js").then(m => {
      void m.triggerWebhook("app.created", {
        app_id: created.id,
        name: created.name,
        package_name: created.package_name,
        created_at: created.created_at,
      });
    }).catch(() => undefined);
    
    return ok(res, { ok: true, app: created });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "create_failed";
    if (msg === "name_required" || msg === "package_name_required") {
      return err(res, "invalid_request", msg, 400);
    }
    return err(res, "invalid_request", msg, 400);
  }
});

app.patch("/api/apps/:appId", async (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const patch: Parameters<typeof store.updateApp>[1] = {};
  if (typeof b.name === "string") patch.name = b.name;
  if (b.status === "active" || b.status === "paused" || b.status === "suspended") patch.status = b.status;
  if ("fcm_project_id" in b) {
    patch.fcm_project_id = typeof b.fcm_project_id === "string" ? b.fcm_project_id : null;
  }
  if (typeof b.icon_glyph === "string") patch.icon_glyph = b.icon_glyph;
  if (typeof b.icon_color === "string") patch.icon_color = b.icon_color;
  try {
    const updated = store.updateApp(req.params.appId, patch);
    return ok(res, { ok: true, app: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "update_failed";
    if (msg === "not_found") return err(res, "not_found", "App not found", 404);
    return err(res, "invalid_request", msg, 400);
  }
});

app.delete("/api/apps/:appId", async (req, res) => {
  const removed = store.deleteApp(req.params.appId);
  if (!removed) return err(res, "not_found", "App not found", 404);
  return ok(res, { ok: true });
});

app.get("/api/apps/:appId/devices", async (req, res) => {
  ok(res, { ok: true, devices: await store.getDevicesForApp(req.params.appId) });
});

app.get("/api/apps/:appId/subscribers", async (req, res) => {
  ok(res, { ok: true, subscribers: await store.getSubscribersForApp(req.params.appId) });
});

app.patch("/api/subscribers/:id", (req, res) => {
  try {
    const b = (req.body ?? {}) as Record<string, unknown>;
    if (typeof b.is_valid !== "boolean") {
      return err(res, "invalid_request", "is_valid boolean is required", 400);
    }
    const subscriber = store.updateSubscriberValidity(req.params.id, b.is_valid);
    return ok(res, { ok: true, subscriber });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "update_failed";
    if (msg === "not_found") return err(res, "not_found", "Subscriber not found", 404);
    return err(res, "invalid_request", msg, 400);
  }
});

app.get("/api/campaigns", (_req, res) => {
  ok(res, { ok: true, campaigns: store.campaigns });
});

app.get("/api/campaigns/:id", (req, res) => {
  const c = store.campaigns.find((x) => x.id === req.params.id);
  if (!c) return err(res, "not_found", "Campaign not found", 404);
  ok(res, { ok: true, campaign: c });
});

app.post("/api/campaigns", async (req, res) => {
  try {
    const b = req.body ?? {};
    const appId = String(b.app_id);
    const title = String(b.title);
    const body = String(b.body);
    const targetType = (b.target_type ?? "all") as "all" | "active" | "country" | "device_list";
    const scheduledAt = b.scheduled_at ?? null;
    const isScheduled = !!scheduledAt && +new Date(String(scheduledAt)) > Date.now();
    const tokens =
      !isScheduled && isFirebaseAdminConfigured()
        ? store.resolveFcmTokens(appId, {
            type: targetType,
            active_within_minutes: b.active_within_minutes,
            country_codes: b.country_codes,
            device_ids: b.device_ids,
          })
        : [];

    const camp = await store.createCampaign({
      app_id: appId,
      title,
      body,
      image_url: b.image_url ?? null,
      click_url: b.click_url ?? null,
      target_type: targetType,
      active_within_minutes: b.active_within_minutes,
      country_codes: b.country_codes,
      device_ids: b.device_ids,
      scheduled_at: scheduledAt,
    });
    ok(res, { ok: true, campaign: camp });
    if (!isScheduled && tokens.length > 0) {
      void sendFcmMulticast({
        tokens,
        title,
        body,
        data: { campaign_id: camp.id, app_id: appId, kind: "campaign" },
      }).catch(() => undefined);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "create_failed";
    if (msg === "app_not_found") return err(res, "not_found", "App not found", 404);
    err(res, "invalid_request", msg, 400);
  }
});

app.post("/api/campaigns/:id/pause", (req, res) => {
  try {
    const c = store.pauseCampaign(req.params.id);
    return ok(res, { ok: true, campaign: c });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "not_found") return err(res, "not_found", "Campaign not found", 404);
    if (msg === "invalid_state") {
      return err(res, "invalid_state", "Campaign cannot be paused in its current status", 409);
    }
    return err(res, "invalid_request", msg, 400);
  }
});

app.post("/api/campaigns/:id/cancel", (req, res) => {
  try {
    const c = store.cancelCampaign(req.params.id);
    return ok(res, { ok: true, campaign: c });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "not_found") return err(res, "not_found", "Campaign not found", 404);
    if (msg === "invalid_state") {
      return err(res, "invalid_state", "Campaign cannot be cancelled in its current status", 409);
    }
    return err(res, "invalid_request", msg, 400);
  }
});

app.post("/api/campaigns/:id/duplicate", (req, res) => {
  try {
    const c = store.duplicateCampaign(req.params.id);
    return ok(res, { ok: true, campaign: c });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "not_found") return err(res, "not_found", "Campaign not found", 404);
    return err(res, "invalid_request", msg, 400);
  }
});

app.post("/api/campaigns/:id/send", async (req, res) => {
  try {
    const c = await store.sendDraftCampaign(req.params.id);
    ok(res, { ok: true, campaign: c });
    
    // Trigger webhook
    void import("./webhooks/trigger.js").then(m => {
      void m.triggerWebhook("campaign.sent", {
        campaign_id: c.id,
        app_id: c.app_id,
        title: c.title,
        recipients_count: store.resolveFcmTokens(c.app_id, {
          type: c.target_type,
          active_within_minutes: c.active_within_minutes,
          country_codes: c.country_codes,
          device_ids: c.device_ids,
        }).length,
        sent_at: new Date().toISOString(),
      });
    }).catch(() => undefined);
    
    if (isFirebaseAdminConfigured()) {
      const tokens = store.resolveFcmTokens(c.app_id, {
        type: c.target_type,
        active_within_minutes: c.active_within_minutes,
        country_codes: c.country_codes,
        device_ids: c.device_ids,
      });
      if (tokens.length > 0) {
        void sendFcmMulticast({
          tokens,
          title: c.title,
          body: c.body,
          data: { campaign_id: c.id, app_id: c.app_id, kind: "campaign" },
        }).catch(() => undefined);
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "not_found") return err(res, "not_found", "Campaign not found", 404);
    if (msg === "invalid_state") {
      return err(res, "invalid_state", "Only draft campaigns can be sent from this endpoint", 409);
    }
    if (msg === "app_not_found") return err(res, "not_found", "App not found", 404);
    return err(res, "invalid_request", msg, 400);
  }
});

// --- Analytics & Crash Tracking ---

app.get("/api/analytics/crashes", async (req, res) => {
  const appId = typeof req.query.app_id === "string" ? req.query.app_id : "";
  const range = req.query.range === "24h" || req.query.range === "30d" ? req.query.range : "7d";
  
  if (!appId) return err(res, "invalid_request", "app_id is required", 400);
  
  try {
    const analytics = await queryCrashAnalytics(appId, range);
    return ok(res, { ok: true, data: analytics });
  } catch (e) {
    console.error("Crash analytics error:", e);
    const msg = e instanceof Error ? e.message : "error";
    return err(res, "query_failed", msg, 500);
  }
});

app.post("/api/events/crash", (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  try {
    const result = store.recordCrash({
      app_id: typeof b.app_id === "string" ? b.app_id : "",
      device_id: typeof b.device_id === "string" ? b.device_id : undefined,
      crash_type: typeof b.crash_type === "string" ? b.crash_type : "",
      stack_trace: typeof b.stack_trace === "string" ? b.stack_trace : undefined,
      app_version: typeof b.app_version === "string" ? b.app_version : undefined,
      os_version: typeof b.os_version === "string" ? b.os_version : undefined,
      manufacturer: typeof b.manufacturer === "string" ? b.manufacturer : undefined,
      model: typeof b.model === "string" ? b.model : undefined,
      metadata: typeof b.metadata === "object" && b.metadata !== null ? b.metadata as Record<string, unknown> : undefined,
    });
    return ok(res, { ok: true, crash_id: result.crash_id }, 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "app_not_found") return err(res, "not_found", "App not found", 404);
    return err(res, "invalid_request", msg, 400);
  }
});

app.get("/api/campaigns/:id/errors", async (req, res) => {
  try {
    const errors = await queryCampaignErrors(req.params.id);
    return ok(res, { ok: true, errors });
  } catch (e) {
    console.error("Campaign errors query failed:", e);
    const msg = e instanceof Error ? e.message : "error";
    return err(res, "query_failed", msg, 500);
  }
});

app.post("/api/campaigns/:id/errors", (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  try {
    const result = store.recordCampaignError({
      campaign_id: req.params.id,
      error_code: typeof b.error_code === "string" ? b.error_code : "",
      error_message: typeof b.error_message === "string" ? b.error_message : undefined,
      subscriber_id: typeof b.subscriber_id === "string" ? b.subscriber_id : undefined,
      device_info: typeof b.device_info === "object" && b.device_info !== null ? b.device_info as Record<string, unknown> : undefined,
    });
    return ok(res, { ok: true, error_id: result.error_id }, 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "campaign_not_found") return err(res, "not_found", "Campaign not found", 404);
    return err(res, "invalid_request", msg, 400);
  }
});

app.get("/api/api-keys", (_req, res) => ok(res, { ok: true, api_keys: store.apiKeys }));

app.post("/api/api-keys", async (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  try {
    const result = await store.createApiKey({
      app_id: typeof b.app_id === "string" ? b.app_id : "",
      name: typeof b.name === "string" ? b.name : "",
      scopes: Array.isArray(b.scopes) ? (b.scopes as unknown[]).map((s) => String(s)) : [],
      rate_limit_rpm: typeof b.rate_limit_rpm === "number" ? b.rate_limit_rpm : Number(b.rate_limit_rpm) || 600,
      expires_at: typeof b.expires_at === "string" ? b.expires_at : b.expires_at === null ? null : null,
      environment: b.environment === "test" ? "test" : "live",
    });
    return ok(res, { ok: true, api_key: result.api_key, secret: result.secret });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "create_failed";
    if (msg === "app_not_found") return err(res, "not_found", "App not found", 404);
    return err(res, "invalid_request", msg, 400);
  }
});

app.patch("/api/api-keys/:id", (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const patch: Parameters<typeof store.updateApiKey>[1] = {};
  if (typeof b.is_active === "boolean") patch.is_active = b.is_active;
  if (typeof b.name === "string") patch.name = b.name;
  if (Array.isArray(b.scopes)) patch.scopes = (b.scopes as unknown[]).map((s) => String(s));
  if (typeof b.rate_limit_rpm === "number") patch.rate_limit_rpm = b.rate_limit_rpm;
  if ("expires_at" in b) {
    patch.expires_at = typeof b.expires_at === "string" ? b.expires_at : null;
  }
  try {
    const k = store.updateApiKey(req.params.id, patch);
    return ok(res, { ok: true, api_key: k });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "update_failed";
    if (msg === "not_found") return err(res, "not_found", "API key not found", 404);
    return err(res, "invalid_request", msg, 400);
  }
});

app.delete("/api/api-keys/:id", (req, res) => {
  try {
    const k = store.revokeApiKey(req.params.id);
    return ok(res, { ok: true, api_key: k });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "delete_failed";
    if (msg === "not_found") return err(res, "not_found", "API key not found", 404);
    return err(res, "invalid_request", msg, 400);
  }
});

app.get("/api/builds", (_req, res) => ok(res, { ok: true, builds: store.builds }));

// Body shape matches `CreateBuildInput` in `apkzio-admin/src/lib/api.ts` (flat WebView
// keys parsed into `config` below).
app.post("/api/builds", async (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  try {
    const config = parseWebViewConfig(b);
    const build = await store.createBuild({
      app_id: typeof b.app_id === "string" ? b.app_id : "",
      version_code: typeof b.version_code === "number" ? b.version_code : Number(b.version_code),
      version_name: typeof b.version_name === "string" ? b.version_name : "",
      branch: typeof b.branch === "string" ? b.branch : undefined,
      release_notes: typeof b.release_notes === "string" ? b.release_notes : undefined,
      config,
    });
    // Kick off the real WebView pipeline asynchronously — runner.startBuild
    // does its own scheduling, so the HTTP response stays fast.
    buildRunner.startBuild(build.id);
    return ok(res, { ok: true, build });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "create_failed";
    if (msg === "app_not_found") return err(res, "not_found", "App not found", 404);
    return err(res, "invalid_request", msg, 400);
  }
});

/**
 * Parse the optional WebView fields off a `POST /api/builds` body. We only
 * surface fields the caller actually set — the runner's `resolveConfig` fills
 * in defaults from the parent app row when keys are missing or empty.
 */
function parseWebViewConfig(b: Record<string, unknown>): Partial<WebViewBuildConfig> | null {
  const out: Partial<WebViewBuildConfig> = {};
  let hasAny = false;

  const setStr = (key: keyof WebViewBuildConfig) => {
    const v = b[key as string];
    if (typeof v === "string" && v.length > 0) {
      (out as Record<string, unknown>)[key as string] = v;
      hasAny = true;
    }
  };
  const setBool = (key: keyof WebViewBuildConfig) => {
    const v = b[key as string];
    if (typeof v === "boolean") {
      (out as Record<string, unknown>)[key as string] = v;
      hasAny = true;
    }
  };

  setStr("app_name");
  setStr("package_name");
  setStr("start_url");
  setStr("primary_color");
  setStr("background_color");
  setStr("splash_color");
  setStr("offline_message");
  setStr("release_notes");
  setBool("allow_file_uploads");
  setBool("allow_geolocation");
  setBool("allow_camera");
  setBool("pull_to_refresh");
  setBool("swipe_back");

  if (!hasAny) return null;
  return out;
}

app.get("/api/builds/:id/logs", (req, res) => {
  try {
    const logs = store.getBuildLogs(req.params.id);
    return ok(res, { ok: true, logs });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "not_found") return err(res, "not_found", "Build not found", 404);
    return err(res, "invalid_request", msg, 400);
  }
});

/**
 * Stream a generated build artifact (`source.zip`, `app-debug.apk`, release APK, …).
 * Paths resolve under `BUILDS_DIR` with traversal checks on both URL segments.
 */
app.get("/artifacts/:buildId/:filename", async (req, res) => {
  const { buildId, filename } = req.params;
  if (!/^[a-z0-9-]{1,64}$/i.test(buildId)) {
    return err(res, "invalid_request", "invalid buildId", 400);
  }
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(filename) || filename.includes("..")) {
    return err(res, "invalid_request", "invalid filename", 400);
  }

  const buildDir = path.resolve(BUILDS_DIR, buildId);
  const target = path.resolve(buildDir, filename);
  if (
    target !== buildDir &&
    !target.startsWith(buildDir + path.sep)
  ) {
    return err(res, "invalid_request", "path traversal rejected", 400);
  }

  const stat = await fs.stat(target).catch(() => null);
  if (!stat || !stat.isFile()) {
    return err(res, "not_found", "artifact not found", 404);
  }

  const ext = path.extname(filename).toLowerCase();
  const safeName = filename.replace(/"/g, "");
  if (ext === ".zip") {
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
  } else if (ext === ".apk") {
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
  } else if (ext === ".txt" || ext === ".log") {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
  } else {
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
  }
  res.setHeader("Content-Length", String(stat.size));

  const stream = createReadStream(target);
  stream.on("error", () => {
    if (!res.headersSent) err(res, "io_error", "failed to read artifact", 500);
    else res.end();
  });
  stream.pipe(res);
  return undefined;
});

app.get("/api/analytics/overview", async (req, res) => {
  const seed = typeof req.query.seed === "string" ? req.query.seed : "global";
  
  // Parse seed to extract appId (format: "ana-{appId}-{range}")
  const parts = seed.split("-");
  const appId = parts.length >= 2 && parts[1] !== "all" ? parts[1] : undefined;
  const rangePart = parts.length >= 3 ? parts[2] : "30d";
  const days = rangePart === "90d" ? 90 : rangePart === "7d" ? 7 : 30;
  
  try {
    const data = await getGlobalAnalyticsOverview(appId, days);
    ok(res, { ok: true, ...data });
  } catch (e) {
    console.error("Analytics overview error:", e);
    return err(res, "query_failed", "Failed to fetch analytics", 500);
  }
});

app.get("/api/apps/:appId/analytics/installs", (req, res) => {
  const { appId } = req.params;
  const days = typeof req.query.days === "string" ? parseInt(req.query.days, 10) : 14;
  
  if (isNaN(days) || days < 1 || days > 365) {
    return err(res, "invalid_request", "days must be between 1 and 365", 400);
  }
  
  const trends = store.getAppInstallTrends(appId, days);
  ok(res, { ok: true, trends });
});

app.get("/api/apps/:appId/analytics/heartbeats", async (req, res) => {
  const { appId } = req.params;
  const hours = typeof req.query.hours === "string" ? parseInt(req.query.hours, 10) : 48;
  
  if (isNaN(hours) || hours < 1 || hours > 168) {
    return err(res, "invalid_request", "hours must be between 1 and 168", 400);
  }
  
  try {
    const trends = await getHourlyHeartbeats(appId, hours);
    ok(res, { ok: true, trends });
  } catch (e) {
    console.error("Heartbeat trends error:", e);
    return err(res, "query_failed", "Failed to fetch trends", 500);
  }
});

app.get("/api/analytics/events/:eventName/trends", async (req, res) => {
  const { eventName } = req.params;
  const days = typeof req.query.days === "string" ? parseInt(req.query.days, 10) : 30;
  
  if (isNaN(days) || days < 1 || days > 365) {
    return err(res, "invalid_request", "days must be between 1 and 365", 400);
  }
  
  try {
    // Note: getEventTrend expects hours, so convert days to hours
    const hours = days * 24;
    const trendData = await getEventTrend('all', eventName, hours);
    // Convert to array of numbers for frontend compatibility
    const trends = trendData.map(t => t.count);
    ok(res, { ok: true, trends });
  } catch (e) {
    console.error("Event trends error:", e);
    return err(res, "query_failed", "Failed to fetch trends", 500);
  }
});

// --- Optimized Analytics Endpoints (using aggregations) ---

/**
 * Get comprehensive analytics overview for an app
 * Uses pre-aggregated hourly/daily rollups for fast queries
 */
app.get("/api/apps/:appId/analytics/overview", async (req, res) => {
  const { appId } = req.params;
  const range = typeof req.query.range === "string" ? req.query.range : "30d";
  
  if (!appId) {
    return err(res, "invalid_request", "appId is required", 400);
  }
  
  try {
    const [dailyInstalls, hourlyHeartbeats, geoBreakdown, summary, pushStats, recentEvents] = await Promise.all([
      getDailyInstalls(appId, 30),
      getHourlyHeartbeats(appId, 48),
      getGeoBreakdown(appId, range),
      getAppSummary(appId, 30),
      getPushStats(appId, 30),
      getRecentEvents(appId, 20),
    ]);
    
    ok(res, {
      ok: true,
      dailyInstalls,
      hourlyHeartbeats,
      geoBreakdown,
      summary,
      pushStats,
      recentEvents,
    });
  } catch (error) {
    console.error("Analytics overview error:", error);
    return err(res, "query_failed", "Failed to fetch analytics", 500);
  }
});

/**
 * Get geographic breakdown for an app
 */
app.get("/api/apps/:appId/analytics/geo", async (req, res) => {
  const { appId } = req.params;
  const range = typeof req.query.range === "string" ? req.query.range : "7d";
  
  if (!appId) {
    return err(res, "invalid_request", "appId is required", 400);
  }
  
  try {
    const geoBreakdown = await getGeoBreakdown(appId, range);
    ok(res, { ok: true, geoBreakdown });
  } catch (error) {
    console.error("Geo breakdown error:", error);
    return err(res, "query_failed", "Failed to fetch geo breakdown", 500);
  }
});

/**
 * Get app summary statistics
 */
app.get("/api/apps/:appId/analytics/summary", async (req, res) => {
  const { appId } = req.params;
  const days = typeof req.query.days === "string" ? parseInt(req.query.days, 10) : 30;
  
  if (!appId) {
    return err(res, "invalid_request", "appId is required", 400);
  }
  
  if (isNaN(days) || days < 1 || days > 365) {
    return err(res, "invalid_request", "days must be between 1 and 365", 400);
  }
  
  try {
    const summary = await getAppSummary(appId, days);
    ok(res, { ok: true, summary });
  } catch (error) {
    console.error("Summary error:", error);
    return err(res, "query_failed", "Failed to fetch summary", 500);
  }
});

/**
 * Get push notification statistics
 */
app.get("/api/apps/:appId/analytics/push", async (req, res) => {
  const { appId } = req.params;
  const days = typeof req.query.days === "string" ? parseInt(req.query.days, 10) : 30;
  
  if (!appId) {
    return err(res, "invalid_request", "appId is required", 400);
  }
  
  if (isNaN(days) || days < 1 || days > 365) {
    return err(res, "invalid_request", "days must be between 1 and 365", 400);
  }
  
  try {
    const pushStats = await getPushStats(appId, days);
    ok(res, { ok: true, pushStats });
  } catch (error) {
    console.error("Push stats error:", error);
    return err(res, "query_failed", "Failed to fetch push stats", 500);
  }
});

// --- WordPress plugin telemetry (public ingest) + admin Plugins APIs ---
// See block comment on POST /api/wp/v1/register for the PHP plugin contract.

const wpTelemetryRate = new Map<string, { windowStart: number; count: number }>();

function allowWpTelemetry(siteId: string, maxPerMinute = 120): boolean {
  const now = Date.now();
  let cur = wpTelemetryRate.get(siteId);
  if (!cur || now - cur.windowStart >= 60_000) {
    cur = { windowStart: now, count: 0 };
  }
  cur.count += 1;
  wpTelemetryRate.set(siteId, cur);
  return cur.count <= maxPerMinute;
}

function wpSiteTokenFromRequest(req: express.Request): string | null {
  const h = req.headers.authorization;
  if (typeof h === "string" && h.toLowerCase().startsWith("bearer ")) {
    return h.slice(7).trim() || null;
  }
  const x = req.headers["x-apkzio-site-token"];
  if (typeof x === "string" && x.trim()) return x.trim();
  return null;
}

function parseWpRange(q: unknown): WpPluginRange {
  if (q === "rt" || q === "d" || q === "w" || q === "m") return q;
  return "rt";
}

app.get("/api/wp-plugins", (req, res) => {
  const range = parseWpRange(req.query.range);
  const plugins = store.listWpPlugins().map((plugin) => ({
    plugin,
    rollup: store.wpRollupTotals(plugin.id, range),
  }));
  ok(res, { ok: true, range, plugins });
});

app.get("/api/wp-plugins/:pluginId/distribution.zip", async (req, res) => {
  const plugin = store.getWpPlugin(req.params.pluginId);
  if (!plugin) return err(res, "not_found", "Plugin not found", 404);
  try {
    await fs.access(path.join(WP_PLUGIN_SRC_DIR, "apkzio-telemetry.php"));
  } catch {
    return err(res, "not_found", "WordPress plugin source is missing on this server", 404);
  }

  const slugSafe = plugin.slug.replace(/[^a-z0-9-_]/gi, "-").slice(0, 64) || "apkzio-telemetry";

  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${slugSafe}-apkzio-telemetry-wordpress.zip"`,
  );
  res.setHeader("X-Apkzio-Plugin-Id", plugin.id);
  res.setHeader("X-Apkzio-Plugin-Slug", plugin.slug);

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (e) => {
    log("error", "wp_plugin_zip", { message: e.message });
    if (!res.headersSent) err(res, "zip_error", e.message, 500);
    else {
      try {
        res.end();
      } catch {
        /* ignore */
      }
    }
  });

  archive.pipe(res);

  const embeddedPhp = `<?php
if (!defined('ABSPATH')) {
	exit;
}
if (!defined('APKZIO_EMBEDDED_PLUGIN_ID')) {
	define('APKZIO_EMBEDDED_PLUGIN_ID', ${JSON.stringify(plugin.id)});
}
`;
  archive.append(embeddedPhp, { name: "apkzio-telemetry/apkzio-embedded-config.php" });

  const readme = `ApkZio Telemetry — WordPress
================================

Product: ${plugin.name}
Plugin ID (embedded): ${plugin.id}

Install
-------
1. In WP Admin → Plugins → Add New → Upload Plugin, choose this ZIP.
2. Activate "ApkZio Telemetry".
3. Go to Settings → ApkZio, enter your ApkZio API base URL (e.g. http://127.0.0.1:8787).
4. The Plugin ID field is pre-filled for this product; click "Connect / reconnect to ApkZio".
5. Your site appears in ApkZio Admin → Plugins → ${plugin.name} → Connected sites.

Telemetry runs about every 5 minutes and counts public page views.
`;
  archive.append(readme, { name: "apkzio-telemetry/readme.txt" });

  const entries = await fs.readdir(WP_PLUGIN_SRC_DIR, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    if (ent.name === "apkzio-embedded-config.php") continue;
    const full = path.join(WP_PLUGIN_SRC_DIR, ent.name);
    archive.file(full, { name: `apkzio-telemetry/${ent.name}` });
  }

  await archive.finalize();
});

app.get("/api/wp-plugins/:pluginId", (req, res) => {
  const plugin = store.getWpPlugin(req.params.pluginId);
  if (!plugin) return err(res, "not_found", "Plugin not found", 404);
  const range = parseWpRange(req.query.range);
  const rollup = store.wpRollupTotals(plugin.id, range);
  const series_pageviews = store.wpAggregatedSeries(plugin.id, range, "pageviews");
  const series_uniques = store.wpAggregatedSeries(plugin.id, range, "uniques");
  ok(res, {
    ok: true,
    plugin,
    range,
    rollup,
    series_pageviews,
    series_uniques,
  });
});

app.get("/api/wp-plugins/:pluginId/sites", (req, res) => {
  const plugin = store.getWpPlugin(req.params.pluginId);
  if (!plugin) return err(res, "not_found", "Plugin not found", 404);
  const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const includeSeries = req.query.include_series === "1" || req.query.include_series === "true";
  let rows = store.listWpSitesForPlugin(plugin.id);
  if (q) rows = rows.filter((r) => r.site_url.toLowerCase().includes(q));
  rows.sort((a, b) => +new Date(b.last_seen_at) - +new Date(a.last_seen_at));
  const total = rows.length;
  const page = rows.slice(offset, offset + limit);
  const sites = page.map((row) => {
    const base = store.wpSiteToPublic(row);
    if (!includeSeries) return base;
    return { ...base, sparkline: store.wpSiteSparkline(row.id, 24) };
  });
  ok(res, { ok: true, sites, total, limit, offset });
});

/**
 * WordPress plugin HTTP contract (v1)
 *
 * POST /api/wp/v1/register
 * Body JSON: { "plugin_id": "<uuid>", "site_url": "https://example.com", "wp_version"?: "6.5", "plugin_version"?: "1.0.0" }
 * Response: { ok, site: WpSiteInstall, site_token: "<plaintext-once>" } — store site_token in wp_options; never log it.
 *
 * POST /api/wp/v1/telemetry
 * Headers: Authorization: Bearer <site_token> OR X-Apkzio-Site-Token: <site_token>
 * Body JSON: {
 *   "site_id": "<uuid>",
 *   "pageviews_delta": <int since last ping>,
 *   "uniques_delta": <int>,
 *   "subscribers_total": <int absolute count>,
 *   "wp_version"?: string,
 *   "plugin_version"?: string
 * }
 * Response: { ok, site: WpSiteInstall }
 *
 * Seeded dev sites accept token `wpt_local_<site_id>` (sha256 stored server-side). Production sites should use tokens from register only.
 */
app.post("/api/wp/v1/register", (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const plugin_id = typeof b.plugin_id === "string" ? b.plugin_id.trim() : "";
  const site_url = typeof b.site_url === "string" ? b.site_url.trim() : "";
  if (!plugin_id) return err(res, "invalid_request", "plugin_id is required", 400);
  try {
    const { site, site_token } = store.registerWpSite({
      plugin_id,
      site_url,
      wp_version: typeof b.wp_version === "string" ? b.wp_version : undefined,
      plugin_version: typeof b.plugin_version === "string" ? b.plugin_version : undefined,
    });
    return ok(res, { ok: true, site, site_token });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "register_failed";
    if (msg === "plugin_not_found") return err(res, "not_found", "Unknown plugin_id", 404);
    if (msg === "invalid_site_url") return err(res, "invalid_request", "site_url must start with http:// or https://", 400);
    return err(res, "invalid_request", msg, 400);
  }
});

app.post("/api/wp/v1/telemetry", (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const site_id = typeof b.site_id === "string" ? b.site_id.trim() : "";
  if (!site_id) return err(res, "invalid_request", "site_id is required", 400);
  const token = wpSiteTokenFromRequest(req);
  if (!token) {
    return err(res, "unauthorized", "Bearer site token or X-Apkzio-Site-Token required", 401);
  }
  const authed = store.verifyWpSiteToken(site_id, token);
  if (!authed) return err(res, "unauthorized", "Invalid site_id or token", 401);
  if (!allowWpTelemetry(site_id)) {
    return err(res, "rate_limited", "Too many telemetry posts for this site", 429);
  }
  try {
    const site = store.ingestWpTelemetry(site_id, token, {
      wp_version: typeof b.wp_version === "string" ? b.wp_version : undefined,
      plugin_version: typeof b.plugin_version === "string" ? b.plugin_version : undefined,
      pageviews_delta: Number(b.pageviews_delta) || 0,
      uniques_delta: Number(b.uniques_delta) || 0,
      subscribers_total: Number(b.subscribers_total) || 0,
    });
    return ok(res, { ok: true, site });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "telemetry_failed";
    if (msg === "unauthorized") return err(res, "unauthorized", "Invalid site_id or token", 401);
    return err(res, "invalid_request", msg, 400);
  }
});

// --- Auth helpers ---

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Read Bearer token from request, return matching user or null. */
function optionalUser(req: express.Request): StoredUser | null {
  const token = bearerFromHeader(req.headers as Record<string, string | string[] | undefined>);
  if (!token) return null;
  const claims = verifyToken(token);
  if (!claims) return null;
  return store.findUserById(claims.user_id) ?? null;
}

/** Like `optionalUser` but writes a 401 and returns null when missing/invalid. */
function requireUser(req: express.Request, res: express.Response): StoredUser | null {
  const token = bearerFromHeader(req.headers as Record<string, string | string[] | undefined>);
  if (!token) {
    err(res, "unauthorized", "Bearer token required", 401);
    return null;
  }
  const claims = verifyToken(token);
  if (!claims) {
    err(res, "unauthorized", "Invalid or expired token", 401);
    return null;
  }
  const u = store.findUserById(claims.user_id);
  if (!u) {
    err(res, "unauthorized", "User no longer exists", 401);
    return null;
  }
  return u;
}

function authResponse(user: StoredUser) {
  store.touchUserLastSeen(user.id);
  const fresh = store.findUserById(user.id) ?? user;
  return {
    ok: true as const,
    token: signToken(fresh.id),
    user: store.publicUser(fresh),
  };
}

// --- Admin CRM (requires admin middleware: key or privileged account) ---

app.get("/api/admin/clients", (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const plan = typeof req.query.plan === "string" ? req.query.plan : "";
  const statusRaw = typeof req.query.status === "string" ? req.query.status.trim().toLowerCase() : "";
  const status =
    statusRaw === "lead" || statusRaw === "active" || statusRaw === "churned"
      ? statusRaw
      : undefined;
  const glRaw = req.query.google_linked;
  const glStr = typeof glRaw === "string" ? glRaw.trim().toLowerCase() : "";
  const google_linked =
    glStr === "1" || glStr === "true"
      ? true
      : glStr === "0" || glStr === "false"
        ? false
        : undefined;
  const offset = Math.max(0, Number.parseInt(String(req.query.offset ?? "0"), 10) || 0);
  const limitRaw = Number.parseInt(String(req.query.limit ?? "50"), 10) || 50;
  const limit = Math.min(200, Math.max(1, limitRaw));
  const { total, clients } = store.listAdminClients({
    q,
    plan,
    status,
    google_linked,
    offset,
    limit,
  });
  return ok(res, { ok: true, total, clients });
});

app.get("/api/admin/clients/:userId", (req, res) => {
  const detail = store.getAdminClientDetail(req.params.userId);
  if (!detail) return err(res, "not_found", "Client not found", 404);
  return ok(res, { ok: true, client: detail });
});

app.post("/api/admin/clients", (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  try {
    const client = store.createAdminClient({
      email: typeof b.email === "string" ? b.email : "",
      full_name: typeof b.full_name === "string" ? b.full_name : "",
      plan:
        b.plan === "starter" || b.plan === "pro" || b.plan === "business" || b.plan === "enterprise"
          ? b.plan
          : undefined,
      phone: typeof b.phone === "string" ? b.phone : undefined,
      location: typeof b.location === "string" ? b.location : undefined,
      website: typeof b.website === "string" ? b.website : undefined,
      bio: typeof b.bio === "string" ? b.bio : undefined,
    });
    return ok(res, { ok: true, client }, 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "create_failed";
    if (msg === "invalid_email") return err(res, "invalid_email", "Email is invalid", 400);
    if (msg === "invalid_full_name") return err(res, "invalid_request", "Full name is required", 400);
    if (msg === "email_in_use") return err(res, "conflict", "Email already in use", 409);
    if (msg === "invalid_plan") return err(res, "invalid_request", "Invalid plan", 400);
    return err(res, "invalid_request", msg, 400);
  }
});

app.patch("/api/admin/clients/:userId", (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const patch: Parameters<typeof store.updateAdminClient>[1] = {};
  if (typeof b.full_name === "string") patch.full_name = b.full_name;
  if (
    b.plan === "starter" ||
    b.plan === "pro" ||
    b.plan === "business" ||
    b.plan === "enterprise"
  ) {
    patch.plan = b.plan;
  }
  if (typeof b.email_verified === "boolean") patch.email_verified = b.email_verified;
  if (typeof b.phone === "string") patch.phone = b.phone;
  if (typeof b.location === "string") patch.location = b.location;
  if (typeof b.website === "string") patch.website = b.website;
  if (typeof b.bio === "string") patch.bio = b.bio;

  try {
    const client = store.updateAdminClient(req.params.userId, patch);
    return ok(res, { ok: true, client });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "update_failed";
    if (msg === "not_found") return err(res, "not_found", "Client not found", 404);
    return err(res, "invalid_request", msg, 400);
  }
});

app.delete("/api/admin/clients/:userId", (req, res) => {
  const removed = store.deleteAdminClient(req.params.userId);
  if (!removed) return err(res, "not_found", "Client not found", 404);
  return ok(res, { ok: true });
});

app.post("/api/admin/clients/:userId/impersonate", (req, res) => {
  const user = store.findUserById(req.params.userId);
  if (!user) return err(res, "not_found", "Client not found", 404);
  
  // Generate an impersonation token (same as regular auth but logged)
  log("info", "admin_impersonate", {
    admin_user: optionalUser(req)?.email ?? "admin-key",
    target_user: user.email,
    target_user_id: user.id,
  });
  
  return ok(res, authResponse(user));
});

// --- Billing ---

app.get('/api/billing/plans', (req, res) => {
  res.json({ plans: BILLING_PLANS });
});

app.post('/api/billing/checkout', async (req, res) => {
  try {
    const { client_id, plan_id, interval } = req.body;
    if (!client_id || !plan_id || !interval) {
      return err(res, 'invalid_request', 'client_id, plan_id, and interval are required', 400);
    }
    if (interval !== 'monthly' && interval !== 'yearly') {
      return err(res, 'invalid_request', 'interval must be "monthly" or "yearly"', 400);
    }
    const url = await createCheckoutSession(client_id, plan_id, interval);
    res.json({ url });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Checkout failed';
    res.status(500).json({ error: msg });
  }
});

app.post('/api/billing/cancel', async (req, res) => {
  try {
    const { subscription_id } = req.body;
    if (!subscription_id) {
      return err(res, 'invalid_request', 'subscription_id is required', 400);
    }
    await cancelSubscription(subscription_id);
    res.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Cancellation failed';
    res.status(500).json({ error: msg });
  }
});

app.get('/api/billing/subscription/:clientId', async (req, res) => {
  try {
    const sub = await getSubscriptionDetails(req.params.clientId);
    res.json(sub);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch subscription';
    res.status(500).json({ error: msg });
  }
});

// --- Auth ---

// Apply auth rate limiting to authentication routes
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/auth/reset-password", authLimiter);

// Apply API rate limiting to general API routes (excluding events)
app.use("/api/apps", apiLimiter);
app.use("/api/campaigns", apiLimiter);
app.use("/api/api-keys", apiLimiter);
app.use("/api/builds", apiLimiter);
app.use("/api/admin", apiLimiter);

// Public SDK API routes (for Android app developers)
app.use("/api/v1", publicSdkRoutes);

// Apply event rate limiting
app.use("/api/events", eventLimiter);
app.use("/sdk/event", eventLimiter);

app.post("/api/auth/register", (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const password = typeof b.password === "string" ? b.password : "";
  const fullName = typeof b.full_name === "string" ? b.full_name.trim() : "";
  if (!EMAIL_RE.test(email)) return err(res, "invalid_email", "Email is invalid", 400);
  if (password.length < 8) {
    return err(res, "invalid_password", "Password must be at least 8 characters", 400);
  }
  if (!fullName) return err(res, "invalid_full_name", "Full name is required", 400);
  if (store.findUserByEmail(email)) {
    return err(res, "conflict", "An account with that email already exists", 409);
  }
  try {
    const user = store.createUser({ email, password, full_name: fullName });
    const token = randomBytes(16).toString("hex");
    store.updateUser(user.id, { email_verification_token: token });
    if (isResendConfigured()) {
      void sendResendEmail(buildVerifyEmail(user.email, token)).catch((e) => {
        log("error", "email_send_failed", { kind: "verify", email: user.email, message: e instanceof Error ? e.message : String(e) });
      });
    }
    return ok(res, authResponse(user));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "register_failed";
    if (msg === "email_in_use") return err(res, "conflict", "Email in use", 409);
    return err(res, "invalid_request", msg, 400);
  }
});

app.post("/api/auth/login", (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const password = typeof b.password === "string" ? b.password : "";
  const user = email ? store.findUserByEmail(email) : undefined;
  if (!user || !verifyPassword(password, user.password_hash, user.password_salt)) {
    return err(res, "invalid_credentials", "Email or password is incorrect", 401);
  }
  return ok(res, authResponse(user));
});

app.post("/api/auth/google", (req, res) => {
  void (async () => {
    if (!isFirebaseAdminConfigured()) {
      return err(
        res,
        "service_unavailable",
        "Google sign-in is not configured on this server (Firebase Admin credentials missing)",
        503,
      );
    }

    const b = (req.body ?? {}) as Record<string, unknown>;
    const idToken = typeof b.id_token === "string" ? b.id_token.trim() : "";
    if (!idToken) return err(res, "invalid_request", "id_token is required", 400);

    const decoded = await verifyFirebaseIdToken(idToken);
    if (!decoded) {
      return err(res, "invalid_token", "Invalid or expired Firebase ID token", 401);
    }

    const provider = decoded.firebase?.sign_in_provider;
    if (provider !== "google.com") {
      return err(
        res,
        "invalid_provider",
        "Only Google sign-in is supported for this endpoint",
        403,
      );
    }

    const email =
      typeof decoded.email === "string" ? decoded.email.trim().toLowerCase() : "";
    if (!email || !EMAIL_RE.test(email)) {
      return err(res, "invalid_email", "Your Google account must have an email address", 400);
    }
    if (!decoded.email_verified) {
      return err(
        res,
        "unverified_email",
        "Verify your email with Google before signing in",
        403,
      );
    }

    const uid = decoded.uid;
    let user = store.findUserByGoogleUid(uid);
    if (user) {
      return ok(res, authResponse(user));
    }

    const existing = store.findUserByEmail(email);
    if (existing) {
      if (existing.google_uid && existing.google_uid !== uid) {
        return err(
          res,
          "conflict",
          "This email is already linked to a different Google account",
          409,
        );
      }
      try {
        store.updateUser(existing.id, {
          google_uid: uid,
          email_verified: true,
          email_verification_token: undefined,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "link_failed";
        if (msg === "google_uid_in_use") {
          return err(res, "conflict", "That Google account is already in use", 409);
        }
        throw e;
      }
      user = store.findUserById(existing.id);
      if (!user) return err(res, "internal_error", "User not found after link", 500);
      return ok(res, authResponse(user));
    }

    const fullName =
      typeof decoded.name === "string" && decoded.name.trim()
        ? decoded.name.trim()
        : email.split("@")[0]!;

    try {
      user = store.createUserFromGoogle({
        email,
        full_name: fullName,
        google_uid: uid,
        email_verified: true,
      });
      return ok(res, authResponse(user));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "register_failed";
      if (msg === "email_in_use") {
        return err(res, "conflict", "An account with that email already exists", 409);
      }
      if (msg === "google_uid_in_use") {
        return err(res, "conflict", "That Google account is already in use", 409);
      }
      log("error", "google_register_failed", { message: msg });
      return err(res, "invalid_request", msg, 400);
    }
  })().catch((e) => {
    log("error", "auth_google_unhandled", {
      message: e instanceof Error ? e.message : String(e),
    });
    err(res, "internal_error", "Google sign-in failed", 500);
  });
});

app.post("/api/auth/logout", (_req, res) => {
  // Stateless tokens — logout is a client-side concern.
  return ok(res, { ok: true });
});

app.post("/api/auth/forgot-password", (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const message = "If that email is registered, a reset link has been sent.";
  if (EMAIL_RE.test(email)) {
    const user = store.findUserByEmail(email);
    if (user) {
      const token = randomBytes(24).toString("hex");
      const exp = Date.now() + 60 * 60 * 1000;
      store.updateUser(user.id, { reset_token: token, reset_token_exp: exp });
      log("info", "auth_reset_issued", { email: user.email });
      if (isResendConfigured()) {
        void sendResendEmail(buildResetPasswordEmail(user.email, token)).catch((e) => {
          log("error", "email_send_failed", { kind: "reset", email: user.email, message: e instanceof Error ? e.message : String(e) });
        });
      }
    }
  }
  return ok(res, { ok: true, message });
});

app.post("/api/auth/reset-password", (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const token = typeof b.token === "string" ? b.token : "";
  const password = typeof b.password === "string" ? b.password : "";
  if (password.length < 8) {
    return err(res, "invalid_password", "Password must be at least 8 characters", 400);
  }
  const user = store.findUserByResetToken(token);
  if (!user) return err(res, "invalid_token", "Reset token is invalid or expired", 400);
  const { hash, salt } = hashPassword(password);
  store.updateUser(user.id, {
    password_hash: hash,
    password_salt: salt,
    reset_token: undefined,
    reset_token_exp: undefined,
  });
  return ok(res, authResponse(user));
});

app.post("/api/auth/verify-email", (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const token = typeof b.token === "string" ? b.token : "";
  const user = store.findUserByVerificationToken(token);
  if (!user) return err(res, "invalid_token", "Verification token is invalid", 400);
  store.updateUser(user.id, {
    email_verified: true,
    email_verification_token: undefined,
  });
  store.touchUserLastSeen(user.id);
  const verified = store.findUserById(user.id)!;
  return ok(res, { ok: true, user: store.publicUser(verified) });
});

app.post("/api/auth/resend-verification", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return undefined;
  const token = randomBytes(16).toString("hex");
  store.updateUser(user.id, { email_verification_token: token });
  log("info", "auth_verification_issued", { email: user.email });
  if (isResendConfigured()) {
    void sendResendEmail(buildVerifyEmail(user.email, token)).catch((e) => {
      log("error", "email_send_failed", { kind: "verify", email: user.email, message: e instanceof Error ? e.message : String(e) });
    });
  }
  return ok(res, { ok: true });
});

app.get("/api/auth/me", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return undefined;
  store.touchUserLastSeen(user.id);
  const fresh = store.findUserById(user.id)!;
  return ok(res, { ok: true, user: store.publicUser(fresh) });
});

// --- Customer-scoped data ---

app.get("/api/me/apps", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return undefined;
  return ok(res, { ok: true, apps: store.listUserApps(user.id) });
});

app.get("/api/me/builds", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return undefined;
  const builds = store.listUserBuilds(user.id);
  return ok(res, { ok: true, builds });
});

app.get("/api/me/builds/:id", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return undefined;
  const build = store.getBuildById(req.params.id);
  if (!build || build.user_id !== user.id) {
    return err(res, "not_found", "Build not found", 404);
  }
  return ok(res, { ok: true, build });
});

app.post("/api/me/push-tokens", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return undefined;
  const b = (req.body ?? {}) as Record<string, unknown>;
  const token = typeof b.token === "string" ? b.token : "";
  if (!token.trim()) return err(res, "invalid_request", "token is required", 400);
  store.addUserPushToken(user.id, token);
  return ok(res, { ok: true });
});

app.get("/api/me/cart", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return undefined;
  return ok(res, { ok: true, cart: store.getCart(user.id) });
});

app.post("/api/me/cart/items", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return undefined;
  const b = (req.body ?? {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name : "";
  const description = typeof b.description === "string" ? b.description : "";
  const price = typeof b.price === "number" ? b.price : Number(b.price);
  const quantity = b.quantity == null ? 1 : Number(b.quantity);
  if (!name.trim()) return err(res, "invalid_request", "name is required", 400);
  if (!Number.isFinite(price) || price < 0) {
    return err(res, "invalid_request", "price must be a non-negative number", 400);
  }
  const cart = store.addCartItem(user.id, { name, description, price, quantity });
  return ok(res, { ok: true, cart });
});

app.patch("/api/me/cart/items/:id", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return undefined;
  const b = (req.body ?? {}) as Record<string, unknown>;
  const quantity = Number(b.quantity);
  try {
    const cart = store.updateCartItem(user.id, req.params.id, quantity);
    return ok(res, { ok: true, cart });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "update_failed";
    if (msg === "not_found") return err(res, "not_found", "Cart item not found", 404);
    return err(res, "invalid_request", msg, 400);
  }
});

app.delete("/api/me/cart/items/:id", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return undefined;
  try {
    const cart = store.removeCartItem(user.id, req.params.id);
    return ok(res, { ok: true, cart });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "delete_failed";
    if (msg === "not_found") return err(res, "not_found", "Cart item not found", 404);
    return err(res, "invalid_request", msg, 400);
  }
});

app.post("/api/me/cart/promo", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return undefined;
  const b = (req.body ?? {}) as Record<string, unknown>;
  const code = typeof b.code === "string" ? b.code : "";
  try {
    const cart = store.applyPromo(user.id, code);
    return ok(res, { ok: true, cart });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "invalid_promo";
    return err(res, "invalid_promo", msg === "invalid_promo" ? "Promo code is not valid" : msg, 400);
  }
});

app.post("/api/me/checkout", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return undefined;
  try {
    const invoice = store.checkout(user.id);
    return ok(res, { ok: true, invoice });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "checkout_failed";
    if (msg === "empty_cart") return err(res, "empty_cart", "Cart is empty", 400);
    return err(res, "invalid_request", msg, 400);
  }
});

app.get("/api/me/subscriptions", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return undefined;
  return ok(res, { ok: true, subscriptions: store.listSubscriptions(user.id) });
});

app.get("/api/me/payments", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return undefined;
  return ok(res, { ok: true, payments: store.listPayments(user.id) });
});

app.get("/api/me/invoices", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return undefined;
  return ok(res, { ok: true, invoices: store.listInvoices(user.id) });
});

app.post("/api/me/profile", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return undefined;
  const b = (req.body ?? {}) as Record<string, unknown>;
  const patch: Partial<StoredUser> = {};
  for (const key of ["full_name", "phone", "location", "website", "bio"] as const) {
    const v = b[key];
    if (typeof v === "string") (patch as Record<string, unknown>)[key] = v;
  }
  if (typeof b.email === "string") patch.email = b.email;
  try {
    const updated = store.updateUser(user.id, patch);
    return ok(res, { ok: true, user: store.publicUser(updated) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "update_failed";
    if (msg === "email_in_use") return err(res, "conflict", "Email already in use", 409);
    if (msg === "invalid_email") return err(res, "invalid_email", "Email is invalid", 400);
    return err(res, "invalid_request", msg, 400);
  }
});

app.post("/api/me/password", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return undefined;
  const b = (req.body ?? {}) as Record<string, unknown>;
  const current = typeof b.current_password === "string" ? b.current_password : "";
  const next = typeof b.new_password === "string" ? b.new_password : "";
  if (!verifyPassword(current, user.password_hash, user.password_salt)) {
    return err(res, "invalid_password", "Current password is incorrect", 400);
  }
  if (next.length < 8) {
    return err(res, "invalid_password", "New password must be at least 8 characters", 400);
  }
  const { hash, salt } = hashPassword(next);
  store.updateUser(user.id, { password_hash: hash, password_salt: salt });
  return ok(res, { ok: true });
});

// --- Public builder bridge ---

type BuilderPayload = {
  website_url?: unknown;
  app_name?: unknown;
  package_name?: unknown;
  description?: unknown;
  primary_color?: unknown;
  accent_color?: unknown;
  splash_style?: unknown;
  orientation?: unknown;
  pull_to_refresh?: unknown;
  offline_mode?: unknown;
  push_notifications?: unknown;
  status_bar_style?: unknown;
  build_type?: unknown;
  version_code?: unknown;
  version_name?: unknown;
};

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function asBool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}
function asNumber(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toBuilderBuild(build: ApkBuild) {
  const cfg = build.config;
  return {
    build_id: build.id,
    app_name: cfg?.app_name ?? "",
    package_name: cfg?.package_name ?? "",
    webview_url: cfg?.start_url ?? "",
    version_name: build.version_name,
    version_code: build.version_code,
    filename: "source.zip",
    build_status: build.status,
    created_at: build.build_started_at,
    completed_at: build.build_completed_at ?? null,
    duration_ms: build.duration_ms ?? null,
    source_zip_url: build.source_zip_url ?? null,
    // APK artifact may be missing if the host doesn't have JDK + Gradle, or if
    // Gradle errored out. The source ZIP remains the deliverable in that case.
    apk_url: build.apk_url ?? null,
    apk_size_bytes: build.apk_size_bytes ?? null,
    apk_build_skipped: build.apk_build_skipped === true,
    apk_build_error: build.apk_build_error ?? null,
  };
}

// Hosts and address blocks we never want to package into a public WebView.
// Blocking these on the API stops drive-by abuse where someone tries to ship
// "open someone's local printer / RFC1918 device / cloud metadata" as a build.
const PRIVATE_HOST_RE =
  /^(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}|169\.254(?:\.\d{1,3}){2}|.*\.local|metadata\.google\.internal|169\.254\.169\.254)$/i;

function normalizeWebsiteUrlForBuild(raw: string): { url: string | null; reason?: string } {
  const v = raw.trim();
  if (!v) return { url: null, reason: "website_url is required" };
  const candidate = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { url: null, reason: "website_url must be a valid URL" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { url: null, reason: "website_url must be http(s)" };
  }
  if (!parsed.hostname.includes(".")) {
    return { url: null, reason: "website_url host looks invalid" };
  }
  if (PRIVATE_HOST_RE.test(parsed.hostname)) {
    return { url: null, reason: "private/loopback hosts are not allowed" };
  }
  // Strip credentials if present; keep search/hash; canonicalize.
  parsed.username = "";
  parsed.password = "";
  return { url: parsed.toString() };
}

app.post("/api/builder/builds", builderRateLimit, async (req, res) => {
  const user = optionalUser(req);
  const b = (req.body ?? {}) as BuilderPayload;

  const rawWebsiteUrl = asString(b.website_url);
  const appName = asString(b.app_name).trim();
  const packageName = asString(b.package_name).trim();
  const description = asString(b.description, "");
  const primary = asString(b.primary_color, "#CDFF3F");
  const accent = asString(b.accent_color, "#0B0F0E");
  const versionCode = Math.max(1, Math.floor(asNumber(b.version_code, 1)));
  const versionName = asString(b.version_name, "1.0.0").trim() || "1.0.0";

  const { url: websiteUrl, reason } = normalizeWebsiteUrlForBuild(rawWebsiteUrl);
  if (!websiteUrl) {
    return err(res, "invalid_request", reason ?? "website_url is invalid", 400);
  }
  if (!appName) return err(res, "invalid_request", "app_name is required", 400);
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i.test(packageName)) {
    return err(res, "invalid_request", "package_name must be a valid Java package", 400);
  }

  const config: WebViewBuildConfig = {
    app_name: appName,
    package_name: packageName,
    start_url: websiteUrl,
    primary_color: primary,
    background_color: accent,
    splash_color: primary,
    allow_file_uploads: true,
    allow_geolocation: false,
    allow_camera: false,
    pull_to_refresh: asBool(b.pull_to_refresh, true),
    swipe_back: true,
    offline_message: description || "You're offline. Reconnect to load this app.",
    release_notes: description || "",
  };

  let appId: string;
  if (user) {
    const app = await store.getOrCreatePublicBuilderApp(user.id);
    appId = app.id;
  } else {
    const placeholder = [...store.apps.values()].find((a) => a.name === "Public builder (anonymous)");
    appId = placeholder
      ? placeholder.id
      : (await store.createApp({
          name: "Public builder (anonymous)",
          package_name: "com.apkzio.publicbuilder",
          icon_glyph: "PB",
          icon_color: "from-zinc-500/20 to-zinc-500/5",
        })).id;
  }

  try {
    const build = await store.createBuild({
      app_id: appId,
      version_code: versionCode,
      version_name: versionName,
      release_notes: description,
      config,
      user_id: user?.id,
      triggered_by: user ? `user:${user.email}` : "public-builder",
    });
    buildRunner.startBuild(build.id);
    return ok(res, { ok: true, build: toBuilderBuild(build) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "create_failed";
    return err(res, "invalid_request", msg, 400);
  }
});

// Public read for unauthenticated polling. Build IDs are UUIDs (unguessable)
// and the response only echoes data the caller already submitted plus the
// resulting artifact URL — safe to expose without auth so the public builder
// can show "queued → building → success" and offer download buttons.
app.get("/api/builder/builds/:id", (req, res) => {
  const id = req.params.id;
  if (!/^[0-9a-f-]{8,64}$/i.test(id)) {
    return err(res, "invalid_request", "invalid build id", 400);
  }
  const build = store.getBuildById(id);
  if (!build) return err(res, "not_found", "Build not found", 404);
  return ok(res, { ok: true, build: toBuilderBuild(build) });
});

// --- Contact form ---

app.post("/api/contact", (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name : "";
  const email = typeof b.email === "string" ? b.email : "";
  const message = typeof b.message === "string" ? b.message : "";
  const subject = typeof b.subject === "string" ? b.subject : null;
  const topic = typeof b.topic === "string" ? b.topic : null;
  try {
    const row = store.recordContactMessage({ name, email, message, subject, topic });
    log("info", "contact_message_received", {
      email: row.email,
      topic: row.topic ?? "general",
      subject: row.subject ?? "(no subject)",
    });
    return ok(res, { ok: true, id: row.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "invalid_request";
    if (msg === "invalid_email") return err(res, "invalid_email", "Email is invalid", 400);
    if (msg === "invalid_name") return err(res, "invalid_request", "Name is required", 400);
    if (msg === "invalid_message") return err(res, "invalid_request", "Message is required", 400);
    return err(res, "invalid_request", msg, 400);
  }
});

// --- SDK & server-to-server (subset of production Edge API) ---

function extractAppKey(req: express.Request, body: Record<string, unknown>): string | null {
  const hex48 = (s: string) => /^pk_[a-fA-F0-9]{48}$/.test(s);
  const h = req.headers["x-pc-app-key"];
  if (typeof h === "string" && hex48(h)) return `pk_${h.slice(3).toLowerCase()}`;
  const b = body.app_key;
  if (typeof b === "string" && hex48(b)) return `pk_${b.slice(3).toLowerCase()}`;
  return null;
}

app.post("/sdk/init", (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const ak = extractAppKey(req, body);
    const row = store.sdkInit(body as never, ak);
    ok(res, { ok: true, ...row, heartbeat_interval_sec: row.heartbeat_interval_sec });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "invalid_app_key") return err(res, "invalid_app_key", "Unknown app key", 401);
    if (msg === "app_suspended") return err(res, "app_suspended", "App inactive", 403);
    err(res, "invalid_request", msg, 400);
  }
});

app.post("/sdk/register-device", (req, res) => {
  try {
    const row = store.registerDevice(req.body ?? {});
    ok(res, { ok: true, ...row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "not_found") return err(res, "not_found", "Device not found", 404);
    if (msg === "invalid_app_key") return err(res, "invalid_app_key", "Mismatch", 401);
    err(res, "invalid_request", msg, 400);
  }
});

app.post("/sdk/heartbeat", (req, res) => {
  store.heartbeat(req.body ?? {});
  ok(res, { ok: true });
});

// Event ingestion endpoint (single event)
app.post("/sdk/event", eventRateLimitMiddleware(), (req, res) => {
  try {
    const event = req.body as AnalyticsEvent;
    
    // Validate the event
    const validation = validateEvent(event);
    if (!validation.valid) {
      return res.status(400).json({
        ok: false,
        error: {
          code: "validation_failed",
          message: validation.error,
        },
      });
    }
    
    // Add to buffer
    eventBuffer.add(event);
    
    return res.json({ ok: true, accepted: 1, rejected: 0 });
  } catch (err) {
    console.error("[Event Ingestion] Error processing event:", err);
    return res.status(500).json({
      ok: false,
      error: {
        code: "internal_error",
        message: "Failed to process event",
      },
    });
  }
});

// Batch event ingestion endpoint
app.post("/api/events", eventRateLimitMiddleware(), (req, res) => {
  try {
    const batch = req.body as EventBatch;
    
    if (!batch || !Array.isArray(batch.events)) {
      return res.status(400).json({
        ok: false,
        error: {
          code: "invalid_request",
          message: "Request body must contain an 'events' array",
        },
      });
    }
    
    // Validate all events
    const errors: string[] = [];
    const validEvents: AnalyticsEvent[] = [];
    
    for (let i = 0; i < batch.events.length; i++) {
      const event = batch.events[i];
      const validation = validateEvent(event);
      
      if (validation.valid) {
        validEvents.push(event as AnalyticsEvent);
      } else {
        errors.push(`Event ${i}: ${validation.error}`);
      }
    }
    
    // If there are validation errors, return them
    if (errors.length > 0 && validEvents.length === 0) {
      return res.status(400).json({
        ok: false,
        error: {
          code: "validation_failed",
          message: "All events failed validation",
        },
        errors,
      });
    }
    
    // Deduplicate valid events
    const unique = deduplicateEvents(validEvents);
    
    // Add to buffer
    eventBuffer.addBatch(unique);
    
    return res.json({
      ok: true,
      accepted: unique.length,
      duplicates: validEvents.length - unique.length,
      rejected: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error("[Event Ingestion] Error processing batch:", err);
    return res.status(500).json({
      ok: false,
      error: {
        code: "internal_error",
        message: "Failed to process event batch",
      },
    });
  }
});

// Optimized bulk batch endpoint (for very large batches)
app.post("/api/events/batch", eventRateLimitMiddleware(), (req, res) => {
  try {
    const batch = req.body as EventBatch;
    
    if (!batch || !Array.isArray(batch.events)) {
      return res.status(400).json({
        ok: false,
        error: {
          code: "invalid_request",
          message: "Request body must contain an 'events' array",
        },
      });
    }
    
    // For large batches, we validate and process in chunks
    const chunkSize = 500;
    let totalAccepted = 0;
    let totalDuplicates = 0;
    let totalRejected = 0;
    const allErrors: string[] = [];
    
    for (let offset = 0; offset < batch.events.length; offset += chunkSize) {
      const chunk = batch.events.slice(offset, offset + chunkSize);
      const validEvents: AnalyticsEvent[] = [];
      
      for (let i = 0; i < chunk.length; i++) {
        const event = chunk[i];
        const validation = validateEvent(event);
        
        if (validation.valid) {
          validEvents.push(event as AnalyticsEvent);
        } else {
          totalRejected++;
          if (allErrors.length < 100) {
            allErrors.push(`Event ${offset + i}: ${validation.error}`);
          }
        }
      }
      
      const unique = deduplicateEvents(validEvents);
      totalAccepted += unique.length;
      totalDuplicates += validEvents.length - unique.length;
      
      eventBuffer.addBatch(unique);
    }
    
    return res.json({
      ok: true,
      accepted: totalAccepted,
      duplicates: totalDuplicates,
      rejected: totalRejected,
      errors: allErrors.length > 0 ? allErrors : undefined,
    });
  } catch (err) {
    console.error("[Event Ingestion] Error processing bulk batch:", err);
    return res.status(500).json({
      ok: false,
      error: {
        code: "internal_error",
        message: "Failed to process bulk batch",
      },
    });
  }
});

app.post("/push/track", (_req, res) => {
  ok(res, { ok: true });
});

app.post("/push/send", async (req, res) => {
  const auth = req.headers.authorization ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/);
  if (!m) return err(res, "missing_api_key", "Authorization: Bearer sk_… required", 401);
  const key = m[1]!;
  if (!store.validateServiceKey(key)) return err(res, "invalid_api_key", "Invalid key", 401);
  store.touchApiKey();

  const b = req.body ?? {};
  try {
    const targetType = (b.target?.type ?? "all") as "all" | "active" | "country" | "device_list";
    const appId = String(b.app_id);
    const title = String(b.title);
    const body = String(b.body);
    const scheduledAt = b.scheduled_at ?? null;
    const isScheduled = !!scheduledAt && +new Date(String(scheduledAt)) > Date.now();
    const tokens =
      !isScheduled && isFirebaseAdminConfigured()
        ? store.resolveFcmTokens(appId, {
            type: targetType,
            active_within_minutes: b.target?.active_within_minutes ?? b.active_window_min,
            country_codes: b.target?.country_codes ?? b.target_countries,
            device_ids: b.target?.device_ids ?? b.target_device_ids,
          })
        : [];
    const camp = await store.createCampaign({
      app_id: appId,
      title,
      body,
      image_url: b.image_url ?? null,
      click_url: b.click_action_url ?? b.click_url ?? null,
      target_type: targetType,
      active_within_minutes: b.target?.active_within_minutes ?? b.active_window_min,
      country_codes: b.target?.country_codes ?? b.target_countries,
      device_ids: b.target?.device_ids ?? b.target_device_ids,
      scheduled_at: scheduledAt,
    });
    if (!isScheduled && tokens.length > 0) {
      void sendFcmMulticast({
        tokens,
        title,
        body,
        data: { campaign_id: camp.id, app_id: appId, kind: "campaign" },
      }).catch(() => undefined);
    }
    return ok(res, { ok: true, notification_id: camp.id, status: "queued" }, 202);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "app_not_found") return err(res, "not_found", "App not found", 404);
    err(res, "invalid_request", msg, 400);
  }
});

// --- Team Management API ---
import { 
  inviteTeamMember, 
  acceptInvite, 
  removeTeamMember, 
  updateMemberRole,
  listTeamMembers 
} from './team/api.js';
import { loadUserRole, requirePermission } from './team/middleware.js';
import { isValidRole } from './team/roles.js';

// Public accept invite endpoint (no auth required)
app.post("/api/team/accept", async (req, res) => {
  try {
    const { token, email } = req.body;
    
    if (!token || !email) {
      return err(res, "invalid_request", "Missing token or email", 400);
    }
    
    const member = await acceptInvite(token, email);
    return ok(res, { ok: true, member });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "accept_failed";
    if (msg === "Invalid or expired invite token") {
      return err(res, "invalid_invite", msg, 400);
    }
    return err(res, "internal_error", "Failed to accept invite", 500);
  }
});

// Team management routes (require authentication)
app.use("/api/team", loadUserRole);

app.get("/api/team/members", requirePermission('team', 'invite'), async (req, res) => {
  try {
    const members = await listTeamMembers();
    return ok(res, { ok: true, members });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "list_failed";
    return err(res, "internal_error", msg, 500);
  }
});

app.post("/api/team/invite", requirePermission('team', 'invite'), async (req, res) => {
  try {
    const { email, role } = req.body;
    
    if (!email || !role) {
      return err(res, "invalid_request", "Missing email or role", 400);
    }
    
    if (!isValidRole(role)) {
      return err(res, "invalid_request", "Invalid role", 400);
    }
    
    const result = await inviteTeamMember(req.user!.email, email, role);
    return ok(res, { ok: true, ...result }, 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "invite_failed";
    if (msg === "User is already a team member") {
      return err(res, "conflict", msg, 409);
    }
    if (msg === "Inviter not found") {
      return err(res, "invalid_request", msg, 400);
    }
    return err(res, "internal_error", msg, 500);
  }
});

app.delete("/api/team/members/:id", requirePermission('team', 'remove'), async (req, res) => {
  try {
    await removeTeamMember(req.params.id);
    return ok(res, { ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "remove_failed";
    if (msg === "Member not found or already removed") {
      return err(res, "not_found", msg, 404);
    }
    return err(res, "internal_error", msg, 500);
  }
});

app.patch("/api/team/members/:id/role", requirePermission('team', 'manage'), async (req, res) => {
  try {
    const { role } = req.body;
    
    if (!role) {
      return err(res, "invalid_request", "Missing role", 400);
    }
    
    if (!isValidRole(role)) {
      return err(res, "invalid_request", "Invalid role", 400);
    }
    
    await updateMemberRole(req.params.id, role);
    return ok(res, { ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "update_failed";
    if (msg === "Member not found or not active") {
      return err(res, "not_found", msg, 404);
    }
    return err(res, "internal_error", msg, 500);
  }
});

// --- Webhooks API ---

app.get("/api/webhooks", async (req, res) => {
  try {
    const { rows } = await import("./db.js").then(m => m.query('SELECT * FROM webhook_endpoints ORDER BY created_at DESC'));
    res.json({ ok: true, webhooks: rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error";
    res.status(500).json({ ok: false, error: { code: "query_failed", message: msg } });
  }
});

app.post("/api/webhooks", async (req, res) => {
  try {
    const { url, events } = req.body ?? {};
    if (!url || typeof url !== "string" || !url.startsWith("http")) {
      return err(res, "invalid_request", "url must be a valid HTTP(S) URL", 400);
    }
    if (!Array.isArray(events) || events.length === 0) {
      return err(res, "invalid_request", "events array is required", 400);
    }
    
    const secret = randomBytes(32).toString("hex");
    const db = await import("./db.js");
    
    const { rows } = await db.query(`
      INSERT INTO webhook_endpoints (url, secret, events)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [url, secret, events]);
    
    res.json({ ok: true, webhook: rows[0] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error";
    res.status(500).json({ ok: false, error: { code: "create_failed", message: msg } });
  }
});

app.patch("/api/webhooks/:id", async (req, res) => {
  try {
    const { is_active } = req.body ?? {};
    if (typeof is_active !== "boolean") {
      return err(res, "invalid_request", "is_active boolean is required", 400);
    }
    
    const db = await import("./db.js");
    const { rows } = await db.query(`
      UPDATE webhook_endpoints 
      SET is_active = $1
      WHERE id = $2
      RETURNING *
    `, [is_active, req.params.id]);
    
    if (rows.length === 0) {
      return err(res, "not_found", "Webhook not found", 404);
    }
    
    res.json({ ok: true, webhook: rows[0] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error";
    res.status(500).json({ ok: false, error: { code: "update_failed", message: msg } });
  }
});

app.delete("/api/webhooks/:id", async (req, res) => {
  try {
    const db = await import("./db.js");
    const { rowCount } = await db.query('DELETE FROM webhook_endpoints WHERE id = $1', [req.params.id]);
    
    if (rowCount === 0) {
      return err(res, "not_found", "Webhook not found", 404);
    }
    
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error";
    res.status(500).json({ ok: false, error: { code: "delete_failed", message: msg } });
  }
});

app.get("/api/webhooks/:id/deliveries", async (req, res) => {
  try {
    const db = await import("./db.js");
    const { rows } = await db.query(`
      SELECT * FROM webhook_deliveries
      WHERE endpoint_id = $1
      ORDER BY created_at DESC
      LIMIT 100
    `, [req.params.id]);
    
    res.json({ ok: true, deliveries: rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error";
    res.status(500).json({ ok: false, error: { code: "query_failed", message: msg } });
  }
});

// Sentry error handler (must be last, after all routes)
app.use(sentryErrorHandler());

// Start webhook worker
void import("./webhooks/delivery-worker.js").then(m => {
  m.webhookWorker.start();
}).catch(err => {
  log("error", "webhook_worker_start_failed", { message: err instanceof Error ? err.message : String(err) });
});

const server = app.listen(PORT, () => {
  log("info", "server_listening", { port: PORT, enforce_admin_auth: ENFORCE_ADMIN_AUTH });
  log("info", "service_key_loaded", { key_preview: `${DEMO_SERVICE_KEY.slice(0, 12)}...` });
  
  // Start analytics aggregator
  // Only start aggregator if using database mode
  if (USE_DATABASE) {
    aggregator.start();
  } else {
    console.log('📊 Analytics Aggregator skipped (in-memory mode)');
  }
});

async function shutdown(signal: string) {
  log("info", "shutdown_start", { signal });
  
  // Stop aggregator first
  aggregator.stop();
  
  // Flush event buffer before closing
  log("info", "flushing_event_buffer", { buffer_size: eventBuffer.getBufferSize() });
  await eventBuffer.stop();
  
  // Stop webhook worker
  try {
    const { webhookWorker } = await import("./webhooks/delivery-worker.js");
    webhookWorker.stop();
  } catch (err) {
    log("error", "webhook_worker_stop_failed", { message: err instanceof Error ? err.message : String(err) });
  }
  
  await new Promise<void>((resolve) => server.close(() => resolve()));
  log("info", "shutdown_complete", { signal });
  process.exit(0);
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
