import { hash, mulberry32 } from "./utils";

// ==== Types — mirror the Postgres schema ====

export type AppStatus = "active" | "paused" | "suspended";
export type CampaignStatus =
  | "draft" | "queued" | "dispatching" | "sent" | "failed" | "scheduled";
export type CampaignTarget =
  | { type: "all" }
  | { type: "active"; active_within_minutes: number }
  | { type: "country"; country_codes: string[] }
  | { type: "device_list"; device_ids: string[] };

export type AndroidApp = {
  id: string;
  /** Set when loaded from Supabase — needed for owner-scoped writes (RLS). */
  owner_id?: string;
  name: string;
  package_name: string;
  app_key: string; // pk_…
  status: AppStatus;
  icon_color: string; // tailwind class for placeholder
  icon_glyph: string; // letters for placeholder
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
  fcm_token_redacted: string; // fcm_xxxx...yyyy
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
};

export type ApiKey = {
  id: string;
  app_id: string;
  name: string;
  key_preview: string; // sk_live_AbCd…
  scopes: string[];
  rate_limit_rpm: number;
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
};

// ==== Generation ====

const COUNTRIES = ["BD","IN","PK","ID","NG","BR","US","MX","PH","VN","TR","EG","IR","TH","DE"] as const;
const COUNTRY_NAMES: Record<string, string> = {
  BD:"Bangladesh", IN:"India", PK:"Pakistan", ID:"Indonesia", NG:"Nigeria",
  BR:"Brazil", US:"United States", MX:"Mexico", PH:"Philippines", VN:"Vietnam",
  TR:"Türkiye", EG:"Egypt", IR:"Iran", TH:"Thailand", DE:"Germany",
};

const MANUFACTURERS = ["Samsung","Xiaomi","Vivo","OPPO","Realme","Tecno","Infinix","Google","OnePlus"] as const;
const MODELS_BY_MFG: Record<string, string[]> = {
  Samsung: ["Galaxy A14","Galaxy A24","Galaxy A54","Galaxy S23","Galaxy S24","Galaxy M14","Galaxy M34"],
  Xiaomi:  ["Redmi 12","Redmi Note 13","Redmi Note 12","POCO X6","Redmi 13C","Redmi A2"],
  Vivo:    ["Y17s","Y27","V29","V27","Y16"],
  OPPO:    ["A17","A78","Reno 11","A38","A58"],
  Realme:  ["C53","C55","Narzo 60","11 Pro","C30s"],
  Tecno:   ["Spark 10","Camon 20","Pova 5","Spark Go 2024"],
  Infinix: ["Hot 30","Smart 8","Note 30","Hot 40"],
  Google:  ["Pixel 7a","Pixel 8","Pixel 8 Pro","Pixel 6a"],
  OnePlus: ["Nord CE 3","Nord 3","12R","11R"],
};

const APPS_SEED = [
  { name: "Aurora Health",  pkg: "com.aurora.health",  glyph: "AH", color: "from-emerald-500/20 to-emerald-500/5", scale: 1.0 },
  { name: "Tinkr Music",    pkg: "fm.tinkr.android",   glyph: "TM", color: "from-fuchsia-500/20 to-fuchsia-500/5", scale: 0.7 },
  { name: "Quikbite",       pkg: "co.quikbite.app",    glyph: "QB", color: "from-orange-500/20 to-orange-500/5",   scale: 0.55 },
  { name: "Coursecraft",    pkg: "io.coursecraft",     glyph: "CC", color: "from-sky-500/20 to-sky-500/5",         scale: 0.4 },
  { name: "Kobita Reader",  pkg: "in.kobita.reader",   glyph: "KR", color: "from-amber-500/20 to-amber-500/5",     scale: 0.3 },
  { name: "Mitra Wallet",   pkg: "com.mitra.wallet",   glyph: "MW", color: "from-lime-500/20 to-lime-500/5",       scale: 0.85 },
  { name: "Yodel Sports",   pkg: "live.yodel.sports",  glyph: "YS", color: "from-rose-500/20 to-rose-500/5",       scale: 0.25 },
];

function hex(rng: () => number, len: number): string {
  let s = "";
  while (s.length < len) s += Math.floor(rng() * 16).toString(16);
  return s;
}

function uuid(rng: () => number): string {
  const h = (n: number) => hex(rng, n);
  return `${h(8)}-${h(4)}-${h(4)}-${h(4)}-${h(12)}`;
}

function isoDaysAgo(rng: () => number, minDays: number, maxDays: number): string {
  const days = minDays + rng() * (maxDays - minDays);
  return new Date(Date.now() - days * 86400_000).toISOString();
}

function isoMinutesAgo(rng: () => number, minM: number, maxM: number): string {
  const m = minM + rng() * (maxM - minM);
  return new Date(Date.now() - m * 60_000).toISOString();
}

// ==== Apps ====
const rng = mulberry32(hash("pushcare-admin-v1"));

export const APPS: AndroidApp[] = APPS_SEED.map((s, i) => {
  const scale = s.scale;
  const total = Math.floor((1_200_000 + rng() * 4_000_000) * scale);
  const active24 = Math.floor(total * (0.18 + rng() * 0.18));
  const live = Math.floor(active24 * (0.05 + rng() * 0.06));
  const sent = Math.floor(total * (0.7 + rng() * 0.6));
  const dRate = 0.78 + rng() * 0.16;
  const oRate = 0.06 + rng() * 0.18;
  return {
    id: uuid(rng),
    name: s.name,
    package_name: s.pkg,
    app_key: "pk_" + hex(rng, 48),
    status: i === 5 ? "paused" : "active",
    icon_color: s.color,
    icon_glyph: s.glyph,
    total_installs: total,
    active_devices_24h: active24,
    live_users: live,
    total_pushes_sent: sent,
    delivery_rate: dRate,
    open_rate: oRate,
    created_at: isoDaysAgo(rng, 60, 540),
    fcm_project_id: rng() > 0.2 ? `${s.pkg.split(".").slice(-1)[0]}-${Math.floor(rng() * 1000)}` : null,
  };
});

// ==== Devices (sample per app) ====
export function devicesFor(app_id: string, count = 80): Device[] {
  const r = mulberry32(hash("dev:" + app_id));
  const out: Device[] = [];
  for (let i = 0; i < count; i++) {
    const m = MANUFACTURERS[Math.floor(r() * MANUFACTURERS.length)];
    const mod = MODELS_BY_MFG[m][Math.floor(r() * MODELS_BY_MFG[m].length)];
    const isActive = r() > 0.18;
    out.push({
      id: uuid(r),
      app_id,
      install_hash: hex(r, 16),
      country_code: COUNTRIES[Math.floor(r() * COUNTRIES.length)],
      manufacturer: m,
      model: mod,
      os_version: ["12","13","14","14"][Math.floor(r() * 4)],
      app_version: ["2.4.1","2.4.0","2.3.8","2.3.5"][Math.floor(r() * 4)],
      is_active: isActive,
      first_seen_at: isoDaysAgo(r, 1, 200),
      last_seen_at: isActive ? isoMinutesAgo(r, 0, 60) : isoDaysAgo(r, 1, 60),
    });
  }
  // sort by last_seen_at desc
  out.sort((a, b) => +new Date(b.last_seen_at) - +new Date(a.last_seen_at));
  return out;
}

// ==== Subscribers ====
export function subscribersFor(app_id: string, count = 60): Subscriber[] {
  const r = mulberry32(hash("sub:" + app_id));
  const out: Subscriber[] = [];
  for (let i = 0; i < count; i++) {
    const valid = r() > 0.08;
    const tok = "fcm_" + hex(r, 4) + "…" + hex(r, 4);
    out.push({
      id: uuid(r),
      app_id,
      device_id: uuid(r),
      fcm_token_redacted: tok,
      is_valid: valid,
      last_seen_at: valid ? isoMinutesAgo(r, 0, 60 * 24) : isoDaysAgo(r, 1, 30),
    });
  }
  return out;
}

// ==== Campaigns ====
const CAMPAIGN_TITLES = [
  "Flash sale ends in 2 hours",
  "Your weekly digest is ready",
  "New feature: live transcripts",
  "We miss you 👋",
  "Reset your password",
  "Order #4421 is on its way",
  "30% off Pro — today only",
  "New episode just dropped",
  "Verify your number to continue",
  "🎉 You earned a streak bonus",
  "Tap to claim your reward",
  "Maintenance window tonight",
  "Try the new dark mode",
  "Your friend Asif just joined",
];
const CAMPAIGN_BODIES = [
  "Tap now to grab the discount before midnight.",
  "We rounded up the 5 best things from your week.",
  "Auto-captions, live, in 28 languages. Beta opens today.",
  "It's been a while. Here's 100 free credits to come back.",
  "Open the app and confirm your code in 60 seconds.",
  "ETA: 24 minutes. Driver is heading to your address now.",
  "Use code FLASH30 at checkout. Expires at midnight.",
  "S2E07 just landed in your library. Press play.",
  "We sent a 6-digit code to +880 ••• 8412.",
  "12 days strong. Keep going to unlock the rare badge.",
  "Tap to pick a perk before they're gone.",
  "Brief downtime expected at 02:00 BST.",
  "Tap to switch your theme. Looks good at night.",
  "Say hi from your contacts list — they're new here.",
];

export const CAMPAIGNS: Campaign[] = (() => {
  const r = mulberry32(hash("campaigns-v1"));
  const out: Campaign[] = [];
  for (let i = 0; i < 24; i++) {
    const app = APPS[Math.floor(r() * APPS.length)];
    const title = CAMPAIGN_TITLES[i % CAMPAIGN_TITLES.length];
    const body = CAMPAIGN_BODIES[i % CAMPAIGN_BODIES.length];
    const targetType: Campaign["target_type"] =
      r() < 0.45 ? "active" : r() < 0.7 ? "country" : r() < 0.85 ? "all" : "device_list";
    const target_summary =
      targetType === "active" ? "Active in last 24h" :
      targetType === "country" ? `${COUNTRIES[Math.floor(r()*COUNTRIES.length)]}, ${COUNTRIES[Math.floor(r()*COUNTRIES.length)]}, ${COUNTRIES[Math.floor(r()*COUNTRIES.length)]}` :
      targetType === "all" ? "All subscribers" :
      `${Math.floor(50 + r()*900)} devices`;
    const recipients = Math.floor(app.active_devices_24h * (targetType === "all" ? 1 : 0.3 + r() * 0.6));
    const isFuture = r() < 0.08;
    const isFailed = r() < 0.05;
    const isDraft = r() < 0.12;
    const isDispatch = r() < 0.06;
    const status: CampaignStatus = isDraft ? "draft" : isFuture ? "scheduled" : isFailed ? "failed" : isDispatch ? "dispatching" : "sent";
    const sentRatio = status === "sent" || status === "dispatching" ? 0.95 + r() * 0.05 : 0;
    const sent = status === "draft" || status === "scheduled" ? 0 : Math.floor(recipients * sentRatio);
    const delivered = Math.floor(sent * (0.82 + r() * 0.12));
    const opened = Math.floor(delivered * (0.06 + r() * 0.18));
    const clicked = Math.floor(opened * (0.18 + r() * 0.18));
    const failed = sent - delivered;
    const created = isoDaysAgo(r, 0, 30);
    const sched = isFuture ? new Date(Date.now() + (1 + r() * 6) * 3600_000).toISOString() : null;
    const sent_at = status === "sent" || status === "dispatching" ? isoDaysAgo(r, 0, 12) : null;
    out.push({
      id: uuid(r),
      app_id: app.id,
      title, body,
      image_url: r() < 0.3 ? "/img/promo.jpg" : null,
      click_url: r() < 0.7 ? `myapp://path/${i}` : null,
      target_type: targetType,
      target_summary,
      status,
      created_at: created,
      scheduled_at: sched,
      sent_at,
      recipients_count: status === "draft" ? 0 : recipients,
      sent_count: sent,
      delivered_count: delivered,
      opened_count: opened,
      clicked_count: clicked,
      failed_count: Math.max(0, failed),
    });
  }
  out.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  return out;
})();

// ==== APK Builds ====
export const BUILDS: ApkBuild[] = (() => {
  const r = mulberry32(hash("builds-v1"));
  const out: ApkBuild[] = [];
  for (let i = 0; i < 18; i++) {
    const app = APPS[Math.floor(r() * APPS.length)];
    const status: ApkBuild["status"] = r() < 0.04 ? "failed" : r() < 0.06 ? "queued" : r() < 0.10 ? "building" : "success";
    const started = isoDaysAgo(r, 0, 28);
    const dur = status === "success" ? Math.floor(45_000 + r() * 220_000) : status === "failed" ? Math.floor(20_000 + r() * 80_000) : null;
    const completed = status === "success" || status === "failed" ? new Date(+new Date(started) + (dur ?? 0)).toISOString() : null;
    const size = status === "success" ? Math.floor(8 * 1024 * 1024 + r() * 28 * 1024 * 1024) : null;
    out.push({
      id: uuid(r),
      app_id: app.id,
      version_code: 240 - i,
      version_name: `2.${4 - Math.floor(i / 8)}.${(18 - i + 100) % 10}`,
      status,
      build_started_at: started,
      build_completed_at: completed,
      duration_ms: dur,
      size_bytes: size,
      output_url: status === "success" ? `https://cdn.pushcare.io/${app.id}/build-${240 - i}.apk` : null,
      triggered_by: ["abdullah","laila","rehan","ci-bot"][Math.floor(r() * 4)],
    });
  }
  out.sort((a, b) => +new Date(b.build_started_at) - +new Date(a.build_started_at));
  return out;
})();

// ==== API Keys ====
export const API_KEYS: ApiKey[] = (() => {
  const r = mulberry32(hash("keys-v1"));
  const out: ApiKey[] = [];
  for (let i = 0; i < 9; i++) {
    const app = APPS[Math.floor(r() * APPS.length)];
    const isLive = r() > 0.3;
    out.push({
      id: uuid(r),
      app_id: app.id,
      name: ["dashboard","ci-bot","ops","webhook-relay","internal-tools","analytics-export","mobile-build","staging","admin-cli"][i],
      key_preview: (isLive ? "sk_live_" : "sk_test_") + hex(r, 4) + "…" + hex(r, 4),
      scopes: [
        ["push:send","analytics:read"],
        ["analytics:read"],
        ["push:send","analytics:read","admin:apps"],
        ["push:send"],
        ["push:send","analytics:read"],
        ["analytics:read"],
        ["admin:apps"],
        ["push:send","analytics:read"],
        ["push:send","analytics:read","admin:apps"],
      ][i],
      rate_limit_rpm: [600, 1200, 2400, 600, 1200, 600, 600, 600, 2400][i],
      is_active: r() > 0.1,
      last_used_at: r() < 0.85 ? isoMinutesAgo(r, 0, 60 * 24 * 4) : null,
      expires_at: r() < 0.4 ? new Date(Date.now() + (30 + r() * 300) * 86400_000).toISOString() : null,
      created_at: isoDaysAgo(r, 1, 240),
    });
  }
  return out;
})();

// ==== Time-series for dashboard charts ====
export type Point = { t: number; v: number };

export function dailyInstalls(days = 30, seedKey = "global"): Point[] {
  const r = mulberry32(hash("inst:" + seedKey + days));
  const now = Date.now();
  const out: Point[] = [];
  let base = 50_000 + r() * 30_000;
  for (let i = days - 1; i >= 0; i--) {
    base = base * (0.97 + r() * 0.07);
    const dayBoost = i % 7 === 0 ? 1.1 : 1;
    out.push({
      t: now - i * 86400_000,
      v: Math.max(0, Math.floor(base * dayBoost + (r() - 0.5) * 8000)),
    });
  }
  return out;
}

export function hourlyHeartbeats(hours = 48, seedKey = "global"): Point[] {
  const r = mulberry32(hash("hb:" + seedKey + hours));
  const now = Date.now();
  const out: Point[] = [];
  for (let i = hours - 1; i >= 0; i--) {
    const hour = new Date(now - i * 3600_000).getHours();
    const dayCurve = Math.sin(((hour - 4) / 24) * Math.PI * 2) * 0.5 + 0.5;
    const v = Math.max(2_000, Math.floor(20_000 + dayCurve * 90_000 + (r() - 0.5) * 12_000));
    out.push({ t: now - i * 3600_000, v });
  }
  return out;
}

export function geoBreakdown(seedKey = "global"): { code: string; name: string; v: number; pct: number }[] {
  const r = mulberry32(hash("geo:" + seedKey));
  const sample = COUNTRIES.slice(0, 10).map((c) => ({
    code: c, name: COUNTRY_NAMES[c], v: Math.floor(20_000 + r() * 240_000), pct: 0,
  }));
  sample.sort((a, b) => b.v - a.v);
  const total = sample.reduce((s, x) => s + x.v, 0);
  return sample.map((x) => ({ ...x, pct: x.v / total }));
}

export function recentEvents(seedKey = "global", n = 40) {
  const r = mulberry32(hash("evt:" + seedKey));
  const NAMES = ["screen_view","button_click","purchase_completed","video_started","tutorial_finished","share_tapped","login","sign_up","push_opened","app_open","background","cart_add","checkout","crash"];
  const out: { id: string; name: string; count: number; uniqueDevices: number; deltaPct: number }[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: uuid(r),
      name: NAMES[i % NAMES.length],
      count: Math.floor(2_000 + r() * 1_500_000),
      uniqueDevices: Math.floor(800 + r() * 220_000),
      deltaPct: (r() - 0.45) * 80,
    });
  }
  out.sort((a, b) => b.count - a.count);
  return out;
}

// ==== Quick lookups ====
export function findApp(id?: string): AndroidApp | undefined {
  if (!id) return undefined;
  return APPS.find((a) => a.id === id);
}
export function findCampaign(id?: string): Campaign | undefined {
  if (!id) return undefined;
  return CAMPAIGNS.find((c) => c.id === id);
}
export function appName(id: string): string {
  return APPS.find((a) => a.id === id)?.name ?? "—";
}

export { COUNTRIES, COUNTRY_NAMES };
