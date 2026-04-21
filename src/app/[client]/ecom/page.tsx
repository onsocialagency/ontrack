"use client";

import { useMemo, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { KpiCard } from "@/components/ui/kpi-card";
import { PacingBar } from "@/components/ui/pacing-bar";
import { KpiDetailModal, type KpiDetailData } from "@/components/ui/kpi-detail-modal";
import { getClientKPIs, getClientDailyMetrics, getClientCampaigns } from "@/lib/mock-data";
import { useClient } from "@/lib/client-context";
import { useWindsor } from "@/lib/use-windsor";
import { useDateRange } from "@/lib/date-range-context";
import { useLocale } from "@/lib/locale-context";
import { useVenue } from "@/lib/venue-context";
import { VenueTabs } from "@/components/layout/venue-tabs";
import { assignIrgBrand } from "@/lib/irg-brands";
import type { WindsorRow } from "@/lib/windsor";
import { classifyPlatform, isMetaSource, isGoogleSource } from "@/lib/windsor";
import { formatCurrency, formatROAS, formatNumber, cn, getBillingPeriod } from "@/lib/utils";
import { MetricCell } from "@/components/ui/metric-cell";
import { DataBlur } from "@/components/ui/data-blur";
import { MetaIcon, GoogleIcon } from "@/components/ui/platform-icons";
import {
  DollarSign,
  TrendingUp,
  BarChart3,
  ShoppingCart,
  Target,
  Package,
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
  Legend,
} from "recharts";

/* ── Windsor aggregation ── */

function aggregateEcomKPIs(rows: WindsorRow[]) {
  const spend = rows.reduce((s, r) => s + (Number(r.spend) || 0), 0);
  const impressions = rows.reduce((s, r) => s + (Number(r.impressions) || 0), 0);
  const clicks = rows.reduce((s, r) => s + (Number(r.clicks) || 0), 0);
  let metaRev = 0, googleRev = 0, metaConv = 0, googleConv = 0;
  for (const r of rows) {
    const src = r.source;
    const rev = Number(r.revenue) || 0;
    const conv = Number(r.conversions) || 0;
    if (src === "facebook" || src === "meta" || src === "instagram") {
      metaRev += rev; metaConv += conv;
    } else {
      googleRev += rev; googleConv += conv;
    }
  }
  const revenue = metaRev + googleRev;
  const conversions = metaConv + googleConv;
  const roas = spend > 0 ? revenue / spend : 0;
  const mer = spend > 0 ? revenue / spend : 0;
  const aov = conversions > 0 ? revenue / conversions : 0;
  const cpa = conversions > 0 ? spend / conversions : 0;
  return { spend, revenue, conversions, roas, mer, aov, cpa, impressions, clicks };
}

function aggregateEcomDaily(rows: WindsorRow[], fmtDate: (iso: string) => string) {
  const byDate: Record<string, { date: string; spend: number; revenue: number; conversions: number; impressions: number }> = {};
  for (const r of rows) {
    const d = r.date;
    if (!d) continue;
    if (!byDate[d]) {
      byDate[d] = { date: d, spend: 0, revenue: 0, conversions: 0, impressions: 0 };
    }
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
      aov: d.conversions > 0 ? +(d.revenue / d.conversions).toFixed(2) : 0,
      cpa: d.conversions > 0 ? +(d.spend / d.conversions).toFixed(2) : 0,
    }));
}

interface LiveCampaign {
  id: string;
  name: string;
  platform: "meta" | "google";
  spend: number;
  revenue: number;
  roas: number;
  conversions: number;
}

function aggregateCampaigns(rows: WindsorRow[]): LiveCampaign[] {
  const map: Record<string, { name: string; platform: "meta" | "google"; spend: number; revenue: number; conversions: number }> = {};
  for (const r of rows) {
    const key = `${r.source}::${r.campaign}`;
    if (!map[key]) {
      map[key] = {
        name: r.campaign,
        platform: classifyPlatform(r.source) === "meta" ? "meta" : "google",
        spend: 0,
        revenue: 0,
        conversions: 0,
      };
    }
    map[key].spend += Number(r.spend) || 0;
    map[key].revenue += Number(r.revenue) || 0;
    map[key].conversions += Number(r.conversions) || 0;
  }
  return Object.entries(map).map(([key, c]) => ({
    id: key,
    name: c.name,
    platform: c.platform,
    spend: c.spend,
    revenue: c.revenue,
    roas: c.spend > 0 ? c.revenue / c.spend : 0,
    conversions: c.conversions,
  }));
}

/* ── Page ── */

export default function EcomPage() {
  const { client: clientSlug } = useParams<{ client: string }>();
  const isIrg = clientSlug === "irg";
  const { activeVenue } = useVenue();
  const { days, preset, dateFrom, dateTo } = useDateRange();
  const { shortDate: fmtDate } = useLocale();
  const customDateProps = preset === "Custom" ? { dateFrom, dateTo } : {};
  const ctx = useClient();
  const client = ctx?.clientConfig;
  const mockKpis = getClientKPIs(clientSlug, client);
  const mockDailyMetrics = getClientDailyMetrics(clientSlug, 30, client);
  const mockCampaigns = getClientCampaigns(clientSlug, undefined, client);

  const { data: windsorData, source: dataSource, loading: windsorLoading } = useWindsor<WindsorRow[]>({
    clientSlug,
    type: "campaigns",
    days,
    ...customDateProps,
  });

  const isLive = dataSource === "windsor" && windsorData && windsorData.length > 0;

  const venueFilteredData = useMemo(() => {
    if (!isLive || !isIrg || activeVenue === "all") return windsorData;
    return windsorData!.filter((r) => {
      const accountId = r.account_id || r.account_name || "";
      const campaign = r.campaign || "";
      return assignIrgBrand(campaign, accountId) === activeVenue;
    });
  }, [isLive, isIrg, activeVenue, windsorData]);

  // KPIs
  const ecom = useMemo(() => {
    if (isLive) return aggregateEcomKPIs(venueFilteredData!);
    return {
      spend: mockKpis.spend,
      revenue: mockKpis.revenue,
      conversions: mockKpis.conversions,
      roas: mockKpis.roas,
      mer: mockKpis.mer,
      aov: mockKpis.conversions > 0 ? mockKpis.revenue / mockKpis.conversions : 0,
      cpa: mockKpis.conversions > 0 ? mockKpis.spend / mockKpis.conversions : 0,
      impressions: mockKpis.impressions,
      clicks: 0,
    };
  }, [isLive, venueFilteredData, mockKpis]);

  // Daily chart data
  const chartData = useMemo(() => {
    if (isLive) return aggregateEcomDaily(venueFilteredData!, fmtDate);

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
        aov: d.conversions > 0 ? +(d.revenue / d.conversions).toFixed(2) : 0,
        cpa: d.conversions > 0 ? +(d.spend / d.conversions).toFixed(2) : 0,
      }));
  }, [isLive, venueFilteredData, mockDailyMetrics, fmtDate]);

  // Sparklines
  const sparklines = useMemo(() => ({
    spend: chartData.map((d) => ({ v: d.spend, label: d.date })),
    revenue: chartData.map((d) => ({ v: d.revenue, label: d.date })),
    roas: chartData.map((d) => ({ v: d.roas, label: d.date })),
    conversions: chartData.map((d) => ({ v: d.conversions, label: d.date })),
    aov: chartData.map((d) => ({ v: d.aov, label: d.date })),
    cpa: chartData.map((d) => ({ v: d.cpa, label: d.date })),
  }), [chartData]);

  // Platform breakdown
  const metaRows = isLive ? venueFilteredData!.filter((r) => isMetaSource(r.source)) : [];
  const googleRows = isLive ? venueFilteredData!.filter((r) => isGoogleSource(r.source)) : [];

  const metaSpend = isLive ? metaRows.reduce((s, r) => s + (Number(r.spend) || 0), 0) : ecom.spend * (client?.metaAllocation ?? 0.5);
  const metaRevenue = isLive ? metaRows.reduce((s, r) => s + (Number(r.revenue) || 0), 0) : ecom.revenue * (client?.metaAllocation ?? 0.5);
  const metaConversions = isLive ? metaRows.reduce((s, r) => s + (Number(r.conversions) || 0), 0) : Math.round(ecom.conversions * (client?.metaAllocation ?? 0.5));

  const googleSpend = isLive ? googleRows.reduce((s, r) => s + (Number(r.spend) || 0), 0) : ecom.spend * (client?.googleAllocation ?? 0.5);
  const googleRevenue = isLive ? googleRows.reduce((s, r) => s + (Number(r.revenue) || 0), 0) : ecom.revenue * (client?.googleAllocation ?? 0.5);
  const googleConversions = isLive ? googleRows.reduce((s, r) => s + (Number(r.conversions) || 0), 0) : Math.round(ecom.conversions * (client?.googleAllocation ?? 0.5));

  const totalPlatformSpend = metaSpend + googleSpend;
  const metaPct = totalPlatformSpend > 0 ? (metaSpend / totalPlatformSpend) * 100 : 50;
  const googlePct = totalPlatformSpend > 0 ? (googleSpend / totalPlatformSpend) * 100 : 50;

  // ── Billing-period pacing (independent of date range filter) ──
  const billingPeriod = useMemo(() => {
    return getBillingPeriod(client?.billingStartDay ?? 1);
  }, [client?.billingStartDay]);

  // Separate Windsor fetch for pacing — always uses billing period dates
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
    return ecom.spend * (billingPeriod.daysElapsed / days);
  }, [pacingSource, pacingWindsorData, ecom.spend, billingPeriod.daysElapsed, days]);

  // Top campaigns by revenue
  const topCampaigns = useMemo(() => {
    if (isLive) {
      return aggregateCampaigns(venueFilteredData!)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 8);
    }
    return mockCampaigns
      .filter((c) => c.level === "campaign")
      .sort((a, b) => b.roas * b.spend - a.roas * a.spend)
      .slice(0, 8)
      .map((c) => ({
        id: c.id,
        name: c.name,
        platform: c.platform as "meta" | "google",
        spend: c.spend,
        revenue: c.spend * c.roas,
        roas: c.roas,
        conversions: c.conversions,
      }));
  }, [isLive, venueFilteredData, mockCampaigns]);

  // KPI detail modal
  const [kpiDetail, setKpiDetail] = useState<KpiDetailData | null>(null);
  const closeKpiDetail = useCallback(() => setKpiDetail(null), []);

  if (!client) return null;

  // Only render for ecommerce or hybrid clients
  if (client.type !== "ecommerce" && client.type !== "hybrid") {
    return (
      <>
        <Header title="Ecommerce" showDateRange={false} filterRow={isIrg ? <VenueTabs /> : undefined} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-[#12121A] border border-white/[0.06] rounded-2xl p-8 text-center space-y-2">
            <p className="text-sm text-[#94A3B8]">
              Ecommerce view is only available for ecommerce and hybrid clients.
            </p>
          </div>
        </div>
      </>
    );
  }

  const currentLabel = chartData.length > 0
    ? `${chartData[0].date} - ${chartData[chartData.length - 1].date}`
    : `Last ${days} days`;

  const revenueBreakdown = [
    { name: "Meta Ads", value: metaRevenue, formatted: formatCurrency(metaRevenue, client.currency), color: "#3B82F6" },
    { name: "Google Ads", value: googleRevenue, formatted: formatCurrency(googleRevenue, client.currency), color: "#22C55E" },
  ];

  const buildKpiDetail = (
    title: string,
    icon: React.ReactNode,
    currentValue: string,
    dailyKey: "spend" | "revenue" | "roas" | "cpa" | "conversions" | "aov",
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

  return (
    <>
      <Header title="Ecommerce" showAttribution dataBadge={{ loading: windsorLoading, isLive: !!isLive }} filterRow={isIrg ? <VenueTabs /> : undefined} />

      <div className="flex-1 p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-5 overflow-y-auto">

        <DataBlur isBlurred={dataSource !== "windsor" && !windsorLoading} isLoading={windsorLoading} className="space-y-4 sm:space-y-5">
        {/* ── KPI Grid with sparklines ── */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <KpiCard loading={windsorLoading}
            title="Revenue"
            value={formatCurrency(ecom.revenue, client.currency)}
            delta={0}
            icon={<DollarSign size={12} />}
            tooltip="Total revenue attributed to ad campaigns"
            sparkline={sparklines.revenue}
            accentColor="#22C55E"
            onClick={() => setKpiDetail(buildKpiDetail(
              "Revenue", <DollarSign size={18} />,
              formatCurrency(ecom.revenue, client.currency),
              "revenue", revenueBreakdown, "#22C55E",
              (v) => formatCurrency(v, client.currency),
            ))}
          />
          <KpiCard loading={windsorLoading}
            title="Platform ROAS"
            value={formatROAS(ecom.roas)}
            delta={0}
            icon={<TrendingUp size={12} />}
            tooltip="Platform-reported return on ad spend"
            sparkline={sparklines.roas}
            accentColor="#FF6A41"
            onClick={() => setKpiDetail(buildKpiDetail(
              "ROAS", <TrendingUp size={18} />,
              formatROAS(ecom.roas),
              "roas",
              [
                { name: "Meta Ads", value: metaSpend > 0 ? metaRevenue / metaSpend : 0, formatted: formatROAS(metaSpend > 0 ? metaRevenue / metaSpend : 0), color: "#3B82F6" },
                { name: "Google Ads", value: googleSpend > 0 ? googleRevenue / googleSpend : 0, formatted: formatROAS(googleSpend > 0 ? googleRevenue / googleSpend : 0), color: "#22C55E" },
              ],
              "#FF6A41",
              (v) => `${v.toFixed(2)}x`,
            ))}
          />
          <KpiCard loading={windsorLoading}
            title="Blended MER"
            value={formatROAS(ecom.mer)}
            delta={0}
            icon={<BarChart3 size={12} />}
            tooltip="Marketing Efficiency Ratio — total revenue / total ad spend"
            sparkline={sparklines.roas}
            accentColor="#3B82F6"
            onClick={() => setKpiDetail(buildKpiDetail(
              "MER", <BarChart3 size={18} />,
              formatROAS(ecom.mer),
              "roas",
              [
                { name: "Revenue", value: ecom.revenue, formatted: formatCurrency(ecom.revenue, client.currency), color: "#22C55E" },
                { name: "Ad Spend", value: ecom.spend, formatted: formatCurrency(ecom.spend, client.currency), color: "#FF6A41" },
              ],
              "#3B82F6",
              (v) => `${v.toFixed(2)}x`,
            ))}
          />
          <KpiCard loading={windsorLoading}
            title="AOV"
            value={formatCurrency(ecom.aov, client.currency)}
            delta={0}
            icon={<Package size={12} />}
            tooltip="Average Order Value — revenue divided by number of orders"
            sparkline={sparklines.aov}
            accentColor="#8B5CF6"
            onClick={() => setKpiDetail(buildKpiDetail(
              "AOV", <Package size={18} />,
              formatCurrency(ecom.aov, client.currency),
              "aov",
              revenueBreakdown,
              "#8B5CF6",
              (v) => formatCurrency(v, client.currency),
            ))}
          />
          <KpiCard loading={windsorLoading}
            title="CPA"
            value={formatCurrency(ecom.cpa, client.currency)}
            delta={0}
            icon={<Target size={12} />}
            tooltip="Cost Per Acquisition — spend divided by conversions"
            sparkline={sparklines.cpa}
            accentColor="#F59E0B"
            onClick={() => setKpiDetail(buildKpiDetail(
              "CPA", <Target size={18} />,
              formatCurrency(ecom.cpa, client.currency),
              "cpa",
              [
                { name: "Meta Ads", value: metaConversions > 0 ? metaSpend / metaConversions : 0, formatted: formatCurrency(metaConversions > 0 ? metaSpend / metaConversions : 0, client.currency), color: "#3B82F6" },
                { name: "Google Ads", value: googleConversions > 0 ? googleSpend / googleConversions : 0, formatted: formatCurrency(googleConversions > 0 ? googleSpend / googleConversions : 0, client.currency), color: "#22C55E" },
              ],
              "#F59E0B",
              (v) => formatCurrency(v, client.currency),
            ))}
          />
          <KpiCard loading={windsorLoading}
            title="Conversions"
            value={formatNumber(ecom.conversions)}
            delta={0}
            icon={<ShoppingCart size={12} />}
            tooltip="Total purchases / conversion actions"
            sparkline={sparklines.conversions}
            accentColor="#EC4899"
            onClick={() => setKpiDetail(buildKpiDetail(
              "Conversions", <ShoppingCart size={18} />,
              formatNumber(ecom.conversions),
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
          {/* Platform Spend */}
          <div className="bg-[#12121A] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4">
            <h2 className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
              Platform Spend
            </h2>

            {/* Stacked bar */}
            <div className="h-3 rounded-full overflow-hidden flex">
              <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${metaPct}%` }} />
              <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${googlePct}%` }} />
            </div>

            {/* Platform rows */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MetaIcon size={18} />
                  <span className="text-sm font-medium text-white">Meta Ads</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-[#94A3B8]">{metaPct.toFixed(0)}%</span>
                  <span className="text-sm font-bold text-white min-w-[90px] text-right">
                    {formatCurrency(metaSpend, client.currency)}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GoogleIcon size={18} />
                  <span className="text-sm font-medium text-white">Google Ads</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-[#94A3B8]">{googlePct.toFixed(0)}%</span>
                  <span className="text-sm font-bold text-white min-w-[90px] text-right">
                    {formatCurrency(googleSpend, client.currency)}
                  </span>
                </div>
              </div>
            </div>

            {/* Platform ROAS comparison */}
            <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
              <span className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-semibold">Total</span>
              <span className="text-sm font-bold">{formatCurrency(ecom.spend, client.currency)}</span>
            </div>
          </div>

          {/* Budget Pacing — independent of date range filter */}
          <div className="bg-[#12121A] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4">
            <h2 className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
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

        {/* ── Platform Performance Cards ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5">
          {/* Meta */}
          <div className="bg-[#12121A] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2">
              <MetaIcon size={18} />
              <h3 className="text-sm font-semibold text-white">Meta Ads</h3>
              <span className="text-xs text-[#94A3B8] ml-auto">
                {ecom.spend > 0 ? ((metaSpend / ecom.spend) * 100).toFixed(0) : 0}% of spend
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider mb-0.5">Spend</p>
                <p className="text-lg font-bold">{formatCurrency(metaSpend, client.currency)}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider mb-0.5">ROAS</p>
                <p className="text-lg font-bold">{formatROAS(metaSpend > 0 ? metaRevenue / metaSpend : 0)}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider mb-0.5">Revenue</p>
                <p className="text-sm font-semibold">{formatCurrency(metaRevenue, client.currency)}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider mb-0.5">Conversions</p>
                <p className="text-sm font-semibold">{formatNumber(metaConversions)}</p>
              </div>
            </div>
          </div>

          {/* Google */}
          <div className="bg-[#12121A] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2">
              <GoogleIcon size={18} />
              <h3 className="text-sm font-semibold text-white">Google Ads</h3>
              <span className="text-xs text-[#94A3B8] ml-auto">
                {ecom.spend > 0 ? ((googleSpend / ecom.spend) * 100).toFixed(0) : 0}% of spend
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider mb-0.5">Spend</p>
                <p className="text-lg font-bold">{formatCurrency(googleSpend, client.currency)}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider mb-0.5">ROAS</p>
                <p className="text-lg font-bold">{formatROAS(googleSpend > 0 ? googleRevenue / googleSpend : 0)}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider mb-0.5">Revenue</p>
                <p className="text-sm font-semibold">{formatCurrency(googleRevenue, client.currency)}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider mb-0.5">Conversions</p>
                <p className="text-sm font-semibold">{formatNumber(googleConversions)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Trend Charts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5">
          {/* Spend vs Revenue */}
          <div className="bg-[#12121A] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4">
            <h2 className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
              Spend vs Revenue
            </h2>
            <div className="h-[200px] sm:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={1}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fill: "#94A3B8", fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "#94A3B8", fontSize: 9 }} tickLine={false} axisLine={false} width={45} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#12121A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: 11 }}
                    labelStyle={{ color: "#94A3B8" }}
                    formatter={(val: unknown) => [formatCurrency(Number(val ?? 0), client.currency)]}
                  />
                  <Legend wrapperStyle={{ fontSize: 10, color: "#94A3B8" }} />
                  <Bar dataKey="spend" name="Spend" fill="#FF6A41" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="revenue" name="Revenue" fill="#22C55E" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ROAS Trend */}
          <div className="bg-[#12121A] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4">
            <h2 className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
              ROAS Trend
            </h2>
            <div className="h-[200px] sm:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="ecomRoasGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF6A41" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#FF6A41" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fill: "#94A3B8", fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "#94A3B8", fontSize: 9 }} tickLine={false} axisLine={false} width={35} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#12121A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: 11 }}
                    labelStyle={{ color: "#94A3B8" }}
                    formatter={(val: unknown) => [`${Number(val ?? 0).toFixed(2)}x`, "ROAS"]}
                  />
                  <Area type="monotone" dataKey="roas" stroke="#FF6A41" fill="url(#ecomRoasGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── Top Campaigns Table ── */}
        <section className="bg-[#12121A] border border-white/[0.06] rounded-xl sm:rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/[0.08]">
            <h2 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider">
              Top Campaigns by Revenue
            </h2>
          </div>
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="text-left p-3 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                    Campaign
                  </th>
                  <th className="text-center p-3 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                    Platform
                  </th>
                  <th className="text-right p-3 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                    Spend
                  </th>
                  <th className="text-right p-3 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                    Revenue
                  </th>
                  <th className="text-right p-3 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                    ROAS
                  </th>
                  <th className="text-right p-3 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                    Conv.
                  </th>
                </tr>
              </thead>
              <tbody>
                {topCampaigns.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="p-3 font-medium text-white truncate max-w-[250px]">
                      {c.name}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase",
                          c.platform === "meta"
                            ? "bg-blue-500/20 text-blue-400"
                            : "bg-emerald-500/20 text-emerald-400",
                        )}
                      >
                        {c.platform === "meta" ? <MetaIcon className="w-3 h-3" /> : <GoogleIcon className="w-3 h-3" />}
                        {c.platform}
                      </span>
                    </td>
                    <td className="p-3 text-right text-[#94A3B8] tabular-nums">
                      {formatCurrency(c.spend, client.currency)}
                    </td>
                    <td className="p-3 text-right font-medium tabular-nums">
                      {formatCurrency(c.revenue, client.currency)}
                    </td>
                    <td className="p-3 text-right font-medium tabular-nums">
                      {formatROAS(c.roas)}
                    </td>
                    <td className="p-3 text-right text-[#94A3B8] tabular-nums">
                      {formatNumber(c.conversions)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden p-3 space-y-2">
            {topCampaigns.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-white truncate flex-1 min-w-0">
                    {c.name}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase flex-shrink-0",
                      c.platform === "meta"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-emerald-500/20 text-emerald-400",
                    )}
                  >
                    {c.platform === "meta" ? <MetaIcon className="w-3 h-3" /> : <GoogleIcon className="w-3 h-3" />}
                    {c.platform}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.04]">
                  <MetricCell label="Spend" value={formatCurrency(c.spend, client.currency)} />
                  <MetricCell label="Rev" value={formatCurrency(c.revenue, client.currency)} emphasis />
                  <MetricCell label="ROAS" value={formatROAS(c.roas)} emphasis />
                  <MetricCell label="Conv" value={formatNumber(c.conversions)} />
                </div>
              </div>
            ))}
          </div>
        </section>
        </DataBlur>
      </div>

      {/* ── KPI Detail Modal ── */}
      <KpiDetailModal data={kpiDetail} onClose={closeKpiDetail} />
    </>
  );
}
