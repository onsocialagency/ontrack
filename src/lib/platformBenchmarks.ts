/**
 * Creative Lab — Platform Benchmark Thresholds
 *
 * Embedded into the scoring engine and displayed as reference panels in the UI.
 *
 * CRITICAL: Meta and TikTok hook rates are NOT comparable.
 *   Meta uses 3-second plays ÷ impressions.
 *   TikTok uses 2-second views ÷ impressions.
 *   Never show them side by side without a clear platform label.
 */

/* ── Benchmark tier type ── */

export type BenchmarkTier = "fix_it" | "decent" | "strong" | "elite";

export interface BenchmarkThreshold {
  fixIt: number;   // below this = "fix it" / red
  decent: number;  // below this = "decent" / amber
  strong: number;  // below this = "strong" / green
  // above strong = "elite" / green
}

/* ── META BENCHMARKS ── */

export const META_BENCHMARKS = {
  hookRate: {
    label: "Hook Rate (3-sec plays ÷ impressions)",
    fixIt: 25, decent: 30, strong: 40,
    unit: "%",
  },
  holdRate: {
    label: "Hold Rate (ThruPlays ÷ 3-sec plays)",
    fixIt: 40, decent: 50, strong: 50,
    unit: "%",
  },
  ctr: {
    label: "CTR",
    fixIt: 1, decent: 1.5, strong: 3,
    unit: "%",
  },
  frequency: {
    label: "Frequency",
    healthy: 2.5, warning: 3.5, fatigued: 3.5,
  },
  cpm: {
    label: "CPM",
    average: 22.5, // $20-25 range midpoint
    unit: "$",
  },
  confidence: {
    minSpend: 300,  // £300
    minImpressions: 5000, // for video metrics
  },
  fatigue: {
    refreshWeeks: 2,    // 1-2 weeks
    ctrDropThreshold: 15, // 15% CTR drop WoW
    frequencyThreshold: 3.5,
  },
} as const;

/* ── TIKTOK BENCHMARKS ── */

export const TIKTOK_BENCHMARKS = {
  hookRate: {
    label: "Hook Rate (2-sec views ÷ impressions)",
    fixIt: 20, decent: 30, strong: 40,
    unit: "%",
  },
  holdRate: {
    label: "Hold Rate (completions ÷ 2-sec views)",
    fixIt: 40, decent: 50, strong: 50,
    unit: "%",
  },
  ctr: {
    label: "CTR",
    fixIt: 0.8, decent: 1.1, strong: 2.5,
    unit: "%",
  },
  frequency: {
    label: "Frequency",
    healthy: 1.5, warning: 2.5, fatigued: 2.5,
  },
  cpm: {
    label: "CPM",
    average: 10, // $8-12 range midpoint
    unit: "$",
  },
  cpc: {
    label: "CPC",
    average: 1.0,
    unit: "$",
  },
  confidence: {
    minSpend: 200,  // £200
    minImpressions: 5000,
  },
  fatigue: {
    refreshDays: 7,
    frequencyThreshold: 2.5,
    ctrDropThreshold: 15,
    note: "Spark Ads deliver 142% higher engagement than standard ads",
  },
} as const;

/* ── GOOGLE ADS BENCHMARKS ── */

export const GOOGLE_BENCHMARKS = {
  ctr: {
    label: "CTR (Search)",
    fixIt: 3, decent: 5, strong: 8,
    unit: "%",
  },
  qualityScore: {
    label: "Quality Score",
    poor: 4,      // 1-4 = poor (red)
    average: 6,   // 5-6 = average (amber)
    good: 8,      // 7-8 = good (green)
    // 9-10 = excellent (green)
  },
  adStrength: {
    label: "Ad Strength (RSA)",
    values: {
      POOR: { color: "red", action: "Needs immediate attention. Add more headlines and descriptions." },
      AVERAGE: { color: "amber", action: "Improve headline diversity. Avoid duplicate themes." },
      GOOD: { color: "green", action: "Consider adding more headline variations." },
      EXCELLENT: { color: "green", action: "No action needed." },
    },
  },
  assetPerformance: {
    label: "Asset Performance Label",
    values: {
      BEST: { color: "green", action: "Keep. Use as template." },
      GOOD: { color: "green", action: "Keep." },
      LOW: { color: "red", action: "Replace. Pinning this headline is limiting delivery." },
      LEARNING: { color: "slate", action: "Insufficient data." },
      UNRATED: { color: "slate", action: "Not enough impressions." },
    },
  },
  confidence: {
    minSpend: 150, // £150
  },
  fatigue: {
    ctrDropThreshold: 20, // 20% CTR decline WoW
  },
} as const;

/* ── Scoring normalisation ranges ── */

export const NORMALISATION_RANGES = {
  meta: {
    hookRate: { min: 0, max: 50 },
    holdRate: { min: 0, max: 80 },
    ctr: { min: 0, max: 5 },
    cvr: { min: 0, max: 10 },
    roas: { min: 0, max: 8 },
  },
  tiktok: {
    hookRate: { min: 0, max: 50 },
    holdRate: { min: 0, max: 80 },
    ctr: { min: 0, max: 5 },
    cvr: { min: 0, max: 10 },
    roas: { min: 0, max: 8 },
  },
  google: {
    ctr: { min: 0, max: 15 },
    cvr: { min: 0, max: 10 },
    qualityScore: { min: 1, max: 10 }, // maps to 0–100 directly
    cpaRatio: { min: 0.5, max: 2 },    // 0.5x target = 100, 2x target = 0
  },
} as const;

/* ── Helpers ── */

/**
 * Get benchmark tier for a metric value.
 * Thresholds: below fixIt = "fix_it", below decent = "decent", below strong = "strong", else "elite"
 */
export function getBenchmarkTier(
  value: number,
  thresholds: { fixIt: number; decent: number; strong: number },
): BenchmarkTier {
  if (value < thresholds.fixIt) return "fix_it";
  if (value < thresholds.decent) return "decent";
  if (value < thresholds.strong) return "strong";
  return "elite";
}

/** Get the quality score tier for Google Ads. */
export function getQualityScoreTier(qs: number): "poor" | "average" | "good" | "excellent" {
  if (qs <= 4) return "poor";
  if (qs <= 6) return "average";
  if (qs <= 8) return "good";
  return "excellent";
}

/** Map benchmark tier to a Tailwind colour. */
export function getBenchmarkColor(tier: BenchmarkTier | "poor" | "average" | "good" | "excellent"): string {
  switch (tier) {
    case "fix_it":
    case "poor":
      return "text-red-400";
    case "decent":
    case "average":
      return "text-amber-400";
    case "strong":
    case "good":
    case "elite":
    case "excellent":
      return "text-emerald-400";
    default:
      return "text-slate-400";
  }
}

/** Map benchmark tier to a Tailwind bg colour (for badges). */
export function getBenchmarkBgColor(tier: BenchmarkTier | "poor" | "average" | "good" | "excellent"): string {
  switch (tier) {
    case "fix_it":
    case "poor":
      return "bg-red-500/20 text-red-400";
    case "decent":
    case "average":
      return "bg-amber-500/20 text-amber-400";
    case "strong":
    case "good":
    case "elite":
    case "excellent":
      return "bg-emerald-500/20 text-emerald-400";
    default:
      return "bg-slate-500/20 text-slate-400";
  }
}

/**
 * Normalise a value to 0–100 using min/max range.
 * Values below min → 0, above max → 100.
 */
export function normalise(value: number, min: number, max: number): number {
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}
