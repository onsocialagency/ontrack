"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

/* ── Types ── */

export interface LocaleConfig {
  /** BCP 47 locale tag, e.g. "en-GB", "en-AE", "es-ES" */
  locale: string;
  /** IANA timezone, e.g. "Europe/London", "Asia/Dubai" */
  timezone: string;
}

export interface LocaleFormatters {
  locale: string;
  timezone: string;
  /**
   * Short date for chart axes, compact labels.
   * e.g. "15/03" (en-GB), "03/15" (en-US), "15/3" (es-ES)
   */
  shortDate: (isoDate: string) => string;
  /**
   * Medium date for headers/badges.
   * e.g. "15 Mar" (en-GB), "Mar 15" (en-US)
   */
  mediumDate: (date: Date) => string;
  /**
   * Full date with year.
   * e.g. "15 Mar 2026" (en-GB), "Mar 15, 2026" (en-US)
   */
  fullDate: (date: Date) => string;
  /**
   * Date range for pickers/labels.
   * e.g. "5 Mar – 4 Apr 2026" (en-GB), "Mar 5 – Apr 4, 2026" (en-US)
   */
  dateRange: (from: Date, to: Date) => string;
  /**
   * Compact date range (no year).
   * e.g. "5 Mar – 4 Apr" (en-GB), "Mar 5 – Apr 4" (en-US)
   */
  dateRangeShort: (from: Date, to: Date) => string;
  /**
   * Timestamp for "last updated" displays.
   * e.g. "14:30 · 4 Apr 2026" (en-GB), "2:30 PM · Apr 4, 2026" (en-US)
   */
  timestamp: (date: Date) => string;
  /**
   * Display date for saved reports, alerts, etc.
   * e.g. "04/04/2026" (en-GB), "4/4/2026" (en-US)
   */
  displayDate: (date: Date | string) => string;
}

/* ── Defaults ── */

const DEFAULT_LOCALE = "en-GB";
const DEFAULT_TIMEZONE = "Europe/London";

/* ── Build formatters from locale config ── */

function buildFormatters(config: LocaleConfig): LocaleFormatters {
  const { locale, timezone } = config;

  // Pre-build Intl formatters (they're cached internally by the engine).
  //
  // IMPORTANT: date-only formatters intentionally omit `timeZone`. The Date
  // objects we format here come from the picker / context and represent
  // *local-midnight calendar dates* (e.g. `new Date(2026, 3, 1)`). Forcing an
  // Intl timeZone would re-interpret that local-midnight instant in the
  // configured zone, shifting the displayed day by ±1 whenever the user's
  // browser is east/west of the client's timezone. The wall-clock `timeFmt`
  // below is the only place a timezone conversion is actually desired.
  const shortDateFmt = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
  });

  const mediumDateFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  });

  const fullDateFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const timeFmt = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });

  const displayDateFmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });

  return {
    locale,
    timezone,

    shortDate(isoDate: string) {
      // Parse "YYYY-MM-DD" → Date, then format as locale-appropriate DD/MM or MM/DD
      const d = new Date(isoDate + "T12:00:00"); // noon to avoid timezone shift
      const parts = shortDateFmt.formatToParts(d);
      // Rebuild from parts in locale order
      return parts
        .filter((p) => p.type === "day" || p.type === "month" || p.type === "literal")
        .map((p) => p.value)
        .join("");
    },

    mediumDate(date: Date) {
      return mediumDateFmt.format(date);
    },

    fullDate(date: Date) {
      return fullDateFmt.format(date);
    },

    dateRange(from: Date, to: Date) {
      return `${mediumDateFmt.format(from)} \u2013 ${fullDateFmt.format(to)}`;
    },

    dateRangeShort(from: Date, to: Date) {
      return `${mediumDateFmt.format(from)} \u2013 ${mediumDateFmt.format(to)}`;
    },

    timestamp(date: Date) {
      return `${timeFmt.format(date)} \u00b7 ${fullDateFmt.format(date)}`;
    },

    displayDate(date: Date | string) {
      const d = typeof date === "string" ? new Date(date) : date;
      return displayDateFmt.format(d);
    },
  };
}

/* ── Context ── */

const LocaleContext = createContext<LocaleFormatters>(
  buildFormatters({ locale: DEFAULT_LOCALE, timezone: DEFAULT_TIMEZONE }),
);

export function LocaleProvider({
  locale,
  timezone,
  children,
}: {
  locale?: string;
  timezone?: string;
  children: ReactNode;
}) {
  const formatters = useMemo(
    () =>
      buildFormatters({
        locale: locale || DEFAULT_LOCALE,
        timezone: timezone || DEFAULT_TIMEZONE,
      }),
    [locale, timezone],
  );

  return (
    <LocaleContext.Provider value={formatters}>
      {children}
    </LocaleContext.Provider>
  );
}

/**
 * Access locale-aware date formatters.
 * Must be used inside a <LocaleProvider>.
 */
export function useLocale(): LocaleFormatters {
  return useContext(LocaleContext);
}
