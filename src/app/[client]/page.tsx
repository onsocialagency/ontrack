"use client";

import { useMemo, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import MinistryOverview from "./ministry-overview";
import IrgOverview from "./irg-overview";
import LaurastarOverview from "./laurastar-overview";
import { Header } from "@/components/layout/header";
import { SuggestionWidget } from "@/components/suggestions/SuggestionWidget";
import { KpiCard } from "@/components/ui/kpi-card";
import { PacingBar } from "@/components/ui/pacing-bar";
import { getClientKPIs, getClientDailyMetrics } from "@/lib/mock-data";
import { useClient } from "@/lib/client-context";
import { useWindsor } from "@/lib/use-windsor";
import { useDateRange } from "@/lib/date-range-context";
import type { WindsorRow } from "@/lib/windsor";
import { isMetaSource, isGoogleSource, sumConversions, rowConversions } from "@/lib/windsor";
import { DataBlur } from "@/components/ui/data-blur";
import { KpiDetailModal, type KpiDetailData } from "@/components/ui/kpi-detail-modal";
import {
  formatCurrency,
  formatNumber,
  formatROAS,
  getBillingPeriod,
} from "@/lib/utils";
import { useLocale } from "@/lib/locale-context";
import { MetaIcon, GoogleIcon } from "@/components/ui/platform-icons";
import {
  DollarSign,
  TrendingUp,
  Target,
  ShoppingCart,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

/* ── Windsor data aggregation ── */

function aggregateWindsorKPIs(rows: WindsorRow[]) {
  const spend = rows.reduce((s, r) => s + (Number(r.spend) || 0), 0);
  const impressions = rows.reduce((s, r) => s + (Number(r.impressions) || 0), 0);
  const clicks = rows.reduce((s, r) => s + (Number(r.clicks) || 0), 0);

  // Shared Meta + Google summation. Applies the primary→all_conversions
  // fallback at the TOTAL level only (never per-row) — see sumConversions in
  // lib/windsor.ts for the full rationale.
  const c = sumConversions(rows);
  const revenue = c.revenue;
  const conversions = c.total;
  const platformReportedRevenue = c.metaRevenue + c.googleRevenue;

  const roas = spend > 0 ? revenue / spend : 0;
  const cpa = conversions > 0 ? spend / conversions : 0;
  const mer = spend > 0 ? revenue / spend : 0;
  const cpl = conversions > 0 ? spend / conversions : 0;

  return {
    spend: +spend.toFixed(2),
    spendDelta: 0,
    roas: +roas.toFixed(2),
    roasDelta: 0,
    mer: +mer.toFixed(2),
    merDelta: 0,
    cpa: +cpa.toFixed(2),
    cpaDelta: 0,
    impressions: Math.round(impressions),
    impressionsDelta: 0,
    conversions: Math.round(conversions),
    conversionsDelta: 0,
    revenue: +revenue.toFixed(2),
    revenueDelta: 0,
    platformReportedRevenue: +platformReportedRevenue.toFixed(2),
    cpl: +cpl.toFixed(2),
    cplDelta: 0,
    clicks,
  };
}

function aggregateWindsorDaily(rows: WindsorRow[], fmtDate: (iso: string) => string) {
  const useAllConvFallback = sumConversions(rows).usedGoogleAllFallback;
  const byDate: Record<string, { date: string; spend: number; revenue: number; conversions: number; impressions: number }> = {};
  for (const r of rows) {
    const d = r.date;
    if (!d) continue;
    if (!byDate[d]) {
      byDate[d] = { date: d, spend: 0, revenue: 0, conversions: 0, impressions: 0 };
    }
    const rc = rowConversions(r, useAllConvFallback);
    byDate[d].spend += Number(r.spend) || 0;
    byDate[d].revenue += rc.revenue;
    byDate[d].conversions += rc.conversions;
    byDate[d].impressions += Number(r.impressions) || 0;
  }
  return Object.values(byDate)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      ...d,
      date: fmtDate(d.date),
      roas: d.spend > 0 ? +(d.revenue / d.spend).toFixed(2) : 0,
      cpa: d.conversions > 0 ? +(d.spend / d.conversions).toFixed(2) : 0,
    }));
}

/* ── Page ── */

export default function ClientOverviewPage() {
  const { client: clientSlug } = useParams<{ client: string }>();

  // Custom overview dashboards for specific clients
  if (clientSlug === "ministry") return <MinistryOverview />;
  if (clientSlug === "irg") return <IrgOverview />;
  if (clientSlug === "laurastar") return <LaurastarOverview />;

  return <DefaultClientOverview clientSlug={clientSlug} />;
}

function DefaultClientOverview({ clientSlug }: { clientSlug: string }) {
  const { days, preset, dateFrom, dateTo, compareEnabled, prevDateFrom, prevDateTo } = useDateRange();
  const { shortDate: fmtDate } = useLocale();
  const ctx = useClient();
  const client = ctx?.clientConfig;
  const mockKpis = getClientKPIs(clientSlug, client);
  const mockDailyMetrics = getClientDailyMetrics(clientSlug, 30, client);

  // Try Windsor live data — falls back to mock if no API key
  const { data: windsorData, source: dataSource, loading: windsorLoading } = useWindsor<WindsorRow[]>({
    clientSlug,
    type: "campaigns",
    days,
    ...(preset === "Custom" ? { dateFrom, dateTo } : {}),
  });

  // Previous period data — always pass explicit date range for previous period
  const { data: prevWindsorData } = useWindsor<WindsorRow[]>({
    clientSlug,
    type: "campaigns",
    days,
    dateFrom: prevDateFrom,
    dateTo: prevDateTo,
  });

  const isLive = dataSource === "windsor" && windsorData && windsorData.length > 0;

  // Use live data if available, otherwise mock
  const kpis = useMemo(() => {
    if (isLive) return aggregateWindsorKPIs(windsorData);
    return mockKpis;
  }, [isLive, windsorData, mockKpis]);

  // Previous period KPIs for delta calculation
  const prevKpis = useMemo(() => {
    if (!compareEnabled || !prevWindsorData || prevWindsorData.length === 0) return null;
    return aggregateWindsorKPIs(prevWindsorData);
  }, [compareEnabled, prevWindsorData]);

  // Calculate deltas (percentage change vs previous period)
  const deltas = useMemo(() => {
    if (!prevKpis) return { spend: 0, roas: 0, mer: 0, cpa: 0, impressions: 0, conversions: 0, revenue: 0 };
    const pctChange = (curr: number, prev: number) => prev > 0 ? ((curr - prev) / prev) * 100 : 0;
    return {
      spend: +pctChange(kpis.spend, prevKpis.spend).toFixed(1),
      roas: +pctChange(kpis.roas, prevKpis.roas).toFixed(1),
      mer: +pctChange(kpis.mer, prevKpis.mer).toFixed(1),
      cpa: +pctChange(kpis.cpa, prevKpis.cpa).toFixed(1),
      impressions: +pctChange(kpis.impressions, prevKpis.impressions).toFixed(1),
      conversions: +pctChange(kpis.conversions, prevKpis.conversions).toFixed(1),
      revenue: +pctChange(kpis.revenue, prevKpis.revenue).toFixed(1),
    };
  }, [kpis, prevKpis]);

  // Aggregate daily data for charts
  const chartData = useMemo(() => {
    if (isLive) return aggregateWindsorDaily(windsorData, fmtDate);

    const byDate: Record<string, { date: string; spend: number; revenue: number; conversions: number; impressions: number }> = {};
    for (const m of mockDailyMetrics) {
      if (!byDate[m.date]) {
        byDate[m.date] = { date: m.date, spend: 0, revenue: 0, conversions: 0, impressions: 0 };
      }
      byDate[m.date].spend += m.spend;
      byDate[m.date].revenue += m.revenue;
      byDate[m.date].conversions += m.conversions;
      byDate[m.date].impressions += m.impressions;
    }
    return Object.values(byDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        ...d,
        date: fmtDate(d.date),
        roas: d.spend > 0 ? +(d.revenue / d.spend).toFixed(2) : 0,
        cpa: d.conversions > 0 ? +(d.spend / d.conversions).toFixed(2) : 0,
      }));
  }, [isLive, windsorData, mockDailyMetrics, fmtDate]);

  // Sparkline data for each KPI (with date labels for hover tooltip)
  const sparklines = useMemo(() => {
    return {
      spend: chartData.map((d) => ({ v: d.spend, label: d.date })),
      revenue: chartData.map((d) => ({ v: d.revenue, label: d.date })),
      roas: chartData.map((d) => ({ v: d.roas, label: d.date })),
      cpa: chartData.map((d) => ({ v: d.cpa, label: d.date })),
      impressions: chartData.map((d) => ({ v: d.impressions, label: d.date })),
      conversions: chartData.map((d) => ({ v: d.conversions, label: d.date })),
    };
  }, [chartData]);

  // KPI detail modal state
  const [kpiDetail, setKpiDetail] = useState<KpiDetailData | null>(null);
  const closeKpiDetail = useCallback(() => setKpiDetail(null), []);

  // ── Billing-period pacing (independent of date range filter) ──
  const billingPeriod = useMemo(() => {
    return getBillingPeriod(client?.billingStartDay ?? 1);
  }, [client?.billingStartDay]);

  // Separate Windsor fetch for pacing — always fetches billing period dates
  const { data: pacingWindsorData, source: pacingSource } = useWindsor<WindsorRow[]>({
    clientSlug,
    type: "campaigns",
    dateFrom: billingPeriod.startISO,
    dateTo: billingPeriod.endISO,
  });

  const pacingSpend = useMemo(() => {
    if (pacingSource === "windsor" && pacingWindsorData && pacingWindsorData.length > 0) {
      return pacingWindsorData.reduce((s, r) => s + (Number(r.spend) || 0), 0);
    }
    // Fallback: estimate from mock data proportionally
    return kpis.spend * (billingPeriod.daysElapsed / days);
  }, [pacingSource, pacingWindsorData, kpis.spend, billingPeriod.daysElapsed, days]);

  if (!client) return null;

  const isLeadGen = client.type === "lead_gen";

  // Platform split
  const metaSpend = isLive
    ? windsorData.filter((r) => isMetaSource(r.source)).reduce((s, r) => s + (Number(r.spend) || 0), 0)
    : kpis.spend * client.metaAllocation;
  const googleSpend = isLive
    ? windsorData.filter((r) => isGoogleSource(r.source)).reduce((s, r) => s + (Number(r.spend) || 0), 0)
    : kpis.spend * client.googleAllocation;
  const totalPlatformSpend = metaSpend + googleSpend;
  const metaPct = totalPlatformSpend > 0 ? (metaSpend / totalPlatformSpend) * 100 : 50;
  const googlePct = totalPlatformSpend > 0 ? (googleSpend / totalPlatformSpend) * 100 : 50;

  // Date range label for the detail modal
  const currentLabel = chartData.length > 0
    ? `${chartData[0].date} - ${chartData[chartData.length - 1].date}`
    : `Last ${days} days`;

  // Platform breakdown for spend
  const spendBreakdown = [
    { name: "Meta Ads", value: metaSpend, formatted: formatCurrency(metaSpend, client.currency), color: "#3B82F6" },
    { name: "Google Ads", value: googleSpend, formatted: formatCurrency(googleSpend, client.currency), color: "#22C55E" },
  ];

  // Platform breakdowns. Uses shared sumConversions so revenue & conversions
  // breakdowns always reconcile to the KPI totals (and honour the Google
  // primary→all_conversions total-level fallback).
  const liveConv = isLive ? sumConversions(windsorData) : null;
  const metaRevenue = liveConv ? liveConv.metaRevenue : kpis.revenue * client.metaAllocation;
  const googleRevenue = liveConv ? liveConv.googleRevenue : kpis.revenue * client.googleAllocation;
  const metaConversions = liveConv ? liveConv.meta : Math.round(kpis.conversions * client.metaAllocation);
  const googleConversions = liveConv ? liveConv.google : Math.round(kpis.conversions * client.googleAllocation);

  // Helper to build KPI detail data
  const buildKpiDetail = (
    title: string,
    icon: React.ReactNode,
    currentValue: string,
    dailyKey: "spend" | "revenue" | "roas" | "cpa" | "impressions" | "conversions",
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

  // Previous period formatted values for inline comparison
  const prevFormatted = prevKpis ? {
    spend: formatCurrency(prevKpis.spend, client.currency),
    roas: formatROAS(prevKpis.roas),
    cpa: formatCurrency(prevKpis.cpa, client.currency),
    mer: formatROAS(prevKpis.mer),
    impressions: formatNumber(prevKpis.impressions),
    conversions: formatNumber(prevKpis.conversions),
    cpl: prevKpis.cpl !== undefined ? formatCurrency(prevKpis.cpl, client.currency) : undefined,
  } : null;

  return (
    <>
      <Header title={client.name} showAttribution dataBadge={{ loading: windsorLoading, isLive: !!isLive }} />

      <div className="flex-1 p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-5 overflow-y-auto">

        <DataBlur isBlurred={!isLive && !windsorLoading} isLoading={windsorLoading} className="space-y-4 sm:space-y-5">
        {/* ── KPI Grid ── */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <KpiCard
              title="Ad Spend"
              value={formatCurrency(kpis.spend, client.currency)}
              delta={deltas.spend}
              icon={<DollarSign size={14} />}
              tooltip="Total ad spend across all platforms in the selected period"
              sparkline={sparklines.spend}
              accentColor="#FF6A41"
              previousValue={prevFormatted?.spend}
              onClick={() => setKpiDetail(buildKpiDetail(
                "Ad Spend", <DollarSign size={18} />,
                formatCurrency(kpis.spend, client.currency),
                "spend", spendBreakdown, "#FF6A41",
                (v) => formatCurrency(v, client.currency),
              ))}
            />
            {isLeadGen ? (
              <KpiCard
                title="Cost Per Lead"
                value={
                  kpis.cpl !== undefined
                    ? formatCurrency(kpis.cpl, client.currency)
                    : "N/A"
                }
                delta={deltas.cpa}
                invertDelta
                icon={<Target size={14} />}
                tooltip="Cost Per Lead — total spend divided by leads generated"
                sparkline={sparklines.cpa}
                accentColor="#8B5CF6"
                previousValue={prevFormatted?.cpl}
                onClick={() => setKpiDetail(buildKpiDetail(
                  "CPL", <Target size={18} />,
                  formatCurrency(kpis.cpl ?? 0, client.currency),
                  "cpa", spendBreakdown, "#8B5CF6",
                  (v) => formatCurrency(v, client.currency),
                ))}
              />
            ) : (
              <KpiCard
                title="Return on Ad Spend"
                value={formatROAS(kpis.roas)}
                delta={deltas.roas}
                icon={<TrendingUp size={14} />}
                tooltip="Return on Ad Spend — revenue divided by ad spend"
                sparkline={sparklines.roas}
                accentColor="#22C55E"
                previousValue={prevFormatted?.roas}
                onClick={() => setKpiDetail(buildKpiDetail(
                  "ROAS", <TrendingUp size={18} />,
                  formatROAS(kpis.roas),
                  "roas",
                  [
                    { name: "Meta Ads", value: metaSpend > 0 ? metaRevenue / metaSpend : 0, formatted: formatROAS(metaSpend > 0 ? metaRevenue / metaSpend : 0), color: "#3B82F6" },
                    { name: "Google Ads", value: googleSpend > 0 ? googleRevenue / googleSpend : 0, formatted: formatROAS(googleSpend > 0 ? googleRevenue / googleSpend : 0), color: "#22C55E" },
                  ],
                  "#22C55E",
                  (v) => `${v.toFixed(2)}x`,
                ))}
              />
            )}
            <KpiCard
              title="Cost Per Acquisition"
              value={formatCurrency(kpis.cpa, client.currency)}
              delta={deltas.cpa}
              invertDelta
              icon={<Target size={14} />}
              tooltip="Cost Per Acquisition — spend divided by conversions"
              sparkline={sparklines.cpa}
              accentColor="#F59E0B"
              previousValue={prevFormatted?.cpa}
              onClick={() => setKpiDetail(buildKpiDetail(
                "CPA", <Target size={18} />,
                formatCurrency(kpis.cpa, client.currency),
                "cpa",
                [
                  { name: "Meta Ads", value: metaConversions > 0 ? metaSpend / metaConversions : 0, formatted: formatCurrency(metaConversions > 0 ? metaSpend / metaConversions : 0, client.currency), color: "#3B82F6" },
                  { name: "Google Ads", value: googleConversions > 0 ? googleSpend / googleConversions : 0, formatted: formatCurrency(googleConversions > 0 ? googleSpend / googleConversions : 0, client.currency), color: "#22C55E" },
                ],
                "#F59E0B",
                (v) => formatCurrency(v, client.currency),
              ))}
            />
            <KpiCard
              title="Conversion Value"
              value={formatCurrency(kpis.revenue, client.currency)}
              delta={deltas.revenue}
              icon={<DollarSign size={14} />}
              tooltip="Total revenue attributed to ad conversions"
              sparkline={sparklines.revenue}
              accentColor="#06B6D4"
              previousValue={prevFormatted ? formatCurrency(prevKpis!.revenue, client.currency) : undefined}
              onClick={() => setKpiDetail(buildKpiDetail(
                "Conversion Value", <DollarSign size={18} />,
                formatCurrency(kpis.revenue, client.currency),
                "revenue",
                [
                  { name: "Meta Ads", value: metaRevenue, formatted: formatCurrency(metaRevenue, client.currency), color: "#3B82F6" },
                  { name: "Google Ads", value: googleRevenue, formatted: formatCurrency(googleRevenue, client.currency), color: "#22C55E" },
                ],
                "#06B6D4",
                (v) => formatCurrency(v, client.currency),
              ))}
            />
            <KpiCard
              title="Conversions"
              value={formatNumber(kpis.conversions)}
              delta={deltas.conversions}
              icon={<ShoppingCart size={14} />}
              tooltip="Total conversion actions (purchases, signups, etc.)"
              sparkline={sparklines.conversions}
              accentColor="#EC4899"
              previousValue={prevFormatted?.conversions}
              onClick={() => setKpiDetail(buildKpiDetail(
                "Conversions", <ShoppingCart size={18} />,
                formatNumber(kpis.conversions),
                "conversions",
                [
                  { name: "Meta Ads", value: metaConversions, formatted: formatNumber(metaConversions), color: "#3B82F6" },
                  { name: "Google Ads", value: googleConversions, formatted: formatNumber(googleConversions), color: "#22C55E" },
                ],
                "#EC4899",
                (v) => formatNumber(v),
              ))}
            />
        </div>

        {/* ── Platform Spend + Budget Pacing ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5">
          {/* Platform Spend — with stacked bar chart */}
          <div className="bg-[#12121A] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                Platform Spend Split
              </h2>
              <span className="text-lg font-bold text-white">{formatCurrency(kpis.spend, client.currency)}</span>
            </div>

            {/* Stacked bar showing split */}
            <div className="h-4 rounded-full overflow-hidden flex gap-0.5">
              <div
                className="h-full bg-blue-500 rounded-l-full transition-all duration-700"
                style={{ width: `${metaPct}%` }}
              />
              <div
                className="h-full bg-emerald-500 rounded-r-full transition-all duration-700"
                style={{ width: `${googlePct}%` }}
              />
            </div>

            {/* Platform cards */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.04] hover:bg-white/[0.05] transition-colors">
                <div className="flex items-center gap-3">
                  <MetaIcon size={22} />
                  <div>
                    <span className="text-sm font-semibold text-white">Meta Ads</span>
                    <p className="text-[11px] text-[#64748B]">{metaPct.toFixed(0)}% of total</p>
                  </div>
                </div>
                <span className="text-base font-bold text-white">
                  {formatCurrency(metaSpend, client.currency)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.04] hover:bg-white/[0.05] transition-colors">
                <div className="flex items-center gap-3">
                  <GoogleIcon size={22} />
                  <div>
                    <span className="text-sm font-semibold text-white">Google Ads</span>
                    <p className="text-[11px] text-[#64748B]">{googlePct.toFixed(0)}% of total</p>
                  </div>
                </div>
                <span className="text-base font-bold text-white">
                  {formatCurrency(googleSpend, client.currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Budget Pacing — independent of date range filter */}
          <div className="bg-[#12121A] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4">
            <h2 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
              Budget Pacing
            </h2>
            <PacingBar
              periodSpend={pacingSpend}
              monthlyBudget={client.monthlyBudget}
              daysElapsed={billingPeriod.daysElapsed}
              daysInPeriod={billingPeriod.daysInPeriod}
              daysRemaining={billingPeriod.daysRemaining}
              billingPeriodLabel={billingPeriod.label}
              currency={client.currency}
            />
          </div>
        </div>

        {/* ── Trend Charts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5">
          {/* Spend & Revenue */}
          <div className="bg-[#12121A] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                Spend vs Revenue
              </h2>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-[11px] text-[#94A3B8]">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#FF6A41]" /> Spend
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-[#94A3B8]">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#22C55E]" /> Revenue
                </span>
              </div>
            </div>
            <div className="h-[200px] sm:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={2} barSize={chartData.length > 20 ? undefined : 12}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#64748B", fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "#64748B", fontSize: 10 }} tickLine={false} axisLine={false} width={50} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1A1A2E", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: 12, padding: "10px 14px" }}
                    labelStyle={{ color: "#94A3B8", marginBottom: 4 }}
                    formatter={(val) => [formatCurrency(Number(val), client.currency)]}
                    cursor={{ fill: "rgba(255,255,255,0.02)" }}
                  />
                  <Bar dataKey="spend" name="Spend" fill="#FF6A41" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="revenue" name="Revenue" fill="#22C55E" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ROAS Trend */}
          <div className="bg-[#12121A] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                ROAS Trend
              </h2>
              {chartData.length > 0 && (
                <span className="text-lg font-bold text-white">
                  {chartData[chartData.length - 1]?.roas?.toFixed(2)}x
                </span>
              )}
            </div>
            <div className="h-[200px] sm:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="roasGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22C55E" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "#64748B", fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "#64748B", fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1A1A2E", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: 12, padding: "10px 14px" }}
                    labelStyle={{ color: "#94A3B8", marginBottom: 4 }}
                    formatter={(val) => [`${Number(val).toFixed(2)}x`, "ROAS"]}
                    cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="roas"
                    stroke="#22C55E"
                    fill="url(#roasGradient)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "#22C55E", stroke: "#12121A", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── Platform Performance (Combined) ── */}
        <div className="bg-[#12121A] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-5">
          <h2 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Platform Performance</h2>

          {/* Column headers */}
          <div className="hidden sm:grid grid-cols-[1fr_repeat(5,minmax(0,1fr))] gap-3 px-1">
            <span />
            {["Spend", "Revenue", "ROAS", "Conversions", "CPA"].map((h) => (
              <span key={h} className="text-[9px] text-[#64748B] uppercase tracking-wider text-right">{h}</span>
            ))}
          </div>

          {/* Meta row */}
          <div className="grid grid-cols-2 sm:grid-cols-[1fr_repeat(5,minmax(0,1fr))] gap-3 items-center p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.04]">
            <div className="flex items-center gap-2.5 col-span-2 sm:col-span-1 mb-2 sm:mb-0">
              <MetaIcon size={20} />
              <span className="text-sm font-semibold text-white">Meta Ads</span>
              <span className="text-[10px] text-[#64748B]">{metaPct.toFixed(0)}%</span>
            </div>
            {[
              { label: "Spend", value: formatCurrency(metaSpend, client.currency) },
              { label: "Revenue", value: formatCurrency(metaRevenue, client.currency) },
              { label: "ROAS", value: metaSpend > 0 ? formatROAS(metaRevenue / metaSpend) : "—" },
              { label: "Conv", value: formatNumber(metaConversions) },
              { label: "CPA", value: metaConversions > 0 ? formatCurrency(metaSpend / metaConversions, client.currency) : "—" },
            ].map((m) => (
              <div key={m.label} className="text-right">
                <p className="text-[9px] text-[#64748B] uppercase sm:hidden mb-0.5">{m.label}</p>
                <p className="text-sm font-bold text-white">{m.value}</p>
              </div>
            ))}
          </div>

          {/* Google row */}
          <div className="grid grid-cols-2 sm:grid-cols-[1fr_repeat(5,minmax(0,1fr))] gap-3 items-center p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.04]">
            <div className="flex items-center gap-2.5 col-span-2 sm:col-span-1 mb-2 sm:mb-0">
              <GoogleIcon size={20} />
              <span className="text-sm font-semibold text-white">Google Ads</span>
              <span className="text-[10px] text-[#64748B]">{googlePct.toFixed(0)}%</span>
            </div>
            {[
              { label: "Spend", value: formatCurrency(googleSpend, client.currency) },
              { label: "Revenue", value: formatCurrency(googleRevenue, client.currency) },
              { label: "ROAS", value: googleSpend > 0 ? formatROAS(googleRevenue / googleSpend) : "—" },
              { label: "Conv", value: formatNumber(googleConversions) },
              { label: "CPA", value: googleConversions > 0 ? formatCurrency(googleSpend / googleConversions, client.currency) : "—" },
            ].map((m) => (
              <div key={m.label} className="text-right">
                <p className="text-[9px] text-[#64748B] uppercase sm:hidden mb-0.5">{m.label}</p>
                <p className="text-sm font-bold text-white">{m.value}</p>
              </div>
            ))}
          </div>

          {/* Totals row */}
          <div className="grid grid-cols-2 sm:grid-cols-[1fr_repeat(5,minmax(0,1fr))] gap-3 items-center pt-3 border-t border-white/[0.06] px-1">
            <div className="flex items-center gap-2 col-span-2 sm:col-span-1 mb-2 sm:mb-0">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Total</span>
            </div>
            {[
              { label: "Spend", value: formatCurrency(kpis.spend, client.currency) },
              { label: "Revenue", value: formatCurrency(kpis.revenue, client.currency) },
              { label: "ROAS", value: kpis.spend > 0 ? formatROAS(kpis.revenue / kpis.spend) : "—" },
              { label: "Conv", value: formatNumber(kpis.conversions) },
              { label: "CPA", value: kpis.conversions > 0 ? formatCurrency(kpis.spend / kpis.conversions, client.currency) : "—" },
            ].map((m) => (
              <div key={m.label} className="text-right">
                <p className="text-[9px] text-[#64748B] uppercase sm:hidden mb-0.5">{m.label}</p>
                <p className="text-sm font-bold text-[#FF6A41]">{m.value}</p>
              </div>
            ))}
          </div>
        </div>

        <SuggestionWidget />
        </DataBlur>
      </div>

      {/* ── KPI Detail Modal ── */}
      <KpiDetailModal data={kpiDetail} onClose={closeKpiDetail} />
    </>
  );
}
