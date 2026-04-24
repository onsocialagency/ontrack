"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, ArrowDownRight, Info, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip as RechartsTooltip,
  XAxis,
} from "recharts";

/* ── Types ── */

interface KpiCardProps {
  title: string;
  value: string;
  delta: number;
  prefix?: string;
  icon?: React.ReactNode;
  tooltip?: string;
  sparkline?: { v: number; label?: string }[];
  accentColor?: string;
  onClick?: () => void;
  previousValue?: string;
  subLabel?: string;
  size?: "default" | "compact";
  /** When true, a negative delta is shown as green (good) and positive as red (bad). Use for cost metrics like CPA, CPL. */
  invertDelta?: boolean;
  /** When true, the numeric value + delta + sparkline are blurred to indicate pending data. */
  loading?: boolean;
  /** Attribution model badge: tells the reader whether the number is
   *  post-click, post-view, CRM-confirmed, platform-reported, etc.
   *  Required by Ministry brief §10 — never show a conversion count
   *  without labelling which model produced it. */
  attributionSource?: "post-click" | "post-view" | "platform-claimed" | "crm-verified" | "crm-total" | "blended";
}

/* ── Sparkline Tooltip ── */

function SparklineTooltip({ active, payload }: {
  active?: boolean;
  payload?: { value: number; payload: { label?: string; v: number } }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const dateLabel = payload[0]?.payload?.label || "";
  const val = payload[0]?.value;
  return (
    <div className="bg-[#1A1A2E] border border-white/[0.12] rounded-lg px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-2xl">
      {dateLabel && <p className="text-[9px] sm:text-[10px] text-[#A8BBCC] mb-0.5">{dateLabel}</p>}
      <p className="text-[10px] sm:text-xs font-bold text-white">
        {typeof val === "number" ? val.toLocaleString(undefined, { maximumFractionDigits: 2 }) : val}
      </p>
    </div>
  );
}

/* ── Component ── */

export function KpiCard({
  title,
  value,
  delta,
  prefix,
  icon,
  tooltip,
  sparkline,
  accentColor = "#FF6A41",
  onClick,
  previousValue,
  subLabel,
  size = "default",
  invertDelta = false,
  loading = false,
  attributionSource,
}: KpiCardProps) {
  const attributionLabel: Record<NonNullable<KpiCardProps["attributionSource"]>, string> = {
    "post-click": "Post-click",
    "post-view": "Post-view",
    "platform-claimed": "Platform",
    "crm-verified": "CRM verified",
    "crm-total": "CRM total",
    blended: "Blended",
  };
  // For cost metrics (CPA, CPL), a decrease is good (green) and increase is bad (red)
  const isPositive = invertDelta ? delta <= 0 : delta >= 0;
  const hasDelta = delta !== 0;
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const tooltipAnchorRef = useRef<HTMLSpanElement | null>(null);
  const isCompact = size === "compact";

  // Compute portal-rendered tooltip position against the icon's viewport rect
  // so the tooltip escapes any `overflow-hidden/auto` ancestor clipping.
  useEffect(() => {
    if (!showTooltip || !tooltipAnchorRef.current) {
      setTooltipPos(null);
      return;
    }
    const rect = tooltipAnchorRef.current.getBoundingClientRect();
    setTooltipPos({
      top: rect.top,
      left: rect.left + rect.width / 2,
    });
  }, [showTooltip]);

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-xl sm:rounded-2xl",
        "bg-[#12121A] border border-white/[0.06]",
        "transition-all duration-300 ease-out",
        onClick && "cursor-pointer hover:bg-[#16161F] hover:border-white/[0.12] hover:shadow-lg hover:shadow-black/20 active:scale-[0.98]",
        isCompact ? "p-3 sm:p-4 min-h-[120px] sm:min-h-[140px]" : "p-3.5 sm:p-5 min-h-[160px] sm:min-h-[200px]",
      )}
      onClick={onClick}
    >
      {/* Top row: Icon + Title + Info on the left, Delta chip pinned top-right */}
      <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
        <div className="flex items-start gap-1.5 sm:gap-2 min-w-0 flex-1">
          {icon && (
            <span
              className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-md sm:rounded-lg transition-colors flex-shrink-0"
              style={{ backgroundColor: `${accentColor}15` }}
            >
              <span style={{ color: accentColor }}>{icon}</span>
            </span>
          )}
          <span className={cn(
            "min-w-0 font-medium text-[#A8BBCC] whitespace-normal break-words leading-tight pt-0.5",
            isCompact ? "text-[11px] sm:text-xs" : "text-[11px] sm:text-[13px]",
          )}>
            {title}
            {tooltip && (
              <span
                ref={tooltipAnchorRef}
                className="ml-1 cursor-help hidden sm:inline-flex align-middle"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
              >
                <Info size={11} className="text-[#A8BBCC]/30 hover:text-[#A8BBCC]/60 transition-colors" />
                {showTooltip && tooltipPos && typeof document !== "undefined" && createPortal(
                  <span
                    className="fixed z-[100] px-3 py-2 rounded-xl text-[11px] leading-relaxed font-medium bg-[#1A1A2E] text-[#E2E8F0] border border-white/[0.1] shadow-2xl max-w-[220px] whitespace-normal pointer-events-none -translate-x-1/2 -translate-y-full"
                    style={{ top: tooltipPos.top - 8, left: tooltipPos.left }}
                  >
                    {tooltip}
                  </span>,
                  document.body,
                )}
              </span>
            )}
          </span>
        </div>
        {hasDelta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold flex-shrink-0 self-start transition-[filter] duration-300",
              isPositive
                ? "bg-[#22C55E]/10 text-[#22C55E]"
                : "bg-[#EF4444]/10 text-[#EF4444]",
              loading && "blur-sm opacity-70 animate-pulse",
            )}
          >
            {/* Arrow direction reflects actual value movement (up/down), color reflects sentiment (good/bad) */}
            {delta >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>

      {/* Value — full width, never truncated */}
      <div className="flex items-baseline gap-1 sm:gap-1.5 mb-0.5 sm:mb-1 min-w-0">
        {prefix && (
          <span className="text-xs sm:text-sm font-medium text-[#A8BBCC]">{prefix}</span>
        )}
        <span className={cn(
          "font-bold tracking-tight text-white tabular-nums transition-[filter] duration-300 whitespace-nowrap",
          // Responsive sizing so £89,450 fits a 6-col card at lg without ellipsis
          isCompact ? "text-lg sm:text-xl" : "text-xl sm:text-2xl lg:text-[26px] leading-none",
          loading && "blur-md opacity-70 animate-pulse select-none",
        )}>
          {value}
        </span>
      </div>

      {/* Attribution source badge */}
      {attributionSource && (
        <span className="inline-flex self-start mt-0.5 mb-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold tracking-wide uppercase bg-white/[0.04] text-[#A8BBCC]/70 border border-white/[0.06]">
          {attributionLabel[attributionSource]}
        </span>
      )}

      {/* Previous period comparison text */}
      {(previousValue || subLabel) && (
        <p className={cn(
          "text-[10px] sm:text-[11px] text-[#64748B] mt-0.5 mb-1 sm:mb-2 transition-[filter] duration-300",
          loading && "blur-sm opacity-70",
        )}>
          {subLabel || `vs ${previousValue} prev period`}
        </p>
      )}

      {/* Sparkline */}
      {sparkline && sparkline.length > 1 ? (
        <div className={cn(
          "mt-auto transition-[filter] duration-300",
          isCompact ? "h-[40px]" : "h-[52px]",
          loading && "blur-sm opacity-60",
        )}>
          <ResponsiveContainer width="100%" height={isCompact ? 40 : 52}>
            <AreaChart data={sparkline} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
              <defs>
                <linearGradient id={`spark-${title.replace(/[^a-zA-Z0-9]/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accentColor} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={accentColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" hide />
              <RechartsTooltip
                content={<SparklineTooltip />}
                cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="v"
                stroke={accentColor}
                fill={`url(#spark-${title.replace(/[^a-zA-Z0-9]/g, "")})`}
                strokeWidth={1.5}
                dot={false}
                activeDot={{
                  r: 3,
                  fill: accentColor,
                  stroke: "#12121A",
                  strokeWidth: 2,
                }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex-1" />
      )}

      {/* Click-to-expand indicator */}
      {onClick && (
        <div className="absolute bottom-2.5 right-2.5 sm:bottom-3 sm:right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <ChevronRight size={14} className="text-[#A8BBCC]/50" />
        </div>
      )}
    </div>
  );
}

export default KpiCard;
