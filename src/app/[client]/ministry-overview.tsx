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
import type { HubSpotContact, WindsorRow } from "@/lib/windsor";
import { classifyPlatform, sumConversions, rowConversions } from "@/lib/windsor";
import { reconcileLeads, reconcileByCampaign } from "@/lib/leadReconciliation";
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
  getLeadTypeFromCampaign,
  type LeadTypeBreakdown,
} from "@/lib/ministry-config";
import {
  Users,
  TrendingDown,
} from "lucide-react";
import { getCurrencyIcon } from "@/components/ui/currency-icon";
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

  const daily: { date: string; spend: number; conversions: number; metaSpend: number; googleSpend: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const jitter = 0.7 + Math.random() * 0.6;
    const spendForDay = +(dailySpend * jitter).toFixed(2);
    daily.push({
      date: dateStr,
      spend: spendForDay,
      conversions: Math.round(dailyConversions * (0.6 + Math.random() * 0.8)),
      metaSpend: +(spendForDay * metaRatio).toFixed(2),
      googleSpend: +(spendForDay * (1 - metaRatio)).toFixed(2),
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
  // consistent with KPI totals (see rowConversions). Per-platform daily rows
  // feed the Meta/Google sparkline cards — no more spend*0.6 / spend*0.4 fakes.
  const useAllConvFallback = convSummary.usedGoogleAllFallback;
  const byDate: Record<string, { date: string; spend: number; conversions: number; metaSpend: number; googleSpend: number }> = {};
  for (const r of filtered) {
    if (!r.date) continue;
    if (!byDate[r.date]) byDate[r.date] = { date: r.date, spend: 0, conversions: 0, metaSpend: 0, googleSpend: 0 };
    const rowSpend = Number(r.spend) || 0;
    const platform = classifyPlatform(r.source);
    byDate[r.date].spend += rowSpend;
    if (platform === "meta") byDate[r.date].metaSpend += rowSpend;
    else if (platform === "google") byDate[r.date].googleSpend += rowSpend;
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
  // Currency is always pulled from client config — never hardcoded. Ministry
  // is GBP but this template may get reused for a non-UK coworking client.
  const currency = client?.currency ?? "GBP";

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

  // Previous period HubSpot data — needed to emit previous-period verified-lead
  // series into the drilldown modal.
  const { data: prevHubspotData } = useWindsor<HubSpotContact[]>({
    clientSlug,
    type: "hubspot",
    days,
    dateFrom: prevDateFrom,
    dateTo: prevDateTo,
  });

  // HubSpot confirmed leads for the same range. The headline metric is the
  // ad-verified subset (contacts we can cross-reference to a live campaign),
  // not the raw CRM total.
  const { data: hubspotData } = useWindsor<HubSpotContact[]>({
    clientSlug,
    type: "hubspot",
    days,
    ...(preset === "Custom" ? { dateFrom, dateTo } : {}),
  });

  const isLive = dataSource === "windsor" && windsorData && windsorData.length > 0;

  // Verified ad leads = HubSpot contacts cross-referenced to a live Windsor
  // campaign (hsa_cam / utm_campaign match, or Facebook Lead Ads form).
  const hubspotReconciliation = useMemo(
    () => reconcileLeads(hubspotData ?? [], windsorData ?? []),
    [hubspotData, windsorData],
  );
  const prevHubspotReconciliation = useMemo(
    () => reconcileLeads(prevHubspotData ?? [], prevWindsorData ?? []),
    [prevHubspotData, prevWindsorData],
  );
  const verifiedAdLeads = hubspotReconciliation.totalAdVerified;
  const prevVerifiedAdLeads = prevHubspotReconciliation.totalAdVerified;
  const hubspotTotal = hubspotReconciliation.totalHubSpotLeads;

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
    if (!prev) return { spend: 0, conversions: 0, cpl: 0, meta: 0, google: 0, verifiedLeads: 0, verifiedCpl: 0 };
    const prevCpl = prev.totalConversions > 0 ? prev.totalSpend / prev.totalConversions : 0;
    const currVerifiedCpl = verifiedAdLeads > 0 ? current.totalSpend / verifiedAdLeads : 0;
    const prevVerifiedCpl = prevVerifiedAdLeads > 0 ? prev.totalSpend / prevVerifiedAdLeads : 0;
    return {
      spend: pctChange(current.totalSpend, prev.totalSpend),
      conversions: pctChange(current.totalConversions, prev.totalConversions),
      cpl: pctChange(current.blendedCpl, prevCpl),
      meta: pctChange(current.metaSpend, prev.metaSpend),
      google: pctChange(current.googleSpend, prev.googleSpend),
      verifiedLeads: pctChange(verifiedAdLeads, prevVerifiedAdLeads),
      verifiedCpl: pctChange(currVerifiedCpl, prevVerifiedCpl),
    };
  }, [current, prev, verifiedAdLeads, prevVerifiedAdLeads]);

  // HubSpot-verified leads bucketed by createdate — lets the Verified Ad Leads
  // and Verified CPL cards show a real daily trend instead of a spend proxy.
  const verifiedByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of hubspotReconciliation.byDate) m.set(b.date, b.verified);
    return m;
  }, [hubspotReconciliation.byDate]);
  const prevVerifiedByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of prevHubspotReconciliation.byDate) m.set(b.date, b.verified);
    return m;
  }, [prevHubspotReconciliation.byDate]);

  // Chart data (current period) — each day carries spend, platform-claimed
  // conversions, verified-lead count, and computed CPL so any card can share
  // the series safely.
  const chartData = useMemo(() => {
    return current.daily.map((d) => {
      const verifiedLeads = verifiedByDate.get(d.date) ?? 0;
      const verifiedCpl = verifiedLeads > 0 ? d.spend / verifiedLeads : 0;
      return {
        ...d,
        date: fmtDate(d.date),
        verifiedLeads,
        verifiedCpl,
      };
    });
  }, [current.daily, fmtDate, verifiedByDate]);

  // Previous chart data, aligned 1:1 with current by index — used to draw the
  // "previous period" line inside the drilldown modal.
  const prevChartData = useMemo(() => {
    if (!prev || !("daily" in prev)) return null;
    const daily = prev.daily as typeof current.daily;
    return daily.map((d) => {
      const verifiedLeads = prevVerifiedByDate.get(d.date) ?? 0;
      const verifiedCpl = verifiedLeads > 0 ? d.spend / verifiedLeads : 0;
      return {
        ...d,
        date: fmtDate(d.date),
        verifiedLeads,
        verifiedCpl,
      };
    });
  }, [prev, current.daily, fmtDate, prevVerifiedByDate]);

  // Sparklines — per-platform series come from the real daily split computed
  // in aggregateWindsor (previously these were spend × 0.6 / × 0.4 fakes).
  // verifiedLeads + verifiedCpl are HubSpot-driven and replace the old
  // spend-proxy sparkline under the Verified cards.
  const sparklines = useMemo(() => ({
    spend: chartData.map((d) => ({ v: d.spend, label: d.date })),
    conversions: chartData.map((d) => ({ v: d.conversions, label: d.date })),
    metaSpend: chartData.map((d) => ({ v: d.metaSpend, label: d.date })),
    googleSpend: chartData.map((d) => ({ v: d.googleSpend, label: d.date })),
    verifiedLeads: chartData.map((d) => ({ v: d.verifiedLeads, label: d.date })),
    verifiedCpl: chartData.map((d) => ({ v: d.verifiedCpl, label: d.date })),
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

  // Lead-type drilldown modal
  const [drilldownLeadType, setDrilldownLeadType] = useState<string | null>(null);
  const closeDrilldown = useCallback(() => setDrilldownLeadType(null), []);

  // Per-campaign HubSpot reconciliation, used by the drilldown to cross-reference
  // CRM-verified leads onto each lead-type bucket.
  const campaignRecon = useMemo(
    () => reconcileByCampaign(hubspotData ?? [], windsorData ?? []),
    [hubspotData, windsorData],
  );

  const currentLabel = chartData.length > 0
    ? `${chartData[0].date} - ${chartData[chartData.length - 1].date}`
    : "Current period";

  const platformBreakdown = [
    { name: "Meta Ads", value: current.metaSpend, formatted: formatCurrency(current.metaSpend, currency), color: "#3B82F6" },
    { name: "Google Ads", value: current.googleSpend, formatted: formatCurrency(current.googleSpend, currency), color: "#22C55E" },
  ];

  const buildDetail = (
    title: string,
    icon: React.ReactNode,
    currentValue: string,
    dailyKey: "spend" | "conversions" | "verifiedLeads" | "verifiedCpl" | "metaSpend" | "googleSpend",
    breakdown: { name: string; value: number; formatted: string; color: string }[],
    accentColor: string,
    fmtFn?: (v: number) => string,
  ): KpiDetailData => ({
    title,
    icon,
    currentValue,
    currentLabel,
    // Align previous-period daily values 1:1 with current by index so the modal
    // can draw a comparison line. Shorter prev arrays get undefined for the
    // unmatched tail days, which the chart skips.
    dailyData: chartData.map((d, i) => ({
      date: d.date,
      current: d[dailyKey],
      previous: prevChartData ? prevChartData[i]?.[dailyKey] : undefined,
    })),
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
        {/* Untagged-enquiry data-quality banner. Fires when > 20% of HubSpot
            contacts land with no derivable enquiry type (explicit value,
            event name, URL path, or UTM campaign all failed). Usually means
            the GTM data-layer push is broken on some subset of forms. */}
        {hubspotTotal > 0 && hubspotReconciliation.untaggedRate > 0.2 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center mt-0.5">
              <span className="text-amber-400 text-sm font-bold">!</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-300">
                {Math.round(hubspotReconciliation.untaggedRate * 100)}% of leads have no enquiry type
              </p>
              <p className="text-[11px] text-amber-300/70 mt-0.5 leading-relaxed">
                {formatNumber(hubspotReconciliation.enquiryTagSources.untagged)} of {formatNumber(hubspotTotal)} contacts couldn&apos;t be tagged from the data layer, event name, landing URL, or UTM campaign. Lead-type breakdowns will under-count these. Check the GTM data-layer push on forms where the enquiry_type field is missing.
              </p>
            </div>
          </div>
        )}

        {/* ── SECTION 1: KPI Strip ──
            Team feedback: each card should state what it is, what the number
            means, and where it comes from. No bare numbers without a label.
            Order matches client brief: Spend → Platform → CPL → Meta → Google.
            HubSpot Confirmed is surfaced in its own detailed module below
            (Section 2 / CRM Reconciliation), not in the top strip — the six-
            card layout was cramming titles and clipping values. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <KpiCard loading={windsorLoading}
            title="Spend"
            value={formatCurrency(current.totalSpend, currency)}
            delta={deltas.spend}
            icon={getCurrencyIcon(currency, 12)}
            subLabel="Across Meta and Google"
            tooltip="Combined ad spend across Meta (Facebook/Instagram) and Google Ads for the selected date range."
            sparkline={sparklines.spend}
            accentColor={ACCENT}
            onClick={() => setKpiDetail(buildDetail(
              "Spend", getCurrencyIcon(currency, 18),
              formatCurrency(current.totalSpend, currency),
              "spend", platformBreakdown, ACCENT,
              (v) => formatCurrency(v, currency),
            ))}
          />
          <KpiCard loading={windsorLoading}
            attributionSource="platform-claimed"
            title="Platform Reported"
            value={formatNumber(current.totalConversions)}
            delta={deltas.conversions}
            icon={<Users size={12} />}
            subLabel="Counted by ad platforms"
            tooltip="Sum of conversions as reported by Meta and Google. Includes platform view-through conversions (Meta) and 30-day click windows (Google). These numbers will always be higher than HubSpot."
            sparkline={sparklines.conversions}
            accentColor={ACCENT}
            onClick={() => setKpiDetail(buildDetail(
              "Platform Reported", <Users size={18} />,
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
          <KpiCard loading={windsorLoading}
            title="CPL (Confirmed)"
            value={verifiedAdLeads > 0 ? formatCurrency(current.totalSpend / verifiedAdLeads, currency) : "—"}
            delta={deltas.verifiedCpl}
            invertDelta
            icon={<TrendingDown size={12} />}
            subLabel="Cost per HubSpot lead"
            tooltip="Total ad spend divided by HubSpot-confirmed paid leads. Excludes organic and direct leads from the denominator. This is the real cost per lead — the number we defend."
            sparkline={sparklines.verifiedCpl}
            accentColor={ACCENT}
            onClick={() => setKpiDetail(buildDetail(
              "CPL (Confirmed)", <TrendingDown size={18} />,
              verifiedAdLeads > 0 ? formatCurrency(current.totalSpend / verifiedAdLeads, currency) : formatCurrency(current.blendedCpl, currency),
              "verifiedCpl", platformBreakdown, ACCENT,
              (v) => formatCurrency(v, currency),
            ))}
          />
          <KpiCard loading={windsorLoading}
            title="Meta Spend"
            value={formatCurrency(current.metaSpend, currency)}
            delta={deltas.meta}
            icon={<MetaIcon size={12} />}
            subLabel="This period"
            tooltip="Facebook and Instagram ad spend only (Meta Ads Manager). Excludes Google and any other channel."
            sparkline={sparklines.metaSpend}
            accentColor={ACCENT}
            onClick={() => setKpiDetail(buildDetail(
              "Meta Spend", <MetaIcon size={18} />,
              formatCurrency(current.metaSpend, currency),
              "spend", platformBreakdown, ACCENT,
              (v) => formatCurrency(v, currency),
            ))}
          />
          <KpiCard loading={windsorLoading}
            title="Google Spend"
            value={formatCurrency(current.googleSpend, currency)}
            delta={deltas.google}
            icon={<GoogleIcon size={12} />}
            subLabel="This period"
            tooltip="Google Ads spend only (Search + Performance Max). Excludes Meta and any other channel."
            sparkline={sparklines.googleSpend}
            accentColor={ACCENT}
            onClick={() => setKpiDetail(buildDetail(
              "Google Spend", <GoogleIcon size={18} />,
              formatCurrency(current.googleSpend, currency),
              "spend", platformBreakdown, ACCENT,
              (v) => formatCurrency(v, currency),
            ))}
          />
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
                  {formatCurrency(current.totalSpend, currency)} of {formatCurrency(MONTHLY_BUDGET, currency)}
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
                <p className="text-sm font-semibold">{formatCurrency(current.totalSpend, currency)}</p>
              </div>
              <div>
                <p className="text-[9px] text-[#94A3B8] uppercase tracking-wider">Projected EOM</p>
                <p className="text-sm font-semibold">{formatCurrency(projectedEOM, currency)}</p>
              </div>
              <div>
                <p className="text-[9px] text-[#94A3B8] uppercase tracking-wider">Daily Avg</p>
                <p className="text-sm font-semibold">{formatCurrency(dailyAvgSpend, currency)}</p>
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
                  <span className="text-xs font-semibold">{formatCurrency(current.metaSpend, currency)}</span>
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
                <p className="text-[9px] text-[#94A3B8]/60">CPL: {current.metaConversions > 0 ? formatCurrency(current.metaSpend / current.metaConversions, currency) : "—"}</p>
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
                  <span className="text-xs font-semibold">{formatCurrency(current.googleSpend, currency)}</span>
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
                <p className="text-[9px] text-[#94A3B8]/60">CPL: {current.googleConversions > 0 ? formatCurrency(current.googleSpend / current.googleConversions, currency) : "—"}</p>
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
              // hasData gates the badge out of green when there are no leads
              // or no spend — prevents "Ahead of Target" appearing for an
              // empty bucket just because £0 ≤ targetMin.
              const hasData = convCount > 0 && (bd?.spend ?? 0) > 0;
              const status = getCplStatus(cpl, lt, hasData);
              const statusColors = CPL_STATUS_COLORS[status];

              return (
                <button
                  key={lt.id}
                  type="button"
                  onClick={() => setDrilldownLeadType(lt.id)}
                  className="text-left bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-2 hover:border-white/[0.14] hover:bg-white/[0.06] transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#C8A96E]/60"
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
                          CPL: {formatCurrency(cpl, currency)}
                        </span>
                      </div>
                    )}
                    {lt.targetCplMin !== null && lt.targetCplMax !== null && (
                      <p className="text-[10px] text-[#94A3B8]">
                        Target: {formatCurrency(lt.targetCplMin, currency)}–{formatCurrency(lt.targetCplMax, currency)}
                      </p>
                    )}
                    {bd?.campaigns && bd.campaigns.length > 0 && (
                      <p className="text-[9px] text-[#94A3B8]/40 truncate" title={bd.campaigns.join(", ")}>
                        {bd.campaigns.length} campaign{bd.campaigns.length > 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                </button>
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
                      ? formatCurrency(Number(val ?? 0), currency)
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

      {drilldownLeadType && (() => {
        const lt = LEAD_TYPES.find((x) => x.id === drilldownLeadType);
        if (!lt) return null;
        const bd = leadTypeBreakdown[lt.id];
        const cpl = bd?.cpl ?? 0;
        const hasData = (bd?.conversions ?? 0) > 0 && (bd?.spend ?? 0) > 0;
        const status = getCplStatus(cpl, lt, hasData);
        const statusColors = CPL_STATUS_COLORS[status];
        const campaignsForType = campaignRecon.filter(
          (c) => getLeadTypeFromCampaign(c.campaignName).id === lt.id,
        );
        const verifiedLeads = campaignsForType.reduce((s, c) => s + c.hubspotConfirmed, 0);
        const hsCpl = verifiedLeads > 0 ? (bd?.spend ?? 0) / verifiedLeads : 0;
        const enquiryRows = hubspotReconciliation.byEnquiryType.slice(0, 8);

        return (
          <div
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto"
            onClick={closeDrilldown}
          >
            <div
              className="bg-[#12121A] border border-white/[0.08] rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 sm:p-6 border-b border-white/[0.06] flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-bold text-white">{lt.label}</h2>
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider", statusColors.bg, statusColors.text)}>
                      {statusColors.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#94A3B8]">
                    Campaigns mapped to this lead type, cross-referenced with HubSpot verified leads.
                  </p>
                </div>
                <button type="button" onClick={closeDrilldown} className="text-[#94A3B8] hover:text-white text-sm">✕</button>
              </div>

              <div className="p-5 sm:p-6 space-y-5">
                {/* Headline KPIs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
                    <p className="text-[9px] text-[#94A3B8] uppercase tracking-wider">Spend</p>
                    <p className="text-base font-semibold">{formatCurrency(bd?.spend ?? 0, currency)}</p>
                  </div>
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
                    <p className="text-[9px] text-[#94A3B8] uppercase tracking-wider">Platform Leads</p>
                    <p className="text-base font-semibold">{formatNumber(bd?.conversions ?? 0)}</p>
                  </div>
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
                    <p className="text-[9px] text-[#94A3B8] uppercase tracking-wider">HS Verified</p>
                    <p className="text-base font-semibold" style={{ color: ACCENT }}>{formatNumber(verifiedLeads)}</p>
                  </div>
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
                    <p className="text-[9px] text-[#94A3B8] uppercase tracking-wider">CPL (platform / verified)</p>
                    <p className="text-base font-semibold">
                      {bd?.cpl ? formatCurrency(bd.cpl, currency) : "—"}
                      <span className="text-xs text-[#94A3B8]"> / </span>
                      <span style={{ color: ACCENT }}>{hsCpl > 0 ? formatCurrency(hsCpl, currency) : "—"}</span>
                    </p>
                    {lt.targetCplMin !== null && lt.targetCplMax !== null && (
                      <p className="text-[9px] text-[#94A3B8]/60 mt-0.5">
                        Target: {formatCurrency(lt.targetCplMin, currency)}–{formatCurrency(lt.targetCplMax, currency)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Campaigns table */}
                <div>
                  <h3 className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">
                    Campaigns in this bucket
                  </h3>
                  {campaignsForType.length === 0 ? (
                    <p className="text-xs text-[#94A3B8]">No campaigns matched this lead type.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-[9px] text-[#94A3B8] uppercase tracking-wider border-b border-white/[0.06]">
                            <th className="text-left p-2 font-semibold">Platform</th>
                            <th className="text-left p-2 font-semibold">Campaign</th>
                            <th className="text-right p-2 font-semibold">Spend</th>
                            <th className="text-right p-2 font-semibold">Platform Claimed</th>
                            <th className="text-right p-2 font-semibold" style={{ color: ACCENT }}>HS Verified</th>
                            <th className="text-right p-2 font-semibold">CPL (verified)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {campaignsForType.map((c) => (
                            <tr key={`${c.platform}-${c.campaignId ?? c.campaignName}`} className="border-b border-white/[0.03]">
                              <td className="p-2 uppercase text-[10px] text-[#94A3B8]">{c.platform}</td>
                              <td className="p-2 text-white">{c.campaignName}</td>
                              <td className="p-2 text-right">{formatCurrency(c.spend, currency)}</td>
                              <td className="p-2 text-right">{formatNumber(c.platformClaimed)}</td>
                              <td className="p-2 text-right" style={{ color: ACCENT }}>{formatNumber(c.hubspotConfirmed)}</td>
                              <td className="p-2 text-right">{c.confirmedCpl ? formatCurrency(c.confirmedCpl, currency) : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* HubSpot enquiry_type mix across the period (sanity: are CRM tags aligned with ad spend?) */}
                {enquiryRows.length > 0 && (
                  <div>
                    <h3 className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">
                      HubSpot enquiry_type mix (all leads, all lead types)
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-[9px] text-[#94A3B8] uppercase tracking-wider border-b border-white/[0.06]">
                            <th className="text-left p-2 font-semibold">Enquiry Type</th>
                            <th className="text-right p-2 font-semibold">Total</th>
                            <th className="text-right p-2 font-semibold" style={{ color: ACCENT }}>Verified</th>
                            <th className="text-right p-2 font-semibold">Heuristic Paid</th>
                            <th className="text-right p-2 font-semibold">Other</th>
                          </tr>
                        </thead>
                        <tbody>
                          {enquiryRows.map((r) => (
                            <tr key={r.enquiryType} className="border-b border-white/[0.03]">
                              <td className="p-2 text-white">{r.enquiryType}</td>
                              <td className="p-2 text-right">{formatNumber(r.total)}</td>
                              <td className="p-2 text-right" style={{ color: ACCENT }}>{formatNumber(r.verified)}</td>
                              <td className="p-2 text-right">{formatNumber(r.heuristicPaid)}</td>
                              <td className="p-2 text-right">{formatNumber(r.other)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[9px] text-[#94A3B8]/60 mt-1">
                      Use this to sanity-check campaign → lead-type mapping. If a lead-type card shows few leads
                      but the matching enquiry_type row is large, campaigns aren&apos;t named to pattern.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
