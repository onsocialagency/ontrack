"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { cn, formatCurrency, formatROAS } from "@/lib/utils";
import { PillToggle } from "@/components/ui/pill-toggle";
import type { WindsorRow } from "@/lib/windsor";
import type { LiveCreative } from "@/lib/creativeAggregator";

/* ── Types ── */

interface ParsedHeadline {
  text: string;
  adName: string;
  adId: string;
  campaign: string;
  adGroup: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  ctr: number;
  roas: number;
}

interface GoogleAdEntry {
  adId: string;
  adName: string;
  campaign: string;
  adGroup: string;
  headlines: string[];
  descriptions: string[];
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  ctr: number;
  roas: number;
  cpa: number;
  finalUrl: string;
  keywordText: string;
  keywordMatchType: string;
}

interface KeywordRow {
  keyword: string;
  matchType: string;
  campaign: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  ctr: number;
  cpa: number;
  roas: number;
}

/* ── Props ── */

interface GoogleAdsCopyViewProps {
  /** Raw Windsor Google Ads rows from the creative fetch */
  googleAdsRows: WindsorRow[];
  /** Aggregated Google creatives from the scoring engine */
  googleCreatives: LiveCreative[];
  currency: string;
  loading: boolean;
  isLive: boolean;
}

/* ── Sub-tab options ── */

const SUB_TAB_OPTIONS = [
  { value: "ads", label: "Ad Copy" },
  { value: "headlines", label: "Headlines" },
  { value: "keywords", label: "Keywords" },
];

/* ── Helpers ── */

/** Parse Windsor's combined headline text (pipe-separated) into individual headlines */
function parseHeadlines(combined: string | undefined): string[] {
  if (!combined) return [];
  return combined
    .split(/\s*\|\s*/)
    .map((h) => h.trim())
    .filter(Boolean);
}

function parseDescriptions(combined: string | undefined): string[] {
  if (!combined) return [];
  return combined
    .split(/\s*\|\s*/)
    .map((d) => d.trim())
    .filter(Boolean);
}

/* ── Component ── */

export function GoogleAdsCopyView({ googleAdsRows, googleCreatives, currency, loading, isLive }: GoogleAdsCopyViewProps) {
  const [subTab, setSubTab] = useState("ads");
  const [searchQuery, setSearchQuery] = useState("");

  /* ── Parse Google Ads entries from raw Windsor rows ── */
  const googleAds = useMemo(() => {
    if (!googleAdsRows || googleAdsRows.length === 0) return [];

    // Group by ad_id (or ad_name if no id)
    const grouped = new Map<string, WindsorRow[]>();
    for (const row of googleAdsRows) {
      const key = row.ad_id || row.ad_name || row.campaign;
      if (!key) continue;
      const group = grouped.get(key) || [];
      group.push(row);
      grouped.set(key, group);
    }

    const ads: GoogleAdEntry[] = [];
    for (const [adId, rows] of grouped) {
      let spend = 0, impressions = 0, clicks = 0, conversions = 0, revenue = 0;
      let adName = "", campaign = "", adGroup = "", finalUrl = "", keywordText = "", keywordMatchType = "";
      let headlinesRaw = "", descriptionsRaw = "";

      for (const r of rows) {
        spend += r.spend;
        impressions += r.impressions;
        clicks += r.clicks;
        conversions += r.conversions;
        revenue += r.revenue;
        adName = adName || r.ad_name || "";
        campaign = campaign || r.campaign;
        adGroup = adGroup || r.ad_group_name || r.adset || "";
        finalUrl = finalUrl || r.ad_final_urls || "";
        keywordText = keywordText || r.keyword_text || "";
        keywordMatchType = keywordMatchType || r.keyword_match_type || "";
        headlinesRaw = headlinesRaw || r.ad_headlines || "";
        descriptionsRaw = descriptionsRaw || r.ad_descriptions || "";
      }

      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
      const roas = spend > 0 ? revenue / spend : 0;
      const cpa = conversions > 0 ? spend / conversions : 0;

      ads.push({
        adId,
        adName,
        campaign,
        adGroup,
        headlines: parseHeadlines(headlinesRaw),
        descriptions: parseDescriptions(descriptionsRaw),
        spend,
        impressions,
        clicks,
        conversions,
        revenue,
        ctr,
        roas,
        cpa,
        finalUrl: finalUrl.replace(/[\[\]"]/g, ""),
        keywordText,
        keywordMatchType,
      });
    }

    return ads.sort((a, b) => b.spend - a.spend);
  }, [googleAdsRows]);

  /* ── Extract all unique headlines across all ads ── */
  const allHeadlines = useMemo(() => {
    const headlineMap = new Map<string, ParsedHeadline>();
    for (const ad of googleAds) {
      for (const text of ad.headlines) {
        const existing = headlineMap.get(text);
        if (existing) {
          existing.spend += ad.spend;
          existing.impressions += ad.impressions;
          existing.clicks += ad.clicks;
          existing.conversions += ad.conversions;
          existing.revenue += ad.revenue;
        } else {
          headlineMap.set(text, {
            text,
            adName: ad.adName,
            adId: ad.adId,
            campaign: ad.campaign,
            adGroup: ad.adGroup,
            spend: ad.spend,
            impressions: ad.impressions,
            clicks: ad.clicks,
            conversions: ad.conversions,
            revenue: ad.revenue,
            ctr: ad.ctr,
            roas: ad.roas,
          });
        }
      }
    }
    return Array.from(headlineMap.values()).sort((a, b) => b.impressions - a.impressions);
  }, [googleAds]);

  /* ── Extract keywords from Google Ads rows ── */
  const keywords = useMemo(() => {
    const kwMap = new Map<string, KeywordRow>();
    for (const ad of googleAds) {
      if (!ad.keywordText) continue;
      const existing = kwMap.get(ad.keywordText);
      if (existing) {
        existing.spend += ad.spend;
        existing.impressions += ad.impressions;
        existing.clicks += ad.clicks;
        existing.conversions += ad.conversions;
        existing.revenue += ad.revenue;
      } else {
        kwMap.set(ad.keywordText, {
          keyword: ad.keywordText,
          matchType: ad.keywordMatchType || "broad",
          campaign: ad.campaign,
          spend: ad.spend,
          impressions: ad.impressions,
          clicks: ad.clicks,
          conversions: ad.conversions,
          revenue: ad.revenue,
          ctr: ad.ctr,
          cpa: ad.cpa,
          roas: ad.roas,
        });
      }
    }
    return Array.from(kwMap.values()).sort((a, b) => b.spend - a.spend);
  }, [googleAds]);

  /* ── Summary stats ── */
  const stats = useMemo(() => {
    const totalSpend = googleAds.reduce((s, a) => s + a.spend, 0);
    const totalImpressions = googleAds.reduce((s, a) => s + a.impressions, 0);
    const totalClicks = googleAds.reduce((s, a) => s + a.clicks, 0);
    const totalConversions = googleAds.reduce((s, a) => s + a.conversions, 0);
    const totalRevenue = googleAds.reduce((s, a) => s + a.revenue, 0);
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    const cpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
    return { totalSpend, totalImpressions, totalClicks, totalConversions, totalRevenue, ctr, roas, cpa, adCount: googleAds.length, headlineCount: allHeadlines.length, keywordCount: keywords.length };
  }, [googleAds, allHeadlines, keywords]);

  if (loading) {
    return (
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-12 text-center">
        <p className="text-sm text-[#94A3B8] animate-pulse">Loading Google Ads data...</p>
      </div>
    );
  }

  if (googleAds.length === 0 && googleCreatives.length === 0) {
    return (
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-12 text-center">
        <p className="text-sm font-medium text-white">No Google Ads data available</p>
        <p className="text-xs text-[#94A3B8] mt-1">
          {isLive
            ? "No Google Ads campaigns found in the selected date range."
            : "Connect your Google Ads account via Windsor to see ad copy performance, headlines, and keywords here."
          }
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        <StatCard label="Google Ads" value={String(stats.adCount)} />
        <StatCard label="Headlines" value={String(stats.headlineCount)} />
        <StatCard label="Keywords" value={String(stats.keywordCount)} />
        <StatCard label="Spend" value={formatCurrency(stats.totalSpend, currency)} />
        <StatCard label="CTR" value={`${stats.ctr.toFixed(2)}%`} color={stats.ctr >= 3 ? "text-emerald-400" : stats.ctr >= 1 ? "text-amber-400" : "text-red-400"} />
        <StatCard label="ROAS" value={stats.roas > 0 ? formatROAS(stats.roas) : "--"} color={stats.roas >= 3 ? "text-emerald-400" : stats.roas >= 1 ? "text-amber-400" : "text-red-400"} />
      </div>

      {/* Sub-tabs + search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <PillToggle options={SUB_TAB_OPTIONS} value={subTab} onChange={setSubTab} size="sm" />
        <div className="flex-1" />
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs text-white placeholder:text-[#94A3B8]/60 focus:border-[#FF6A41]/40 focus:outline-none w-full sm:w-[180px]"
          />
        </div>
      </div>

      {subTab === "ads" && <AdCopyTab ads={googleAds} searchQuery={searchQuery} currency={currency} />}
      {subTab === "headlines" && <HeadlinesTab headlines={allHeadlines} searchQuery={searchQuery} currency={currency} />}
      {subTab === "keywords" && <KeywordsTab keywords={keywords} searchQuery={searchQuery} currency={currency} />}
    </div>
  );
}

/* ── Stat Card ── */

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2">
      <p className="text-[10px] text-[#64748B] uppercase tracking-wider">{label}</p>
      <p className={cn("text-sm font-bold mt-0.5", color || "text-white")}>{value}</p>
    </div>
  );
}

/* ── Ad Copy Tab ── */

function AdCopyTab({ ads, searchQuery, currency }: { ads: GoogleAdEntry[]; searchQuery: string; currency: string }) {
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return ads;
    const q = searchQuery.toLowerCase();
    return ads.filter((a) =>
      a.campaign.toLowerCase().includes(q) ||
      a.adName.toLowerCase().includes(q) ||
      a.headlines.some((h) => h.toLowerCase().includes(q)) ||
      a.descriptions.some((d) => d.toLowerCase().includes(q)) ||
      a.keywordText.toLowerCase().includes(q)
    );
  }, [ads, searchQuery]);

  if (filtered.length === 0) {
    return <EmptyState message="No Google Ads found matching your search." />;
  }

  return (
    <div className="space-y-3">
      {filtered.map((ad, i) => (
        <div key={ad.adId + i} className="glass-card rounded-xl p-4 space-y-3 hover:border-white/[0.12] transition-colors">
          {/* Google SERP-style preview */}
          <div className="space-y-1">
            {ad.finalUrl && (
              <p className="text-[11px] text-[#94A3B8] truncate">{ad.finalUrl}</p>
            )}
            <h3 className="text-base font-medium text-[#8AB4F8] leading-snug">
              {ad.headlines.length > 0 ? ad.headlines.slice(0, 3).join(" | ") : ad.adName || "Untitled Ad"}
            </h3>
            {ad.descriptions.length > 0 && (
              <p className="text-xs text-[#BDC1C6] leading-relaxed line-clamp-2">
                {ad.descriptions.join(" ")}
              </p>
            )}
          </div>

          {/* Meta info */}
          <div className="flex items-center gap-2 flex-wrap text-[10px]">
            <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-semibold uppercase tracking-wider">Google</span>
            <span className="text-[#64748B] truncate max-w-[200px]">{ad.campaign}</span>
            {ad.adGroup && <span className="text-[#475569]">{ad.adGroup}</span>}
            {ad.keywordText && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium">
                {ad.keywordText}
              </span>
            )}
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
            <MetricCell label="Spend" value={formatCurrency(ad.spend, currency)} />
            <MetricCell label="Impressions" value={ad.impressions.toLocaleString()} />
            <MetricCell label="Clicks" value={ad.clicks.toLocaleString()} />
            <MetricCell label="CTR" value={`${ad.ctr.toFixed(2)}%`} color={ad.ctr >= 3 ? "text-emerald-400" : ad.ctr >= 1 ? "text-amber-400" : "text-red-400"} />
            <MetricCell label="Conv" value={String(ad.conversions)} />
            <MetricCell label="ROAS" value={ad.roas > 0 ? formatROAS(ad.roas) : "--"} color={ad.roas >= 3 ? "text-emerald-400" : ad.roas >= 1 ? "text-amber-400" : "text-red-400"} />
          </div>

          {/* Individual headlines */}
          {ad.headlines.length > 0 && (
            <div className="pt-2 border-t border-white/[0.04]">
              <p className="text-[10px] text-[#64748B] uppercase tracking-wider mb-1.5">Headlines ({ad.headlines.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {ad.headlines.map((h, j) => (
                  <span key={j} className="px-2 py-1 rounded-lg bg-white/[0.04] text-xs text-[#8AB4F8]">{h}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Headlines Tab ── */

function HeadlinesTab({ headlines, searchQuery, currency }: { headlines: ParsedHeadline[]; searchQuery: string; currency: string }) {
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return headlines;
    const q = searchQuery.toLowerCase();
    return headlines.filter((h) => h.text.toLowerCase().includes(q) || h.campaign.toLowerCase().includes(q));
  }, [headlines, searchQuery]);

  if (headlines.length === 0) {
    return <EmptyState message="No headline data available. Headlines are extracted from Responsive Search Ads." />;
  }

  return (
    <section className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl overflow-hidden">
      <div className="px-4 sm:px-5 py-3 border-b border-white/[0.06] bg-white/[0.02]">
        <h3 className="text-sm font-semibold text-[#8AB4F8]">
          All Headlines ({filtered.length})
        </h3>
        <p className="text-[10px] text-[#64748B] mt-0.5">
          Headlines are extracted from your Responsive Search Ads. Google dynamically combines these to find the best performing combinations.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-white/[0.08]">
              <th className="text-left p-3 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Headline</th>
              <th className="text-left p-3 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Campaign</th>
              <th className="text-right p-3 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Impressions</th>
              <th className="text-right p-3 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Clicks</th>
              <th className="text-right p-3 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">CTR</th>
              <th className="text-right p-3 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Conv</th>
              <th className="text-right p-3 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Spend</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((h, i) => {
              const ctr = h.impressions > 0 ? (h.clicks / h.impressions) * 100 : 0;
              return (
                <tr key={`${h.text}-${i}`} className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                  <td className="p-3 text-sm font-medium text-[#8AB4F8] max-w-[300px]">{h.text}</td>
                  <td className="p-3 text-xs text-[#64748B] max-w-[150px] truncate">{h.campaign}</td>
                  <td className="p-3 text-right text-xs text-[#94A3B8]">{h.impressions.toLocaleString()}</td>
                  <td className="p-3 text-right text-xs text-white">{h.clicks.toLocaleString()}</td>
                  <td className="p-3 text-right text-xs">
                    <span className={cn(ctr >= 5 ? "text-emerald-400" : ctr >= 3 ? "text-amber-400" : "text-red-400")}>
                      {ctr.toFixed(2)}%
                    </span>
                  </td>
                  <td className="p-3 text-right text-xs font-medium text-white">{h.conversions}</td>
                  <td className="p-3 text-right text-xs font-medium text-white">{formatCurrency(h.spend, currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ── Keywords Tab ── */

const MATCH_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  exact: { label: "Exact", color: "bg-emerald-500/20 text-emerald-400" },
  phrase: { label: "Phrase", color: "bg-sky-500/20 text-sky-400" },
  broad: { label: "Broad", color: "bg-amber-500/20 text-amber-400" },
  EXACT: { label: "Exact", color: "bg-emerald-500/20 text-emerald-400" },
  PHRASE: { label: "Phrase", color: "bg-sky-500/20 text-sky-400" },
  BROAD: { label: "Broad", color: "bg-amber-500/20 text-amber-400" },
};

function KeywordsTab({ keywords, searchQuery, currency }: { keywords: KeywordRow[]; searchQuery: string; currency: string }) {
  const [matchFilter, setMatchFilter] = useState("all");

  const filtered = useMemo(() => {
    let result = keywords;
    if (matchFilter !== "all") {
      result = result.filter((k) => k.matchType.toLowerCase() === matchFilter.toLowerCase());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((k) => k.keyword.toLowerCase().includes(q) || k.campaign.toLowerCase().includes(q));
    }
    return result;
  }, [keywords, matchFilter, searchQuery]);

  if (keywords.length === 0) {
    return <EmptyState message="No keyword data available. Keywords are extracted from your Google Ads campaigns." />;
  }

  return (
    <div className="space-y-3">
      <PillToggle
        options={[
          { value: "all", label: "All Types" },
          { value: "exact", label: "Exact" },
          { value: "phrase", label: "Phrase" },
          { value: "broad", label: "Broad" },
        ]}
        value={matchFilter}
        onChange={setMatchFilter}
        size="sm"
      />

      <section className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-white/[0.08]">
                <th className="text-left p-3 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Keyword</th>
                <th className="text-center p-3 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Match</th>
                <th className="text-left p-3 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Campaign</th>
                <th className="text-right p-3 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Spend</th>
                <th className="text-right p-3 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Clicks</th>
                <th className="text-right p-3 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">CTR</th>
                <th className="text-right p-3 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Conv</th>
                <th className="text-right p-3 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">CPA</th>
                <th className="text-right p-3 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((k, i) => {
                const matchConfig = MATCH_TYPE_CONFIG[k.matchType] || { label: k.matchType || "—", color: "bg-white/[0.06] text-[#94A3B8]" };
                const ctr = k.impressions > 0 ? (k.clicks / k.impressions) * 100 : 0;
                const cpa = k.conversions > 0 ? k.spend / k.conversions : 0;
                const roas = k.spend > 0 ? k.revenue / k.spend : 0;
                return (
                  <tr key={`${k.keyword}-${i}`} className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                    <td className="p-3 text-sm font-medium text-emerald-400">{k.keyword}</td>
                    <td className="p-3 text-center">
                      <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase", matchConfig.color)}>
                        {matchConfig.label}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-[#64748B] max-w-[150px] truncate">{k.campaign}</td>
                    <td className="p-3 text-right text-xs font-medium text-white">{formatCurrency(k.spend, currency)}</td>
                    <td className="p-3 text-right text-xs text-[#94A3B8]">{k.clicks.toLocaleString()}</td>
                    <td className="p-3 text-right text-xs">
                      <span className={cn(ctr >= 5 ? "text-emerald-400" : ctr >= 3 ? "text-amber-400" : "text-red-400")}>
                        {ctr.toFixed(2)}%
                      </span>
                    </td>
                    <td className="p-3 text-right text-xs font-medium text-white">{k.conversions}</td>
                    <td className="p-3 text-right text-xs font-medium text-white">{cpa > 0 ? formatCurrency(cpa, currency) : "--"}</td>
                    <td className="p-3 text-right">
                      <span className={cn("text-xs font-semibold", roas >= 3 ? "text-emerald-400" : roas >= 1 ? "text-amber-400" : roas > 0 ? "text-red-400" : "text-[#64748B]")}>
                        {roas > 0 ? formatROAS(roas) : "--"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-6 text-center text-xs text-[#94A3B8]">No keywords match the selected filters.</div>
        )}
      </section>
    </div>
  );
}

/* ── Shared ── */

function MetricCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-[9px] text-[#64748B] uppercase tracking-wider">{label}</p>
      <p className={cn("text-xs font-semibold mt-0.5", color || "text-white")}>{value}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-8 text-center">
      <p className="text-sm text-[#94A3B8]">{message}</p>
    </div>
  );
}
