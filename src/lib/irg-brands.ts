/**
 * IRG (Ibiza Rocks Group) — Brand Configuration
 *
 * Season: March – October 2026
 * Budgets confirmed by Imogen Owen, 24 Feb 2026
 */

export const IRG_SEASON_START = "2026-03-01";
export const IRG_SEASON_END = "2026-10-31";

export type IrgBrandId = "IR_HOTEL" | "IR_EVENTS" | "528_VENUE" | "PIKES_PRESENTS";

export interface IrgBrand {
  id: IrgBrandId;
  label: string;
  shortLabel: string;
  budget: number; // EUR, season total
  color: string;
  sources: {
    connector: "facebook" | "google_ads";
    account: string;
    campaignContains?: string[];
  }[];
}

export const IRG_BRANDS: Record<IrgBrandId, IrgBrand> = {
  IR_HOTEL: {
    id: "IR_HOTEL",
    label: "Ibiza Rocks Hotel",
    shortLabel: "IR Hotel",
    budget: 33_000,
    color: "#3266ad",
    sources: [
      { connector: "google_ads", account: "278-470-9624", campaignContains: ["HOTEL", "HO_PMAX"] },
      { connector: "facebook", account: "511748048632829" }, // all campaigns (currently empty)
    ],
  },
  IR_EVENTS: {
    id: "IR_EVENTS",
    label: "Ibiza Rocks Events + Venue",
    shortLabel: "IR Events",
    budget: 138_000,
    color: "#1D9E75",
    sources: [
      { connector: "google_ads", account: "278-470-9624", campaignContains: ["GROUP_"] },
      // Meta: 511748048632829 when live, using OS_IRE- prefix
    ],
  },
  "528_VENUE": {
    id: "528_VENUE",
    label: "528 Venue",
    shortLabel: "528",
    budget: 65_000,
    color: "#BA7517",
    sources: [
      { connector: "facebook", account: "699834239363956", campaignContains: ["OS_528-"] },
      { connector: "google_ads", account: "534-641-8417" }, // all campaigns
    ],
  },
  PIKES_PRESENTS: {
    id: "PIKES_PRESENTS",
    label: "Pikes Presents",
    shortLabel: "Pikes",
    budget: 68_000,
    color: "#993556",
    sources: [
      { connector: "facebook", account: "699834239363956", campaignContains: ["OS_PikesPresent", "Manumission"] },
    ],
  },
};

export const IRG_TOTAL_BUDGET = Object.values(IRG_BRANDS).reduce((s, b) => s + b.budget, 0); // €304,000

export const IRG_BRAND_ORDER: IrgBrandId[] = ["IR_HOTEL", "IR_EVENTS", "528_VENUE", "PIKES_PRESENTS"];

/** All Meta account IDs for IRG */
export const IRG_META_ACCOUNTS = ["699834239363956", "511748048632829"];

/** All Google Ads customer IDs for IRG */
export const IRG_GOOGLE_ACCOUNTS = ["278-470-9624", "534-641-8417"];

/** Pre-existing (IRG-managed, not OnSocial) campaign patterns */
export const IRG_PREEXISTING_CAMPAIGNS = ["manumission"];

/**
 * Assign a campaign to the correct IRG brand based on campaign name + account ID.
 */
export function assignIrgBrand(campaignName: string, accountId: string): IrgBrandId | "UNKNOWN" {
  const name = (campaignName || "").toLowerCase();

  // Pikes Presents (via 528 Meta account)
  if (accountId === "699834239363956") {
    if (name.includes("os_pikespresent") || name.includes("manumission")) {
      return "PIKES_PRESENTS";
    }
    if (name.includes("os_528")) {
      return "528_VENUE";
    }
    // Unknown campaign in 528 account — default to 528
    return "528_VENUE";
  }

  // 528 Google account — all campaigns are 528
  if (accountId === "534-641-8417") return "528_VENUE";

  // Rocks Google account — split by campaign name
  if (accountId === "278-470-9624") {
    if (name.includes("hotel") || name.includes("ho_")) return "IR_HOTEL";
    if (name.includes("group") || name.includes("dg_")) return "IR_EVENTS";
    return "IR_HOTEL"; // default for unknown Rocks campaigns
  }

  // Ibiza Rocks Meta account (currently empty)
  if (accountId === "511748048632829") {
    if (name.includes("os_irh") || name.includes("hotel") || name.includes("staylist")) return "IR_HOTEL";
    if (name.includes("os_ire") || name.includes("event")) return "IR_EVENTS";
    return "IR_EVENTS"; // default for IR Meta
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

  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)); // 244
  const elapsed = Math.max(0, Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const remaining = Math.max(0, totalDays - elapsed);

  const expectedPct = elapsed / totalDays;
  const actualPct = budget > 0 ? totalSpend / budget : 0;

  let status: "on_track" | "over_pacing" | "under_pacing" = "on_track";
  if (actualPct > expectedPct + 0.05) status = "over_pacing";
  if (actualPct < expectedPct - 0.05) status = "under_pacing";

  // Projected season-end spend
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

/** Data gaps to surface in the IRG dashboard */
export const IRG_DATA_GAPS = [
  {
    id: "meta_ir_not_live",
    severity: "warning" as const,
    title: "IR Hotel + IR Events Meta — not live",
    detail: "Account 511748048632829 has zero spend. Hotel/Events Meta campaigns not yet launched.",
  },
  {
    id: "pikes_no_google",
    severity: "info" as const,
    title: "Pikes Presents — no Google Ads",
    detail: "Pikes only has Meta activity. No Google search presence yet.",
  },
  {
    id: "tiktok_not_connected",
    severity: "info" as const,
    title: "TikTok — not connected",
    detail: "TikTok is in the plan but not yet connected in Windsor AI.",
  },
  {
    id: "ga4_not_connected",
    severity: "warning" as const,
    title: "GA4 — not connected for IRG",
    detail: "Website conversion data unavailable. CPAs are platform-reported only.",
  },
  {
    id: "meta_conversions_null",
    severity: "warning" as const,
    title: "Meta conversions — tracking incomplete",
    detail: "Facebook conversions field returning null. Conversion tracking not yet fully set up.",
  },
  {
    id: "roas_unavailable",
    severity: "info" as const,
    title: "Revenue / ROAS — unavailable",
    detail: "IRG haven't shared AOV or revenue targets. ROAS cannot be calculated.",
  },
];
