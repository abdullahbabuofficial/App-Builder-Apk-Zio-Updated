import { useEffect, useState } from "react";
import * as api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useApkzio } from "@/context/ApkzioDataContext";
import { dailyInstalls, geoBreakdown, hourlyHeartbeats, recentEvents } from "@/lib/mock-data";
import type { AnalyticsOverview } from "@/lib/api";
import {
  fetchAppsStatsOverview,
  parseAnalyticsSeed,
} from "@/lib/supabase/fetchAppsStatsOverview";

export function useAnalyticsOverview(seed = "global") {
  const { session } = useAuth();
  const { useLiveApi, dataSource, apps, campaigns } = useApkzio();
  const restAnalytics = dataSource === "rest";
  const supabaseAnalytics = dataSource === "supabase";
  const [loading, setLoading] = useState(useLiveApi);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsOverview>(() =>
    useLiveApi
      ? {
          dailyInstalls: [],
          hourlyHeartbeats: [],
          geoBreakdown: [],
          recentEvents: [],
        }
      : {
          dailyInstalls: dailyInstalls(30, seed),
          hourlyHeartbeats: hourlyHeartbeats(48, seed),
          geoBreakdown: geoBreakdown(seed),
          recentEvents: recentEvents(seed),
        },
  );

  useEffect(() => {
    if (!useLiveApi) {
      setLoading(false);
      setError(null);
      setData({
        dailyInstalls: dailyInstalls(30, seed),
        hourlyHeartbeats: hourlyHeartbeats(48, seed),
        geoBreakdown: geoBreakdown(seed),
        recentEvents: recentEvents(seed),
      });
      return;
    }
    if (supabaseAnalytics) {
      const token = session?.access_token;
      if (!token) {
        setLoading(false);
        setError("Sign in with Supabase to load analytics.");
        setData({
          dailyInstalls: [],
          hourlyHeartbeats: [],
          geoBreakdown: [],
          recentEvents: [],
        });
        return;
      }
      const parsed = parseAnalyticsSeed(seed, apps, campaigns);
      if (!parsed) {
        setLoading(false);
        setError(null);
        setData({
          dailyInstalls: [],
          hourlyHeartbeats: [],
          geoBreakdown: [],
          recentEvents: [],
        });
        return;
      }
      let cancelled = false;
      setLoading(true);
      setError(null);
      fetchAppsStatsOverview(token, parsed.appIds, parsed.range)
        .then((d) => {
          if (!cancelled) {
            setData(d);
            setLoading(false);
          }
        })
        .catch((e) => {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : "Failed to load analytics.");
            setData({
              dailyInstalls: [],
              hourlyHeartbeats: [],
              geoBreakdown: [],
              recentEvents: [],
            });
            setLoading(false);
          }
        });
      return () => {
        cancelled = true;
      };
    }

    if (!restAnalytics) {
      setLoading(false);
      setError(null);
      setData({
        dailyInstalls: [],
        hourlyHeartbeats: [],
        geoBreakdown: [],
        recentEvents: [],
      });
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .fetchAnalyticsOverview(seed)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load analytics.");
          setData({
            dailyInstalls: [],
            hourlyHeartbeats: [],
            geoBreakdown: [],
            recentEvents: [],
          });
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [useLiveApi, restAnalytics, supabaseAnalytics, seed, session?.access_token, apps, campaigns]);

  return { ...data, loading, error };
}
