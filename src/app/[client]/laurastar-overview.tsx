"use client";

import { useMemo, useState, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { SuggestionWidget } from "@/components/suggestions/SuggestionWidget";
import { KpiCard } from "@/components/ui/kpi-card";
import { PacingBar } from "@/components/ui/pacing-bar";
import { DataBlur } from "@/components/ui/data-blur";
import { KpiDetailModal, type KpiDetailData } from "@/components/ui/kpi-detail-modal";
import { useClient } from "@/lib/client-context";
import { useWindsor } from "@/lib/use-windsor";
import { useDateRange } from "@/lib/date-range-context";
import { useLocale } from "@/lib/locale-context";
import { getClientKPIs, getClientDailyMetrics, getClientCreatives } from "@/lib/mock-data";
import type { WindsorRow } from "@/lib/windsor";
import { formatCurrency, formatNumber, formatROAS, getBillingPeriod } from "@/lib/utils";
import { MetaIcon, GoogleIcon } from "@/components/ui/platform-icons";
import {
  DollarSign,
  TrendingUp,
  Target,
  ShoppingCart,
  AlertTriangle,
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

/* ── Windsor aggregation (matches default overview) ── */

function aggregateWindsorKPIs(rows: WindsorRow[]) {
  const spend = rows.reduce((s, r) => s + (Number(r.spend) || 0), 0);
  const impressions = rows.reduce((s, r) => s + (Number(r.impressions) || 0), 0);
  const clicks = rows.reduce((s, r) => s + (Number(r.clicks) || 0), 0);
  let metaRevenue = 0, googleRevenue = 0;
  let metaConversions = 0, googleConversions = 0;
  for (const r of rows) {
    const rev = Number(r.revenue) || 0;
    const conv = Number(r.conversions) || 0;
    if (r.source === "facebook" || r.source === "meta" || r.source === "instagram") {
      metaRevenue += rev; metaConversions += conv;
    } else {
      googleRevenue += rev; googleConversions += conv;
    }
  }
  const revenue = metaRevenue + googleRevenue;
  const conversions = metaConversions + googleConversions;
  const platformReportedRevenue = metaRevenue + googleRevenue;
  const roas = spend > 0 ? revenue / spend : 0;
  const cpa = conversions > 0 ? spend / conversions : 0;
  const mer = spend > 0 ? revenue / spend : 0;
  return { spend, impressions, clicks, revenue, conversions, platformReportedRevenue, roas, cpa, mer, spendDelta: 0, roasDelta: 0, cpaDelta: 0, merDelta: 0, impressionsDelta: 0, conversionsDelta: 0, revenueDelta: 0 };
}

function aggregateWindsorDaily(rows: WindsorRow[], fmtDate: (iso: string) => string) {
  const byDate: Record<string, { date: string; spend: number; revenue: number; conversions: number; impressions: number }> = {};
  for (const r of rows) {
    const d = r.date;
    if (!d) continue;
    if (!byDate[d]) byDate[d] = { date: d, spend: 0, revenue: 0, conversions: 0, impressions: 0 };
    byDate[d].spend += Number(r.spend) || 0;
    byDate[d].revenue += Number(r.revenue) || 0;
    byDate[d].conversions += Number(r.conversions) || 0;
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

/* ── Laurastar Overview ── */

export default function LaurastarOverview() {
  const { days, preset, dateFrom, dateTo, compareEnabled, prevDateFrom, prevDateTo } = useDateRange();
  const { shortDate: fmtDate } = useLocale();
  const ctx = useClient();
  const client = ctx?.clientConfig;
  const clientSlug = "laurastar";

  const mockKpis = getClientKPIs(clientSlug, client);
  const mockDailyMetrics = getClientDailyMetrics(clientSlug, 30, client);
  const creatives = getClientCreatives(clientSlug, client);

  // Windsor live data
  const { data: windsorData, source: dataSource, loading: windsorLoading } = useWindsor<WindsorRow[]>({
    clientSlug, type: "campaigns", days,
    ...(preset === "Custom" ? { dateFrom, dateTo } : {}),
  });
  const { data: prevWindsorData } = useWindsor<WindsorRow[]>({
    clientSlug, type: "campaigns", days, dateFrom: prevDateFrom, dateTo: prevDateTo,
  });

  const isLive = dataSource === "windsor" && windsorData && windsorData.length > 0;

  // KPIs
  const kpis = useMemo(() => {
    if (isLive) return aggregateWindsorKPIs(windsorData);
    return mockKpis;
  }, [isLive, windsorData, mockKpis]);

  // Previous period
  const prevKpis = useMemo(() => {
    if (!compareEnabled || !prevWindsorData || prevWindsorData.length === 0) return null;
    return aggregateWindsorKPIs(prevWindsorData);
  }, [compareEnabled, prevWindsorData]);

  const pctChange = (c: number, p: number) => p > 0 ? +((c - p) / p * 100).toFixed(1) : 0;
  const deltas = useMemo(() => {
    if (!prevKpis) return { spend: 0, roas: 0, cpa: 0, revenue: 0, conversions: 0, mer: 0, impressions: 0 };
    return {
      spend: pctChange(kpis.spend, prevKpis.spend),
      roas: pctChange(kpis.roas, prevKpis.roas),
      cpa: pctChange(kpis.cpa, prevKpis.cpa),
      revenue: pctChange(kpis.revenue, prevKpis.revenue),
      conversions: pctChange(kpis.conversions, prevKpis.conversions),
      mer: pctChange(kpis.mer, prevKpis.mer),
      impressions: pctChange(kpis.impressions, prevKpis.impressions),
    };
  }, [kpis, prevKpis]);

  // Daily chart data
  const chartData = useMemo(() => {
    if (isLive) return aggregateWindsorDaily(windsorData, fmtDate);
    const byDate: Record<string, { date: string; spend: number; revenue: number; conversions: number; impressions: number }> = {};
    for (const m of mockDailyMetrics) {
      if (!byDate[m.date]) byDate[m.date] = { date: m.date, spend: 0, revenue: 0, conversions: 0, impressions: 0 };
      byDate[m.date].spend += m.spend;
      byDate[m.date].revenue += m.revenue;
      byDate[m.date].conversions += m.conversions;
      byDate[m.date].impressions += m.impressions;
    }
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date)).map(d => ({
      ...d, date: fmtDate(d.date),
      roas: d.spend > 0 ? +(d.revenue / d.spend).toFixed(2) : 0,
      cpa: d.conversions > 0 ? +(d.spend / d.conversions).toFixed(2) : 0,
    }));
  }, [isLive, windsorData, mockDailyMetrics, fmtDate]);

  // Sparklines
  const sparklines = useMemo(() => ({
    spend: chartData.map(d => ({ v: d.spend, label: d.date })),
    revenue: chartData.map(d => ({ v: d.revenue, label: d.date })),
    roas: chartData.map(d => ({ v: d.roas, label: d.date })),
    cpa: chartData.map(d => ({ v: d.cpa, label: d.date })),
    conversions: chartData.map(d => ({ v: d.conversions, label: d.date })),
  }), [chartData]);

  // Budget pacing
  const billingPeriod = useMemo(() => getBillingPeriod(client?.billingStartDay ?? 1), [client?.billingStartDay]);
  const { data: pacingWindsorData, source: pacingSource } = useWindsor<WindsorRow[]>({
    clientSlug, type: "campaigns", dateFrom: billingPeriod.startISO, dateTo: billingPeriod.endISO,
  });
  const pacingSpend = useMemo(() => {
    if (pacingSource === "windsor" && pacingWindsorData && pacingWindsorData.length > 0)
      return pacingWindsorData.reduce((s, r) => s + (Number(r.spend) || 0), 0);
    return kpis.spend * (billingPeriod.daysElapsed / days);
  }, [pacingSource, pacingWindsorData, kpis.spend, billingPeriod.daysElapsed, days]);

  // KPI detail modal
  const [kpiDetail, setKpiDetail] = useState<KpiDetailData | null>(null);
  const closeKpiDetail = useCallback(() => setKpiDetail(null), []);

  // ── Laurastar-specific: Weekend vs Weekday ──
  const weekdayWeekend = useMemo(() => {
    const weekday = { spend: 0, revenue: 0, conversions: 0, days: 0 };
    const weekend = { spend: 0, revenue: 0, conversions: 0, days: 0 };
    for (const d of chartData) {
      const idx = chartData.indexOf(d);
      const dayOfWeek = idx % 7;
      const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
      const bucket = isWeekend ? weekend : weekday;
      bucket.spend += d.spend;
      bucket.revenue += d.revenue;
      bucket.conversions += d.conversions;
      bucket.days += 1;
    }
    return {
      weekday: {
        avgSpend: weekday.days > 0 ? weekday.spend / weekday.days : 0,
        avgRevenue: weekday.days > 0 ? weekday.revenue / weekday.days : 0,
        roas: weekday.spend > 0 ? weekday.revenue / weekday.spend : 0,
        totalConv: weekday.conversions,
      },
      weekend: {
        avgSpend: weekend.days > 0 ? weekend.spend / weekend.days : 0,
        avgRevenue: weekend.days > 0 ? weekend.revenue / weekend.days : 0,
        roas: weekend.spend > 0 ? weekend.revenue / weekend.spend : 0,
        totalConv: weekend.conversions,
      },
    };
  }, [chartData]);

  // ── Laurastar-specific: Creative health ──
  const creativeHealth = useMemo(() => {
    const metaCreatives = creatives.filter(c => c.platform === "meta");
    const fatigued = metaCreatives.filter(c => c.isFatigued).length;
    const avgFrequency = metaCreatives.length > 0
      ? +(metaCreatives.reduce((s, c) => s + c.frequency, 0) / metaCreatives.length).toFixed(2)
      : 0;
    const highPerformers = metaCreatives.filter(c => c.compositeScore >= 60).length;
    return { total: metaCreatives.length, fatigued, avgFrequency, highPerformers };
  }, [creatives]);

  if (!client) return null;

  const currency = client.currency;

  // Platform breakdown
  const metaSpend = isLive
    ? windsorData.filter((r) => r.source === "facebook" || r.source === "meta" || r.source === "instagram").reduce((s, r) => s + (Number(r.spend) || 0), 0)
    : kpis.spend * client.metaAllocation;
  const googleSpend = isLive
    ? windsorData.filter((r) => r.source !== "facebook" && r.source !== "meta" && r.source !== "instagram").reduce((s, r) => s + (Number(r.spend) || 0), 0)
    : kpis.spend * client.googleAllocation;
  const totalPlatformSpend = metaSpend + googleSpend;
  const metaPct = totalPlatformSpend > 0 ? (metaSpend / totalPlatformSpend) * 100 : 55;
  const googlePct = totalPlatformSpend > 0 ? (googleSpend / totalPlatformSpend) * 100 : 45;
  const metaRevenue = isLive
    ? windsorData.filter((r) => r.source === "facebook" || r.source === "meta" || r.source === "instagram").reduce((s, r) => s + (Number(r.revenue) || 0), 0)
    : kpis.revenue * client.metaAllocation;
  const googleRevenue = isLive
    ? windsorData.filter((r) => r.source !== "facebook" && r.source !== "meta" && r.source !== "instagram").reduce((s, r) => s + (Number(r.revenue) || 0), 0)
    : kpis.revenue * client.googleAllocation;
  const metaConversions = isLive
    ? windsorData.filter((r) => r.source === "facebook" || r.source === "meta" || r.source === "instagram").reduce((s, r) => s + (Number(r.conversions) || 0), 0)
    : Math.round(kpis.conversions * client.metaAllocation);
  const googleConversions = isLive
    ? windsorData.filter((r) => r.source !== "facebook" && r.source !== "meta" && r.source !== "instagram").reduce((s, r) => s + (Number(r.conversions) || 0), 0)
    : Math.round(kpis.conversions * client.googleAllocation);

  // Prev formatted
  const prevFormatted = prevKpis ? {
    spend: formatCurrency(prevKpis.spend, currency),
    roas: formatROAS(prevKpis.roas),
    cpa: formatCurrency(prevKpis.cpa, currency),
    mer: formatROAS(prevKpis.mer),
    revenue: formatCurrency(prevKpis.revenue, currency),
    conversions: formatNumber(prevKpis.conversions),
  } : null;

  // Spend breakdown for KPI detail
  const spendBreakdown = [
    { name: "Meta Ads", value: metaSpend, formatted: formatCurrency(metaSpend, currency), color: "#3B82F6" },
    { name: "Google Ads", value: googleSpend, formatted: formatCurrency(googleSpend, currency), color: "#22C55E" },
  ];

  const currentLabel = chartData.length > 0
    ? `${chartData[0].date} - ${chartData[chartData.length - 1].date}`
    : `Last ${days} days`;

  const buildKpiDetail = (
    title: string, icon: React.ReactNode, currentValue: string,
    dailyKey: "spend" | "revenue" | "roas" | "cpa" | "conversions",
    breakdown: { name: string; value: number; formatted: string; color: string }[],
    accentColor: string, fmtFn?: (v: number) => string,
  ): KpiDetailData => ({
    title, icon, currentValue, currentLabel,
    dailyData: chartData.map((d) => ({ date: d.date, current: d[dailyKey] })),
    breakdown, accentColor, formatValue: fmtFn,
  });

  // ── Laurastar-specific: Attribution Reconciliation ──
  const shopifyRevenue = kpis.revenue;
  const platformReportedRevenue = isLive ? (kpis as ReturnType<typeof aggregateWindsorKPIs>).platformReportedRevenue ?? kpis.revenue : kpis.revenue;
  const overReportingPct = platformReportedRevenue > 0 && shopifyRevenue > 0
    ? +((platformReportedRevenue - shopifyRevenue) / shopifyRevenue * 100).toFixed(1)
    : 0;

  return (
    <>
      <Header title={client.name} showAttribution dataBadge={{ loading: windsorLoading, isLive: !!isLive }} />

      <div className="flex-1 p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-5 overflow-y-auto">
        <SuggestionWidget />
        <DataBlur isBlurred={!isLive && !windsorLoading} isLoading={windsorLoading} className="space-y-4 sm:space-y-5">

        {/* ── KPI Grid (matches default overview) ── */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <KpiCard
            title="Ad Spend"
            value={formatCurrency(kpis.spend, currency)}
            delta={deltas.spend}
            icon={<DollarSign size={14} />}
            tooltip="Total ad spend across all platforms in the selected period"
            sparkline={sparklines.spend}
            accentColor="#FF6A41"
            previousValue={prevFormatted?.spend}
            onClick={() => setKpiDetail(buildKpiDetail(
              "Ad Spend", <DollarSign size={18} />, formatCurrency(kpis.spend, currency),
              "spend", spendBreakdown, "#FF6A41", (v) => formatCurrency(v, currency),
            ))}
          />
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
              "ROAS", <TrendingUp size={18} />, formatROAS(kpis.roas), "roas",
              [
                { name: "Meta Ads", value: metaSpend > 0 ? metaRevenue / metaSpend : 0, formatted: formatROAS(metaSpend > 0 ? metaRevenue / metaSpend : 0), color: "#3B82F6" },
                { name: "Google Ads", value: googleSpend > 0 ? googleRevenue / googleSpend : 0, formatted: formatROAS(googleSpend > 0 ? googleRevenue / googleSpend : 0), color: "#22C55E" },
              ], "#22C55E", (v) => `${v.toFixed(2)}x`,
            ))}
          />
          <KpiCard
            title="Cost Per Acquisition"
            value={formatCurrency(kpis.cpa, currency)}
            delta={deltas.cpa}
            invertDelta
            icon={<Target size={14} />}
            tooltip="Cost Per Acquisition — spend divided by conversions"
            sparkline={sparklines.cpa}
            accentColor="#F59E0B"
            previousValue={prevFormatted?.cpa}
            onClick={() => setKpiDetail(buildKpiDetail(
              "CPA", <Target size={18} />, formatCurrency(kpis.cpa, currency), "cpa",
              [
                { name: "Meta Ads", value: metaConversions > 0 ? metaSpend / metaConversions : 0, formatted: formatCurrency(metaConversions > 0 ? metaSpend / metaConversions : 0, currency), color: "#3B82F6" },
                { name: "Google Ads", value: googleConversions > 0 ? googleSpend / googleConversions : 0, formatted: formatCurrency(googleConversions > 0 ? googleSpend / googleConversions : 0, currency), color: "#22C55E" },
              ], "#F59E0B", (v) => formatCurrency(v, currency),
            ))}
          />
          <KpiCard
            title="Conversion Value"
            value={formatCurrency(kpis.revenue, currency)}
            delta={deltas.revenue}
            icon={<DollarSign size={14} />}
            tooltip="Total revenue attributed to ad conversions"
            sparkline={sparklines.revenue}
            accentColor="#06B6D4"
            previousValue={prevFormatted?.revenue}
            onClick={() => setKpiDetail(buildKpiDetail(
              "Conversion Value", <DollarSign size={18} />, formatCurrency(kpis.revenue, currency), "revenue",
              [
                { name: "Meta Ads", value: metaRevenue, formatted: formatCurrency(metaRevenue, currency), color: "#3B82F6" },
                { name: "Google Ads", value: googleRevenue, formatted: formatCurrency(googleRevenue, currency), color: "#22C55E" },
              ], "#06B6D4", (v) => formatCurrency(v, currency),
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
              "Conversions", <ShoppingCart size={18} />, formatNumber(kpis.conversions), "conversions",
              [
                { name: "Meta Ads", value: metaConversions, formatted: formatNumber(metaConversions), color: "#3B82F6" },
                { name: "Google Ads", value: googleConversions, formatted: formatNumber(googleConversions), color: "#22C55E" },
              ], "#EC4899", (v) => formatNumber(v),
            ))}
          />
        </div>

        {/* ── Platform Spend + Budget Pacing (matches default overview) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5">
          {/* Platform Spend */}
          <div className="bg-[#12121A] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Platform Spend Split</h2>
              <span className="text-lg font-bold text-white">{formatCurrency(kpis.spend, currency)}</span>
            </div>
            <div className="h-4 rounded-full overflow-hidden flex gap-0.5">
              <div className="h-full bg-blue-500 rounded-l-full transition-all duration-700" style={{ width: `${metaPct}%` }} />
              <div className="h-full bg-emerald-500 rounded-r-full transition-all duration-700" style={{ width: `${googlePct}%` }} />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.04] hover:bg-white/[0.05] transition-colors">
                <div className="flex items-center gap-3">
                  <MetaIcon size={22} />
                  <div>
                    <span className="text-sm font-semibold text-white">Meta Ads</span>
                    <p className="text-[11px] text-[#64748B]">{metaPct.toFixed(0)}% of total</p>
                  </div>
                </div>
                <span className="text-base font-bold text-white">{formatCurrency(metaSpend, currency)}</span>
              </div>
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.04] hover:bg-white/[0.05] transition-colors">
                <div className="flex items-center gap-3">
                  <GoogleIcon size={22} />
                  <div>
                    <span className="text-sm font-semibold text-white">Google Ads</span>
                    <p className="text-[11px] text-[#64748B]">{googlePct.toFixed(0)}% of total</p>
                  </div>
                </div>
                <span className="text-base font-bold text-white">{formatCurrency(googleSpend, currency)}</span>
              </div>
            </div>
          </div>

          {/* Budget Pacing */}
          <div className="bg-[#12121A] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4">
            <h2 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Budget Pacing</h2>
            <PacingBar
              periodSpend={pacingSpend}
              monthlyBudget={client.monthlyBudget}
              daysElapsed={billingPeriod.daysElapsed}
              daysInPeriod={billingPeriod.daysInPeriod}
              daysRemaining={billingPeriod.daysRemaining}
              billingPeriodLabel={billingPeriod.label}
              currency={currency}
            />
          </div>
        </div>

        {/* ── Trend Charts (matches default overview) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5">
          {/* Spend & Revenue */}
          <div className="bg-[#12121A] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Spend vs Revenue</h2>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-[11px] text-[#94A3B8]"><span className="w-2.5 h-2.5 rounded-sm bg-[#FF6A41]" /> Spend</span>
                <span className="flex items-center gap-1.5 text-[11px] text-[#94A3B8]"><span className="w-2.5 h-2.5 rounded-sm bg-[#22C55E]" /> Revenue</span>
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
                    formatter={(val) => [formatCurrency(Number(val), currency)]}
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
              <h2 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">ROAS Trend</h2>
              {chartData.length > 0 && (
                <span className="text-lg font-bold text-white">{chartData[chartData.length - 1]?.roas?.toFixed(2)}x</span>
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
                  <Area type="monotone" dataKey="roas" stroke="#22C55E" fill="url(#roasGradient)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#22C55E", stroke: "#12121A", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── Platform Performance Table (matches default overview) ── */}
        <div className="bg-[#12121A] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-5">
          <h2 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Platform Performance</h2>
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
              { label: "Spend", value: formatCurrency(metaSpend, currency) },
              { label: "Revenue", value: formatCurrency(metaRevenue, currency) },
              { label: "ROAS", value: metaSpend > 0 ? formatROAS(metaRevenue / metaSpend) : "—" },
              { label: "Conv", value: formatNumber(metaConversions) },
              { label: "CPA", value: metaConversions > 0 ? formatCurrency(metaSpend / metaConversions, currency) : "—" },
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
              { label: "Spend", value: formatCurrency(googleSpend, currency) },
              { label: "Revenue", value: formatCurrency(googleRevenue, currency) },
              { label: "ROAS", value: googleSpend > 0 ? formatROAS(googleRevenue / googleSpend) : "—" },
              { label: "Conv", value: formatNumber(googleConversions) },
              { label: "CPA", value: googleConversions > 0 ? formatCurrency(googleSpend / googleConversions, currency) : "—" },
            ].map((m) => (
              <div key={m.label} className="text-right">
                <p className="text-[9px] text-[#64748B] uppercase sm:hidden mb-0.5">{m.label}</p>
                <p className="text-sm font-bold text-white">{m.value}</p>
              </div>
            ))}
          </div>
          {/* Totals */}
          <div className="grid grid-cols-2 sm:grid-cols-[1fr_repeat(5,minmax(0,1fr))] gap-3 items-center pt-3 border-t border-white/[0.06] px-1">
            <div className="flex items-center gap-2 col-span-2 sm:col-span-1 mb-2 sm:mb-0">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Total</span>
            </div>
            {[
              { label: "Spend", value: formatCurrency(kpis.spend, currency) },
              { label: "Revenue", value: formatCurrency(kpis.revenue, currency) },
              { label: "ROAS", value: kpis.spend > 0 ? formatROAS(kpis.revenue / kpis.spend) : "—" },
              { label: "Conv", value: formatNumber(kpis.conversions) },
              { label: "CPA", value: kpis.conversions > 0 ? formatCurrency(kpis.spend / kpis.conversions, currency) : "—" },
            ].map((m) => (
              <div key={m.label} className="text-right">
                <p className="text-[9px] text-[#64748B] uppercase sm:hidden mb-0.5">{m.label}</p>
                <p className="text-sm font-bold text-[#FF6A41]">{m.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════
            Laurastar-specific sections below
        ════════════════════════════════════════════════════════ */}

        {/* ── Attribution Reconciliation ── */}
        <div className="bg-[#12121A] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4">
          <h2 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Attribution Reconciliation</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] text-[#64748B] uppercase mb-1">Shopify Revenue (Source of Truth)</p>
              <p className="text-lg font-bold text-white">{formatCurrency(shopifyRevenue, currency)}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#64748B] uppercase mb-1">Platform-Reported Revenue</p>
              <p className="text-lg font-bold text-[#94A3B8]">{formatCurrency(platformReportedRevenue, currency)}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#64748B] uppercase mb-1">Over-Reporting</p>
              <p className={`text-lg font-bold ${overReportingPct > 20 ? "text-amber-400" : "text-emerald-400"}`}>
                {overReportingPct > 0 ? "+" : ""}{overReportingPct}%
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/[0.06]">
            <div>
              <p className="text-[10px] text-[#64748B] uppercase mb-1">Blended MER</p>
              <p className="text-base font-bold text-[#8B5CF6]">{formatROAS(kpis.mer)}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#64748B] uppercase mb-1">Linear Paid ROAS</p>
              <p className="text-base font-bold text-[#3B82F6]">{formatROAS(kpis.roas)}</p>
            </div>
          </div>
        </div>

        {/* ── Weekend vs Weekday Performance ── */}
        <div className="bg-[#12121A] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Weekend vs Weekday</h2>
            <span className="text-[10px] text-[#64748B]">(Fri–Sat = Weekend in UAE)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: "Weekday (Sun–Thu)", data: weekdayWeekend.weekday, color: "#3B82F6" },
              { label: "Weekend (Fri–Sat)", data: weekdayWeekend.weekend, color: "#F59E0B" },
            ].map((seg) => (
              <div key={seg.label} className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.04]">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: seg.color }} />
                  <span className="text-xs font-medium text-[#94A3B8]">{seg.label}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-[#64748B] uppercase">Avg Daily Spend</p>
                    <p className="text-sm font-semibold text-white">{formatCurrency(seg.data.avgSpend, currency)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#64748B] uppercase">Avg Daily Revenue</p>
                    <p className="text-sm font-semibold text-white">{formatCurrency(seg.data.avgRevenue, currency)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#64748B] uppercase">ROAS</p>
                    <p className="text-sm font-semibold" style={{ color: seg.color }}>{formatROAS(seg.data.roas)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#64748B] uppercase">Conversions</p>
                    <p className="text-sm font-semibold text-white">{formatNumber(seg.data.totalConv)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Creative Health ── */}
        <div className="bg-[#12121A] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4">
          <h2 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Ad Frequency & Creative Health</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.04] text-center">
              <p className="text-[10px] text-[#64748B] uppercase mb-1">Active Creatives</p>
              <p className="text-2xl font-bold text-white">{creativeHealth.total}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.04] text-center">
              <p className="text-[10px] text-[#64748B] uppercase mb-1">High Performers</p>
              <p className="text-2xl font-bold text-emerald-400">{creativeHealth.highPerformers}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.04] text-center">
              <p className="text-[10px] text-[#64748B] uppercase mb-1">Avg Frequency</p>
              <p className={`text-2xl font-bold ${creativeHealth.avgFrequency > 3 ? "text-amber-400" : "text-white"}`}>
                {creativeHealth.avgFrequency}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.04] text-center">
              <p className="text-[10px] text-[#64748B] uppercase mb-1">Fatigued</p>
              <p className={`text-2xl font-bold ${creativeHealth.fatigued > 0 ? "text-red-400" : "text-emerald-400"}`}>
                {creativeHealth.fatigued}
              </p>
              {creativeHealth.fatigued > 0 && (
                <div className="flex items-center justify-center gap-1 mt-1">
                  <AlertTriangle size={10} className="text-amber-400" />
                  <span className="text-[10px] text-amber-400">Needs refresh</span>
                </div>
              )}
            </div>
          </div>
        </div>

        </DataBlur>
      </div>

      <KpiDetailModal data={kpiDetail} onClose={closeKpiDetail} />
    </>
  );
}
