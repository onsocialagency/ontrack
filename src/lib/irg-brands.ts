/**
 * IRG (Ibiza Rocks Group) — Brand Configuration
 *
 * Season: March – October 2026.
 * Budgets confirmed by Imogen Owen, 24 Feb 2026.
 *
 * IMPORTANT framing rules (per the 29 April 2026 spec from Zack):
 *
 * 1. OnSocial manages paid for IR Events, 528, Pikes, Pool Club.
 *    Up Hotel (uphotel.agency, Tristan Theron) manages paid for
 *    IR Hotel — Google campaigns. Hotel revenue appears in this
 *    dashboard as read-only context only. It is NEVER attributed
 *    to OnSocial campaigns.
 *
 * 2. Brand pills shown in the UI: All / IR Events / 528 / Pikes /
 *    Pool Club. Hotel is intentionally NOT a pill. Hotel data
 *    surfaces as a muted "read-only" row beneath relevant tables.
 *
 * 3. Revenue is split by GA4 hostname:
 *      Events revenue → Four Venues (forvenues.com)
 *      Hotel revenue  → WIT Booking (ibizarox.com)
 *    Never combine the two into a single "GA4 Revenue" total.
 *
 * 4. 528 Ibiza is on a dedicated isolated ad account. Its data
 *    must NEVER be aggregated alongside any other brand's data.
 *
 * 5. Pikes Presents spans TWO ad accounts ([528] and [Pikes]) and
 *    rolls them up when the Pikes brand is selected.
 *
 * 6. No client-provided CPA targets exist. Every "Target CPA" cell
 *    renders an amber "Not provided" pill, never blank.
 */

export const IRG_SEASON_START = "2026-03-01";
export const IRG_SEASON_END = "2026-10-31";

/**
 * IR_HOTEL is kept in the brand catalogue so that revenue can be
 * surfaced as read-only context, but it is NOT shown as a pill in
 * the brand selector.
 *
 * Pool Club is intentionally NOT a separate brand. Per Zack: Pool Club
 * lives at Ibiza Rocks and is part of the Ibiza Rocks Events programme.
 * It's surfaced as a campaign-name tag and an event row, both rolled
 * up under IR_EVENTS.
 */
export type IrgBrandId =
  | "IR_HOTEL"
  | "IR_EVENTS"
  | "528_VENUE"
  | "PIKES_PRESENTS";

export interface IrgBrand {
  id: IrgBrandId;
  label: string;
  shortLabel: string;
  budget: number; // EUR, season total
  color: string;
  /** Who runs paid for this brand. */
  managedBy: "OnSocial" | "UpHotel";
  /** When true, brand is read-only context (not a pill, not a brand filter target). */
  readOnly?: boolean;
  /** Friendly account label for the campaign-table badge: [IRG] / [528] / [Pikes] */
  accountLabel: string;
  /** Note rendered on the brand card explaining account scope. */
  accountNote?: string;
  sources: {
    connector: "facebook" | "google_ads" | "tiktok";
    account: string;
    campaignContains?: string[];
  }[];
}

export const IRG_BRANDS: Record<IrgBrandId, IrgBrand> = {
  // Read-only — not a pill. Up Hotel runs Google campaigns; OnSocial
  // does not own this budget. Surfaces in the UI as a muted context row.
  IR_HOTEL: {
    id: "IR_HOTEL",
    label: "Ibiza Rocks Hotel",
    shortLabel: "IR Hotel",
    budget: 33_000,
    color: "#3266ad",
    managedBy: "UpHotel",
    readOnly: true,
    accountLabel: "[IRG]",
    accountNote: "Hotel revenue read-only — Up Hotel / Google. Not OnSocial campaigns.",
    sources: [
      { connector: "google_ads", account: "278-470-9624", campaignContains: ["HOTEL", "HO_PMAX"] },
      { connector: "facebook", account: "511748048632829" },
    ],
  },
  IR_EVENTS: {
    id: "IR_EVENTS",
    label: "Ibiza Rocks Events",
    shortLabel: "IR Events",
    budget: 138_000,
    color: "#3a8eff",
    managedBy: "OnSocial",
    accountLabel: "[IRG]",
    accountNote: "Same Meta account as Hotel but separate campaigns.",
    sources: [
      { connector: "google_ads", account: "278-470-9624", campaignContains: ["GROUP_"] },
    ],
  },
  "528_VENUE": {
    id: "528_VENUE",
    label: "528 Ibiza",
    shortLabel: "528",
    budget: 65_000,
    color: "#8b5cf6",
    managedBy: "OnSocial",
    accountLabel: "[528]",
    accountNote: "Isolated ad account — data never combined with other brands.",
    sources: [
      { connector: "facebook", account: "699834239363956", campaignContains: ["OS_528-"] },
      { connector: "google_ads", account: "534-641-8417" },
    ],
  },
  PIKES_PRESENTS: {
    id: "PIKES_PRESENTS",
    label: "Pikes Presents",
    shortLabel: "Pikes",
    budget: 68_000,
    color: "#C8A96E",
    managedBy: "OnSocial",
    accountLabel: "[528] + [Pikes]",
    accountNote: "Spans two ad accounts — both included when Pikes is selected.",
    sources: [
      { connector: "facebook", account: "699834239363956", campaignContains: ["OS_PikesPresent", "Manumission"] },
    ],
  },
};

export const IRG_TOTAL_BUDGET = Object.values(IRG_BRANDS).reduce((s, b) => s + b.budget, 0);

/**
 * The order brand pills appear in the selector. IR_HOTEL is intentionally
 * absent — it's a read-only brand surfaced as a context row, not a pill.
 */
export const IRG_BRAND_PILL_ORDER: IrgBrandId[] = [
  "IR_EVENTS",
  "528_VENUE",
  "PIKES_PRESENTS",
];

/**
 * The order brands appear in performance grids. IR_HOTEL appears at the
 * end as read-only context.
 */
export const IRG_BRAND_GRID_ORDER: IrgBrandId[] = [
  "IR_EVENTS",
  "528_VENUE",
  "PIKES_PRESENTS",
  "IR_HOTEL", // read-only, appears below the grid
];

/** All Meta account IDs for IRG */
export const IRG_META_ACCOUNTS = ["699834239363956", "511748048632829"];

/** All Google Ads customer IDs for IRG */
export const IRG_GOOGLE_ACCOUNTS = ["278-470-9624", "534-641-8417"];

/** Pre-existing (IRG-managed, not OnSocial) campaign patterns */
export const IRG_PREEXISTING_CAMPAIGNS = ["manumission"];

/**
 * OnSocial naming convention check.
 *
 * Per Zack: OnSocial campaigns are identified by an `OS_` (or
 * occasionally `OS `) prefix on the campaign name. Campaigns without
 * that prefix in the IRG accounts are managed by other agencies (e.g.
 * Up Hotel for hotel/PMAX, IRG internal team for some Demand Gen and
 * Group campaigns) and must NOT be counted toward OnSocial spend or
 * revenue totals.
 *
 * Two exceptions are baked in:
 *   - `manumission` — a Pikes Presents pre-existing campaign that
 *     OnSocial inherited; treated as OnSocial despite the naming.
 *   - The 528 ad account is fully OnSocial regardless of prefix —
 *     everything that runs in that account is ours, including any
 *     legacy / exception names. The check is bypassed inside
 *     assignIrgBrand for that account.
 */
export function isOnSocialCampaign(name: string): boolean {
  const lower = (name || "").toLowerCase().trim();
  if (lower.startsWith("os_") || lower.startsWith("os ")) return true;
  if (IRG_PREEXISTING_CAMPAIGNS.some((p) => lower.includes(p))) return true;
  return false;
}

/* ── GA4 hostname split ──
 *
 * IRG runs two booking platforms feeding the same GA4 property.
 * Revenue must be segmented by hostname so events and hotel never
 * combine into a single misleading total.
 *
 *   forvenues.com  → events / VIP / day passes / Pool Club
 *   ibizarox.com   → hotel rooms (WIT Booking)
 */
export const GA4_HOSTNAME_EVENTS = "forvenues.com";
export const GA4_HOSTNAME_HOTEL = "ibizarox.com";

export type RevenueSource = "events" | "hotel";

export function revenueSourceFromHostname(hostname: string): RevenueSource | null {
  if (!hostname) return null;
  const h = hostname.toLowerCase();
  if (h.includes("forvenues")) return "events";
  if (h.includes("ibizarox")) return "hotel";
  return null;
}

/**
 * Date Tristan's full-purchase-value fix went live. Any revenue data
 * spanning before this date may show deposit values for VIP bookings.
 */
export const PURCHASE_VALUE_FIX_DATE = "2026-04-28";

/**
 * Assign a campaign to the correct IRG brand based on campaign name + account ID.
 *
 * Returns "UNKNOWN" for any campaign that isn't OnSocial-managed
 * (no OS_ prefix and no Pikes legacy marker, outside the 528 account
 * exception). Up Hotel campaigns route to "IR_HOTEL" so they can be
 * surfaced as read-only context. The "all" headline aggregation in
 * aggregateHeadlineKpis filters both UNKNOWN and IR_HOTEL out so
 * OnSocial totals only count campaigns OnSocial actually runs.
 */
export function assignIrgBrand(campaignName: string, accountId: string): IrgBrandId | "UNKNOWN" {
  const name = (campaignName || "").toLowerCase();
  const onSocial = isOnSocialCampaign(campaignName);

  // 528 Meta account — every campaign here is OnSocial-managed (per
  // Zack: "528 should be the 528 ad account, and anything that comes
  // in the 528 ad account"). Pikes is a carve-out within this account.
  if (accountId === "699834239363956") {
    if (name.includes("os_pikespresent") || name.includes("manumission")) {
      return "PIKES_PRESENTS";
    }
    return "528_VENUE";
  }

  // 528 Google account — all campaigns are 528, OnSocial-managed.
  if (accountId === "534-641-8417") return "528_VENUE";

  // Rocks Google account (278-470-9624) — split by campaign name.
  // Hotel patterns route to IR_HOTEL (Up Hotel context). Anything OS-
  // prefixed routes to IR_EVENTS. Anything else (DG_, GROUP_, …) is
  // a different agency's work and gets UNKNOWN so it stays out of
  // OnSocial totals.
  if (accountId === "278-470-9624") {
    if (name.includes("hotel") || name.includes("ho_")) return "IR_HOTEL";
    if (onSocial) return "IR_EVENTS";
    return "UNKNOWN";
  }

  // Ibiza Rocks Meta account (511748048632829). Hotel campaigns →
  // IR_HOTEL, OS-prefixed → IR_EVENTS, everything else → UNKNOWN
  // (don't claim non-OnSocial campaigns as IR_EVENTS spend).
  if (accountId === "511748048632829") {
    if (name.includes("os_irh") || name.includes("hotel") || name.includes("staylist")) return "IR_HOTEL";
    if (onSocial) return "IR_EVENTS";
    return "UNKNOWN";
  }

  return "UNKNOWN";
}

/**
 * Check if a campaign is pre-existing (IRG-managed, not OnSocial).
 */
export function isPreexistingCampaign(campaignName: string): boolean {
  const name = (campaignName || "").toLowerCase();
  return IRG_PREEXISTING_CAMPAIGNS.some((p) => name.includes(p));
}

/**
 * Season pacing calculation.
 */
export function getSeasonPacing(totalSpend: number, budget: number) {
  const start = new Date(IRG_SEASON_START);
  const end = new Date(IRG_SEASON_END);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const elapsed = Math.max(0, Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const remaining = Math.max(0, totalDays - elapsed);

  const expectedPct = elapsed / totalDays;
  const actualPct = budget > 0 ? totalSpend / budget : 0;

  let status: "on_track" | "over_pacing" | "under_pacing" = "on_track";
  if (actualPct > expectedPct + 0.05) status = "over_pacing";
  if (actualPct < expectedPct - 0.05) status = "under_pacing";

  const dailyRate = elapsed > 0 ? totalSpend / elapsed : 0;
  const projectedTotal = totalSpend + dailyRate * remaining;

  return {
    totalDays,
    elapsed,
    remaining,
    expectedPct,
    actualPct,
    status,
    dailyRate,
    projectedTotal,
    budgetRemaining: budget - totalSpend,
  };
}

/* ── GA4 conversion events ── */

/**
 * The GA4 conversion event names IRG uses.
 *
 * Source of truth: tagging call 29 April 2026 with Tristan Theron.
 *
 *   webPurchase       — ALL purchases (events + hotel). GA4 data-driven.
 *                       Use this as the headline figure.
 *   googleAdsPurchase — Custom Google Ads tag, Four Venues purchases only.
 *                       Overlaps with webPurchase. NEVER add the two.
 *   rocksClubForm     — Form submission on the green club landing page.
 *   rocksClubPopup    — WisePops exit-intent pop-up sign-up.
 *                       Total Rocks Club sign-ups = form + popup summed.
 *   eventConversion   — Custom Google Ads optimisation goal for tickets.
 *   eventSales        — Legacy goal, deprecated. Do not surface in UI.
 */
export const GA4_EVENTS = {
  webPurchase: "Web Purchase",
  googleAdsPurchase: "Purchase",
  rocksClubForm: "Rocks Club (form)",
  rocksClubPopup: "Rocks Club (WisePops)",
  eventConversion: "Event Conversion",
  eventSales: "Event Sales", // deprecated; do NOT render
} as const;

/* ── Data gaps surfaced in the dashboard ── */

export const IRG_DATA_GAPS = [
  {
    id: "tiktok_pre_launch",
    severity: "warning" as const,
    title: "TikTok — pre-launch tracking blocker",
    detail: "Template tag still records deposit values, not full purchase prices (£780 full → £195 recorded). Must switch to custom JS before campaigns go live. Revenue figures hidden until confirmed fixed.",
  },
  {
    id: "purchase_value_fix",
    severity: "info" as const,
    title: "Purchase value tracking fixed 28 April 2026",
    detail: "Tristan deployed a custom purchase tag pulling the price field on 28 Apr. Pre-28 April data may show deposit values not full prices for VIP bookings via Four Venues.",
  },
  {
    id: "ga4_not_set",
    severity: "info" as const,
    title: "GA4 not-set source/medium",
    detail: "Visible during the call — Tristan confirmed it resolves within 48 hours as fresh data processes. Not a permanent tracking issue.",
  },
];
