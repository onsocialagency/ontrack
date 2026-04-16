"use client";

import { useCallback, useEffect } from "react";
import { X, ExternalLink, Clock, Play, Image, Layers, Type, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatROAS } from "@/lib/utils";
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

interface CreativeDetailModalProps {
  creative: LiveCreative;
  currency: string;
  onClose: () => void;
}

export function CreativeDetailModal({ creative, currency, onClose }: CreativeDetailModalProps) {
  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const { scoreResult } = creative;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-[#0A0A0F]/95 backdrop-blur-xl border border-white/[0.08] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-white/[0.08] bg-[#0A0A0F]/95 backdrop-blur-xl">
          <div className="min-w-0 mr-4">
            <h2 className="text-base font-semibold text-white truncate">{creative.name}</h2>
            <p className="text-xs text-[#94A3B8] mt-0.5">Ad ID: {creative.adId}</p>
          </div>
          <button onClick={onClose} className="flex-shrink-0 p-2 rounded-lg hover:bg-white/[0.08] transition-colors text-[#94A3B8] hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 p-4 sm:p-6">
          {/* Left: Ad preview */}
          <div className="space-y-4">
            {creative.platform === "google" ? (
              <GoogleAdPreview creative={creative} />
            ) : (
              <SocialAdPreview creative={creative} />
            )}
          </div>

          {/* Right: Metrics & details */}
          <div className="space-y-5">
            {/* Score breakdown */}
            <ScoreBreakdown creative={creative} />

            {/* Traffic quality warnings */}
            {scoreResult.warnings.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <p className="text-[10px] text-amber-400 uppercase tracking-wider font-semibold mb-1">Traffic Quality Warning</p>
                {scoreResult.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-amber-300/80 leading-relaxed">{w}</p>
                ))}
              </div>
            )}

            {/* Performance Metrics */}
            <div>
              <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-semibold mb-2">Performance Metrics</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Ad Spend", value: formatCurrency(creative.spend, currency) },
                  { label: "ROAS", value: scoreResult.isROASHidden ? "--" : formatROAS(creative.roas), note: scoreResult.isROASHidden ? "Hidden (prospecting)" : undefined },
                  { label: "CPA", value: creative.conversions > 0 ? formatCurrency(creative.spend / creative.conversions, currency) : "--" },
                  { label: "CPC", value: creative.clicks > 0 ? formatCurrency(creative.spend / creative.clicks, currency) : "--" },
                  { label: "CTR", value: `${creative.ctr.toFixed(2)}%` },
                  { label: "Impressions", value: creative.impressions.toLocaleString() },
                ].map((m) => (
                  <div key={m.label} className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                    <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider">{m.label}</p>
                    <p className="text-sm font-semibold text-white mt-0.5">{m.value}</p>
                    {m.note && <p className="text-[8px] text-amber-400/60 mt-0.5">{m.note}</p>}
                  </div>
                ))}
              </div>
            </div>

            {/* Video completion funnel */}
            {(creative.format === "VID" || creative.platform === "tiktok") && creative.videoPlays > 0 && (
              <VideoCompletionFunnel creative={creative} />
            )}

            {/* Google search ad details */}
            {creative.platform === "google" && creative.format === "SEARCH" && (
              <div>
                <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-semibold mb-2">Search Ad Details</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Impressions", value: creative.impressions.toLocaleString() },
                    { label: "Clicks", value: creative.clicks.toLocaleString() },
                    { label: "CPC", value: creative.clicks > 0 ? formatCurrency(creative.spend / creative.clicks, currency) : "--" },
                    { label: "Conv. Rate", value: creative.clicks > 0 ? `${((creative.conversions / creative.clicks) * 100).toFixed(2)}%` : "--" },
                    { label: "Revenue", value: formatCurrency(creative.revenue, currency) },
                    ...(creative.websitePurchaseRoas > 0 ? [{ label: "Purchase ROAS", value: `${creative.websitePurchaseRoas.toFixed(2)}x` }] : []),
                  ].map((m) => (
                    <div key={m.label} className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                      <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider">{m.label}</p>
                      <p className="text-sm font-semibold text-white mt-0.5">{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Status */}
            <div className="flex items-center gap-3">
              <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-semibold">Status</p>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                <span className={cn("w-2 h-2 rounded-full", creative.isLive ? "bg-emerald-400 animate-pulse" : "bg-amber-400")} />
                <span className={creative.isLive ? "text-emerald-400" : "text-amber-400"}>
                  {creative.isLive ? "Active" : "Paused"}
                </span>
              </span>
            </div>

            {/* Campaign / Ad Set */}
            <div className="space-y-2">
              <div>
                <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-semibold">Campaign</p>
                <p className="text-sm text-white mt-0.5">{creative.campaign || "--"}</p>
              </div>
              {creative.adSet && (
                <div>
                  <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-semibold">Ad Set</p>
                  <p className="text-sm text-white mt-0.5">{creative.adSet}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-semibold">Channel Role</p>
                <p className="text-sm text-white mt-0.5 capitalize">{creative.channelRole}</p>
              </div>
            </div>

            {/* Run Duration */}
            <div>
              <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-semibold">Run Duration</p>
              <p className="text-sm text-white mt-0.5 flex items-center gap-1">
                <Clock size={14} className="text-[#94A3B8]" />
                {creative.daysRunning} days running
              </p>
            </div>

            {/* AI Analysis placeholder */}
            <button
              disabled
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.02] text-[#64748B] cursor-not-allowed"
            >
              <Sparkles size={14} />
              <span className="text-xs font-medium">AI Creative Analysis</span>
              <span className="text-[9px] bg-white/[0.06] px-1.5 py-0.5 rounded-full">Coming Soon</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function ScoreBreakdown({ creative }: { creative: LiveCreative }) {
  const { scoreResult } = creative;
  if (scoreResult.isLearning || scoreResult.breakdown.length === 0) {
    return (
      <div className="p-3 rounded-xl bg-slate-500/10 border border-slate-500/20">
        <p className="text-xs text-slate-400">
          {scoreResult.isLearning
            ? "This creative is still in the learning phase (below minimum spend threshold)."
            : "No score breakdown available."}
        </p>
      </div>
    );
  }

  const maxWeighted = Math.max(...scoreResult.breakdown.map((b) => b.weightedScore), 1);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-semibold">Score Breakdown</p>
        <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold", scoreResult.bgColor)}>
          {scoreResult.label} ({scoreResult.compositeScore})
        </span>
      </div>
      <div className="space-y-2">
        {scoreResult.breakdown.map((item) => {
          const barWidth = Math.max(4, (item.weightedScore / maxWeighted) * 100);
          const barColor = item.normalisedValue >= 70 ? "bg-emerald-500" : item.normalisedValue >= 40 ? "bg-amber-500" : "bg-red-500";
          return (
            <div key={item.metric}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] text-[#94A3B8]">{item.metric}</span>
                <span className="text-[10px] text-white font-medium">
                  {item.rawValue.toFixed(1)} ({Math.round(item.weight * 100)}%)
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${barWidth}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      {/* Context labels */}
      {scoreResult.scoredOn && (
        <p className="text-[9px] text-[#64748B] mt-2">Scored on: {scoreResult.scoredOn}</p>
      )}
      {scoreResult.notScoredOn && (
        <p className="text-[9px] text-amber-400/60 mt-0.5">Not scored on: {scoreResult.notScoredOn}</p>
      )}
    </div>
  );
}

function VideoCompletionFunnel({ creative }: { creative: LiveCreative }) {
  const base = creative.videoPlays || 1;
  const stages = [
    { label: "Plays", value: creative.videoPlays, pct: 100 },
    { label: "25%", value: creative.videoP25, pct: (creative.videoP25 / base) * 100 },
    { label: "50%", value: creative.videoP50, pct: (creative.videoP50 / base) * 100 },
    { label: "75%", value: creative.videoP75, pct: (creative.videoP75 / base) * 100 },
    { label: "100%", value: creative.videoP100, pct: (creative.videoP100 / base) * 100 },
  ];

  return (
    <div>
      <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-semibold mb-2">Video Completion Funnel</p>
      <div className="space-y-1.5">
        {stages.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="text-[9px] text-[#94A3B8] w-8 text-right flex-shrink-0">{s.label}</span>
            <div className="flex-1 h-4 rounded bg-white/[0.04] overflow-hidden relative">
              <div
                className="h-full rounded bg-purple-500/40 transition-all"
                style={{ width: `${Math.min(100, s.pct)}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-[8px] font-medium text-white/80">
                {s.value.toLocaleString()} ({s.pct.toFixed(0)}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GoogleAdPreview({ creative }: { creative: LiveCreative }) {
  const headlines = creative.adTitle ? creative.adTitle.split(" | ").filter(Boolean) : [];
  const descriptions = creative.adBody ? creative.adBody.split(" | ").filter(Boolean) : [];

  return (
    <>
      <div className="space-y-1">
        <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-semibold">Ad Preview</p>
        <div className="rounded-xl bg-[#202124] border border-white/[0.08] p-4 sm:p-5 space-y-2">
          {creative.websiteDestUrl && (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-white/[0.08] flex items-center justify-center flex-shrink-0">
                <span className="text-[9px] text-[#94A3B8] font-bold">G</span>
              </div>
              <span className="text-xs text-[#BDC1C6] truncate">{creative.websiteDestUrl}</span>
            </div>
          )}
          {headlines.length > 0 && (
            <p className="text-lg font-medium text-[#8AB4F8] leading-snug">
              {headlines.slice(0, 3).join(" | ")}
            </p>
          )}
          {descriptions.length > 0 && (
            <p className="text-[13px] text-[#BDC1C6] leading-relaxed line-clamp-2">
              {descriptions.join(". ")}
            </p>
          )}
          <span className="inline-block text-[9px] font-semibold text-[#F1C232] bg-[#F1C232]/10 px-1.5 py-0.5 rounded">Sponsored</span>
        </div>
      </div>

      {headlines.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-semibold">Headlines</p>
          <div className="flex flex-wrap gap-1.5">
            {headlines.map((h, i) => (
              <span key={i} className="px-2.5 py-1 rounded-lg bg-[#8AB4F8]/10 text-[#8AB4F8] text-xs font-medium">{h}</span>
            ))}
          </div>
        </div>
      )}

      {descriptions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-semibold">Descriptions</p>
          <div className="space-y-1.5">
            {descriptions.map((d, i) => (
              <p key={i} className="text-sm text-white/70 pl-3 border-l-2 border-white/[0.08]">{d}</p>
            ))}
          </div>
        </div>
      )}

      {creative.keywordText && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-semibold">Keywords</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium">{creative.keywordText}</span>
            {creative.keywordMatchType && (
              <span className="px-2 py-0.5 rounded bg-white/[0.06] text-[10px] text-[#94A3B8] uppercase font-medium">{creative.keywordMatchType} match</span>
            )}
          </div>
        </div>
      )}

      {creative.websiteDestUrl && (
        <div className="space-y-1">
          <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-semibold">Final URL</p>
          <a href={creative.websiteDestUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors break-all">
            {creative.websiteDestUrl}
          </a>
        </div>
      )}

      {creative.adId && (
        <a href={`https://ads.google.com/aw/ads?adId=${creative.adId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
          <ExternalLink size={12} />
          View in Google Ads
        </a>
      )}
    </>
  );
}

function SocialAdPreview({ creative }: { creative: LiveCreative }) {
  return (
    <>
      {creative.thumbnailUrl ? (
        <div className="rounded-xl overflow-hidden bg-black/40">
          <img src={creative.thumbnailUrl} alt={creative.name} className="w-full object-cover max-h-[300px]" />
        </div>
      ) : (
        <div className={cn("h-48 rounded-xl flex items-center justify-center", FORMAT_COLORS[creative.format] || "bg-white/5")}>
          <div className="text-white/40 scale-150">{FORMAT_ICONS[creative.format]}</div>
        </div>
      )}

      {creative.adBody && (
        <div className="space-y-1">
          <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-semibold">Ad Body</p>
          <p className="text-sm text-white/80 whitespace-pre-wrap">{creative.adBody}</p>
        </div>
      )}

      {creative.adTitle && (
        <div className="space-y-1">
          <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-semibold">Ad Title</p>
          <p className="text-sm font-semibold text-white">{creative.adTitle}</p>
        </div>
      )}

      {creative.adId && creative.platform === "meta" && (
        <a
          href={`https://www.facebook.com/ads/manager/account/campaigns?act=&selected_ad_ids=${creative.adId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          <ExternalLink size={12} />
          View in Meta Ads Manager
        </a>
      )}
    </>
  );
}
