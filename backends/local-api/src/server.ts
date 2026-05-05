import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import { PushCareStore, type AuthSession, type MemberRole } from "./store.js";

const PORT = Number(process.env.PORT ?? 8787);
const DEMO_SERVICE_KEY = process.env.PUSHCARE_SERVICE_KEY ?? "sk_live_demo_pushcare_local";

const store = new PushCareStore(DEMO_SERVICE_KEY);
const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

function ok(res: express.Response, body: unknown, status = 200) {
  res.status(status).json(body);
}

function err(res: express.Response, code: string, message: string, status: number) {
  res.status(status).json({ ok: false, error: { code, message } });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(s: unknown): s is string {
  return typeof s === "string" && UUID_RE.test(s);
}

function requireAuth(req: express.Request, res: express.Response): AuthSession | null {
  const m = (req.headers.authorization ?? "").match(/^Bearer\s+(.+)$/);
  if (!m) { err(res, "missing_token", "Authorization required", 401); return null; }
  const sess = store.validateSession(m[1]!);
  if (!sess) { err(res, "invalid_token", "Token invalid or expired", 401); return null; }
  return sess;
}

function clientIp(req: express.Request): string | null {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0]!.trim();
  return req.socket.remoteAddress ?? null;
}

function clientUa(req: express.Request): string | null {
  const ua = req.headers["user-agent"];
  return typeof ua === "string" ? ua : null;
}

const VALID_ROLES: MemberRole[] = ["owner", "admin", "developer", "viewer", "service"];

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

// --- Auth ---

app.post("/api/auth/signup", (req, res) => {
  try {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
    const displayName = typeof b.display_name === "string" && b.display_name ? b.display_name : (email.split("@")[0] ?? "user");
    if (!email || !email.includes("@")) return err(res, "invalid_request", "Valid email required", 400);
    if (typeof b.password !== "string" || b.password.length < 1) return err(res, "invalid_request", "Password required", 400);

    let member = [...store.members.values()].find((m) => m.email.toLowerCase() === email);
    if (!member) {
      const id = crypto.randomUUID();
      member = {
        id,
        user_id: id,
        email,
        display_name: displayName,
        role: "owner",
        invited_by: null,
        accepted_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      store.members.set(member.id, member);
      store.recordAudit({
        actor_email: email,
        action: "auth.signup",
        target_type: "member",
        target_id: member.id,
        details: { display_name: displayName },
        ip: clientIp(req),
        user_agent: clientUa(req),
      });
    }
    const session = store.createSession(member.email, member.display_name);
    ok(res, { ok: true, session, member });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "signup_failed";
    err(res, "invalid_request", msg, 400);
  }
});

app.post("/api/auth/login", (req, res) => {
  try {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
    if (!email) return err(res, "invalid_request", "Email required", 400);
    const member = [...store.members.values()].find((m) => m.email.toLowerCase() === email);
    if (!member) return err(res, "not_found", "Unknown email", 404);
    const session = store.createSession(member.email, member.display_name);
    store.recordAudit({
      actor_email: member.email,
      action: "auth.login",
      target_type: "member",
      target_id: member.id,
      details: {},
      ip: clientIp(req),
      user_agent: clientUa(req),
    });
    ok(res, { ok: true, session, member });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "login_failed";
    err(res, "invalid_request", msg, 400);
  }
});

app.post("/api/auth/logout", (req, res) => {
  const m = (req.headers.authorization ?? "").match(/^Bearer\s+(.+)$/);
  if (m) store.sessions.delete(m[1]!);
  ok(res, { ok: true });
});

app.get("/api/auth/me", (req, res) => {
  const sess = requireAuth(req, res);
  if (!sess) return;
  const member = [...store.members.values()].find((mm) => mm.email.toLowerCase() === sess.email.toLowerCase()) ?? null;
  ok(res, { ok: true, session: sess, member });
});

// --- Segments ---

app.get("/api/segments", (req, res) => {
  if (!requireAuth(req, res)) return;
  const appId = typeof req.query.app_id === "string" ? req.query.app_id : null;
  let rows = [...store.segments.values()];
  if (appId) rows = rows.filter((s) => s.app_id === appId);
  rows.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  ok(res, { ok: true, segments: rows });
});

app.post("/api/segments", (req, res) => {
  const sess = requireAuth(req, res);
  if (!sess) return;
  try {
    const b = (req.body ?? {}) as Record<string, unknown>;
    if (!isUuid(b.app_id)) return err(res, "invalid_request", "app_id must be a UUID", 400);
    if (!store.apps.has(b.app_id)) return err(res, "not_found", "App not found", 404);
    if (typeof b.name !== "string" || !b.name.trim()) return err(res, "invalid_request", "name required", 400);
    const appRow = store.apps.get(b.app_id)!;
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const rules = (b.rules && typeof b.rules === "object") ? (b.rules as Record<string, unknown>) : {};
    const seg = {
      id,
      app_id: appRow.id,
      name: b.name.trim(),
      description: typeof b.description === "string" ? b.description : null,
      rules,
      estimated_size: Math.floor(appRow.active_devices_24h * 0.1),
      last_evaluated_at: now,
      created_at: now,
      updated_at: now,
    };
    store.segments.set(id, seg);
    store.recordAudit({
      actor_email: sess.email,
      action: "segment.created",
      target_type: "segment",
      target_id: id,
      details: { name: seg.name, app_id: seg.app_id },
      ip: clientIp(req),
      user_agent: clientUa(req),
    });
    ok(res, { ok: true, segment: seg }, 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "create_failed";
    err(res, "invalid_request", msg, 400);
  }
});

app.patch("/api/segments/:id", (req, res) => {
  const sess = requireAuth(req, res);
  if (!sess) return;
  try {
    if (!isUuid(req.params.id)) return err(res, "invalid_request", "id must be a UUID", 400);
    const seg = store.segments.get(req.params.id);
    if (!seg) return err(res, "not_found", "Segment not found", 404);
    const b = (req.body ?? {}) as Record<string, unknown>;
    if (typeof b.name === "string" && b.name.trim()) seg.name = b.name.trim();
    if (typeof b.description === "string" || b.description === null) seg.description = (b.description as string | null) ?? null;
    if (b.rules && typeof b.rules === "object") seg.rules = b.rules as Record<string, unknown>;
    seg.updated_at = new Date().toISOString();
    store.recordAudit({
      actor_email: sess.email,
      action: "segment.updated",
      target_type: "segment",
      target_id: seg.id,
      details: {},
      ip: clientIp(req),
      user_agent: clientUa(req),
    });
    ok(res, { ok: true, segment: seg });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "update_failed";
    err(res, "invalid_request", msg, 400);
  }
});

app.delete("/api/segments/:id", (req, res) => {
  const sess = requireAuth(req, res);
  if (!sess) return;
  if (!isUuid(req.params.id)) return err(res, "invalid_request", "id must be a UUID", 400);
  const existed = store.segments.delete(req.params.id);
  if (!existed) return err(res, "not_found", "Segment not found", 404);
  store.recordAudit({
    actor_email: sess.email,
    action: "segment.deleted",
    target_type: "segment",
    target_id: req.params.id,
    details: {},
    ip: clientIp(req),
    user_agent: clientUa(req),
  });
  ok(res, { ok: true });
});

app.post("/api/segments/:id/evaluate", (req, res) => {
  const sess = requireAuth(req, res);
  if (!sess) return;
  if (!isUuid(req.params.id)) return err(res, "invalid_request", "id must be a UUID", 400);
  const seg = store.segments.get(req.params.id);
  if (!seg) return err(res, "not_found", "Segment not found", 404);
  const appRow = store.apps.get(seg.app_id);
  const base = appRow ? appRow.active_devices_24h : 1000;
  // Random plausible 5–50% of active devices
  const ratio = 0.05 + Math.random() * 0.45;
  seg.estimated_size = Math.max(1, Math.floor(base * ratio));
  seg.last_evaluated_at = new Date().toISOString();
  seg.updated_at = seg.last_evaluated_at;
  store.recordAudit({
    actor_email: sess.email,
    action: "segment.evaluated",
    target_type: "segment",
    target_id: seg.id,
    details: { estimated_size: seg.estimated_size },
    ip: clientIp(req),
    user_agent: clientUa(req),
  });
  ok(res, { ok: true, estimated_size: seg.estimated_size, last_evaluated_at: seg.last_evaluated_at });
});

// --- Team / Members / Invites ---

app.get("/api/members", (req, res) => {
  if (!requireAuth(req, res)) return;
  const rows = [...store.members.values()].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  ok(res, { ok: true, members: rows });
});

app.post("/api/members/invite", (req, res) => {
  const sess = requireAuth(req, res);
  if (!sess) return;
  try {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
    if (!email || !email.includes("@")) return err(res, "invalid_request", "Valid email required", 400);
    const role = typeof b.role === "string" ? (b.role as MemberRole) : "viewer";
    if (!VALID_ROLES.includes(role)) return err(res, "invalid_request", "Invalid role", 400);
    const id = crypto.randomUUID();
    const now = new Date();
    const invite = {
      id,
      email,
      role,
      token: `inv_${crypto.randomBytes(16).toString("hex")}`,
      invited_by: sess.user_id,
      expires_at: new Date(now.getTime() + 7 * 86400_000).toISOString(),
      accepted_at: null,
      created_at: now.toISOString(),
    };
    store.invites.set(id, invite);
    store.recordAudit({
      actor_email: sess.email,
      action: "member.invited",
      target_type: "invite",
      target_id: id,
      details: { email, role },
      ip: clientIp(req),
      user_agent: clientUa(req),
    });
    ok(res, { ok: true, invite }, 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "invite_failed";
    err(res, "invalid_request", msg, 400);
  }
});

app.delete("/api/members/:id", (req, res) => {
  const sess = requireAuth(req, res);
  if (!sess) return;
  if (!isUuid(req.params.id)) return err(res, "invalid_request", "id must be a UUID", 400);
  const member = store.members.get(req.params.id);
  if (!member) return err(res, "not_found", "Member not found", 404);
  if (member.role === "owner") return err(res, "forbidden", "Cannot remove the owner", 403);
  store.members.delete(req.params.id);
  store.recordAudit({
    actor_email: sess.email,
    action: "member.removed",
    target_type: "member",
    target_id: req.params.id,
    details: { email: member.email },
    ip: clientIp(req),
    user_agent: clientUa(req),
  });
  ok(res, { ok: true });
});

app.patch("/api/members/:id/role", (req, res) => {
  const sess = requireAuth(req, res);
  if (!sess) return;
  if (!isUuid(req.params.id)) return err(res, "invalid_request", "id must be a UUID", 400);
  const member = store.members.get(req.params.id);
  if (!member) return err(res, "not_found", "Member not found", 404);
  const b = (req.body ?? {}) as Record<string, unknown>;
  const role = typeof b.role === "string" ? (b.role as MemberRole) : null;
  if (!role || !VALID_ROLES.includes(role)) return err(res, "invalid_request", "Invalid role", 400);
  const prev = member.role;
  member.role = role;
  store.recordAudit({
    actor_email: sess.email,
    action: "member.role_changed",
    target_type: "member",
    target_id: member.id,
    details: { from: prev, to: role },
    ip: clientIp(req),
    user_agent: clientUa(req),
  });
  ok(res, { ok: true, member });
});

app.get("/api/invites", (req, res) => {
  if (!requireAuth(req, res)) return;
  const rows = [...store.invites.values()].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  ok(res, { ok: true, invites: rows });
});

app.delete("/api/invites/:id", (req, res) => {
  const sess = requireAuth(req, res);
  if (!sess) return;
  if (!isUuid(req.params.id)) return err(res, "invalid_request", "id must be a UUID", 400);
  const inv = store.invites.get(req.params.id);
  if (!inv) return err(res, "not_found", "Invite not found", 404);
  store.invites.delete(req.params.id);
  store.recordAudit({
    actor_email: sess.email,
    action: "invite.revoked",
    target_type: "invite",
    target_id: req.params.id,
    details: { email: inv.email },
    ip: clientIp(req),
    user_agent: clientUa(req),
  });
  ok(res, { ok: true });
});

app.post("/api/invites/:token/accept", (req, res) => {
  // No auth — acceptance happens via emailed token
  const tok = req.params.token;
  const inv = [...store.invites.values()].find((i) => i.token === tok);
  if (!inv) return err(res, "not_found", "Invite not found or already used", 404);
  if (inv.accepted_at) return err(res, "invalid_request", "Invite already accepted", 400);
  if (+new Date(inv.expires_at) <= Date.now()) return err(res, "expired", "Invite expired", 410);
  const now = new Date().toISOString();
  inv.accepted_at = now;
  const id = crypto.randomUUID();
  const member = {
    id,
    user_id: id,
    email: inv.email,
    display_name: (req.body && typeof (req.body as { display_name?: unknown }).display_name === "string")
      ? (req.body as { display_name: string }).display_name
      : (inv.email.split("@")[0] ?? inv.email),
    role: inv.role,
    invited_by: inv.invited_by,
    accepted_at: now,
    last_active_at: now,
    created_at: now,
  };
  store.members.set(id, member);
  store.recordAudit({
    actor_email: inv.email,
    action: "invite.accepted",
    target_type: "member",
    target_id: id,
    details: { invite_id: inv.id, role: inv.role },
    ip: clientIp(req),
    user_agent: clientUa(req),
  });
  const session = store.createSession(member.email, member.display_name);
  ok(res, { ok: true, member, session });
});

// --- Webhooks ---

app.get("/api/webhooks", (req, res) => {
  if (!requireAuth(req, res)) return;
  const rows = [...store.webhooks.values()].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  ok(res, { ok: true, webhooks: rows });
});

app.post("/api/webhooks", (req, res) => {
  const sess = requireAuth(req, res);
  if (!sess) return;
  try {
    const b = (req.body ?? {}) as Record<string, unknown>;
    if (typeof b.url !== "string" || !/^https?:\/\//.test(b.url)) return err(res, "invalid_request", "Valid url required", 400);
    if (b.app_id != null && !isUuid(b.app_id)) return err(res, "invalid_request", "app_id must be a UUID", 400);
    const events = Array.isArray(b.event_types) ? (b.event_types as unknown[]).filter((e): e is string => typeof e === "string") : [];
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const prefix = crypto.randomBytes(4).toString("hex");
    const fullSecret = `whsec_${prefix}_${crypto.randomBytes(24).toString("hex")}`;
    const webhook = {
      id,
      app_id: typeof b.app_id === "string" ? b.app_id : null,
      url: b.url,
      description: typeof b.description === "string" ? b.description : null,
      signing_secret_prefix: prefix,
      event_types: events,
      is_active: true,
      last_delivery_at: null,
      last_status: null,
      created_at: now,
      updated_at: now,
    };
    store.webhooks.set(id, webhook);
    store.recordAudit({
      actor_email: sess.email,
      action: "webhook.created",
      target_type: "webhook",
      target_id: id,
      details: { url: webhook.url },
      ip: clientIp(req),
      user_agent: clientUa(req),
    });
    // whsec_full is shown ONCE — not stored beyond this response
    ok(res, { ok: true, webhook, whsec_full: fullSecret, note: "Save whsec_full now — it is not stored and cannot be retrieved later." }, 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "create_failed";
    err(res, "invalid_request", msg, 400);
  }
});

app.patch("/api/webhooks/:id", (req, res) => {
  const sess = requireAuth(req, res);
  if (!sess) return;
  if (!isUuid(req.params.id)) return err(res, "invalid_request", "id must be a UUID", 400);
  const webhook = store.webhooks.get(req.params.id);
  if (!webhook) return err(res, "not_found", "Webhook not found", 404);
  const b = (req.body ?? {}) as Record<string, unknown>;
  if (typeof b.url === "string" && /^https?:\/\//.test(b.url)) webhook.url = b.url;
  if (typeof b.description === "string" || b.description === null) webhook.description = (b.description as string | null) ?? null;
  if (typeof b.is_active === "boolean") webhook.is_active = b.is_active;
  if (Array.isArray(b.event_types)) {
    webhook.event_types = (b.event_types as unknown[]).filter((e): e is string => typeof e === "string");
  }
  webhook.updated_at = new Date().toISOString();
  store.recordAudit({
    actor_email: sess.email,
    action: "webhook.updated",
    target_type: "webhook",
    target_id: webhook.id,
    details: { is_active: webhook.is_active },
    ip: clientIp(req),
    user_agent: clientUa(req),
  });
  ok(res, { ok: true, webhook });
});

app.delete("/api/webhooks/:id", (req, res) => {
  const sess = requireAuth(req, res);
  if (!sess) return;
  if (!isUuid(req.params.id)) return err(res, "invalid_request", "id must be a UUID", 400);
  const existed = store.webhooks.delete(req.params.id);
  if (!existed) return err(res, "not_found", "Webhook not found", 404);
  store.recordAudit({
    actor_email: sess.email,
    action: "webhook.deleted",
    target_type: "webhook",
    target_id: req.params.id,
    details: {},
    ip: clientIp(req),
    user_agent: clientUa(req),
  });
  ok(res, { ok: true });
});

app.post("/api/webhooks/:id/test", (req, res) => {
  const sess = requireAuth(req, res);
  if (!sess) return;
  if (!isUuid(req.params.id)) return err(res, "invalid_request", "id must be a UUID", 400);
  const webhook = store.webhooks.get(req.params.id);
  if (!webhook) return err(res, "not_found", "Webhook not found", 404);
  const now = new Date().toISOString();
  const delivery = {
    id: crypto.randomUUID(),
    endpoint_id: webhook.id,
    event_type: "test.webhook",
    payload: { test: true, message: "PushCare webhook test", at: now },
    response_status: 200,
    response_body: "ok",
    attempt_count: 1,
    succeeded: true,
    created_at: now,
    completed_at: now,
  };
  store.webhookDeliveries.unshift(delivery);
  webhook.last_delivery_at = now;
  webhook.last_status = 200;
  store.recordAudit({
    actor_email: sess.email,
    action: "webhook.tested",
    target_type: "webhook",
    target_id: webhook.id,
    details: {},
    ip: clientIp(req),
    user_agent: clientUa(req),
  });
  ok(res, { ok: true, delivery });
});

app.get("/api/webhooks/:id/deliveries", (req, res) => {
  if (!requireAuth(req, res)) return;
  if (!isUuid(req.params.id)) return err(res, "invalid_request", "id must be a UUID", 400);
  if (!store.webhooks.has(req.params.id)) return err(res, "not_found", "Webhook not found", 404);
  const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 50)));
  const rows = store.webhookDeliveries
    .filter((d) => d.endpoint_id === req.params.id)
    .slice(0, limit);
  ok(res, { ok: true, deliveries: rows });
});

// --- Audit log ---

app.get("/api/audit", (req, res) => {
  if (!requireAuth(req, res)) return;
  const limit = Math.min(1000, Math.max(1, Number(req.query.limit ?? 200)));
  const action = typeof req.query.action === "string" ? req.query.action : null;
  const since = typeof req.query.since === "string" ? +new Date(req.query.since) : NaN;
  let rows = store.auditEntries;
  if (action) rows = rows.filter((e) => e.action === action);
  if (!Number.isNaN(since)) rows = rows.filter((e) => +new Date(e.created_at) >= since);
  rows = rows.slice(0, limit);
  ok(res, { ok: true, entries: rows });
});

// --- Billing ---

app.get("/api/billing/plans", (_req, res) => {
  // Public — no auth
  ok(res, { ok: true, plans: store.plans });
});

app.get("/api/billing/subscription", (req, res) => {
  if (!requireAuth(req, res)) return;
  ok(res, { ok: true, subscription: store.subscription });
});

app.post("/api/billing/subscription", (req, res) => {
  const sess = requireAuth(req, res);
  if (!sess) return;
  try {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const code = typeof b.plan_code === "string" ? b.plan_code : "";
    const plan = store.plans.find((p) => p.code === code);
    if (!plan) return err(res, "not_found", "Plan not found", 404);
    const prevCode = store.subscription?.plan_code ?? null;
    const now = new Date();
    store.subscription = {
      id: store.subscription?.id ?? crypto.randomUUID(),
      plan_id: plan.id,
      plan_code: plan.code,
      status: "active",
      current_period_start: now.toISOString(),
      current_period_end: new Date(now.getTime() + 30 * 86400_000).toISOString(),
      cancel_at: null,
      stripe_customer_id: store.subscription?.stripe_customer_id ?? `cus_local_${crypto.randomBytes(8).toString("hex")}`,
    };
    store.recordAudit({
      actor_email: sess.email,
      action: "billing.plan_changed",
      target_type: "subscription",
      target_id: store.subscription.id,
      details: { from: prevCode, to: plan.code },
      ip: clientIp(req),
      user_agent: clientUa(req),
    });
    ok(res, { ok: true, subscription: store.subscription });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "update_failed";
    err(res, "invalid_request", msg, 400);
  }
});

app.get("/api/billing/usage", (req, res) => {
  if (!requireAuth(req, res)) return;
  ok(res, { ok: true, usage: store.usage });
});

// --- Builds (extension: POST + GET by id) ---

app.post("/api/builds", (req, res) => {
  const sess = requireAuth(req, res);
  if (!sess) return;
  try {
    const b = (req.body ?? {}) as Record<string, unknown>;
    if (!isUuid(b.app_id)) return err(res, "invalid_request", "app_id must be a UUID", 400);
    if (!store.apps.has(b.app_id)) return err(res, "not_found", "App not found", 404);
    const versionName = typeof b.version_name === "string" ? b.version_name : "0.0.1";
    const versionCode = typeof b.version_code === "number" ? b.version_code : Math.floor(Date.now() / 1000);
    const branch = typeof b.branch === "string" ? b.branch : "main";
    const releaseNotes = typeof b.release_notes === "string" ? b.release_notes : null;
    const id = crypto.randomUUID();
    const build = {
      id,
      app_id: b.app_id,
      version_code: versionCode,
      version_name: versionName,
      status: "queued" as const,
      build_started_at: new Date().toISOString(),
      build_completed_at: null,
      size_bytes: null,
      output_url: null,
      duration_ms: null,
      triggered_by: sess.email,
      branch,
      release_notes: releaseNotes,
    };
    store.builds.unshift(build);
    store.recordAudit({
      actor_email: sess.email,
      action: "build.queued",
      target_type: "build",
      target_id: id,
      details: { app_id: b.app_id, version_name: versionName, branch },
      ip: clientIp(req),
      user_agent: clientUa(req),
    });
    ok(res, { ok: true, build }, 202);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "create_failed";
    err(res, "invalid_request", msg, 400);
  }
});

app.get("/api/builds/:id", (req, res) => {
  if (!isUuid(req.params.id)) return err(res, "invalid_request", "id must be a UUID", 400);
  const build = store.builds.find((b) => b.id === req.params.id);
  if (!build) return err(res, "not_found", "Build not found", 404);
  ok(res, { ok: true, build });
});

app.listen(PORT, () => {
  console.log(`PushCare local-api listening on http://localhost:${PORT}`);
  console.log(`Demo service key: ${DEMO_SERVICE_KEY}`);
});
