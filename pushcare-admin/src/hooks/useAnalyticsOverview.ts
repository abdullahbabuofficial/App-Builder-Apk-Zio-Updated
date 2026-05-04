import { useEffect, useState } from "react";
import * as api from "@/lib/api";
import { usePushcare } from "@/context/PushcareDataContext";
import { dailyInstalls, geoBreakdown, hourlyHeartbeats, recentEvents } from "@/lib/mock-data";
import type { AnalyticsOverview } from "@/lib/api";

export function useAnalyticsOverview(seed = "global") {
  const { useLiveApi, dataSource } = usePushcare();
  const restAnalytics = dataSource === "rest";
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
      setData({
        dailyInstalls: dailyInstalls(30, seed),
        hourlyHeartbeats: hourlyHeartbeats(48, seed),
        geoBreakdown: geoBreakdown(seed),
        recentEvents: recentEvents(seed),
      });
      return;
    }
    if (!restAnalytics) {
      setData({
        dailyInstalls: [],
        hourlyHeartbeats: [],
        geoBreakdown: [],
        recentEvents: [],
      });
      return;
    }
    let cancelled = false;
    api
      .fetchAnalyticsOverview(seed)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled)
          setData({
            dailyInstalls: [],
            hourlyHeartbeats: [],
            geoBreakdown: [],
            recentEvents: [],
          });
      });
    return () => {
      cancelled = true;
    };
  }, [useLiveApi, restAnalytics, seed]);

  return data;
}
