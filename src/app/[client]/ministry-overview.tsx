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
import { formatCurrency, formatNumber, cn, getBillingPeriod } from "@/lib/utils";
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
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

/* ── Constants ── */

const ACCENT = MINISTRY_BRAND.accentColor; // #C8A96E

/* ── Lead type display order ── */

// Display order: Club + Day Pass on the left (cheapest, highest volume),
// then desk products, then office. General Enquiry is the catch-all and
// stays at the end so it never visually outranks a tracked product.
const LEAD_TYPE_ORDER = [
  "club",
  "day_pass",
  "meeting_room",
  "private_office",
  "dedicated_desk",
  "hot_desk",
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

  // Mock lead type breakdown matching volume ranges from config.
  // Club + Day Pass were previously combined; mock now splits them in roughly
  // the proportion The Ministry's real campaigns have shown historically
  // (Day Pass is the cheaper, higher-volume top-of-funnel product).
  const mockLeadTypes: Record<string, { conversions: number; spend: number }> = {
    club: { conversions: 28, spend: 420 },
    day_pass: { conversions: 27, spend: 130 },
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

  // Budget pacing — driven by the contract billing period (Ministry's
  // contract renews on the 29th of each month, so a calendar-month split
  // misreports days-elapsed every cycle). getBillingPeriod() handles the
  // edge case where a 29-start month rolls into February.
  const billingPeriod = getBillingPeriod(client?.billingStartDay ?? 1);
  const daysInMonth = billingPeriod.daysInPeriod;
  const dayOfMonth = billingPeriod.daysElapsed;
  const daysRemaining = billingPeriod.daysRemaining;
  const dailyAvgSpend = dayOfMonth > 0 ? current.totalSpend / dayOfMonth : 0;
  const projectedEOM = dailyAvgSpend * daysInMonth;
  // Allow >100% so the bar visually exceeds when overspending; the card
  // header still flips to amber via projectedOnTrack so the user notices.
  const pacingPctRaw = MONTHLY_BUDGET > 0 ? (current.totalSpend / MONTHLY_BUDGET) * 100 : 0;
  const pacingPct = Math.min(pacingPctRaw, 100);
  // "On track" = projected end-of-period spend will roughly hit (not blow
  // through) the budget. Treat ±10% as on track; outside that we're either
  // underspending (likely losing reach) or overspending (cap risk).
  const projectedOnTrack = projectedEOM >= MONTHLY_BUDGET * 0.9 && projectedEOM <= MONTHLY_BUDGET * 1.1;

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
  // Daily-performance chart series toggle. Default "all" shows the
  // composite (bars + line + tooltip CPL). The user can collapse to a
  // single series when they want to read one number cleanly without the
  // other distracting them.
  const [chartSeries, setChartSeries] = useState<"all" | "spend" | "leads" | "cpl">("all");
  const closeDrilldown = useCallback(() => setDrilldownLeadType(null), []);

  // Per-campaign HubSpot reconciliation, used by the drilldown to cross-reference
  // CRM-verified leads onto each lead-type bucket.
  const campaignRecon = useMemo(
    () => reconcileByCampaign(hubspotData ?? [], windsorData ?? []),
    [hubspotData, windsorData],
  );

  // HubSpot-confirmed counts and confirmed CPL per product, derived by
  // re-grouping campaignRecon rows through the same campaign-name → lead-type
  // pattern matcher used elsewhere. Spend stays as the per-product Windsor
  // spend (leadTypeBreakdown[id].spend) so confirmed CPL = product spend ÷
  // verified contacts on that product. When the windsor data is missing
  // we fall back gracefully to an empty bucket so the card shows "No Data"
  // rather than NaN.
  const verifiedByLeadType = useMemo(() => {
    const result: Record<string, { verified: number; confirmedCpl: number }> = {};
    for (const lt of LEAD_TYPES) {
      result[lt.id] = { verified: 0, confirmedCpl: 0 };
    }
    for (const row of campaignRecon) {
      const lt = getLeadTypeFromCampaign(row.campaignName);
      result[lt.id].verified += row.hubspotConfirmed ?? 0;
    }
    for (const lt of LEAD_TYPES) {
      const verified = result[lt.id].verified;
      const spend = current.leadTypeBreakdown[lt.id]?.spend ?? 0;
      result[lt.id].confirmedCpl = verified > 0 ? +(spend / verified).toFixed(2) : 0;
    }
    return result;
  }, [campaignRecon, current.leadTypeBreakdown]);

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
            Hero row: four cards the client looks at first.
              1. Spend — total across Meta + Google for the selected window
              2. HubSpot Confirmed Leads — paid-source contacts only (the
                 number we defend in WBR / MBR)
              3. CPL Confirmed — Spend ÷ HubSpot Confirmed; the efficiency
                 number that actually answers "are we doing a good job?"
              4. Budget Pacing — % of monthly budget used in the *contract*
                 billing period (Ministry renews on the 29th, not the 1st)
            Sub-row directly below: Meta Spend / Google Spend so the client
            can see the platform split without opening another tab.
            Platform-Reported was removed from the strip — it lives as a
            comparison column in CRM Reconciliation and reading it next to
            HubSpot Confirmed at the top was making us look bad. */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
            attributionSource="crm-verified"
            title="HubSpot Confirmed Leads"
            value={formatNumber(verifiedAdLeads)}
            delta={deltas.verifiedLeads}
            icon={<Users size={12} />}
            subLabel="Paid source only"
            tooltip="Leads in HubSpot that we can prove came from a paid ad — matched via GTM event ID, fbclid/gclid, Facebook Lead Ads event, hsa_cam, or paid UTMs. Excludes organic and direct contacts. This is the source of truth."
            sparkline={sparklines.verifiedLeads}
            accentColor="#22C55E"
            onClick={() => setKpiDetail(buildDetail(
              "HubSpot Confirmed Leads", <Users size={18} />,
              formatNumber(verifiedAdLeads),
              "verifiedLeads",
              [
                { name: "Verified (campaign match)", value: verifiedAdLeads, formatted: formatNumber(verifiedAdLeads), color: "#22C55E" },
                { name: "Heuristic paid (no join)", value: hubspotReconciliation.totalHeuristicPaid, formatted: formatNumber(hubspotReconciliation.totalHeuristicPaid), color: "#F59E0B" },
                { name: "Other (organic / direct / email)", value: Math.max(hubspotTotal - verifiedAdLeads - hubspotReconciliation.totalHeuristicPaid, 0), formatted: formatNumber(Math.max(hubspotTotal - verifiedAdLeads - hubspotReconciliation.totalHeuristicPaid, 0)), color: "#64748B" },
              ],
              "#22C55E",
              (v) => formatNumber(v),
            ))}
          />
          <KpiCard loading={windsorLoading}
            title="CPL Confirmed"
            value={verifiedAdLeads > 0 ? formatCurrency(current.totalSpend / verifiedAdLeads, currency) : "—"}
            delta={deltas.verifiedCpl}
            invertDelta
            icon={<TrendingDown size={12} />}
            subLabel="Spend ÷ HubSpot confirmed"
            tooltip="Total ad spend divided by HubSpot-confirmed paid leads. Excludes organic and direct leads from the denominator. This is the real cost per lead — the number we defend."
            sparkline={sparklines.verifiedCpl}
            accentColor={ACCENT}
            onClick={() => setKpiDetail(buildDetail(
              "CPL Confirmed", <TrendingDown size={18} />,
              verifiedAdLeads > 0 ? formatCurrency(current.totalSpend / verifiedAdLeads, currency) : formatCurrency(current.blendedCpl, currency),
              "verifiedCpl", platformBreakdown, ACCENT,
              (v) => formatCurrency(v, currency),
            ))}
          />
          {/* Budget Pacing — uses the contract billing period (29th–28th
              for Ministry) so % used reflects the cycle we actually invoice
              against, not the calendar month. The deeper pacing module
              with daily-avg and projected-EOM lives below. */}
          <KpiCard loading={windsorLoading}
            title="Budget Pacing"
            value={`${pacingPctRaw.toFixed(0)}%`}
            delta={0}
            icon={<TrendingDown size={12} />}
            subLabel={`${formatCurrency(current.totalSpend, currency)} of ${formatCurrency(MONTHLY_BUDGET, currency)} · ${daysRemaining}d left`}
            tooltip={`Spend so far in the current billing period (${billingPeriod.label}) as a share of the monthly budget. Ministry's billing cycle starts on day ${client?.billingStartDay ?? 1} of each month.`}
            accentColor={projectedOnTrack ? "#22C55E" : pacingPctRaw > 110 ? "#EF4444" : "#F59E0B"}
          />
        </div>

        {/* Sub-row: Meta + Google split — directly under the hero strip
            so the client can see "where did the spend go" without
            navigating away. Compact size keeps these visually secondary
            to the four hero cards above. */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <KpiCard loading={windsorLoading}
            size="compact"
            title="Meta Spend"
            value={formatCurrency(current.metaSpend, currency)}
            delta={deltas.meta}
            icon={<MetaIcon size={12} />}
            subLabel="Facebook + Instagram"
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
            size="compact"
            title="Google Spend"
            value={formatCurrency(current.googleSpend, currency)}
            delta={deltas.google}
            icon={<GoogleIcon size={12} />}
            subLabel="Search + Performance Max"
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

        {/* ── SECTION 3: Lead Type Performance Grid ──
            Six product cards: Club, Day Pass, Meeting Room, Private Office,
            Dedicated Desk, Hot Desk. The "General Enquiry" bucket is left
            out of this grid — it's a catch-all for un-mapped events and the
            client doesn't run a campaign called "general", so giving it a
            card next to the real products inflates the visual surface and
            usually shows red where it's actually just untagged data. The
            general bucket still exists in LEAD_TYPES so the reconciler can
            land unknown contacts somewhere; it's just not rendered here.

            Each card shows:
              - HubSpot Confirmed lead count (the source of truth)
              - CPL Confirmed = product Windsor spend ÷ verified contacts
              - Status badge driven by CPL vs target range
              - Platform-claimed count as muted secondary text so the team
                can still see the over-attribution gap at a glance */}
        <div>
          <h2 className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">
            Lead Type Performance
          </h2>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {orderedLeadTypes
              .filter((lt) => lt.id !== "general")
              .map((lt) => {
                const bd = leadTypeBreakdown[lt.id];
                const verified = verifiedByLeadType[lt.id]?.verified ?? 0;
                const confirmedCpl = verifiedByLeadType[lt.id]?.confirmedCpl ?? 0;
                const platformCount = bd?.conversions ?? 0;
                // CPL Confirmed drives the status badge — that's the number
                // we defend, not the platform-claimed CPL.
                const hasData = verified > 0 && (bd?.spend ?? 0) > 0;
                const status = getCplStatus(confirmedCpl, lt, hasData);
                const statusColors = CPL_STATUS_COLORS[status];

                return (
                  <button
                    key={lt.id}
                    type="button"
                    onClick={() => setDrilldownLeadType(lt.id)}
                    className="text-left bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-2 hover:border-white/[0.14] hover:bg-white/[0.06] transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#C8A96E]/60"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-white">{lt.label}</h3>
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap",
                          statusColors.bg,
                          statusColors.text,
                        )}
                      >
                        {statusColors.label}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div>
                        <span className="text-xl font-bold">{formatNumber(verified)}</span>
                        <p className="text-[9px] text-[#94A3B8]/60">HubSpot confirmed leads</p>
                      </div>
                      {hasData ? (
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-semibold" style={{ color: ACCENT }}>
                            CPL: {formatCurrency(confirmedCpl, currency)}
                          </span>
                        </div>
                      ) : (
                        <p className="text-sm font-semibold text-[#64748B]">CPL: —</p>
                      )}
                      {lt.targetCplMin !== null && lt.targetCplMax !== null && (
                        <p className="text-[10px] text-[#94A3B8]">
                          Target: {formatCurrency(lt.targetCplMin, currency)}–{formatCurrency(lt.targetCplMax, currency)}
                        </p>
                      )}
                      {platformCount > 0 && (
                        <p className="text-[9px] text-[#94A3B8]/40">
                          Platform claimed: {formatNumber(platformCount)}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
          </div>
        </div>

        {/* ── SECTION 4: Daily Performance Chart ──
            Rebuilt from "Spend & Conversions" dual-area to a spend-bars +
            leads-line composite. Reasons:
              1. "Conversions" was ambiguous for a lead-gen client — it's
                 the wrong word. We sell leads, not a conversion event with
                 a fixed value. Renamed to "Leads" throughout.
              2. The previous chart hid CPL, which is the number that
                 actually tells us whether we're doing a good or bad job.
                 CPL now shows prominently in the tooltip and as the right
                 axis scale when leads exist.
              3. Spend as bars makes the daily volume obvious at a glance;
                 leads as a line lets you see the delivery rhythm without
                 competing for the same area fill.
            Verified (HubSpot-confirmed) leads are preferred; we fall back
            to platform-reported only on days HubSpot has no data, and the
            tooltip labels which source it's using. */}
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                Daily Performance — Spend, Leads & CPL
              </h2>
              <p className="text-[11px] text-[#64748B] mt-0.5">
                {chartSeries === "all" && "Bars = daily spend. Line = HubSpot-confirmed leads. Hover for cost per lead."}
                {chartSeries === "spend" && "Daily ad spend across Meta and Google."}
                {chartSeries === "leads" && "HubSpot-confirmed leads per day (paid source only)."}
                {chartSeries === "cpl" && "Cost per HubSpot-confirmed lead. Lower is better."}
              </p>
            </div>
            {/* Series toggle — pill group. Single source of truth for which
                series the chart renders below; everything else (axes,
                colours, legend) keys off chartSeries. */}
            <div className="inline-flex items-center bg-white/[0.04] border border-white/[0.06] rounded-lg p-0.5 text-[10px] font-semibold">
              {([
                { id: "all", label: "All" },
                { id: "spend", label: "Spend" },
                { id: "leads", label: "Leads" },
                { id: "cpl", label: "CPL" },
              ] as const).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setChartSeries(opt.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-md transition-colors uppercase tracking-wider",
                    chartSeries === opt.id
                      ? "bg-white/[0.08] text-white"
                      : "text-[#94A3B8] hover:text-white",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[200px] sm:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#94A3B8", fontSize: 9 }}
                  tickLine={false}
                  axisLine={false}
                />
                {/* Left axis is currency for "all" / "spend" / "cpl"; we
                    suppress it entirely on the leads-only view so the
                    chart isn't dominated by a £-prefixed scale that has
                    nothing to do with what's being drawn. */}
                {chartSeries !== "leads" && (
                  <YAxis
                    yAxisId="left"
                    tick={{ fill: "#94A3B8", fontSize: 9 }}
                    tickLine={false}
                    axisLine={false}
                    width={54}
                    tickFormatter={(v) => formatCurrency(Number(v), currency).replace(/\.00$/, "")}
                  />
                )}
                {/* Right axis is the lead count, shown when leads are
                    visible (in "all" or "leads" mode). */}
                {(chartSeries === "all" || chartSeries === "leads") && (
                  <YAxis
                    yAxisId="right"
                    orientation={chartSeries === "leads" ? "left" : "right"}
                    tick={{ fill: "#94A3B8", fontSize: 9 }}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                    allowDecimals={false}
                  />
                )}
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  contentStyle={{
                    backgroundColor: "#12121A",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    fontSize: 11,
                    padding: "8px 10px",
                  }}
                  labelStyle={{ color: "#94A3B8", fontWeight: 600, marginBottom: 4 }}
                  // Custom formatter — we inject a derived CPL row so readers
                  // always see the efficiency number, not just spend / leads
                  // in isolation.
                  formatter={(val: unknown, name: unknown, entry: { payload?: { spend?: number; verifiedLeads?: number } }) => {
                    if (name === "spend") {
                      return [formatCurrency(Number(val ?? 0), currency), "Spend"];
                    }
                    if (name === "verifiedLeads") {
                      const leads = Number(val ?? 0);
                      const spend = Number(entry?.payload?.spend ?? 0);
                      const cpl = leads > 0 ? spend / leads : 0;
                      return [
                        `${formatNumber(leads)}${leads > 0 ? `  ·  CPL ${formatCurrency(cpl, currency)}` : ""}`,
                        "Leads (HubSpot)",
                      ];
                    }
                    if (name === "verifiedCpl") {
                      const cpl = Number(val ?? 0);
                      return [cpl > 0 ? formatCurrency(cpl, currency) : "—", "CPL"];
                    }
                    return [String(val), String(name)];
                  }}
                />
                {/* Spend bars — visible in "all" and "spend" modes. */}
                {(chartSeries === "all" || chartSeries === "spend") && (
                  <Bar
                    yAxisId="left"
                    dataKey="spend"
                    fill={ACCENT}
                    fillOpacity={0.55}
                    radius={[3, 3, 0, 0]}
                    name="spend"
                    maxBarSize={chartSeries === "spend" ? 40 : 28}
                  />
                )}
                {/* Leads line — visible in "all" and "leads" modes. */}
                {(chartSeries === "all" || chartSeries === "leads") && (
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="verifiedLeads"
                    stroke="#22C55E"
                    strokeWidth={2.25}
                    dot={{ r: 2.5, fill: "#22C55E", stroke: "#12121A", strokeWidth: 1 }}
                    activeDot={{ r: 4, fill: "#22C55E", stroke: "#12121A", strokeWidth: 2 }}
                    name="verifiedLeads"
                  />
                )}
                {/* CPL line — only in CPL-only mode. Drawn against the left
                    £ axis so the scale auto-fits the cost range; the bars
                    are hidden in this mode so the line owns the canvas. */}
                {chartSeries === "cpl" && (
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="verifiedCpl"
                    stroke={ACCENT}
                    strokeWidth={2.25}
                    dot={{ r: 2.5, fill: ACCENT, stroke: "#12121A", strokeWidth: 1 }}
                    activeDot={{ r: 4, fill: ACCENT, stroke: "#12121A", strokeWidth: 2 }}
                    name="verifiedCpl"
                    connectNulls
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
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
