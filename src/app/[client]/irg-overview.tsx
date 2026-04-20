"use client";

import { useMemo, useState, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { SuggestionWidget } from "@/components/suggestions/SuggestionWidget";
import { KpiCard } from "@/components/ui/kpi-card";
import { DataBlur } from "@/components/ui/data-blur";
import { KpiDetailModal, type KpiDetailData } from "@/components/ui/kpi-detail-modal";
import { useWindsor } from "@/lib/use-windsor";
import { useDateRange } from "@/lib/date-range-context";
import { useLocale } from "@/lib/locale-context";
import { useVenue } from "@/lib/venue-context";
import { VenueTabs } from "@/components/layout/venue-tabs";
import type { WindsorRow } from "@/lib/windsor";
import { sumConversions, rowConversions } from "@/lib/windsor";
import {
  IRG_BRANDS,
  IRG_BRAND_ORDER,
  IRG_TOTAL_BUDGET,
  IRG_DATA_GAPS,
  assignIrgBrand,
  isPreexistingCampaign,
  getSeasonPacing,
  type IrgBrandId,
} from "@/lib/irg-brands";
import { formatCurrency, formatNumber, formatROAS, cn } from "@/lib/utils";
import { MetricCell } from "@/components/ui/metric-cell";
import { MetaIcon, GoogleIcon } from "@/components/ui/platform-icons";
import {
  DollarSign, Target, Eye, MousePointer, Percent,
  AlertTriangle, Info, ChevronDown,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

/* ── Types ── */


interface BrandMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpa: number;
  revenue: number;
  metaSpend: number;
  googleSpend: number;
  metaRevenue: number;
  googleRevenue: number;
  metaConversions: number;
  googleConversions: number;
  campaigns: {
    name: string;
    brand: IrgBrandId;
    platform: "Meta" | "Google";
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    cpc: number;
    cpa: number;
    status: "Live" | "Paused" | "Draft";
    isPreexisting: boolean;
  }[];
}

/* ── Aggregation ── */

function aggregateByBrand(rows: WindsorRow[]) {
  const brands: Record<IrgBrandId | "UNKNOWN", BrandMetrics> = {
    IR_HOTEL: { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, ctr: 0, cpc: 0, cpa: 0, metaSpend: 0, googleSpend: 0, metaRevenue: 0, googleRevenue: 0, metaConversions: 0, googleConversions: 0, campaigns: [] },
    IR_EVENTS: { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, ctr: 0, cpc: 0, cpa: 0, metaSpend: 0, googleSpend: 0, metaRevenue: 0, googleRevenue: 0, metaConversions: 0, googleConversions: 0, campaigns: [] },
    "528_VENUE": { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, ctr: 0, cpc: 0, cpa: 0, metaSpend: 0, googleSpend: 0, metaRevenue: 0, googleRevenue: 0, metaConversions: 0, googleConversions: 0, campaigns: [] },
    PIKES_PRESENTS: { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, ctr: 0, cpc: 0, cpa: 0, metaSpend: 0, googleSpend: 0, metaRevenue: 0, googleRevenue: 0, metaConversions: 0, googleConversions: 0, campaigns: [] },
    UNKNOWN: { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, ctr: 0, cpc: 0, cpa: 0, metaSpend: 0, googleSpend: 0, metaRevenue: 0, googleRevenue: 0, metaConversions: 0, googleConversions: 0, campaigns: [] },
  };

  // Aggregate by campaign
  const campaignMap: Record<string, {
    name: string;
    accountId: string;
    platform: string;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    latestDate: string;
    hasRecentSpend: boolean;
  }> = {};

  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Decide once per range whether to use the Google primary→all_conversions
  // fallback. Applied uniformly to every campaign/brand bucket below so the
  // IRG numbers can't diverge from the KPI totals.
  const useAllConvFallback = sumConversions(rows).usedGoogleAllFallback;

  for (const r of rows) {
    const key = `${r.campaign}__${r.account_id || ""}`;
    if (!campaignMap[key]) {
      campaignMap[key] = {
        name: r.campaign,
        accountId: r.account_id || "",
        platform: r.source,
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        revenue: 0,
        latestDate: "",
        hasRecentSpend: false,
      };
    }
    const rc = rowConversions(r, useAllConvFallback);
    campaignMap[key].spend += Number(r.spend) || 0;
    campaignMap[key].impressions += Number(r.impressions) || 0;
    campaignMap[key].clicks += Number(r.clicks) || 0;
    campaignMap[key].conversions += rc.conversions;
    campaignMap[key].revenue += rc.revenue;
    if (r.date && r.date > campaignMap[key].latestDate) {
      campaignMap[key].latestDate = r.date;
    }
    if (r.date && new Date(r.date) >= sevenDaysAgo && (Number(r.spend) || 0) > 0) {
      campaignMap[key].hasRecentSpend = true;
    }
  }

  // Assign campaigns to brands
  for (const [, c] of Object.entries(campaignMap)) {
    const brandId = assignIrgBrand(c.name, c.accountId);
    const brand = brands[brandId] || brands.UNKNOWN;
    const isMeta = c.platform === "facebook" || c.platform === "meta" || c.platform === "instagram";

    brand.spend += c.spend;
    brand.impressions += c.impressions;
    brand.clicks += c.clicks;
    brand.conversions += c.conversions;
    brand.revenue += c.revenue;
    if (isMeta) {
      brand.metaSpend += c.spend;
      brand.metaRevenue += c.revenue;
      brand.metaConversions += c.conversions;
    } else {
      brand.googleSpend += c.spend;
      brand.googleRevenue += c.revenue;
      brand.googleConversions += c.conversions;
    }

    const status: "Live" | "Paused" | "Draft" = c.hasRecentSpend ? "Live" : c.spend > 0 ? "Paused" : "Draft";

    brand.campaigns.push({
      name: c.name,
      brand: brandId as IrgBrandId,
      platform: isMeta ? "Meta" : "Google",
      spend: c.spend,
      impressions: c.impressions,
      clicks: c.clicks,
      conversions: c.conversions,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
      cpc: c.clicks > 0 ? c.spend / c.clicks : 0,
      cpa: c.conversions > 0 ? c.spend / c.conversions : 0,
      status,
      isPreexisting: isPreexistingCampaign(c.name),
    });
  }

  // Calculate derived metrics
  for (const b of Object.values(brands)) {
    b.ctr = b.impressions > 0 ? (b.clicks / b.impressions) * 100 : 0;
    b.cpc = b.clicks > 0 ? b.spend / b.clicks : 0;
    b.cpa = b.conversions > 0 ? b.spend / b.conversions : 0;
    b.campaigns.sort((a, b) => b.spend - a.spend);
  }

  return brands;
}

function aggregateDaily(rows: WindsorRow[], fmtDate: (iso: string) => string) {
  const useAllConvFallback = sumConversions(rows).usedGoogleAllFallback;
  const byDate: Record<string, { date: string; spend: number; impressions: number; clicks: number; conversions: number }> = {};
  for (const r of rows) {
    const d = r.date;
    if (!d) continue;
    if (!byDate[d]) byDate[d] = { date: d, spend: 0, impressions: 0, clicks: 0, conversions: 0 };
    byDate[d].spend += Number(r.spend) || 0;
    byDate[d].impressions += Number(r.impressions) || 0;
    byDate[d].clicks += Number(r.clicks) || 0;
    byDate[d].conversions += rowConversions(r, useAllConvFallback).conversions;
  }
  return Object.values(byDate)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ ...d, date: fmtDate(d.date) }));
}

/* ── Component ── */

export default function IrgOverview() {
  const { days, preset, dateFrom, dateTo, compareEnabled, prevDateFrom, prevDateTo } = useDateRange();
  const { shortDate: fmtDate } = useLocale();
  const { activeVenue: activeTab } = useVenue();
  const [kpiDetail, setKpiDetail] = useState<KpiDetailData | null>(null);
  const closeKpiDetail = useCallback(() => setKpiDetail(null), []);
  const [showGaps, setShowGaps] = useState(true);
  const [gapsOpen, setGapsOpen] = useState(false);

  const { data: windsorData, source: dataSource, loading } = useWindsor<WindsorRow[]>({
    clientSlug: "irg",
    type: "campaigns",
    days,
    ...(preset === "Custom" ? { dateFrom, dateTo } : {}),
  });

  // Previous-period data for period-over-period deltas
  const { data: prevWindsorData } = useWindsor<WindsorRow[]>({
    clientSlug: "irg",
    type: "campaigns",
    days,
    dateFrom: prevDateFrom,
    dateTo: prevDateTo,
  });

  const isLive = dataSource === "windsor" && windsorData && windsorData.length > 0;
  const rows = isLive ? windsorData : [];
  const prevRows = compareEnabled && Array.isArray(prevWindsorData) ? prevWindsorData : [];

  // Aggregate
  const brandMetrics = useMemo(() => aggregateByBrand(rows), [rows]);
  const dailyData = useMemo(() => aggregateDaily(rows, fmtDate), [rows, fmtDate]);

  // Totals
  const totalSpend = useMemo(() => IRG_BRAND_ORDER.reduce((s, id) => s + brandMetrics[id].spend, 0), [brandMetrics]);
  const totalImpressions = useMemo(() => IRG_BRAND_ORDER.reduce((s, id) => s + brandMetrics[id].impressions, 0), [brandMetrics]);
  const totalClicks = useMemo(() => IRG_BRAND_ORDER.reduce((s, id) => s + brandMetrics[id].clicks, 0), [brandMetrics]);
  const totalConversions = useMemo(() => IRG_BRAND_ORDER.reduce((s, id) => s + brandMetrics[id].conversions, 0), [brandMetrics]);
  const totalMetaSpend = useMemo(() => IRG_BRAND_ORDER.reduce((s, id) => s + brandMetrics[id].metaSpend, 0), [brandMetrics]);
  const totalGoogleSpend = useMemo(() => IRG_BRAND_ORDER.reduce((s, id) => s + brandMetrics[id].googleSpend, 0), [brandMetrics]);
  const totalMetaRevenue = useMemo(() => IRG_BRAND_ORDER.reduce((s, id) => s + brandMetrics[id].metaRevenue, 0), [brandMetrics]);
  const totalGoogleRevenue = useMemo(() => IRG_BRAND_ORDER.reduce((s, id) => s + brandMetrics[id].googleRevenue, 0), [brandMetrics]);
  const totalMetaConversions = useMemo(() => IRG_BRAND_ORDER.reduce((s, id) => s + brandMetrics[id].metaConversions, 0), [brandMetrics]);
  const totalGoogleConversions = useMemo(() => IRG_BRAND_ORDER.reduce((s, id) => s + brandMetrics[id].googleConversions, 0), [brandMetrics]);

  const blendedCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const blendedCpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
  const budgetUsedPct = IRG_TOTAL_BUDGET > 0 ? (totalSpend / IRG_TOTAL_BUDGET) * 100 : 0;

  // Previous-period aggregates (computed once per prevRows; scope-resolved below once activeMetrics is known)
  const prevBrandMetrics = useMemo(() => aggregateByBrand(prevRows), [prevRows]);

  // Season pacing
  const seasonPacing = useMemo(() => getSeasonPacing(totalSpend, IRG_TOTAL_BUDGET), [totalSpend]);

  // Active brand data
  const activeBrand = activeTab !== "all" ? IRG_BRANDS[activeTab] : null;
  const activeMetrics = activeTab !== "all" ? brandMetrics[activeTab] : null;
  const activeBudget = activeBrand?.budget || IRG_TOTAL_BUDGET;
  const activeSpend = activeMetrics?.spend || totalSpend;

  // Previous-period scope-resolved metrics (all brands sum vs single brand)
  const prev = useMemo(() => {
    const agg = (key: "spend" | "impressions" | "clicks" | "conversions") => {
      if (activeTab !== "all") {
        const v = prevBrandMetrics[activeTab]?.[key];
        return typeof v === "number" ? v : 0;
      }
      return IRG_BRAND_ORDER.reduce((s, id) => {
        const v = prevBrandMetrics[id]?.[key];
        return s + (typeof v === "number" ? v : 0);
      }, 0);
    };
    const spend = agg("spend");
    const impressions = agg("impressions");
    const clicks = agg("clicks");
    const conversions = agg("conversions");
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpa = conversions > 0 ? spend / conversions : 0;
    return { spend, impressions, clicks, conversions, ctr, cpa };
  }, [prevBrandMetrics, activeTab]);

  // Pct-change delta. Returns 0 when prev is 0 or compare disabled.
  const pctDelta = (cur: number, previous: number): number => {
    if (!compareEnabled || !previous || previous === 0) return 0;
    return ((cur - previous) / previous) * 100;
  };

  const scopedImpressions = activeTab === "all" ? totalImpressions : (activeMetrics?.impressions ?? 0);
  const scopedClicks = activeTab === "all" ? totalClicks : (activeMetrics?.clicks ?? 0);
  const scopedCpa = activeTab === "all" ? blendedCpa : (activeMetrics?.cpa ?? 0);
  const scopedCtr = activeTab === "all" ? blendedCtr : (activeMetrics?.ctr ?? 0);

  const deltaSpend = pctDelta(activeSpend, prev.spend);
  const deltaImpressions = pctDelta(scopedImpressions, prev.impressions);
  const deltaClicks = pctDelta(scopedClicks, prev.clicks);
  const deltaCpa = pctDelta(scopedCpa, prev.cpa);
  const deltaCtr = pctDelta(scopedCtr, prev.ctr);

  // Sparklines
  const sparklines = useMemo(() => ({
    spend: dailyData.map((d) => ({ v: d.spend, label: d.date })),
    impressions: dailyData.map((d) => ({ v: d.impressions, label: d.date })),
    clicks: dailyData.map((d) => ({ v: d.clicks, label: d.date })),
    conversions: dailyData.map((d) => ({ v: d.conversions, label: d.date })),
  }), [dailyData]);

  // KPI detail builder
  const currentLabel = dailyData.length > 0
    ? `${dailyData[0].date} - ${dailyData[dailyData.length - 1].date}`
    : "Current period";

  const platformBreakdown = [
    { name: "Meta Ads", value: totalMetaSpend, formatted: formatCurrency(totalMetaSpend, "EUR"), color: "#3B82F6" },
    { name: "Google Ads", value: totalGoogleSpend, formatted: formatCurrency(totalGoogleSpend, "EUR"), color: "#22C55E" },
  ];

  const buildDetail = (
    title: string,
    icon: React.ReactNode,
    currentValue: string,
    dailyKey: "spend" | "impressions" | "clicks" | "conversions",
    breakdown: { name: string; value: number; formatted: string; color: string }[],
    accentColor: string,
    fmtFn?: (v: number) => string,
  ): KpiDetailData => ({
    title,
    icon,
    currentValue,
    currentLabel,
    dailyData: dailyData.map((d) => ({ date: d.date, current: d[dailyKey] })),
    breakdown,
    accentColor,
    formatValue: fmtFn,
  });

  // Campaigns for current tab
  const campaigns = useMemo(() => {
    if (activeTab === "all") {
      return IRG_BRAND_ORDER.flatMap((id) => brandMetrics[id].campaigns);
    }
    return brandMetrics[activeTab]?.campaigns || [];
  }, [activeTab, brandMetrics]);

  // Brand spend pie chart data
  const brandPieData = useMemo(() =>
    IRG_BRAND_ORDER.map((id) => ({
      name: IRG_BRANDS[id].shortLabel,
      value: brandMetrics[id].spend,
      color: IRG_BRANDS[id].color,
    })).filter((d) => d.value > 0),
  [brandMetrics]);

  return (
    <>
      <Header
        title="Ibiza Rocks Group"
        showAttribution
        dataBadge={{ loading, isLive: !!isLive }}
        filterRow={<VenueTabs />}
      />

      <div className="flex-1 p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-5 overflow-y-auto">

        <DataBlur isBlurred={dataSource !== "windsor" && !loading} isLoading={loading} className="space-y-4 sm:space-y-5">
        {/* ── Data Gap Warnings (collapsible) ── */}
        {showGaps && (() => {
          const gaps = IRG_DATA_GAPS.filter((g) => g.severity === "warning").slice(0, 2);
          if (gaps.length === 0) return null;
          return (
            <div className="rounded-xl bg-amber-500/[0.08] border border-amber-500/[0.15] overflow-hidden">
              <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3">
                <button
                  type="button"
                  onClick={() => setGapsOpen((v) => !v)}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  aria-expanded={gapsOpen}
                  aria-controls="irg-data-gaps-body"
                >
                  <AlertTriangle size={14} className="text-amber-400 flex-shrink-0" />
                  <span className="text-xs font-semibold text-amber-300 truncate">
                    {gaps.length} data gap{gaps.length > 1 ? "s" : ""} to review
                  </span>
                  <ChevronDown
                    size={14}
                    className={cn(
                      "text-amber-400/70 flex-shrink-0 transition-transform ml-auto",
                      gapsOpen && "rotate-180",
                    )}
                  />
                </button>
                <button
                  onClick={() => setShowGaps(false)}
                  className="text-amber-400/50 hover:text-amber-400 text-xs flex-shrink-0"
                >
                  Dismiss
                </button>
              </div>
              {gapsOpen && (
                <div
                  id="irg-data-gaps-body"
                  className="border-t border-amber-500/[0.15] divide-y divide-amber-500/[0.12]"
                >
                  {gaps.map((gap) => (
                    <div key={gap.id} className="px-3 sm:px-4 py-2.5 sm:py-3">
                      <p className="text-xs font-semibold text-amber-300">{gap.title}</p>
                      <p className="text-[11px] text-amber-400/70 mt-0.5">{gap.detail}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── KPI Grid ── */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <KpiCard
            title="Season Budget"
            value={formatCurrency(activeBudget, "EUR")}
            delta={0}
            icon={<DollarSign size={14} />}
            tooltip={activeTab === "all" ? "Total IRG season budget (Mar–Oct 2026)" : `${activeBrand?.label} season budget`}
            subLabel={`${budgetUsedPct.toFixed(1)}% used · €${formatNumber(activeBudget - activeSpend)} remaining`}
            accentColor="#3B82F6"
            onClick={() => setKpiDetail(buildDetail(
              "Season Budget", <DollarSign size={18} />,
              formatCurrency(activeBudget, "EUR"),
              "spend", platformBreakdown, "#3B82F6",
              (v) => formatCurrency(v, "EUR"),
            ))}
          />
          <KpiCard
            title="Total Spend"
            value={formatCurrency(activeSpend, "EUR")}
            delta={deltaSpend}
            icon={<DollarSign size={14} />}
            tooltip="Total ad spend across Meta + Google Ads"
            sparkline={sparklines.spend}
            accentColor="#FF6A41"
            onClick={() => setKpiDetail(buildDetail(
              "Total Spend", <DollarSign size={18} />,
              formatCurrency(activeSpend, "EUR"),
              "spend", platformBreakdown, "#FF6A41",
              (v) => formatCurrency(v, "EUR"),
            ))}
          />
          <KpiCard
            title={totalConversions > 0 ? "Blended CPA" : "CPA"}
            value={totalConversions > 0 ? formatCurrency(activeTab === "all" ? blendedCpa : (activeMetrics?.cpa || 0), "EUR") : "—"}
            delta={deltaCpa}
            invertDelta
            icon={<Target size={14} />}
            tooltip={totalConversions > 0 ? "Total spend / total conversions" : "Conversion tracking not fully set up"}
            sparkline={sparklines.conversions}
            accentColor="#F59E0B"
            subLabel={totalConversions === 0 ? "Pending conversion tracking" : undefined}
            onClick={() => setKpiDetail(buildDetail(
              "Blended CPA", <Target size={18} />,
              totalConversions > 0 ? formatCurrency(blendedCpa, "EUR") : "—",
              "conversions", platformBreakdown, "#F59E0B",
              (v) => formatCurrency(v, "EUR"),
            ))}
          />
          <KpiCard
            title="Impressions"
            value={formatNumber(activeTab === "all" ? totalImpressions : (activeMetrics?.impressions || 0))}
            delta={deltaImpressions}
            icon={<Eye size={14} />}
            tooltip="Total ad impressions"
            sparkline={sparklines.impressions}
            accentColor="#06B6D4"
            onClick={() => setKpiDetail(buildDetail(
              "Impressions", <Eye size={18} />,
              formatNumber(activeTab === "all" ? totalImpressions : (activeMetrics?.impressions || 0)),
              "impressions", platformBreakdown, "#06B6D4",
              (v) => formatNumber(v),
            ))}
          />
          <KpiCard
            title="Clicks"
            value={formatNumber(activeTab === "all" ? totalClicks : (activeMetrics?.clicks || 0))}
            delta={deltaClicks}
            icon={<MousePointer size={14} />}
            tooltip="Total ad clicks"
            sparkline={sparklines.clicks}
            accentColor="#8B5CF6"
            onClick={() => setKpiDetail(buildDetail(
              "Clicks", <MousePointer size={18} />,
              formatNumber(activeTab === "all" ? totalClicks : (activeMetrics?.clicks || 0)),
              "clicks", platformBreakdown, "#8B5CF6",
              (v) => formatNumber(v),
            ))}
          />
          <KpiCard
            title="Blended CTR"
            value={`${(activeTab === "all" ? blendedCtr : (activeMetrics?.ctr || 0)).toFixed(2)}%`}
            delta={deltaCtr}
            icon={<Percent size={14} />}
            tooltip="Clicks / Impressions across all platforms"
            accentColor="#22C55E"
            onClick={() => setKpiDetail(buildDetail(
              "Blended CTR", <Percent size={18} />,
              `${(activeTab === "all" ? blendedCtr : (activeMetrics?.ctr || 0)).toFixed(2)}%`,
              "clicks", platformBreakdown, "#22C55E",
              (v) => `${v.toFixed(2)}%`,
            ))}
          />
        </div>

        {/* ── Budget Pacing + Platform Split ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5">
          {/* Season Budget Pacing */}
          <div className="bg-[#12121A] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Season Budget Pacing</h2>
              <span className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-bold",
                seasonPacing.status === "on_track" && "bg-[#22C55E]/10 text-[#22C55E]",
                seasonPacing.status === "over_pacing" && "bg-[#EF4444]/10 text-[#EF4444]",
                seasonPacing.status === "under_pacing" && "bg-amber-500/10 text-amber-400",
              )}>
                {seasonPacing.status === "on_track" ? "On Track" : seasonPacing.status === "over_pacing" ? "Over-pacing" : "Under-pacing"}
              </span>
            </div>

            {/* Per-brand pacing bars */}
            <div className="space-y-4">
              {IRG_BRAND_ORDER.map((id) => {
                const brand = IRG_BRANDS[id];
                const metrics = brandMetrics[id];
                const pct = brand.budget > 0 ? Math.min((metrics.spend / brand.budget) * 100, 100) : 0;
                return (
                  <div key={id} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: brand.color }} />
                        <span className="text-xs font-medium text-white">{brand.shortLabel}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-[#64748B]">{pct.toFixed(0)}%</span>
                        <span className="text-xs font-bold text-white">{formatCurrency(metrics.spend, "EUR")}</span>
                        <span className="text-[11px] text-[#64748B]">/ {formatCurrency(brand.budget, "EUR")}</span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: brand.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Season summary */}
            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-white/[0.06]">
              <div className="text-center p-2.5 rounded-xl bg-white/[0.03]">
                <p className="text-[10px] text-[#64748B] uppercase mb-1">Day {seasonPacing.elapsed}</p>
                <p className="text-xs font-bold text-white">of {seasonPacing.totalDays}</p>
              </div>
              <div className="text-center p-2.5 rounded-xl bg-white/[0.03]">
                <p className="text-[10px] text-[#64748B] uppercase mb-1">Daily Rate</p>
                <p className="text-xs font-bold text-white">{formatCurrency(seasonPacing.dailyRate, "EUR")}/day</p>
              </div>
              <div className="text-center p-2.5 rounded-xl bg-white/[0.03]">
                <p className="text-[10px] text-[#64748B] uppercase mb-1">Projected</p>
                <p className="text-xs font-bold text-white">{formatCurrency(seasonPacing.projectedTotal, "EUR")}</p>
              </div>
            </div>

            <p className="text-[10px] text-[#64748B] italic">
              Note: May–August is the heavy spend period. Linear pacing may under-flag under-spend in early months.
            </p>
          </div>

          {/* Platform Split */}
          <div className="bg-[#12121A] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-5">
            <h2 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Platform Split</h2>

            <div className="space-y-3">
              {(() => {
                const mSpend = activeTab === "all" ? totalMetaSpend : (activeMetrics?.metaSpend || 0);
                const gSpend = activeTab === "all" ? totalGoogleSpend : (activeMetrics?.googleSpend || 0);
                const mRev = activeTab === "all" ? totalMetaRevenue : (activeMetrics?.metaRevenue || 0);
                const gRev = activeTab === "all" ? totalGoogleRevenue : (activeMetrics?.googleRevenue || 0);
                const mConv = activeTab === "all" ? totalMetaConversions : (activeMetrics?.metaConversions || 0);
                const gConv = activeTab === "all" ? totalGoogleConversions : (activeMetrics?.googleConversions || 0);
                const rows = [
                  { icon: <MetaIcon size={20} />, name: "Meta Ads", spend: mSpend, rev: mRev, conv: mConv, pct: activeSpend > 0 ? (mSpend / activeSpend * 100).toFixed(0) : "0" },
                  { icon: <GoogleIcon size={20} />, name: "Google Ads", spend: gSpend, rev: gRev, conv: gConv, pct: activeSpend > 0 ? (gSpend / activeSpend * 100).toFixed(0) : "0" },
                ];
                return rows.map((r) => (
                  <div key={r.name} className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                    <div className="flex items-center gap-2.5 mb-3">
                      {r.icon}
                      <span className="text-sm font-semibold text-white">{r.name}</span>
                      <span className="text-[10px] text-[#64748B] ml-auto">{r.pct}% of spend</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <p className="text-[9px] text-[#64748B] uppercase tracking-wider mb-0.5">Spend</p>
                        <p className="text-sm font-bold text-white">{formatCurrency(r.spend, "EUR")}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-[#64748B] uppercase tracking-wider mb-0.5">Conv. Value</p>
                        <p className="text-sm font-bold text-white">{formatCurrency(r.rev, "EUR")}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-[#64748B] uppercase tracking-wider mb-0.5">ROAS</p>
                        <p className="text-sm font-bold text-white">{r.spend > 0 ? formatROAS(r.rev / r.spend) : "—"}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-[#64748B] uppercase tracking-wider mb-0.5">Conv</p>
                        <p className="text-sm font-bold text-white">{formatNumber(r.conv)}</p>
                      </div>
                    </div>
                  </div>
                ));
              })()}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.02] border border-dashed border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="w-[22px] h-[22px] rounded-md bg-white/[0.06] flex items-center justify-center">
                    <Info size={12} className="text-[#64748B]" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-[#64748B]">TikTok Ads</span>
                    <p className="text-[11px] text-[#475569]">Pending connection</p>
                  </div>
                </div>
                <span className="text-xs font-medium text-[#475569]">Coming soon</span>
              </div>
            </div>

            {/* Brand spend breakdown (only on All tab) */}
            {activeTab === "all" && brandPieData.length > 0 && (
              <div className="pt-3 border-t border-white/[0.06]">
                <p className="text-[10px] text-[#64748B] uppercase tracking-wider font-medium mb-3">Brand Split</p>
                <div className="space-y-2">
                  {IRG_BRAND_ORDER.map((id) => {
                    const brand = IRG_BRANDS[id];
                    const metrics = brandMetrics[id];
                    const pct = totalSpend > 0 ? (metrics.spend / totalSpend) * 100 : 0;
                    return (
                      <div key={id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: brand.color }} />
                          <span className="text-[11px] text-[#94A3B8]">{brand.shortLabel}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-[#64748B]">{pct.toFixed(0)}%</span>
                          <span className="text-xs font-semibold text-white">{formatCurrency(metrics.spend, "EUR")}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Daily Spend Chart ── */}
        {dailyData.length > 0 && (
          <div className="bg-[#12121A] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Daily Spend</h2>
              <span className="flex items-center gap-1.5 text-[11px] text-[#94A3B8]">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#FF6A41]" /> Spend
              </span>
            </div>
            <div className="h-[200px] sm:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData} barSize={dailyData.length > 20 ? undefined : 14}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#64748B", fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "#64748B", fontSize: 10 }} tickLine={false} axisLine={false} width={50} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1A1A2E", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: 12, padding: "10px 14px" }}
                    labelStyle={{ color: "#94A3B8", marginBottom: 4 }}
                    formatter={(val) => [formatCurrency(Number(val), "EUR")]}
                    cursor={{ fill: "rgba(255,255,255,0.02)" }}
                  />
                  <Bar dataKey="spend" fill="#FF6A41" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Campaign Table ── */}
        <div className="bg-[#12121A] border border-white/[0.06] rounded-xl sm:rounded-2xl overflow-hidden">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
              Campaigns {activeTab !== "all" && `— ${activeBrand?.label}`}
            </h2>
            <span className="text-[11px] text-[#64748B]">{campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left min-w-[800px]">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  {["Campaign", "Brand", "Platform", "Status", "Spend", "Impr", "Clicks", "CTR", "CPC", "Conv", "CPA"].map((h) => (
                    <th key={h} className="px-4 py-3 text-[10px] text-[#64748B] uppercase tracking-wider font-semibold whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c, i) => (
                  <tr key={`${c.name}-${i}`} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 max-w-[220px]">
                      <p className="text-xs font-medium text-white truncate">{c.name}</p>
                      {c.isPreexisting && (
                        <span className="text-[9px] text-amber-400/70">IRG-managed</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: IRG_BRANDS[c.brand]?.color || "#94A3B8" }} />
                        <span className="text-[11px] text-[#94A3B8]">{IRG_BRANDS[c.brand]?.shortLabel || "?"}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase",
                        c.platform === "Meta" ? "bg-blue-500/20 text-blue-400" : "bg-emerald-500/20 text-emerald-400",
                      )}>
                        {c.platform}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "flex items-center gap-1 text-[11px] font-medium",
                        c.status === "Live" && "text-[#22C55E]",
                        c.status === "Paused" && "text-amber-400",
                        c.status === "Draft" && "text-[#64748B]",
                      )}>
                        {c.status === "Live" && <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />}
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-white">{formatCurrency(c.spend, "EUR")}</td>
                    <td className="px-4 py-3 text-xs text-[#94A3B8]">{formatNumber(c.impressions)}</td>
                    <td className="px-4 py-3 text-xs text-[#94A3B8]">{formatNumber(c.clicks)}</td>
                    <td className="px-4 py-3 text-xs text-[#94A3B8]">{c.ctr.toFixed(2)}%</td>
                    <td className="px-4 py-3 text-xs text-[#94A3B8]">{c.clicks > 0 ? formatCurrency(c.cpc, "EUR") : "—"}</td>
                    <td className="px-4 py-3 text-xs text-[#94A3B8]">{c.conversions > 0 ? formatNumber(c.conversions) : "—"}</td>
                    <td className="px-4 py-3 text-xs text-[#94A3B8]">{c.conversions > 0 ? formatCurrency(c.cpa, "EUR") : "—"}</td>
                  </tr>
                ))}
                {campaigns.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-sm text-[#64748B]">
                      No campaign data available for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden p-3 space-y-2">
            {campaigns.length === 0 ? (
              <div className="p-6 text-center text-sm text-[#64748B]">
                No campaign data available for this period.
              </div>
            ) : (
              campaigns.map((c, i) => (
                <div
                  key={`${c.name}-${i}`}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white truncate">{c.name}</p>
                      {c.isPreexisting && (
                        <span className="text-[9px] text-amber-400/70">IRG-managed</span>
                      )}
                    </div>
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase flex-shrink-0",
                      c.platform === "Meta" ? "bg-blue-500/20 text-blue-400" : "bg-emerald-500/20 text-emerald-400",
                    )}>
                      {c.platform}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="flex items-center gap-1 text-[#94A3B8]">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: IRG_BRANDS[c.brand]?.color || "#94A3B8" }} />
                      {IRG_BRANDS[c.brand]?.shortLabel || "?"}
                    </span>
                    <span className={cn(
                      "flex items-center gap-1 font-medium",
                      c.status === "Live" && "text-[#22C55E]",
                      c.status === "Paused" && "text-amber-400",
                      c.status === "Draft" && "text-[#64748B]",
                    )}>
                      {c.status === "Live" && <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />}
                      {c.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.04]">
                    <MetricCell label="Spend" value={formatCurrency(c.spend, "EUR")} emphasis />
                    <MetricCell label="Impr" value={formatNumber(c.impressions)} />
                    <MetricCell label="Clicks" value={formatNumber(c.clicks)} />
                    <MetricCell label="CTR" value={`${c.ctr.toFixed(2)}%`} />
                    <MetricCell label="CPC" value={c.clicks > 0 ? formatCurrency(c.cpc, "EUR") : "—"} />
                    <MetricCell label="Conv" value={c.conversions > 0 ? formatNumber(c.conversions) : "—"} emphasis />
                    <MetricCell label="CPA" value={c.conversions > 0 ? formatCurrency(c.cpa, "EUR") : "—"} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Connection Status ── */}
        <div className="bg-[#12121A] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4">
          <h2 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Windsor AI Connections</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {[
              { label: "Meta — IRG | 528 Ibiza", id: "699834239363956", status: "connected" as const },
              { label: "Meta — IRG | Ibiza Rocks", id: "511748048632829", status: "connected_empty" as const },
              { label: "Google — Rocks - Ibiza", id: "278-470-9624", status: "connected" as const },
              { label: "Google — 528 Ibiza", id: "534-641-8417", status: "connected" as const },
              { label: "TikTok Ads", id: "—", status: "not_connected" as const },
              { label: "GA4", id: "—", status: "not_connected" as const },
            ].map((conn) => (
              <div key={conn.label} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                <div>
                  <p className="text-xs font-medium text-white">{conn.label}</p>
                  <p className="text-[10px] text-[#64748B] font-mono">{conn.id}</p>
                </div>
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[9px] font-semibold",
                  conn.status === "connected" && "bg-[#22C55E]/10 text-[#22C55E]",
                  conn.status === "connected_empty" && "bg-amber-500/10 text-amber-400",
                  conn.status === "not_connected" && "bg-white/[0.05] text-[#64748B]",
                )}>
                  {conn.status === "connected" ? "Connected" : conn.status === "connected_empty" ? "No Data" : "Not Connected"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <SuggestionWidget />
        </DataBlur>
      </div>

      <KpiDetailModal data={kpiDetail} onClose={closeKpiDetail} />
    </>
  );
}
