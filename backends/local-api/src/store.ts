/**
 * In-memory store + seed data. Mirrors pushcare-admin types closely enough
 * for full local workflow (SDK → devices/subscribers → campaigns).
 */

import crypto from "node:crypto";

// --- Shared shapes (JSON-serializable for responses) ---

export type AppStatus = "active" | "paused" | "suspended";

export type CampaignStatus =
  | "draft"
  | "queued"
  | "dispatching"
  | "sent"
  | "failed"
  | "scheduled";

export type AndroidApp = {
  id: string;
  name: string;
  package_name: string;
  app_key: string;
  status: AppStatus;
  icon_color: string;
  icon_glyph: string;
  total_installs: number;
  active_devices_24h: number;
  live_users: number;
  total_pushes_sent: number;
  delivery_rate: number;
  open_rate: number;
  created_at: string;
  fcm_project_id: string | null;
};

export type Device = {
  id: string;
  app_id: string;
  install_hash: string;
  country_code: string;
  manufacturer: string;
  model: string;
  os_version: string;
  app_version: string;
  is_active: boolean;
  first_seen_at: string;
  last_seen_at: string;
};

export type Subscriber = {
  id: string;
  app_id: string;
  device_id: string;
  fcm_token_redacted: string;
  is_valid: boolean;
  last_seen_at: string;
};

export type Campaign = {
  id: string;
  app_id: string;
  title: string;
  body: string;
  image_url: string | null;
  click_url: string | null;
  target_type: "all" | "active" | "country" | "device_list";
  target_summary: string;
  status: CampaignStatus;
  created_at: string;
  scheduled_at: string | null;
  sent_at: string | null;
  recipients_count: number;
  sent_count: number;
  delivered_count: number;
  opened_count: number;
  clicked_count: number;
  failed_count: number;
};

export type ApiKey = {
  id: string;
  app_id: string;
  name: string;
  key_preview: string;
  scopes: string[];
  rate_limit_rpm: number;
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
};

export type ApkBuild = {
  id: string;
  app_id: string;
  version_code: number;
  version_name: string;
  status: "queued" | "building" | "success" | "failed";
  build_started_at: string;
  build_completed_at: string | null;
  size_bytes: number | null;
  output_url: string | null;
  duration_ms: number | null;
  triggered_by: string;
  branch?: string | null;
  release_notes?: string | null;
  /** sha256 (hex) of the produced APK. */
  apk_sha256?: string | null;
  /** Captured build output (gradle stdout/stderr or simulated trace). */
  build_log?: string | null;
  /** Set when status === "failed". */
  error_message?: string | null;
};

export type Segment = {
  id: string; app_id: string; name: string; description: string | null;
  rules: Record<string, unknown>; estimated_size: number;
  last_evaluated_at: string | null; created_at: string; updated_at: string;
};

export type MemberRole = "owner" | "admin" | "developer" | "viewer" | "service";

export type Member = {
  id: string; user_id: string | null; email: string; display_name: string;
  role: MemberRole; invited_by: string | null;
  accepted_at: string | null; last_active_at: string | null; created_at: string;
};

export type Invite = {
  id: string; email: string; role: MemberRole; token: string;
  invited_by: string | null; expires_at: string;
  accepted_at: string | null; created_at: string;
};

export type Webhook = {
  id: string; app_id: string | null; url: string; description: string | null;
  signing_secret_prefix: string;  // visible part — full secret is whsec_<prefix>_<random>
  event_types: string[]; is_active: boolean;
  last_delivery_at: string | null; last_status: number | null;
  created_at: string; updated_at: string;
};

export type WebhookDelivery = {
  id: string; endpoint_id: string; event_type: string;
  payload: Record<string, unknown>;
  response_status: number | null; response_body: string | null;
  attempt_count: number; succeeded: boolean;
  created_at: string; completed_at: string | null;
};

export type AuditEntry = {
  id: string; actor_email: string | null; action: string;
  target_type: string | null; target_id: string | null;
  details: Record<string, unknown>; ip: string | null;
  user_agent: string | null; created_at: string;
};

export type Plan = {
  id: string; code: "free" | "pro" | "enterprise"; name: string;
  monthly_pushes: number; max_apps: number; max_seats: number;
  monthly_price_usd: number; features: Record<string, unknown>; sort_order: number;
};

export type Subscription = {
  id: string; plan_id: string; plan_code: Plan["code"];
  status: "trialing" | "active" | "past_due" | "cancelled";
  current_period_start: string; current_period_end: string;
  cancel_at: string | null; stripe_customer_id: string | null;
};

export type UsageMonth = {
  period: string;  // YYYY-MM-01
  pushes_sent: number; active_devices: number; events_recorded: number;
};

export type AuthSession = {
  user_id: string; email: string; display_name: string;
  access_token: string; expires_at: string;
};

export type Point = { t: number; v: number };

function uuid(): string {
  return crypto.randomUUID();
}

function redactToken(tok: string): string {
  if (tok.length <= 12) return "fcm_•••";
  return `fcm_${tok.slice(0, 4)}…${tok.slice(-4)}`;
}

function isoNow(): string {
  return new Date().toISOString();
}

function installHash(appKey: string, androidId: string): string {
  return crypto.createHash("sha256").update(`${appKey}:${androidId}`).digest("hex").slice(0, 32);
}

const APPS_SEED = [
  { name: "Aurora Health", pkg: "com.aurora.health", glyph: "AH", color: "from-emerald-500/20 to-emerald-500/5", scale: 1.0 },
  { name: "Tinkr Music", pkg: "fm.tinkr.android", glyph: "TM", color: "from-fuchsia-500/20 to-fuchsia-500/5", scale: 0.7 },
  { name: "Quikbite", pkg: "co.quikbite.app", glyph: "QB", color: "from-orange-500/20 to-orange-500/5", scale: 0.55 },
  { name: "Coursecraft", pkg: "io.coursecraft", glyph: "CC", color: "from-sky-500/20 to-sky-500/5", scale: 0.4 },
  { name: "Mitra Wallet", pkg: "com.mitra.wallet", glyph: "MW", color: "from-lime-500/20 to-lime-500/5", scale: 0.85 },
] as const;

const COUNTRIES = ["BD", "IN", "PK", "ID", "NG", "BR", "US", "MX", "PH"] as const;
const MANUFACTURERS = ["Samsung", "Xiaomi", "Google", "OnePlus"] as const;

type StoredSubscriber = Subscriber & { _fcm_token: string };

export class PushCareStore {
  readonly demoServiceKey: string;
  private readonly keysByHash = new Map<string, string>(); // sha256 hex -> raw key

  apps = new Map<string, AndroidApp>();
  devices = new Map<string, Device>();
  subscribers = new Map<string, StoredSubscriber>();
  /** device_id → subscriber_id (latest) */
  deviceSubscriber = new Map<string, string>();
  campaigns: Campaign[] = [];
  apiKeys: ApiKey[] = [];
  builds: ApkBuild[] = [];

  segments = new Map<string, Segment>();
  members = new Map<string, Member>();
  invites = new Map<string, Invite>();
  webhooks = new Map<string, Webhook>();
  webhookDeliveries: WebhookDelivery[] = [];
  auditEntries: AuditEntry[] = [];
  plans: Plan[] = [];
  subscription: Subscription | null = null;
  usage: UsageMonth[] = [];
  sessions = new Map<string, AuthSession>();

  constructor(demoServiceKey: string) {
    this.demoServiceKey = demoServiceKey;
    this.seed();
  }

  private seed(): void {
    const ownerApps: AndroidApp[] = APPS_SEED.map((s, i) => {
      const rng = mulberry32(hash32(`seed-app-${i}`));
      const scale = s.scale;
      const total = Math.floor((120_000 + rng() * 400_000) * scale);
      const active24 = Math.floor(total * (0.18 + rng() * 0.18));
      const live = Math.floor(active24 * (0.05 + rng() * 0.06));
      const sent = Math.floor(total * (0.7 + rng() * 0.6));
      const pk = `pk_${crypto.randomBytes(24).toString("hex")}`;
      return {
        id: uuid(),
        name: s.name,
        package_name: s.pkg,
        app_key: pk,
        status: i === 4 ? "paused" : "active",
        icon_color: s.color,
        icon_glyph: s.glyph,
        total_installs: total,
        active_devices_24h: active24,
        live_users: live,
        total_pushes_sent: sent,
        delivery_rate: 0.78 + rng() * 0.14,
        open_rate: 0.06 + rng() * 0.14,
        created_at: daysAgoIso(rng, 60, 400),
        fcm_project_id: `${s.pkg.split(".").pop()}-${Math.floor(rng() * 1000)}`,
      };
    });

    for (const app of ownerApps) this.apps.set(app.id, app);

    // Synthetic devices + subscribers per app
    for (const app of ownerApps) {
      const n = 40 + Math.floor(hash32(app.id) % 40);
      const r = mulberry32(hash32(`dev-${app.id}`));
      for (let i = 0; i < n; i++) {
        const androidId = crypto.randomBytes(8).toString("hex");
        const ih = installHash(app.app_key, androidId);
        const country = COUNTRIES[Math.floor(r() * COUNTRIES.length)]!;
        const mfg = MANUFACTURERS[Math.floor(r() * MANUFACTURERS.length)]!;
        const lastSeen = r() > 0.2 ? minutesAgoIso(r, 0, 60 * 24) : daysAgoIso(r, 2, 14);
        const dev: Device = {
          id: uuid(),
          app_id: app.id,
          install_hash: ih,
          country_code: country,
          manufacturer: mfg,
          model: "Pixel 8",
          os_version: "14",
          app_version: "2.4.1",
          is_active: minutesSince(lastSeen) < 60 * 24,
          first_seen_at: daysAgoIso(r, 1, 120),
          last_seen_at: lastSeen,
        };
        this.devices.set(dev.id, dev);
        const tok = `fake-fcm-${crypto.randomBytes(24).toString("hex")}`;
        const sub: StoredSubscriber = {
          id: uuid(),
          app_id: app.id,
          device_id: dev.id,
          fcm_token_redacted: redactToken(tok),
          is_valid: true,
          last_seen_at: lastSeen,
          _fcm_token: tok,
        };
        this.subscribers.set(sub.id, sub);
        this.deviceSubscriber.set(dev.id, sub.id);
      }
      this.recalcAppMetrics(app.id);
    }

    // Demo API key (matches SERVICE_KEY for /push/send)
    const rawKey = this.demoServiceKey;
    this.keysByHash.set(sha256hex(rawKey), rawKey);
    this.apiKeys.push({
      id: uuid(),
      app_id: "",
      name: "local-dev",
      key_preview: rawKey.slice(0, 14) + "…" + rawKey.slice(-4),
      scopes: ["push:send", "analytics:read"],
      rate_limit_rpm: 600,
      is_active: true,
      last_used_at: null,
      expires_at: null,
      created_at: isoNow(),
    });

    // Sample campaigns
    const r = mulberry32(42);
    for (let i = 0; i < 8; i++) {
      const app = ownerApps[Math.floor(r() * ownerApps.length)]!;
      const recipients = Math.floor(app.active_devices_24h * 0.4);
      const sent = recipients;
      const delivered = Math.floor(sent * 0.85);
      const opened = Math.floor(delivered * 0.1);
      const clicked = Math.floor(opened * 0.2);
      this.campaigns.push({
        id: uuid(),
        app_id: app.id,
        title: ["Flash sale", "Weekly digest", "New episode"][i % 3]!,
        body: "Tap to open the app.",
        image_url: null,
        click_url: "myapp://home",
        target_type: "active",
        target_summary: "Active in last 24h",
        status: "sent",
        created_at: daysAgoIso(r, 0, 20),
        scheduled_at: null,
        sent_at: daysAgoIso(r, 0, 18),
        recipients_count: recipients,
        sent_count: sent,
        delivered_count: delivered,
        opened_count: opened,
        clicked_count: clicked,
        failed_count: Math.max(0, sent - delivered),
      });
    }
    this.campaigns.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

    // Sample builds
    for (let i = 0; i < 6; i++) {
      const app = ownerApps[i % ownerApps.length]!;
      this.builds.push({
        id: uuid(),
        app_id: app.id,
        version_code: 200 - i,
        version_name: `2.4.${i}`,
        status: "success",
        build_started_at: daysAgoIso(r, 0, 10),
        build_completed_at: daysAgoIso(r, 0, 9),
        size_bytes: 12 * 1024 * 1024,
        output_url: `https://cdn.example/${app.id}/app.apk`,
        duration_ms: 120_000,
        triggered_by: "ci-bot",
        branch: "main",
        release_notes: null,
      });
    }

    // --- Segments: 5 per app ---
    const segmentTemplates: Array<{ name: string; description: string; rules: Record<string, unknown> }> = [
      { name: "Active Bangladesh users", description: "Users in BD seen in last 7d", rules: { country_in: ["BD"], active_within_days: 7 } },
      { name: "Heavy spenders", description: "Made a purchase in last 30 days", rules: { event_in_last_days: { event: "purchase", days: 30 } } },
      { name: "Recent signups", description: "Installed in last 14 days", rules: { installed_within_days: 14 } },
      { name: "iOS only", description: "Devices on iOS", rules: { platform_in: ["ios"] } },
      { name: "Crash reporters", description: "Devices that crashed in last 7 days", rules: { event_in_last_days: { event: "app_crash", days: 7 } } },
    ];
    for (const app of ownerApps) {
      const sr = mulberry32(hash32(`seg-${app.id}`));
      for (const tpl of segmentTemplates) {
        const ratio = 0.05 + sr() * 0.45;
        const sid = uuid();
        const created = daysAgoIso(sr, 5, 90);
        this.segments.set(sid, {
          id: sid,
          app_id: app.id,
          name: tpl.name,
          description: tpl.description,
          rules: tpl.rules,
          estimated_size: Math.max(1, Math.floor(app.active_devices_24h * ratio)),
          last_evaluated_at: daysAgoIso(sr, 0, 5),
          created_at: created,
          updated_at: created,
        });
      }
    }

    // --- Members: 4 default ---
    const memberSeeds: Array<{ email: string; display_name: string; role: MemberRole }> = [
      { email: "admin@pushcare.local", display_name: "Acme Owner", role: "owner" },
      { email: "ops@pushcare.local", display_name: "Ops Admin", role: "admin" },
      { email: "dev@pushcare.local", display_name: "Dev User", role: "developer" },
      { email: "view@pushcare.local", display_name: "Viewer", role: "viewer" },
    ];
    let ownerId: string | null = null;
    for (const m of memberSeeds) {
      const id = uuid();
      const created = daysAgoIso(r, 30, 200);
      const member: Member = {
        id,
        user_id: id,
        email: m.email,
        display_name: m.display_name,
        role: m.role,
        invited_by: m.role === "owner" ? null : ownerId,
        accepted_at: created,
        last_active_at: minutesAgoIso(r, 1, 60 * 24),
        created_at: created,
      };
      if (m.role === "owner") ownerId = id;
      this.members.set(id, member);
    }

    // --- Invites: 2 pending ---
    for (const inv of [
      { email: "newdev@pushcare.local", role: "developer" as MemberRole },
      { email: "marketing@pushcare.local", role: "viewer" as MemberRole },
    ]) {
      const id = uuid();
      const created = daysAgoIso(r, 0, 5);
      const expires = new Date(Date.now() + 7 * dayMs).toISOString();
      this.invites.set(id, {
        id,
        email: inv.email,
        role: inv.role,
        token: `inv_${crypto.randomBytes(16).toString("hex")}`,
        invited_by: ownerId,
        expires_at: expires,
        accepted_at: null,
        created_at: created,
      });
    }

    // --- Webhooks: 3 ---
    const webhookSeeds: Array<{ url: string; description: string; events: string[]; active: boolean; app_id: string | null }> = [
      { url: "https://api.example.com/webhooks/delivery", description: "Production delivery events", events: ["push.sent", "push.delivered", "push.failed"], active: true, app_id: null },
      { url: "https://hooks.slack.com/services/T000/B000/abc", description: "Slack failure alerts", events: ["push.failed"], active: true, app_id: null },
      { url: "https://staging.example.com/webhooks/delivery", description: "Staging endpoint (paused)", events: ["push.sent", "push.delivered"], active: false, app_id: null },
    ];
    const webhookIds: string[] = [];
    for (const wh of webhookSeeds) {
      const id = uuid();
      webhookIds.push(id);
      const created = daysAgoIso(r, 7, 90);
      this.webhooks.set(id, {
        id,
        app_id: wh.app_id,
        url: wh.url,
        description: wh.description,
        signing_secret_prefix: crypto.randomBytes(4).toString("hex"),
        event_types: wh.events,
        is_active: wh.active,
        last_delivery_at: wh.active ? minutesAgoIso(r, 5, 60 * 24) : null,
        last_status: wh.active ? 200 : null,
        created_at: created,
        updated_at: created,
      });
    }

    // --- Webhook deliveries: 12 spread across last 7 days ---
    const events = ["push.sent", "push.delivered", "push.failed"];
    for (let i = 0; i < 12; i++) {
      const endpointId = webhookIds[Math.floor(r() * webhookIds.length)]!;
      const failed = i === 3 || i === 9; // 2 failures
      const created = daysAgoIso(r, 0, 7);
      const completed = new Date(+new Date(created) + 1500 + r() * 800).toISOString();
      this.webhookDeliveries.push({
        id: uuid(),
        endpoint_id: endpointId,
        event_type: events[Math.floor(r() * events.length)]!,
        payload: { example: true, idx: i },
        response_status: failed ? 502 : 200,
        response_body: failed ? "Bad Gateway" : "ok",
        attempt_count: failed ? 3 : 1,
        succeeded: !failed,
        created_at: created,
        completed_at: completed,
      });
    }
    this.webhookDeliveries.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

    // --- Audit entries: 50 across last 30 days ---
    const auditActions = [
      { action: "app.created", target_type: "app" },
      { action: "campaign.sent", target_type: "campaign" },
      { action: "key.created", target_type: "api_key" },
      { action: "key.revoked", target_type: "api_key" },
      { action: "member.invited", target_type: "member" },
      { action: "webhook.created", target_type: "webhook" },
    ];
    const actorEmails = memberSeeds.map((m) => m.email);
    for (let i = 0; i < 50; i++) {
      const a = auditActions[Math.floor(r() * auditActions.length)]!;
      this.auditEntries.push({
        id: uuid(),
        actor_email: actorEmails[Math.floor(r() * actorEmails.length)]!,
        action: a.action,
        target_type: a.target_type,
        target_id: uuid(),
        details: { seeded: true },
        ip: `10.0.${Math.floor(r() * 250)}.${Math.floor(r() * 250)}`,
        user_agent: "PushCareAdmin/1.0",
        created_at: daysAgoIso(r, 0, 30),
      });
    }
    this.auditEntries.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

    // --- Plans ---
    this.plans = [
      {
        id: uuid(),
        code: "free",
        name: "Free",
        monthly_pushes: 100_000,
        max_apps: 2,
        max_seats: 2,
        monthly_price_usd: 0,
        features: { push_send: true, analytics_basic: true },
        sort_order: 1,
      },
      {
        id: uuid(),
        code: "pro",
        name: "Pro",
        monthly_pushes: 50_000_000,
        max_apps: 25,
        max_seats: 5,
        monthly_price_usd: 249,
        features: {
          push_send: true,
          analytics_basic: true,
          analytics_advanced: true,
          retention_90d: true,
          webhooks: true,
          segments: true,
        },
        sort_order: 2,
      },
      {
        id: uuid(),
        code: "enterprise",
        name: "Enterprise",
        monthly_pushes: 1_000_000_000,
        max_apps: 200,
        max_seats: 50,
        monthly_price_usd: 1_299,
        features: {
          push_send: true,
          analytics_basic: true,
          analytics_advanced: true,
          retention_90d: true,
          webhooks: true,
          segments: true,
          sso: true,
          sla: "99.99%",
        },
        sort_order: 3,
      },
    ];

    // --- Subscription: pro, active ---
    const proPlan = this.plans.find((p) => p.code === "pro")!;
    const periodStart = new Date(Date.now() - 12 * dayMs).toISOString();
    const periodEnd = new Date(Date.now() + 18 * dayMs).toISOString();
    this.subscription = {
      id: uuid(),
      plan_id: proPlan.id,
      plan_code: "pro",
      status: "active",
      current_period_start: periodStart,
      current_period_end: periodEnd,
      cancel_at: null,
      stripe_customer_id: `cus_local_${crypto.randomBytes(8).toString("hex")}`,
    };

    // --- Usage: 12 months, increasing trend, last month ~14M pushes ---
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const period = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
      const monthsBack = i;
      // Growth: last month (i=0) ~14M, going down
      const factor = Math.pow(0.88, monthsBack);
      const pushes = Math.floor(14_000_000 * factor + (r() - 0.5) * 600_000);
      const devices = Math.floor(900_000 * factor + (r() - 0.5) * 50_000);
      const events = Math.floor(40_000_000 * factor + (r() - 0.5) * 1_500_000);
      this.usage.push({
        period,
        pushes_sent: Math.max(0, pushes),
        active_devices: Math.max(0, devices),
        events_recorded: Math.max(0, events),
      });
    }
  }

  // --- Helpers for new collections ---

  recordAudit(entry: Omit<AuditEntry, "id" | "created_at">): AuditEntry {
    const row: AuditEntry = {
      id: uuid(),
      created_at: isoNow(),
      ...entry,
    };
    this.auditEntries.unshift(row);
    return row;
  }

  validateSession(token: string): AuthSession | null {
    const s = this.sessions.get(token);
    if (!s) return null;
    if (+new Date(s.expires_at) <= Date.now()) {
      this.sessions.delete(token);
      return null;
    }
    return s;
  }

  createSession(email: string, displayName: string): AuthSession {
    const token = `pcat_${crypto.randomBytes(24).toString("hex")}`;
    const member = [...this.members.values()].find((m) => m.email.toLowerCase() === email.toLowerCase());
    const userId = member?.user_id ?? member?.id ?? uuid();
    const expires = new Date(Date.now() + 30 * dayMs).toISOString();
    const sess: AuthSession = {
      user_id: userId,
      email,
      display_name: displayName,
      access_token: token,
      expires_at: expires,
    };
    this.sessions.set(token, sess);
    if (member) member.last_active_at = isoNow();
    return sess;
  }

  findAppByKey(appKey: string): AndroidApp | undefined {
    return [...this.apps.values()].find((a) => a.app_key === appKey);
  }

  validateServiceKey(key: string): boolean {
    return this.keysByHash.has(sha256hex(key));
  }

  touchApiKey(): void {
    const k = this.apiKeys[0];
    if (k) k.last_used_at = isoNow();
  }

  listApps(): AndroidApp[] {
    return [...this.apps.values()];
  }

  getDevicesForApp(appId: string): Device[] {
    return [...this.devices.values()].filter((d) => d.app_id === appId).sort((a, b) => +new Date(b.last_seen_at) - +new Date(a.last_seen_at));
  }

  getSubscribersForApp(appId: string): Subscriber[] {
    return [...this.subscribers.values()]
      .filter((s) => s.app_id === appId)
      .map(({ _fcm_token: _, ...rest }) => rest);
  }

  /** Resolve targeting for a campaign */
  matchSubscribers(
    appId: string,
    target: {
      type: "all" | "active" | "country" | "device_list";
      active_within_minutes?: number;
      country_codes?: string[];
      device_ids?: string[];
    },
  ): StoredSubscriber[] {
    const subs = [...this.subscribers.values()].filter((s) => s.app_id === appId && s.is_valid);
    const now = Date.now();
    if (target.type === "all") return subs;

    if (target.type === "active") {
      const winMs = (target.active_within_minutes ?? 1440) * 60_000;
      return subs.filter((s) => {
        const dev = this.devices.get(s.device_id);
        if (!dev) return false;
        return now - +new Date(dev.last_seen_at) <= winMs;
      });
    }

    if (target.type === "country") {
      const cc = new Set((target.country_codes ?? []).map((c) => c.toUpperCase()));
      return subs.filter((s) => {
        const dev = this.devices.get(s.device_id);
        return dev && cc.has(dev.country_code);
      });
    }

    const ids = new Set(target.device_ids ?? []);
    return subs.filter((s) => ids.has(s.device_id));
  }

  recalcAppMetrics(appId: string): void {
    const app = this.apps.get(appId);
    if (!app) return;
    const devs = this.getDevicesForApp(appId);
    const now = Date.now();
    const dayMs = 86400_000;
    const fiveMin = 5 * 60_000;
    app.total_installs = devs.length;
    app.active_devices_24h = devs.filter((d) => now - +new Date(d.last_seen_at) <= dayMs).length;
    app.live_users = devs.filter((d) => now - +new Date(d.last_seen_at) <= fiveMin).length;
  }

  sdkInit(body: {
    android_id: string;
    fcm_token?: string;
    manufacturer?: string;
    model?: string;
    os_version?: string;
    app_version?: string;
    country_code?: string;
    app_key?: string;
  }, headerAppKey: string | null | undefined): {
    device_id: string;
    app_id: string;
    subscriber_id: string;
    is_new_install: boolean;
    heartbeat_interval_sec: number;
  } {
    let appKey = headerAppKey ?? (typeof body.app_key === "string" ? body.app_key : "");
    if (/^pk_[a-fA-F0-9]{48}$/.test(appKey)) appKey = `pk_${appKey.slice(3).toLowerCase()}`;
    const app = this.findAppByKey(appKey);
    if (!app) throw new Error("invalid_app_key");
    if (app.status !== "active") throw new Error("app_suspended");

    const ih = installHash(appKey, body.android_id);
    let device = [...this.devices.values()].find((d) => d.app_id === app.id && d.install_hash === ih);
    let isNew = false;

    if (!device) {
      isNew = true;
      device = {
        id: uuid(),
        app_id: app.id,
        install_hash: ih,
        country_code: (body.country_code ?? "US").slice(0, 2).toUpperCase(),
        manufacturer: body.manufacturer ?? "Unknown",
        model: body.model ?? "Unknown",
        os_version: body.os_version ?? "14",
        app_version: body.app_version ?? "1.0.0",
        is_active: true,
        first_seen_at: isoNow(),
        last_seen_at: isoNow(),
      };
      this.devices.set(device.id, device);
    } else {
      device.last_seen_at = isoNow();
      device.app_version = body.app_version ?? device.app_version;
      if (body.country_code) device.country_code = body.country_code.slice(0, 2).toUpperCase();
    }

    let subId = this.deviceSubscriber.get(device.id);
    const tok = body.fcm_token ?? `placeholder-${device.id}`;
    if (!subId || body.fcm_token) {
      const sub: StoredSubscriber = {
        id: uuid(),
        app_id: app.id,
        device_id: device.id,
        fcm_token_redacted: redactToken(tok),
        is_valid: true,
        last_seen_at: isoNow(),
        _fcm_token: tok,
      };
      if (subId) this.subscribers.delete(subId);
      this.subscribers.set(sub.id, sub);
      this.deviceSubscriber.set(device.id, sub.id);
      subId = sub.id;
    }

    this.recalcAppMetrics(app.id);
    return {
      device_id: device.id,
      app_id: app.id,
      subscriber_id: subId!,
      is_new_install: isNew,
      heartbeat_interval_sec: 45,
    };
  }

  registerDevice(body: { device_id: string; app_key?: string; fcm_token?: string }): { subscriber_id: string } {
    const device = this.devices.get(body.device_id);
    if (!device) throw new Error("not_found");
    const app = this.apps.get(device.app_id);
    if (!app) throw new Error("not_found");
    if (body.app_key && body.app_key !== app.app_key) throw new Error("invalid_app_key");

    const tok = body.fcm_token ?? "";
    const sub: StoredSubscriber = {
      id: uuid(),
      app_id: app.id,
      device_id: device.id,
      fcm_token_redacted: redactToken(tok || "x"),
      is_valid: !!tok,
      last_seen_at: isoNow(),
      _fcm_token: tok || `rot-${device.id}`,
    };
    const old = this.deviceSubscriber.get(device.id);
    if (old) this.subscribers.delete(old);
    this.subscribers.set(sub.id, sub);
    this.deviceSubscriber.set(device.id, sub.id);
    return { subscriber_id: sub.id };
  }

  heartbeat(body: { device_id: string; app_id: string }): void {
    const device = this.devices.get(body.device_id);
    if (!device || device.app_id !== body.app_id) return;
    const t = isoNow();
    device.last_seen_at = t;
    device.is_active = true;
    const sid = this.deviceSubscriber.get(device.id);
    if (sid) {
      const sub = this.subscribers.get(sid);
      if (sub) sub.last_seen_at = t;
    }
    this.recalcAppMetrics(device.app_id);
  }

  createCampaign(input: {
    app_id: string;
    title: string;
    body: string;
    image_url?: string | null;
    click_url?: string | null;
    target_type: Campaign["target_type"];
    active_within_minutes?: number;
    country_codes?: string[];
    device_ids?: string[];
    scheduled_at?: string | null;
  }): Campaign {
    const app = this.apps.get(input.app_id);
    if (!app) throw new Error("app_not_found");

    const matched = this.matchSubscribers(input.app_id, {
      type: input.target_type,
      active_within_minutes: input.active_within_minutes,
      country_codes: input.country_codes,
      device_ids: input.device_ids,
    });
    const recipients = matched.length;

    let target_summary = "";
    if (input.target_type === "all") target_summary = "All subscribers";
    else if (input.target_type === "active")
      target_summary = `Active in last ${(input.active_within_minutes ?? 1440) >= 1440 ? `${Math.round((input.active_within_minutes ?? 1440) / 1440)}d` : `${input.active_within_minutes}m`}`;
    else if (input.target_type === "country") target_summary = (input.country_codes ?? []).join(", ");
    else target_summary = `${(input.device_ids ?? []).length} devices`;

    const isScheduled = !!input.scheduled_at && +new Date(input.scheduled_at) > Date.now();

    const camp: Campaign = {
      id: uuid(),
      app_id: input.app_id,
      title: input.title,
      body: input.body,
      image_url: input.image_url ?? null,
      click_url: input.click_url ?? null,
      target_type: input.target_type,
      target_summary,
      status: isScheduled ? "scheduled" : "sent",
      created_at: isoNow(),
      scheduled_at: isScheduled ? input.scheduled_at! : null,
      sent_at: isScheduled ? null : isoNow(),
      recipients_count: recipients,
      sent_count: isScheduled ? 0 : recipients,
      delivered_count: isScheduled ? 0 : Math.floor(recipients * 0.84),
      opened_count: isScheduled ? 0 : Math.floor(recipients * 0.084),
      clicked_count: isScheduled ? 0 : Math.floor(recipients * 0.017),
      failed_count: isScheduled ? 0 : Math.max(0, recipients - Math.floor(recipients * 0.84)),
    };

    this.campaigns.unshift(camp);
    if (!isScheduled) {
      app.total_pushes_sent += recipients;
    }
    return camp;
  }

  analyticsOverview(seed: string): {
    dailyInstalls: Point[];
    hourlyHeartbeats: Point[];
    geoBreakdown: { code: string; name: string; v: number; pct: number }[];
    recentEvents: { id: string; name: string; count: number; uniqueDevices: number; deltaPct: number }[];
  } {
    const r = mulberry32(hash32(seed));
    const dailyInstalls: Point[] = [];
    let base = 50_000 + r() * 30_000;
    const now = Date.now();
    for (let i = 29; i >= 0; i--) {
      base *= 0.97 + r() * 0.07;
      dailyInstalls.push({ t: now - i * dayMs, v: Math.floor(base + (r() - 0.5) * 8000) });
    }
    const hourlyHeartbeats: Point[] = [];
    for (let i = 47; i >= 0; i--) {
      hourlyHeartbeats.push({ t: now - i * 3600_000, v: Math.floor(20_000 + r() * 90_000) });
    }
    const geo = COUNTRIES.slice(0, 6).map((code) => ({
      code,
      name: code,
      v: Math.floor(20_000 + r() * 200_000),
      pct: 0,
    }));
    const gt = geo.reduce((s, x) => s + x.v, 0);
    geo.forEach((x) => (x.pct = x.v / gt));
    const NAMES = ["screen_view", "push_opened", "purchase_completed", "login"];
    const recentEvents = NAMES.map((name) => ({
      id: uuid(),
      name,
      count: Math.floor(2000 + r() * 500_000),
      uniqueDevices: Math.floor(800 + r() * 80_000),
      deltaPct: (r() - 0.45) * 80,
    }));
    return { dailyInstalls, hourlyHeartbeats, geoBreakdown: geo, recentEvents };
  }
}

const dayMs = 86400_000;

function sha256hex(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function hash32(s: string): number {
  const h = crypto.createHash("sha256").update(s).digest();
  return h.readUInt32BE(0);
}

function mulberry32(a: number): () => number {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function daysAgoIso(rng: () => number, min: number, max: number): string {
  const days = min + rng() * (max - min);
  return new Date(Date.now() - days * dayMs).toISOString();
}

function minutesAgoIso(rng: () => number, min: number, max: number): string {
  const m = min + rng() * (max - min);
  return new Date(Date.now() - m * 60_000).toISOString();
}

function minutesSince(iso: string): number {
  return (Date.now() - +new Date(iso)) / 60_000;
}
