import { useEffect, useState } from "react";
import * as api from "@/lib/api";
import { usePushcare } from "@/context/PushcareDataContext";
import { devicesFor, subscribersFor } from "@/lib/mock-data";
import type { Device, Subscriber } from "@/lib/mock-data";
import { supabaseFetchDevices, supabaseFetchSubscribers } from "@/lib/supabase/data";

export function useDevices(appId: string | undefined, sampleCount?: number) {
  const { useLiveApi, dataSource, supabaseClient } = usePushcare();
  const [devices, setDevices] = useState<Device[]>([]);

  useEffect(() => {
    if (!appId) {
      setDevices([]);
      return;
    }
    if (!useLiveApi) {
      setDevices(devicesFor(appId, sampleCount ?? 80));
      return;
    }
    let cancelled = false;

    if (dataSource === "supabase" && supabaseClient) {
      supabaseFetchDevices(supabaseClient, appId).then((all) => {
        if (cancelled) return;
        setDevices(sampleCount ? all.slice(0, sampleCount) : all);
      });
      return () => {
        cancelled = true;
      };
    }

    api.fetchDevices(appId).then((all) => {
      if (cancelled) return;
      setDevices(sampleCount ? all.slice(0, sampleCount) : all);
    });
    return () => {
      cancelled = true;
    };
  }, [appId, useLiveApi, dataSource, supabaseClient, sampleCount]);

  return devices;
}

export function useSubscribers(appId: string | undefined, sampleCount?: number) {
  const { useLiveApi, dataSource, supabaseClient } = usePushcare();
  const [rows, setRows] = useState<Subscriber[]>([]);

  useEffect(() => {
    if (!appId) {
      setRows([]);
      return;
    }
    if (!useLiveApi) {
      setRows(subscribersFor(appId, sampleCount ?? 60));
      return;
    }
    let cancelled = false;

    if (dataSource === "supabase" && supabaseClient) {
      supabaseFetchSubscribers(supabaseClient, appId).then((all) => {
        if (cancelled) return;
        setRows(sampleCount ? all.slice(0, sampleCount) : all);
      });
      return () => {
        cancelled = true;
      };
    }

    api.fetchSubscribers(appId).then((all) => {
      if (cancelled) return;
      setRows(sampleCount ? all.slice(0, sampleCount) : all);
    });
    return () => {
      cancelled = true;
    };
  }, [appId, useLiveApi, dataSource, supabaseClient, sampleCount]);

  return rows;
}
