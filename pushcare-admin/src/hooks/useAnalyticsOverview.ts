import { useEffect, useState } from "react";
import * as api from "@/lib/api";
import { usePushcare } from "@/context/PushcareDataContext";
import { dailyInstalls, geoBreakdown, hourlyHeartbeats, recentEvents } from "@/lib/mock-data";
import type { AnalyticsOverview } from "@/lib/api";

export function useAnalyticsOverview(seed = "global") {
  const { useLiveApi } = usePushcare();
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
    let cancelled = false;
    api.fetchAnalyticsOverview(seed).then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, [useLiveApi, seed]);

  return data;
}
