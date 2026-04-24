"use client";

import { Play, Image, Layers, Type, AlertTriangle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatROAS, formatCurrency } from "@/lib/utils";
import type { LiveCreative } from "@/lib/creativeAggregator";

const FORMAT_ICONS: Record<string, React.ReactNode> = {
  VID: <Play size={20} />,
  STA: <Image size={20} />,
  CAR: <Layers size={20} />,
  SEARCH: <Type size={20} />,
};

const FORMAT_COLORS: Record<string, string> = {
  VID: "bg-purple-500/30",
  STA: "bg-blue-500/30",
  CAR: "bg-amber-500/30",
  SEARCH: "bg-emerald-500/30",
};

const FORMAT_BADGE_COLORS: Record<string, string> = {
  VID: "bg-purple-500/80 text-white",
  STA: "bg-blue-500/80 text-white",
  CAR: "bg-amber-500/80 text-white",
  SEARCH: "bg-emerald-500/80 text-white",
};

const CHANNEL_ROLE_LABELS: Record<string, { label: string; color: string }> = {
  prospecting: { label: "Prosp", color: "bg-sky-500/20 text-sky-400" },
  retargeting: { label: "Retarg", color: "bg-violet-500/20 text-violet-400" },
  brand: { label: "Brand", color: "bg-pink-500/20 text-pink-400" },
  conversion: { label: "Conv", color: "bg-emerald-500/20 text-emerald-400" },
  unknown: { label: "Unknown", color: "bg-slate-500/20 text-slate-400" },
};

const FATIGUE_BADGES: Record<string, { label: string; color: string }> = {
  critical: { label: "Fatigued", color: "bg-red-500/20 text-red-400" },
  fatigued: { label: "Fatigued", color: "bg-orange-500/20 text-orange-400" },
  warning: { label: "Watch", color: "bg-amber-500/20 text-amber-400" },
};

interface CreativeCardProps {
  creative: LiveCreative;
  currency: string;
  clientType?: import("@/lib/types").ClientType;
  onClick: () => void;
}

export function CreativeCard({ creative, currency, clientType = "ecommerce", onClick }: CreativeCardProps) {
  const isLeadGen = clientType === "lead_gen";
  const { scoreResult, channelRole } = creative;
  const roleInfo = CHANNEL_ROLE_LABELS[channelRole] || CHANNEL_ROLE_LABELS.unknown;
  const fatigueInfo = FATIGUE_BADGES[scoreResult.fatigueLevel];
  const hasTrafficWarning = scoreResult.warnings.length > 0;

  return (
    <div
      className="flex flex-col bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl overflow-hidden cursor-pointer hover:bg-white/[0.07] hover:border-white/[0.10] active:scale-[0.99] transition-all duration-200"
      onClick={onClick}
    >
      {/* Thumbnail */}
      {creative.thumbnailUrl ? (
        <div className="aspect-[4/3] bg-black/40 overflow-hidden relative">
          <img
            src={creative.thumbnailUrl}
            alt={creative.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <span className={cn(
            "absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase",
            FORMAT_BADGE_COLORS[creative.format],
          )}>
            {creative.format}
          </span>
        </div>
      ) : (
        <div className={cn(
          "aspect-[4/3] flex items-center justify-center relative",
          FORMAT_COLORS[creative.format] || "bg-white/5",
        )}>
          <div className="text-white/40">{FORMAT_ICONS[creative.format]}</div>
          <span className={cn(
            "absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase",
            FORMAT_BADGE_COLORS[creative.format],
          )}>
            {creative.format}
          </span>
        </div>
      )}

      {/* Card body */}
      <div className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 space-y-2">
        {/* Name */}
        <h3 className="text-xs font-semibold text-white truncate">{creative.name}</h3>

        {/* Badges row */}
        <div className="flex items-center gap-1 flex-wrap">
          {/* Platform */}
          <span className={cn(
            "px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase",
            creative.platform === "meta" ? "bg-blue-500/20 text-blue-400"
              : creative.platform === "tiktok" ? "bg-pink-500/20 text-pink-400"
              : "bg-emerald-500/20 text-emerald-400",
          )}>
            {creative.platform}
          </span>
          {/* Live/Paused */}
          {creative.isLive ? (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-[9px] font-semibold text-emerald-400">
              <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-[9px] font-semibold text-amber-400">
              Paused
            </span>
          )}
          {/* Channel role */}
          <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-semibold", roleInfo.color)}>
            {roleInfo.label}
          </span>
          {/* Fatigue */}
          {fatigueInfo && (
            <span className={cn("flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold", fatigueInfo.color)}>
              <AlertTriangle size={8} />
              {fatigueInfo.label}
            </span>
          )}
          {/* Traffic quality warning */}
          {hasTrafficWarning && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500/20 text-[9px] font-semibold text-amber-400" title={scoreResult.warnings[0]}>
              <Zap size={8} />
              Traffic Issue
            </span>
          )}
        </div>

        {/* Score badge */}
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold",
            scoreResult.bgColor,
          )}>
            {scoreResult.label}
          </span>
          <span className="text-[9px] sm:text-[10px] text-[#94A3B8]">{scoreResult.compositeScore}</span>
        </div>

        {/* Context labels */}
        {scoreResult.scoredOn && (
          <p className="text-[8px] text-[#64748B] leading-tight">
            Scored on: {scoreResult.scoredOn}
          </p>
        )}
        {scoreResult.notScoredOn && (
          <p className="text-[8px] text-amber-400/60 leading-tight">
            Not scored on: {scoreResult.notScoredOn}
          </p>
        )}

        {/* Compact metrics grid */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1 border-t border-white/[0.06]">
          {creative.format === "VID" || creative.platform === "tiktok" ? (
            <>
              <MetricRow label="Hook" value={`${creative.hookRate.toFixed(1)}%`} />
              <MetricRow label="Hold" value={`${creative.holdRate.toFixed(1)}%`} />
            </>
          ) : null}
          <MetricRow label="CTR" value={`${creative.ctr.toFixed(2)}%`} />
          {isLeadGen ? (
            <MetricRow
              label="CPL"
              value={creative.conversions > 0 ? formatCurrency(creative.spend / creative.conversions, currency) : "--"}
            />
          ) : !scoreResult.isROASHidden ? (
            <MetricRow label="ROAS" value={formatROAS(creative.roas)} />
          ) : (
            <MetricRow label="ROAS" value="--" muted note="Prospecting" />
          )}
          <MetricRow label="Freq" value={creative.frequency.toFixed(1)} />
          <MetricRow label="Spend" value={formatCurrency(creative.spend, currency)} />
        </div>
      </div>
    </div>
  );
}

function MetricRow({ label, value, muted, note }: { label: string; value: string; muted?: boolean; note?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[8px] sm:text-[9px] text-[#94A3B8]">{label}</span>
      <span className={cn("text-[9px] sm:text-[10px] font-medium", muted ? "text-[#64748B]" : "text-white")}>
        {value}
        {note && <span className="text-[7px] text-amber-400/60 ml-0.5">({note})</span>}
      </span>
    </div>
  );
}
