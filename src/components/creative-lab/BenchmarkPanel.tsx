"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { META_BENCHMARKS, TIKTOK_BENCHMARKS, GOOGLE_BENCHMARKS } from "@/lib/platformBenchmarks";
import type { CreativePlatform } from "@/lib/types";

interface BenchmarkPanelProps {
  platform: "all" | CreativePlatform;
}

interface BenchmarkRow {
  metric: string;
  fixIt: string;
  decent: string;
  strong: string;
  elite: string;
}

function getMetaBenchmarks(): BenchmarkRow[] {
  return [
    {
      metric: META_BENCHMARKS.hookRate.label,
      fixIt: `< ${META_BENCHMARKS.hookRate.fixIt}%`,
      decent: `${META_BENCHMARKS.hookRate.fixIt}-${META_BENCHMARKS.hookRate.decent}%`,
      strong: `${META_BENCHMARKS.hookRate.decent}-${META_BENCHMARKS.hookRate.strong}%`,
      elite: `> ${META_BENCHMARKS.hookRate.strong}%`,
    },
    {
      metric: META_BENCHMARKS.holdRate.label,
      fixIt: `< ${META_BENCHMARKS.holdRate.fixIt}%`,
      decent: `${META_BENCHMARKS.holdRate.fixIt}-${META_BENCHMARKS.holdRate.decent}%`,
      strong: `${META_BENCHMARKS.holdRate.decent}%+`,
      elite: `> ${META_BENCHMARKS.holdRate.strong}%`,
    },
    {
      metric: META_BENCHMARKS.ctr.label,
      fixIt: `< ${META_BENCHMARKS.ctr.fixIt}%`,
      decent: `${META_BENCHMARKS.ctr.fixIt}-${META_BENCHMARKS.ctr.decent}%`,
      strong: `${META_BENCHMARKS.ctr.decent}-${META_BENCHMARKS.ctr.strong}%`,
      elite: `> ${META_BENCHMARKS.ctr.strong}%`,
    },
    {
      metric: "Frequency",
      fixIt: "",
      decent: `< ${META_BENCHMARKS.frequency.healthy}`,
      strong: `${META_BENCHMARKS.frequency.healthy}-${META_BENCHMARKS.frequency.warning}`,
      elite: `> ${META_BENCHMARKS.frequency.fatigued} = Fatigued`,
    },
  ];
}

function getTikTokBenchmarks(): BenchmarkRow[] {
  return [
    {
      metric: TIKTOK_BENCHMARKS.hookRate.label,
      fixIt: `< ${TIKTOK_BENCHMARKS.hookRate.fixIt}%`,
      decent: `${TIKTOK_BENCHMARKS.hookRate.fixIt}-${TIKTOK_BENCHMARKS.hookRate.decent}%`,
      strong: `${TIKTOK_BENCHMARKS.hookRate.decent}-${TIKTOK_BENCHMARKS.hookRate.strong}%`,
      elite: `> ${TIKTOK_BENCHMARKS.hookRate.strong}%`,
    },
    {
      metric: TIKTOK_BENCHMARKS.holdRate.label,
      fixIt: `< ${TIKTOK_BENCHMARKS.holdRate.fixIt}%`,
      decent: `${TIKTOK_BENCHMARKS.holdRate.fixIt}-${TIKTOK_BENCHMARKS.holdRate.decent}%`,
      strong: `${TIKTOK_BENCHMARKS.holdRate.decent}%+`,
      elite: `> ${TIKTOK_BENCHMARKS.holdRate.strong}%`,
    },
    {
      metric: TIKTOK_BENCHMARKS.ctr.label,
      fixIt: `< ${TIKTOK_BENCHMARKS.ctr.fixIt}%`,
      decent: `${TIKTOK_BENCHMARKS.ctr.fixIt}-${TIKTOK_BENCHMARKS.ctr.decent}%`,
      strong: `${TIKTOK_BENCHMARKS.ctr.decent}-${TIKTOK_BENCHMARKS.ctr.strong}%`,
      elite: `> ${TIKTOK_BENCHMARKS.ctr.strong}%`,
    },
    {
      metric: "Frequency",
      fixIt: "",
      decent: `< ${TIKTOK_BENCHMARKS.frequency.healthy}`,
      strong: `${TIKTOK_BENCHMARKS.frequency.healthy}-${TIKTOK_BENCHMARKS.frequency.warning}`,
      elite: `> ${TIKTOK_BENCHMARKS.frequency.fatigued} = Fatigued`,
    },
  ];
}

function getGoogleBenchmarks(): BenchmarkRow[] {
  return [
    {
      metric: GOOGLE_BENCHMARKS.ctr.label,
      fixIt: `< ${GOOGLE_BENCHMARKS.ctr.fixIt}%`,
      decent: `${GOOGLE_BENCHMARKS.ctr.fixIt}-${GOOGLE_BENCHMARKS.ctr.decent}%`,
      strong: `${GOOGLE_BENCHMARKS.ctr.decent}-${GOOGLE_BENCHMARKS.ctr.strong}%`,
      elite: `> ${GOOGLE_BENCHMARKS.ctr.strong}%`,
    },
    {
      metric: GOOGLE_BENCHMARKS.qualityScore.label,
      fixIt: `1-${GOOGLE_BENCHMARKS.qualityScore.poor}`,
      decent: `${GOOGLE_BENCHMARKS.qualityScore.poor + 1}-${GOOGLE_BENCHMARKS.qualityScore.average}`,
      strong: `${GOOGLE_BENCHMARKS.qualityScore.average + 1}-${GOOGLE_BENCHMARKS.qualityScore.good}`,
      elite: `9-10`,
    },
  ];
}

const TIER_COLORS = {
  fixIt: "text-red-400",
  decent: "text-amber-400",
  strong: "text-emerald-400",
  elite: "text-emerald-300",
};

export function BenchmarkPanel({ platform }: BenchmarkPanelProps) {
  const [open, setOpen] = useState(false);

  const platformLabel = platform === "all" ? "Platform" : platform === "meta" ? "Meta" : platform === "tiktok" ? "TikTok" : "Google";

  return (
    <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info size={14} className="text-[#94A3B8]" />
          <span className="text-xs font-semibold text-[#94A3B8]">
            {platformLabel} benchmarks -- what good looks like
          </span>
        </div>
        {open ? <ChevronUp size={14} className="text-[#94A3B8]" /> : <ChevronDown size={14} className="text-[#94A3B8]" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {/* Cross-platform note */}
          {platform === "all" && (
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-[10px] text-amber-400 leading-relaxed">
                Hook rates are not comparable across platforms. Meta uses 3 seconds. TikTok uses 2 seconds.
              </p>
            </div>
          )}

          {/* Meta benchmarks */}
          {(platform === "all" || platform === "meta") && (
            <BenchmarkTable title="Meta Ads" rows={getMetaBenchmarks()} />
          )}

          {/* TikTok benchmarks */}
          {(platform === "all" || platform === "tiktok") && (
            <BenchmarkTable title="TikTok Ads" rows={getTikTokBenchmarks()} />
          )}

          {/* Google benchmarks */}
          {(platform === "all" || platform === "google") && (
            <BenchmarkTable title="Google Ads" rows={getGoogleBenchmarks()} />
          )}
        </div>
      )}
    </div>
  );
}

function BenchmarkTable({ title, rows }: { title: string; rows: BenchmarkRow[] }) {
  return (
    <div>
      <p className="text-[10px] text-white font-semibold uppercase tracking-wider mb-2">{title}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] min-w-[400px]">
          <thead>
            <tr className="border-b border-white/[0.08]">
              <th className="text-left p-2 text-[#94A3B8] font-semibold uppercase">Metric</th>
              <th className={cn("text-center p-2 font-semibold uppercase", TIER_COLORS.fixIt)}>Fix It</th>
              <th className={cn("text-center p-2 font-semibold uppercase", TIER_COLORS.decent)}>Decent</th>
              <th className={cn("text-center p-2 font-semibold uppercase", TIER_COLORS.strong)}>Strong</th>
              <th className={cn("text-center p-2 font-semibold uppercase", TIER_COLORS.elite)}>Elite</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.metric} className="border-b border-white/[0.04]">
                <td className="p-2 text-[#94A3B8]">{row.metric}</td>
                <td className={cn("p-2 text-center", TIER_COLORS.fixIt)}>{row.fixIt || "--"}</td>
                <td className={cn("p-2 text-center", TIER_COLORS.decent)}>{row.decent}</td>
                <td className={cn("p-2 text-center", TIER_COLORS.strong)}>{row.strong}</td>
                <td className={cn("p-2 text-center", TIER_COLORS.elite)}>{row.elite}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
