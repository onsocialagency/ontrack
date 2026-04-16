import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, currency = "GBP"): string {
  const symbols: Record<string, string> = {
    GBP: "£", USD: "$", EUR: "€", AED: "AED ",
  };
  const symbol = symbols[currency] || currency + " ";
  if (value >= 1_000_000) return `${symbol}${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${symbol}${(value / 1_000).toFixed(1)}K`;
  return `${symbol}${value.toFixed(2)}`;
}

export function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function formatROAS(value: number): string {
  return `${value.toFixed(2)}x`;
}

export function getDeltaColor(delta: number): string {
  if (delta > 0) return "text-emerald-400";
  if (delta < 0) return "text-red-400";
  return "text-zinc-400";
}

export function getPacingColor(pacing: number): string {
  if (pacing >= 80) return "bg-emerald-500";
  if (pacing >= 60) return "bg-amber-500";
  return "bg-red-500";
}

export function getPacingTextColor(pacing: number): string {
  if (pacing >= 80) return "text-emerald-400";
  if (pacing >= 60) return "text-amber-400";
  return "text-red-400";
}

export function getScoreLabel(score: number, spend?: number, platform?: "meta" | "google"): { label: string; color: string; bg: string } {
  // Minimum spend thresholds before scoring (from Creative Analysis Strategy doc)
  const minSpend = platform === "google" ? 150 : 300;
  if (spend !== undefined && spend < minSpend) {
    return { label: "Learning", color: "text-slate-400", bg: "bg-slate-500/20" };
  }
  if (score >= 85) return { label: "Scale", color: "text-emerald-400", bg: "bg-emerald-500/20" };
  if (score >= 70) return { label: "Optimise", color: "text-blue-400", bg: "bg-blue-500/20" };
  if (score >= 55) return { label: "Review", color: "text-amber-400", bg: "bg-amber-500/20" };
  return { label: "Kill", color: "text-red-400", bg: "bg-red-500/20" };
}

export function daysFromNow(date: Date): number {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Convert an ISO date string (YYYY-MM-DD) to UK short format (DD/MM).
 * Used for chart axes and compact date displays.
 */
export function toUkShortDate(isoDate: string): string {
  // Handle both "YYYY-MM-DD" and already-sliced "MM-DD"
  const parts = isoDate.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}`; // DD/MM
  }
  if (parts.length === 2) {
    return `${parts[1]}/${parts[0]}`; // DD/MM from MM-DD
  }
  return isoDate;
}

/* ── Billing Period Calculation ── */

export interface BillingPeriod {
  start: Date;
  end: Date;
  startISO: string;
  endISO: string;
  daysInPeriod: number;
  daysElapsed: number;
  daysRemaining: number;
  /** e.g. "29 Mar — 28 Apr 2026" */
  label: string;
}

/**
 * Calculate the current billing period based on today's date and the
 * billing start day (the day of the month the contract renews).
 *
 * Edge cases: if billingStartDay is 29/30/31 and the month doesn't have
 * that many days, uses the last day of the month instead.
 */
export function getBillingPeriod(billingStartDay: number): BillingPeriod {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const currentDay = today.getDate();
  const currentMonth = today.getMonth(); // 0-indexed
  const currentYear = today.getFullYear();

  let periodStartMonth: number;
  let periodStartYear: number;

  if (currentDay >= billingStartDay) {
    // Period started this month
    periodStartMonth = currentMonth;
    periodStartYear = currentYear;
  } else {
    // Period started last month
    periodStartMonth = currentMonth - 1;
    periodStartYear = currentYear;
    if (periodStartMonth < 0) {
      periodStartMonth = 11;
      periodStartYear -= 1;
    }
  }

  // Clamp the start day to the last day of the start month
  const daysInStartMonth = new Date(periodStartYear, periodStartMonth + 1, 0).getDate();
  const clampedStartDay = Math.min(billingStartDay, daysInStartMonth);
  const start = new Date(periodStartYear, periodStartMonth, clampedStartDay);

  // End = day before the next period starts
  let nextPeriodMonth = periodStartMonth + 1;
  let nextPeriodYear = periodStartYear;
  if (nextPeriodMonth > 11) {
    nextPeriodMonth = 0;
    nextPeriodYear += 1;
  }
  const daysInNextMonth = new Date(nextPeriodYear, nextPeriodMonth + 1, 0).getDate();
  const clampedNextDay = Math.min(billingStartDay, daysInNextMonth);
  const end = new Date(nextPeriodYear, nextPeriodMonth, clampedNextDay - 1);

  const msPerDay = 1000 * 60 * 60 * 24;
  const daysInPeriod = Math.round((end.getTime() - start.getTime()) / msPerDay) + 1;
  const daysElapsed = Math.max(1, Math.round((today.getTime() - start.getTime()) / msPerDay) + 1);
  const daysRemaining = Math.max(0, daysInPeriod - daysElapsed);

  const fmtShort = (d: Date) => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${d.getDate()} ${months[d.getMonth()]}`;
  };
  const fmtISO = (d: Date) => d.toISOString().slice(0, 10);

  return {
    start,
    end,
    startISO: fmtISO(start),
    endISO: fmtISO(end),
    daysInPeriod,
    daysElapsed,
    daysRemaining,
    label: `${fmtShort(start)} — ${fmtShort(end)} ${end.getFullYear()}`,
  };
}
