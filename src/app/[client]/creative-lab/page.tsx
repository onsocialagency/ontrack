"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { PillToggle } from "@/components/ui/pill-toggle";
import { DataBlur } from "@/components/ui/data-blur";
import { useClient } from "@/lib/client-context";
import { useWindsor } from "@/lib/use-windsor";
import { useDateRange } from "@/lib/date-range-context";
import { VenueTabs } from "@/components/layout/venue-tabs";
import { getClientCreatives } from "@/lib/mock-data";
import type { WindsorRow } from "@/lib/windsor";
import type { CreativePlatform } from "@/lib/types";

// Aggregator + scoring
import { aggregateCreatives, type LiveCreative } from "@/lib/creativeAggregator";
import { scoreCreative } from "@/lib/creativeScoring";
import { parseAdName, detectChannelRole } from "@/lib/creativeParser";

// Components
import { CreativeCard } from "@/components/creative-lab/CreativeCard";
import { CreativeDetailModal } from "@/components/creative-lab/CreativeDetailModal";
import { AccountHealthStrip } from "@/components/creative-lab/AccountHealthStrip";
import { FilterBar } from "@/components/creative-lab/FilterBar";
import { BenchmarkPanel } from "@/components/creative-lab/BenchmarkPanel";
import { PatternInsights } from "@/components/creative-lab/PatternInsights";
import { TestTracker } from "@/components/creative-lab/TestTracker";
import { GoogleAdsCopyView } from "@/components/creative-lab/GoogleAdsCopyView";

import { AlertTriangle } from "lucide-react";

/* ── Constants ── */

const MAIN_TAB_OPTIONS = [
  { value: "social", label: "Paid Social" },
  { value: "google_copy", label: "Google Ads Copy" },
];

const PLATFORM_OPTIONS = [
  { value: "all", label: "All" },
  { value: "meta", label: "Meta" },
  { value: "tiktok", label: "TikTok" },
];

const ITEMS_PER_PAGE = 20;

/* ── Page ── */

export default function CreativeLabPage() {
  const { client: clientSlug } = useParams<{ client: string }>();
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("search") || "";
  const { days, preset, dateFrom, dateTo } = useDateRange();
  const customDateProps = preset === "Custom" ? { dateFrom, dateTo } : {};
  const ctx = useClient();
  const client = ctx?.clientConfig;
  const mockCreatives = getClientCreatives(clientSlug, client ?? undefined);
  const isIrg = clientSlug === "irg";

  const currency = client?.currency || "GBP";

  // Tab state
  const [mainTab, setMainTab] = useState<"social" | "google_copy">("social");
  const [platformFilter, setPlatformFilter] = useState<"all" | CreativePlatform>("all");
  const [formatFilter, setFormatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [scoreFilter, setScoreFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [page, setPage] = useState(1);
  const [selectedCreative, setSelectedCreative] = useState<LiveCreative | null>(null);

  // Close modal
  const closeModal = useCallback(() => setSelectedCreative(null), []);

  /* ── Data Fetching ── */

  // Main creatives (Meta + Google display/video)
  const { data: windsorData, source: dataSource, loading: windsorLoading } = useWindsor<WindsorRow[]>({
    clientSlug,
    type: "creatives",
    days,
    ...customDateProps,
  });

  // Google Ads Copy — extract Google rows from the main creative fetch
  // Windsor doesn't support granular RSA asset labels, keyword QS components, or search terms
  // as separate endpoints. Instead, we extract Google Ads data from the existing creative fetch
  // which includes ad_headlines, ad_descriptions, keyword_text at the ad level.
  const googleAdsRows = useMemo(() => {
    if (!windsorData) return [];
    return windsorData.filter((r) => r.source === "google_ads");
  }, [windsorData]);

  // TikTok creatives (if client has TikTok accounts)
  const { data: tiktokData } = useWindsor<WindsorRow[]>({
    clientSlug,
    type: "tiktok_creatives",
    days,
    ...customDateProps,
  });

  const isLive = dataSource === "windsor" && windsorData && windsorData.length > 0;

  /* ── Aggregate creatives ── */

  const allCreatives = useMemo(() => {
    if (isLive) {
      // Combine main Windsor data + TikTok data
      const combined = [...(windsorData || []), ...(tiktokData || [])];
      return aggregateCreatives(combined, client ?? undefined);
    }
    // Mock fallback
    return mockCreatives.map((c): LiveCreative => {
      const platform: CreativePlatform = (c.platform || "meta") as CreativePlatform;
      const parsedName = parseAdName(c.name);
      const channelRole = detectChannelRole(c.campaign, c.adSet || "");
      const format = c.format as "VID" | "STA" | "CAR" | "SEARCH";
      const cvr = c.clicks > 0 ? (c.conversions / c.clicks) * 100 : 0;
      const sr = scoreCreative({
        platform,
        format,
        channelRole,
        hookRate: c.hookRate,
        holdRate: c.holdRate,
        ctr: c.ctr,
        cvr,
        roas: c.roas,
        frequency: c.frequency,
        spend: c.spend,
        impressions: c.impressions,
        clientType: client?.type || "ecommerce",
      });
      return {
        ...c,
        platform,
        adSet: c.adSet || "",
        thumbnailUrl: c.thumbnailUrl || "",
        adBody: c.adBody || "",
        adTitle: c.adTitle || "",
        daysRunning: 14,
        isLive: true,
        videoPlays: 0,
        videoThruplay: 0,
        videoP25: 0,
        videoP50: 0,
        videoP75: 0,
        videoP95: 0,
        videoP100: 0,
        video30s: 0,
        videoAvgTime: 0,
        userSegment: "",
        websiteCtr: 0,
        websiteDestUrl: c.websiteDestUrl || "",
        websitePurchaseRoas: 0,
        keywordText: c.keywordText || "",
        keywordMatchType: c.keywordMatchType || "",
        cvr,
        scoreResult: sr,
        channelRole,
        parsedName,
        twoSecondViewRate: 0,
        completionRate: 0,
      };
    });
  }, [isLive, windsorData, tiktokData, mockCreatives, client]);

  /* ── Filter social creatives ── */

  const socialCreatives = useMemo(() => {
    return allCreatives.filter((c) => c.platform !== "google" || c.format !== "SEARCH");
  }, [allCreatives]);

  const filtered = useMemo(() => {
    let result = socialCreatives;

    // Platform filter
    if (platformFilter !== "all") {
      result = result.filter((c) => c.platform === platformFilter);
    }

    // Format filter
    if (formatFilter !== "all") {
      result = result.filter((c) => c.format === formatFilter);
    }

    // Status filter
    if (statusFilter === "live") {
      result = result.filter((c) => c.isLive);
    } else if (statusFilter === "paused") {
      result = result.filter((c) => !c.isLive);
    }

    // Score filter
    if (scoreFilter !== "all") {
      result = result.filter((c) => c.scoreResult.label === scoreFilter);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.campaign.toLowerCase().includes(q) ||
          c.adSet.toLowerCase().includes(q) ||
          c.adBody.toLowerCase().includes(q),
      );
    }

    // Sort: live first, then by spend descending
    result = [...result].sort((a, b) => {
      if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
      return b.spend - a.spend;
    });

    return result;
  }, [socialCreatives, platformFilter, formatFilter, statusFilter, scoreFilter, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [platformFilter, formatFilter, statusFilter, scoreFilter, searchQuery]);

  /* ── Suppression Banner ── */
  const suppressionMessage = client?.suppressScoreWarning;

  return (
    <>
      <Header
        title="Creative Lab"
        dataBadge={{ loading: windsorLoading, isLive: !!isLive }}
        filterRow={isIrg ? <VenueTabs /> : undefined}
      />

      <div className="flex-1 p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-5 overflow-y-auto">
        <DataBlur isBlurred={dataSource !== "windsor" && !windsorLoading} isLoading={windsorLoading} className="space-y-4 sm:space-y-5">

          {/* Suppression banner */}
          {suppressionMessage && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
              <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">{suppressionMessage}</p>
            </div>
          )}

          {/* Main tabs */}
          <div className="flex items-center gap-2">
            <PillToggle
              options={MAIN_TAB_OPTIONS}
              value={mainTab}
              onChange={(v) => setMainTab(v as "social" | "google_copy")}
              size="sm"
            />
            {mainTab === "social" && (
              <>
                <div className="h-5 w-px bg-white/[0.1] hidden sm:block" />
                <PillToggle
                  options={PLATFORM_OPTIONS}
                  value={platformFilter}
                  onChange={(v) => setPlatformFilter(v as "all" | CreativePlatform)}
                  size="sm"
                />
              </>
            )}
          </div>

          {/* ── Paid Social Tab ── */}
          {mainTab === "social" && (
            <div className="space-y-4 sm:space-y-5">
              {/* Benchmark panel */}
              <BenchmarkPanel platform={platformFilter === "all" ? "all" : platformFilter} />

              {/* Account health strip */}
              <AccountHealthStrip
                creatives={platformFilter === "all" ? socialCreatives : socialCreatives.filter((c) => c.platform === platformFilter)}
              />

              {/* Filter bar */}
              <FilterBar
                formatFilter={formatFilter}
                setFormatFilter={setFormatFilter}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                scoreFilter={scoreFilter}
                setScoreFilter={setScoreFilter}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                resultCount={filtered.length}
              />

              {/* Creative Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {paginated.map((creative) => (
                  <CreativeCard
                    key={creative.id}
                    creative={creative}
                    currency={currency}
                    onClick={() => setSelectedCreative(creative)}
                  />
                ))}
              </div>

              {/* Empty state */}
              {filtered.length === 0 && (
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-12 text-center">
                  <p className="text-sm text-[#94A3B8]">
                    No creatives match the current filter.
                  </p>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.05] text-[#94A3B8] hover:text-white disabled:opacity-40 transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-[#94A3B8]">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.05] text-[#94A3B8] hover:text-white disabled:opacity-40 transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}

              {/* Pattern Insights */}
              <PatternInsights
                creatives={platformFilter === "all" ? socialCreatives : socialCreatives.filter((c) => c.platform === platformFilter)}
              />

              {/* Test Tracker */}
              <TestTracker tests={client?.testTracker || []} />
            </div>
          )}

          {/* ── Google Ads Copy Tab ── */}
          {mainTab === "google_copy" && (
            <GoogleAdsCopyView
              googleAdsRows={googleAdsRows}
              googleCreatives={allCreatives.filter((c) => c.platform === "google" || c.format === "SEARCH")}
              currency={currency}
              loading={windsorLoading}
              isLive={!!isLive}
            />
          )}

        </DataBlur>
      </div>

      {/* Detail Modal */}
      {selectedCreative && (
        <CreativeDetailModal
          creative={selectedCreative}
          currency={currency}
          onClose={closeModal}
        />
      )}
    </>
  );
}
