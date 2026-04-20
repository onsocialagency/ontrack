"use client";

import { useMemo, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { SuggestionWidget } from "@/components/suggestions/SuggestionWidget";
import { KpiCard } from "@/components/ui/kpi-card";
import { KpiDetailModal, type KpiDetailData } from "@/components/ui/kpi-detail-modal";
import { DataBlur } from "@/components/ui/data-blur";
import { useClient } from "@/lib/client-context";
import { useWindsor } from "@/lib/use-windsor";
import { useDateRange } from "@/lib/date-range-context";
import type { WindsorRow } from "@/lib/windsor";
import { classifyPlatform, sumConversions, rowConversions } from "@/lib/windsor";
import { formatCurrency, formatNumber, cn } from "@/lib/utils";
import { useLocale } from "@/lib/locale-context";
import { MetaIcon, GoogleIcon } from "@/components/ui/platform-icons";
import {
  LEAD_TYPES,
  MINISTRY_BRAND,
  getCplStatus,
  CPL_STATUS_COLORS,
  filterValidConversions,
  aggregateByLeadType,
  type LeadTypeBreakdown,
} from "@/lib/ministry-config";
import {
  DollarSign,
  Users,
  TrendingDown,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

/* ── Constants ── */

const ACCENT = MINISTRY_BRAND.accentColor; // #C8A96E

/* ── Lead type display order ── */

const LEAD_TYPE_ORDER = [
  "club",
  "meeting_room",
  "private_office",
  "hot_desk",
  "dedicated_desk",
  "general",
];

/* ── Mock data generator ── */

function generateMockData(days: number) {
  const now = new Date();
  const totalSpend = 4200;
  const totalConversions = 180;
  const metaRatio = 0.6;

  const dailySpend = totalSpend / days;
  const dailyConversions = totalConversions / days;

  const daily: { date: string; spend: number; conversions: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const jitter = 0.7 + Math.random() * 0.6;
    daily.push({
      date: dateStr,
      spend: +(dailySpend * jitter).toFixed(2),
      conversions: Math.round(dailyConversions * (0.6 + Math.random() * 0.8)),
    });
  }

  const metaSpend = +(totalSpend * metaRatio).toFixed(2);
  const googleSpend = +(totalSpend * (1 - metaRatio)).toFixed(2);
  const metaConversions = Math.round(totalConversions * metaRatio);
  const googleConversions = totalConversions - metaConversions;

  // Mock lead type breakdown matching volume ranges from config
  const mockLeadTypes: Record<string, { conversions: number; spend: number }> = {
    club: { conversions: 55, spend: 550 },
    meeting_room: { conversions: 48, spend: 480 },
    private_office: { conversions: 30, spend: 1500 },
    hot_desk: { conversions: 22, spend: 396 },
    dedicated_desk: { conversions: 12, spend: 300 },
    general: { conversions: 13, spend: 974 },
  };
  const leadTypeBreakdown: Record<string, LeadTypeBreakdown> = {};
  for (const [id, data] of Object.entries(mockLeadTypes)) {
    leadTypeBreakdown[id] = {
      conversions: data.conversions,
      spend: data.spend,
      cpl: data.conversions > 0 ? +(data.spend / data.conversions).toFixed(2) : 0,
      campaigns: [],
    };
  }

  return {
    totalSpend,
    totalConversions,
    metaSpend,
    googleSpend,
    metaConversions,
    googleConversions,
    blendedCpl: +(totalSpend / totalConversions).toFixed(2),
    daily,
    leadTypeBreakdown,
  };
}

function generatePrevMockData() {
  return {
    totalSpend: 3900,
    totalConversions: 165,
    metaSpend: 2340,
    googleSpend: 1560,
  };
}

/* ── Windsor aggregation ── */

function aggregateWindsor(rows: WindsorRow[]) {
  const filtered = filterValidConversions(rows as Record<string, unknown>[]) as unknown as WindsorRow[];

  let metaSpend = 0, googleSpend = 0;
  for (const r of filtered) {
    const spend = Number(r.spend) || 0;
    const platform = classifyPlatform(r.source);
    if (platform === "meta") metaSpend += spend;
    else if (platform === "google") googleSpend += spend;
  }

  // Shared conversion summation. Applies the primary→all_conversions fallback
  // at the TOTAL level (never per-row) so Ministry's GTM-imported lead-form
  // setup still surfaces numbers when primary is 0 for the whole range.
  const convSummary = sumConversions(filtered);
  const metaConversions = convSummary.meta;
  const googleConversions = convSummary.google;

  const totalSpend = metaSpend + googleSpend;
  const totalConversions = metaConversions + googleConversions;
  const blendedCpl = totalConversions > 0 ? +(totalSpend / totalConversions).toFixed(2) : 0;

  // Daily aggregation mirrors the total-level fallback so the sparkline stays
  // consistent with KPI totals (see rowConversions).
  const useAllConvFallback = convSummary.usedGoogleAllFallback;
  const byDate: Record<string, { date: string; spend: number; conversions: number }> = {};
  for (const r of filtered) {
    if (!r.date) continue;
    if (!byDate[r.date]) byDate[r.date] = { date: r.date, spend: 0, conversions: 0 };
    byDate[r.date].spend += Number(r.spend) || 0;
    byDate[r.date].conversions += rowConversions(r, useAllConvFallback).conversions;
  }
  const daily = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));

  // Lead type breakdown via campaign name pattern matching
  const leadTypeBreakdown = aggregateByLeadType(filtered);

  return {
    totalSpend,
    totalConversions,
    metaSpend,
    googleSpend,
    metaConversions,
    googleConversions,
    blendedCpl,
    daily,
    leadTypeBreakdown,
  };
}

/* ── Helpers ── */

function pctChange(curr: number, prev: number): number {
  if (prev === 0) return 0;
  return +((curr - prev) / prev * 100).toFixed(1);
}

/* ── Component ── */

export default function MinistryOverview() {
  const { client: clientSlug } = useParams<{ client: string }>();
  const { days, preset, dateFrom, dateTo, compareEnabled, prevDateFrom, prevDateTo } = useDateRange();
  const { shortDate: fmtDate } = useLocale();
  const ctx = useClient();
  const client = ctx?.clientConfig;

  // Budget + allocation targets read from client config (fallback to sensible defaults)
  const MONTHLY_BUDGET = client?.monthlyBudget ?? 5000;
  const META_TARGET_PCT = Math.round((client?.metaAllocation ?? 0.6) * 100);
  const GOOGLE_TARGET_PCT = Math.round((client?.googleAllocation ?? 0.4) * 100);

  // Current period Windsor data
  const { data: windsorData, source: dataSource, loading: windsorLoading } = useWindsor<WindsorRow[]>({
    clientSlug,
    type: "campaigns",
    days,
    ...(preset === "Custom" ? { dateFrom, dateTo } : {}),
  });

  // Previous period Windsor data
  const { data: prevWindsorData } = useWindsor<WindsorRow[]>({
    clientSlug,
    type: "campaigns",
    days,
    dateFrom: prevDateFrom,
    dateTo: prevDateTo,
  });

  const isLive = dataSource === "windsor" && windsorData && windsorData.length > 0;

  // Aggregate current period
  const current = useMemo(() => {
    if (isLive) return aggregateWindsor(windsorData);
    return generateMockData(days);
  }, [isLive, windsorData, days]);

  // Aggregate previous period
  const prev = useMemo(() => {
    if (compareEnabled && prevWindsorData && prevWindsorData.length > 0) {
      return aggregateWindsor(prevWindsorData);
    }
    if (compareEnabled && !isLive) return generatePrevMockData();
    return null;
  }, [compareEnabled, prevWindsorData, isLive]);

  // Deltas
  const deltas = useMemo(() => {
    if (!prev) return { spend: 0, conversions: 0, cpl: 0, meta: 0, google: 0 };
    const prevCpl = prev.totalConversions > 0 ? prev.totalSpend / prev.totalConversions : 0;
    return {
      spend: pctChange(current.totalSpend, prev.totalSpend),
      conversions: pctChange(current.totalConversions, prev.totalConversions),
      cpl: pctChange(current.blendedCpl, prevCpl),
      meta: pctChange(current.metaSpend, prev.metaSpend),
      google: pctChange(current.googleSpend, prev.googleSpend),
    };
  }, [current, prev]);

  // Chart data (last 30 days)
  const chartData = useMemo(() => {
    return current.daily.map((d) => ({
      ...d,
      date: fmtDate(d.date),
    }));
  }, [current.daily, fmtDate]);

  // Sparklines
  const sparklines = useMemo(() => ({
    spend: chartData.map((d) => ({ v: d.spend, label: d.date })),
    conversions: chartData.map((d) => ({ v: d.conversions, label: d.date })),
    metaSpend: chartData.map((d) => ({ v: d.spend * 0.6, label: d.date })),
    googleSpend: chartData.map((d) => ({ v: d.spend * 0.4, label: d.date })),
  }), [chartData]);

  // Budget pacing
  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - dayOfMonth;
  const dailyAvgSpend = dayOfMonth > 0 ? current.totalSpend / dayOfMonth : 0;
  const projectedEOM = dailyAvgSpend * daysInMonth;
  const pacingPct = MONTHLY_BUDGET > 0 ? Math.min((current.totalSpend / MONTHLY_BUDGET) * 100, 100) : 0;
  const projectedOnTrack = projectedEOM >= MONTHLY_BUDGET;

  // Platform split
  const totalPlatformSpend = current.metaSpend + current.googleSpend;
  const metaPct = totalPlatformSpend > 0 ? (current.metaSpend / totalPlatformSpend) * 100 : 50;
  const googlePct = totalPlatformSpend > 0 ? (current.googleSpend / totalPlatformSpend) * 100 : 50;
  const metaOffTarget = Math.abs(metaPct - META_TARGET_PCT) > 5;
  const googleOffTarget = Math.abs(googlePct - GOOGLE_TARGET_PCT) > 5;
  const splitOffTarget = metaOffTarget || googleOffTarget;

  // Lead type data
  // Lead type breakdown is always available (derived from campaign names)
  const leadTypeBreakdown = current.leadTypeBreakdown;

  // Ordered lead types
  const orderedLeadTypes = LEAD_TYPE_ORDER.map(
    (id) => LEAD_TYPES.find((lt) => lt.id === id)!
  ).filter(Boolean);

  // KPI detail modal
  const [kpiDetail, setKpiDetail] = useState<KpiDetailData | null>(null);
  const closeKpiDetail = useCallback(() => setKpiDetail(null), []);

  const currentLabel = chartData.length > 0
    ? `${chartData[0].date} - ${chartData[chartData.length - 1].date}`
    : "Current period";

  const platformBreakdown = [
    { name: "Meta Ads", value: current.metaSpend, formatted: formatCurrency(current.metaSpend, "GBP"), color: "#3B82F6" },
    { name: "Google Ads", value: current.googleSpend, formatted: formatCurrency(current.googleSpend, "GBP"), color: "#22C55E" },
  ];

  const buildDetail = (
    title: string,
    icon: React.ReactNode,
    currentValue: string,
    dailyKey: "spend" | "conversions",
    breakdown: { name: string; value: number; formatted: string; color: string }[],
    accentColor: string,
    fmtFn?: (v: number) => string,
  ): KpiDetailData => ({
    title,
    icon,
    currentValue,
    currentLabel,
    dailyData: chartData.map((d) => ({ date: d.date, current: d[dailyKey] })),
    breakdown,
    accentColor,
    formatValue: fmtFn,
  });

  if (!client) return null;

  return (
    <>
      <Header title="The Ministry" showDateRange dataBadge={{ loading: windsorLoading, isLive: !!isLive }} />

      <div className="flex-1 p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-5 overflow-y-auto">

        <DataBlur isBlurred={dataSource !== "windsor" && !windsorLoading} isLoading={windsorLoading} className="space-y-4 sm:space-y-5">
        {/* ── SECTION 1: KPI Strip ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <KpiCard
            title="Total Spend"
            value={formatCurrency(current.totalSpend, "GBP")}
            delta={deltas.spend}
            icon={<DollarSign size={12} />}
            tooltip="Combined Meta + Google spend for the selected period"
            sparkline={sparklines.spend}
            accentColor={ACCENT}
            onClick={() => setKpiDetail(buildDetail(
              "Total Spend", <DollarSign size={18} />,
              formatCurrency(current.totalSpend, "GBP"),
              "spend", platformBreakdown, ACCENT,
              (v) => formatCurrency(v, "GBP"),
            ))}
          />
          <KpiCard
            title="Conversions"
            value={formatNumber(current.totalConversions)}
            delta={deltas.conversions}
            icon={<Users size={12} />}
            tooltip="EnquiryForm + DayPass events only — platform reported"
            sparkline={sparklines.conversions}
            accentColor={ACCENT}
            onClick={() => setKpiDetail(buildDetail(
              "Conversions", <Users size={18} />,
              formatNumber(current.totalConversions),
              "conversions",
              [
                { name: "Meta Ads", value: current.metaConversions, formatted: formatNumber(current.metaConversions), color: "#3B82F6" },
                { name: "Google Ads", value: current.googleConversions, formatted: formatNumber(current.googleConversions), color: "#22C55E" },
              ],
              ACCENT,
              (v) => formatNumber(v),
            ))}
          />
          <KpiCard
            title="Blended CPL"
            value={formatCurrency(current.blendedCpl, "GBP")}
            delta={deltas.cpl}
            invertDelta
            icon={<TrendingDown size={12} />}
            tooltip="Total spend / total conversions — platform reported"
            sparkline={sparklines.spend}
            accentColor={ACCENT}
            onClick={() => setKpiDetail(buildDetail(
              "Blended CPL", <TrendingDown size={18} />,
              formatCurrency(current.blendedCpl, "GBP"),
              "spend", platformBreakdown, ACCENT,
              (v) => formatCurrency(v, "GBP"),
            ))}
          />
          <KpiCard
            title="Meta Spend"
            value={formatCurrency(current.metaSpend, "GBP")}
            delta={deltas.meta}
            icon={<MetaIcon size={12} />}
            tooltip="Facebook / Instagram ad spend"
            sparkline={sparklines.metaSpend}
            accentColor={ACCENT}
            onClick={() => setKpiDetail(buildDetail(
              "Meta Spend", <MetaIcon size={18} />,
              formatCurrency(current.metaSpend, "GBP"),
              "spend", platformBreakdown, ACCENT,
              (v) => formatCurrency(v, "GBP"),
            ))}
          />
          <KpiCard
            title="Google Spend"
            value={formatCurrency(current.googleSpend, "GBP")}
            delta={deltas.google}
            icon={<GoogleIcon size={12} />}
            tooltip="Google Ads spend"
            sparkline={sparklines.googleSpend}
            accentColor={ACCENT}
            onClick={() => setKpiDetail(buildDetail(
              "Google Spend", <GoogleIcon size={18} />,
              formatCurrency(current.googleSpend, "GBP"),
              "spend", platformBreakdown, ACCENT,
              (v) => formatCurrency(v, "GBP"),
            ))}
          />
        </div>

        {/* Source labels beneath KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 -mt-1">
          <div />
          <p className="text-[9px] text-[#94A3B8]/60 pl-4">Platform reported</p>
          <p className="text-[9px] text-[#94A3B8]/60 pl-4">Platform reported</p>
          <div />
          <div />
        </div>

        {/* ── SECTION 2: Budget Pacing + Platform Split ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5">
          {/* Budget Pacing */}
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                Budget Pacing
              </h2>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider",
                  projectedOnTrack
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-amber-500/20 text-amber-400"
                )}
              >
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    projectedOnTrack ? "bg-emerald-400" : "bg-amber-400"
                  )}
                />
                {projectedOnTrack ? "On Track" : "Behind"}
              </span>
            </div>

            {/* Pacing bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#94A3B8] font-medium">
                  {formatCurrency(current.totalSpend, "GBP")} of {formatCurrency(MONTHLY_BUDGET, "GBP")}
                </span>
                <span className="font-semibold" style={{ color: ACCENT }}>
                  {pacingPct.toFixed(0)}%
                </span>
              </div>
              <div className="relative h-3 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${pacingPct}%`, backgroundColor: ACCENT }}
                />
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
              <div>
                <p className="text-[9px] text-[#94A3B8] uppercase tracking-wider">Current Spend</p>
                <p className="text-sm font-semibold">{formatCurrency(current.totalSpend, "GBP")}</p>
              </div>
              <div>
                <p className="text-[9px] text-[#94A3B8] uppercase tracking-wider">Projected EOM</p>
                <p className="text-sm font-semibold">{formatCurrency(projectedEOM, "GBP")}</p>
              </div>
              <div>
                <p className="text-[9px] text-[#94A3B8] uppercase tracking-wider">Daily Avg</p>
                <p className="text-sm font-semibold">{formatCurrency(dailyAvgSpend, "GBP")}</p>
              </div>
              <div>
                <p className="text-[9px] text-[#94A3B8] uppercase tracking-wider">Days Remaining</p>
                <p className="text-sm font-semibold">{daysRemaining}</p>
              </div>
            </div>
          </div>

          {/* Platform Split */}
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                Platform Split
              </h2>
              {splitOffTarget && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider bg-amber-500/20 text-amber-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Off Target
                </span>
              )}
            </div>

            {/* Meta bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MetaIcon size={16} />
                  <span className="text-sm font-medium text-white">Meta</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#94A3B8]">{metaPct.toFixed(0)}% actual</span>
                  <span className="text-xs font-semibold">{formatCurrency(current.metaSpend, "GBP")}</span>
                </div>
              </div>
              <div className="relative h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${metaPct}%` }}
                />
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white/40"
                  style={{ left: `${META_TARGET_PCT}%` }}
                  title={`Target: ${META_TARGET_PCT}%`}
                />
              </div>
              <div className="flex items-center gap-4 mt-1">
                <p className="text-[9px] text-[#94A3B8]/60">Target: {META_TARGET_PCT}%</p>
                <p className="text-[9px] text-[#94A3B8]/60">Conv: {formatNumber(current.metaConversions)}</p>
                <p className="text-[9px] text-[#94A3B8]/60">CPL: {current.metaConversions > 0 ? formatCurrency(current.metaSpend / current.metaConversions, "GBP") : "—"}</p>
              </div>
            </div>

            {/* Google bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GoogleIcon size={16} />
                  <span className="text-sm font-medium text-white">Google</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#94A3B8]">{googlePct.toFixed(0)}% actual</span>
                  <span className="text-xs font-semibold">{formatCurrency(current.googleSpend, "GBP")}</span>
                </div>
              </div>
              <div className="relative h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${googlePct}%` }}
                />
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white/40"
                  style={{ left: `${GOOGLE_TARGET_PCT}%` }}
                  title={`Target: ${GOOGLE_TARGET_PCT}%`}
                />
              </div>
              <div className="flex items-center gap-4 mt-1">
                <p className="text-[9px] text-[#94A3B8]/60">Target: {GOOGLE_TARGET_PCT}%</p>
                <p className="text-[9px] text-[#94A3B8]/60">Conv: {formatNumber(current.googleConversions)}</p>
                <p className="text-[9px] text-[#94A3B8]/60">CPL: {current.googleConversions > 0 ? formatCurrency(current.googleSpend / current.googleConversions, "GBP") : "—"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── SECTION 3: Lead Type CPL Grid ── */}
        <div>
          <h2 className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">
            Lead Type Performance
          </h2>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {orderedLeadTypes.map((lt) => {
              const bd = leadTypeBreakdown[lt.id];
              const convCount = bd?.conversions ?? 0;
              const cpl = bd?.cpl ?? 0;
              const status = getCplStatus(cpl, lt);
              const statusColors = CPL_STATUS_COLORS[status];

              return (
                <div
                  key={lt.id}
                  className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white">{lt.label}</h3>
                    {convCount > 0 ? (
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider",
                          statusColors.bg,
                          statusColors.text
                        )}
                      >
                        {statusColors.label}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider bg-zinc-500/20 text-zinc-400">
                        No Data
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div>
                      <span className="text-xl font-bold">{formatNumber(convCount)}</span>
                      <p className="text-[9px] text-[#94A3B8]/60">Platform reported conversions</p>
                    </div>
                    {convCount > 0 && (
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-semibold" style={{ color: ACCENT }}>
                          CPL: {formatCurrency(cpl, "GBP")}
                        </span>
                      </div>
                    )}
                    {lt.targetCplMin !== null && lt.targetCplMax !== null && (
                      <p className="text-[10px] text-[#94A3B8]">
                        Target: {formatCurrency(lt.targetCplMin, "GBP")}–{formatCurrency(lt.targetCplMax, "GBP")}
                      </p>
                    )}
                    {bd?.campaigns && bd.campaigns.length > 0 && (
                      <p className="text-[9px] text-[#94A3B8]/40 truncate" title={bd.campaigns.join(", ")}>
                        {bd.campaigns.length} campaign{bd.campaigns.length > 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── SECTION 4: Daily Trend Chart ── */}
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-2">
          <h2 className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
            Daily Trend — Spend & Conversions
          </h2>
          <div className="h-[200px] sm:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="ministrySpendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ACCENT} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ministryConvGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#94A3B8", fontSize: 9 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fill: "#94A3B8", fontSize: 9 }}
                  tickLine={false}
                  axisLine={false}
                  width={50}
                  tickFormatter={(v) => `£${v}`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: "#94A3B8", fontSize: 9 }}
                  tickLine={false}
                  axisLine={false}
                  width={35}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#12121A",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    fontSize: 11,
                  }}
                  labelStyle={{ color: "#94A3B8" }}
                  formatter={(val: unknown, name: unknown) => [
                    name === "spend"
                      ? formatCurrency(Number(val ?? 0), "GBP")
                      : formatNumber(Number(val ?? 0)),
                    name === "spend" ? "Spend" : "Conversions (platform reported)",
                  ]}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="spend"
                  stroke={ACCENT}
                  fill="url(#ministrySpendGrad)"
                  strokeWidth={2}
                  dot={false}
                  name="spend"
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="conversions"
                  stroke="#3B82F6"
                  fill="url(#ministryConvGrad)"
                  strokeWidth={2}
                  dot={false}
                  name="conversions"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 text-[10px] text-[#94A3B8]">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: ACCENT }} />
              Spend
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 rounded-full bg-blue-500" />
              Conversions (platform reported)
            </span>
          </div>
        </div>

        <SuggestionWidget />
        </DataBlur>
      </div>

      <KpiDetailModal data={kpiDetail} onClose={closeKpiDetail} />
    </>
  );
}
