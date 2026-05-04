import type { SupabaseClient } from "@supabase/supabase-js";
import type { AndroidApp, ApiKey, ApkBuild, Campaign, CampaignStatus, Device, Subscriber } from "@/lib/mock-data";

const ICON_COLORS = [
  "from-emerald-500/20 to-emerald-500/5",
  "from-fuchsia-500/20 to-fuchsia-500/5",
  "from-orange-500/20 to-orange-500/5",
  "from-sky-500/20 to-sky-500/5",
  "from-amber-500/20 to-amber-500/5",
  "from-lime-500/20 to-lime-500/5",
  "from-rose-500/20 to-rose-500/5",
] as const;

function iconGlyph(packageName: string): string {
  const parts = packageName.split(".").filter(Boolean);
  const last = parts[parts.length - 1] ?? "PC";
  return last.slice(0, 2).toUpperCase().padEnd(2, "X").slice(0, 2);
}

function iconColor(packageName: string): string {
  let h = 0;
  for (let i = 0; i < packageName.length; i++) h += packageName.charCodeAt(i);
  return ICON_COLORS[h % ICON_COLORS.length]!;
}

function mapAppStatus(db: string): AndroidApp["status"] {
  if (db === "suspended") return "suspended";
  if (db === "archived") return "paused";
  return "active";
}

type VMyAppRow = {
  app_id: string;
  owner_id: string;
  app_key: string;
  package_name: string;
  app_name: string | null;
  icon_url: string | null;
  status: string;
  total_installs: number;
  active_installs: number;
  total_uninstalls: number;
  live_users: number;
  counters_synced_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export function mapAndroidApp(row: VMyAppRow, extras: { pushCount: number }): AndroidApp {
  const meta = row.metadata ?? {};
  const fcm =
    typeof meta.fcm_project_id === "string"
      ? meta.fcm_project_id
      : typeof meta.fcmProjectId === "string"
        ? meta.fcmProjectId
        : null;

  const sent = extras.pushCount;
  return {
    id: row.app_id,
    owner_id: row.owner_id,
    name: row.app_name ?? row.package_name,
    package_name: row.package_name,
    app_key: row.app_key,
    status: mapAppStatus(row.status),
    icon_color: iconColor(row.package_name),
    icon_glyph: iconGlyph(row.package_name),
    total_installs: Number(row.total_installs),
    active_devices_24h: Number(row.active_installs),
    live_users: Number(row.live_users),
    total_pushes_sent: sent,
    delivery_rate: 0.88,
    open_rate: 0.09,
    created_at: row.created_at,
    fcm_project_id: fcm,
  };
}

function mapCampaignStatus(row: { status: string; scheduled_at: string | null }): CampaignStatus {
  if (row.status === "queued" && row.scheduled_at && new Date(row.scheduled_at) > new Date()) {
    return "scheduled";
  }
  if (row.status === "cancelled") return "failed";
  const s = row.status as CampaignStatus;
  if (
    s === "draft" ||
    s === "queued" ||
    s === "dispatching" ||
    s === "sent" ||
    s === "failed" ||
    s === "scheduled"
  )
    return s;
  return "sent";
}

function targetSummary(row: {
  target_type: string;
  target_countries: string[] | null;
  target_device_ids: string[] | null;
  active_window_min: number | null;
}): string {
  const t = row.target_type;
  if (t === "all") return "All subscribers";
  if (t === "active") {
    const m = row.active_window_min ?? 1440;
    return m >= 1440 ? `Active in last ${Math.round(m / 1440)}d` : `Active in last ${m}m`;
  }
  if (t === "country") return (row.target_countries ?? []).join(", ") || "Countries";
  if (t === "device_list") return `${(row.target_device_ids ?? []).length} devices`;
  return row.target_type;
}

export type NotifRow = {
  notification_id: string;
  app_id: string;
  title: string;
  body: string;
  image_url: string | null;
  click_action_url: string | null;
  target_type: Campaign["target_type"];
  target_countries: string[] | null;
  target_device_ids: string[] | null;
  active_window_min: number | null;
  status: string;
  scheduled_at: string | null;
  dispatched_at: string | null;
  completed_at: string | null;
  recipients_count: number;
  sent_count: number;
  delivered_count: number;
  opened_count: number;
  clicked_count: number;
  failed_count: number;
  created_at: string;
};

export function mapCampaignRow(row: NotifRow): Campaign {
  return {
    id: row.notification_id,
    app_id: row.app_id,
    title: row.title,
    body: row.body,
    image_url: row.image_url,
    click_url: row.click_action_url,
    target_type: row.target_type,
    target_summary: targetSummary(row),
    status: mapCampaignStatus(row),
    created_at: row.created_at,
    scheduled_at: row.scheduled_at,
    sent_at: row.completed_at ?? row.dispatched_at,
    recipients_count: Number(row.recipients_count),
    sent_count: Number(row.sent_count),
    delivered_count: Number(row.delivered_count),
    opened_count: Number(row.opened_count),
    clicked_count: Number(row.clicked_count),
    failed_count: Number(row.failed_count),
  };
}

function bytesToInstallHashDisplay(raw: string | null): string {
  if (!raw) return "—";
  const hex = raw.startsWith("\\x") ? raw.slice(2) : raw.replace(/^0x/i, "");
  return hex.slice(0, 16);
}

type DeviceRow = {
  device_id: string;
  app_id: string;
  install_hash: string;
  manufacturer: string | null;
  model: string | null;
  os_version: string | null;
  app_version: string | null;
  country_code: string | null;
  is_active: boolean;
  first_seen_at: string;
  last_seen_at: string;
};

export function mapDeviceRow(row: DeviceRow): Device {
  const last = new Date(row.last_seen_at).getTime();
  const active24 = Date.now() - last < 86400_000;
  return {
    id: row.device_id,
    app_id: row.app_id,
    install_hash: typeof row.install_hash === "string" ? bytesToInstallHashDisplay(row.install_hash) : "—",
    country_code: row.country_code ?? "—",
    manufacturer: row.manufacturer ?? "—",
    model: row.model ?? "—",
    os_version: row.os_version ?? "—",
    app_version: row.app_version ?? "—",
    is_active: row.is_active && active24,
    first_seen_at: row.first_seen_at,
    last_seen_at: row.last_seen_at,
  };
}

type SubRow = {
  subscriber_id: string;
  app_id: string;
  device_id: string;
  token_preview: string;
  is_valid: boolean;
  last_validated_at: string;
};

export function mapSubscriberRow(row: SubRow): Subscriber {
  return {
    id: row.subscriber_id,
    app_id: row.app_id,
    device_id: row.device_id,
    fcm_token_redacted: row.token_preview.startsWith("fcm_") ? row.token_preview : `fcm_${row.token_preview}`,
    is_valid: row.is_valid,
    last_seen_at: row.last_validated_at,
  };
}

type ApiKeyRow = {
  key_id: string;
  app_id: string | null;
  key_prefix: string;
  scopes: string[];
  rate_limit_rpm: number;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
};

export function mapApiKeyRow(row: ApiKeyRow): ApiKey {
  return {
    id: row.key_id,
    app_id: row.app_id ?? "",
    name: row.key_prefix,
    key_preview: `${row.key_prefix}…`,
    scopes: row.scopes ?? [],
    rate_limit_rpm: row.rate_limit_rpm,
    is_active: row.is_active,
    last_used_at: row.last_used_at,
    expires_at: row.expires_at,
    created_at: row.created_at,
  };
}

type BuildRow = {
  build_id: string;
  app_id: string;
  version_name: string;
  version_code: number;
  build_status: string;
  apk_url: string | null;
  apk_size_bytes: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

function mapBuildStatus(s: string): ApkBuild["status"] {
  if (s === "pending") return "queued";
  if (s === "building") return "building";
  if (s === "succeeded") return "success";
  return "failed";
}

export function mapBuildRow(row: BuildRow): ApkBuild {
  const start = row.started_at ?? row.created_at;
  const end = row.completed_at;
  const dur =
    start && end ? Math.max(0, new Date(end).getTime() - new Date(start).getTime()) : null;
  return {
    id: row.build_id,
    app_id: row.app_id,
    version_code: row.version_code,
    version_name: row.version_name,
    status: mapBuildStatus(row.build_status),
    build_started_at: start,
    build_completed_at: end,
    size_bytes: row.apk_size_bytes,
    output_url: row.apk_url,
    duration_ms: dur,
    triggered_by: "system",
  };
}

export async function supabaseFetchDashboard(client: SupabaseClient): Promise<{
  apps: AndroidApp[];
  campaigns: Campaign[];
  apiKeys: ApiKey[];
  builds: ApkBuild[];
}> {
  const { data: appRows, error: appErr } = await client.from("v_my_apps").select("*");
  if (appErr) throw new Error(appErr.message);

  const { data: notifRows, error: nErr } = await client
    .from("app_push_notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (nErr) throw new Error(nErr.message);

  const counts: Record<string, number> = {};
  for (const n of notifRows ?? []) {
    const aid = (n as NotifRow).app_id;
    counts[aid] = (counts[aid] ?? 0) + 1;
  }

  const apps = (appRows as VMyAppRow[]).map((row) =>
    mapAndroidApp(row, { pushCount: counts[row.app_id] ?? 0 }),
  );

  const campaigns = (notifRows as NotifRow[]).map(mapCampaignRow);

  const { data: keyRows, error: kErr } = await client.from("v_my_api_keys").select("*");
  if (kErr) throw new Error(kErr.message);

  const { data: buildRows, error: bErr } = await client
    .from("apk_builds")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (bErr) throw new Error(bErr.message);

  return {
    apps,
    campaigns,
    apiKeys: (keyRows as ApiKeyRow[]).map(mapApiKeyRow),
    builds: (buildRows as BuildRow[]).map(mapBuildRow),
  };
}

export async function supabaseFetchDevices(client: SupabaseClient, appId: string): Promise<Device[]> {
  const { data, error } = await client
    .from("app_devices")
    .select("*")
    .eq("app_id", appId)
    .order("last_seen_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as DeviceRow[]).map(mapDeviceRow);
}

export async function supabaseFetchSubscribers(client: SupabaseClient, appId: string): Promise<Subscriber[]> {
  const { data, error } = await client
    .from("v_subscriber_status")
    .select("*")
    .eq("app_id", appId)
    .order("last_validated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as SubRow[]).map(mapSubscriberRow);
}

export type CreateCampaignSupabaseInput = {
  app_id: string;
  owner_id: string;
  title: string;
  body: string;
  image_url?: string | null;
  click_action_url?: string | null;
  target_type: Campaign["target_type"];
  active_within_minutes?: number;
  country_codes?: string[];
  device_ids?: string[];
  scheduled_at?: string | null;
};

export async function supabaseInsertCampaign(
  client: SupabaseClient,
  input: CreateCampaignSupabaseInput,
): Promise<Campaign> {
  const scheduled = Boolean(input.scheduled_at && new Date(input.scheduled_at) > new Date());
  const insertPayload = {
    app_id: input.app_id,
    owner_id: input.owner_id,
    title: input.title,
    body: input.body,
    image_url: input.image_url ?? null,
    click_action_url: input.click_action_url ?? null,
    target_type: input.target_type,
    target_countries: input.target_type === "country" ? input.country_codes ?? [] : null,
    target_device_ids: input.target_type === "device_list" ? input.device_ids ?? [] : null,
    active_window_min: input.active_within_minutes ?? 1440,
    status: "queued" as const,
    scheduled_at: scheduled ? input.scheduled_at : null,
    recipients_count: 0,
    sent_count: 0,
    delivered_count: 0,
    opened_count: 0,
    clicked_count: 0,
    failed_count: 0,
  };

  const { data, error } = await client
    .from("app_push_notifications")
    .insert(insertPayload)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapCampaignRow(data as NotifRow);
}
