"use client";

import { createContext, useContext, useState, useMemo, useCallback } from "react";
import { subDays, startOfDay, startOfMonth, endOfMonth, subMonths, differenceInCalendarDays, format } from "date-fns";

export interface DateRange {
  from: Date;
  to: Date;
}

export type DatePreset =
  | "Today" | "Yesterday"
  | "7D" | "14D" | "30D" | "90D" | "365D"
  | "Last Month" | "MTD"
  | "Custom";

interface DateRangeContextValue {
  preset: DatePreset;
  dateRange: DateRange;
  days: number;
  /** Formatted YYYY-MM-DD string for the start date */
  dateFrom: string;
  /** Formatted YYYY-MM-DD string for the end date */
  dateTo: string;
  /** Whether comparison to previous period is enabled */
  compareEnabled: boolean;
  /** Previous period date range (same duration, immediately before current range) */
  prevDateRange: DateRange;
  prevDateFrom: string;
  prevDateTo: string;
  setPreset: (preset: DatePreset) => void;
  setCustomRange: (range: DateRange) => void;
  setCompareEnabled: (enabled: boolean) => void;
}

const DateRangeContext = createContext<DateRangeContextValue | null>(null);

function presetToRange(preset: DatePreset): DateRange {
  const now = new Date();
  const today = startOfDay(now);
  switch (preset) {
    case "Today":
      return { from: today, to: now };
    case "Yesterday": {
      const y = subDays(today, 1);
      return { from: y, to: y };
    }
    case "7D":
      return { from: subDays(now, 7), to: now };
    case "14D":
      return { from: subDays(now, 14), to: now };
    case "30D":
      return { from: subDays(now, 30), to: now };
    case "90D":
      return { from: subDays(now, 90), to: now };
    case "365D":
      return { from: subDays(now, 365), to: now };
    case "Last Month": {
      const prev = subMonths(today, 1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    }
    case "MTD":
      return { from: startOfMonth(now), to: now };
    default:
      return { from: subDays(now, 30), to: now };
  }
}

export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  const [preset, setPresetState] = useState<DatePreset>("7D");
  const [customRange, setCustomRangeState] = useState<DateRange>(() => presetToRange("7D"));
  const [compareEnabled, setCompareEnabled] = useState(true);

  const dateRange = useMemo(() => {
    if (preset === "Custom") return customRange;
    return presetToRange(preset);
  }, [preset, customRange]);

  const days = useMemo(() => {
    return Math.max(1, differenceInCalendarDays(dateRange.to, dateRange.from));
  }, [dateRange]);

  const dateFrom = useMemo(() => format(dateRange.from, "yyyy-MM-dd"), [dateRange]);
  const dateTo = useMemo(() => format(dateRange.to, "yyyy-MM-dd"), [dateRange]);

  // Previous period: same duration, immediately before current range
  const prevDateRange = useMemo(() => {
    const durationMs = dateRange.to.getTime() - dateRange.from.getTime();
    const prevTo = new Date(dateRange.from.getTime() - 1); // day before current start
    const prevFrom = new Date(prevTo.getTime() - durationMs);
    return { from: prevFrom, to: prevTo };
  }, [dateRange]);

  const prevDateFrom = useMemo(() => format(prevDateRange.from, "yyyy-MM-dd"), [prevDateRange]);
  const prevDateTo = useMemo(() => format(prevDateRange.to, "yyyy-MM-dd"), [prevDateRange]);

  const setPreset = useCallback((p: DatePreset) => {
    setPresetState(p);
  }, []);

  const setCustomRange = useCallback((range: DateRange) => {
    setCustomRangeState(range);
    setPresetState("Custom");
  }, []);

  return (
    <DateRangeContext.Provider value={{
      preset, dateRange, days, dateFrom, dateTo,
      compareEnabled, prevDateRange, prevDateFrom, prevDateTo,
      setPreset, setCustomRange, setCompareEnabled,
    }}>
      {children}
    </DateRangeContext.Provider>
  );
}

export function useDateRange(): DateRangeContextValue {
  const ctx = useContext(DateRangeContext);
  if (!ctx) {
    // Fallback for pages outside the provider
    const fallbackRange = presetToRange("7D");
    const prevTo = new Date(fallbackRange.from.getTime() - 1);
    const prevFrom = subDays(prevTo, 7);
    return {
      preset: "7D",
      dateRange: fallbackRange,
      days: 7,
      dateFrom: format(fallbackRange.from, "yyyy-MM-dd"),
      dateTo: format(fallbackRange.to, "yyyy-MM-dd"),
      compareEnabled: true,
      prevDateRange: { from: prevFrom, to: prevTo },
      prevDateFrom: format(prevFrom, "yyyy-MM-dd"),
      prevDateTo: format(prevTo, "yyyy-MM-dd"),
      setPreset: () => {},
      setCustomRange: () => {},
      setCompareEnabled: () => {},
    };
  }
  return ctx;
}
