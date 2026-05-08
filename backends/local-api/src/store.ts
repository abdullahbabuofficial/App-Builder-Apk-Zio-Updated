/**
 * In-memory store + seed data. Mirrors apkzio-admin types closely enough
 * for full local workflow (SDK → devices/subscribers → campaigns).
 */

import crypto from "node:crypto";

import type { AuthUser } from "./auth.js";
import { hashPassword } from "./auth.js";
import { query } from "./db.js";

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
  active_within_minutes?: number;
  country_codes?: string[];
  device_ids?: string[];
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

export type WebViewBuildConfig = {
  app_name: string;
  package_name: string;
  start_url: string;
  primary_color: string;
  background_color: string;
  splash_color: string;
  allow_file_uploads: boolean;
  allow_geolocation: boolean;
  allow_camera: boolean;
  pull_to_refresh: boolean;
  swipe_back: boolean;
  offline_message: string;
  release_notes: string;
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
  /**
   * Path to the generated WebView source archive, relative to the API origin
   * (e.g. `/artifacts/<id>/source.zip`). Always equal to `output_url` for real
   * builds — kept as a separate field so the dashboard can disambiguate the
   * legacy "fake APK url" rows from the seed data.
   */
  source_zip_url?: string | null;
  /** Snapshot of the WebView config we ran the template against. */
  config?: WebViewBuildConfig | null;
  /** Convenience count so the dashboard can poll without fetching the log body. */
  logs_count?: number;
  /**
   * Optional owner — set by the public builder bridge when the caller
   * presents a Bearer token. Admin-created builds leave this undefined.
   */
  user_id?: string;
  /**
   * Optional generated APK download URL (e.g. `/artifacts/<id>/app-debug.apk`).
   * Only populated when the host has JDK 17 + Gradle + ANDROID_HOME and the
   * `APKZIO_ENABLE_APK_BUILD` env var is set; otherwise null and the build
   * is treated as ZIP-only.
   */
  apk_url?: string | null;
  /** Size of the generated APK in bytes, when one was produced. */
  apk_size_bytes?: number | null;
  /** True when the runner deliberately skipped the Gradle pass. */
  apk_build_skipped?: boolean;
  /** Reason string if the Gradle pass ran but failed (e.g. "exit 1", "timeout"). */
  apk_build_error?: string | null;
};

// --- WordPress plugins + site telemetry (admin Plugins pages) ---

export type WpPlugin = {
  id: string;
  slug: string;
  name: string;
  latest_version: string;
  description?: string;
};

/** API shape — never includes `site_token_hash`. */
export type WpSiteInstall = {
  id: string;
  plugin_id: string;
  site_url: string;
  wp_version: string;
  plugin_version: string;
  created_at: string;
  last_seen_at: string;
  subscribers_total: number;
};

type WpSiteInstallRow = WpSiteInstall & { site_token_hash: string };

type WpTrafficBucket = { pageviews: number; uniques: number };

export type WpPluginRange = "rt" | "d" | "w" | "m";

// --- Customer-scoped types (public frontend bridge) ---

export type StoredUser = AuthUser & {
  password_hash: string;
  password_salt: string;
  /** Firebase Auth UID when the user signed in with Google. */
  google_uid?: string;
  /** Updated on sign-in and `/api/auth/me` — operator CRM only (not in `publicUser`). */
  last_seen_at?: string;
  reset_token?: string;
  reset_token_exp?: number;
  email_verification_token?: string;
};

export type CartItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  added_at: string;
};

export type Cart = {
  items: CartItem[];
  promo_code: string | null;
  discount_pct: number;
};

export type Subscription = {
  id: string;
  user_id: string;
  plan_name: string;
  status: "active" | "cancelled";
  started_at: string;
  amount: number;
};

export type Payment = {
  id: string;
  user_id: string;
  amount: number;
  status: "succeeded" | "failed";
  method: string;
  created_at: string;
  invoice_id?: string;
};

export type InvoiceItem = {
  name: string;
  description: string;
  price: number;
  quantity: number;
};

export type Invoice = {
  id: string;
  number: string;
  user_id: string;
  total: number;
  subtotal: number;
  discount: number;
  status: "paid" | "open" | "void";
  paid_at: string | null;
  created_at: string;
  items: InvoiceItem[];
};

export type ContactMessage = {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  topic: string | null;
  created_at: string;
};

/** Operator-console directory row (no password material). */
export type AdminClientAccountStatus = "lead" | "active" | "churned";

export type AdminClientSummary = {
  id: string;
  email: string;
  full_name: string;
  plan: AuthUser["plan"];
  email_verified: boolean;
  created_at: string;
  /** ISO timestamp from auth/session activity; null if never recorded. */
  last_seen_at: string | null;
  google_linked: boolean;
  apps_count: number;
  builds_count: number;
  active_subscriptions: number;
  lifetime_revenue: number;
  account_status: AdminClientAccountStatus;
};

export type AdminClientAppRow = {
  id: string;
  name: string;
  package_name: string;
  status: AppStatus;
  created_at: string;
};

export type AdminClientBuildRow = {
  id: string;
  app_id: string;
  version_name: string;
  version_code: number;
  status: ApkBuild["status"];
  build_started_at: string;
  build_completed_at: string | null;
};

export type AdminClientDetail = {
  summary: AdminClientSummary;
  profile: AuthUser;
  apps: AdminClientAppRow[];
  builds: AdminClientBuildRow[];
  subscriptions: Subscription[];
  payments: Payment[];
  invoices: Invoice[];
  cart: { items_count: number; promo_code: string | null };
  contact_messages: ContactMessage[];
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

function minuteKeyUtc(ts: number): string {
  return new Date(ts).toISOString().slice(0, 16);
}

function hourKeyUtc(ts: number): string {
  return new Date(ts).toISOString().slice(0, 13);
}

function dayKeyUtc(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function utcDayStartMs(ts: number): number {
  const x = new Date(ts);
  return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
}

/** Canonical site URL for de-duping WP installs (matches PHP apkzio_normalize_site_url). */
function normalizeWpSiteUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    const host = u.hostname.toLowerCase();
    u.hash = "";
    let pathname = u.pathname || "/";
    if (pathname !== "/" && pathname.endsWith("/")) pathname = pathname.slice(0, -1);
    return `${u.protocol}//${host}${pathname === "/" ? "" : pathname}`;
  } catch {
    return raw.trim().toLowerCase();
  }
}

export class ApkZioStore {
  readonly demoServiceKey: string;
  private readonly keysByHash = new Map<string, string>(); // sha256 hex -> raw key
  private readonly useDatabase: boolean;

  // Legacy in-memory storage (kept for backward compatibility during migration)
  apps = new Map<string, AndroidApp>();
  devices = new Map<string, Device>();
  subscribers = new Map<string, StoredSubscriber>();
  /** device_id → subscriber_id (latest) */
  deviceSubscriber = new Map<string, string>();
  campaigns: Campaign[] = [];
  apiKeys: ApiKey[] = [];
  builds: ApkBuild[] = [];
  /** Analytics events storage */
  analyticsEvents: Array<{
    id: number;
    app_id: string;
    event_type: string;
    event_data: Record<string, any> | null;
    device_id: string;
    country_code: string | null;
    timestamp: string;
  }> = [];
  private eventIdCounter = 1;
  /**
   * Real per-build log lines, written by the WebView runner. Seed builds don't
   * have an entry here — we fall back to `synthesizeBuildLogs` for them so the
   * dashboard's logs panel keeps working.
   */
  private buildLogs = new Map<string, string[]>();

  /** WordPress plugin catalog */
  wpPlugins = new Map<string, WpPlugin>();
  /** Site installs (one row per connected WP site) */
  private wpSites = new Map<string, WpSiteInstallRow>();
  /** site_id → minute ISO key "YYYY-MM-DDTHH:MM" (UTC) → aggregates */
  private wpTrafficMinute = new Map<string, Map<string, WpTrafficBucket>>();
  /** site_id → hour key "YYYY-MM-DDTHH" */
  private wpTrafficHour = new Map<string, Map<string, WpTrafficBucket>>();
  /** site_id → day key "YYYY-MM-DD" */
  private wpTrafficDay = new Map<string, Map<string, WpTrafficBucket>>();

  // --- Customer-scoped collections (keyed by user_id) ---

  users = new Map<string, StoredUser>();
  usersByEmail = new Map<string, string>();
  /** Firebase Google UID → user id */
  private usersByGoogleUid = new Map<string, string>();
  /** user_id → array of app_ids the user owns. */
  userApps = new Map<string, string[]>();
  /** user_id → cart */
  userCarts = new Map<string, Cart>();
  userSubscriptions = new Map<string, Subscription[]>();
  userPayments = new Map<string, Payment[]>();
  userInvoices = new Map<string, Invoice[]>();
  private userPushTokens = new Map<string, Set<string>>();
  contactMessages: ContactMessage[] = [];
  private invoiceCounter = 1000;

  constructor(demoServiceKey: string, useDatabase = false) {
    this.demoServiceKey = demoServiceKey;
    this.useDatabase = useDatabase;
    if (!useDatabase) {
      this.seed();
    }
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
      });
    }

    // Sample crashes
    const CRASH_TYPES = ["NullPointerException", "OutOfMemoryError", "NetworkException", "IllegalStateException"];
    for (const app of ownerApps) {
      const crashCount = Math.floor(5 + r() * 15);
      for (let i = 0; i < crashCount; i++) {
        const crashType = CRASH_TYPES[Math.floor(r() * CRASH_TYPES.length)]!;
        this.crashes.push({
          id: uuid(),
          app_id: app.id,
          device_id: null,
          crash_type: crashType,
          stack_trace: `java.lang.${crashType}\n  at com.example.MainActivity.onCreate(MainActivity.java:42)\n  at android.app.Activity.performCreate(Activity.java:8000)`,
          app_version: "2.4.1",
          os_version: "14",
          manufacturer: MANUFACTURERS[Math.floor(r() * MANUFACTURERS.length)]!,
          model: "Pixel 8",
          metadata: {},
          created_at: minutesAgoIso(r, 0, 60 * 24 * 7),
        });
      }
    }

    // Sample campaign errors for campaigns with failures
    const FCM_ERROR_CODES = [
      { code: "UNREGISTERED", message: "Token no longer valid; subscriber removed.", weight: 0.6 },
      { code: "INVALID_ARGUMENT", message: "Token format rejected by FCM.", weight: 0.2 },
      { code: "QUOTA_EXCEEDED", message: "Project send quota hit; retried with backoff.", weight: 0.12 },
      { code: "UNAVAILABLE", message: "FCM transient unavailability.", weight: 0.08 },
    ];
    for (const campaign of this.campaigns) {
      if (campaign.failed_count > 0) {
        let remaining = campaign.failed_count;
        for (const errorSpec of FCM_ERROR_CODES) {
          const count = Math.floor(campaign.failed_count * errorSpec.weight);
          for (let i = 0; i < count && remaining > 0; i++) {
            this.campaignErrors.push({
              id: uuid(),
              campaign_id: campaign.id,
              error_code: errorSpec.code,
              error_message: errorSpec.message,
              subscriber_id: null,
              device_info: {},
              created_at: campaign.sent_at ?? campaign.created_at,
            });
            remaining--;
          }
        }
      }
    }

    this.seedWpData();
  }

  private seedWpData(): void {
    const pluginsSeed: WpPlugin[] = [
      {
        id: uuid(),
        slug: "apkzio-web-push",
        name: "ApkZio Web Push",
        latest_version: "2.1.0",
        description: "Web push subscriptions and engagement for WordPress.",
      },
      {
        id: uuid(),
        slug: "apkzio-analytics-lite",
        name: "ApkZio Analytics Lite",
        latest_version: "1.4.2",
        description: "Lightweight traffic and conversion signals.",
      },
      {
        id: uuid(),
        slug: "apkzio-engage",
        name: "ApkZio Engage",
        latest_version: "0.9.8",
        description: "On-site messaging and prompts.",
      },
    ];
    for (const p of pluginsSeed) this.wpPlugins.set(p.id, p);

    const sitesPerPlugin = [6, 5, 4];
    const domains = [
      "https://shop.example.com",
      "https://news.example.org",
      "https://blog.acme.test",
      "https://learn.wpexample.io",
      "https://storefront.demo",
      "https://members.clubhouse.test",
      "https://portal.health-demo.com",
      "https://magazine.publisher.test",
      "https://courses.edu-sample.net",
      "https://community.forum-demo.io",
      "https://app.saas-mock.dev",
      "https://docs.readme-mock.dev",
      "https://checkout.commerce-mock.shop",
      "https://landing.campaign-mock.com",
      "https://support.helpdesk-mock.net",
    ];

    let di = 0;
    for (let pi = 0; pi < pluginsSeed.length; pi++) {
      const plugin = pluginsSeed[pi]!;
      const n = sitesPerPlugin[pi] ?? 4;
      const r = mulberry32(hash32(`wp-site-${plugin.id}`));
      for (let i = 0; i < n; i++) {
        const siteId = uuid();
        const site_url = domains[di % domains.length]!;
        di++;
        const tokenPlain = `wpt_local_${siteId}`;
        const row: WpSiteInstallRow = {
          id: siteId,
          plugin_id: plugin.id,
          site_url,
          wp_version: ["6.4", "6.5", "6.6", "6.7"][Math.floor(r() * 4)]!,
          plugin_version: plugin.latest_version,
          created_at: daysAgoIso(r, 5, 400),
          last_seen_at: minutesAgoIso(r, 2, 45),
          subscribers_total: Math.floor(200 + r() * 8000),
          site_token_hash: sha256hex(tokenPlain),
        };
        this.wpSites.set(row.id, row);
        this.ensureWpTrafficMaps(row.id);

        const now = Date.now();
        for (let m = 59; m >= 0; m--) {
          const t = now - m * 60_000;
          const pv = Math.floor(5 + r() * 120);
          const u = Math.floor(2 + r() * (pv * 0.6));
          this.bumpWpTraffic(row.id, t, pv, u);
        }
        for (let h = 1; h <= 168; h++) {
          const t = now - h * 3600_000;
          const pv = Math.floor(50 + r() * 2000);
          const u = Math.floor(20 + r() * (pv * 0.5));
          this.bumpWpTraffic(row.id, t, pv, u);
        }
        for (let d = 0; d < 30; d++) {
          const t = now - d * dayMs;
          const pv = Math.floor(800 + r() * 25_000);
          const u = Math.floor(300 + r() * (pv * 0.45));
          this.bumpWpTraffic(row.id, t, pv, u);
        }
      }
    }
  }

  private ensureWpTrafficMaps(siteId: string): void {
    if (!this.wpTrafficMinute.has(siteId)) this.wpTrafficMinute.set(siteId, new Map());
    if (!this.wpTrafficHour.has(siteId)) this.wpTrafficHour.set(siteId, new Map());
    if (!this.wpTrafficDay.has(siteId)) this.wpTrafficDay.set(siteId, new Map());
  }

  private bumpWpTraffic(siteId: string, atMs: number, dPv: number, dU: number): void {
    this.ensureWpTrafficMaps(siteId);
    const mk = minuteKeyUtc(atMs);
    const hk = hourKeyUtc(atMs);
    const dk = dayKeyUtc(atMs);
    const merge = (map: Map<string, WpTrafficBucket>, key: string) => {
      const cur = map.get(key) ?? { pageviews: 0, uniques: 0 };
      cur.pageviews += dPv;
      cur.uniques += dU;
      map.set(key, cur);
    };
    merge(this.wpTrafficMinute.get(siteId)!, mk);
    merge(this.wpTrafficHour.get(siteId)!, hk);
    merge(this.wpTrafficDay.get(siteId)!, dk);
  }

  listWpPlugins(): WpPlugin[] {
    return [...this.wpPlugins.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  getWpPlugin(id: string): WpPlugin | undefined {
    return this.wpPlugins.get(id);
  }

  wpSiteToPublic(row: WpSiteInstallRow): WpSiteInstall {
    const { site_token_hash: _, ...pub } = row;
    return pub;
  }

  listWpSitesForPlugin(pluginId: string): WpSiteInstallRow[] {
    return [...this.wpSites.values()].filter((s) => s.plugin_id === pluginId);
  }

  findWpSiteById(siteId: string): WpSiteInstallRow | undefined {
    return this.wpSites.get(siteId);
  }

  verifyWpSiteToken(siteId: string, tokenPlain: string): WpSiteInstallRow | undefined {
    const row = this.wpSites.get(siteId);
    if (!row) return undefined;
    const h = sha256hex(tokenPlain);
    if (h !== row.site_token_hash) return undefined;
    return row;
  }

  /** Register a new WP site; returns plaintext token once (caller must persist). Same plugin + normalized URL reconnects (rotates token, same site id). */
  registerWpSite(input: {
    plugin_id: string;
    site_url: string;
    wp_version?: string;
    plugin_version?: string;
  }): { site: WpSiteInstall; site_token: string } {
    const plugin = this.wpPlugins.get(input.plugin_id);
    if (!plugin) throw new Error("plugin_not_found");
    const url = String(input.site_url ?? "").trim();
    if (!url || !/^https?:\/\//i.test(url)) throw new Error("invalid_site_url");
    const norm = normalizeWpSiteUrl(url);
    const site_token = `wpt_${crypto.randomBytes(28).toString("hex")}`;
    const existing = [...this.wpSites.values()].find(
      (s) => s.plugin_id === plugin.id && normalizeWpSiteUrl(s.site_url) === norm,
    );
    if (existing) {
      existing.site_token_hash = sha256hex(site_token);
      existing.last_seen_at = isoNow();
      existing.site_url = url;
      if (typeof input.wp_version === "string" && input.wp_version.trim()) {
        existing.wp_version = input.wp_version.trim().slice(0, 32);
      }
      if (typeof input.plugin_version === "string" && input.plugin_version.trim()) {
        existing.plugin_version = input.plugin_version.trim().slice(0, 32);
      }
      return { site: this.wpSiteToPublic(existing), site_token };
    }
    const siteId = uuid();
    const row: WpSiteInstallRow = {
      id: siteId,
      plugin_id: plugin.id,
      site_url: url,
      wp_version: (input.wp_version ?? "0.0.0").slice(0, 32),
      plugin_version: (input.plugin_version ?? plugin.latest_version).slice(0, 32),
      created_at: isoNow(),
      last_seen_at: isoNow(),
      subscribers_total: 0,
      site_token_hash: sha256hex(site_token),
    };
    this.wpSites.set(row.id, row);
    this.ensureWpTrafficMaps(row.id);
    return { site: this.wpSiteToPublic(row), site_token };
  }

  ingestWpTelemetry(
    siteId: string,
    tokenPlain: string,
    body: {
      wp_version?: string;
      plugin_version?: string;
      pageviews_delta: number;
      uniques_delta: number;
      subscribers_total: number;
    },
  ): WpSiteInstall {
    const row = this.verifyWpSiteToken(siteId, tokenPlain);
    if (!row) throw new Error("unauthorized");
    const now = Date.now();
    if (typeof body.wp_version === "string" && body.wp_version.trim()) {
      row.wp_version = body.wp_version.trim().slice(0, 32);
    }
    if (typeof body.plugin_version === "string" && body.plugin_version.trim()) {
      row.plugin_version = body.plugin_version.trim().slice(0, 32);
    }
    row.last_seen_at = isoNow();
    row.subscribers_total = Math.max(0, Math.floor(body.subscribers_total));
    const dPv = Math.max(0, Math.floor(body.pageviews_delta));
    const dU = Math.max(0, Math.floor(body.uniques_delta));
    if (dPv > 0 || dU > 0) this.bumpWpTraffic(row.id, now, dPv, dU);
    return this.wpSiteToPublic(row);
  }

  /** Merge per-site buckets into a single time series (sums pageviews as `v`). */
  wpAggregatedSeries(
    pluginId: string,
    range: WpPluginRange,
    metric: "pageviews" | "uniques",
  ): Point[] {
    const sites = this.listWpSitesForPlugin(pluginId);
    const field = metric === "pageviews" ? "pageviews" : "uniques";
    const merged = new Map<number, number>();

    const now = Date.now();
    if (range === "rt") {
      for (let m = 59; m >= 0; m--) {
        const t = now - m * 60_000;
        const mk = minuteKeyUtc(t);
        let sum = 0;
        for (const s of sites) {
          const sm = this.wpTrafficMinute.get(s.id);
          sum += sm?.get(mk)?.[field] ?? 0;
        }
        merged.set(Math.floor(t / 60_000) * 60_000, sum);
      }
    } else if (range === "d") {
      for (let h = 23; h >= 0; h--) {
        const t = now - h * 3600_000;
        const hk = hourKeyUtc(t);
        let sum = 0;
        for (const s of sites) {
          sum += this.wpTrafficHour.get(s.id)?.get(hk)?.[field] ?? 0;
        }
        merged.set(Math.floor(t / 3600_000) * 3600_000, sum);
      }
    } else if (range === "w") {
      const day0 = utcDayStartMs(now);
      for (let d = 6; d >= 0; d--) {
        const t = day0 - d * dayMs;
        const dk = dayKeyUtc(t);
        let sum = 0;
        for (const s of sites) {
          sum += this.wpTrafficDay.get(s.id)?.get(dk)?.[field] ?? 0;
        }
        merged.set(t, sum);
      }
    } else {
      const day0 = utcDayStartMs(now);
      for (let d = 29; d >= 0; d--) {
        const t = day0 - d * dayMs;
        const dk = dayKeyUtc(t);
        let sum = 0;
        for (const s of sites) {
          sum += this.wpTrafficDay.get(s.id)?.get(dk)?.[field] ?? 0;
        }
        merged.set(t, sum);
      }
    }

    return [...merged.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([t, v]) => ({ t, v }));
  }

  wpSiteSparkline(siteId: string, points = 24): Point[] {
    const now = Date.now();
    const out: Point[] = [];
    for (let i = points - 1; i >= 0; i--) {
      const t = now - i * 3600_000;
      const hk = hourKeyUtc(t);
      const v = this.wpTrafficHour.get(siteId)?.get(hk)?.pageviews ?? 0;
      out.push({ t: Math.floor(t / 3600_000) * 3600_000, v });
    }
    return out;
  }

  wpRollupTotals(pluginId: string, range: WpPluginRange): {
    pageviews: number;
    uniques: number;
    subscribers: number;
    active_sites: number;
    installs: number;
  } {
    const sites = this.listWpSitesForPlugin(pluginId);
    const seriesPv = this.wpAggregatedSeries(pluginId, range, "pageviews");
    const seriesU = this.wpAggregatedSeries(pluginId, range, "uniques");
    const pageviews = seriesPv.reduce((s, p) => s + p.v, 0);
    const uniques = seriesU.reduce((s, p) => s + p.v, 0);
    const subscribers = sites.reduce((s, x) => s + x.subscribers_total, 0);
    const staleMin = range === "rt" ? 60 : range === "d" ? 24 * 60 : 7 * 24 * 60;
    const active = sites.filter((s) => minutesSince(s.last_seen_at) <= staleMin).length;
    return {
      pageviews,
      uniques,
      subscribers,
      active_sites: active,
      installs: sites.length,
    };
  }

  findAppByKey(appKey: string): AndroidApp | undefined {
    // Always use in-memory cache for synchronous lookup
    // Database apps are cached on load
    return [...this.apps.values()].find((a) => a.app_key === appKey);
  }

  validateServiceKey(key: string): boolean {
    return this.keysByHash.has(sha256hex(key));
  }

  touchApiKey(): void {
    const k = this.apiKeys[0];
    if (k) k.last_used_at = isoNow();
  }

  async listApps(): Promise<AndroidApp[]> {
    if (!this.useDatabase) {
      return [...this.apps.values()];
    }

    const { rows } = await query<AndroidApp>(`
      SELECT 
        id, owner_id, name, package_name, app_key, icon_glyph, icon_color,
        status, fcm_project_id, live_users, active_devices_24h, total_installs,
        delivery_rate::float as delivery_rate, 
        0 as open_rate,
        0 as total_pushes_sent,
        created_at
      FROM android_apps 
      ORDER BY created_at DESC
    `);
    return rows;
  }

  async getDevicesForApp(appId: string): Promise<Device[]> {
    if (!this.useDatabase) {
      return [...this.devices.values()].filter((d) => d.app_id === appId).sort((a, b) => +new Date(b.last_seen_at) - +new Date(a.last_seen_at));
    }

    const { rows } = await query<Device>(`
      SELECT 
        id, app_id, install_hash, manufacturer, model, os_version, app_version,
        country_code, is_active, last_seen_at, 
        created_at as first_seen_at
      FROM devices
      WHERE app_id = $1
      ORDER BY last_seen_at DESC
    `, [appId]);
    return rows;
  }

  async getSubscribersForApp(appId: string): Promise<Subscriber[]> {
    if (!this.useDatabase) {
      return [...this.subscribers.values()]
        .filter((s) => s.app_id === appId)
        .map(({ _fcm_token: _, ...rest }) => rest);
    }

    const { rows } = await query<Subscriber>(`
      SELECT 
        id, app_id, fcm_token as device_id, fcm_token_redacted, is_valid, last_seen_at
      FROM push_subscribers
      WHERE app_id = $1
      ORDER BY last_seen_at DESC
    `, [appId]);
    return rows;
  }

  async updateSubscriberValidity(id: string, isValid: boolean): Promise<Subscriber> {
    if (!this.useDatabase) {
      const sub = this.subscribers.get(id);
      if (!sub) throw new Error("not_found");
      sub.is_valid = isValid;
      sub.last_seen_at = isoNow();
      const { _fcm_token: _, ...publicSub } = sub;
      return publicSub;
    }

    const { rows } = await query<Subscriber>(`
      UPDATE push_subscribers
      SET is_valid = $1, last_seen_at = NOW()
      WHERE id = $2
      RETURNING id, app_id, fcm_token as device_id, fcm_token_redacted, is_valid, last_seen_at
    `, [isValid, id]);

    if (rows.length === 0) throw new Error("not_found");
    return rows[0]!;
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

  resolveFcmTokens(
    appId: string,
    target: {
      type: "all" | "active" | "country" | "device_list";
      active_within_minutes?: number;
      country_codes?: string[];
      device_ids?: string[];
    },
  ): string[] {
    const matched = this.matchSubscribers(appId, target);
    return matched
      .map((s) => String(s._fcm_token ?? "").trim())
      .filter((t) => t.length >= 20 && !t.startsWith("placeholder-") && !t.startsWith("rot-"));
  }

  addUserPushToken(userId: string, token: string): void {
    const t = String(token ?? "").trim();
    if (t.length < 20) return;
    const set = this.userPushTokens.get(userId) ?? new Set<string>();
    set.add(t);
    this.userPushTokens.set(userId, set);
  }

  listUserPushTokens(userId: string): string[] {
    return [...(this.userPushTokens.get(userId) ?? new Set<string>())];
  }

  recalcAppMetrics(appId: string): void {
    const app = this.apps.get(appId);
    if (!app) return;
    void (async () => {
      const devs = await this.getDevicesForApp(appId);
      const now = Date.now();
      const dayMs = 86400_000;
      const fiveMin = 5 * 60_000;
      app.total_installs = devs.length;
      app.active_devices_24h = devs.filter((d) => now - +new Date(d.last_seen_at) <= dayMs).length;
      app.live_users = devs.filter((d) => now - +new Date(d.last_seen_at) <= fiveMin).length;
    })();
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
    if (app && app.status !== "active") throw new Error("app_suspended");

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

  /**
   * Insert analytics events in batch
   */
  insertEvents(events: Array<{
    app_id: string;
    event_type: string;
    device_id: string;
    country_code?: string;
    event_data?: Record<string, any>;
    timestamp?: string;
  }>): void {
    const now = new Date().toISOString();
    for (const event of events) {
      this.analyticsEvents.push({
        id: this.eventIdCounter++,
        app_id: event.app_id,
        event_type: event.event_type,
        event_data: event.event_data ?? null,
        device_id: event.device_id,
        country_code: event.country_code ?? null,
        timestamp: event.timestamp ?? now,
      });
    }
  }

  /**
   * Get event counts for an app grouped by time
   * Returns array of counts for the specified time range
   */
  getEventCounts(
    appId: string,
    eventType: string,
    range: 'hour' | 'day' | 'week' | 'month'
  ): number[] {
    const now = new Date();
    const filtered = this.analyticsEvents.filter(
      (e) => e.app_id === appId && e.event_type === eventType
    );

    // Determine time buckets based on range
    let buckets: number[];
    let bucketSize: number;
    let bucketCount: number;

    switch (range) {
      case 'hour':
        bucketCount = 12; // 12x5min buckets
        bucketSize = 5 * 60 * 1000; // 5 minutes in ms
        break;
      case 'day':
        bucketCount = 24; // 24 hours
        bucketSize = 60 * 60 * 1000; // 1 hour in ms
        break;
      case 'week':
        bucketCount = 7; // 7 days
        bucketSize = 24 * 60 * 60 * 1000; // 1 day in ms
        break;
      case 'month':
        bucketCount = 30; // 30 days
        bucketSize = 24 * 60 * 60 * 1000; // 1 day in ms
        break;
      default:
        bucketCount = 24;
        bucketSize = 60 * 60 * 1000;
    }

    buckets = new Array(bucketCount).fill(0);
    const startTime = now.getTime() - (bucketCount * bucketSize);

    for (const event of filtered) {
      const eventTime = new Date(event.timestamp).getTime();
      if (eventTime >= startTime) {
        const bucketIndex = Math.floor((eventTime - startTime) / bucketSize);
        if (bucketIndex >= 0 && bucketIndex < bucketCount) {
          buckets[bucketIndex]++;
        }
      }
    }

    return buckets;
  }

  /**
   * Get total event count for an app and event type
   */
  getEventCount(appId: string, eventType: string): number {
    return this.analyticsEvents.filter(
      (e) => e.app_id === appId && e.event_type === eventType
    ).length;
  }

  /**
   * Get unique device count for an app and event type
   */
  getUniqueDeviceCount(appId: string, eventType: string): number {
    const devices = new Set<string>();
    for (const event of this.analyticsEvents) {
      if (event.app_id === appId && event.event_type === eventType) {
        devices.add(event.device_id);
      }
    }
    return devices.size;
  }

  async createCampaign(input: {
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
  }): Promise<Campaign> {
    if (!this.useDatabase) {
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
        active_within_minutes: input.active_within_minutes,
        country_codes: input.target_type === "country" ? input.country_codes ?? [] : undefined,
        device_ids: input.target_type === "device_list" ? input.device_ids ?? [] : undefined,
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

    let target_summary = "";
    if (input.target_type === "all") target_summary = "All subscribers";
    else if (input.target_type === "active")
      target_summary = `Active in last ${(input.active_within_minutes ?? 1440) >= 1440 ? `${Math.round((input.active_within_minutes ?? 1440) / 1440)}d` : `${input.active_within_minutes}m`}`;
    else if (input.target_type === "country") target_summary = (input.country_codes ?? []).join(", ");
    else target_summary = `${(input.device_ids ?? []).length} devices`;

    const isScheduled = !!input.scheduled_at && +new Date(input.scheduled_at) > Date.now();
    const status = isScheduled ? "scheduled" : "draft";

    const { rows } = await query<Campaign>(`
      INSERT INTO push_campaigns (
        app_id, title, body, image_url, click_url, status,
        target_type, active_within_minutes, country_codes, device_ids, target_summary,
        scheduled_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      input.app_id,
      input.title,
      input.body,
      input.image_url ?? null,
      input.click_url ?? null,
      status,
      input.target_type,
      input.active_within_minutes ?? null,
      input.country_codes ?? null,
      input.device_ids ?? null,
      target_summary,
      input.scheduled_at ?? null
    ]);

    return rows[0]!;
  }

  // --- Apps CRUD ---

  async createApp(input: {
    name: string;
    package_name: string;
    fcm_project_id?: string | null;
    icon_glyph?: string;
    icon_color?: string;
    owner_id?: string;
  }): Promise<AndroidApp> {
    const name = (input.name ?? "").trim();
    const pkg = (input.package_name ?? "").trim();
    if (!name) throw new Error("name_required");
    if (!pkg) throw new Error("package_name_required");
    const glyph = (input.icon_glyph ?? deriveGlyph(name)).slice(0, 4).toUpperCase();
    const ownerId = input.owner_id ?? "default-owner";
    
    if (!this.useDatabase) {
      const app: AndroidApp = {
        id: uuid(),
        name,
        package_name: pkg,
        app_key: `pk_${crypto.randomBytes(24).toString("hex")}`,
        status: "active",
        icon_color: input.icon_color ?? "from-emerald-500/20 to-emerald-500/5",
        icon_glyph: glyph,
        total_installs: 0,
        active_devices_24h: 0,
        live_users: 0,
        total_pushes_sent: 0,
        delivery_rate: 0,
        open_rate: 0,
        created_at: isoNow(),
        fcm_project_id: input.fcm_project_id ?? null,
      };
      this.apps.set(app.id, app);
      return app;
    }

    const appKey = `pk_${crypto.randomBytes(24).toString("hex")}`;
    const { rows } = await query<AndroidApp>(`
      INSERT INTO android_apps (
        owner_id, name, package_name, app_key, icon_glyph, icon_color, 
        status, fcm_project_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)
      RETURNING 
        id, owner_id, name, package_name, app_key, icon_glyph, icon_color,
        status, fcm_project_id, live_users, active_devices_24h, total_installs,
        delivery_rate::float as delivery_rate,
        0 as open_rate,
        0 as total_pushes_sent,
        created_at
    `, [
      ownerId,
      name,
      pkg,
      appKey,
      glyph,
      input.icon_color ?? "from-emerald-500/20 to-emerald-500/5",
      input.fcm_project_id ?? null
    ]);
    return rows[0]!;
  }

  async updateApp(id: string, patch: {
    name?: string;
    status?: AppStatus;
    fcm_project_id?: string | null;
    icon_glyph?: string;
    icon_color?: string;
  }): Promise<AndroidApp> {
    if (!this.useDatabase) {
      const a = this.apps.get(id);
      if (!a) throw new Error("not_found");
      if (typeof patch.name === "string" && patch.name.trim()) a.name = patch.name.trim();
      if (patch.status === "active" || patch.status === "paused" || patch.status === "suspended") {
        a.status = patch.status;
      }
      if (patch.fcm_project_id !== undefined) a.fcm_project_id = patch.fcm_project_id;
      if (typeof patch.icon_glyph === "string" && patch.icon_glyph.trim()) {
        a.icon_glyph = patch.icon_glyph.slice(0, 4).toUpperCase();
      }
      if (typeof patch.icon_color === "string" && patch.icon_color.trim()) {
        a.icon_color = patch.icon_color;
      }
      return a;
    }

    const updates: string[] = [];
    const values: any[] = [id];
    let paramIndex = 2;

    if (typeof patch.name === "string" && patch.name.trim()) {
      updates.push(`name = $${paramIndex++}`);
      values.push(patch.name.trim());
    }
    if (patch.status) {
      updates.push(`status = $${paramIndex++}`);
      values.push(patch.status);
    }
    if (patch.fcm_project_id !== undefined) {
      updates.push(`fcm_project_id = $${paramIndex++}`);
      values.push(patch.fcm_project_id);
    }
    if (typeof patch.icon_glyph === "string" && patch.icon_glyph.trim()) {
      updates.push(`icon_glyph = $${paramIndex++}`);
      values.push(patch.icon_glyph.slice(0, 4).toUpperCase());
    }
    if (typeof patch.icon_color === "string" && patch.icon_color.trim()) {
      updates.push(`icon_color = $${paramIndex++}`);
      values.push(patch.icon_color);
    }

    if (updates.length === 0) {
      // No updates, just return current app
      const { rows } = await query<AndroidApp>(
        'SELECT *, delivery_rate::float as delivery_rate, 0 as open_rate, 0 as total_pushes_sent FROM android_apps WHERE id = $1',
        [id]
      );
      if (rows.length === 0) throw new Error("not_found");
      return rows[0]!;
    }

    const { rows } = await query<AndroidApp>(`
      UPDATE android_apps 
      SET ${updates.join(', ')} 
      WHERE id = $1 
      RETURNING *, delivery_rate::float as delivery_rate, 0 as open_rate, 0 as total_pushes_sent
    `, values);

    if (rows.length === 0) throw new Error("not_found");
    return rows[0]!;
  }

  async deleteApp(id: string): Promise<boolean> {
    if (!this.useDatabase) {
      if (!this.apps.has(id)) return false;
      for (const [did, dev] of [...this.devices.entries()]) {
        if (dev.app_id === id) {
          const sid = this.deviceSubscriber.get(did);
          if (sid) {
            this.subscribers.delete(sid);
            this.deviceSubscriber.delete(did);
          }
          this.devices.delete(did);
        }
      }
      for (const [sid, sub] of [...this.subscribers.entries()]) {
        if (sub.app_id === id) {
          this.subscribers.delete(sid);
          this.deviceSubscriber.delete(sub.device_id);
        }
      }
      this.campaigns = this.campaigns.filter((c) => c.app_id !== id);
      this.apiKeys = this.apiKeys.filter((k) => k.app_id !== id);
      this.builds = this.builds.filter((b) => b.app_id !== id);
      this.apps.delete(id);
      return true;
    }

    const { rowCount } = await query('DELETE FROM android_apps WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  }

  // --- API keys ---

  async createApiKey(input: {
    app_id: string;
    name: string;
    scopes: string[];
    rate_limit_rpm: number;
    expires_at?: string | null;
    environment?: "live" | "test";
  }): Promise<{ api_key: ApiKey; secret: string }> {
    const env = input.environment === "test" ? "test" : "live";
    const prefix = env === "test" ? "sk_test_" : "sk_live_";
    const random = crypto.randomBytes(16).toString("hex");
    const secret = `${prefix}${random}`;
    const preview = `${prefix}${random.slice(0, 4)}…${random.slice(-5)}`;
    const keyHash = sha256hex(secret);

    if (!this.useDatabase) {
      if (!this.apps.has(input.app_id)) throw new Error("app_not_found");
      this.keysByHash.set(keyHash, secret);
      const apiKey: ApiKey = {
        id: uuid(),
        app_id: input.app_id,
        name: (input.name ?? "").trim() || "untitled-key",
        key_preview: preview,
        scopes: Array.isArray(input.scopes) ? input.scopes.map((s) => String(s)) : [],
        rate_limit_rpm: Number.isFinite(input.rate_limit_rpm) ? Math.max(1, Math.floor(input.rate_limit_rpm)) : 600,
        is_active: true,
        last_used_at: null,
        expires_at: input.expires_at ?? null,
        created_at: isoNow(),
      };
      this.apiKeys.push(apiKey);
      return { api_key: apiKey, secret };
    }

    const { rows } = await query<ApiKey>(`
      INSERT INTO api_keys (
        app_id, name, key_hash, key_preview, scopes, rate_limit_rpm, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      input.app_id,
      (input.name ?? "").trim() || "untitled-key",
      keyHash,
      preview,
      input.scopes,
      Number.isFinite(input.rate_limit_rpm) ? Math.max(1, Math.floor(input.rate_limit_rpm)) : 600,
      input.expires_at ?? null
    ]);

    this.keysByHash.set(keyHash, secret);
    return { api_key: rows[0]!, secret };
  }

  updateApiKey(id: string, patch: {
    is_active?: boolean;
    name?: string;
    scopes?: string[];
    rate_limit_rpm?: number;
    expires_at?: string | null;
  }): ApiKey {
    const k = this.apiKeys.find((x) => x.id === id);
    if (!k) throw new Error("not_found");
    if (typeof patch.is_active === "boolean") k.is_active = patch.is_active;
    if (typeof patch.name === "string" && patch.name.trim()) k.name = patch.name.trim();
    if (Array.isArray(patch.scopes)) k.scopes = patch.scopes.map((s) => String(s));
    if (typeof patch.rate_limit_rpm === "number" && Number.isFinite(patch.rate_limit_rpm)) {
      k.rate_limit_rpm = Math.max(1, Math.floor(patch.rate_limit_rpm));
    }
    if (patch.expires_at !== undefined) k.expires_at = patch.expires_at;
    return k;
  }

  /**
   * Revoke an API key. We keep the row in `apiKeys` (only flipping is_active=false)
   * to preserve audit/list history rather than hard-deleting.
   */
  async revokeApiKey(id: string): Promise<ApiKey> {
    if (!this.useDatabase) {
      const k = this.apiKeys.find((x) => x.id === id);
      if (!k) throw new Error("not_found");
      k.is_active = false;
      return k;
    }

    const { rows } = await query<ApiKey>(`
      UPDATE api_keys
      SET is_active = false
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (rows.length === 0) throw new Error("not_found");
    return rows[0]!;
  }

  // --- Builds ---

  async createBuild(input: {
    app_id: string;
    version_code: number;
    version_name: string;
    branch?: string;
    release_notes?: string;
    /**
     * Partial WebView config supplied by the dashboard. The runner fills in
     * defaults from the parent app row before storing the resolved config
     * back on the build via `setBuildResult`.
     */
    config?: Partial<WebViewBuildConfig> | null;
    /** Optional owner — set by the public builder bridge. */
    user_id?: string;
    /** Override the "triggered_by" attribution string. */
    triggered_by?: string;
  }): Promise<ApkBuild> {
    const versionCode = Number(input.version_code);
    const versionName = String(input.version_name ?? "").trim();
    if (!Number.isFinite(versionCode) || versionCode <= 0) throw new Error("invalid_version_code");
    if (!versionName) throw new Error("invalid_version_name");

    if (!this.useDatabase) {
      if (!this.apps.has(input.app_id)) throw new Error("app_not_found");
      const startedAt = isoNow();
      const build: ApkBuild = {
        id: uuid(),
        app_id: input.app_id,
        version_code: Math.floor(versionCode),
        version_name: versionName,
        status: "queued",
        build_started_at: startedAt,
        build_completed_at: null,
        size_bytes: null,
        output_url: null,
        duration_ms: null,
        triggered_by: input.triggered_by ?? "dashboard",
        source_zip_url: null,
        config: (input.config as WebViewBuildConfig | null | undefined) ?? null,
        logs_count: 0,
        user_id: input.user_id,
      };
      this.builds.unshift(build);
      this.buildLogs.set(build.id, []);
      return build;
    }

    const { rows } = await query<ApkBuild>(`
      INSERT INTO apk_builds (
        app_id, version_name, version_code, status, config, build_started_at
      )
      VALUES ($1, $2, $3, 'queued', $4, NOW())
      RETURNING *
    `, [
      input.app_id,
      versionName,
      Math.floor(versionCode),
      input.config ? JSON.stringify(input.config) : null
    ]);

    return rows[0]!;
  }

  getBuildById(id: string): ApkBuild | undefined {
    return this.builds.find((x) => x.id === id);
  }

  /** Drive a status transition. No-op when the build isn't found. */
  setBuildStatus(id: string, status: ApkBuild["status"]): void {
    const b = this.getBuildById(id);
    if (!b) return;
    b.status = status;
  }

  /**
   * Patch a build with end-of-pipeline results (success or failure). Caller
   * supplies a partial — we only mutate keys that are present so we can't
   * accidentally null a successful build's `output_url`.
   */
  setBuildResult(id: string, patch: Partial<ApkBuild>): void {
    const b = this.getBuildById(id);
    if (!b) return;
    for (const [k, v] of Object.entries(patch) as Array<[keyof ApkBuild, unknown]>) {
      if (v === undefined) continue;
      (b as Record<string, unknown>)[k] = v;
    }
  }

  /** Append a real log line emitted by the WebView build runner. */
  appendBuildLog(id: string, line: string): void {
    const arr = this.buildLogs.get(id);
    if (!arr) return;
    const stamp = `[${isoNow()}] ${line}`;
    arr.push(stamp);
    const b = this.getBuildById(id);
    if (b) b.logs_count = arr.length;
  }

  getBuildLogs(id: string): string[] {
    const b = this.builds.find((x) => x.id === id);
    if (!b) throw new Error("not_found");
    const real = this.buildLogs.get(id);
    if (real && real.length > 0) return [...real];
    // Seed builds (and brand-new rows that haven't emitted any line yet) fall
    // back to synthesised logs so the legacy dashboard panel keeps working.
    return synthesizeBuildLogs(b);
  }

  // --- Campaign actions ---

  pauseCampaign(id: string): Campaign {
    const c = this.campaigns.find((x) => x.id === id);
    if (!c) throw new Error("not_found");
    if (c.status !== "scheduled" && c.status !== "queued") throw new Error("invalid_state");
    c.status = "draft";
    c.scheduled_at = null;
    return c;
  }

  cancelCampaign(id: string): Campaign {
    const c = this.campaigns.find((x) => x.id === id);
    if (!c) throw new Error("not_found");
    if (c.status !== "scheduled" && c.status !== "queued" && c.status !== "dispatching") {
      throw new Error("invalid_state");
    }
    c.status = "failed";
    c.failed_count = c.recipients_count;
    return c;
  }

  duplicateCampaign(id: string): Campaign {
    const src = this.campaigns.find((x) => x.id === id);
    if (!src) throw new Error("not_found");
    const dup: Campaign = {
      id: uuid(),
      app_id: src.app_id,
      title: src.title,
      body: src.body,
      image_url: src.image_url,
      click_url: src.click_url,
      target_type: src.target_type,
      target_summary: src.target_summary,
      active_within_minutes: src.active_within_minutes,
      country_codes: src.country_codes,
      device_ids: src.device_ids,
      status: "draft",
      created_at: isoNow(),
      scheduled_at: null,
      sent_at: null,
      recipients_count: 0,
      sent_count: 0,
      delivered_count: 0,
      opened_count: 0,
      clicked_count: 0,
      failed_count: 0,
    };
    this.campaigns.unshift(dup);
    return dup;
  }

  async sendDraftCampaign(id: string): Promise<Campaign> {
    if (!this.useDatabase) {
      const c = this.campaigns.find((x) => x.id === id);
      if (!c) throw new Error("not_found");
      if (c.status !== "draft") throw new Error("invalid_state");
      const app = this.apps.get(c.app_id);
      if (!app) throw new Error("app_not_found");
      const matched = this.matchSubscribers(c.app_id, {
        type: c.target_type,
        active_within_minutes: c.active_within_minutes,
        country_codes: c.country_codes,
        device_ids: c.device_ids,
      });
      const recipients = matched.length;
      c.status = "sent";
      c.scheduled_at = null;
      c.sent_at = isoNow();
      c.recipients_count = recipients;
      c.sent_count = recipients;
      c.delivered_count = Math.floor(recipients * 0.84);
      c.opened_count = Math.floor(recipients * 0.084);
      c.clicked_count = Math.floor(recipients * 0.017);
      c.failed_count = Math.max(0, recipients - c.delivered_count);
      app.total_pushes_sent += recipients;
      this.recalcAppMetrics(c.app_id);
      return c;
    }

    const { rows } = await query<Campaign>(`
      UPDATE push_campaigns
      SET status = 'sent', sent_at = NOW()
      WHERE id = $1 AND status = 'draft'
      RETURNING *
    `, [id]);

    if (rows.length === 0) throw new Error("Campaign not found or already sent");
    return rows[0]!;
  }

  // --- Users ---

  createUser(input: {
    email: string;
    password: string;
    full_name: string;
  }): StoredUser {
    const email = (input.email ?? "").trim().toLowerCase();
    const fullName = (input.full_name ?? "").trim();
    const password = String(input.password ?? "");
    if (!isValidEmail(email)) throw new Error("invalid_email");
    if (password.length < 8) throw new Error("invalid_password");
    if (!fullName) throw new Error("invalid_full_name");
    if (this.usersByEmail.has(email)) throw new Error("email_in_use");
    const { hash, salt } = hashPassword(password);
    const now = isoNow();
    const user: StoredUser = {
      id: uuid(),
      email,
      full_name: fullName,
      plan: "starter",
      email_verified: false,
      created_at: now,
      last_seen_at: now,
      password_hash: hash,
      password_salt: salt,
    };
    this.users.set(user.id, user);
    this.usersByEmail.set(email, user.id);
    this.userApps.set(user.id, []);
    this.userCarts.set(user.id, { items: [], promo_code: null, discount_pct: 0 });
    this.userSubscriptions.set(user.id, []);
    this.userPayments.set(user.id, []);
    this.userInvoices.set(user.id, []);
    return user;
  }

  createUserFromGoogle(input: {
    email: string;
    full_name: string;
    google_uid: string;
    email_verified: boolean;
  }): StoredUser {
    const email = (input.email ?? "").trim().toLowerCase();
    const fullName = (input.full_name ?? "").trim();
    const googleUid = (input.google_uid ?? "").trim();
    if (!isValidEmail(email)) throw new Error("invalid_email");
    if (!fullName) throw new Error("invalid_full_name");
    if (!googleUid) throw new Error("invalid_google_uid");
    if (this.usersByEmail.has(email)) throw new Error("email_in_use");
    if (this.usersByGoogleUid.has(googleUid)) throw new Error("google_uid_in_use");
    const randomPw = crypto.randomBytes(48).toString("hex");
    const { hash, salt } = hashPassword(randomPw);
    const now = isoNow();
    const user: StoredUser = {
      id: uuid(),
      email,
      full_name: fullName,
      plan: "starter",
      email_verified: input.email_verified,
      created_at: now,
      last_seen_at: now,
      password_hash: hash,
      password_salt: salt,
      google_uid: googleUid,
      email_verification_token: undefined,
    };
    this.users.set(user.id, user);
    this.usersByEmail.set(email, user.id);
    this.usersByGoogleUid.set(googleUid, user.id);
    this.userApps.set(user.id, []);
    this.userCarts.set(user.id, { items: [], promo_code: null, discount_pct: 0 });
    this.userSubscriptions.set(user.id, []);
    this.userPayments.set(user.id, []);
    this.userInvoices.set(user.id, []);
    return user;
  }

  findUserByGoogleUid(uid: string): StoredUser | undefined {
    const id = this.usersByGoogleUid.get((uid ?? "").trim());
    if (!id) return undefined;
    return this.users.get(id);
  }

  findUserByEmail(email: string): StoredUser | undefined {
    const id = this.usersByEmail.get((email ?? "").trim().toLowerCase());
    if (!id) return undefined;
    return this.users.get(id);
  }

  findUserById(id: string): StoredUser | undefined {
    return this.users.get(id);
  }

  /** Bumps session activity time (auth routes + `/api/auth/me`). */
  touchUserLastSeen(userId: string): void {
    const u = this.users.get(userId);
    if (!u) return;
    u.last_seen_at = isoNow();
  }

  updateUser(id: string, patch: Partial<StoredUser>): StoredUser {
    const u = this.users.get(id);
    if (!u) throw new Error("not_found");
    if (typeof patch.email === "string") {
      const next = patch.email.trim().toLowerCase();
      if (next && next !== u.email) {
        if (!isValidEmail(next)) throw new Error("invalid_email");
        if (this.usersByEmail.has(next)) throw new Error("email_in_use");
        this.usersByEmail.delete(u.email);
        u.email = next;
        this.usersByEmail.set(next, u.id);
      }
    }
    const stringFields = [
      "full_name",
      "phone",
      "location",
      "website",
      "bio",
    ] as const;
    for (const k of stringFields) {
      const v = patch[k];
      if (typeof v === "string") (u as Record<string, unknown>)[k] = v.trim();
    }
    if (typeof patch.email_verified === "boolean") u.email_verified = patch.email_verified;
    if (typeof patch.google_uid === "string") {
      const nextUid = patch.google_uid.trim();
      if (u.google_uid && u.google_uid !== nextUid) {
        this.usersByGoogleUid.delete(u.google_uid);
      }
      if (nextUid) {
        const holder = this.usersByGoogleUid.get(nextUid);
        if (holder && holder !== u.id) throw new Error("google_uid_in_use");
        this.usersByGoogleUid.set(nextUid, u.id);
        u.google_uid = nextUid;
      } else {
        delete u.google_uid;
      }
    }
    if (typeof patch.password_hash === "string") u.password_hash = patch.password_hash;
    if (typeof patch.password_salt === "string") u.password_salt = patch.password_salt;
    if ("reset_token" in patch) u.reset_token = patch.reset_token;
    if ("reset_token_exp" in patch) u.reset_token_exp = patch.reset_token_exp;
    if ("email_verification_token" in patch) {
      u.email_verification_token = patch.email_verification_token;
    }
    if (
      patch.plan === "starter" ||
      patch.plan === "pro" ||
      patch.plan === "business" ||
      patch.plan === "enterprise"
    ) {
      u.plan = patch.plan;
    }
    return u;
  }

  /** Strip secret fields from a stored user before returning to the API caller. */
  publicUser(u: StoredUser): AuthUser {
    return {
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      plan: u.plan,
      email_verified: u.email_verified,
      created_at: u.created_at,
      phone: u.phone,
      location: u.location,
      website: u.website,
      bio: u.bio,
    };
  }

  findUserByResetToken(token: string): StoredUser | undefined {
    if (!token) return undefined;
    const now = Date.now();
    for (const u of this.users.values()) {
      if (
        u.reset_token === token &&
        typeof u.reset_token_exp === "number" &&
        u.reset_token_exp > now
      ) {
        return u;
      }
    }
    return undefined;
  }

  findUserByVerificationToken(token: string): StoredUser | undefined {
    if (!token) return undefined;
    for (const u of this.users.values()) {
      if (u.email_verification_token === token) return u;
    }
    return undefined;
  }

  // --- Customer-scoped apps & builds ---

  /**
   * Return (or create) the auto-managed "Public builder" app row for a user.
   * Used by `POST /api/builder/builds` so each authenticated build is owned
   * by a real app row in the existing apps store.
   */
  async getOrCreatePublicBuilderApp(userId: string): Promise<AndroidApp> {
    const owned = this.userApps.get(userId) ?? [];
    for (const id of owned) {
      const app = this.apps.get(id);
      if (app && app.name === "Public builder") return app;
    }
    const app = await this.createApp({
      name: "Public builder",
      package_name: `com.apkzio.user${userId.slice(0, 8).replace(/-/g, "")}`,
      icon_glyph: "PB",
      icon_color: "from-lime-500/20 to-lime-500/5",
    });
    owned.push(app.id);
    this.userApps.set(userId, owned);
    return app;
  }

  listUserApps(userId: string): AndroidApp[] {
    const ids = this.userApps.get(userId) ?? [];
    return ids
      .map((id) => this.apps.get(id))
      .filter((a): a is AndroidApp => Boolean(a));
  }

  listUserBuilds(userId: string): ApkBuild[] {
    return this.builds
      .filter((b) => b.user_id === userId)
      .sort((a, b) => +new Date(b.build_started_at) - +new Date(a.build_started_at));
  }

  // --- Cart / billing ---

  getCart(userId: string): Cart {
    let c = this.userCarts.get(userId);
    if (!c) {
      c = { items: [], promo_code: null, discount_pct: 0 };
      this.userCarts.set(userId, c);
    }
    return c;
  }

  addCartItem(
    userId: string,
    input: { name: string; description?: string; price: number; quantity?: number },
  ): Cart {
    const cart = this.getCart(userId);
    const name = (input.name ?? "").trim();
    if (!name) throw new Error("invalid_request");
    const price = Number(input.price);
    if (!Number.isFinite(price) || price < 0) throw new Error("invalid_request");
    const qty = Math.max(1, Math.floor(Number(input.quantity ?? 1)));
    cart.items.push({
      id: uuid(),
      name,
      description: (input.description ?? "").toString(),
      price,
      quantity: qty,
      added_at: isoNow(),
    });
    return cart;
  }

  updateCartItem(userId: string, itemId: string, quantity: number): Cart {
    const cart = this.getCart(userId);
    const item = cart.items.find((x) => x.id === itemId);
    if (!item) throw new Error("not_found");
    const q = Math.floor(Number(quantity));
    if (!Number.isFinite(q) || q < 0) throw new Error("invalid_request");
    if (q === 0) {
      cart.items = cart.items.filter((x) => x.id !== itemId);
    } else {
      item.quantity = q;
    }
    return cart;
  }

  removeCartItem(userId: string, itemId: string): Cart {
    const cart = this.getCart(userId);
    const before = cart.items.length;
    cart.items = cart.items.filter((x) => x.id !== itemId);
    if (cart.items.length === before) throw new Error("not_found");
    return cart;
  }

  applyPromo(userId: string, code: string): Cart {
    const cart = this.getCart(userId);
    const trimmed = (code ?? "").trim().toUpperCase();
    if (trimmed === "APKZIO10") {
      cart.promo_code = trimmed;
      cart.discount_pct = 10;
      return cart;
    }
    throw new Error("invalid_promo");
  }

  checkout(userId: string): Invoice {
    const cart = this.getCart(userId);
    if (cart.items.length === 0) throw new Error("empty_cart");
    const subtotal = cart.items.reduce((s, x) => s + x.price * x.quantity, 0);
    const discount = Math.round(subtotal * (cart.discount_pct / 100) * 100) / 100;
    const total = Math.round((subtotal - discount) * 100) / 100;
    this.invoiceCounter += 1;
    const number = `INV-${this.invoiceCounter}`;
    const invoice: Invoice = {
      id: uuid(),
      number,
      user_id: userId,
      total,
      subtotal,
      discount,
      status: "paid",
      paid_at: isoNow(),
      created_at: isoNow(),
      items: cart.items.map((x) => ({
        name: x.name,
        description: x.description,
        price: x.price,
        quantity: x.quantity,
      })),
    };
    const invoices = this.userInvoices.get(userId) ?? [];
    invoices.unshift(invoice);
    this.userInvoices.set(userId, invoices);

    const payment: Payment = {
      id: uuid(),
      user_id: userId,
      amount: total,
      status: "succeeded",
      method: "card",
      created_at: isoNow(),
      invoice_id: invoice.id,
    };
    const payments = this.userPayments.get(userId) ?? [];
    payments.unshift(payment);
    this.userPayments.set(userId, payments);

    const subs = this.userSubscriptions.get(userId) ?? [];
    for (const item of cart.items) {
      if (/plan/i.test(item.name)) {
        subs.unshift({
          id: uuid(),
          user_id: userId,
          plan_name: item.name,
          status: "active",
          started_at: isoNow(),
          amount: item.price * item.quantity,
        });
      }
    }
    this.userSubscriptions.set(userId, subs);

    cart.items = [];
    cart.promo_code = null;
    cart.discount_pct = 0;
    return invoice;
  }

  listSubscriptions(userId: string): Subscription[] {
    return [...(this.userSubscriptions.get(userId) ?? [])];
  }

  listPayments(userId: string): Payment[] {
    return [...(this.userPayments.get(userId) ?? [])];
  }

  listInvoices(userId: string): Invoice[] {
    return [...(this.userInvoices.get(userId) ?? [])];
  }

  adminAccountStatusForUser(userId: string): AdminClientAccountStatus {
    const u = this.users.get(userId);
    if (!u) return "lead";
    const subs = this.listSubscriptions(userId);
    const hasActive = subs.some((s) => s.status === "active");
    if (hasActive) return "active";
    const hadCancelled = subs.some((s) => s.status === "cancelled");
    if (hadCancelled) return "churned";
    const apps = this.userApps.get(userId) ?? [];
    if (apps.length > 0) return "active";
    return "lead";
  }

  adminClientSummaryForUser(u: StoredUser): AdminClientSummary {
    const apps = this.userApps.get(u.id) ?? [];
    const builds = this.builds.filter((b) => b.user_id === u.id);
    const subs = this.listSubscriptions(u.id);
    const activeSubs = subs.filter((s) => s.status === "active").length;
    const payments = this.listPayments(u.id);
    const lifetimeRevenue = payments
      .filter((p) => p.status === "succeeded")
      .reduce((sum, p) => sum + p.amount, 0);
    return {
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      plan: u.plan,
      email_verified: u.email_verified,
      created_at: u.created_at,
      last_seen_at: u.last_seen_at ?? null,
      google_linked: Boolean(u.google_uid),
      apps_count: apps.length,
      builds_count: builds.length,
      active_subscriptions: activeSubs,
      lifetime_revenue: lifetimeRevenue,
      account_status: this.adminAccountStatusForUser(u.id),
    };
  }

  listAdminClients(opts: {
    q?: string;
    plan?: string;
    status?: AdminClientAccountStatus;
    google_linked?: boolean;
    offset: number;
    limit: number;
  }): { total: number; clients: AdminClientSummary[] } {
    const q = (opts.q ?? "").trim().toLowerCase();
    const planRaw = (opts.plan ?? "").trim().toLowerCase();
    const planOk =
      planRaw === "starter" ||
      planRaw === "pro" ||
      planRaw === "business" ||
      planRaw === "enterprise";

    let rows = [...this.users.values()].map((u) => this.adminClientSummaryForUser(u));
    if (q) {
      rows = rows.filter(
        (c) =>
          c.email.includes(q) ||
          c.full_name.toLowerCase().includes(q) ||
          c.id.toLowerCase().includes(q),
      );
    }
    if (planOk) {
      rows = rows.filter((c) => c.plan === planRaw);
    }
    if (opts.status === "lead" || opts.status === "active" || opts.status === "churned") {
      rows = rows.filter((c) => c.account_status === opts.status);
    }
    if (opts.google_linked === true) {
      rows = rows.filter((c) => c.google_linked);
    }
    if (opts.google_linked === false) {
      rows = rows.filter((c) => !c.google_linked);
    }
    rows.sort((a, b) => {
      const tb = b.last_seen_at ? +new Date(b.last_seen_at) : 0;
      const ta = a.last_seen_at ? +new Date(a.last_seen_at) : 0;
      if (tb !== ta) return tb - ta;
      return +new Date(b.created_at) - +new Date(a.created_at);
    });
    const total = rows.length;
    const slice = rows.slice(opts.offset, opts.offset + opts.limit);
    return { total, clients: slice };
  }

  listContactMessagesForClientEmail(email: string): ContactMessage[] {
    const e = (email ?? "").trim().toLowerCase();
    if (!e) return [];
    return this.contactMessages.filter((m) => m.email.toLowerCase() === e).slice(0, 40);
  }

  getAdminClientDetail(userId: string): AdminClientDetail | null {
    const u = this.findUserById(userId);
    if (!u) return null;
    const summary = this.adminClientSummaryForUser(u);
    const appIds = this.userApps.get(u.id) ?? [];
    const apps: AdminClientAppRow[] = [];
    for (const id of appIds) {
      const ap = this.apps.get(id);
      if (!ap) continue;
      apps.push({
        id: ap.id,
        name: ap.name,
        package_name: ap.package_name,
        status: ap.status,
        created_at: ap.created_at,
      });
    }
    const builds = this.builds
      .filter((b) => b.user_id === u.id)
      .slice(0, 80)
      .map(
        (b): AdminClientBuildRow => ({
          id: b.id,
          app_id: b.app_id,
          version_name: b.version_name,
          version_code: b.version_code,
          status: b.status,
          build_started_at: b.build_started_at,
          build_completed_at: b.build_completed_at,
        }),
      );
    const cart = this.userCarts.get(u.id) ?? { items: [], promo_code: null, discount_pct: 0 };
    return {
      summary,
      profile: this.publicUser(u),
      apps,
      builds,
      subscriptions: this.listSubscriptions(u.id),
      payments: this.listPayments(u.id).slice(0, 80),
      invoices: this.listInvoices(u.id).slice(0, 80),
      cart: {
        items_count: cart.items.length,
        promo_code: cart.promo_code,
      },
      contact_messages: this.listContactMessagesForClientEmail(u.email),
    };
  }

  /** Create a new admin client (user) from the admin console. */
  createAdminClient(input: {
    email: string;
    full_name: string;
    plan?: AuthUser["plan"];
    phone?: string;
    location?: string;
    website?: string;
    bio?: string;
  }): AdminClientSummary {
    const email = (input.email ?? "").trim().toLowerCase();
    const fullName = (input.full_name ?? "").trim();
    if (!isValidEmail(email)) throw new Error("invalid_email");
    if (!fullName) throw new Error("invalid_full_name");
    if (this.usersByEmail.has(email)) throw new Error("email_in_use");

    // Generate a random password for admin-created accounts (user can reset it)
    const randomPw = crypto.randomBytes(24).toString("hex");
    const { hash, salt } = hashPassword(randomPw);
    const now = isoNow();
    const plan = input.plan ?? "starter";
    if (plan !== "starter" && plan !== "pro" && plan !== "business" && plan !== "enterprise") {
      throw new Error("invalid_plan");
    }

    const user: StoredUser = {
      id: uuid(),
      email,
      full_name: fullName,
      plan,
      email_verified: false,
      created_at: now,
      last_seen_at: now,
      password_hash: hash,
      password_salt: salt,
      phone: input.phone,
      location: input.location,
      website: input.website,
      bio: input.bio,
    };

    this.users.set(user.id, user);
    this.usersByEmail.set(email, user.id);
    this.userApps.set(user.id, []);
    this.userCarts.set(user.id, { items: [], promo_code: null, discount_pct: 0 });
    this.userSubscriptions.set(user.id, []);
    this.userPayments.set(user.id, []);
    this.userInvoices.set(user.id, []);

    return this.adminClientSummaryForUser(user);
  }

  /** Update an admin client (user) from the admin console. */
  updateAdminClient(userId: string, patch: {
    full_name?: string;
    plan?: AuthUser["plan"];
    email_verified?: boolean;
    phone?: string;
    location?: string;
    website?: string;
    bio?: string;
  }): AdminClientSummary {
    const u = this.users.get(userId);
    if (!u) throw new Error("not_found");

    if (typeof patch.full_name === "string" && patch.full_name.trim()) {
      u.full_name = patch.full_name.trim();
    }
    if (
      patch.plan === "starter" ||
      patch.plan === "pro" ||
      patch.plan === "business" ||
      patch.plan === "enterprise"
    ) {
      u.plan = patch.plan;
    }
    if (typeof patch.email_verified === "boolean") {
      u.email_verified = patch.email_verified;
    }
    if (typeof patch.phone === "string") u.phone = patch.phone.trim();
    if (typeof patch.location === "string") u.location = patch.location.trim();
    if (typeof patch.website === "string") u.website = patch.website.trim();
    if (typeof patch.bio === "string") u.bio = patch.bio.trim();

    return this.adminClientSummaryForUser(u);
  }

  /** Delete an admin client (user) from the admin console. */
  deleteAdminClient(userId: string): boolean {
    const u = this.users.get(userId);
    if (!u) return false;

    // Remove user from email index
    this.usersByEmail.delete(u.email);
    if (u.google_uid) this.usersByGoogleUid.delete(u.google_uid);

    // Clean up all associated data
    this.userApps.delete(userId);
    this.userCarts.delete(userId);
    this.userSubscriptions.delete(userId);
    this.userPayments.delete(userId);
    this.userInvoices.delete(userId);
    this.userPushTokens.delete(userId);

    // Remove the user
    this.users.delete(userId);

    return true;
  }

  // --- Contact form ---

  recordContactMessage(input: {
    name: string;
    email: string;
    subject?: string | null;
    message: string;
    topic?: string | null;
  }): ContactMessage {
    const name = (input.name ?? "").trim();
    const email = (input.email ?? "").trim().toLowerCase();
    const message = (input.message ?? "").trim();
    if (!name) throw new Error("invalid_name");
    if (!isValidEmail(email)) throw new Error("invalid_email");
    if (!message) throw new Error("invalid_message");
    const row: ContactMessage = {
      id: uuid(),
      name,
      email,
      subject: input.subject ? String(input.subject).trim() || null : null,
      message,
      topic: input.topic ? String(input.topic).trim() || null : null,
      created_at: isoNow(),
    };
    this.contactMessages.unshift(row);
    return row;
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

  /**
   * Get daily install count trends for a specific app.
   * Returns an array of values (not timestamps) for sparkline rendering.
   * Later: query real events table when available.
   */
  getAppInstallTrends(appId: string, days: number): number[] {
    const app = this.apps.get(appId);
    if (!app) return Array(days).fill(0);
    
    // Seed the RNG using app ID so trends are stable across requests
    const r = mulberry32(hash32(appId + "-installs"));
    const result: number[] = [];
    
    // Base value proportional to total installs, with some variation
    let base = Math.max(100, app.total_installs / 30);
    
    for (let i = days - 1; i >= 0; i--) {
      // Add controlled randomness and slight upward trend
      base *= 0.95 + r() * 0.1;
      const value = Math.max(0, Math.floor(base + (r() - 0.5) * (base * 0.3)));
      result.push(value);
    }
    
    return result;
  }

  /**
   * Get hourly active user counts for a specific app.
   * Returns an array of values for the last N hours.
   */
  getAppHeartbeatTrends(appId: string, hours: number): number[] {
    const app = this.apps.get(appId);
    if (!app) return Array(hours).fill(0);
    
    const r = mulberry32(hash32(appId + "-heartbeats"));
    const result: number[] = [];
    
    // Base value proportional to active devices
    const base = Math.max(10, app.active_devices_24h / 4);
    
    for (let i = hours - 1; i >= 0; i--) {
      const hourOfDay = (new Date().getHours() - i + 24) % 24;
      // Model daily patterns: lower at night, higher during day
      const timeMultiplier = hourOfDay >= 6 && hourOfDay <= 22 ? 1.2 : 0.6;
      const value = Math.max(0, Math.floor(base * timeMultiplier * (0.8 + r() * 0.4)));
      result.push(value);
    }
    
    return result;
  }

  /**
   * Get trend data for a specific event name.
   * Used for drill-in modals in Analytics.tsx.
   */
  getEventTrends(eventName: string, days: number): number[] {
    const r = mulberry32(hash32(eventName + "-trends"));
    const result: number[] = [];
    
    // Generate plausible event counts
    let base = 1000 + r() * 5000;
    
    for (let i = days - 1; i >= 0; i--) {
      base *= 0.92 + r() * 0.16;
      const value = Math.max(0, Math.floor(base + (r() - 0.5) * (base * 0.4)));
      result.push(value);
    }
    
    return result;
  }

  // --- Crash Analytics ---

  private crashes: CrashEvent[] = [];
  private campaignErrors: CampaignError[] = [];

  recordCrash(input: {
    app_id: string;
    device_id?: string;
    crash_type: string;
    stack_trace?: string;
    app_version?: string;
    os_version?: string;
    manufacturer?: string;
    model?: string;
    metadata?: Record<string, unknown>;
  }): { crash_id: string } {
    const app = this.apps.get(input.app_id);
    if (!app) throw new Error("app_not_found");

    const crash: CrashEvent = {
      id: uuid(),
      app_id: input.app_id,
      device_id: input.device_id ?? null,
      crash_type: input.crash_type,
      stack_trace: input.stack_trace ?? null,
      app_version: input.app_version ?? null,
      os_version: input.os_version ?? null,
      manufacturer: input.manufacturer ?? null,
      model: input.model ?? null,
      metadata: input.metadata ?? {},
      created_at: isoNow(),
    };

    this.crashes.push(crash);
    return { crash_id: crash.id };
  }

  getCrashAnalytics(appId: string, range: "7d" | "24h" | "30d"): {
    total_crashes: number;
    crash_rate: number;
    trend: Point[];
    by_type: { type: string; count: number; pct: number }[];
  } {
    const app = this.apps.get(appId);
    if (!app) throw new Error("app_not_found");

    const now = Date.now();
    const rangeDays = range === "24h" ? 1 : range === "7d" ? 7 : 30;
    const rangeMs = rangeDays * dayMs;
    const startTime = now - rangeMs;

    const crashes = this.crashes.filter(
      (c) => c.app_id === appId && +new Date(c.created_at) >= startTime
    );

    const totalCrashes = crashes.length;
    const activeDevices = app.active_devices_24h;
    const crashRate = activeDevices > 0 ? (totalCrashes / activeDevices) * 100 : 0;

    // Build trend (hourly or daily buckets)
    const bucketMs = range === "24h" ? 3600_000 : dayMs;
    const bucketCount = range === "24h" ? 24 : rangeDays;
    const trend: Point[] = [];

    for (let i = bucketCount - 1; i >= 0; i--) {
      const bucketStart = now - i * bucketMs;
      const bucketEnd = bucketStart + bucketMs;
      const count = crashes.filter((c) => {
        const t = +new Date(c.created_at);
        return t >= bucketStart && t < bucketEnd;
      }).length;
      trend.push({ t: bucketStart, v: count });
    }

    // Group by type
    const byType: Record<string, number> = {};
    for (const c of crashes) {
      byType[c.crash_type] = (byType[c.crash_type] ?? 0) + 1;
    }

    const byTypeArray = Object.entries(byType)
      .map(([type, count]) => ({
        type,
        count,
        pct: totalCrashes > 0 ? (count / totalCrashes) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      total_crashes: totalCrashes,
      crash_rate: Math.round(crashRate * 100) / 100,
      trend,
      by_type: byTypeArray,
    };
  }

  recordCampaignError(input: {
    campaign_id: string;
    error_code: string;
    error_message?: string;
    subscriber_id?: string;
    device_info?: Record<string, unknown>;
  }): { error_id: string } {
    const campaign = this.campaigns.find((c) => c.id === input.campaign_id);
    if (!campaign) throw new Error("campaign_not_found");

    const error: CampaignError = {
      id: uuid(),
      campaign_id: input.campaign_id,
      error_code: input.error_code,
      error_message: input.error_message ?? null,
      subscriber_id: input.subscriber_id ?? null,
      device_info: input.device_info ?? {},
      created_at: isoNow(),
    };

    this.campaignErrors.push(error);
    return { error_id: error.id };
  }

  getCampaignErrors(campaignId: string): {
    total: number;
    by_code: { code: string; count: number; message: string; pct: number }[];
  } {
    const campaign = this.campaigns.find((c) => c.id === campaignId);
    if (!campaign) throw new Error("campaign_not_found");

    const errors = this.campaignErrors.filter((e) => e.campaign_id === campaignId);
    const total = errors.length;

    const byCode: Record<string, { count: number; message: string }> = {};
    for (const e of errors) {
      if (!byCode[e.error_code]) {
        byCode[e.error_code] = { count: 0, message: e.error_message ?? "" };
      }
      byCode[e.error_code]!.count++;
    }

    const byCodeArray = Object.entries(byCode)
      .map(([code, { count, message }]) => ({
        code,
        count,
        message,
        pct: total > 0 ? (count / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return { total, by_code: byCodeArray };
  }
}

type CrashEvent = {
  id: string;
  app_id: string;
  device_id: string | null;
  crash_type: string;
  stack_trace: string | null;
  app_version: string | null;
  os_version: string | null;
  manufacturer: string | null;
  model: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type CampaignError = {
  id: string;
  campaign_id: string;
  error_code: string;
  error_message: string | null;
  subscriber_id: string | null;
  device_info: Record<string, unknown>;
  created_at: string;
};

const dayMs = 86400_000;

function sha256hex(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(email: string): boolean {
  return typeof email === "string" && EMAIL_RE.test(email);
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

function deriveGlyph(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AP";
  if (parts.length === 1) {
    const single = parts[0]!;
    return single.slice(0, 2).toUpperCase();
  }
  return ((parts[0]![0] ?? "A") + (parts[1]![0] ?? "P")).toUpperCase();
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function synthesizeBuildLogs(build: ApkBuild): string[] {
  const tag = (s: string) => `[${s}]`;
  const stamp = build.build_started_at;
  const lines: string[] = [
    `${tag(stamp)} build ${build.id} accepted from dashboard`,
    `${tag("info")} resolving sources for v${build.version_name} (versionCode=${build.version_code})`,
    `${tag("gradle")} > Configure project :app`,
    `${tag("gradle")} > Task :app:preBuild UP-TO-DATE`,
    `${tag("gradle")} > Task :app:compileDebugKotlin`,
  ];

  if (build.status === "queued") {
    lines.push(`${tag("info")} waiting for executor slot`);
    lines.push(`${tag("info")} queue position: 1`);
    lines.push(`${tag("info")} status=queued`);
    return lines;
  }

  lines.push(`${tag("gradle")} > Task :app:processDebugResources`);
  lines.push(`${tag("gradle")} > Task :app:mergeDebugAssets`);
  lines.push(`${tag("gradle")} > Task :app:packageDebug`);

  if (build.status === "building") {
    lines.push(`${tag("info")} compiling - elapsed ${Math.round((Date.now() - +new Date(stamp)) / 1000)}s`);
    lines.push(`${tag("info")} status=building`);
    return lines;
  }

  if (build.status === "failed") {
    lines.push(`${tag("error")} :app:lintVitalRelease FAILED`);
    lines.push(`${tag("error")} build aborted after ${Math.round((build.duration_ms ?? 0) / 1000)}s`);
    return lines;
  }

  lines.push(`${tag("info")} APK size ${formatBytes(build.size_bytes ?? 0)}`);
  lines.push(`${tag("info")} uploaded artifact to ${build.output_url ?? "(none)"}`);
  lines.push(`${tag("done")} BUILD SUCCESSFUL in ${Math.round((build.duration_ms ?? 0) / 1000)}s`);
  return lines;
}
