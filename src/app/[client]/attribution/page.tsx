"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useParams, useRouter, useSearchParams, usePathname } from "next/navigation";
import { Header } from "@/components/layout/header";
import { KpiCard } from "@/components/ui/kpi-card";
import { Tooltip } from "@/components/ui/tooltip";
import { getClientKPIs, getClientCampaigns } from "@/lib/mock-data";
import { useClient } from "@/lib/client-context";
import { useWindsor } from "@/lib/use-windsor";
import { useDateRange } from "@/lib/date-range-context";
import type { WindsorRow } from "@/lib/windsor";
import {
  runAttribution,
  MODEL_NAMES,
  MODEL_LABELS,
  MODEL_DESCRIPTIONS,
} from "@/lib/attribution";
import type { ModelName } from "@/lib/attribution";
import { useAttribution } from "@/lib/attribution-context";
import { useVenue } from "@/lib/venue-context";
import { VenueTabs } from "@/components/layout/venue-tabs";
import { assignIrgBrand } from "@/lib/irg-brands";
import { KpiDetailModal, type KpiDetailData } from "@/components/ui/kpi-detail-modal";
import { formatCurrency, formatROAS, formatNumber, cn } from "@/lib/utils";
import type { CampaignRow } from "@/lib/types";
import { MetaIcon, GoogleIcon } from "@/components/ui/platform-icons";
import {
  TrendingUp,
  BarChart3,
  ChevronRight,
  ChevronDown,
  Download,
  Circle,
  Info,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";

/* ── Constants ── */

const PLATFORM_OPTIONS = [
  { value: "all", label: "All" },
  { value: "meta", label: "Meta" },
  { value: "google", label: "Google" },
];

type SortKey =
  | "name"
  | "spend"
  | "impressions"
  | "clicks"
  | "ctr"
  | "cpc"
  | "cpm"
  | "conversions"
  | "adjConversions"
  | "cpa"
  | "roas";

/* ── Campaign status detection ── */

function getCampaignStatus(rows: WindsorRow[], campaignName: string): "live" | "paused" | "ended" {
  const campaignRows = rows.filter((r) => r.campaign === campaignName);
  if (campaignRows.length === 0) return "ended";

  // Sort by date descending
  const sorted = [...campaignRows].sort((a, b) => b.date.localeCompare(a.date));
  const latestDate = sorted[0]?.date;
  if (!latestDate) return "ended";

  // Check if campaign has recent data (within last 3 days)
  const today = new Date();
  const latest = new Date(latestDate);
  const daysDiff = Math.floor((today.getTime() - latest.getTime()) / (1000 * 60 * 60 * 24));

  // Check if spending in last 3 days
  const recentRows = sorted.filter((r) => {
    const d = new Date(r.date);
    return Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)) <= 3;
  });

  const recentSpend = recentRows.reduce((s, r) => s + (Number(r.spend) || 0), 0);

  if (daysDiff <= 3 && recentSpend > 0) return "live";
  if (daysDiff <= 7) return "paused";
  return "ended";
}

const STATUS_COLORS = {
  live: "text-emerald-400",
  paused: "text-amber-400",
  ended: "text-red-400",
};

const STATUS_LABELS = {
  live: "Live",
  paused: "Paused",
  ended: "Ended",
};

/* ── Windsor data helpers ── */

interface LiveCampaign {
  id: string;
  name: string;
  platform: "meta" | "google";
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpa: number;
  roas: number;
  status: "live" | "paused" | "ended";
}

function aggregateWindsorCampaigns(rows: WindsorRow[]): LiveCampaign[] {
  const byKey: Record<string, LiveCampaign> = {};

  for (const r of rows) {
    const campaign = r.campaign || "Unknown";
    const key = `${r.source}::${campaign}`;
    if (!byKey[key]) {
      const platform = r.source === "facebook" ? "meta" : "google";
      byKey[key] = {
        id: key,
        name: campaign,
        platform: platform as "meta" | "google",
        spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0,
        ctr: 0, cpc: 0, cpm: 0, cpa: 0, roas: 0,
        status: getCampaignStatus(rows, campaign),
      };
    }
    const c = byKey[key];
    c.spend += Number(r.spend) || 0;
    c.impressions += Number(r.impressions) || 0;
    c.clicks += Number(r.clicks) || 0;
    c.conversions += Number(r.conversions) || 0;
    c.revenue += Number(r.revenue) || 0;
  }

  return Object.values(byKey).map((c) => ({
    ...c,
    ctr: c.impressions > 0 ? +((c.clicks / c.impressions) * 100).toFixed(2) : 0,
    cpc: c.clicks > 0 ? +(c.spend / c.clicks).toFixed(2) : 0,
    cpm: c.impressions > 0 ? +((c.spend / c.impressions) * 1000).toFixed(2) : 0,
    cpa: c.conversions > 0 ? +(c.spend / c.conversions).toFixed(2) : 0,
    roas: c.spend > 0 ? +(c.revenue / c.spend).toFixed(2) : 0,
  }));
}

/* ── Ad Set / Ad aggregation for drill-down ── */

interface AdSetRow {
  id: string;
  name: string;
  platform: "meta" | "google";
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpa: number;
  roas: number;
}

function aggregateAdSets(rows: WindsorRow[], campaignName: string): AdSetRow[] {
  const filtered = rows.filter((r) => r.campaign === campaignName && r.adset);
  const byKey: Record<string, Omit<AdSetRow, "ctr" | "cpc" | "cpm" | "cpa" | "roas">> = {};

  for (const r of filtered) {
    const key = r.adset || "Unknown Ad Set";
    if (!byKey[key]) {
      byKey[key] = {
        id: key,
        name: key,
        platform: r.source === "facebook" ? "meta" : "google",
        spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0,
      };
    }
    byKey[key].spend += Number(r.spend) || 0;
    byKey[key].impressions += Number(r.impressions) || 0;
    byKey[key].clicks += Number(r.clicks) || 0;
    byKey[key].conversions += Number(r.conversions) || 0;
    byKey[key].revenue += Number(r.revenue) || 0;
  }

  return Object.values(byKey).map((c) => ({
    ...c,
    ctr: c.impressions > 0 ? +((c.clicks / c.impressions) * 100).toFixed(2) : 0,
    cpc: c.clicks > 0 ? +(c.spend / c.clicks).toFixed(2) : 0,
    cpm: c.impressions > 0 ? +((c.spend / c.impressions) * 1000).toFixed(2) : 0,
    cpa: c.conversions > 0 ? +(c.spend / c.conversions).toFixed(2) : 0,
    roas: c.spend > 0 ? +(c.revenue / c.spend).toFixed(2) : 0,
  }));
}

function aggregateAds(rows: WindsorRow[], campaignName: string, adSetName?: string): AdSetRow[] {
  let filtered = rows.filter((r) => r.campaign === campaignName && r.ad_name);
  if (adSetName) {
    filtered = filtered.filter((r) => r.adset === adSetName);
  }
  const byKey: Record<string, Omit<AdSetRow, "ctr" | "cpc" | "cpm" | "cpa" | "roas">> = {};

  for (const r of filtered) {
    const key = r.ad_name || "Unknown Ad";
    if (!byKey[key]) {
      byKey[key] = {
        id: r.ad_id || key,
        name: key,
        platform: r.source === "facebook" ? "meta" : "google",
        spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0,
      };
    }
    byKey[key].spend += Number(r.spend) || 0;
    byKey[key].impressions += Number(r.impressions) || 0;
    byKey[key].clicks += Number(r.clicks) || 0;
    byKey[key].conversions += Number(r.conversions) || 0;
    byKey[key].revenue += Number(r.revenue) || 0;
  }

  return Object.values(byKey).map((c) => ({
    ...c,
    ctr: c.impressions > 0 ? +((c.clicks / c.impressions) * 100).toFixed(2) : 0,
    cpc: c.clicks > 0 ? +(c.spend / c.clicks).toFixed(2) : 0,
    cpm: c.impressions > 0 ? +((c.spend / c.impressions) * 1000).toFixed(2) : 0,
    cpa: c.conversions > 0 ? +(c.spend / c.conversions).toFixed(2) : 0,
    roas: c.spend > 0 ? +(c.revenue / c.spend).toFixed(2) : 0,
  }));
}

/* ── CSV export ── */

function exportCSV(rows: (LiveCampaign | CampaignRow)[]) {
  const headers = [
    "Campaign", "Platform", "Spend", "Impressions", "Clicks",
    "CTR", "CPC", "CPM", "Conversions", "CPA", "ROAS",
  ];
  const csvRows = [headers.join(",")];

  for (const r of rows) {
    csvRows.push(
      [
        `"${r.name}"`, r.platform, r.spend.toFixed(2),
        r.impressions, r.clicks, r.ctr.toFixed(2) + "%",
        r.cpc.toFixed(2), r.cpm.toFixed(2), r.conversions,
        r.cpa.toFixed(2), r.roas.toFixed(2),
      ].join(","),
    );
  }

  const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "campaigns.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Page ── */

export default function AttributionPage() {
  const { client: clientSlug } = useParams<{ client: string }>();
  const router = useRouter();
  const { days, preset, dateFrom, dateTo } = useDateRange();
  const customDateProps = preset === "Custom" ? { dateFrom, dateTo } : {};
  const ctx = useClient();
  const clientOrNull = ctx?.clientConfig;
  const mockKpis = getClientKPIs(clientSlug, clientOrNull ?? undefined);
  const allMockCampaigns = getClientCampaigns(clientSlug, undefined, clientOrNull ?? undefined);

  // Fetch campaign-level data
  const { data: windsorData, source: dataSource, loading: windsorLoading } = useWindsor<WindsorRow[]>({
    clientSlug,
    type: "campaigns",
    days,
    ...customDateProps,
  });

  // Also fetch creative-level for drill-down
  const { data: creativeData } = useWindsor<WindsorRow[]>({
    clientSlug,
    type: "creatives",
    days,
    ...customDateProps,
  });

  const { activeModel, setActiveModel } = useAttribution();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Sync model from URL on mount
  useEffect(() => {
    const modelParam = searchParams.get("model") as ModelName | null;
    if (modelParam && MODEL_NAMES.includes(modelParam)) {
      setActiveModel(modelParam);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync model to URL when it changes — guard against loop
  useEffect(() => {
    if (searchParams.get("model") === activeModel) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("model", activeModel);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [activeModel, pathname, router, searchParams]);

  const { activeVenue } = useVenue();
  const isIrg = clientSlug === "irg";
  const [platform, setPlatform] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [expandedAdSets, setExpandedAdSets] = useState<Set<string>>(new Set());
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set(["meta", "google"]));
  const [kpiDetail, setKpiDetail] = useState<KpiDetailData | null>(null);
  const closeKpiDetail = useCallback(() => setKpiDetail(null), []);

  const isLive = dataSource === "windsor" && !!windsorData && windsorData.length > 0;

  // IRG venue filtering — filter Windsor rows to the selected venue
  const venueFilteredData = useMemo(() => {
    if (!isLive || !isIrg || activeVenue === "all") return windsorData;
    return windsorData!.filter((r) => {
      const accountId = r.account_id || r.account_name || "";
      const campaign = r.campaign || "";
      return assignIrgBrand(campaign, accountId) === activeVenue;
    });
  }, [isLive, isIrg, activeVenue, windsorData]);

  // Run attribution engine on live data
  const attribution = useMemo(() => {
    if (!isLive || !venueFilteredData?.length) return null;
    return runAttribution(venueFilteredData);
  }, [isLive, venueFilteredData]);

  // Aggregate Windsor data into campaign rows
  const liveCampaigns = useMemo(() => {
    if (!isLive || !venueFilteredData?.length) return [];
    return aggregateWindsorCampaigns(venueFilteredData);
  }, [isLive, venueFilteredData]);

  // Daily sparkline data for KPI cards
  const sparklines = useMemo(() => {
    if (!isLive || !venueFilteredData?.length) return null;

    // Group by date
    const byDate: Record<string, { spend: number; revenue: number; conversions: number }> = {};
    for (const r of venueFilteredData) {
      const d = r.date || "unknown";
      if (!byDate[d]) byDate[d] = { spend: 0, revenue: 0, conversions: 0 };
      byDate[d].spend += Number(r.spend) || 0;
      byDate[d].revenue += Number(r.revenue) || 0;
      byDate[d].conversions += Number(r.conversions) || 0;
    }

    const sorted = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        ...data,
        roas: data.spend > 0 ? data.revenue / data.spend : 0,
        cpa: data.conversions > 0 ? data.spend / data.conversions : 0,
        mer: data.spend > 0 ? data.revenue / data.spend : 0,
      }));

    return {
      revenue: sorted.map((d) => ({ v: d.revenue, label: d.date })),
      conversions: sorted.map((d) => ({ v: d.conversions, label: d.date })),
      roas: sorted.map((d) => ({ v: d.roas, label: d.date })),
      cpa: sorted.map((d) => ({ v: d.cpa, label: d.date })),
      mer: sorted.map((d) => ({ v: d.mer, label: d.date })),
    };
  }, [isLive, venueFilteredData]);

  // Model-adjusted conversion scaling factors per platform
  const adjustmentFactors = useMemo(() => {
    if (!attribution?.allResults) return { meta: 1, google: 1 };
    const modelResult = attribution.allResults.results[activeModel];
    if (!modelResult) return { meta: 1, google: 1 };

    const rawMeta = attribution.allResults.rawMetaConversions;
    const rawGoogle = attribution.allResults.rawGoogleConversions;

    return {
      meta: rawMeta > 0 ? modelResult.meta.conversions / rawMeta : 1,
      google: rawGoogle > 0 ? modelResult.google.conversions / rawGoogle : 1,
    };
  }, [attribution, activeModel]);

  /* ── Campaign table logic ── */

  const filtered = useMemo(() => {
    const rows = isLive ? liveCampaigns : allMockCampaigns.filter((c) => c.level === "campaign");
    let result = platform === "all" ? rows : rows.filter((c) => c.platform === (platform === "meta" ? "meta" : "google"));
    result = [...result].sort((a, b) => {
      if (sortKey === "adjConversions") {
        const aAdj = a.conversions * (a.platform === "meta" ? adjustmentFactors.meta : adjustmentFactors.google);
        const bAdj = b.conversions * (b.platform === "meta" ? adjustmentFactors.meta : adjustmentFactors.google);
        return sortAsc ? aAdj - bAdj : bAdj - aAdj;
      }
      const aVal = a[sortKey as keyof typeof a];
      const bVal = b[sortKey as keyof typeof b];
      if (typeof aVal === "string" && typeof bVal === "string")
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return sortAsc ? (Number(aVal) - Number(bVal)) : (Number(bVal) - Number(aVal));
    });
    return result;
  }, [isLive, liveCampaigns, allMockCampaigns, platform, sortKey, sortAsc, adjustmentFactors]);

  // Campaign totals
  const campaignTotals = useMemo(() => {
    const totalSpend = filtered.reduce((s, c) => s + c.spend, 0);
    const totalConv = filtered.reduce((s, c) => s + c.conversions, 0);
    const totalRev = filtered.reduce((s, c) => s + ("revenue" in c ? (c as LiveCampaign).revenue : c.spend * c.roas), 0);
    const avgRoas = totalSpend > 0 ? totalRev / totalSpend : 0;
    return { spend: totalSpend, conversions: totalConv, roas: avgRoas, count: filtered.length };
  }, [filtered]);

  // Get model-adjusted conversions for a row
  function getAdjustedConversions(row: LiveCampaign | CampaignRow | AdSetRow): number {
    const platform = row.platform === "meta" ? "meta" : "google";
    return +(row.conversions * adjustmentFactors[platform]).toFixed(1);
  }

  // Model-adjusted totals for footer
  const adjTotalConversions = useMemo(() => {
    return filtered.reduce((s, c) => s + getAdjustedConversions(c), 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, adjustmentFactors]);

  const toggleCampaign = useCallback((id: string) => {
    setExpandedCampaigns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAdSet = useCallback((id: string) => {
    setExpandedAdSets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) setSortAsc(!sortAsc);
      else { setSortKey(key); setSortAsc(false); }
    },
    [sortKey, sortAsc],
  );

  if (!clientOrNull) return <div className="p-8 text-[#94A3B8]">Client not found</div>;
  const client = clientOrNull;

  // Current model results
  const currentModel = attribution?.modelResults[activeModel] ?? null;

  // KPIs — driven by attribution model when live
  // Use de-duplicated figures to avoid double-counting when both platforms claim same conversions
  const totalConversions = attribution ? attribution.deduplicatedConversions : mockKpis.conversions;
  const totalRevenue = attribution ? attribution.totalRevenue : mockKpis.revenue;
  const totalSpend = attribution ? attribution.totalSpend : mockKpis.spend;
  const mer = attribution ? attribution.mer : mockKpis.mer;

  const modelBlendedRoas = currentModel?.blendedRoas ?? (totalSpend > 0 ? totalRevenue / totalSpend : 0);

  const metaSpend = attribution ? attribution.metaSpend : totalSpend * client.metaAllocation;
  const googleSpend = attribution ? attribution.googleSpend : totalSpend * client.googleAllocation;

  const isLeadGen = client.type === "lead_gen";

  function SortHeader({ label, colKey, tooltip }: { label: string; colKey: SortKey; tooltip?: string }) {
    const active = sortKey === colKey;
    return (
      <th
        onClick={() => handleSort(colKey)}
        className="p-3 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider cursor-pointer hover:text-white transition-colors text-right"
        title={tooltip}
      >
        <span className={active ? "text-[#FF6A41]" : ""}>
          {label}
          {active && (sortAsc ? " ↑" : " ↓")}
        </span>
      </th>
    );
  }

  // Render ad set rows for drill-down
  function renderAdSetRows(campaignName: string) {
    if (!creativeData || !isLive) return null;
    const adSets = aggregateAdSets(creativeData, campaignName);
    if (adSets.length === 0) {
      // If no ad set data, show ads directly
      const ads = aggregateAds(creativeData, campaignName);
      return ads.map((ad) => (
        <tr
          key={`ad-${ad.id}`}
          className="border-b border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
        >
          <td className="p-3">
            <div className="flex items-center gap-1" style={{ paddingLeft: "40px" }}>
              <span className="w-3.5 flex-shrink-0" />
              <button
                onClick={() => router.push(`/${clientSlug}/creative-lab?search=${encodeURIComponent(ad.name)}`)}
                className="text-xs text-[#94A3B8] hover:text-[#FF6A41] truncate transition-colors"
                title="View in Creative Lab"
              >
                {ad.name}
              </button>
            </div>
          </td>
          <td className="p-3 text-right text-xs text-[#94A3B8]">{formatCurrency(ad.spend, client.currency)}</td>
          <td className="p-3 text-right text-xs text-[#94A3B8]">{formatNumber(ad.impressions)}</td>
          <td className="p-3 text-right text-xs text-[#94A3B8]">{formatNumber(ad.clicks)}</td>
          <td className="p-3 text-right text-xs text-[#94A3B8]">{ad.ctr.toFixed(2)}%</td>
          <td className="p-3 text-right text-xs text-[#94A3B8]">{formatCurrency(ad.cpc, client.currency)}</td>
          <td className="p-3 text-right text-xs text-[#94A3B8]">{formatCurrency(ad.cpm, client.currency)}</td>
          <td className="p-3 text-right text-xs text-[#94A3B8]">{formatNumber(ad.conversions)}</td>
          <td className="p-3 text-right text-xs text-[#FF6A41]/70">{formatNumber(getAdjustedConversions(ad))}</td>
          <td className="p-3 text-right text-xs text-[#94A3B8]">{formatCurrency(ad.cpa, client.currency)}</td>
          <td className="p-3 text-right text-xs text-[#94A3B8]">{formatROAS(ad.roas)}</td>
        </tr>
      ));
    }

    return adSets.map((adSet) => {
      const isExpanded = expandedAdSets.has(adSet.id);
      const ads = isExpanded ? aggregateAds(creativeData, campaignName, adSet.name) : [];

      return (
        <React.Fragment key={`adset-${adSet.id}`}>
          <tr className="border-b border-white/[0.04] bg-white/[0.015] hover:bg-white/[0.04] transition-colors">
            <td className="p-3">
              <div
                className="flex items-center gap-1 cursor-pointer"
                style={{ paddingLeft: "20px" }}
                onClick={() => toggleAdSet(adSet.id)}
              >
                {isExpanded ? (
                  <ChevronDown size={12} className="text-[#94A3B8] flex-shrink-0" />
                ) : (
                  <ChevronRight size={12} className="text-[#94A3B8] flex-shrink-0" />
                )}
                <span className="text-xs text-[#94A3B8] truncate">{adSet.name}</span>
              </div>
            </td>
            <td className="p-3 text-right text-xs text-[#94A3B8]">{formatCurrency(adSet.spend, client.currency)}</td>
            <td className="p-3 text-right text-xs text-[#94A3B8]">{formatNumber(adSet.impressions)}</td>
            <td className="p-3 text-right text-xs text-[#94A3B8]">{formatNumber(adSet.clicks)}</td>
            <td className="p-3 text-right text-xs text-[#94A3B8]">{adSet.ctr.toFixed(2)}%</td>
            <td className="p-3 text-right text-xs text-[#94A3B8]">{formatCurrency(adSet.cpc, client.currency)}</td>
            <td className="p-3 text-right text-xs text-[#94A3B8]">{formatCurrency(adSet.cpm, client.currency)}</td>
            <td className="p-3 text-right text-xs text-[#94A3B8]">{formatNumber(adSet.conversions)}</td>
            <td className="p-3 text-right text-xs text-[#FF6A41]/70">{formatNumber(getAdjustedConversions(adSet))}</td>
            <td className="p-3 text-right text-xs text-[#94A3B8]">{formatCurrency(adSet.cpa, client.currency)}</td>
            <td className="p-3 text-right text-xs text-[#94A3B8]">{formatROAS(adSet.roas)}</td>
          </tr>
          {ads.map((ad) => (
            <tr
              key={`ad-${ad.id}`}
              className="border-b border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
            >
              <td className="p-3">
                <div className="flex items-center gap-1" style={{ paddingLeft: "40px" }}>
                  <span className="w-3.5 flex-shrink-0" />
                  <button
                    onClick={() => router.push(`/${clientSlug}/creative-lab?search=${encodeURIComponent(ad.name)}`)}
                    className="text-xs text-[#94A3B8] hover:text-[#FF6A41] truncate transition-colors"
                    title="View in Creative Lab"
                  >
                    {ad.name}
                  </button>
                </div>
              </td>
              <td className="p-3 text-right text-xs text-[#94A3B8]">{formatCurrency(ad.spend, client.currency)}</td>
              <td className="p-3 text-right text-xs text-[#94A3B8]">{formatNumber(ad.impressions)}</td>
              <td className="p-3 text-right text-xs text-[#94A3B8]">{formatNumber(ad.clicks)}</td>
              <td className="p-3 text-right text-xs text-[#94A3B8]">{ad.ctr.toFixed(2)}%</td>
              <td className="p-3 text-right text-xs text-[#94A3B8]">{formatCurrency(ad.cpc, client.currency)}</td>
              <td className="p-3 text-right text-xs text-[#94A3B8]">{formatCurrency(ad.cpm, client.currency)}</td>
              <td className="p-3 text-right text-xs text-[#94A3B8]">{formatNumber(ad.conversions)}</td>
              <td className="p-3 text-right text-xs text-[#FF6A41]/70">{formatNumber(getAdjustedConversions(ad))}</td>
              <td className="p-3 text-right text-xs text-[#94A3B8]">{formatCurrency(ad.cpa, client.currency)}</td>
              <td className="p-3 text-right text-xs text-[#94A3B8]">{formatROAS(ad.roas)}</td>
            </tr>
          ))}
        </React.Fragment>
      );
    });
  }

  function renderCampaignRow(row: LiveCampaign | CampaignRow) {
    const hasLiveExpand = isLive && creativeData;
    const isCampaignExpanded = expandedCampaigns.has(row.id);
    const hasChildren = !isLive && allMockCampaigns.some((c) => c.parentId === row.id);
    const mockChildren = isCampaignExpanded && !isLive ? allMockCampaigns.filter((c) => c.parentId === row.id) : [];

    const status = isLive && "status" in row ? (row as LiveCampaign).status : "live";

    return (
      <React.Fragment key={row.id}>
        <tr className={cn(
          "border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors",
        )}>
          <td className="p-3">
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => (hasLiveExpand || hasChildren) && toggleCampaign(row.id)}
            >
              {/* Status dot */}
              <Tooltip content={STATUS_LABELS[status]} side="right">
                <Circle
                  size={8}
                  className={cn("flex-shrink-0 fill-current", STATUS_COLORS[status])}
                />
              </Tooltip>

              {(hasLiveExpand || hasChildren) ? (
                isCampaignExpanded ? (
                  <ChevronDown size={14} className="text-[#94A3B8] flex-shrink-0" />
                ) : (
                  <ChevronRight size={14} className="text-[#94A3B8] flex-shrink-0" />
                )
              ) : (
                <span className="w-3.5 flex-shrink-0" />
              )}
              <span className="text-sm font-semibold text-white truncate">
                {row.name}
              </span>
              <span className={cn(
                "ml-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase",
                row.platform === "meta" ? "bg-blue-500/20 text-blue-400" : "bg-emerald-500/20 text-emerald-400",
              )}>
                {row.platform}
              </span>
            </div>
          </td>
          <td className="p-3 text-right text-sm font-medium">{formatCurrency(row.spend, client.currency)}</td>
          <td className="p-3 text-right text-sm text-[#94A3B8]">{formatNumber(row.impressions)}</td>
          <td className="p-3 text-right text-sm text-[#94A3B8]">{formatNumber(row.clicks)}</td>
          <td className="p-3 text-right text-sm text-[#94A3B8]">{row.ctr.toFixed(2)}%</td>
          <td className="p-3 text-right text-sm text-[#94A3B8]">{formatCurrency(row.cpc, client.currency)}</td>
          <td className="p-3 text-right text-sm text-[#94A3B8]">{formatCurrency(row.cpm, client.currency)}</td>
          <td className="p-3 text-right text-sm font-medium">{formatNumber(row.conversions)}</td>
          <td className="p-3 text-right text-sm font-medium text-[#FF6A41]">{formatNumber(getAdjustedConversions(row))}</td>
          <td className="p-3 text-right text-sm text-[#94A3B8]">{formatCurrency(row.cpa, client.currency)}</td>
          <td className="p-3 text-right text-sm font-medium">
            {isLeadGen && "cpl" in row && row.cpl !== undefined
              ? formatCurrency(row.cpl, client.currency)
              : formatROAS(row.roas)}
          </td>
        </tr>
        {/* Live drill-down: ad sets and ads */}
        {isCampaignExpanded && isLive && renderAdSetRows(row.name)}
        {/* Mock drill-down */}
        {mockChildren.map((child) => (
          <tr
            key={child.id}
            className="border-b border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] transition-colors"
          >
            <td className="p-3">
              <div className="flex items-center gap-1" style={{ paddingLeft: "28px" }}>
                <span className="w-3.5 flex-shrink-0" />
                <span className="text-xs text-[#94A3B8] truncate">{child.name}</span>
              </div>
            </td>
            <td className="p-3 text-right text-xs text-[#94A3B8]">{formatCurrency(child.spend, client.currency)}</td>
            <td className="p-3 text-right text-xs text-[#94A3B8]">{formatNumber(child.impressions)}</td>
            <td className="p-3 text-right text-xs text-[#94A3B8]">{formatNumber(child.clicks)}</td>
            <td className="p-3 text-right text-xs text-[#94A3B8]">{child.ctr.toFixed(2)}%</td>
            <td className="p-3 text-right text-xs text-[#94A3B8]">{formatCurrency(child.cpc, client.currency)}</td>
            <td className="p-3 text-right text-xs text-[#94A3B8]">{formatCurrency(child.cpm, client.currency)}</td>
            <td className="p-3 text-right text-xs text-[#94A3B8]">{formatNumber(child.conversions)}</td>
            <td className="p-3 text-right text-xs text-[#FF6A41]/70">{formatNumber(getAdjustedConversions(child as unknown as LiveCampaign))}</td>
            <td className="p-3 text-right text-xs text-[#94A3B8]">{formatCurrency(child.cpa, client.currency)}</td>
            <td className="p-3 text-right text-xs text-[#94A3B8]">{formatROAS(child.roas)}</td>
          </tr>
        ))}
      </React.Fragment>
    );
  }

  return (
    <>
      <Header title="Attribution & Campaigns" showAttribution dataBadge={{ loading: windsorLoading, isLive: !!isLive }} filterRow={isIrg ? <VenueTabs /> : undefined} />

      <div className="flex-1 p-3 sm:p-4 lg:p-6 overflow-y-auto">
        <div className="space-y-4 sm:space-y-5">

          {/* ── Top bar: Model description ── */}
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-[#94A3B8]">
              <span className="font-semibold text-white">{MODEL_LABELS[activeModel]}</span>
              {" — "}
              {MODEL_DESCRIPTIONS[activeModel]}
            </p>
          </div>

          {/* ── Transparency Banner ── */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg sm:rounded-xl p-3 flex items-start gap-2.5">
            <Info size={14} className="text-[#FF6A41] flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-[#94A3B8] leading-relaxed">
              Attribution models are calculated from Meta and Google platform data. Numbers reflect different ways of
              interpreting the same spend and conversion data — not independently tracked user journeys.
              MER is the only fully independent metric.
              {activeModel !== "lastClick" && (
                <span className="text-[#64748B] ml-1">
                  Platform totals are deduplicated using an industry-standard overlap factor.
                  Actual figures depend on your specific customer journey mix.
                </span>
              )}
            </p>
          </div>

          {/* ── KPI Grid — 4 metric cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <KpiCard
              title="Meta Conversions"
              value={formatNumber(currentModel ? currentModel.metaConversions : 0)}
              delta={0}
              icon={<MetaIcon size={12} />}
              tooltip="Conversions attributed to Meta Ads under the selected model"
              sparkline={sparklines?.conversions}
              accentColor="#3B82F6"
              onClick={() => setKpiDetail({
                title: "Meta Conversions", icon: <MetaIcon size={18} />, currentValue: formatNumber(currentModel ? currentModel.metaConversions : 0),
                currentLabel: `${MODEL_LABELS[activeModel]} model`, dailyData: sparklines?.conversions?.map((d) => ({ date: d.label || "", current: d.v })) || [],
                breakdown: [
                  { name: "Meta Spend", value: metaSpend, formatted: formatCurrency(metaSpend, client.currency), color: "#3B82F6" },
                  { name: "Meta ROAS", value: currentModel?.metaRoas ?? 0, formatted: formatROAS(currentModel?.metaRoas ?? 0), color: "#22C55E" },
                ],
                accentColor: "#3B82F6", formatValue: (v) => formatNumber(v),
              })}
            />
            <KpiCard
              title="Google Conversions"
              value={formatNumber(currentModel ? currentModel.googleConversions : 0)}
              delta={0}
              icon={<GoogleIcon size={12} />}
              tooltip="Conversions attributed to Google Ads under the selected model"
              sparkline={sparklines?.conversions}
              accentColor="#22C55E"
              onClick={() => setKpiDetail({
                title: "Google Conversions", icon: <GoogleIcon size={18} />, currentValue: formatNumber(currentModel ? currentModel.googleConversions : 0),
                currentLabel: `${MODEL_LABELS[activeModel]} model`, dailyData: sparklines?.conversions?.map((d) => ({ date: d.label || "", current: d.v })) || [],
                breakdown: [
                  { name: "Google Spend", value: googleSpend, formatted: formatCurrency(googleSpend, client.currency), color: "#22C55E" },
                  { name: "Google ROAS", value: currentModel?.googleRoas ?? 0, formatted: formatROAS(currentModel?.googleRoas ?? 0), color: "#3B82F6" },
                ],
                accentColor: "#22C55E", formatValue: (v) => formatNumber(v),
              })}
            />
            <KpiCard
              title="Blended ROAS"
              value={formatROAS(modelBlendedRoas)}
              delta={0}
              icon={<TrendingUp size={12} />}
              tooltip="Blended Return on Ad Spend under the selected attribution model"
              sparkline={sparklines?.roas}
              accentColor="#FF6A41"
              onClick={() => setKpiDetail({
                title: "Blended ROAS", icon: <TrendingUp size={18} />, currentValue: formatROAS(modelBlendedRoas),
                currentLabel: `${MODEL_LABELS[activeModel]} model`, dailyData: sparklines?.roas?.map((d) => ({ date: d.label || "", current: d.v })) || [],
                breakdown: [
                  { name: "Meta ROAS", value: currentModel?.metaRoas ?? 0, formatted: formatROAS(currentModel?.metaRoas ?? 0), color: "#3B82F6" },
                  { name: "Google ROAS", value: currentModel?.googleRoas ?? 0, formatted: formatROAS(currentModel?.googleRoas ?? 0), color: "#22C55E" },
                ],
                accentColor: "#FF6A41", formatValue: (v) => `${v.toFixed(2)}x`,
              })}
            />
            <KpiCard
              title="MER"
              value={formatROAS(mer)}
              delta={0}
              icon={<BarChart3 size={12} />}
              tooltip="Marketing Efficiency Ratio — total revenue / total spend. Attribution-independent — always fixed regardless of model."
              sparkline={sparklines?.mer}
              accentColor="#8B5CF6"
              prefix="Fixed"
              onClick={() => setKpiDetail({
                title: "MER", icon: <BarChart3 size={18} />, currentValue: formatROAS(mer),
                currentLabel: "Attribution-independent", dailyData: sparklines?.mer?.map((d) => ({ date: d.label || "", current: d.v })) || [],
                breakdown: [
                  { name: "Total Revenue", value: totalRevenue, formatted: formatCurrency(totalRevenue, client.currency), color: "#22C55E" },
                  { name: "Total Spend", value: totalSpend, formatted: formatCurrency(totalSpend, client.currency), color: "#FF6A41" },
                ],
                accentColor: "#8B5CF6", formatValue: (v) => `${v.toFixed(2)}x`,
              })}
            />
          </div>

          {/* ── Channel & Campaign Table (merged) ── */}
          {(() => {
            // Channel-level aggregations
            const metaRows2 = isLive ? (venueFilteredData || []).filter((r) => r.source === "facebook") : [];
            const googleRows2 = isLive ? (venueFilteredData || []).filter((r) => r.source !== "facebook") : [];
            const metaImpr = metaRows2.reduce((s, r) => s + (Number(r.impressions) || 0), 0);
            const googleImpr = googleRows2.reduce((s, r) => s + (Number(r.impressions) || 0), 0);
            const metaClicks = metaRows2.reduce((s, r) => s + (Number(r.clicks) || 0), 0);
            const googleClicks = googleRows2.reduce((s, r) => s + (Number(r.clicks) || 0), 0);
            const metaCampaigns = filtered.filter((c) => c.platform === "meta");
            const googleCampaigns = filtered.filter((c) => c.platform === "google");

            const allChannelRows = [
              {
                icon: <MetaIcon size={16} />,
                name: "Meta Ads",
                platform: "meta" as const,
                spend: metaSpend,
                roas: currentModel ? currentModel.metaRoas : 0,
                conversions: currentModel ? currentModel.metaConversions : 0,
                revenue: currentModel ? currentModel.metaRevenue : 0,
                impressions: metaImpr,
                clicks: metaClicks,
                campaigns: metaCampaigns,
              },
              {
                icon: <GoogleIcon size={16} />,
                name: "Google Ads",
                platform: "google" as const,
                spend: googleSpend,
                roas: currentModel ? currentModel.googleRoas : 0,
                conversions: currentModel ? currentModel.googleConversions : 0,
                revenue: currentModel ? currentModel.googleRevenue : 0,
                impressions: googleImpr,
                clicks: googleClicks,
                campaigns: googleCampaigns,
              },
            ];
            const channelRows = platform === "all" ? allChannelRows : allChannelRows.filter((ch) => ch.platform === platform);

            const toggleChannel = (p: string) => {
              setExpandedChannels((prev) => {
                const next = new Set(prev);
                if (next.has(p)) next.delete(p);
                else next.add(p);
                return next;
              });
            };

            return (
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-sm font-semibold text-white whitespace-nowrap">Channel & Campaign Breakdown</h2>
                    <div className="flex items-center gap-1 bg-white/[0.04] rounded-lg p-0.5">
                      {PLATFORM_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setPlatform(opt.value)}
                          className={cn(
                            "px-2.5 py-1 rounded-md text-[10px] font-medium transition-all",
                            platform === opt.value
                              ? "bg-[#FF6A41]/15 text-[#FF6A41] shadow-sm"
                              : "text-[#64748B] hover:text-[#94A3B8]",
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <div className="hidden md:flex items-center gap-3 text-[10px] text-[#94A3B8]">
                      <span className="flex items-center gap-1"><Circle size={6} className="fill-emerald-400 text-emerald-400" /> Live</span>
                      <span className="flex items-center gap-1"><Circle size={6} className="fill-amber-400 text-amber-400" /> Paused</span>
                      <span className="flex items-center gap-1"><Circle size={6} className="fill-red-400 text-red-400" /> Ended</span>
                    </div>
                  </div>
                  <button
                    onClick={() => exportCSV(filtered)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#FF6A41] text-white hover:bg-[#FF6A41]/90 transition-colors"
                  >
                    <Download size={12} />
                    Export CSV
                  </button>
                </div>

                <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[700px]">
                      <thead>
                        <tr className="border-b border-white/[0.08]">
                          <th className="text-left p-3 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider min-w-[240px]">Source / Campaign</th>
                          <SortHeader label="Spend" colKey="spend" tooltip="Total ad spend in period" />
                          <SortHeader label="Impr." colKey="impressions" tooltip="Total ad impressions" />
                          <SortHeader label="Clicks" colKey="clicks" tooltip="Total link clicks" />
                          <SortHeader label="CTR" colKey="ctr" tooltip="Click-through rate" />
                          <SortHeader label="CPC" colKey="cpc" tooltip="Cost per click" />
                          <SortHeader label="CPM" colKey="cpm" tooltip="Cost per 1,000 impressions" />
                          <SortHeader label="Conv." colKey="conversions" tooltip="Platform-reported conversions" />
                          <SortHeader label="Adj. Conv." colKey="adjConversions" tooltip={`Model-adjusted conversions (${MODEL_LABELS[activeModel]})`} />
                          <SortHeader label="CPA" colKey="cpa" tooltip="Cost per acquisition" />
                          <SortHeader label={isLeadGen ? "CPL" : "ROAS"} colKey="roas" tooltip={isLeadGen ? "Cost per lead" : "Return on ad spend"} />
                        </tr>
                      </thead>

                      {/* Channel rows with nested campaigns */}
                      {channelRows.map((ch) => {
                        const isExpanded = expandedChannels.has(ch.platform);
                        const chCtr = ch.impressions > 0 ? ((ch.clicks / ch.impressions) * 100) : 0;
                        const chCpc = ch.clicks > 0 ? ch.spend / ch.clicks : 0;
                        const chCpm = ch.impressions > 0 ? (ch.spend / ch.impressions) * 1000 : 0;
                        const chCpa = ch.conversions > 0 ? ch.spend / ch.conversions : 0;

                        return (
                          <tbody key={ch.platform}>
                            {/* Channel header row */}
                            <tr
                              className="border-b border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer"
                              onClick={() => toggleChannel(ch.platform)}
                            >
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  {isExpanded ? (
                                    <ChevronDown size={14} className="text-[#94A3B8] flex-shrink-0" />
                                  ) : (
                                    <ChevronRight size={14} className="text-[#94A3B8] flex-shrink-0" />
                                  )}
                                  {ch.icon}
                                  <span className="text-sm font-bold text-white">{ch.name}</span>
                                  <span className="text-[10px] text-[#64748B] ml-1">
                                    {ch.campaigns.length} campaigns
                                  </span>
                                </div>
                              </td>
                              <td className="p-3 text-right text-sm font-bold text-white">{formatCurrency(ch.spend, client.currency)}</td>
                              <td className="p-3 text-right text-sm text-[#94A3B8]">{formatNumber(ch.impressions)}</td>
                              <td className="p-3 text-right text-sm text-[#94A3B8]">{formatNumber(ch.clicks)}</td>
                              <td className="p-3 text-right text-sm text-[#94A3B8]">{chCtr.toFixed(2)}%</td>
                              <td className="p-3 text-right text-sm text-[#94A3B8]">{formatCurrency(chCpc, client.currency)}</td>
                              <td className="p-3 text-right text-sm text-[#94A3B8]">{formatCurrency(chCpm, client.currency)}</td>
                              <td className="p-3 text-right text-sm font-bold text-white">{formatNumber(ch.conversions)}</td>
                              <td className="p-3 text-right text-sm font-bold text-[#FF6A41]">{formatNumber(ch.conversions)}</td>
                              <td className="p-3 text-right text-sm text-[#94A3B8]">{chCpa > 0 ? formatCurrency(chCpa, client.currency) : "—"}</td>
                              <td className="p-3 text-right text-sm font-bold">
                                <span className={ch.roas >= 1 ? "text-emerald-400" : "text-red-400"}>
                                  {formatROAS(ch.roas)}
                                </span>
                              </td>
                            </tr>

                            {/* Nested campaign rows */}
                            {isExpanded && ch.campaigns.map((campaign) => renderCampaignRow(campaign))}
                          </tbody>
                        );
                      })}

                      {/* Footer totals */}
                      {filtered.length > 0 && (
                        <tfoot>
                          <tr className="border-t border-white/[0.12] bg-white/[0.03]">
                            <td className="p-3 text-sm font-bold text-white">Total ({campaignTotals.count} campaigns)</td>
                            <td className="p-3 text-right text-sm font-bold text-white">{formatCurrency(campaignTotals.spend, client.currency)}</td>
                            <td className="p-3 text-right text-sm text-[#94A3B8]">—</td>
                            <td className="p-3 text-right text-sm text-[#94A3B8]">—</td>
                            <td className="p-3 text-right text-sm text-[#94A3B8]">—</td>
                            <td className="p-3 text-right text-sm text-[#94A3B8]">—</td>
                            <td className="p-3 text-right text-sm text-[#94A3B8]">—</td>
                            <td className="p-3 text-right text-sm font-bold text-white">{formatNumber(campaignTotals.conversions)}</td>
                            <td className="p-3 text-right text-sm font-bold text-[#FF6A41]">{formatNumber(adjTotalConversions)}</td>
                            <td className="p-3 text-right text-sm text-[#94A3B8]">—</td>
                            <td className="p-3 text-right text-sm font-bold text-white">{formatROAS(campaignTotals.roas)}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── Donut Chart + Platform Details — 2 cards ── */}
          {currentModel && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5">
              {/* Donut: Conversion Credit Split */}
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-3">
                <h2 className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                  Conversion Credit Split — {MODEL_LABELS[activeModel]}
                </h2>
                <div className="h-[200px] sm:h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Meta", value: currentModel.metaConversions || 0.01 },
                          { name: "Google", value: currentModel.googleConversions || 0.01 },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                        isAnimationActive={false}
                      >
                        <Cell fill="#3B82F6" />
                        <Cell fill="#22C55E" />
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: "#12121A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: 11 }}
                        formatter={(val: unknown) => [formatNumber(Number(val ?? 0)), "Conversions"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Legend */}
                <div className="flex items-center justify-center gap-6 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-[#94A3B8]">Meta</span>
                    <span className="font-semibold text-white">
                      {totalConversions > 0
                        ? `${((currentModel.metaConversions / totalConversions) * 100).toFixed(0)}%`
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-[#94A3B8]">Google</span>
                    <span className="font-semibold text-white">
                      {totalConversions > 0
                        ? `${((currentModel.googleConversions / totalConversions) * 100).toFixed(0)}%`
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Platform Details */}
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-3">
                <h2 className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                  Platform Breakdown
                </h2>

                {/* Platform rows */}
                <div className="space-y-3">
                  {/* Meta */}
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                    <div className="flex items-center gap-2 mb-2">
                      <MetaIcon size={16} />
                      <span className="text-sm font-medium text-white">Meta Ads</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <p className="text-[9px] text-[#94A3B8] uppercase">Conv</p>
                        <p className="text-sm font-semibold">{formatNumber(currentModel.metaConversions)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-[#94A3B8] uppercase">Revenue</p>
                        <p className="text-sm font-semibold">{formatCurrency(currentModel.metaRevenue, client.currency)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-[#94A3B8] uppercase">Spend</p>
                        <p className="text-sm font-semibold">{formatCurrency(metaSpend, client.currency)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-[#94A3B8] uppercase">ROAS</p>
                        <p className="text-sm font-semibold text-blue-400">{formatROAS(currentModel.metaRoas)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Google */}
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                    <div className="flex items-center gap-2 mb-2">
                      <GoogleIcon size={16} />
                      <span className="text-sm font-medium text-white">Google Ads</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <p className="text-[9px] text-[#94A3B8] uppercase">Conv</p>
                        <p className="text-sm font-semibold">{formatNumber(currentModel.googleConversions)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-[#94A3B8] uppercase">Revenue</p>
                        <p className="text-sm font-semibold">{formatCurrency(currentModel.googleRevenue, client.currency)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-[#94A3B8] uppercase">Spend</p>
                        <p className="text-sm font-semibold">{formatCurrency(googleSpend, client.currency)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-[#94A3B8] uppercase">ROAS</p>
                        <p className="text-sm font-semibold text-emerald-400">{formatROAS(currentModel.googleRoas)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* MER row */}
                <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-semibold">MER</span>
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-semibold bg-[#FF6A41]/20 text-[#FF6A41]">
                      INDEPENDENT
                    </span>
                  </div>
                  <span className="text-lg font-bold text-[#FF6A41]">{formatROAS(mer)}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── All Models ROAS Comparison Bar Chart ── */}
          {attribution && (
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-3">
              <h2 className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                ROAS by Model — Meta vs Google
              </h2>
              <div className="h-[200px] sm:h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={MODEL_NAMES.map((model) => {
                      const r = attribution.modelResults[model];
                      return {
                        name: MODEL_LABELS[model],
                        Meta: r.metaRoas,
                        Google: r.googleRoas,
                      };
                    })}
                    barGap={2}
                    barCategoryGap="20%"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#94A3B8", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#94A3B8", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      width={35}
                      tickFormatter={(v) => `${v}x`}
                    />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: "#12121A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: 11 }}
                      formatter={(val: unknown) => [`${Number(val ?? 0).toFixed(2)}x`]}
                    />
                    <Legend wrapperStyle={{ fontSize: 10, color: "#94A3B8" }} />
                    <Bar dataKey="Meta" fill="#3B82F6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Google" fill="#22C55E" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>

      <KpiDetailModal data={kpiDetail} onClose={closeKpiDetail} />
    </>
  );
}
