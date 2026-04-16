"use client";

import { cn } from "@/lib/utils";
import { Info } from "lucide-react";
import { useState } from "react";

/* ── Types ── */

export interface PacingBarProps {
  /** Total spend in the current billing period */
  periodSpend: number;
  /** Monthly budget target from client config */
  monthlyBudget: number;
  /** Days elapsed in the current billing period */
  daysElapsed: number;
  /** Total days in the current billing period */
  daysInPeriod: number;
  /** Days remaining in the current billing period */
  daysRemaining: number;
  /** Human-readable billing period label, e.g. "29 Mar — 28 Apr 2026" */
  billingPeriodLabel: string;
  /** Currency symbol for formatting */
  currency?: string;
}

/* ── Helpers ── */

function fmt(val: number, currency = "GBP"): string {
  const symbols: Record<string, string> = {
    GBP: "£", USD: "$", EUR: "€", AED: "AED ",
  };
  const sym = symbols[currency] || currency + " ";
  if (val >= 1_000_000) return `${sym}${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${sym}${(val / 1_000).toFixed(1)}K`;
  return `${sym}${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

type PacingStatus = "on_track" | "behind" | "overpacing";

function getPacingStatus(actualPct: number, expectedPct: number): PacingStatus {
  if (actualPct > expectedPct + 10) return "overpacing";
  if (actualPct < expectedPct - 10) return "behind";
  return "on_track";
}

function getStatusConfig(status: PacingStatus) {
  switch (status) {
    case "on_track":
      return {
        label: "On track",
        barColor: "bg-[#22C55E]",
        glow: "shadow-[#22C55E]/20",
        textColor: "text-[#22C55E]",
        bgColor: "bg-[#22C55E]/10",
      };
    case "behind":
      return {
        label: "Behind",
        barColor: "bg-amber-500",
        glow: "shadow-amber-500/20",
        textColor: "text-amber-400",
        bgColor: "bg-amber-500/10",
      };
    case "overpacing":
      return {
        label: "Overpacing",
        barColor: "bg-[#EF4444]",
        glow: "shadow-[#EF4444]/20",
        textColor: "text-[#EF4444]",
        bgColor: "bg-[#EF4444]/10",
      };
  }
}

/* ── Component ── */

export function PacingBar({
  periodSpend,
  monthlyBudget,
  daysElapsed,
  daysInPeriod,
  daysRemaining,
  billingPeriodLabel,
  currency = "GBP",
}: PacingBarProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const pacingPct = monthlyBudget > 0 ? (periodSpend / monthlyBudget) * 100 : 0;
  const expectedPct = daysInPeriod > 0 ? (daysElapsed / daysInPeriod) * 100 : 0;
  const dailyAvg = daysElapsed > 0 ? periodSpend / daysElapsed : 0;
  const projectedTotal = dailyAvg * daysInPeriod;
  const remaining = monthlyBudget - periodSpend;

  const status = getPacingStatus(pacingPct, expectedPct);
  const config = getStatusConfig(status);

  const barWidth = Math.min(pacingPct, 100);
  const expectedMarkerPos = Math.min(expectedPct, 100);

  return (
    <div className="space-y-3">
      {/* Header: pacing percentage and status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn(
            "px-2.5 py-1 rounded-lg text-xs font-bold",
            config.bgColor,
            config.textColor,
          )}>
            {pacingPct.toFixed(1)}% paced — {config.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#64748B]">
            Expected: {expectedPct.toFixed(1)}%
          </span>
          {/* Info tooltip */}
          <div className="relative">
            <button
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              className="text-[#64748B] hover:text-[#94A3B8] transition-colors"
            >
              <Info size={13} />
            </button>
            {showTooltip && (
              <div className="absolute right-0 top-full mt-1 z-50 w-[220px] p-2.5 rounded-xl border border-white/[0.1] bg-[#12121A] shadow-2xl text-[11px] text-[#94A3B8] leading-relaxed">
                Pacing always shows the current billing period regardless of the date range selected above.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-3 rounded-full bg-white/[0.06] overflow-visible">
        {/* Current progress */}
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out shadow-sm",
            config.barColor,
            config.glow,
          )}
          style={{ width: `${barWidth}%` }}
        />

        {/* Expected pace marker */}
        {expectedMarkerPos > 0 && expectedMarkerPos <= 100 && (
          <div
            className="absolute top-[-3px] bottom-[-3px] w-0.5 bg-white/40 z-10"
            style={{ left: `${expectedMarkerPos}%` }}
            title={`Expected: ${expectedPct.toFixed(1)}%`}
          />
        )}
      </div>

      {/* Stats grid — 2 cols on mobile, 3 on sm+ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
        <div className="text-center p-2.5 rounded-xl bg-white/[0.03]">
          <p className="text-[10px] text-[#64748B] uppercase tracking-wider font-medium mb-1">Spent</p>
          <p className="text-sm font-bold text-white">{fmt(periodSpend, currency)}</p>
        </div>
        <div className="text-center p-2.5 rounded-xl bg-white/[0.03]">
          <p className="text-[10px] text-[#64748B] uppercase tracking-wider font-medium mb-1">Budget</p>
          <p className="text-sm font-bold text-white">{fmt(monthlyBudget, currency)}</p>
        </div>
        <div className="text-center p-2.5 rounded-xl bg-white/[0.03]">
          <p className="text-[10px] text-[#64748B] uppercase tracking-wider font-medium mb-1">Remaining</p>
          <p className={cn(
            "text-sm font-bold",
            remaining < 0 ? "text-[#EF4444]" : "text-white",
          )}>
            {fmt(Math.abs(remaining), currency)}{remaining < 0 ? " over" : ""}
          </p>
        </div>
        <div className="text-center p-2.5 rounded-xl bg-white/[0.03]">
          <p className="text-[10px] text-[#64748B] uppercase tracking-wider font-medium mb-1">Daily Avg</p>
          <p className="text-sm font-bold text-white">{fmt(dailyAvg, currency)}</p>
        </div>
        <div className="text-center p-2.5 rounded-xl bg-white/[0.03]">
          <p className="text-[10px] text-[#64748B] uppercase tracking-wider font-medium mb-1">Projected</p>
          <p className={cn(
            "text-sm font-bold",
            projectedTotal > monthlyBudget * 1.05 ? "text-[#EF4444]" : "text-white",
          )}>
            {fmt(projectedTotal, currency)}
          </p>
        </div>
        <div className="text-center p-2.5 rounded-xl bg-white/[0.03]">
          <p className="text-[10px] text-[#64748B] uppercase tracking-wider font-medium mb-1">Days Left</p>
          <p className="text-sm font-bold text-white">{daysRemaining}</p>
        </div>
      </div>

      {/* Billing period label */}
      <p className="text-[10px] text-[#64748B] text-center">
        Billing period: {billingPeriodLabel}
      </p>
    </div>
  );
}

export default PacingBar;
