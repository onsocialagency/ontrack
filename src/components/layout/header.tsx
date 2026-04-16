"use client";

import { cn } from "@/lib/utils";
import { useDateRange } from "@/lib/date-range-context";
import { useClient } from "@/lib/client-context";
import { useAttribution } from "@/lib/attribution-context";
import { MODEL_LABELS, MODEL_NAMES } from "@/lib/attribution";
import type { ModelName } from "@/lib/attribution";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { GitBranch } from "lucide-react";

/* ── Types ── */

interface HeaderProps {
  title: string;
  showDateRange?: boolean;
  showAttribution?: boolean;
  clientLogo?: string;
  clientColor?: string;
  /** Pass loading + isLive to render the DataBadge inline in the header */
  dataBadge?: { loading: boolean; isLive: boolean };
  /** Render a custom filter row below the header (e.g. venue tabs for IRG) */
  filterRow?: React.ReactNode;
}

/* ── Component ── */

export function Header({ title, showDateRange = true, showAttribution = false, clientLogo: propLogo, clientColor: propColor, dataBadge, filterRow }: HeaderProps) {
  const { compareEnabled, setCompareEnabled } = useDateRange();
  const clientCtx = useClient();
  const { activeModel, setActiveModel } = useAttribution();
  const clientLogo = propLogo ?? clientCtx?.clientLogo;
  const clientColor = propColor ?? clientCtx?.clientColor;

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#0A0A0F]/60 backdrop-blur-xl">
      {/* Main header row */}
      <div className="flex items-center justify-between h-14 sm:h-16 px-4 sm:px-6">
        {/* Left: Client logo + Page title — pl-10 on mobile to clear hamburger */}
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 pl-10 lg:pl-0">
          {clientLogo ? (
            <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg overflow-hidden flex items-center justify-center bg-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={clientLogo}
                alt={`${title} logo`}
                className="max-w-[80px] sm:max-w-[100px] w-auto max-h-[24px] sm:max-h-[28px] object-contain"
              />
            </div>
          ) : clientColor ? (
            <div
              className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-white"
              style={{ backgroundColor: clientColor }}
            >
              {title.slice(0, 2).toUpperCase()}
            </div>
          ) : null}
          <h1 className="text-sm sm:text-lg font-semibold tracking-tight truncate">{title}</h1>
          {dataBadge && (
            <span
              className={cn(
                "hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider flex-shrink-0",
                dataBadge.loading
                  ? "bg-white/10 text-[#A8BBCC]"
                  : dataBadge.isLive
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-amber-500/20 text-amber-400",
              )}
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  dataBadge.loading
                    ? "bg-[#A8BBCC] animate-pulse"
                    : dataBadge.isLive
                      ? "bg-emerald-400"
                      : "bg-amber-400",
                )}
              />
              {dataBadge.loading ? "Loading" : dataBadge.isLive ? "Live" : "Mock"}
            </span>
          )}
        </div>

        {showDateRange && (
          <div className="flex items-center gap-2">
            <DateRangePicker />

            {/* Previous period comparison toggle */}
            <button
              onClick={() => setCompareEnabled(!compareEnabled)}
              className={cn(
                "hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
                compareEnabled
                  ? "bg-[#FF6A41]/15 text-[#FF6A41] border border-[#FF6A41]/30"
                  : "bg-white/[0.05] text-[#A8BBCC] hover:text-white hover:bg-white/[0.08]",
              )}
            >
              <span className={cn(
                "w-1.5 h-1.5 rounded-full transition-colors",
                compareEnabled ? "bg-[#FF6A41]" : "bg-[#64748B]",
              )} />
              vs Previous Period
            </button>
          </div>
        )}
      </div>
      {/* ── Custom Filter Row (e.g. venue tabs) ── */}
      {filterRow && (
        <div className="px-4 sm:px-6 py-1.5 border-t border-white/[0.04] overflow-x-auto">
          {filterRow}
        </div>
      )}
      {/* ── Attribution Model Selector ── */}
      {showAttribution && (
        <div className="flex items-center gap-2 px-4 sm:px-6 py-1.5 border-t border-white/[0.04] overflow-x-auto">
          <GitBranch size={11} className="text-[#64748B] flex-shrink-0" />
          <span className="text-[9px] text-[#64748B] uppercase tracking-wider font-semibold flex-shrink-0">Model</span>
          <div className="flex items-center gap-0.5">
            {MODEL_NAMES.map((m) => (
              <button
                key={m}
                onClick={() => setActiveModel(m as ModelName)}
                className={cn(
                  "px-2 sm:px-2.5 py-1 rounded-md text-[10px] sm:text-[11px] font-medium transition-all duration-200 whitespace-nowrap",
                  activeModel === m
                    ? "bg-[#FF6A41]/15 text-[#FF6A41]"
                    : "text-[#64748B] hover:text-[#A8BBCC] hover:bg-white/[0.04]",
                )}
              >
                {MODEL_LABELS[m]}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}

export default Header;
