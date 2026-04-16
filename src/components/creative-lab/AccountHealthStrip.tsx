"use client";

import { cn } from "@/lib/utils";
import type { LiveCreative } from "@/lib/creativeAggregator";

interface AccountHealthStripProps {
  creatives: LiveCreative[];
}

export function AccountHealthStrip({ creatives }: AccountHealthStripProps) {
  const totalCount = creatives.length;
  const avgScore = totalCount > 0
    ? Math.round(creatives.reduce((sum, c) => sum + c.compositeScore, 0) / totalCount)
    : 0;
  const fatiguedCount = creatives.filter((c) => c.isFatigued).length;
  const liveCount = creatives.filter((c) => c.isLive).length;
  const learningCount = creatives.filter((c) => c.scoreResult.isLearning).length;
  const scaleCount = creatives.filter((c) => c.scoreResult.label === "Scale").length;
  const killCount = creatives.filter((c) => c.scoreResult.label === "Kill").length;

  const stats = [
    { label: "Total Creatives", value: totalCount.toString(), tooltip: "Total number of ad creatives tracked" },
    { label: "Avg Score", value: avgScore.toString(), tooltip: "Average composite performance score" },
    { label: "Live", value: liveCount.toString(), tooltip: "Creatives currently receiving spend" },
    { label: "Scale", value: scaleCount.toString(), tooltip: "Creatives scoring 85+ (top performers)", color: "text-emerald-400" },
    { label: "Kill", value: killCount.toString(), tooltip: "Creatives scoring below 55", color: killCount > 0 ? "text-red-400" : undefined },
    { label: "Fatigued", value: fatiguedCount.toString(), tooltip: "Creatives with high frequency - may need refreshing", color: fatiguedCount > 0 ? "text-red-400" : "text-emerald-400" },
    { label: "Learning", value: learningCount.toString(), tooltip: "Below minimum spend threshold", color: "text-slate-400" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl flex flex-col justify-center px-4 sm:px-5 py-3 sm:py-4"
          title={s.tooltip}
        >
          <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">{s.label}</p>
          <p className={cn("text-xl sm:text-2xl font-bold", s.color)}>
            {s.value}
          </p>
        </div>
      ))}
    </div>
  );
}
