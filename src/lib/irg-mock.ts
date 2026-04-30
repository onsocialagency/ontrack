/**
 * IRG mock data — visible-everywhere preview numbers.
 *
 * Values seeded from the 29 April 2026 brief so the dashboard renders
 * the exact figures the team will recognise (€28.4k spend, 614 tickets,
 * 7.5x ROAS, 847 Rocks Club sign-ups, etc.).
 *
 * Everything here is mock by design — when Windsor / GA4 are connected
 * for real these helpers should be swapped for live aggregations. The
 * shape of each helper matches what the live aggregator should return,
 * so the call sites in pages don't change when wiring real data.
 */

import type { IrgBrandId } from "./irg-brands";

/* ── Headline KPIs ── */

export interface IrgHeadlineKpis {
  totalSpend: number;
  totalSpendDeltaPct: number; // vs previous period
  eventsRevenue: number;       // Four Venues — forvenues.com
  eventsRevenueDeltaPct: number;
  hotelRevenue: number;        // WIT Booking — ibizarox.com (Up Hotel, read-only)
  hotelRevenueDeltaPct: number;
  totalRevenue: number;        // events + hotel (only used in overall ROAS)
  overallRoas: number;
  overallRoasDelta: number;    // x change
  ticketsSold: number;
  ticketsDelta: number;        // count change
  cpa: number;
  cpaDelta: number;            // EUR change
  // Platform spend breakdown — never summed
  metaSpend: number;
  googleSpend: number;
  tiktokSpend: number | null;  // null = pre-launch
}

export function getIrgHeadlineKpis(brand: "all" | IrgBrandId = "all"): IrgHeadlineKpis {
  // Per the brief: 28.4k spend, 126.6k events revenue, 18.4k hotel
  // revenue, 7.5x ROAS, 614 tickets. These are season-to-date.
  if (brand === "all") {
    return {
      totalSpend: 28_400,
      totalSpendDeltaPct: -3,
      eventsRevenue: 126_600,
      eventsRevenueDeltaPct: 22,
      hotelRevenue: 18_400,
      hotelRevenueDeltaPct: 12,
      totalRevenue: 145_000,
      overallRoas: 7.5,
      overallRoasDelta: 0.6,
      ticketsSold: 614,
      ticketsDelta: 22,
      cpa: 46.25,
      cpaDelta: -3.10,
      metaSpend: 24_800,
      googleSpend: 3_600,
      tiktokSpend: null,
    };
  }
  // Per-brand KPIs scale from the brand performance grid in the brief.
  const perBrand: Record<IrgBrandId, IrgHeadlineKpis> = {
    IR_HOTEL: {
      totalSpend: 4_200,
      totalSpendDeltaPct: 5,
      eventsRevenue: 0,
      eventsRevenueDeltaPct: 0,
      hotelRevenue: 18_400,
      hotelRevenueDeltaPct: 18,
      totalRevenue: 18_400,
      overallRoas: 4.4,
      overallRoasDelta: 0.4,
      ticketsSold: 43,
      ticketsDelta: 7,
      cpa: 97.67,
      cpaDelta: -4.20,
      metaSpend: 0,
      googleSpend: 4_200,
      tiktokSpend: null,
    },
    IR_EVENTS: {
      // IR Events now folds Pool Club in. Numbers are the previous IR
      // Events totals + Pool Club's contribution: 12.4k + 2.1k spend,
      // 108k + 22.8k revenue, 412 + 142 tickets.
      totalSpend: 14_500,
      totalSpendDeltaPct: -1,
      eventsRevenue: 130_800,
      eventsRevenueDeltaPct: 21,
      hotelRevenue: 0,
      hotelRevenueDeltaPct: 0,
      totalRevenue: 130_800,
      overallRoas: 9.0,
      overallRoasDelta: 1.0,
      ticketsSold: 554,
      ticketsDelta: 49,
      cpa: 26.17,
      cpaDelta: -1.65,
      metaSpend: 13_300,
      googleSpend: 1_200,
      tiktokSpend: null,
    },
    "528_VENUE": {
      totalSpend: 7_600,
      totalSpendDeltaPct: 8,
      eventsRevenue: 32_400,
      eventsRevenueDeltaPct: 14,
      hotelRevenue: 0,
      hotelRevenueDeltaPct: 0,
      totalRevenue: 32_400,
      overallRoas: 4.3,
      overallRoasDelta: 0.2,
      ticketsSold: 138,
      ticketsDelta: 12,
      cpa: 55.07,
      cpaDelta: 2.40,
      metaSpend: 7_100,
      googleSpend: 500,
      tiktokSpend: null,
    },
    PIKES_PRESENTS: {
      totalSpend: 4_200,
      totalSpendDeltaPct: 14,
      eventsRevenue: 85_600,
      eventsRevenueDeltaPct: 19,
      hotelRevenue: 0,
      hotelRevenueDeltaPct: 0,
      totalRevenue: 85_600,
      overallRoas: 20.4,
      overallRoasDelta: 2.1,
      ticketsSold: 159,
      ticketsDelta: 44,
      cpa: 26.42,
      cpaDelta: -3.80,
      metaSpend: 4_200,
      googleSpend: 0,
      tiktokSpend: null,
    },
  };
  return perBrand[brand];
}

/* ── Sales by platform ── */

export interface SalesByPlatformRow {
  platform: "Meta" | "Google" | "TikTok";
  spend: number | null;       // null = no spend (e.g. TikTok pre-launch)
  sales: number | null;
  revenue: number | null;
  roas: number | null;
  cpa: number | null;
  preLaunch?: boolean;
}

export function getSalesByPlatform(): SalesByPlatformRow[] {
  return [
    { platform: "Meta", spend: 24_800, sales: 487, revenue: 98_400, roas: 3.97, cpa: 50.93 },
    { platform: "Google", spend: 3_600, sales: 78, revenue: 16_400, roas: 4.56, cpa: 46.15 },
    { platform: "TikTok", spend: null, sales: null, revenue: null, roas: null, cpa: null, preLaunch: true },
  ];
}

/* ── Brand performance grid ── */

export interface BrandGridRow {
  brand: IrgBrandId;
  spend: number;
  spendDeltaPct: number | null;
  eventsRevenue: number;
  eventsRevenueDeltaPct: number | null;
  hotelRevenue: number;        // only set for IR_HOTEL
  roas: number | null;
  roasDelta: number | null;
  tickets: number;
  ticketsDelta: number | null;
  cpa: number | null;
  cpaLabel?: string;           // e.g. "£52–£62" when expressed as a range
  notes?: string[];
}

export function getBrandGrid(): BrandGridRow[] {
  return [
    {
      // Includes Pool Club (Pool Club is at Ibiza Rocks — an event,
      // not its own brand). Numbers fold the old Pool Club row in.
      brand: "IR_EVENTS",
      spend: 14_500,
      spendDeltaPct: -1,
      eventsRevenue: 130_800,
      eventsRevenueDeltaPct: 21,
      hotelRevenue: 0,
      roas: 9.0,
      roasDelta: 1.0,
      tickets: 554,
      ticketsDelta: 49,
      cpa: 26.17,
    },
    {
      brand: "528_VENUE",
      spend: 7_600,
      spendDeltaPct: 8,
      eventsRevenue: 32_400,
      eventsRevenueDeltaPct: 14,
      hotelRevenue: 0,
      roas: 4.3,
      roasDelta: 0.2,
      tickets: 138,
      ticketsDelta: 12,
      cpa: null,
      cpaLabel: "€52–€62",
      notes: ["Isolated ad account — data never combined with other brands"],
    },
    {
      brand: "PIKES_PRESENTS",
      spend: 4_200,
      spendDeltaPct: 14,
      eventsRevenue: 85_600,
      eventsRevenueDeltaPct: 19,
      hotelRevenue: 0,
      roas: 20.4,
      roasDelta: 2.1,
      tickets: 159,
      ticketsDelta: 44,
      cpa: 26.42,
    },
    {
      // Read-only — Up Hotel manages this. Surfaces below the grid as
      // a muted row, never as a card with the others.
      brand: "IR_HOTEL",
      spend: 0,
      spendDeltaPct: null,
      eventsRevenue: 0,
      eventsRevenueDeltaPct: null,
      hotelRevenue: 18_400,
      roas: null,
      roasDelta: null,
      tickets: 43,
      ticketsDelta: 7,
      cpa: null,
    },
  ];
}

/* ── Frequency alert strip ── */

export type FrequencySeverity = "red" | "amber";
export interface FrequencyAlert {
  id: string;
  severity: FrequencySeverity;
  brand: string;
  campaign: string;
  platform: "Meta" | "TikTok";
  window: "30d" | "7d";
  frequency: number;
  recommendation: string;
}

export function getFrequencyAlerts(): FrequencyAlert[] {
  // Thresholds per brief:
  //   Meta 30d > 3.5x = red, 2.5–3.5x = amber
  //   TikTok 7d > 2.5x = red
  return [
    {
      id: "pikes-open-sky-energy",
      severity: "red",
      brand: "Pikes Presents",
      campaign: "Open Sky Energy",
      platform: "Meta",
      window: "30d",
      frequency: 5.1,
      recommendation: "Refresh needed",
    },
    {
      id: "528-venue-vibes-v3",
      severity: "amber",
      brand: "528 Ibiza",
      campaign: "Venue Vibes V3",
      platform: "Meta",
      window: "30d",
      frequency: 3.1,
      recommendation: "Monitor",
    },
  ];
}

/* ── Daily performance chart ── */

export interface DailyPerfPoint {
  date: string;     // YYYY-MM-DD
  spend: number;    // EUR
  sales: number;    // tickets
  cpa: number;      // EUR
  revenue: number;  // EUR (events only)
}

/**
 * 14-day window with a gentle upward trend and a dip around day 8 per
 * the brief.
 */
export function getDailyPerfSeries(days = 14): DailyPerfPoint[] {
  const series: DailyPerfPoint[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dayIdx = days - 1 - i;
    // Spend trend: rises from 1.3k → 2.5k with a dip ~ day 8.
    const base = 1300 + (dayIdx * 90);
    const dipFactor = dayIdx === 8 ? 0.55 : dayIdx === 7 ? 0.75 : 1;
    const spend = +(base * dipFactor).toFixed(2);
    const sales = Math.round(spend / 47); // ~€47 CPA target proxy
    const cpa = sales > 0 ? +(spend / sales).toFixed(2) : 0;
    const revenue = +(sales * 215).toFixed(2); // ~€215 average ticket value
    series.push({
      date: d.toISOString().slice(0, 10),
      spend,
      sales,
      cpa,
      revenue,
    });
  }
  return series;
}

/* ── Rocks Club widget ── */

export interface RocksClubStats {
  total: number;
  weekDelta: number;
  funnel: { stage: string; count: number }[];
}

export function getRocksClubStats(): RocksClubStats {
  // 847 sign-ups, +94 this week per brief.
  // List size 80–100k; March email campaign drove £40k hotel revenue.
  return {
    total: 847,
    weekDelta: 94,
    funnel: [
      { stage: "Ad clicks", count: 4_200 },
      { stage: "Sign-ups", count: 847 },
      { stage: "Hotel bookings", count: 38 },
    ],
  };
}

/* ── Campaigns table ── */

export interface IrgCampaignRow {
  brand: IrgBrandId;
  accountLabel: string; // [IRG] / [528] / [Pikes]
  platform: "Meta" | "Google" | "TikTok";
  campaignName: string;
  type: "Always-on" | "Event" | "Artist residency" | "Hotel" | "Awareness";
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  platformReportedSales: number;
  fourVenuesSales: number;
  eventsRevenue: number;
  hotelRevenue: number;
  roas: number | null;     // null when awareness / pre-launch
  cpa: number | null;
}

export function getIrgCampaigns(): IrgCampaignRow[] {
  return [
    {
      brand: "IR_EVENTS",
      accountLabel: "[IRG]",
      platform: "Google",
      campaignName: "GROUP_GenericEvents_Search",
      type: "Always-on",
      spend: 4_800,
      impressions: 312_000,
      clicks: 11_400,
      ctr: 3.65,
      cpc: 0.42,
      platformReportedSales: 142,
      fourVenuesSales: 128,
      eventsRevenue: 38_400,
      hotelRevenue: 0,
      roas: 8.0,
      cpa: 37.50,
    },
    {
      brand: "IR_EVENTS",
      accountLabel: "[IRG]",
      platform: "Meta",
      campaignName: "OS_IRE_Tickets_LookAlikes",
      type: "Event",
      spend: 7_600,
      impressions: 1_180_000,
      clicks: 28_800,
      ctr: 2.44,
      cpc: 0.26,
      platformReportedSales: 268,
      fourVenuesSales: 194,
      eventsRevenue: 69_600,
      hotelRevenue: 0,
      roas: 9.16,
      cpa: 39.18,
    },
    {
      brand: "528_VENUE",
      accountLabel: "[528]",
      platform: "Meta",
      campaignName: "OS_528_Residencies_Awareness",
      type: "Awareness",
      spend: 3_400,
      impressions: 880_000,
      clicks: 12_400,
      ctr: 1.41,
      cpc: 0.27,
      platformReportedSales: 0,
      fourVenuesSales: 0,
      eventsRevenue: 0,
      hotelRevenue: 0,
      roas: null,
      cpa: null,
    },
    {
      brand: "528_VENUE",
      accountLabel: "[528]",
      platform: "Meta",
      campaignName: "OS_528_VenueVibes_V3_Conversion",
      type: "Event",
      spend: 4_200,
      impressions: 612_000,
      clicks: 14_800,
      ctr: 2.42,
      cpc: 0.28,
      platformReportedSales: 152,
      fourVenuesSales: 138,
      eventsRevenue: 32_400,
      hotelRevenue: 0,
      roas: 7.71,
      cpa: 30.43,
    },
    {
      brand: "PIKES_PRESENTS",
      accountLabel: "[528]",
      platform: "Meta",
      campaignName: "OS_PikesPresent_OpenSkyEnergy",
      type: "Event",
      spend: 1_900,
      impressions: 388_000,
      clicks: 9_400,
      ctr: 2.42,
      cpc: 0.20,
      platformReportedSales: 89,
      fourVenuesSales: 78,
      eventsRevenue: 42_300,
      hotelRevenue: 0,
      roas: 22.26,
      cpa: 24.36,
    },
    {
      brand: "PIKES_PRESENTS",
      accountLabel: "[Pikes]",
      platform: "Meta",
      campaignName: "OS_PikesPresent_CraigDavidTS5",
      type: "Artist residency",
      spend: 2_300,
      impressions: 504_000,
      clicks: 13_200,
      ctr: 2.62,
      cpc: 0.17,
      platformReportedSales: 96,
      fourVenuesSales: 81,
      eventsRevenue: 43_300,
      hotelRevenue: 0,
      roas: 18.83,
      cpa: 28.40,
    },
    {
      brand: "IR_EVENTS",
      accountLabel: "[IRG]",
      platform: "Meta",
      campaignName: "OS_PoolClub_DayPass_LookAlikes",
      type: "Event",
      spend: 1_400,
      impressions: 314_000,
      clicks: 8_900,
      ctr: 2.83,
      cpc: 0.16,
      platformReportedSales: 102,
      fourVenuesSales: 96,
      eventsRevenue: 16_320,
      hotelRevenue: 0,
      roas: 11.66,
      cpa: 14.58,
    },
    {
      brand: "IR_EVENTS",
      accountLabel: "[IRG]",
      platform: "Meta",
      campaignName: "OS_PoolClub_Awareness_Younger",
      type: "Awareness",
      spend: 700,
      impressions: 218_000,
      clicks: 4_200,
      ctr: 1.93,
      cpc: 0.17,
      platformReportedSales: 0,
      fourVenuesSales: 0,
      eventsRevenue: 0,
      hotelRevenue: 0,
      roas: null,
      cpa: null,
    },
    // Read-only Up Hotel rows. Surface in tables with a muted style.
    {
      brand: "IR_HOTEL",
      accountLabel: "[IRG]",
      platform: "Google",
      campaignName: "HOTEL_PMAX_StayList",
      type: "Hotel",
      spend: 4_200,
      impressions: 421_000,
      clicks: 12_800,
      ctr: 3.04,
      cpc: 0.33,
      platformReportedSales: 47,
      fourVenuesSales: 0,
      eventsRevenue: 0,
      hotelRevenue: 18_400,
      roas: 4.38,
      cpa: 89.36,
    },
  ];
}

/* ── Events table (Tab 3) ── */

export type EventTimingSplit = {
  advance: number; // 7+ days before
  near: number;    // 1-6 days
  dayOf: number;   // day-of
};

export type EventStatus = "Strong" | "On track" | "Slow" | "Sold out";

export interface IrgEventRow {
  id: string;
  name: string;
  brand: IrgBrandId;
  date: string;       // ISO YYYY-MM-DD
  artist: string;
  accountLabel: string;
  spend: number;
  ticketsSold: number;
  ticketsCapacity: number;
  eventsRevenue: number;
  cpa: number;
  roas: number;
  timingSplit: EventTimingSplit;
  status: EventStatus;
  type: "Day party" | "Night" | "Residency";
  venue: string;
  topAds: { name: string; spend: number; cpa: number; frequency: number }[];
}

export function getIrgEvents(): IrgEventRow[] {
  return [
    {
      id: "evt-craig-david-ts5",
      name: "Craig David presents TS5",
      brand: "PIKES_PRESENTS",
      date: "2026-06-14",
      artist: "Craig David TS5",
      accountLabel: "[528] + [Pikes]",
      spend: 1_800,
      ticketsSold: 142,
      ticketsCapacity: 200,
      eventsRevenue: 14_600,
      cpa: 12.68,
      roas: 8.1,
      timingSplit: { advance: 88, near: 38, dayOf: 16 },
      status: "Strong",
      type: "Night",
      venue: "Pikes",
      topAds: [
        { name: "OS_PikesPresent_CraigDavidTS5_LAL", spend: 1_100, cpa: 11.20, frequency: 2.4 },
        { name: "OS_PikesPresent_CraigDavidTS5_Retarget", spend: 700, cpa: 14.90, frequency: 3.6 },
      ],
    },
    {
      id: "evt-ben-hemsley",
      name: "Ben Hemsley",
      brand: "528_VENUE",
      date: "2026-06-21",
      artist: "Ben Hemsley",
      accountLabel: "[528]",
      spend: 1_400,
      ticketsSold: 86,
      ticketsCapacity: 180,
      eventsRevenue: 7_740,
      cpa: 16.28,
      roas: 5.5,
      timingSplit: { advance: 38, near: 32, dayOf: 16 },
      status: "On track",
      type: "Night",
      venue: "528",
      topAds: [
        { name: "OS_528_BenHemsley_Awareness", spend: 800, cpa: null as unknown as number, frequency: 1.8 },
        { name: "OS_528_BenHemsley_Conversion", spend: 600, cpa: 16.28, frequency: 2.1 },
      ],
    },
    {
      id: "evt-morgan-seatree",
      name: "Morgan Seatree",
      brand: "528_VENUE",
      date: "2026-07-05",
      artist: "Morgan Seatree",
      accountLabel: "[528]",
      spend: 980,
      ticketsSold: 42,
      ticketsCapacity: 150,
      eventsRevenue: 3_780,
      cpa: 23.33,
      roas: 3.86,
      timingSplit: { advance: 18, near: 18, dayOf: 6 },
      status: "Slow",
      type: "Night",
      venue: "528",
      topAds: [{ name: "OS_528_MorganSeatree_LAL", spend: 980, cpa: 23.33, frequency: 1.6 }],
    },
    {
      id: "evt-billy-gillies",
      name: "Billy Gillies",
      brand: "528_VENUE",
      date: "2026-07-12",
      artist: "Billy Gillies",
      accountLabel: "[528]",
      spend: 1_200,
      ticketsSold: 124,
      ticketsCapacity: 180,
      eventsRevenue: 11_160,
      cpa: 9.68,
      roas: 9.3,
      timingSplit: { advance: 78, near: 36, dayOf: 10 },
      status: "Strong",
      type: "Night",
      venue: "528",
      topAds: [
        { name: "OS_528_BillyGillies_LAL", spend: 700, cpa: 8.50, frequency: 2.1 },
        { name: "OS_528_BillyGillies_Retarget", spend: 500, cpa: 11.50, frequency: 2.8 },
      ],
    },
    {
      id: "evt-ibiza-anthems",
      name: "Ibiza Anthems",
      brand: "IR_EVENTS",
      date: "2026-06-08",
      artist: "Ibiza Anthems",
      accountLabel: "[IRG]",
      spend: 1_600,
      ticketsSold: 220,
      ticketsCapacity: 220,
      eventsRevenue: 19_800,
      cpa: 7.27,
      roas: 12.4,
      timingSplit: { advance: 158, near: 50, dayOf: 12 },
      status: "Sold out",
      type: "Day party",
      venue: "Ibiza Rocks Hotel",
      topAds: [{ name: "OS_IRE_IbizaAnthems_LAL", spend: 1_600, cpa: 7.27, frequency: 2.2 }],
    },
    {
      id: "evt-rb-affair",
      name: "R&B Affair",
      brand: "IR_EVENTS",
      date: "2026-06-15",
      artist: "R&B Affair",
      accountLabel: "[IRG]",
      spend: 1_200,
      ticketsSold: 98,
      ticketsCapacity: 200,
      eventsRevenue: 8_820,
      cpa: 12.24,
      roas: 7.4,
      timingSplit: { advance: 48, near: 38, dayOf: 12 },
      status: "On track",
      type: "Day party",
      venue: "Ibiza Rocks Hotel",
      topAds: [{ name: "OS_IRE_RBAffair_LAL", spend: 1_200, cpa: 12.24, frequency: 2.0 }],
    },
    {
      id: "evt-house-band",
      name: "House Band",
      brand: "IR_EVENTS",
      date: "2026-07-01",
      artist: "House Band",
      accountLabel: "[IRG]",
      spend: 600,
      ticketsSold: 24,
      ticketsCapacity: 120,
      eventsRevenue: 1_920,
      cpa: 25.0,
      roas: 3.2,
      timingSplit: { advance: 8, near: 12, dayOf: 4 },
      status: "Slow",
      type: "Night",
      venue: "Ibiza Rocks Hotel",
      topAds: [{ name: "OS_IRE_HouseBand_LAL", spend: 600, cpa: 25.0, frequency: 1.5 }],
    },
    {
      id: "evt-20th-birthday",
      name: "20th Birthday",
      brand: "IR_EVENTS",
      date: "2026-07-19",
      artist: "20th Birthday",
      accountLabel: "[IRG]",
      spend: 2_400,
      ticketsSold: 268,
      ticketsCapacity: 300,
      eventsRevenue: 24_120,
      cpa: 8.96,
      roas: 10.1,
      timingSplit: { advance: 198, near: 56, dayOf: 14 },
      status: "Strong",
      type: "Night",
      venue: "Ibiza Rocks Hotel",
      topAds: [
        { name: "OS_IRE_20thBirthday_LAL", spend: 1_400, cpa: 8.20, frequency: 2.6 },
        { name: "OS_IRE_20thBirthday_Retarget", spend: 1_000, cpa: 10.10, frequency: 3.4 },
      ],
    },
    {
      id: "evt-radio1-dance",
      name: "Radio 1 Dance Weekend",
      brand: "IR_EVENTS",
      date: "2026-08-02",
      artist: "Radio 1 Dance X",
      accountLabel: "[IRG]",
      spend: 1_900,
      ticketsSold: 188,
      ticketsCapacity: 250,
      eventsRevenue: 16_920,
      cpa: 10.11,
      roas: 8.9,
      timingSplit: { advance: 132, near: 42, dayOf: 14 },
      status: "On track",
      type: "Day party",
      venue: "Ibiza Rocks Hotel",
      topAds: [{ name: "OS_IRE_Radio1Dance_LAL", spend: 1_900, cpa: 10.11, frequency: 2.3 }],
    },
    {
      id: "evt-rinse-fm-djez",
      name: "Rinse FM presents DJ EZ",
      brand: "IR_EVENTS",
      date: "2026-08-09",
      artist: "Rinse FM DJ EZ",
      accountLabel: "[IRG]",
      spend: 1_600,
      ticketsSold: 142,
      ticketsCapacity: 220,
      eventsRevenue: 12_780,
      cpa: 11.27,
      roas: 7.99,
      timingSplit: { advance: 96, near: 36, dayOf: 10 },
      status: "On track",
      type: "Day party",
      venue: "Ibiza Rocks Hotel",
      topAds: [{ name: "OS_IRE_RinseFM_LAL", spend: 1_600, cpa: 11.27, frequency: 2.0 }],
    },
    {
      id: "evt-pool-club-opening",
      name: "Pool Club Opening Day",
      brand: "IR_EVENTS",
      date: "2026-05-31",
      artist: "Pool Club Opening",
      accountLabel: "[IRG]",
      spend: 1_400,
      ticketsSold: 218,
      ticketsCapacity: 250,
      eventsRevenue: 21_800,
      cpa: 6.42,
      roas: 15.6,
      timingSplit: { advance: 168, near: 38, dayOf: 12 },
      status: "Strong",
      type: "Day party",
      venue: "Ibiza Rocks Hotel",
      topAds: [{ name: "OS_PoolClub_Opening_LAL", spend: 1_400, cpa: 6.42, frequency: 2.4 }],
    },
  ];
}

/* ── Reconciliation summary (Tab 5) ── */

export interface IrgReconSummary {
  metaPlatformReported: number;
  googlePlatformReported: number;
  fourVenuesConfirmed: number;
  // Revenue breakdown
  eventsRevenue: number;        // forvenues.com
  hotelRevenue: number;         // ibizarox.com
  totalRevenue: number;
  metaPlatformRevenue: number;
  googlePlatformRevenue: number;
  // Sales breakdown
  eventsSales: number;
  hotelSales: number;
}

export function getIrgReconciliation(): IrgReconSummary {
  return {
    metaPlatformReported: 230,
    googlePlatformReported: 47,
    fourVenuesConfirmed: 185,
    eventsRevenue: 126_600,
    hotelRevenue: 18_400,
    totalRevenue: 145_000,
    metaPlatformRevenue: 168_000,
    googlePlatformRevenue: 62_000,
    eventsSales: 142,
    hotelSales: 43,
  };
}

/* ── Creative Lab IRG-specific ── */

export type IrgCreativeRole = "Awareness" | "Conversion" | "Retargeting";
export type IrgCreativePillar = "Brand story" | "Artist hype" | "Day-pass" | "Hotel + events" | "Social proof";
export type IrgAudienceSkew = "Younger" | "Mixed" | "Older";

export interface IrgCreativeRow {
  id: string;
  name: string;
  brand: IrgBrandId;
  platform: "Meta" | "TikTok";
  role: IrgCreativeRole;
  pillar: IrgCreativePillar;
  associatedEvent?: string;
  audienceSkew: IrgAudienceSkew;
  spend: number;
  reach: number;
  cpm: number;
  hookRate: number;     // Meta: 3-second; TikTok: 2-second
  holdRate: number;
  ctr: number;
  fourVenuesSales: number;
  eventsRevenue: number;
  cpaPerCreative: number | null;
  roas: number | null;
  frequency: number;    // 30d window for Meta, 7d for TikTok
  thumbnail: string;
}

export function getIrgCreatives(): IrgCreativeRow[] {
  return [
    {
      id: "cr-pikes-craig-david",
      name: "OS_PikesPresent_CraigDavidTS5_v3",
      brand: "PIKES_PRESENTS",
      platform: "Meta",
      role: "Conversion",
      pillar: "Artist hype",
      associatedEvent: "Craig David TS5 — 14 Jun",
      audienceSkew: "Mixed",
      spend: 1_100,
      reach: 184_000,
      cpm: 5.98,
      hookRate: 32.4,
      holdRate: 18.6,
      ctr: 3.6,
      fourVenuesSales: 92,
      eventsRevenue: 9_440,
      cpaPerCreative: 11.96,
      roas: 8.58,
      frequency: 2.4,
      thumbnail: "",
    },
    {
      id: "cr-pikes-open-sky-energy",
      name: "OS_PikesPresent_OpenSkyEnergy_v2",
      brand: "PIKES_PRESENTS",
      platform: "Meta",
      role: "Conversion",
      pillar: "Artist hype",
      associatedEvent: "Open Sky Energy — Pikes",
      audienceSkew: "Mixed",
      spend: 1_900,
      reach: 76_000,
      cpm: 25.00,
      hookRate: 22.0,
      holdRate: 12.4,
      ctr: 2.0,
      fourVenuesSales: 78,
      eventsRevenue: 42_300,
      cpaPerCreative: 24.36,
      roas: 22.26,
      frequency: 5.1,
      thumbnail: "",
    },
    {
      id: "cr-528-venue-vibes",
      name: "OS_528_VenueVibes_V3",
      brand: "528_VENUE",
      platform: "Meta",
      role: "Conversion",
      pillar: "Brand story",
      audienceSkew: "Younger",
      spend: 4_200,
      reach: 480_000,
      cpm: 8.75,
      hookRate: 28.4,
      holdRate: 16.0,
      ctr: 2.4,
      fourVenuesSales: 138,
      eventsRevenue: 32_400,
      cpaPerCreative: 30.43,
      roas: 7.71,
      frequency: 3.1,
      thumbnail: "",
    },
    {
      id: "cr-528-residencies-awareness",
      name: "OS_528_Residencies_Awareness_v1",
      brand: "528_VENUE",
      platform: "Meta",
      role: "Awareness",
      pillar: "Brand story",
      audienceSkew: "Younger",
      spend: 3_400,
      reach: 720_000,
      cpm: 4.72,
      hookRate: 36.2,
      holdRate: 21.4,
      ctr: 1.41,
      fourVenuesSales: 0,
      eventsRevenue: 0,
      cpaPerCreative: null,
      roas: null,
      frequency: 1.8,
      thumbnail: "",
    },
    {
      id: "cr-pool-club-day-pass",
      name: "OS_PoolClub_DayPass_v4",
      brand: "IR_EVENTS",
      platform: "Meta",
      role: "Conversion",
      pillar: "Day-pass",
      audienceSkew: "Mixed",
      spend: 1_400,
      reach: 218_000,
      cpm: 6.42,
      hookRate: 31.0,
      holdRate: 17.2,
      ctr: 2.83,
      fourVenuesSales: 96,
      eventsRevenue: 16_320,
      cpaPerCreative: 14.58,
      roas: 11.66,
      frequency: 2.0,
      thumbnail: "",
    },
    {
      id: "cr-events-20th-birthday",
      name: "OS_IRE_20thBirthday_LAL",
      brand: "IR_EVENTS",
      platform: "Meta",
      role: "Conversion",
      pillar: "Hotel + events",
      associatedEvent: "20th Birthday — 19 Jul",
      audienceSkew: "Mixed",
      spend: 1_400,
      reach: 312_000,
      cpm: 4.49,
      hookRate: 33.4,
      holdRate: 18.0,
      ctr: 2.7,
      fourVenuesSales: 168,
      eventsRevenue: 15_120,
      cpaPerCreative: 8.33,
      roas: 10.8,
      frequency: 2.6,
      thumbnail: "",
    },
    // TikTok — awareness only, no ROAS shown.
    {
      id: "cr-tiktok-528-vibes",
      name: "OS_528_TikTok_VenueVibes",
      brand: "528_VENUE",
      platform: "TikTok",
      role: "Awareness",
      pillar: "Brand story",
      audienceSkew: "Younger",
      spend: 600,
      reach: 412_000,
      cpm: 1.46,
      hookRate: 22.4,
      holdRate: 8.0,
      ctr: 1.20,
      fourVenuesSales: 0,
      eventsRevenue: 0,
      cpaPerCreative: null,
      roas: null,
      frequency: 1.4,
      thumbnail: "",
    },
    {
      id: "cr-tiktok-pikes-energy",
      name: "OS_Pikes_TikTok_OpenSkyEnergy",
      brand: "PIKES_PRESENTS",
      platform: "TikTok",
      role: "Awareness",
      pillar: "Artist hype",
      audienceSkew: "Younger",
      spend: 400,
      reach: 312_000,
      cpm: 1.28,
      hookRate: 26.8,
      holdRate: 9.4,
      ctr: 1.42,
      fourVenuesSales: 0,
      eventsRevenue: 0,
      cpaPerCreative: null,
      roas: null,
      frequency: 1.7,
      thumbnail: "",
    },
  ];
}
