"use client";

import { useMemo } from "react";
import { Lightbulb, TrendingUp, AlertTriangle, Zap, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LiveCreative } from "@/lib/creativeAggregator";

interface PatternInsightsProps {
  creatives: LiveCreative[];
}

interface Insight {
  icon: React.ReactNode;
  title: string;
  body: string;
  color: string;
}

export function PatternInsights({ creatives }: PatternInsightsProps) {
  const insights = useMemo(() => generateInsights(creatives), [creatives]);

  if (insights.length === 0) return null;

  return (
    <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl overflow-hidden">
      <div className="px-4 sm:px-5 py-3 border-b border-white/[0.06] bg-white/[0.02] flex items-center gap-2">
        <Lightbulb size={14} className="text-amber-400" />
        <h3 className="text-sm font-semibold text-white">Pattern Insights</h3>
        <span className="text-[10px] text-[#64748B]">Auto-generated from your data</span>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {insights.slice(0, 5).map((insight, i) => (
          <div key={i} className="px-4 sm:px-5 py-3 flex items-start gap-3">
            <div className={cn("flex-shrink-0 mt-0.5", insight.color)}>
              {insight.icon}
            </div>
            <div>
              <p className="text-xs font-semibold text-white">{insight.title}</p>
              <p className="text-[11px] text-[#94A3B8] leading-relaxed mt-0.5">{insight.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function generateInsights(creatives: LiveCreative[]): Insight[] {
  const insights: Insight[] = [];
  if (creatives.length < 3) return insights;

  const socialCreatives = creatives.filter((c) => c.platform !== "google");
  const videoCreatives = socialCreatives.filter((c) => c.format === "VID");

  // 1. UGC vs Brand gap
  const ugcAds = socialCreatives.filter((c) => c.parsedName.type === "ugc");
  const brandAds = socialCreatives.filter((c) => c.parsedName.type === "brand");
  if (ugcAds.length >= 2 && brandAds.length >= 2) {
    const ugcAvgScore = ugcAds.reduce((s, c) => s + c.compositeScore, 0) / ugcAds.length;
    const brandAvgScore = brandAds.reduce((s, c) => s + c.compositeScore, 0) / brandAds.length;
    const gap = Math.abs(ugcAvgScore - brandAvgScore);
    if (gap > 10) {
      const winner = ugcAvgScore > brandAvgScore ? "UGC" : "Brand";
      const loser = winner === "UGC" ? "Brand" : "UGC";
      insights.push({
        icon: <TrendingUp size={14} />,
        title: `${winner} outperforms ${loser} by ${gap.toFixed(0)} points`,
        body: `${winner} creatives average a composite score of ${Math.round(Math.max(ugcAvgScore, brandAvgScore))} vs ${Math.round(Math.min(ugcAvgScore, brandAvgScore))} for ${loser}. Consider shifting creative production toward ${winner} formats.`,
        color: "text-emerald-400",
      });
    }
  }

  // 2. Best / worst hook rate angle
  if (videoCreatives.length >= 3) {
    const angleMap: Record<string, { sum: number; count: number }> = {};
    for (const c of videoCreatives) {
      const angle = c.parsedName.angle || "Other";
      if (!angleMap[angle]) angleMap[angle] = { sum: 0, count: 0 };
      angleMap[angle].sum += c.hookRate;
      angleMap[angle].count++;
    }
    const angles = Object.entries(angleMap)
      .filter(([, v]) => v.count >= 2)
      .map(([angle, v]) => ({ angle, avg: v.sum / v.count, count: v.count }))
      .sort((a, b) => b.avg - a.avg);

    if (angles.length >= 2) {
      const best = angles[0];
      const worst = angles[angles.length - 1];
      if (best.avg - worst.avg > 5) {
        insights.push({
          icon: <TrendingUp size={14} />,
          title: `"${best.angle}" hooks best at ${best.avg.toFixed(1)}%`,
          body: `The "${best.angle}" angle averages ${best.avg.toFixed(1)}% hook rate across ${best.count} ads, vs "${worst.angle}" at ${worst.avg.toFixed(1)}%. Test more "${best.angle}" variations.`,
          color: "text-sky-400",
        });
      }
    }
  }

  // 3. Fatigue alerts
  const fatiguedAds = creatives.filter((c) => c.scoreResult.fatigueLevel === "critical" || c.scoreResult.fatigueLevel === "fatigued");
  if (fatiguedAds.length > 0) {
    const totalFatigueSpend = fatiguedAds.reduce((s, c) => s + c.spend, 0);
    insights.push({
      icon: <AlertTriangle size={14} />,
      title: `${fatiguedAds.length} fatigued creative${fatiguedAds.length !== 1 ? "s" : ""} still running`,
      body: `These ads have been shown too frequently and CTR is declining. Combined spend: ${totalFatigueSpend > 1000 ? `${(totalFatigueSpend / 1000).toFixed(1)}K` : totalFatigueSpend.toFixed(0)}. Consider refreshing or pausing them.`,
      color: "text-red-400",
    });
  }

  // 4. Scale opportunities
  const scaleAds = creatives.filter((c) => c.scoreResult.label === "Scale" && c.isLive);
  if (scaleAds.length > 0) {
    const lowSpendScaleAds = scaleAds.filter((c) => {
      const avgSpend = creatives.reduce((s, cr) => s + cr.spend, 0) / creatives.length;
      return c.spend < avgSpend * 0.7;
    });
    if (lowSpendScaleAds.length > 0) {
      insights.push({
        icon: <Zap size={14} />,
        title: `${lowSpendScaleAds.length} scale-worthy ad${lowSpendScaleAds.length !== 1 ? "s" : ""} under-invested`,
        body: `These creatives score 85+ but are receiving below-average spend. Increase budget allocation to capitalize on their strong performance.`,
        color: "text-amber-400",
      });
    }
  }

  // 5. Naming convention adoption
  const parsedAds = creatives.filter((c) => c.parsedName.format !== "unknown" && c.parsedName.type !== "unknown");
  const adoptionRate = creatives.length > 0 ? (parsedAds.length / creatives.length) * 100 : 0;
  if (adoptionRate < 80 && creatives.length >= 5) {
    insights.push({
      icon: <Tag size={14} />,
      title: `Naming convention adoption: ${adoptionRate.toFixed(0)}%`,
      body: `Only ${parsedAds.length} of ${creatives.length} ads follow the naming convention. Consistent naming (CLIENT_FORMAT_TYPE_ANGLE_WEEK) enables better creative analysis.`,
      color: "text-violet-400",
    });
  } else if (adoptionRate >= 80 && creatives.length >= 5) {
    insights.push({
      icon: <Tag size={14} />,
      title: `Strong naming convention adoption: ${adoptionRate.toFixed(0)}%`,
      body: `${parsedAds.length} of ${creatives.length} ads follow the naming convention. This enables accurate scoring and pattern detection.`,
      color: "text-emerald-400",
    });
  }

  return insights;
}
