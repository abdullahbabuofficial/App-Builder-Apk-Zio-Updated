import { useCallback, useEffect, useState } from "react";
import * as api from "@/lib/api";
import { useApkzio } from "@/context/ApkzioDataContext";
import { devicesFor, subscribersFor } from "@/lib/mock-data";
import type { Device, Subscriber } from "@/lib/mock-data";
import { supabaseFetchDevices, supabaseFetchSubscribers } from "@/lib/supabase/data";

export type CollectionResult<T> = {
  data: T[];
  error: string | null;
  loading: boolean;
  refetch: () => void;
};

function collectionErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

export function useDevices(appId: string | undefined, sampleCount?: number): CollectionResult<Device> {
  const { useLiveApi, dataSource, supabaseClient } = useApkzio();
  const [devices, setDevices] = useState<Device[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);

  const refetch = useCallback(() => setRetry((n) => n + 1), []);

  useEffect(() => {
    if (!appId) {
      setDevices([]);
      setError(null);
      setLoading(false);
      return;
    }
    if (!useLiveApi) {
      setDevices(devicesFor(appId, sampleCount ?? 80));
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const finishError = (err: unknown) => {
      if (cancelled) return;
      setDevices([]);
      setError(collectionErrorMessage(err));
      setLoading(false);
    };

    const finishOk = (all: Device[]) => {
      if (cancelled) return;
      setDevices(sampleCount ? all.slice(0, sampleCount) : all);
      setError(null);
      setLoading(false);
    };

    if (dataSource === "supabase" && supabaseClient) {
      void supabaseFetchDevices(supabaseClient, appId).then(finishOk).catch(finishError);
      return () => {
        cancelled = true;
      };
    }

    void api.fetchDevices(appId).then(finishOk).catch(finishError);
    return () => {
      cancelled = true;
    };
  }, [appId, useLiveApi, dataSource, supabaseClient, sampleCount, retry]);

  return { data: devices, error, loading, refetch };
}

export function useSubscribers(appId: string | undefined, sampleCount?: number): CollectionResult<Subscriber> {
  const { useLiveApi, dataSource, supabaseClient } = useApkzio();
  const [rows, setRows] = useState<Subscriber[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);

  const refetch = useCallback(() => setRetry((n) => n + 1), []);

  useEffect(() => {
    if (!appId) {
      setRows([]);
      setError(null);
      setLoading(false);
      return;
    }
    if (!useLiveApi) {
      setRows(subscribersFor(appId, sampleCount ?? 60));
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const finishError = (err: unknown) => {
      if (cancelled) return;
      setRows([]);
      setError(collectionErrorMessage(err));
      setLoading(false);
    };

    const finishOk = (all: Subscriber[]) => {
      if (cancelled) return;
      setRows(sampleCount ? all.slice(0, sampleCount) : all);
      setError(null);
      setLoading(false);
    };

    if (dataSource === "supabase" && supabaseClient) {
      void supabaseFetchSubscribers(supabaseClient, appId).then(finishOk).catch(finishError);
      return () => {
        cancelled = true;
      };
    }

    void api.fetchSubscribers(appId).then(finishOk).catch(finishError);
    return () => {
      cancelled = true;
    };
  }, [appId, useLiveApi, dataSource, supabaseClient, sampleCount, retry]);

  return { data: rows, error, loading, refetch };
}
