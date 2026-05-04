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
  PUSHCARE_API_URL,
  resolveDataSource,
  type PushcareDataSource,
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
  supabaseInsertCampaign,
} from "@/lib/supabase/data";

type PushcareCtx = {
  dataSource: PushcareDataSource;
  useLiveApi: boolean;
  apiBaseUrl: string;
  supabaseClient: SupabaseClient | null;
  loading: boolean;
  error: string | null;
  apps: AndroidApp[];
  campaigns: Campaign[];
  apiKeys: ApiKey[];
  builds: ApkBuild[];
  refresh: () => Promise<void>;
  createCampaign: (input: api.CreateCampaignInput & { recipients_hint?: number }) => Promise<Campaign>;
  findApp: (id?: string) => AndroidApp | undefined;
  findCampaign: (id?: string) => Campaign | undefined;
  appName: (id: string) => string;
};

const Ctx = createContext<PushcareCtx | null>(null);

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

export function PushcareProvider({ children }: { children: ReactNode }) {
  const { signedIn, session, ready: authReady } = useAuth();
  const dataSource = resolveDataSource(Boolean(session?.user));
  const useLiveApi = dataSource !== "mock";

  const [loading, setLoading] = useState(useLiveApi);
  const [error, setError] = useState<string | null>(null);
  const [apps, setApps] = useState<AndroidApp[]>(() => (!useLiveApi ? MOCK_APPS : []));
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => (!useLiveApi ? MOCK_CAMPAIGNS : []));
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(() => (!useLiveApi ? MOCK_KEYS : []));
  const [builds, setBuilds] = useState<ApkBuild[]>(() => (!useLiveApi ? MOCK_BUILDS : []));

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
      api.setPushcareRestAccessToken(session?.access_token ?? null);
    } else {
      api.setPushcareRestAccessToken(null);
    }
    return () => {
      api.setPushcareRestAccessToken(null);
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
    (): PushcareCtx => ({
      dataSource,
      useLiveApi,
      apiBaseUrl: PUSHCARE_API_URL,
      supabaseClient: supabaseBrowser,
      loading: loading || !authReady,
      error,
      apps,
      campaigns,
      apiKeys,
      builds,
      refresh,
      createCampaign,
      findApp,
      findCampaign,
      appName,
    }),
    [
      dataSource,
      useLiveApi,
      loading,
      authReady,
      error,
      apps,
      campaigns,
      apiKeys,
      builds,
      refresh,
      createCampaign,
      findApp,
      findCampaign,
      appName,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePushcare(): PushcareCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePushcare must be used within PushcareProvider");
  return v;
}
