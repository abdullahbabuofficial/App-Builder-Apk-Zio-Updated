import { useEffect, useState } from "react";
import * as api from "@/lib/api";
import { useApkzio } from "@/context/ApkzioDataContext";

/**
 * Fetch per-app install trends for sparkline charts.
 * Returns an array of daily install counts.
 */
export function useAppTrends(appId: string, days: number): number[] {
  const { useLiveApi, dataSource } = useApkzio();
  const [trends, setTrends] = useState<number[]>([]);

  useEffect(() => {
    if (dataSource !== "rest" || !useLiveApi) {
      // Mock data fallback - generate stable fake data
      setTrends(generateMockTrends(appId, days));
      return;
    }

    let cancelled = false;

    api.getAppInstallTrends(appId, days)
      .then((data) => {
        if (!cancelled) {
          setTrends(data.trends);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to load app trends:", err);
          setTrends(generateMockTrends(appId, days));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [appId, days, dataSource, useLiveApi]);

  return trends;
}

/**
 * Fetch event-specific trends for drill-in modals.
 * Returns an array of daily event counts.
 */
export function useEventTrends(eventName: string, days: number): number[] {
  const { useLiveApi, dataSource } = useApkzio();
  const [trends, setTrends] = useState<number[]>([]);

  useEffect(() => {
    if (dataSource !== "rest" || !useLiveApi) {
      setTrends(generateMockTrends(eventName, days));
      return;
    }

    let cancelled = false;

    api.getEventTrends(eventName, days)
      .then((data) => {
        if (!cancelled) {
          setTrends(data.trends);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to load event trends:", err);
          setTrends(generateMockTrends(eventName, days));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [eventName, days, dataSource, useLiveApi]);

  return trends;
}

// Simple deterministic generator for fallback data
function generateMockTrends(seed: string, count: number): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash;
  }
  
  const rng = () => {
    hash = (hash * 1664525 + 1013904223) >>> 0;
    return hash / 0xffffffff;
  };

  const result: number[] = [];
  let base = 500 + rng() * 1000;
  
  for (let i = 0; i < count; i++) {
    base *= 0.95 + rng() * 0.1;
    result.push(Math.max(0, Math.floor(base + (rng() - 0.5) * 200)));
  }
  
  return result;
}
