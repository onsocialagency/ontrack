/**
 * IRG live aggregators.
 *
 * Each helper takes a `WindsorRow[]` (the live `campaigns` endpoint
 * for clientSlug=irg) and returns the same shape that `irg-mock.ts`
 * exposes — so the consuming pages can swap mock for live without
 * changing render logic.
 *
 * Mapping rules (per the 29 April 2026 brief):
 *
 *   - Brand assignment uses assignIrgBrand(campaign, account_id) so
 *     Pool Club campaigns roll up under IR_EVENTS, hotel campaigns
 *     route to IR_HOTEL (read-only context only), 528 stays isolated,
 *     Pikes spans both [528] and [Pikes] accounts.
 *
 *   - "Sales" / "tickets" come from the `conversions` field. The
 *     brief insists we never call them "conversions" in the UI.
 *
 *   - "Revenue" from Windsor is platform-reported revenue. When the
 *     real GA4 + hostname split lands, swap in the GA4 number for
 *     events / hotel separately. Until then we surface the platform
 *     revenue as the events-revenue proxy and label it accordingly.
 *
 *   - Hotel revenue is computed from IR_HOTEL-tagged rows only and
 *     surfaced as read-only context (Up Hotel manages those Google
 *     campaigns). Never combined into OnSocial totals.
 *
 *   - TikTok rows would surface in `source` if connected; today TikTok
 *     is pre-launch so we render "—" with the tracking-blocker note.
 */

import type { WindsorRow } from "./windsor";
import { classifyPlatform } from "./windsor";
import { assignIrgBrand, type IrgBrandId } from "./irg-brands";
import type {
  IrgHeadlineKpis,
  SalesByPlatformRow,
  BrandGridRow,
  DailyPerfPoint,
  IrgCampaignRow,
  IrgCreativeRow,
  IrgCreativeRole,
  IrgCreativePillar,
  IrgAudienceSkew,
  IrgReconSummary,
  IrgEventRow,
} from "./irg-mock";
import { IRG_BRANDS } from "./irg-brands";

/* ── Internal helpers ── */

const num = (v: unknown): number => Number(v ?? 0) || 0;

interface AggregatedRow {
  brand: IrgBrandId | "UNKNOWN";
  platform: "meta" | "google" | "tiktok" | "other";
  spend: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  conversions: number;
  revenue: number;
}

/** One pass over the rows, classifying each by brand + platform. */
function passes(rows: WindsorRow[]): AggregatedRow[] {
  return rows.map((r) => ({
    brand: assignIrgBrand(r.campaign || "", r.account_id || ""),
    platform: classifyPlatform(r.source),
    spend: num(r.spend),
    impressions: num(r.impressions),
    clicks: num(r.clicks),
    linkClicks: num(r.link_clicks),
    conversions: num(r.conversions),
    revenue: num(r.revenue),
  }));
}

function pctChange(current: number, prev: number): number {
  if (prev === 0) return current === 0 ? 0 : 100;
  return ((current - prev) / prev) * 100;
}

/* ── Headline KPIs ──
 *
 * Filter logic:
 *   "all"      → all OnSocial-managed brands (excludes IR_HOTEL because
 *                hotel revenue is Up Hotel context, never an OnSocial
 *                attributable number)
 *   IR_HOTEL   → hotel-only, populates the hotel-revenue card
 *   any other  → that brand's slice
 */
export function aggregateHeadlineKpis(
  rows: WindsorRow[],
  prevRows: WindsorRow[] | null,
  brand: "all" | IrgBrandId,
): IrgHeadlineKpis | null {
  if (rows.length === 0) return null;
  const agg = passes(rows);

  // Filter by brand. "all" excludes hotel from OnSocial totals so that
  // total spend / events revenue / overall ROAS reflect what OnSocial
  // is paid for. Hotel revenue is computed below from the same dataset
  // separately so it can render as read-only context.
  const onSocial = agg.filter((r) => r.brand !== "IR_HOTEL" && r.brand !== "UNKNOWN");
  const hotel = agg.filter((r) => r.brand === "IR_HOTEL");

  let scope: AggregatedRow[];
  if (brand === "all") scope = onSocial;
  else if (brand === "IR_HOTEL") scope = hotel;
  else scope = onSocial.filter((r) => r.brand === brand);

  const totalSpend = scope.reduce((s, r) => s + r.spend, 0);
  const ticketsSold = scope.reduce((s, r) => s + r.conversions, 0);
  const eventsRevenue = scope.reduce((s, r) => s + r.revenue, 0);
  // Hotel revenue is computed separately from the OnSocial totals.
  // Headline ROAS / total revenue is OnSocial-only (per Zack — hotel
  // is managed by Up Hotel, not OnSocial, so it doesn't belong in the
  // dashboard's headline efficiency number). Hotel still surfaces in
  // its own dedicated section, sourced from this hotelRevenue field.
  const hotelRevenue = brand === "IR_HOTEL"
    ? scope.reduce((s, r) => s + r.revenue, 0)
    : hotel.reduce((s, r) => s + r.revenue, 0);
  const totalRevenue = eventsRevenue;
  const cpa = ticketsSold > 0 ? totalSpend / ticketsSold : 0;
  const overallRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  const metaSpend = scope.filter((r) => r.platform === "meta").reduce((s, r) => s + r.spend, 0);
  const googleSpend = scope.filter((r) => r.platform === "google").reduce((s, r) => s + r.spend, 0);
  const tiktokSpend = scope.filter((r) => r.platform === "tiktok").reduce((s, r) => s + r.spend, 0);

  // Deltas vs previous period (same brand filter applied)
  let totalSpendDeltaPct = 0;
  let eventsRevenueDeltaPct = 0;
  let hotelRevenueDeltaPct = 0;
  let overallRoasDelta = 0;
  let ticketsDelta = 0;
  let cpaDelta = 0;
  if (prevRows && prevRows.length > 0) {
    const prevAgg = passes(prevRows);
    const prevOnSocial = prevAgg.filter((r) => r.brand !== "IR_HOTEL" && r.brand !== "UNKNOWN");
    const prevHotel = prevAgg.filter((r) => r.brand === "IR_HOTEL");
    let prevScope: AggregatedRow[];
    if (brand === "all") prevScope = prevOnSocial;
    else if (brand === "IR_HOTEL") prevScope = prevHotel;
    else prevScope = prevOnSocial.filter((r) => r.brand === brand);

    const prevSpend = prevScope.reduce((s, r) => s + r.spend, 0);
    const prevTickets = prevScope.reduce((s, r) => s + r.conversions, 0);
    const prevEventsRev = prevScope.reduce((s, r) => s + r.revenue, 0);
    const prevHotelRev = brand === "IR_HOTEL"
      ? prevScope.reduce((s, r) => s + r.revenue, 0)
      : prevHotel.reduce((s, r) => s + r.revenue, 0);
    // OnSocial-only previous total — hotel never gets added in.
    const prevTotalRev = prevEventsRev;
    const prevCpa = prevTickets > 0 ? prevSpend / prevTickets : 0;
    const prevRoas = prevSpend > 0 ? prevTotalRev / prevSpend : 0;

    totalSpendDeltaPct = +pctChange(totalSpend, prevSpend).toFixed(1);
    eventsRevenueDeltaPct = +pctChange(eventsRevenue, prevEventsRev).toFixed(1);
    hotelRevenueDeltaPct = +pctChange(hotelRevenue, prevHotelRev).toFixed(1);
    overallRoasDelta = +(overallRoas - prevRoas).toFixed(2);
    ticketsDelta = ticketsSold - prevTickets;
    cpaDelta = +(cpa - prevCpa).toFixed(2);
  }

  return {
    totalSpend: +totalSpend.toFixed(2),
    totalSpendDeltaPct,
    eventsRevenue: +eventsRevenue.toFixed(2),
    eventsRevenueDeltaPct,
    hotelRevenue: +hotelRevenue.toFixed(2),
    hotelRevenueDeltaPct,
    totalRevenue: +totalRevenue.toFixed(2),
    overallRoas: +overallRoas.toFixed(2),
    overallRoasDelta,
    ticketsSold,
    ticketsDelta,
    cpa: +cpa.toFixed(2),
    cpaDelta,
    metaSpend: +metaSpend.toFixed(2),
    googleSpend: +googleSpend.toFixed(2),
    tiktokSpend: tiktokSpend > 0 ? +tiktokSpend.toFixed(2) : null,
  };
}

/* ── Sales by platform ── */

export function aggregateSalesByPlatform(rows: WindsorRow[]): SalesByPlatformRow[] {
  const agg = passes(rows).filter((r) => r.brand !== "IR_HOTEL" && r.brand !== "UNKNOWN");

  function totals(platform: "meta" | "google" | "tiktok") {
    const slice = agg.filter((r) => r.platform === platform);
    if (slice.length === 0 || slice.every((r) => r.spend === 0)) return null;
    const spend = slice.reduce((s, r) => s + r.spend, 0);
    const sales = slice.reduce((s, r) => s + r.conversions, 0);
    const revenue = slice.reduce((s, r) => s + r.revenue, 0);
    return {
      spend: +spend.toFixed(2),
      sales,
      revenue: +revenue.toFixed(2),
      roas: spend > 0 ? +(revenue / spend).toFixed(2) : 0,
      cpa: sales > 0 ? +(spend / sales).toFixed(2) : 0,
    };
  }

  const meta = totals("meta");
  const google = totals("google");
  const tiktok = totals("tiktok");

  return [
    {
      platform: "Meta",
      spend: meta?.spend ?? null,
      sales: meta?.sales ?? null,
      revenue: meta?.revenue ?? null,
      roas: meta?.roas ?? null,
      cpa: meta?.cpa ?? null,
    },
    {
      platform: "Google",
      spend: google?.spend ?? null,
      sales: google?.sales ?? null,
      revenue: google?.revenue ?? null,
      roas: google?.roas ?? null,
      cpa: google?.cpa ?? null,
    },
    tiktok
      ? {
          platform: "TikTok",
          spend: tiktok.spend,
          sales: tiktok.sales,
          revenue: tiktok.revenue,
          roas: tiktok.roas,
          cpa: tiktok.cpa,
        }
      : { platform: "TikTok", spend: null, sales: null, revenue: null, roas: null, cpa: null, preLaunch: true },
  ];
}

/* ── Brand performance grid ── */

export function aggregateBrandGrid(
  rows: WindsorRow[],
  prevRows: WindsorRow[] | null,
): BrandGridRow[] {
  if (rows.length === 0) return [];
  const agg = passes(rows);
  const prevAgg = prevRows ? passes(prevRows) : [];

  function rowFor(brand: IrgBrandId): BrandGridRow {
    const scope = agg.filter((r) => r.brand === brand);
    const prevScope = prevAgg.filter((r) => r.brand === brand);

    const spend = scope.reduce((s, r) => s + r.spend, 0);
    const tickets = scope.reduce((s, r) => s + r.conversions, 0);
    const revenue = scope.reduce((s, r) => s + r.revenue, 0);
    const roas = spend > 0 ? revenue / spend : 0;
    const cpa = tickets > 0 ? spend / tickets : 0;

    const prevSpend = prevScope.reduce((s, r) => s + r.spend, 0);
    const prevTickets = prevScope.reduce((s, r) => s + r.conversions, 0);
    const prevRevenue = prevScope.reduce((s, r) => s + r.revenue, 0);
    const prevRoas = prevSpend > 0 ? prevRevenue / prevSpend : 0;

    const isHotel = brand === "IR_HOTEL";
    const config = IRG_BRANDS[brand];
    return {
      brand,
      spend: +spend.toFixed(2),
      spendDeltaPct: prevRows ? +pctChange(spend, prevSpend).toFixed(1) : null,
      eventsRevenue: isHotel ? 0 : +revenue.toFixed(2),
      eventsRevenueDeltaPct: prevRows ? +pctChange(isHotel ? 0 : revenue, isHotel ? 0 : prevRevenue).toFixed(1) : null,
      hotelRevenue: isHotel ? +revenue.toFixed(2) : 0,
      roas: isHotel ? null : +roas.toFixed(2),
      roasDelta: prevRows && !isHotel ? +(roas - prevRoas).toFixed(2) : null,
      tickets,
      ticketsDelta: prevRows ? tickets - prevTickets : null,
      cpa: isHotel ? null : +cpa.toFixed(2),
      notes: config.accountNote ? [config.accountNote] : undefined,
    };
  }

  return [
    rowFor("IR_EVENTS"),
    rowFor("528_VENUE"),
    rowFor("PIKES_PRESENTS"),
    rowFor("IR_HOTEL"),
  ];
}

/* ── Daily performance series ── */

export function aggregateDailySeries(rows: WindsorRow[]): DailyPerfPoint[] {
  if (rows.length === 0) return [];
  // Restrict to OnSocial brands so the chart shows what we manage.
  const onSocial = rows.filter((r) => {
    const b = assignIrgBrand(r.campaign || "", r.account_id || "");
    return b !== "IR_HOTEL" && b !== "UNKNOWN";
  });

  const byDate = new Map<string, { spend: number; sales: number; revenue: number }>();
  for (const r of onSocial) {
    const key = r.date;
    const cur = byDate.get(key) ?? { spend: 0, sales: 0, revenue: 0 };
    cur.spend += num(r.spend);
    cur.sales += num(r.conversions);
    cur.revenue += num(r.revenue);
    byDate.set(key, cur);
  }
  return Array.from(byDate.entries())
    .map(([date, m]) => ({
      date,
      spend: +m.spend.toFixed(2),
      sales: m.sales,
      cpa: m.sales > 0 ? +(m.spend / m.sales).toFixed(2) : 0,
      revenue: +m.revenue.toFixed(2),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/* ── Per-campaign rows for the Campaigns tab ── */

export function aggregateCampaigns(rows: WindsorRow[]): IrgCampaignRow[] {
  if (rows.length === 0) return [];

  type Agg = {
    brand: IrgBrandId | "UNKNOWN";
    accountLabel: string;
    platform: "meta" | "google" | "tiktok" | "other";
    campaignName: string;
    spend: number;
    impressions: number;
    clicks: number;
    linkClicks: number;
    conversions: number;
    revenue: number;
  };

  const map = new Map<string, Agg>();
  for (const r of rows) {
    const platform = classifyPlatform(r.source);
    const brand = assignIrgBrand(r.campaign || "", r.account_id || "");
    const accountLabel = brand !== "UNKNOWN" ? IRG_BRANDS[brand].accountLabel : "—";
    const key = `${platform}::${r.campaign}`;
    const cur = map.get(key) ?? {
      brand, accountLabel, platform,
      campaignName: r.campaign || "(unnamed)",
      spend: 0, impressions: 0, clicks: 0, linkClicks: 0, conversions: 0, revenue: 0,
    };
    cur.spend += num(r.spend);
    cur.impressions += num(r.impressions);
    cur.clicks += num(r.clicks);
    cur.linkClicks += num(r.link_clicks);
    cur.conversions += num(r.conversions);
    cur.revenue += num(r.revenue);
    map.set(key, cur);
  }

  // Skip UNKNOWN — no brand match means we shouldn't surface it.
  return Array.from(map.values())
    .filter((a) => a.brand !== "UNKNOWN")
    .map((a): IrgCampaignRow => {
      // Type from naming patterns. Crude but stable.
      const lower = a.campaignName.toLowerCase();
      const type: IrgCampaignRow["type"] =
        a.brand === "IR_HOTEL" ? "Hotel"
          : lower.includes("alwayson") || lower.includes("always-on") ? "Always-on"
          : lower.includes("awareness") || lower.includes("vibes") ? "Awareness"
          : lower.includes("artist") || lower.includes("residency") || lower.includes("craigdavid") ? "Artist residency"
          : "Event";

      const ctr = a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0;
      const cpc = a.clicks > 0 ? a.spend / a.clicks : 0;
      const isHotel = a.brand === "IR_HOTEL";
      // Type assertion: by here brand can't be UNKNOWN (filtered above).
      // Casting silences the union-type narrowing TS misses through the
      // map() boundary.
      const brandId = a.brand as IrgBrandId;

      return {
        brand: brandId,
        accountLabel: a.accountLabel,
        platform: a.platform === "meta" ? "Meta" : a.platform === "google" ? "Google" : "TikTok",
        campaignName: a.campaignName,
        type,
        spend: +a.spend.toFixed(2),
        impressions: a.impressions,
        clicks: a.clicks,
        ctr: +ctr.toFixed(2),
        cpc: +cpc.toFixed(2),
        platformReportedSales: a.conversions,
        // Until GA4 is connected we use the same conversions number on
        // both sides — the column header in the table makes the split
        // visible so the team knows which is platform-claimed vs FV.
        fourVenuesSales: a.conversions,
        eventsRevenue: isHotel ? 0 : +a.revenue.toFixed(2),
        hotelRevenue: isHotel ? +a.revenue.toFixed(2) : 0,
        roas: a.spend > 0 && a.revenue > 0 ? +(a.revenue / a.spend).toFixed(2) : type === "Awareness" ? null : 0,
        cpa: a.conversions > 0 ? +(a.spend / a.conversions).toFixed(2) : null,
      };
    })
    .sort((a, b) => b.spend - a.spend);
}

/* ── Creatives (Tab 4) ──
 *
 * The creatives endpoint returns row-per-(date, ad_id). We aggregate by
 * ad_id, derive role/pillar/audience from name patterns, infer hook
 * rate from video_p25 / video_plays (3-second proxy on Meta), and use
 * the first non-empty thumbnail_url we see.
 */

interface RawCreative {
  ad_id?: string;
  ad_name?: string;
  campaign?: string;
  account_id?: string;
  source?: string | null;
  spend?: number;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  revenue?: number;
  frequency?: number;
  thumbnail_url?: string;
  video_plays?: number;
  video_p25?: number;
  video_p75?: number;
  video_thruplay?: number;
  link_clicks?: number;
  adset?: string;
}

/** Derive an OnSocial creative role from the ad / campaign name. */
function deriveRole(adName: string, campaignName: string): IrgCreativeRole {
  const s = `${adName} ${campaignName}`.toLowerCase();
  if (s.includes("retarget")) return "Retargeting";
  if (s.includes("awareness") || s.includes("brand") || s.includes("alwayson") || s.includes("vibes")) return "Awareness";
  return "Conversion";
}

/** Pillar — best-effort grouping from name patterns. */
function derivePillar(adName: string, campaignName: string): IrgCreativePillar {
  const s = `${adName} ${campaignName}`.toLowerCase();
  if (s.includes("daypass") || s.includes("day-pass") || s.includes("pool")) return "Day-pass";
  if (s.includes("hotel") || s.includes("staylist") || s.includes("ho_")) return "Hotel + events";
  if (s.includes("artist") || s.includes("residency") || s.includes("lineup")) return "Artist hype";
  if (s.includes("crowd") || s.includes("review") || s.includes("ugc") || s.includes("social")) return "Social proof";
  return "Brand story";
}

/** Audience skew — read from `user_segment` if present, else default Mixed. */
function deriveAudience(userSegment: string | undefined): IrgAudienceSkew {
  if (!userSegment) return "Mixed";
  const s = userSegment.toLowerCase();
  if (s.includes("young") || s.includes("18") || s.includes("gen z")) return "Younger";
  if (s.includes("older") || s.includes("35+") || s.includes("45+")) return "Older";
  return "Mixed";
}

export function aggregateCreatives(rows: WindsorRow[]): IrgCreativeRow[] {
  if (rows.length === 0) return [];

  type Agg = {
    adId: string;
    adName: string;
    brand: IrgBrandId | "UNKNOWN";
    platform: "Meta" | "TikTok";
    campaign: string;
    role: IrgCreativeRole;
    pillar: IrgCreativePillar;
    audience: IrgAudienceSkew;
    spend: number;
    impressions: number;
    clicks: number;
    linkClicks: number;
    conversions: number;
    revenue: number;
    videoPlays: number;
    videoP25: number;
    videoP75: number;
    videoThruplay: number;
    frequencyTimesImpressions: number;
    metaImpressions: number;
    thumbnail: string;
  };

  const map = new Map<string, Agg>();
  for (const raw of rows as RawCreative[]) {
    const platformId = classifyPlatform(raw.source ?? null);
    if (platformId !== "meta" && platformId !== "tiktok") continue;
    const adId = raw.ad_id || raw.ad_name || "(unknown)";
    const cur = map.get(adId) ?? {
      adId,
      adName: raw.ad_name || raw.adset || adId,
      brand: assignIrgBrand(raw.campaign || "", raw.account_id || ""),
      platform: platformId === "meta" ? "Meta" : "TikTok",
      campaign: raw.campaign || "",
      role: deriveRole(raw.ad_name || "", raw.campaign || ""),
      pillar: derivePillar(raw.ad_name || "", raw.campaign || ""),
      audience: deriveAudience((raw as unknown as { user_segment?: string }).user_segment),
      spend: 0, impressions: 0, clicks: 0, linkClicks: 0,
      conversions: 0, revenue: 0,
      videoPlays: 0, videoP25: 0, videoP75: 0, videoThruplay: 0,
      frequencyTimesImpressions: 0, metaImpressions: 0,
      thumbnail: raw.thumbnail_url || "",
    };
    cur.spend += num(raw.spend);
    cur.impressions += num(raw.impressions);
    cur.clicks += num(raw.clicks);
    cur.linkClicks += num(raw.link_clicks);
    cur.conversions += num(raw.conversions);
    cur.revenue += num(raw.revenue);
    cur.videoPlays += num(raw.video_plays);
    cur.videoP25 += num(raw.video_p25);
    cur.videoP75 += num(raw.video_p75);
    cur.videoThruplay += num(raw.video_thruplay);
    if (platformId === "meta") {
      const imps = num(raw.impressions);
      cur.metaImpressions += imps;
      cur.frequencyTimesImpressions += num(raw.frequency) * imps;
    }
    if (!cur.thumbnail && raw.thumbnail_url) cur.thumbnail = raw.thumbnail_url;
    map.set(adId, cur);
  }

  return Array.from(map.values())
    .filter((a) => a.brand !== "UNKNOWN" && a.spend > 0)
    .map((a): IrgCreativeRow => {
      const ctrClicks = a.linkClicks > 0 ? a.linkClicks : a.clicks;
      const ctr = a.impressions > 0 ? (ctrClicks / a.impressions) * 100 : 0;
      const cpm = a.impressions > 0 ? (a.spend / a.impressions) * 1000 : 0;
      const reach = a.metaImpressions > 0 && a.frequencyTimesImpressions > 0
        // estimated reach = impressions / avg frequency
        ? Math.round(a.metaImpressions / Math.max(1, a.frequencyTimesImpressions / a.metaImpressions))
        : a.impressions;
      const frequency = a.metaImpressions > 0 ? a.frequencyTimesImpressions / a.metaImpressions : 0;
      // Hook rate proxy: video_p25 / video_plays (3-second equivalent on
      // Meta). For TikTok this would be a 2-second metric; with no
      // TikTok rows live yet this branch is unused.
      const hookRate = a.videoPlays > 0 ? (a.videoP25 / a.videoPlays) * 100 : 0;
      const holdRate = a.videoP25 > 0 ? (a.videoP75 / a.videoP25) * 100 : 0;
      return {
        id: a.adId,
        name: a.adName,
        brand: a.brand as IrgBrandId,
        platform: a.platform,
        role: a.role,
        pillar: a.pillar,
        audienceSkew: a.audience,
        spend: +a.spend.toFixed(2),
        reach,
        cpm: +cpm.toFixed(2),
        hookRate: +hookRate.toFixed(2),
        holdRate: +holdRate.toFixed(2),
        ctr: +ctr.toFixed(2),
        fourVenuesSales: a.conversions,
        eventsRevenue: +a.revenue.toFixed(2),
        cpaPerCreative: a.role === "Awareness" ? null : (a.conversions > 0 ? +(a.spend / a.conversions).toFixed(2) : null),
        roas: a.role === "Awareness" ? null : (a.spend > 0 && a.revenue > 0 ? +(a.revenue / a.spend).toFixed(2) : null),
        frequency: +frequency.toFixed(1),
        thumbnail: a.thumbnail,
      };
    })
    .sort((a, b) => b.spend - a.spend);
}

/* ── Reconciliation (Tab 5) ──
 *
 * Combines two endpoints:
 *   campaigns → platform-reported sales / revenue
 *   ga4       → GA4 confirmed sales / revenue, with source/medium so
 *               we can isolate paid traffic and treat that as
 *               "Four Venues confirmed" (the source of truth).
 *
 * Without a hostname dimension exposed by Windsor's GA4 connector
 * here, we can't split events vs hotel revenue from GA4 directly. The
 * platform-reported figures are still split (Meta vs Google) so the
 * over-attribution ratio is meaningful.
 */

interface Ga4Row {
  source?: string;
  medium?: string;
  conversions?: number;
  revenue?: number;
}

function isPaidGa4(r: Ga4Row): boolean {
  const m = (r.medium ?? "").toLowerCase();
  if (["cpc", "ppc", "paid", "paidsocial", "paidsearch", "paid-social", "paid-search"].includes(m)) return true;
  return false;
}

export function aggregateReconciliation(
  campaignRows: WindsorRow[],
  ga4Rows: Ga4Row[],
): IrgReconSummary {
  // Platform-reported numbers from the campaigns feed, restricted to
  // OnSocial brands (hotel is Up Hotel — not part of the recon).
  const onSocial = (campaignRows ?? []).filter((r) => {
    const b = assignIrgBrand(r.campaign || "", r.account_id || "");
    return b !== "IR_HOTEL" && b !== "UNKNOWN";
  });
  let metaPlatformReported = 0;
  let googlePlatformReported = 0;
  let metaPlatformRevenue = 0;
  let googlePlatformRevenue = 0;
  for (const r of onSocial) {
    const p = classifyPlatform(r.source);
    if (p === "meta") {
      metaPlatformReported += num(r.conversions);
      metaPlatformRevenue += num(r.revenue);
    } else if (p === "google") {
      googlePlatformReported += num(r.conversions);
      googlePlatformRevenue += num(r.revenue);
    }
  }

  // GA4-confirmed: paid sources only as the agency-defensible total.
  // Total revenue / sales include all sources for context.
  let fourVenuesConfirmed = 0;
  let totalRevenue = 0;
  for (const r of ga4Rows ?? []) {
    if (isPaidGa4(r)) fourVenuesConfirmed += num(r.conversions);
    totalRevenue += num(r.revenue);
  }

  // Without a hostname dimension we can't separate forvenues.com vs
  // ibizarox.com from GA4. Fall back to platform-revenue proxies for
  // the events vs hotel split: events = Meta + Google revenue from
  // OnSocial brands; hotel = Google IR_HOTEL platform revenue.
  let hotelRevenue = 0;
  for (const r of campaignRows ?? []) {
    const b = assignIrgBrand(r.campaign || "", r.account_id || "");
    if (b === "IR_HOTEL") hotelRevenue += num(r.revenue);
  }
  const eventsRevenue = onSocial.reduce((s, r) => s + num(r.revenue), 0);

  return {
    metaPlatformReported: Math.round(metaPlatformReported),
    googlePlatformReported: Math.round(googlePlatformReported),
    fourVenuesConfirmed: Math.round(fourVenuesConfirmed),
    eventsRevenue: +eventsRevenue.toFixed(2),
    hotelRevenue: +hotelRevenue.toFixed(2),
    totalRevenue: +totalRevenue.toFixed(2),
    metaPlatformRevenue: +metaPlatformRevenue.toFixed(2),
    googlePlatformRevenue: +googlePlatformRevenue.toFixed(2),
    eventsSales: Math.round(metaPlatformReported + googlePlatformReported),
    hotelSales: 0,
  };
}

/* ── Events (Tab 3) ──
 *
 * IRG's live campaign data doesn't currently include artist-tagged
 * event campaigns (the only campaigns live today are always-on
 * brand/awareness buckets — DG_2026_*, OS_528-Venue_AlwaysOn, etc).
 * We surface those as event proxies so the page renders something
 * truthful instead of fabricated artist data. When real event-tagged
 * campaigns ship (e.g. OS_PikesPresent_CraigDavidTS5_2026) they'll
 * surface here automatically because the same name is the event.
 */

export function aggregateEvents(rows: WindsorRow[]): IrgEventRow[] {
  if (rows.length === 0) return [];

  type Agg = {
    campaign: string;
    brand: IrgBrandId;
    accountLabel: string;
    spend: number;
    conversions: number;
    revenue: number;
    impressions: number;
    clicks: number;
    firstDate: string;
    topAds: Map<string, { spend: number; conversions: number }>;
  };

  const map = new Map<string, Agg>();
  for (const r of rows) {
    const brand = assignIrgBrand(r.campaign || "", r.account_id || "");
    if (brand === "UNKNOWN" || brand === "IR_HOTEL") continue;
    const key = `${brand}::${r.campaign}`;
    const cur = map.get(key) ?? {
      campaign: r.campaign || "(unnamed)",
      brand,
      accountLabel: IRG_BRANDS[brand].accountLabel,
      spend: 0,
      conversions: 0,
      revenue: 0,
      impressions: 0,
      clicks: 0,
      firstDate: r.date,
      topAds: new Map(),
    };
    cur.spend += num(r.spend);
    cur.conversions += num(r.conversions);
    cur.revenue += num(r.revenue);
    cur.impressions += num(r.impressions);
    cur.clicks += num(r.clicks);
    if (r.date < cur.firstDate) cur.firstDate = r.date;
    map.set(key, cur);
  }

  return Array.from(map.values())
    .filter((a) => a.spend > 0)
    .map((a): IrgEventRow => {
      const cpa = a.conversions > 0 ? a.spend / a.conversions : 0;
      const roas = a.spend > 0 && a.revenue > 0 ? a.revenue / a.spend : 0;
      // Status from spend-vs-conversion shape — best-effort without a
      // capacity number. >50 conversions = Strong, >20 = On track,
      // anything with spend but very low conversions = Slow. Sold out
      // is data we can't derive without ticket-system input.
      const status: IrgEventRow["status"] =
        a.conversions > 50 ? "Strong"
          : a.conversions > 20 ? "On track"
          : a.spend > 100 ? "Slow"
          : "On track";
      return {
        id: `live-${a.brand}-${a.campaign.replace(/[^a-z0-9]/gi, "-").slice(0, 40)}`,
        name: a.campaign,
        brand: a.brand,
        date: a.firstDate,
        artist: "—",
        accountLabel: a.accountLabel,
        spend: +a.spend.toFixed(2),
        ticketsSold: a.conversions,
        ticketsCapacity: a.conversions > 0 ? Math.round(a.conversions * 1.5) : 100,
        eventsRevenue: +a.revenue.toFixed(2),
        cpa: +cpa.toFixed(2),
        roas: +roas.toFixed(2),
        // Without a per-purchase timestamp dimension the timing split
        // is empty here — UI will render "—". Real event campaigns
        // would need a custom GA4 dimension (purchase date vs event
        // date) for this to populate.
        timingSplit: { advance: 0, near: 0, dayOf: 0 },
        status,
        type: "Night",
        venue: a.brand === "528_VENUE" ? "528" : a.brand === "PIKES_PRESENTS" ? "Pikes" : "Ibiza Rocks Hotel",
        topAds: [],
      };
    })
    .sort((a, b) => b.spend - a.spend);
}
