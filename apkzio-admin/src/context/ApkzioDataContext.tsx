import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as api from "@/lib/api";
import {
  APKZIO_API_URL,
  resolveDataSource,
  type ApkzioDataSource,
} from "@/lib/config";
import { useAuth } from "@/context/AuthContext";
import type { Campaign } from "@/lib/mock-data";
import {
  APPS as MOCK_APPS,
  CAMPAIGNS as MOCK_CAMPAIGNS,
  API_KEYS as MOCK_KEYS,
  BUILDS as MOCK_BUILDS,
} from "@/lib/mock-data";
import type { AndroidApp, ApiKey, ApkBuild } from "@/lib/mock-data";
import { supabaseBrowser } from "@/lib/supabase/client";
import {
  supabaseFetchDashboard,
  supabaseInsertApp,
  supabaseUpdateApp,
  supabaseDeleteApp,
  supabaseInsertCampaign,
} from "@/lib/supabase/data";

type ApkzioCtx = {
  dataSource: ApkzioDataSource;
  useLiveApi: boolean;
  apiBaseUrl: string;
  /** From `GET /api/status` on the REST API; null if mock mode or status unavailable. */
  adminAuthEnforced: boolean | null;
  supabaseClient: SupabaseClient | null;
  loading: boolean;
  error: string | null;
  apps: AndroidApp[];
  campaigns: Campaign[];
  apiKeys: ApiKey[];
  builds: ApkBuild[];
  refresh: () => Promise<void>;
  createCampaign: (input: api.CreateCampaignInput & { recipients_hint?: number }) => Promise<Campaign>;
  /** REST API only — pause a scheduled campaign. */
  pauseCampaignById: (id: string) => Promise<Campaign>;
  /** REST API only — cancel a scheduled campaign. */
  cancelCampaignById: (id: string) => Promise<Campaign>;
  /** REST API only — duplicate an existing campaign. */
  duplicateCampaignById: (id: string) => Promise<Campaign>;
  /** Send a draft campaign immediately. REST + mock; Supabase still uses create flow. */
  sendCampaignById: (id: string) => Promise<Campaign>;
  createApp: (input: api.CreateAppInput) => Promise<AndroidApp>;
  updateApp: (id: string, patch: api.UpdateAppInput) => Promise<AndroidApp>;
  deleteApp: (id: string) => Promise<void>;
  findApp: (id?: string) => AndroidApp | undefined;
  findCampaign: (id?: string) => Campaign | undefined;
  appName: (id: string) => string;
};

const Ctx = createContext<ApkzioCtx | null>(null);

function syntheticCampaign(
  apps: AndroidApp[],
  input: api.CreateCampaignInput & { recipients_hint?: number },
): Campaign {
  const app = apps.find((a) => a.id === input.app_id);
  const recipients = input.recipients_hint ?? Math.floor((app?.active_devices_24h ?? 1000) * 0.5);
  const now = new Date().toISOString();
  const scheduled = input.scheduled_at && new Date(input.scheduled_at) > new Date();
  const sent = scheduled ? 0 : recipients;
  const delivered = scheduled ? 0 : Math.floor(sent * 0.84);
  const opened = scheduled ? 0 : Math.floor(delivered * 0.09);
  const clicked = scheduled ? 0 : Math.floor(opened * 0.2);

  let target_summary = "";
  if (input.target_type === "all") target_summary = "All subscribers";
  else if (input.target_type === "active") {
    const m = input.active_within_minutes ?? 1440;
    target_summary = m >= 1440 ? `Active in last ${Math.round(m / 1440)}d` : `Active in last ${m}m`;
  } else if (input.target_type === "country") target_summary = (input.country_codes ?? []).join(", ");
  else target_summary = `${(input.device_ids ?? []).length || 250} devices`;

  return {
    id: crypto.randomUUID(),
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
    status: scheduled ? "scheduled" : "sent",
    created_at: now,
    scheduled_at: scheduled ? input.scheduled_at! : null,
    sent_at: scheduled ? null : now,
    recipients_count: recipients,
    sent_count: sent,
    delivered_count: delivered,
    opened_count: opened,
    clicked_count: clicked,
    failed_count: Math.max(0, sent - delivered),
  };
}

function syntheticApp(input: api.CreateAppInput): AndroidApp {
  const name = input.name.trim();
  const pkg = input.package_name.trim();
  const glyph = (input.icon_glyph?.trim() || name.slice(0, 2) || "AP").toUpperCase().slice(0, 2);
  const keySuffix = Array.from({ length: 48 }, () =>
    "0123456789abcdef"[Math.floor(Math.random() * 16)],
  ).join("");
  return {
    id: crypto.randomUUID(),
    name,
    package_name: pkg,
    app_key: `pk_${keySuffix}`,
    status: "active",
    icon_color: input.icon_color?.trim() || "from-violet-500/25 to-indigo-600/35",
    icon_glyph: glyph,
    total_installs: 0,
    active_devices_24h: 0,
    live_users: 0,
    total_pushes_sent: 0,
    delivery_rate: 0,
    open_rate: 0,
    created_at: new Date().toISOString(),
    fcm_project_id: input.fcm_project_id?.trim() || null,
  };
}

export function ApkzioProvider({ children }: { children: ReactNode }) {
  const { signedIn, session, ready: authReady } = useAuth();
  const dataSource = resolveDataSource(Boolean(session?.user));
  const useLiveApi = dataSource !== "mock";

  const [loading, setLoading] = useState(useLiveApi);
  const [error, setError] = useState<string | null>(null);
  const [apps, setApps] = useState<AndroidApp[]>(() => (!useLiveApi ? MOCK_APPS : []));
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => (!useLiveApi ? MOCK_CAMPAIGNS : []));
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(() => (!useLiveApi ? MOCK_KEYS : []));
  const [builds, setBuilds] = useState<ApkBuild[]>(() => (!useLiveApi ? MOCK_BUILDS : []));

  const [adminAuthEnforced, setAdminAuthEnforced] = useState<boolean | null>(null);

  useEffect(() => {
    if (!APKZIO_API_URL || dataSource === "mock") {
      setAdminAuthEnforced(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const base = APKZIO_API_URL.replace(/\/$/, "");
        const res = await fetch(`${base}/api/status`);
        if (!res.ok) {
          if (!cancelled) setAdminAuthEnforced(null);
          return;
        }
        const data = (await res.json()) as {
          ok?: boolean;
          features?: { admin_auth_enforced?: boolean };
        };
        if (cancelled) return;
        const raw = data?.features?.admin_auth_enforced;
        setAdminAuthEnforced(typeof raw === "boolean" ? raw : null);
      } catch {
        if (!cancelled) setAdminAuthEnforced(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [APKZIO_API_URL, dataSource]);

  const refresh = useCallback(async () => {
    if (!authReady || !signedIn) {
      if (!signedIn && useLiveApi) {
        setApps([]);
        setCampaigns([]);
        setApiKeys([]);
        setBuilds([]);
      }
      setLoading(false);
      setError(null);
      return;
    }

    if (dataSource === "mock") {
      setApps(MOCK_APPS);
      setCampaigns(MOCK_CAMPAIGNS);
      setApiKeys(MOCK_KEYS);
      setBuilds(MOCK_BUILDS);
      setLoading(false);
      setError(null);
      return;
    }

    if (dataSource === "rest") {
      setLoading(true);
      setError(null);
      try {
        const [a, c, k, b] = await Promise.all([
          api.fetchApps(),
          api.fetchCampaigns(),
          api.fetchApiKeys(),
          api.fetchBuilds(),
        ]);
        setApps(a);
        setCampaigns(c);
        setApiKeys(k);
        setBuilds(b);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!supabaseBrowser) {
      setError("Supabase client not available");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const d = await supabaseFetchDashboard(supabaseBrowser);
      setApps(d.apps);
      setCampaigns(d.campaigns);
      setApiKeys(d.apiKeys);
      setBuilds(d.builds);
      setError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load";
      setError(
        msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("rls")
          ? `${msg} — ensure app_owners.auth_user_id matches your Supabase Auth user id.`
          : msg,
      );
    } finally {
      setLoading(false);
    }
  }, [authReady, signedIn, dataSource, useLiveApi]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (dataSource === "rest") {
      api.setApkzioRestAccessToken(session?.access_token ?? null);
    } else {
      api.setApkzioRestAccessToken(null);
    }
    return () => {
      api.setApkzioRestAccessToken(null);
    };
  }, [dataSource, session?.access_token]);

  const createCampaign = useCallback(
    async (input: api.CreateCampaignInput & { recipients_hint?: number }) => {
      if (dataSource === "mock") {
        const camp = syntheticCampaign(apps.length ? apps : MOCK_APPS, input);
        setCampaigns((prev) => [camp, ...prev]);
        setApps((prev) => {
          const list = prev.length ? prev : MOCK_APPS;
          return list.map((ap) =>
            ap.id === input.app_id && !input.scheduled_at
              ? { ...ap, total_pushes_sent: ap.total_pushes_sent + camp.sent_count }
              : ap,
          );
        });
        return camp;
      }

      if (dataSource === "rest") {
        const camp = await api.postCampaign(input);
        await refresh();
        return camp;
      }

      if (!supabaseBrowser) throw new Error("Supabase not configured");
      const appRow = apps.find((a) => a.id === input.app_id);
      const ownerId = appRow?.owner_id;
      if (!ownerId) throw new Error("Missing owner_id for app — refresh apps from Supabase.");

      const camp = await supabaseInsertCampaign(supabaseBrowser, {
        app_id: input.app_id,
        owner_id: ownerId,
        title: input.title,
        body: input.body,
        image_url: input.image_url,
        click_action_url: input.click_url,
        target_type: input.target_type,
        active_within_minutes: input.active_within_minutes,
        country_codes: input.country_codes,
        device_ids: input.device_ids,
        scheduled_at: input.scheduled_at,
      });
      await refresh();
      return camp;
    },
    [dataSource, apps, refresh],
  );

  const pauseCampaignById = useCallback(
    async (id: string) => {
      if (dataSource !== "rest") {
        throw new Error("Pause is only available when using the ApkZio REST API data source.");
      }
      const camp = await api.pauseCampaign(id);
      await refresh();
      return camp;
    },
    [dataSource, refresh],
  );

  const cancelCampaignById = useCallback(
    async (id: string) => {
      if (dataSource !== "rest") {
        throw new Error("Cancel is only available when using the ApkZio REST API data source.");
      }
      const camp = await api.cancelCampaign(id);
      await refresh();
      return camp;
    },
    [dataSource, refresh],
  );

  const duplicateCampaignById = useCallback(
    async (id: string) => {
      if (dataSource !== "rest") {
        throw new Error("Duplicate is only available when using the ApkZio REST API data source.");
      }
      const camp = await api.duplicateCampaign(id);
      await refresh();
      return camp;
    },
    [dataSource, refresh],
  );

  const sendCampaignById = useCallback(
    async (id: string) => {
      if (dataSource === "mock") {
        let sent: Campaign | undefined;
        setCampaigns((prev) =>
          prev.map((camp) => {
            if (camp.id !== id) return camp;
            if (camp.status !== "draft") throw new Error("Only draft campaigns can be sent.");
            const app = apps.find((a) => a.id === camp.app_id);
            const recipients = camp.target_type === "device_list"
              ? camp.device_ids?.length ?? 0
              : camp.recipients_count || Math.max(1, Math.floor((app?.active_devices_24h ?? 1000) * 0.5));
            sent = {
              ...camp,
              status: "sent",
              scheduled_at: null,
              sent_at: new Date().toISOString(),
              recipients_count: recipients,
              sent_count: recipients,
              delivered_count: Math.floor(recipients * 0.84),
              opened_count: Math.floor(recipients * 0.084),
              clicked_count: Math.floor(recipients * 0.017),
              failed_count: Math.max(0, recipients - Math.floor(recipients * 0.84)),
            };
            return sent;
          }),
        );
        if (!sent) throw new Error("Campaign not found.");
        return sent;
      }
      if (dataSource === "rest") {
        const camp = await api.sendCampaign(id);
        await refresh();
        return camp;
      }
      throw new Error("Send from campaign detail is not available in Supabase mode. Use Create campaign to send immediately.");
    },
    [dataSource, apps, refresh],
  );

  const createApp = useCallback(
    async (input: api.CreateAppInput) => {
      if (dataSource === "mock") {
        const row = syntheticApp(input);
        setApps((prev) => [row, ...prev]);
        return row;
      }
      if (dataSource === "rest") {
        const row = await api.createApp(input);
        await refresh();
        return row;
      }
      if (!supabaseBrowser) throw new Error("Supabase not configured");
      const row = await supabaseInsertApp(supabaseBrowser, input);
      await refresh();
      return row;
    },
    [dataSource, refresh],
  );

  const updateApp = useCallback(
    async (id: string, patch: api.UpdateAppInput) => {
      if (dataSource === "mock") {
        let updated: AndroidApp | undefined;
        setApps((prev) =>
          prev.map((app) => {
            if (app.id !== id) return app;
            updated = {
              ...app,
              ...patch,
              fcm_project_id: patch.fcm_project_id === undefined ? app.fcm_project_id : patch.fcm_project_id,
              icon_glyph: patch.icon_glyph?.trim() || app.icon_glyph,
              icon_color: patch.icon_color?.trim() || app.icon_color,
            };
            return updated;
          }),
        );
        if (!updated) throw new Error("App not found.");
        return updated;
      }
      if (dataSource === "rest") {
        const row = await api.updateApp(id, patch);
        await refresh();
        return row;
      }
      if (!supabaseBrowser) throw new Error("Supabase not configured");
      const row = await supabaseUpdateApp(supabaseBrowser, id, patch);
      await refresh();
      return row;
    },
    [dataSource, refresh],
  );

  const deleteApp = useCallback(
    async (id: string) => {
      if (dataSource === "mock") {
        setApps((prev) => prev.filter((app) => app.id !== id));
        setCampaigns((prev) => prev.filter((campaign) => campaign.app_id !== id));
        setApiKeys((prev) => prev.filter((key) => key.app_id !== id));
        setBuilds((prev) => prev.filter((build) => build.app_id !== id));
        return;
      }
      if (dataSource === "rest") {
        await api.deleteApp(id);
        await refresh();
        return;
      }
      if (!supabaseBrowser) throw new Error("Supabase not configured");
      await supabaseDeleteApp(supabaseBrowser, id);
      await refresh();
    },
    [dataSource, refresh],
  );

  const findApp = useCallback(
    (id?: string) => {
      if (!id) return undefined;
      return apps.find((a) => a.id === id);
    },
    [apps],
  );

  const findCampaign = useCallback(
    (id?: string) => {
      if (!id) return undefined;
      return campaigns.find((c) => c.id === id);
    },
    [campaigns],
  );

  const appName = useCallback(
    (id: string) => {
      return apps.find((a) => a.id === id)?.name ?? "—";
    },
    [apps],
  );

  const value = useMemo(
    (): ApkzioCtx => ({
      dataSource,
      useLiveApi,
      apiBaseUrl: APKZIO_API_URL,
      adminAuthEnforced,
      supabaseClient: supabaseBrowser,
      loading: loading || !authReady,
      error,
      apps,
      campaigns,
      apiKeys,
      builds,
      refresh,
      createCampaign,
      pauseCampaignById,
      cancelCampaignById,
      duplicateCampaignById,
      sendCampaignById,
      createApp,
      updateApp,
      deleteApp,
      findApp,
      findCampaign,
      appName,
    }),
    [
      dataSource,
      useLiveApi,
      adminAuthEnforced,
      loading,
      authReady,
      error,
      apps,
      campaigns,
      apiKeys,
      builds,
      refresh,
      createCampaign,
      pauseCampaignById,
      cancelCampaignById,
      duplicateCampaignById,
      sendCampaignById,
      createApp,
      updateApp,
      deleteApp,
      findApp,
      findCampaign,
      appName,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApkzio(): ApkzioCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApkzio must be used within ApkzioProvider");
  return v;
}
