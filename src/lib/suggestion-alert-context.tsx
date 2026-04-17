"use client";

/**
 * Suggestion Alert Context
 *
 * Owns:
 *  1. Fetching Windsor data (creatives + campaigns + previous period) on mount.
 *  2. Running `runSuggestionRules` against that data.
 *  3. Filtering via localStorage (done / snoozed / dismissed).
 *  4. 15-minute in-memory cache keyed per client slug.
 *  5. Manual refresh.
 *
 * Consumers:
 *  - Sidebar (reads `summary` for green dot + count badge)
 *  - Suggestions page + widget (reads `suggestions` and mutators)
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useClient } from "./client-context";
import { aggregateCreatives } from "./creativeAggregator";
import { runSuggestionRules } from "./suggestionRules";
import {
  computeSuggestionAlerts,
  type SuggestionAlertSummary,
} from "./suggestion-alerts";
import {
  filterActiveSuggestions,
  markDone as storageMarkDone,
  snooze as storageSnooze,
  dismiss as storageDismiss,
} from "./suggestionStorage";
import type { Suggestion } from "./types";
import type { WindsorRow } from "./windsor";

const CACHE_TTL_MS = 15 * 60 * 1000;
const FETCH_DAYS = 30;
const PREVIOUS_DAYS = 7;

interface SuggestionAlertContextValue {
  summary: SuggestionAlertSummary;
  suggestions: Suggestion[];
  allSuggestions: Suggestion[];
  generatedAt: Date | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  markDone: (id: string) => void;
  snooze: (id: string, days?: number) => void;
  dismiss: (id: string) => void;
}

const EMPTY_SUMMARY: SuggestionAlertSummary = {
  hasHighPriority: false,
  highCount: 0,
  totalActive: 0,
};

const SuggestionAlertContext = createContext<SuggestionAlertContextValue | null>(null);

function todayISO(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString().slice(0, 10);
}

async function fetchWindsorRows(clientSlug: string, dateFrom: string, dateTo: string): Promise<WindsorRow[]> {
  const params = new URLSearchParams({
    client: clientSlug,
    type: "creatives",
    date_from: dateFrom,
    date_to: dateTo,
  });
  const res = await fetch(`/api/windsor?${params.toString()}`);
  const json = await res.json();
  if (res.status === 503 || json.useMock) return [];
  if (!res.ok) throw new Error(json.error || `Windsor error ${res.status}`);
  return (json.data as WindsorRow[]) ?? [];
}

export function SuggestionAlertProvider({ children }: { children: ReactNode }) {
  const ctx = useClient();
  const client = ctx?.clientConfig ?? null;
  const clientSlug = ctx?.clientSlug ?? "";

  const [allSuggestions, setAllSuggestions] = useState<Suggestion[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // In-memory TTL cache keyed by client slug (lives for page lifetime).
  const cacheRef = useRef<Map<string, { generated: Date; suggestions: Suggestion[] }>>(new Map());

  const applyLocalFilters = useCallback(
    (list: Suggestion[]) => {
      if (!clientSlug) return list;
      return filterActiveSuggestions(clientSlug, list);
    },
    [clientSlug],
  );

  useEffect(() => {
    if (!client || !clientSlug) return;

    const cached = cacheRef.current.get(clientSlug);
    if (cached && Date.now() - cached.generated.getTime() < CACHE_TTL_MS && refreshTick === 0) {
      setAllSuggestions(cached.suggestions);
      setSuggestions(applyLocalFilters(cached.suggestions));
      setGeneratedAt(cached.generated);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const toDate = todayISO(0);
        const fromDate = todayISO(FETCH_DAYS);
        const prevTo = todayISO(FETCH_DAYS + 1);
        const prevFrom = todayISO(FETCH_DAYS + PREVIOUS_DAYS + 1);

        const [windsorRows, previousRows] = await Promise.all([
          fetchWindsorRows(clientSlug, fromDate, toDate),
          fetchWindsorRows(clientSlug, prevFrom, prevTo).catch(() => [] as WindsorRow[]),
        ]);

        if (cancelled) return;

        const creatives = aggregateCreatives(windsorRows, client);
        const generated = runSuggestionRules({
          client,
          creatives,
          windsorRows,
          previousPeriodRows: previousRows,
        });

        const generatedAtDate = new Date();
        cacheRef.current.set(clientSlug, { generated: generatedAtDate, suggestions: generated });

        if (!cancelled) {
          setAllSuggestions(generated);
          setSuggestions(applyLocalFilters(generated));
          setGeneratedAt(generatedAtDate);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to generate suggestions");
          setAllSuggestions([]);
          setSuggestions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client, clientSlug, refreshTick, applyLocalFilters]);

  const refresh = useCallback(() => {
    if (clientSlug) cacheRef.current.delete(clientSlug);
    setRefreshTick((t) => t + 1);
  }, [clientSlug]);

  const markDone = useCallback(
    (id: string) => {
      if (!clientSlug) return;
      storageMarkDone(clientSlug, id);
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
    },
    [clientSlug],
  );

  const snooze = useCallback(
    (id: string, days: number = 7) => {
      if (!clientSlug) return;
      storageSnooze(clientSlug, id, days);
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
    },
    [clientSlug],
  );

  const dismiss = useCallback(
    (id: string) => {
      if (!clientSlug) return;
      storageDismiss(clientSlug, id);
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
    },
    [clientSlug],
  );

  const summary = useMemo(() => computeSuggestionAlerts(suggestions), [suggestions]);

  const value: SuggestionAlertContextValue = {
    summary,
    suggestions,
    allSuggestions,
    generatedAt,
    loading,
    error,
    refresh,
    markDone,
    snooze,
    dismiss,
  };

  return (
    <SuggestionAlertContext.Provider value={value}>
      {children}
    </SuggestionAlertContext.Provider>
  );
}

export function useSuggestionAlerts(): SuggestionAlertContextValue {
  const ctx = useContext(SuggestionAlertContext);
  if (!ctx) {
    return {
      summary: EMPTY_SUMMARY,
      suggestions: [],
      allSuggestions: [],
      generatedAt: null,
      loading: false,
      error: null,
      refresh: () => {},
      markDone: () => {},
      snooze: () => {},
      dismiss: () => {},
    };
  }
  return ctx;
}
