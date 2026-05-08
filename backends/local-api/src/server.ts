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

const _serverFileDir = path.dirname(fileURLToPath(import.meta.url));
/** Repo `backends/.env` then package `local-api/.env` (second wins). Works for `tsx src/server.ts` and `node dist/server.js`. */
dotenv.config({ path: path.resolve(_serverFileDir, "../../.env") });
dotenv.config({ path: path.resolve(_serverFileDir, "../.env") });

const PORT = Number(process.env.PORT ?? 8787);
const DEMO_SERVICE_KEY = process.env.APKZIO_SERVICE_KEY ?? "sk_live_demo_apkzio_local";
const ENFORCE_ADMIN_AUTH =
  (process.env.ENFORCE_ADMIN_AUTH ?? (process.env.NODE_ENV === "production" ? "1" : "0")) === "1";
const ADMIN_API_KEY = process.env.APKZIO_ADMIN_API_KEY ?? DEMO_SERVICE_KEY;

const store = new ApkZioStore(DEMO_SERVICE_KEY);
const buildRunner = new BuildRunner(store);

const builderRateLimit = createBuilderRateLimitMiddleware();

/** Source tree for the distributable WordPress plugin (sibling of `src/` / `dist/`). */
const WP_PLUGIN_SRC_DIR = path.resolve(_serverFileDir, "..", "wordpress-plugin", "apkzio-telemetry");
const app = express();

if ((process.env.APKZIO_TRUST_PROXY ?? "").trim() === "1") {
  app.set("trust proxy", 1);
}

app.use(
  cors({
    origin: true,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "X-Apkzio-Admin-Key",
      "x-apkzio-admin-key",
    ],
  }),
);
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

app.get("/api/apps", (_req, res) => {
  ok(res, { ok: true, apps: store.listApps() });
});

app.get("/api/apps/:appId", (req, res) => {
  const appRow = store.apps.get(req.params.appId);
  if (!appRow) return err(res, "not_found", "App not found", 404);
  ok(res, { ok: true, app: appRow });
});

app.post("/api/apps", (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  try {
    const created = store.createApp({
      name: typeof b.name === "string" ? b.name : "",
      package_name: typeof b.package_name === "string" ? b.package_name : "",
      fcm_project_id: typeof b.fcm_project_id === "string" ? b.fcm_project_id : null,
      icon_glyph: typeof b.icon_glyph === "string" ? b.icon_glyph : undefined,
      icon_color: typeof b.icon_color === "string" ? b.icon_color : undefined,
    });
    return ok(res, { ok: true, app: created });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "create_failed";
    if (msg === "name_required" || msg === "package_name_required") {
      return err(res, "invalid_request", msg, 400);
    }
    return err(res, "invalid_request", msg, 400);
  }
});

app.patch("/api/apps/:appId", (req, res) => {
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

app.delete("/api/apps/:appId", (req, res) => {
  const removed = store.deleteApp(req.params.appId);
  if (!removed) return err(res, "not_found", "App not found", 404);
  return ok(res, { ok: true });
});

app.get("/api/apps/:appId/devices", (req, res) => {
  ok(res, { ok: true, devices: store.getDevicesForApp(req.params.appId) });
});

app.get("/api/apps/:appId/subscribers", (req, res) => {
  ok(res, { ok: true, subscribers: store.getSubscribersForApp(req.params.appId) });
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

app.post("/api/campaigns", (req, res) => {
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

    const camp = store.createCampaign({
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

app.post("/api/campaigns/:id/send", (req, res) => {
  try {
    const c = store.sendDraftCampaign(req.params.id);
    ok(res, { ok: true, campaign: c });
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

app.get("/api/api-keys", (_req, res) => ok(res, { ok: true, api_keys: store.apiKeys }));

app.post("/api/api-keys", (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  try {
    const result = store.createApiKey({
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
app.post("/api/builds", (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  try {
    const config = parseWebViewConfig(b);
    const build = store.createBuild({
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

app.get("/api/analytics/overview", (req, res) => {
  const seed = typeof req.query.seed === "string" ? req.query.seed : "global";
  ok(res, { ok: true, ...store.analyticsOverview(seed) });
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

// --- Auth ---

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

app.post("/api/builder/builds", builderRateLimit, (req, res) => {
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
    appId = store.getOrCreatePublicBuilderApp(user.id).id;
  } else {
    const placeholder = [...store.apps.values()].find((a) => a.name === "Public builder (anonymous)");
    appId = placeholder
      ? placeholder.id
      : store.createApp({
          name: "Public builder (anonymous)",
          package_name: "com.apkzio.publicbuilder",
          icon_glyph: "PB",
          icon_color: "from-zinc-500/20 to-zinc-500/5",
        }).id;
  }

  try {
    const build = store.createBuild({
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

app.post("/sdk/event", (_req, res) => {
  ok(res, { ok: true, accepted: 1, rejected: 0 });
});

app.post("/push/track", (_req, res) => {
  ok(res, { ok: true });
});

app.post("/push/send", (req, res) => {
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
    const camp = store.createCampaign({
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

const server = app.listen(PORT, () => {
  log("info", "server_listening", { port: PORT, enforce_admin_auth: ENFORCE_ADMIN_AUTH });
  log("info", "service_key_loaded", { key_preview: `${DEMO_SERVICE_KEY.slice(0, 12)}...` });
});

async function shutdown(signal: string) {
  log("info", "shutdown_start", { signal });
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
