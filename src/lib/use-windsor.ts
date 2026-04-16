"use client";

import { useState, useEffect } from "react";

interface UseWindsorOptions {
  clientSlug: string;
  type?: "campaigns" | "creatives" | "ga4" | "rsa_assets" | "keyword_qs" | "search_terms" | "tiktok_creatives";
  days?: number;
  /** YYYY-MM-DD start date — when provided, uses date range instead of days preset */
  dateFrom?: string;
  /** YYYY-MM-DD end date — when provided, uses date range instead of days preset */
  dateTo?: string;
}

interface UseWindsorResult<T> {
  data: T | null;
  source: "windsor" | "mock";
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch Windsor.ai data via the API proxy.
 * Returns { data, source, loading, error }.
 *
 * If Windsor returns 503 (no key), source is "mock" and data is null — the
 * calling component should fall back to mock-data.ts functions.
 */
export function useWindsor<T = unknown>({
  clientSlug,
  type = "campaigns",
  days = 30,
  dateFrom,
  dateTo,
}: UseWindsorOptions): UseWindsorResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [source, setSource] = useState<"windsor" | "mock">("mock");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        // When custom date range is provided, pass date_from/date_to instead of days
        const params = new URLSearchParams({
          client: clientSlug,
          type,
        });
        if (dateFrom && dateTo) {
          params.set("date_from", dateFrom);
          params.set("date_to", dateTo);
        } else {
          params.set("days", String(days));
        }
        const res = await fetch(
          `/api/windsor?${params.toString()}`,
        );
        const json = await res.json();

        if (cancelled) return;

        if (res.status === 503 || json.useMock) {
          // No API key — caller should use mock data
          setSource("mock");
          setData(null);
        } else if (!res.ok) {
          setError(json.error || `Windsor API error: ${res.status}`);
          setSource("mock");
          setData(null);
        } else {
          setData(json.data as T);
          setSource("windsor");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to fetch");
          setSource("mock");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [clientSlug, type, days, dateFrom, dateTo]);

  return { data, source, loading, error };
}
