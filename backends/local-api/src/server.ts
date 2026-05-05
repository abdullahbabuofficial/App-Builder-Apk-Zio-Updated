import express from "express";
import cors from "cors";
import { pathToFileURL } from "node:url";
import { PushCareStore } from "./store.js";

const PORT = Number(process.env.PORT ?? 8787);
const DEMO_SERVICE_KEY = process.env.PUSHCARE_SERVICE_KEY ?? "sk_live_demo_pushcare_local";

export const store = new PushCareStore(DEMO_SERVICE_KEY);
export const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

function ok(res: express.Response, body: unknown, status = 200) {
  res.status(status).json(body);
}

function err(res: express.Response, code: string, message: string, status: number) {
  res.status(status).json({ ok: false, error: { code, message } });
}

// --- Dashboard REST (used by pushcare-admin when VITE_PUSHCARE_API_URL is set) ---

app.get("/health", (_req, res) => ok(res, { ok: true, service: "pushcare-local-api" }));

app.get("/api/apps", (_req, res) => {
  ok(res, { ok: true, apps: store.listApps() });
});

app.get("/api/apps/:appId", (req, res) => {
  const appRow = store.apps.get(req.params.appId);
  if (!appRow) return err(res, "not_found", "App not found", 404);
  ok(res, { ok: true, app: appRow });
});

app.get("/api/apps/:appId/devices", (req, res) => {
  ok(res, { ok: true, devices: store.getDevicesForApp(req.params.appId) });
});

app.get("/api/apps/:appId/subscribers", (req, res) => {
  ok(res, { ok: true, subscribers: store.getSubscribersForApp(req.params.appId) });
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
    const camp = store.createCampaign({
      app_id: String(b.app_id),
      title: String(b.title),
      body: String(b.body),
      image_url: b.image_url ?? null,
      click_url: b.click_url ?? null,
      target_type: b.target_type,
      active_within_minutes: b.active_within_minutes,
      country_codes: b.country_codes,
      device_ids: b.device_ids,
      scheduled_at: b.scheduled_at ?? null,
    });
    ok(res, { ok: true, campaign: camp });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "create_failed";
    if (msg === "app_not_found") return err(res, "not_found", "App not found", 404);
    err(res, "invalid_request", msg, 400);
  }
});

app.get("/api/api-keys", (_req, res) => ok(res, { ok: true, api_keys: store.apiKeys }));

app.get("/api/builds", (_req, res) => ok(res, { ok: true, builds: store.builds }));

app.get("/api/analytics/overview", (req, res) => {
  const seed = typeof req.query.seed === "string" ? req.query.seed : "global";
  ok(res, { ok: true, ...store.analyticsOverview(seed) });
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
    const camp = store.createCampaign({
      app_id: String(b.app_id),
      title: String(b.title),
      body: String(b.body),
      image_url: b.image_url ?? null,
      click_url: b.click_action_url ?? b.click_url ?? null,
      target_type: targetType,
      active_within_minutes: b.target?.active_within_minutes ?? b.active_window_min,
      country_codes: b.target?.country_codes ?? b.target_countries,
      device_ids: b.target?.device_ids ?? b.target_device_ids,
      scheduled_at: b.scheduled_at ?? null,
    });
    return ok(res, { ok: true, notification_id: camp.id, status: "queued" }, 202);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "app_not_found") return err(res, "not_found", "App not found", 404);
    err(res, "invalid_request", msg, 400);
  }
});

// Only start the HTTP listener when invoked directly (not under tests).
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  app.listen(PORT, () => {
    console.log(`PushCare local-api listening on http://localhost:${PORT}`);
    console.log(`Demo service key: ${DEMO_SERVICE_KEY}`);
  });
}
