/**
 * Attribution Model Engine
 *
 * Calculates 5 attribution models from Windsor.ai platform-level data.
 * We do NOT have individual user journey data — these models approximate
 * credit distribution using spend patterns, campaign naming, and recency.
 *
 * Models: Last Click, First Click, Linear, Time Decay, Position Based
 *
 * Spend is always fixed per platform — only conversions and revenue
 * change between models. MER is attribution-independent and never changes.
 */

import type { WindsorRow } from "./windsor";

/* ── Types ── */

export type AttributionModel =
  | "lastClick"
  | "firstClick"
  | "linear"
  | "timeDecay"
  | "positionBased";

export const ATTRIBUTION_MODELS: AttributionModel[] = [
  "lastClick",
  "firstClick",
  "linear",
  "timeDecay",
  "positionBased",
];

export const MODEL_LABELS: Record<AttributionModel, string> = {
  lastClick: "Last Click",
  firstClick: "First Click",
  linear: "Linear",
  timeDecay: "Time Decay",
  positionBased: "Position Based",
};

export const MODEL_DESCRIPTIONS: Record<AttributionModel, string> = {
  lastClick:
    "Each platform takes full credit for conversions in its own attribution window. Numbers will overlap.",
  firstClick:
    "Approximates first-touch by weighting platforms with prospecting/awareness campaigns more heavily.",
  linear:
    "Conversion credit split proportionally by each platform's share of total spend.",
  timeDecay:
    "Platforms with more recent spend get more credit — 7-day half-life weighting.",
  positionBased:
    "40% first touch (prospecting), 40% last touch (brand/retargeting), 20% split by spend share.",
};

export interface PlatformAttribution {
  conversions: number;
  revenue: number;
  spend: number;
  roas: number;
}

export interface AttributionResult {
  model: AttributionModel;
  meta: PlatformAttribution;
  google: PlatformAttribution;
  total: PlatformAttribution;
  mer: number;
  deduplicatedTotal: number;
  overlapFactor: number;
}

export interface AllAttributionResults {
  results: Record<AttributionModel, AttributionResult>;
  rawMetaConversions: number;
  rawGoogleConversions: number;
  rawMetaRevenue: number;
  rawGoogleRevenue: number;
  totalSpend: number;
  totalRevenue: number;
  metaSpend: number;
  googleSpend: number;
  mer: number;
  datePreset: string;
}

/** Industry-standard overlap factor: platforms collectively claim ~40% more than actual */
const OVERLAP_FACTOR = 1.4;

/* ── Backward-compatible exports (used by attribution page) ── */

// Old type names mapping to new ones
export type ModelName = AttributionModel;
export const MODEL_NAMES = ATTRIBUTION_MODELS;

/* ── Helpers ── */

function isMeta(source: string): boolean {
  const s = source.toLowerCase();
  return s === "facebook" || s === "meta" || s === "instagram";
}

function isGoogle(source: string): boolean {
  const s = source.toLowerCase();
  return s === "google_ads" || s === "adwords" || s === "google";
}

const PROSPECTING_PATTERNS = [
  "prospecting", "prosp", "awareness", "broad", "top", "tof", "cold",
];

const BRAND_RETARGETING_PATTERNS = [
  "brand", "branded", "retarget", "remarketing", "warm", "bot", "bof",
];

function isProspecting(campaign: string): boolean {
  const lower = campaign.toLowerCase();
  return PROSPECTING_PATTERNS.some((p) => lower.includes(p));
}

function isBrandRetargeting(campaign: string): boolean {
  const lower = campaign.toLowerCase();
  return BRAND_RETARGETING_PATTERNS.some((p) => lower.includes(p));
}

function makePlatformAttribution(conversions: number, revenue: number, spend: number): PlatformAttribution {
  return {
    conversions: +conversions.toFixed(2),
    revenue: +revenue.toFixed(2),
    spend: +spend.toFixed(2),
    roas: spend > 0 ? +(revenue / spend).toFixed(2) : 0,
  };
}

function makeResult(
  model: AttributionModel,
  metaConv: number,
  googleConv: number,
  metaRev: number,
  googleRev: number,
  metaSpend: number,
  googleSpend: number,
  totalRevenue: number,
  totalSpend: number,
  deduplicatedTotal: number,
): AttributionResult {
  const totalConv = metaConv + googleConv;
  const totalRev = metaRev + googleRev;
  return {
    model,
    meta: makePlatformAttribution(metaConv, metaRev, metaSpend),
    google: makePlatformAttribution(googleConv, googleRev, googleSpend),
    total: makePlatformAttribution(totalConv, totalRev, totalSpend),
    mer: totalSpend > 0 ? +(totalRevenue / totalSpend).toFixed(2) : 0,
    deduplicatedTotal: +deduplicatedTotal.toFixed(2),
    overlapFactor: OVERLAP_FACTOR,
  };
}

/* ── Aggregation ── */

interface Aggregated {
  metaSpend: number;
  googleSpend: number;
  metaConversions: number;
  googleConversions: number;
  metaRevenue: number;
  googleRevenue: number;
  totalSpend: number;
  totalRevenue: number;
  /** Deduplicated total conversions for models 2-5 */
  deduplicatedConversions: number;
  /** Deduplicated total revenue for models 2-5 */
  deduplicatedRevenue: number;
  /** Spend in prospecting campaigns per platform */
  metaProspectingSpend: number;
  googleProspectingSpend: number;
  /** Spend in brand/retargeting campaigns per platform */
  metaBrandSpend: number;
  googleBrandSpend: number;
  /** Whether any campaign matched naming patterns */
  hasPatternMatches: boolean;
  /** Daily spend by platform for time decay */
  dailyData: { date: string; metaSpend: number; googleSpend: number }[];
}

function aggregate(rows: WindsorRow[]): Aggregated {
  let metaSpend = 0, googleSpend = 0;
  let metaConversions = 0, googleConversions = 0;
  let metaRevenue = 0, googleRevenue = 0;
  let metaProspectingSpend = 0, googleProspectingSpend = 0;
  let metaBrandSpend = 0, googleBrandSpend = 0;
  let hasPatternMatches = false;

  const dailyMap: Record<string, { metaSpend: number; googleSpend: number }> = {};

  for (const r of rows) {
    const spend = Number(r.spend) || 0;
    const revenue = Number(r.revenue) || 0;
    const conversions = Number(r.conversions) || 0;
    const campaign = r.campaign || "";
    const date = r.date || "unknown";

    // Daily tracking
    if (!dailyMap[date]) dailyMap[date] = { metaSpend: 0, googleSpend: 0 };

    if (isMeta(r.source)) {
      metaSpend += spend;
      metaRevenue += revenue;
      metaConversions += conversions;
      dailyMap[date].metaSpend += spend;

      if (isProspecting(campaign)) { metaProspectingSpend += spend; hasPatternMatches = true; }
      if (isBrandRetargeting(campaign)) { metaBrandSpend += spend; hasPatternMatches = true; }
    } else if (isGoogle(r.source)) {
      googleSpend += spend;
      googleRevenue += revenue;
      googleConversions += conversions;
      dailyMap[date].googleSpend += spend;

      if (isProspecting(campaign)) { googleProspectingSpend += spend; hasPatternMatches = true; }
      if (isBrandRetargeting(campaign)) { googleBrandSpend += spend; hasPatternMatches = true; }
    }
  }

  const totalSpend = metaSpend + googleSpend;
  const totalRevenue = metaRevenue + googleRevenue;

  // Deduplicated totals for models 2-5
  const deduplicatedConversions = (metaConversions + googleConversions) / OVERLAP_FACTOR;
  const deduplicatedRevenue = (metaRevenue + googleRevenue) / OVERLAP_FACTOR;

  const dailyData = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({ date, ...d }));

  return {
    metaSpend, googleSpend,
    metaConversions, googleConversions,
    metaRevenue, googleRevenue,
    totalSpend, totalRevenue,
    deduplicatedConversions, deduplicatedRevenue,
    metaProspectingSpend, googleProspectingSpend,
    metaBrandSpend, googleBrandSpend,
    hasPatternMatches,
    dailyData,
  };
}

/* ── Model Implementations ── */

/**
 * MODEL 1 — LAST CLICK (platform default)
 * Each platform gets exactly the conversions and revenue it claims.
 */
function lastClick(agg: Aggregated): AttributionResult {
  return makeResult(
    "lastClick",
    agg.metaConversions, agg.googleConversions,
    agg.metaRevenue, agg.googleRevenue,
    agg.metaSpend, agg.googleSpend,
    agg.totalRevenue, agg.totalSpend,
    agg.metaConversions + agg.googleConversions, // no dedup for last click
  );
}

/**
 * MODEL 2 — FIRST CLICK
 * Approximate first-touch by weighting prospecting campaigns.
 */
function firstClick(agg: Aggregated): AttributionResult {
  const totalConv = agg.deduplicatedConversions;
  const totalRev = agg.deduplicatedRevenue;

  let metaShare: number;
  let googleShare: number;

  if (agg.hasPatternMatches) {
    const totalProspectingSpend = agg.metaProspectingSpend + agg.googleProspectingSpend;

    if (totalProspectingSpend > 0) {
      // Distribute by prospecting spend share
      metaShare = agg.metaProspectingSpend / totalProspectingSpend;
      googleShare = agg.googleProspectingSpend / totalProspectingSpend;
    } else {
      // Have pattern matches but no prospecting — fallback to spend share
      const ts = agg.totalSpend;
      metaShare = ts > 0 ? agg.metaSpend / ts : 0.5;
      googleShare = ts > 0 ? agg.googleSpend / ts : 0.5;
    }
  } else {
    // No campaign name patterns match — use typical paid social + search defaults
    metaShare = 0.65;
    googleShare = 0.35;
  }

  return makeResult(
    "firstClick",
    totalConv * metaShare, totalConv * googleShare,
    totalRev * metaShare, totalRev * googleShare,
    agg.metaSpend, agg.googleSpend,
    agg.totalRevenue, agg.totalSpend,
    totalConv,
  );
}

/**
 * MODEL 3 — LINEAR
 * Equal credit split proportionally by spend share.
 */
function linear(agg: Aggregated): AttributionResult {
  const totalConv = agg.deduplicatedConversions;
  const totalRev = agg.deduplicatedRevenue;
  const ts = agg.totalSpend;

  const metaShare = ts > 0 ? agg.metaSpend / ts : 0.5;
  const googleShare = ts > 0 ? agg.googleSpend / ts : 0.5;

  return makeResult(
    "linear",
    totalConv * metaShare, totalConv * googleShare,
    totalRev * metaShare, totalRev * googleShare,
    agg.metaSpend, agg.googleSpend,
    agg.totalRevenue, agg.totalSpend,
    totalConv,
  );
}

/**
 * MODEL 4 — TIME DECAY
 * Weight platforms by recency-weighted spend. 7-day half-life.
 */
function timeDecay(agg: Aggregated): AttributionResult {
  const totalConv = agg.deduplicatedConversions;
  const totalRev = agg.deduplicatedRevenue;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let metaWeightedSpend = 0;
  let googleWeightedSpend = 0;

  for (const day of agg.dailyData) {
    const rowDate = new Date(day.date);
    rowDate.setHours(0, 0, 0, 0);
    const daysAgo = Math.max(0, (today.getTime() - rowDate.getTime()) / (1000 * 60 * 60 * 24));
    const weight = Math.pow(2, -daysAgo / 7); // 7-day half-life

    metaWeightedSpend += day.metaSpend * weight;
    googleWeightedSpend += day.googleSpend * weight;
  }

  const totalWeighted = metaWeightedSpend + googleWeightedSpend;
  const metaShare = totalWeighted > 0 ? metaWeightedSpend / totalWeighted : 0.5;
  const googleShare = totalWeighted > 0 ? googleWeightedSpend / totalWeighted : 0.5;

  return makeResult(
    "timeDecay",
    totalConv * metaShare, totalConv * googleShare,
    totalRev * metaShare, totalRev * googleShare,
    agg.metaSpend, agg.googleSpend,
    agg.totalRevenue, agg.totalSpend,
    totalConv,
  );
}

/**
 * MODEL 5 — POSITION BASED (U-shaped)
 * First touch 40%, last touch 40%, middle 20%.
 */
function positionBased(agg: Aggregated): AttributionResult {
  const totalConv = agg.deduplicatedConversions;
  const totalRev = agg.deduplicatedRevenue;

  // Identify first touch platform: most spend in prospecting campaigns
  // Default: Meta (paid social typically initiates)
  let firstTouchPlatform: "meta" | "google" = "meta";
  if (agg.hasPatternMatches && (agg.metaProspectingSpend > 0 || agg.googleProspectingSpend > 0)) {
    firstTouchPlatform = agg.metaProspectingSpend >= agg.googleProspectingSpend ? "meta" : "google";
  }

  // Identify last touch platform: most spend in brand/retargeting campaigns
  // Default: Google (brand search typically closes)
  let lastTouchPlatform: "meta" | "google" = "google";
  if (agg.hasPatternMatches && (agg.metaBrandSpend > 0 || agg.googleBrandSpend > 0)) {
    lastTouchPlatform = agg.metaBrandSpend >= agg.googleBrandSpend ? "meta" : "google";
  }

  let metaShare = 0;
  let googleShare = 0;

  if (firstTouchPlatform === lastTouchPlatform) {
    // Same platform gets 80%, other gets 20%
    if (firstTouchPlatform === "meta") {
      metaShare = 0.8;
      googleShare = 0.2;
    } else {
      metaShare = 0.2;
      googleShare = 0.8;
    }
  } else {
    // Different platforms
    // First touch: 40%
    if (firstTouchPlatform === "meta") metaShare += 0.4;
    else googleShare += 0.4;

    // Last touch: 40%
    if (lastTouchPlatform === "meta") metaShare += 0.4;
    else googleShare += 0.4;

    // Middle 20%: split by spend share
    const ts = agg.totalSpend;
    const middleMetaShare = ts > 0 ? agg.metaSpend / ts : 0.5;
    metaShare += 0.2 * middleMetaShare;
    googleShare += 0.2 * (1 - middleMetaShare);
  }

  return makeResult(
    "positionBased",
    totalConv * metaShare, totalConv * googleShare,
    totalRev * metaShare, totalRev * googleShare,
    agg.metaSpend, agg.googleSpend,
    agg.totalRevenue, agg.totalSpend,
    totalConv,
  );
}

/* ── Main Entry Point ── */

export function calculateAttribution(
  rows: WindsorRow[],
  datePreset: string = "30D",
): AllAttributionResults {
  const agg = aggregate(rows);

  const results: Record<AttributionModel, AttributionResult> = {
    lastClick: lastClick(agg),
    firstClick: firstClick(agg),
    linear: linear(agg),
    timeDecay: timeDecay(agg),
    positionBased: positionBased(agg),
  };

  return {
    results,
    rawMetaConversions: agg.metaConversions,
    rawGoogleConversions: agg.googleConversions,
    rawMetaRevenue: agg.metaRevenue,
    rawGoogleRevenue: agg.googleRevenue,
    totalSpend: agg.totalSpend,
    totalRevenue: agg.totalRevenue,
    metaSpend: agg.metaSpend,
    googleSpend: agg.googleSpend,
    mer: agg.totalSpend > 0 ? +(agg.totalRevenue / agg.totalSpend).toFixed(2) : 0,
    datePreset,
  };
}

/* ── Backward-compatible wrapper ── */

/**
 * Legacy API used by the attribution page.
 * Maps old `runAttribution` to the new `calculateAttribution`.
 */
export interface PlatformCredit {
  metaConversions: number;
  googleConversions: number;
  metaRevenue: number;
  googleRevenue: number;
  metaRoas: number;
  googleRoas: number;
  blendedRoas: number;
}

export interface LegacyAttributionResult {
  modelResults: Record<ModelName, PlatformCredit>;
  mer: number;
  totalSpend: number;
  totalRevenue: number;
  platformReportedRevenue: number;
  metaReportedRevenue: number;
  googleReportedRevenue: number;
  totalConversions: number;
  deduplicatedConversions: number;
  metaSpend: number;
  googleSpend: number;
  /** New API results for advanced UI */
  allResults: AllAttributionResults;
}

export function runAttribution(rows: WindsorRow[]): LegacyAttributionResult {
  const all = calculateAttribution(rows);

  // Convert new results to old PlatformCredit format
  const modelResults: Record<ModelName, PlatformCredit> = {} as Record<ModelName, PlatformCredit>;

  for (const model of ATTRIBUTION_MODELS) {
    const r = all.results[model];
    const totalSpend = r.meta.spend + r.google.spend;
    const totalRev = r.meta.revenue + r.google.revenue;
    modelResults[model] = {
      metaConversions: r.meta.conversions,
      googleConversions: r.google.conversions,
      metaRevenue: r.meta.revenue,
      googleRevenue: r.google.revenue,
      metaRoas: r.meta.roas,
      googleRoas: r.google.roas,
      blendedRoas: totalSpend > 0 ? +(totalRev / totalSpend).toFixed(2) : 0,
    };
  }

  // Last click totals are the raw platform-reported numbers
  const lastClickResult = all.results.lastClick;
  const deduplicatedConversions = all.results.linear.deduplicatedTotal; // any non-lastClick model has it

  return {
    modelResults,
    mer: all.mer,
    totalSpend: all.totalSpend,
    totalRevenue: all.totalRevenue,
    platformReportedRevenue: all.rawMetaRevenue + all.rawGoogleRevenue,
    metaReportedRevenue: all.rawMetaRevenue,
    googleReportedRevenue: all.rawGoogleRevenue,
    totalConversions: all.rawMetaConversions + all.rawGoogleConversions,
    deduplicatedConversions,
    metaSpend: all.metaSpend,
    googleSpend: all.googleSpend,
    allResults: all,
  };
}
