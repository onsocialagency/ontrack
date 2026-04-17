"use client";

import { useMemo, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { PillToggle } from "@/components/ui/pill-toggle";
import { Tooltip } from "@/components/ui/tooltip";
import { useClient } from "@/lib/client-context";
import { useVenue } from "@/lib/venue-context";
import { useWindsor } from "@/lib/use-windsor";
import { useDateRange } from "@/lib/date-range-context";
import type { WindsorRow } from "@/lib/windsor";
import { formatCurrency, formatNumber, cn } from "@/lib/utils";
import {
  LEAD_TYPES,
  CHANNEL_ROLES,
  getChannelRole,
  getLeadTypeFromCampaign,
  MINISTRY_BRAND,
} from "@/lib/ministry-config";
import {
  ChevronRight,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Download,
  Info,
} from "lucide-react";
import Image from "next/image";
import { VenueTabs } from "@/components/layout/venue-tabs";
import { assignIrgBrand } from "@/lib/irg-brands";

/* ── Types ── */

interface AggregatedRow {
  campaign: string;
  source: string;
  adset?: string;
  ad_name?: string;
  ad_id?: string;
  thumbnail_url?: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpl: number;
}

type SortField =
  | "spend"
  | "impressions"
  | "ctr"
  | "cpc"
  | "cpm"
  | "conversions"
  | "cpl";
type SortDir = "asc" | "desc";

/* ── Channel Role Colors ── */

const ROLE_COLORS: Record<string, string> = {
  prospecting: "#3B82F6",
  retargeting: "#F59E0B",
  brand: "#8B5CF6",
  conversion: "#10B981",
};

/* ── Mock Campaign Data ── */

function generateMockRows(): WindsorRow[] {
  const mocks: {
    campaign: string;
    source: string;
    adsets: { name: string; ads: string[] }[];
  }[] = [
    {
      campaign: "Ministry_Meta_Prospecting_DayPass",
      source: "facebook",
      adsets: [
        {
          name: "DayPass_Broad_25-45",
          ads: ["DayPass_Carousel_V1", "DayPass_Video_V2"],
        },
        {
          name: "DayPass_Interest_Coworking",
          ads: ["DayPass_Static_V1"],
        },
      ],
    },
    {
      campaign: "Ministry_Meta_Retargeting_Enquiry",
      source: "facebook",
      adsets: [
        {
          name: "Retarget_WebVisitors_7D",
          ads: ["Enquiry_DPA_V1", "Enquiry_Testimonial_V1"],
        },
      ],
    },
    {
      campaign: "Ministry_Meta_Brand_Awareness",
      source: "facebook",
      adsets: [
        {
          name: "Brand_Broad_London",
          ads: ["Brand_Video_30s", "Brand_Carousel_Spaces"],
        },
      ],
    },
    {
      campaign: "Ministry_Google_Conversion_HotDesk",
      source: "google_ads",
      adsets: [
        {
          name: "HotDesk_Exact_Keywords",
          ads: ["RSA_HotDesk_V1", "RSA_HotDesk_V2"],
        },
      ],
    },
    {
      campaign: "Ministry_Google_Brand_Search",
      source: "google_ads",
      adsets: [
        {
          name: "Brand_Exact",
          ads: ["RSA_Brand_V1"],
        },
      ],
    },
    {
      campaign: "Ministry_Meta_Prospecting_MeetingRoom",
      source: "facebook",
      adsets: [
        {
          name: "MeetingRoom_LAL_Bookers",
          ads: ["MeetingRoom_Static_V1", "MeetingRoom_Video_V1"],
        },
      ],
    },
  ];

  const rows: WindsorRow[] = [];
  const rand = (min: number, max: number) =>
    Math.round(min + Math.random() * (max - min));

  for (const mock of mocks) {
    for (const adset of mock.adsets) {
      for (const adName of adset.ads) {
        const spend = rand(200, 2500);
        const impressions = rand(8000, 120000);
        const clicks = rand(80, 1800);
        const conversions = rand(2, 45);
        rows.push({
          date: new Date().toISOString().slice(0, 10),
          source: mock.source,
          campaign: mock.campaign,
          adset: adset.name,
          ad_name: adName,
          ad_id: `ad_${Math.random().toString(36).slice(2, 8)}`,
          spend,
          impressions,
          clicks,
          conversions,
          revenue: conversions * rand(40, 120),
          thumbnail_url:
            mock.source === "facebook"
              ? `https://placehold.co/64x64/1a1a2e/c8a96e?text=${encodeURIComponent(adName.slice(0, 2))}`
              : "",
        });
      }
    }
  }

  return rows;
}

/* ── Aggregation Helpers ── */

function aggregate(rows: WindsorRow[]): Omit<AggregatedRow, "campaign" | "source" | "adset" | "ad_name" | "ad_id" | "thumbnail_url"> {
  const spend = rows.reduce((s, r) => s + (Number(r.spend) || 0), 0);
  const impressions = rows.reduce((s, r) => s + (Number(r.impressions) || 0), 0);
  const clicks = rows.reduce((s, r) => s + (Number(r.clicks) || 0), 0);
  const conversions = rows.reduce((s, r) => s + (Number(r.conversions) || 0), 0);
  const revenue = rows.reduce((s, r) => s + (Number(r.revenue) || 0), 0);
  return {
    spend,
    impressions,
    clicks,
    conversions,
    revenue,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    cpl: conversions > 0 ? spend / conversions : 0,
  };
}

function groupBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of arr) {
    const key = keyFn(item);
    if (!result[key]) result[key] = [];
    result[key].push(item);
  }
  return result;
}

/* ── Platform Badge ── */

function PlatformBadge({ source }: { source: string }) {
  const isMeta = source === "facebook" || source === "meta" || source === "instagram";
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider",
        isMeta
          ? "bg-blue-500/20 text-blue-400"
          : "bg-emerald-500/20 text-emerald-400",
      )}
    >
      {isMeta ? "Meta" : "Google"}
    </span>
  );
}

/* ── Channel Role Badge ── */

function RoleBadge({ campaignName }: { campaignName: string }) {
  const role = getChannelRole(campaignName);
  if (!role) {
    return <span className="text-[#94A3B8]/40">&mdash;</span>;
  }
  const color = ROLE_COLORS[role.id] || "#94A3B8";
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
      style={{
        backgroundColor: `${color}20`,
        color: color,
      }}
    >
      {role.label}
    </span>
  );
}

/* ── CSV Export ── */

function exportCSV(
  rows: { name: string; source: string; role: string; spend: number; impressions: number; ctr: number; cpc: number; cpm: number; conversions: number; cpl: number }[],
) {
  const headers = [
    "Campaign",
    "Platform",
    "Channel Role",
    "Spend",
    "Impressions",
    "CTR (%)",
    "CPC",
    "CPM",
    "Platform Reported Conversions",
    "CPL",
    "CRM Confirmed",
  ];
  const csvRows = [headers.join(",")];
  for (const r of rows) {
    csvRows.push(
      [
        `"${r.name}"`,
        r.source === "facebook" ? "Meta" : "Google",
        r.role,
        r.spend.toFixed(2),
        r.impressions,
        r.ctr.toFixed(2),
        r.cpc.toFixed(2),
        r.cpm.toFixed(2),
        r.conversions,
        r.cpl.toFixed(2),
        "Pending HubSpot",
      ].join(","),
    );
  }
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `paid-performance-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Page ── */

export default function PaidPerformancePage() {
  const { client: clientSlug } = useParams<{ client: string }>();
  const isIrg = clientSlug === "irg";
  const { activeVenue } = useVenue();
  const { days, preset, dateFrom, dateTo } = useDateRange();
  const ctx = useClient();
  const client = ctx?.clientConfig;

  // Windsor data
  const { data: campaignData, source: campaignSource, loading: campaignLoading } =
    useWindsor<WindsorRow[]>({
      clientSlug,
      type: "campaigns",
      days,
      ...(preset === "Custom" ? { dateFrom, dateTo } : {}),
    });

  const { data: creativeData, source: creativeSource, loading: creativeLoading } =
    useWindsor<WindsorRow[]>({
      clientSlug,
      type: "creatives",
      days,
      ...(preset === "Custom" ? { dateFrom, dateTo } : {}),
    });

  // Filters
  const [leadTypeFilter, setLeadTypeFilter] = useState("All");
  const [platformFilter, setPlatformFilter] = useState("All");
  const [channelRoleFilter, setChannelRoleFilter] = useState("All");

  // Sorting
  const [sortField, setSortField] = useState<SortField>("spend");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Drill-down expansion
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(
    new Set(),
  );
  const [expandedAdSets, setExpandedAdSets] = useState<Set<string>>(
    new Set(),
  );

  const toggleCampaign = useCallback((name: string) => {
    setExpandedCampaigns((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const toggleAdSet = useCallback((key: string) => {
    setExpandedAdSets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir("desc");
      }
    },
    [sortField],
  );

  // Determine live vs mock
  const isLive =
    campaignSource === "windsor" &&
    campaignData &&
    campaignData.length > 0;
  const loading = campaignLoading || creativeLoading;

  // Merge campaign + creative data, preferring creative for drill-down
  const allRows: WindsorRow[] = useMemo(() => {
    if (isLive) {
      // Use creative data if available (has adset/ad_name), fallback to campaign data
      if (creativeSource === "windsor" && creativeData && creativeData.length > 0) {
        return creativeData;
      }
      return campaignData;
    }
    return generateMockRows();
  }, [isLive, campaignData, creativeData, creativeSource]);

  // Venue filtering for IRG
  const venueFilteredData = useMemo(() => {
    if (!isLive || !isIrg || activeVenue === "all") return allRows;
    return allRows.filter((r) => {
      const accountId = r.account_id || r.account_name || "";
      const campaign = r.campaign || "";
      return assignIrgBrand(campaign, accountId) === activeVenue;
    });
  }, [isLive, isIrg, activeVenue, allRows]);

  // Apply filters
  const filteredRows = useMemo(() => {
    let rows = venueFilteredData;

    // Platform filter
    if (platformFilter === "Meta") {
      rows = rows.filter(
        (r) =>
          r.source === "facebook" ||
          r.source === "meta" ||
          r.source === "instagram",
      );
    } else if (platformFilter === "Google") {
      rows = rows.filter(
        (r) => r.source === "google_ads" || r.source === "adwords",
      );
    }

    // Channel role filter
    if (channelRoleFilter !== "All") {
      const roleId = channelRoleFilter.toLowerCase();
      rows = rows.filter((r) => {
        const role = getChannelRole(r.campaign);
        return role?.id === roleId;
      });
    }

    // Lead type filter via campaign name pattern matching
    if (leadTypeFilter !== "All") {
      const targetType = LEAD_TYPES.find((lt) => lt.label === leadTypeFilter);
      if (targetType) {
        rows = rows.filter((r) => {
          const detected = getLeadTypeFromCampaign(r.campaign);
          return detected.id === targetType.id;
        });
      }
    }

    return rows;
  }, [venueFilteredData, platformFilter, channelRoleFilter, leadTypeFilter]);

  // Group into campaign-level rows
  const campaignRows = useMemo(() => {
    const grouped = groupBy(
      filteredRows,
      (r) => `${r.campaign}||${r.source}`,
    );
    const rows: (AggregatedRow & { key: string })[] = [];
    for (const [key, group] of Object.entries(grouped)) {
      const [campaign, source] = key.split("||");
      const agg = aggregate(group);
      rows.push({ key, campaign, source, ...agg });
    }

    // Sort
    rows.sort((a, b) => {
      const av = a[sortField] as number;
      const bv = b[sortField] as number;
      return sortDir === "asc" ? av - bv : bv - av;
    });

    return rows;
  }, [filteredRows, sortField, sortDir]);

  // Build adset and ad maps for drill-down
  const adsetMap = useMemo(() => {
    const map: Record<string, (AggregatedRow & { key: string })[]> = {};
    for (const [campaignKey, group] of Object.entries(
      groupBy(filteredRows, (r) => `${r.campaign}||${r.source}`),
    )) {
      const adsetGrouped = groupBy(group, (r) => r.adset || "(no ad set)");
      const adsetRows: (AggregatedRow & { key: string })[] = [];
      for (const [adsetName, adsetGroup] of Object.entries(adsetGrouped)) {
        const agg = aggregate(adsetGroup);
        adsetRows.push({
          key: `${campaignKey}||${adsetName}`,
          campaign: adsetGroup[0].campaign,
          source: adsetGroup[0].source,
          adset: adsetName,
          ...agg,
        });
      }
      adsetRows.sort((a, b) => {
        const av = a[sortField] as number;
        const bv = b[sortField] as number;
        return sortDir === "asc" ? av - bv : bv - av;
      });
      map[campaignKey] = adsetRows;
    }
    return map;
  }, [filteredRows, sortField, sortDir]);

  const adMap = useMemo(() => {
    const map: Record<string, (AggregatedRow & { key: string })[]> = {};
    for (const row of filteredRows) {
      const adsetKey = `${row.campaign}||${row.source}||${row.adset || "(no ad set)"}`;
      if (!map[adsetKey]) map[adsetKey] = [];
    }
    const adGrouped = groupBy(
      filteredRows,
      (r) => `${r.campaign}||${r.source}||${r.adset || "(no ad set)"}`,
    );
    for (const [adsetKey, group] of Object.entries(adGrouped)) {
      const adGroupedInner = groupBy(
        group,
        (r) => r.ad_name || "(no ad)",
      );
      const adRows: (AggregatedRow & { key: string })[] = [];
      for (const [adName, adGroup] of Object.entries(adGroupedInner)) {
        const agg = aggregate(adGroup);
        const sample = adGroup[0];
        adRows.push({
          key: `${adsetKey}||${adName}`,
          campaign: sample.campaign,
          source: sample.source,
          adset: sample.adset,
          ad_name: adName,
          ad_id: sample.ad_id,
          thumbnail_url: sample.thumbnail_url,
          ...agg,
        });
      }
      adRows.sort((a, b) => {
        const av = a[sortField] as number;
        const bv = b[sortField] as number;
        return sortDir === "asc" ? av - bv : bv - av;
      });
      map[adsetKey] = adRows;
    }
    return map;
  }, [filteredRows, sortField, sortDir]);

  // Totals
  const totals = useMemo(() => aggregate(filteredRows), [filteredRows]);

  // Lead type filter is always available via campaign name pattern matching

  // CSV export handler
  const handleExport = useCallback(() => {
    const rows = campaignRows.map((r) => ({
      name: r.campaign,
      source: r.source,
      role: getChannelRole(r.campaign)?.label || "-",
      spend: r.spend,
      impressions: r.impressions,
      ctr: r.ctr,
      cpc: r.cpc,
      cpm: r.cpm,
      conversions: r.conversions,
      cpl: r.cpl,
    }));
    exportCSV(rows);
  }, [campaignRows]);

  if (!client) return null;

  const accent = MINISTRY_BRAND.accentColor;

  /* ── Sortable Header Helper ── */
  function SortHeader({
    field,
    label,
    className,
    tooltipContent,
  }: {
    field: SortField;
    label: string;
    className?: string;
    tooltipContent?: string;
  }) {
    const isActive = sortField === field;
    return (
      <th
        className={cn(
          "p-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none transition-colors",
          "text-[#94A3B8] hover:text-white",
          className,
        )}
        onClick={() => handleSort(field)}
      >
        <div className="flex items-center gap-1 justify-end">
          {tooltipContent ? (
            <Tooltip content={tooltipContent}>
              <span className="flex items-center gap-1">
                {label}
                <Info size={10} className="text-[#94A3B8]/40" />
              </span>
            </Tooltip>
          ) : (
            <span>{label}</span>
          )}
          {isActive && (
            <span style={{ color: accent }}>
              {sortDir === "asc" ? (
                <ArrowUp size={12} />
              ) : (
                <ArrowDown size={12} />
              )}
            </span>
          )}
        </div>
      </th>
    );
  }

  /* ── Filter Options ── */
  const leadTypeOptions = [
    { value: "All", label: "All" },
    ...LEAD_TYPES.map((lt) => ({ value: lt.label, label: lt.label })),
  ];

  const platformOptions = [
    { value: "All", label: "All" },
    { value: "Meta", label: "Meta" },
    { value: "Google", label: "Google" },
  ];

  const channelRoleOptions = [
    { value: "All", label: "All" },
    ...CHANNEL_ROLES.map((cr) => ({ value: cr.label, label: cr.label })),
  ];

  return (
    <>
      <Header title="Paid Performance" showAttribution dataBadge={{ loading, isLive: !!isLive }} filterRow={isIrg ? <VenueTabs /> : undefined} />

      <div className="flex-1 p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-5 overflow-y-auto">
        {/* ── Top Bar: Export ── */}
        <div className="flex items-center justify-end">
          <button
            onClick={handleExport}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold",
              "bg-white/[0.06] border border-white/[0.08] text-[#94A3B8]",
              "hover:bg-white/[0.10] hover:text-white transition-colors",
            )}
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>

        {/* ── Filter Bar ── */}
        <div className="flex flex-wrap items-center gap-3 overflow-x-auto flex-nowrap sm:flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
              Lead Type
            </span>
            <PillToggle
              options={leadTypeOptions}
              value={leadTypeFilter}
              onChange={setLeadTypeFilter}
              size="sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
              Platform
            </span>
            <PillToggle
              options={platformOptions}
              value={platformFilter}
              onChange={setPlatformFilter}
              size="sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
              Channel
            </span>
            <PillToggle
              options={channelRoleOptions}
              value={channelRoleFilter}
              onChange={setChannelRoleFilter}
              size="sm"
            />
          </div>
        </div>

        {/* ── Campaign Table ── */}
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="text-left p-3 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider min-w-[280px]">
                    Campaign
                  </th>
                  <th className="p-3 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider text-left">
                    Platform
                  </th>
                  <th className="p-3 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider text-left">
                    Channel Role
                  </th>
                  <SortHeader field="spend" label="Spend" className="text-right" />
                  <SortHeader field="impressions" label="Impr." className="text-right" />
                  <SortHeader field="ctr" label="CTR" className="text-right" />
                  <SortHeader field="cpc" label="CPC" className="text-right" />
                  <SortHeader field="cpm" label="CPM" className="text-right" />
                  <SortHeader
                    field="conversions"
                    label="Platform Reported"
                    className="text-right"
                    tooltipContent="Conversions reported by Meta or Google within their own attribution windows. Meta uses 7-day click / 1-day view. Google uses 30-day click."
                  />
                  <SortHeader field="cpl" label="CPL" className="text-right" />
                  <th className="p-3 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider text-right">
                    <Tooltip content="Pending HubSpot connection">
                      <span className="flex items-center gap-1 justify-end">
                        CRM Confirmed
                        <Info size={10} className="text-[#94A3B8]/40" />
                      </span>
                    </Tooltip>
                  </th>
                </tr>
              </thead>
              <tbody>
                {campaignRows.map((row) => {
                  const isExpanded = expandedCampaigns.has(row.key);
                  const adsets = adsetMap[row.key] || [];

                  return (
                    <CampaignBlock
                      key={row.key}
                      row={row}
                      isExpanded={isExpanded}
                      onToggle={() => toggleCampaign(row.key)}
                      adsets={adsets}
                      adMap={adMap}
                      expandedAdSets={expandedAdSets}
                      onToggleAdSet={toggleAdSet}
                      currency={client.currency}
                      accent={accent}
                    />
                  );
                })}

                {/* ── Footer Total Row ── */}
                <tr className="border-t-2 border-white/[0.10] bg-white/[0.03]">
                  <td className="p-3 font-bold text-white" colSpan={3}>
                    Total
                  </td>
                  <td className="p-3 text-right font-bold text-white">
                    {formatCurrency(totals.spend, client.currency)}
                  </td>
                  <td className="p-3 text-right font-bold text-white">
                    {formatNumber(totals.impressions)}
                  </td>
                  <td className="p-3 text-right font-bold text-white">
                    {totals.ctr.toFixed(2)}%
                  </td>
                  <td className="p-3 text-right font-bold text-white">
                    {formatCurrency(totals.cpc, client.currency)}
                  </td>
                  <td className="p-3 text-right font-bold text-white">
                    {formatCurrency(totals.cpm, client.currency)}
                  </td>
                  <td className="p-3 text-right font-bold text-white">
                    {formatNumber(totals.conversions)}
                  </td>
                  <td className="p-3 text-right font-bold text-white">
                    {formatCurrency(totals.cpl, client.currency)}
                  </td>
                  <td className="p-3 text-right text-[#94A3B8]/40">
                    &mdash;
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Platform Reported Context Note ── */}
        <div className="flex items-center gap-2 text-[10px] text-[#94A3B8]/60">
          <Info size={12} />
          <span>
            All conversion numbers are platform-reported. Meta uses 7-day click / 1-day view attribution. Google uses 30-day click attribution.
          </span>
        </div>
      </div>
    </>
  );
}

/* ── Campaign Row Block (with drill-down) ── */

function CampaignBlock({
  row,
  isExpanded,
  onToggle,
  adsets,
  adMap,
  expandedAdSets,
  onToggleAdSet,
  currency,
  accent,
}: {
  row: AggregatedRow & { key: string };
  isExpanded: boolean;
  onToggle: () => void;
  adsets: (AggregatedRow & { key: string })[];
  adMap: Record<string, (AggregatedRow & { key: string })[]>;
  expandedAdSets: Set<string>;
  onToggleAdSet: (key: string) => void;
  currency: string;
  accent: string;
}) {
  return (
    <>
      {/* Campaign Row */}
      <tr
        className={cn(
          "border-b border-white/[0.04] cursor-pointer transition-colors",
          isExpanded
            ? "bg-white/[0.06]"
            : "hover:bg-white/[0.03]",
        )}
        onClick={onToggle}
      >
        <td className="p-3 min-w-[280px]">
          <div className="flex items-center gap-2">
            <span className="text-[#94A3B8]/60 flex-shrink-0">
              {isExpanded ? (
                <ChevronDown size={14} style={{ color: accent }} />
              ) : (
                <ChevronRight size={14} />
              )}
            </span>
            <span className="font-medium text-white truncate max-w-[260px]">
              {row.campaign}
            </span>
          </div>
        </td>
        <td className="p-3">
          <PlatformBadge source={row.source} />
        </td>
        <td className="p-3">
          <RoleBadge campaignName={row.campaign} />
        </td>
        <td className="p-3 text-right text-white tabular-nums">
          {formatCurrency(row.spend, currency)}
        </td>
        <td className="p-3 text-right text-[#94A3B8] tabular-nums">
          {formatNumber(row.impressions)}
        </td>
        <td className="p-3 text-right text-[#94A3B8] tabular-nums">
          {row.ctr.toFixed(2)}%
        </td>
        <td className="p-3 text-right text-[#94A3B8] tabular-nums">
          {formatCurrency(row.cpc, currency)}
        </td>
        <td className="p-3 text-right text-[#94A3B8] tabular-nums">
          {formatCurrency(row.cpm, currency)}
        </td>
        <td className="p-3 text-right text-white tabular-nums">
          {formatNumber(row.conversions)}
        </td>
        <td className="p-3 text-right text-white tabular-nums">
          {formatCurrency(row.cpl, currency)}
        </td>
        <td className="p-3 text-right text-[#94A3B8]/40">
          &mdash;
        </td>
      </tr>

      {/* Ad Set Rows */}
      {isExpanded &&
        adsets.map((adsetRow) => {
          const adsetKey = `${adsetRow.campaign}||${adsetRow.source}||${adsetRow.adset}`;
          const isAdSetExpanded = expandedAdSets.has(adsetKey);
          const ads = adMap[adsetKey] || [];

          return (
            <AdSetBlock
              key={adsetRow.key}
              row={adsetRow}
              isExpanded={isAdSetExpanded}
              onToggle={() => onToggleAdSet(adsetKey)}
              ads={ads}
              currency={currency}
              accent={accent}
            />
          );
        })}
    </>
  );
}

/* ── Ad Set Row Block ── */

function AdSetBlock({
  row,
  isExpanded,
  onToggle,
  ads,
  currency,
  accent,
}: {
  row: AggregatedRow & { key: string };
  isExpanded: boolean;
  onToggle: () => void;
  ads: (AggregatedRow & { key: string })[];
  currency: string;
  accent: string;
}) {
  return (
    <>
      <tr
        className={cn(
          "border-b border-white/[0.03] cursor-pointer transition-colors",
          isExpanded ? "bg-white/[0.04]" : "bg-white/[0.02] hover:bg-white/[0.04]",
        )}
        onClick={onToggle}
      >
        <td className="p-3 pl-10 min-w-[280px]">
          <div className="flex items-center gap-2">
            <span className="text-[#94A3B8]/40 flex-shrink-0">
              {isExpanded ? (
                <ChevronDown size={12} style={{ color: accent }} />
              ) : (
                <ChevronRight size={12} />
              )}
            </span>
            <span className="text-[#94A3B8] font-medium truncate max-w-[240px]">
              {row.adset || "(no ad set)"}
            </span>
          </div>
        </td>
        <td className="p-3" />
        <td className="p-3" />
        <td className="p-3 text-right text-[#94A3B8] tabular-nums">
          {formatCurrency(row.spend, currency)}
        </td>
        <td className="p-3 text-right text-[#94A3B8]/70 tabular-nums">
          {formatNumber(row.impressions)}
        </td>
        <td className="p-3 text-right text-[#94A3B8]/70 tabular-nums">
          {row.ctr.toFixed(2)}%
        </td>
        <td className="p-3 text-right text-[#94A3B8]/70 tabular-nums">
          {formatCurrency(row.cpc, currency)}
        </td>
        <td className="p-3 text-right text-[#94A3B8]/70 tabular-nums">
          {formatCurrency(row.cpm, currency)}
        </td>
        <td className="p-3 text-right text-[#94A3B8] tabular-nums">
          {formatNumber(row.conversions)}
        </td>
        <td className="p-3 text-right text-[#94A3B8] tabular-nums">
          {formatCurrency(row.cpl, currency)}
        </td>
        <td className="p-3 text-right text-[#94A3B8]/40">
          &mdash;
        </td>
      </tr>

      {/* Ad Rows */}
      {isExpanded &&
        ads.map((adRow) => (
          <tr
            key={adRow.key}
            className="border-b border-white/[0.02] bg-white/[0.01] hover:bg-white/[0.03] transition-colors"
          >
            <td className="p-3 pl-16 min-w-[280px]">
              <div className="flex items-center gap-2">
                {adRow.thumbnail_url ? (
                  <Image
                    src={adRow.thumbnail_url}
                    alt=""
                    width={32}
                    height={32}
                    className="rounded object-cover flex-shrink-0"
                    unoptimized
                  />
                ) : (
                  <div className="w-8 h-8 rounded bg-white/[0.06] flex-shrink-0" />
                )}
                <span className="text-[#94A3B8]/80 text-xs truncate max-w-[220px]">
                  {adRow.ad_name || "(no ad)"}
                </span>
              </div>
            </td>
            <td className="p-3" />
            <td className="p-3" />
            <td className="p-3 text-right text-[#94A3B8]/70 tabular-nums text-xs">
              {formatCurrency(adRow.spend, currency)}
            </td>
            <td className="p-3 text-right text-[#94A3B8]/50 tabular-nums text-xs">
              {formatNumber(adRow.impressions)}
            </td>
            <td className="p-3 text-right text-[#94A3B8]/50 tabular-nums text-xs">
              {adRow.ctr.toFixed(2)}%
            </td>
            <td className="p-3 text-right text-[#94A3B8]/50 tabular-nums text-xs">
              {formatCurrency(adRow.cpc, currency)}
            </td>
            <td className="p-3 text-right text-[#94A3B8]/50 tabular-nums text-xs">
              {formatCurrency(adRow.cpm, currency)}
            </td>
            <td className="p-3 text-right text-[#94A3B8]/70 tabular-nums text-xs">
              {formatNumber(adRow.conversions)}
            </td>
            <td className="p-3 text-right text-[#94A3B8]/70 tabular-nums text-xs">
              {formatCurrency(adRow.cpl, currency)}
            </td>
            <td className="p-3 text-right text-[#94A3B8]/40 text-xs">
              &mdash;
            </td>
          </tr>
        ))}
    </>
  );
}
