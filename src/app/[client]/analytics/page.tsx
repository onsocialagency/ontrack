"use client";

import { useMemo, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { KpiCard } from "@/components/ui/kpi-card";
import { KpiDetailModal, type KpiDetailData } from "@/components/ui/kpi-detail-modal";
import { useClient } from "@/lib/client-context";
import { useWindsor } from "@/lib/use-windsor";
import { useDateRange } from "@/lib/date-range-context";
import type { GA4Row } from "@/lib/windsor";
import { formatNumber, formatCurrency } from "@/lib/utils";
import { useLocale } from "@/lib/locale-context";
import { VenueTabs } from "@/components/layout/venue-tabs";
import {
  Users,
  MousePointerClick,
  Clock,
  ArrowUpDown,
  UserPlus,
  ShoppingCart,
  Percent,
  Layers,
  TrendingUp,
} from "lucide-react";
import { getCurrencyIcon } from "@/components/ui/currency-icon";

/* ── Helpers ── */

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "00:00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatPct(value: number): string {
  return `${value.toFixed(2)}%`;
}

/* ── Aggregation ── */

interface GA4Aggregated {
  sessions: number;
  users: number;
  newUsers: number;
  pageviews: number;
  bounceRate: number;
  avgSessionDuration: number;
  pagesPerSession: number;
  conversions: number;
  revenue: number;
  addToCarts: number;
  conversionRate: number;
  newUsersPct: number;
  addToCartRate: number;
  costPerSession: number;
  costPerAddToCart: number;
}

function aggregateGA4(rows: GA4Row[], totalAdSpend: number): GA4Aggregated {
  const sessions = rows.reduce((s, r) => s + r.sessions, 0);
  const users = rows.reduce((s, r) => s + r.users, 0);
  const newUsers = rows.reduce((s, r) => s + r.newUsers, 0);
  const pageviews = rows.reduce((s, r) => s + r.pageviews, 0);
  const conversions = rows.reduce((s, r) => s + r.conversions, 0);
  const revenue = rows.reduce((s, r) => s + r.revenue, 0);
  const addToCarts = rows.reduce((s, r) => s + r.addToCarts, 0);

  // Weighted averages for bounce rate and session duration
  const totalBounceWeighted = rows.reduce((s, r) => s + r.bounceRate * r.sessions, 0);
  const totalDurationWeighted = rows.reduce((s, r) => s + r.avgSessionDuration * r.sessions, 0);
  const bounceRate = sessions > 0 ? totalBounceWeighted / sessions : 0;
  const avgSessionDuration = sessions > 0 ? totalDurationWeighted / sessions : 0;
  const pagesPerSession = sessions > 0 ? pageviews / sessions : 0;
  const conversionRate = sessions > 0 ? (conversions / sessions) * 100 : 0;
  const newUsersPct = users > 0 ? (newUsers / users) * 100 : 0;
  const addToCartRate = sessions > 0 ? (addToCarts / sessions) * 100 : 0;
  const costPerSession = sessions > 0 ? totalAdSpend / sessions : 0;
  const costPerAddToCart = addToCarts > 0 ? totalAdSpend / addToCarts : 0;

  return {
    sessions,
    users,
    newUsers,
    pageviews,
    bounceRate,
    avgSessionDuration,
    pagesPerSession,
    conversions,
    revenue,
    addToCarts,
    conversionRate,
    newUsersPct,
    addToCartRate,
    costPerSession,
    costPerAddToCart,
  };
}

interface DailyGA4 {
  date: string;
  sessions: number;
  users: number;
  newUsers: number;
  pageviews: number;
  bounceRate: number;
  avgSessionDuration: number;
  pagesPerSession: number;
  conversions: number;
  revenue: number;
  addToCarts: number;
  conversionRate: number;
  newUsersPct: number;
  addToCartRate: number;
}

function aggregateGA4Daily(rows: GA4Row[], fmtDate: (iso: string) => string): DailyGA4[] {
  const byDate: Record<string, GA4Row[]> = {};
  for (const r of rows) {
    const d = r.date;
    if (!d) continue;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(r);
  }

  return Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayRows]) => {
      const sessions = dayRows.reduce((s, r) => s + r.sessions, 0);
      const users = dayRows.reduce((s, r) => s + r.users, 0);
      const newUsers = dayRows.reduce((s, r) => s + r.newUsers, 0);
      const pageviews = dayRows.reduce((s, r) => s + r.pageviews, 0);
      const conversions = dayRows.reduce((s, r) => s + r.conversions, 0);
      const revenue = dayRows.reduce((s, r) => s + r.revenue, 0);
      const addToCarts = dayRows.reduce((s, r) => s + r.addToCarts, 0);
      const totalBounce = dayRows.reduce((s, r) => s + r.bounceRate * r.sessions, 0);
      const totalDur = dayRows.reduce((s, r) => s + r.avgSessionDuration * r.sessions, 0);
      const bounceRate = sessions > 0 ? totalBounce / sessions : 0;
      const avgSessionDuration = sessions > 0 ? totalDur / sessions : 0;
      const pagesPerSession = sessions > 0 ? pageviews / sessions : 0;
      const conversionRate = sessions > 0 ? (conversions / sessions) * 100 : 0;
      const newUsersPct = users > 0 ? (newUsers / users) * 100 : 0;
      const addToCartRate = sessions > 0 ? (addToCarts / sessions) * 100 : 0;

      return {
        date: fmtDate(date),
        sessions,
        users,
        newUsers,
        pageviews,
        bounceRate,
        avgSessionDuration,
        pagesPerSession,
        conversions,
        revenue,
        addToCarts,
        conversionRate,
        newUsersPct,
        addToCartRate,
      };
    });
}

/* ── Mock GA4 data (used when GA4 isn't connected via Windsor) ── */

function generateMockGA4(numDays: number): GA4Row[] {
  const rows: GA4Row[] = [];
  const now = new Date();
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    // Realistic daily ranges with some variance
    const base = 0.8 + Math.random() * 0.4; // 0.8-1.2 multiplier
    const sessions = Math.round(7000 * base + Math.random() * 1000);
    const users = Math.round(sessions * (0.78 + Math.random() * 0.06));
    const newUsers = Math.round(users * (0.78 + Math.random() * 0.08));
    const pageviews = Math.round(sessions * (2.0 + Math.random() * 0.4));
    const bounceRate = 60 + Math.random() * 12;
    const avgSessionDuration = 110 + Math.random() * 40;
    const conversions = Math.round(sessions * (0.012 + Math.random() * 0.006));
    const revenue = conversions * (120 + Math.random() * 80);
    const addToCarts = Math.round(sessions * (0.028 + Math.random() * 0.01));
    rows.push({
      date: dateStr,
      sessions,
      users,
      newUsers,
      pageviews,
      bounceRate,
      avgSessionDuration,
      pagesPerSession: sessions > 0 ? pageviews / sessions : 0,
      conversions,
      revenue,
      addToCarts,
    });
  }
  return rows;
}

/* ── Page ── */

export default function AnalyticsPage() {
  const { client: clientSlug } = useParams<{ client: string }>();
  const isIrg = clientSlug === "irg";
  const { days, preset, dateFrom, dateTo } = useDateRange();
  const { shortDate: fmtDate } = useLocale();
  const customDateProps = preset === "Custom" ? { dateFrom, dateTo } : {};
  const ctx = useClient();
  const client = ctx?.clientConfig;

  // Fetch GA4 data
  const { data: ga4Data, source: dataSource, loading } = useWindsor<GA4Row[]>({
    clientSlug,
    type: "ga4",
    days,
    ...customDateProps,
  });

  // Also fetch ad spend for cost metrics
  const { data: adData } = useWindsor<{ spend: number }[]>({
    clientSlug,
    type: "campaigns",
    days,
    ...customDateProps,
  });

  const isLive = dataSource === "windsor" && ga4Data && ga4Data.length > 0;

  // Use live GA4 data if available, otherwise generate mock data
  const effectiveData = useMemo(() => {
    if (isLive) return ga4Data;
    return generateMockGA4(days);
  }, [isLive, ga4Data, days]);

  const totalAdSpend = useMemo(() => {
    if (!adData) return client?.monthlyBudget || 10000;
    return adData.reduce((s, r) => s + (Number(r.spend) || 0), 0);
  }, [adData, client?.monthlyBudget]);

  // Aggregate
  const kpis = useMemo(() => {
    return aggregateGA4(effectiveData, totalAdSpend);
  }, [effectiveData, totalAdSpend]);

  const dailyData = useMemo(() => {
    return aggregateGA4Daily(effectiveData, fmtDate);
  }, [effectiveData]);

  // Sparklines
  const sparklines = useMemo(() => {
    if (!dailyData.length) return null;
    return {
      conversionRate: dailyData.map((d) => ({ v: d.conversionRate, label: d.date })),
      users: dailyData.map((d) => ({ v: d.users, label: d.date })),
      sessions: dailyData.map((d) => ({ v: d.sessions, label: d.date })),
      pagesPerSession: dailyData.map((d) => ({ v: d.pagesPerSession, label: d.date })),
      sessionDuration: dailyData.map((d) => ({ v: d.avgSessionDuration, label: d.date })),
      bounceRate: dailyData.map((d) => ({ v: d.bounceRate, label: d.date })),
      newUsers: dailyData.map((d) => ({ v: d.newUsers, label: d.date })),
      newUsersPct: dailyData.map((d) => ({ v: d.newUsersPct, label: d.date })),
      addToCarts: dailyData.map((d) => ({ v: d.addToCarts, label: d.date })),
      addToCartRate: dailyData.map((d) => ({ v: d.addToCartRate, label: d.date })),
      costPerAddToCart: dailyData.map((d) => ({ v: d.addToCarts > 0 ? totalAdSpend / dailyData.length / d.addToCarts : 0, label: d.date })),
      costPerSession: dailyData.map((d) => ({ v: d.sessions > 0 ? totalAdSpend / dailyData.length / d.sessions : 0, label: d.date })),
    };
  }, [dailyData, totalAdSpend]);

  const [kpiDetail, setKpiDetail] = useState<KpiDetailData | null>(null);
  const closeKpiDetail = useCallback(() => setKpiDetail(null), []);

  function buildDetail(
    title: string,
    icon: React.ReactNode,
    currentValue: string,
    dataKey: keyof DailyGA4,
    accentColor: string,
    formatValue?: (v: number) => string,
  ): KpiDetailData {
    return {
      title,
      icon,
      currentValue,
      currentLabel: `Last ${days} days`,
      dailyData: dailyData.map((d) => ({ date: d.date, current: d[dataKey] as number })),
      breakdown: [],
      accentColor,
      formatValue,
    };
  }

  if (!client) return null;

  return (
    <>
      <Header title="Web Analytics" dataBadge={{ loading, isLive: !!isLive }} filterRow={isIrg ? <VenueTabs /> : undefined} />

      <div className="flex-1 p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-5 overflow-y-auto">

        {kpis && sparklines && (
          <>
            {/* ── All 12 KPI cards in a responsive grid ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <KpiCard loading={loading}
                title="Conversion Rate"
                value={formatPct(kpis.conversionRate)}
                delta={0}
                icon={<TrendingUp size={12} />}
                tooltip="Sessions that resulted in a conversion"
                sparkline={sparklines.conversionRate}
                accentColor="#22C55E"
                onClick={() => setKpiDetail(buildDetail("Conversion Rate", <TrendingUp size={18} />, formatPct(kpis.conversionRate), "conversionRate", "#22C55E", (v) => formatPct(v)))}
              />
              <KpiCard loading={loading}
                title="Users"
                value={formatNumber(kpis.users)}
                delta={0}
                icon={<Users size={12} />}
                tooltip="Total unique users in the period"
                sparkline={sparklines.users}
                accentColor="#3B82F6"
                onClick={() => setKpiDetail(buildDetail("Users", <Users size={18} />, formatNumber(kpis.users), "users", "#3B82F6", (v) => formatNumber(v)))}
              />
              <KpiCard loading={loading}
                title="Sessions"
                value={formatNumber(kpis.sessions)}
                delta={0}
                icon={<MousePointerClick size={12} />}
                tooltip="Total sessions (visits) in the period"
                sparkline={sparklines.sessions}
                accentColor="#FF6A41"
                onClick={() => setKpiDetail(buildDetail("Sessions", <MousePointerClick size={18} />, formatNumber(kpis.sessions), "sessions", "#FF6A41", (v) => formatNumber(v)))}
              />
              <KpiCard loading={loading}
                title="Pages per Session"
                value={kpis.pagesPerSession.toFixed(2)}
                delta={0}
                icon={<Layers size={12} />}
                tooltip="Average number of pages viewed per session"
                sparkline={sparklines.pagesPerSession}
                accentColor="#8B5CF6"
                onClick={() => setKpiDetail(buildDetail("Pages per Session", <Layers size={18} />, kpis.pagesPerSession.toFixed(2), "pagesPerSession", "#8B5CF6", (v) => v.toFixed(2)))}
              />
              <KpiCard loading={loading}
                title="Session Duration"
                value={formatDuration(kpis.avgSessionDuration)}
                delta={0}
                icon={<Clock size={12} />}
                tooltip="Average time spent per session"
                sparkline={sparklines.sessionDuration}
                accentColor="#F59E0B"
                onClick={() => setKpiDetail(buildDetail("Session Duration", <Clock size={18} />, formatDuration(kpis.avgSessionDuration), "avgSessionDuration", "#F59E0B", (v) => formatDuration(v)))}
              />
              <KpiCard loading={loading}
                title="Bounce Rate"
                value={formatPct(kpis.bounceRate)}
                delta={0}
                icon={<ArrowUpDown size={12} />}
                tooltip="Percentage of single-page sessions"
                sparkline={sparklines.bounceRate}
                accentColor="#06B6D4"
                invertDelta
                onClick={() => setKpiDetail(buildDetail("Bounce Rate", <ArrowUpDown size={18} />, formatPct(kpis.bounceRate), "bounceRate", "#06B6D4", (v) => formatPct(v)))}
              />
              <KpiCard loading={loading}
                title="New Users"
                value={formatNumber(kpis.newUsers)}
                delta={0}
                icon={<UserPlus size={12} />}
                tooltip="First-time visitors in the period"
                sparkline={sparklines.newUsers}
                accentColor="#EC4899"
                onClick={() => setKpiDetail(buildDetail("New Users", <UserPlus size={18} />, formatNumber(kpis.newUsers), "newUsers", "#EC4899", (v) => formatNumber(v)))}
              />
              <KpiCard loading={loading}
                title="New Users %"
                value={formatPct(kpis.newUsersPct)}
                delta={0}
                icon={<Percent size={12} />}
                tooltip="Percentage of users who are new visitors"
                sparkline={sparklines.newUsersPct}
                accentColor="#22C55E"
                onClick={() => setKpiDetail(buildDetail("New Users %", <Percent size={18} />, formatPct(kpis.newUsersPct), "newUsersPct", "#22C55E", (v) => formatPct(v)))}
              />
              <KpiCard loading={loading}
                title="Sessions with Add to Carts"
                value={formatNumber(kpis.addToCarts)}
                delta={0}
                icon={<ShoppingCart size={12} />}
                tooltip="Number of add-to-cart events"
                sparkline={sparklines.addToCarts}
                accentColor="#FF6A41"
                onClick={() => setKpiDetail(buildDetail("Add to Carts", <ShoppingCart size={18} />, formatNumber(kpis.addToCarts), "addToCarts", "#FF6A41", (v) => formatNumber(v)))}
              />
              <KpiCard loading={loading}
                title="Add to Cart %"
                value={formatPct(kpis.addToCartRate)}
                delta={0}
                icon={<ShoppingCart size={12} />}
                tooltip="Percentage of sessions with an add-to-cart event"
                sparkline={sparklines.addToCartRate}
                accentColor="#3B82F6"
                onClick={() => setKpiDetail(buildDetail("Add to Cart %", <ShoppingCart size={18} />, formatPct(kpis.addToCartRate), "addToCartRate", "#3B82F6", (v) => formatPct(v)))}
              />
              <KpiCard loading={loading}
                title="Cost per Add to Cart"
                value={formatCurrency(kpis.costPerAddToCart, client.currency)}
                delta={0}
                icon={getCurrencyIcon(client.currency, 12)}
                tooltip="Total ad spend divided by add-to-cart events"
                sparkline={sparklines.costPerAddToCart}
                accentColor="#F59E0B"
                invertDelta
                onClick={() => setKpiDetail(buildDetail("Cost per Add to Cart", getCurrencyIcon(client.currency, 18), formatCurrency(kpis.costPerAddToCart, client.currency), "addToCartRate", "#F59E0B", (v) => formatCurrency(v, client.currency)))}
              />
              <KpiCard loading={loading}
                title="Cost per Session"
                value={formatCurrency(kpis.costPerSession, client.currency)}
                delta={0}
                icon={getCurrencyIcon(client.currency, 12)}
                tooltip="Total ad spend divided by total sessions"
                sparkline={sparklines.costPerSession}
                accentColor="#8B5CF6"
                invertDelta
                onClick={() => setKpiDetail(buildDetail("Cost per Session", getCurrencyIcon(client.currency, 18), formatCurrency(kpis.costPerSession, client.currency), "sessions", "#8B5CF6", (v) => formatCurrency(v, client.currency)))}
              />
            </div>
          </>
        )}
      </div>

      <KpiDetailModal data={kpiDetail} onClose={closeKpiDetail} />
    </>
  );
}
