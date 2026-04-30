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
  const hotelRevenue = brand === "IR_HOTEL"
    ? scope.reduce((s, r) => s + r.revenue, 0)
    : hotel.reduce((s, r) => s + r.revenue, 0);
  const totalRevenue = brand === "all" ? eventsRevenue + hotelRevenue : eventsRevenue;
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
    const prevTotalRev = brand === "all" ? prevEventsRev + prevHotelRev : prevEventsRev;
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
