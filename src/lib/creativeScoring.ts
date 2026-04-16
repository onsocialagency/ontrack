/**
 * Creative Lab — Composite Scoring Engine
 *
 * Produces a 0–100 score per creative with honest scoring rules:
 * 1. Every score shows what it IS and IS NOT scored on.
 * 2. ROAS is excluded from prospecting campaigns.
 * 3. Traffic quality warnings prevent mis-killing good creatives.
 * 4. Video metrics hidden below 5,000 impressions.
 * 5. Confidence thresholds gate scoring entirely.
 */

import type { ChannelRole, CreativePlatform, ScoreLabel, FatigueLevel, ClientType } from "./types";
import {
  NORMALISATION_RANGES,
  META_BENCHMARKS,
  TIKTOK_BENCHMARKS,
  GOOGLE_BENCHMARKS,
  normalise,
} from "./platformBenchmarks";

/* ── Score result ── */

export interface ScoreBreakdownItem {
  metric: string;
  rawValue: number;
  normalisedValue: number;  // 0–100
  weight: number;           // 0–1 (e.g. 0.35 = 35%)
  weightedScore: number;    // normalisedValue * weight
}

export interface ScoreResult {
  compositeScore: number;
  label: ScoreLabel;
  color: string;            // tailwind text colour class
  bgColor: string;          // tailwind bg class
  scoredOn: string;         // "hook rate, hold rate, CTR, CVR"
  notScoredOn: string;      // "ROAS — prospecting ads are not expected to close purchases directly"
  breakdown: ScoreBreakdownItem[];
  warnings: string[];
  isROASHidden: boolean;
  isLearning: boolean;
  isFatigued: boolean;
  fatigueLevel: FatigueLevel;
}

/* ── Score input ── */

export interface ScoreInput {
  platform: CreativePlatform;
  format: "VID" | "STA" | "CAR" | "SEARCH";
  channelRole: ChannelRole;
  hookRate: number;
  holdRate: number;
  ctr: number;
  cvr: number;
  roas: number;
  frequency: number;
  spend: number;
  impressions: number;
  clientType: ClientType;
  targetCPA?: number;
  cpa?: number;
  qualityScore?: number;   // Google: 1–10
  // TikTok-specific
  twoSecondViewRate?: number;
  completionRate?: number;
  // Fatigue signals
  ctr7day?: number;
  ctr14day?: number;
  daysRunning?: number;
}

/* ── Weight tables (per spec) ── */

interface WeightSet {
  hookRate?: number;
  holdRate?: number;
  ctr: number;
  cvr: number;
  roas?: number;
  qualityScore?: number;
  cpaVsTarget?: number;
  completion?: number;
}

function getWeights(platform: CreativePlatform, format: string, channelRole: ChannelRole): WeightSet {
  // Google Search — same regardless of channel role
  if (platform === "google" || format === "SEARCH") {
    return { ctr: 0.30, cvr: 0.25, qualityScore: 0.30, cpaVsTarget: 0.15 };
  }

  // TikTok Video — apply same channel role logic as Meta
  if (platform === "tiktok") {
    if (channelRole === "prospecting") {
      return { hookRate: 0.35, holdRate: 0.20, ctr: 0.20, cvr: 0.10, completion: 0.15 };
    }
    return { hookRate: 0.30, holdRate: 0.20, ctr: 0.20, cvr: 0.15, completion: 0.15 };
  }

  // Meta Static — no video metrics
  if (format === "STA" || format === "CAR") {
    if (channelRole === "prospecting") {
      return { ctr: 0.50, cvr: 0.50 };
    }
    return { ctr: 0.35, cvr: 0.30, roas: 0.35 };
  }

  // Meta Video — channel role determines weights
  switch (channelRole) {
    case "prospecting":
      return { hookRate: 0.35, holdRate: 0.25, ctr: 0.25, cvr: 0.15 };
    case "conversion":
      return { hookRate: 0.15, holdRate: 0.10, ctr: 0.20, cvr: 0.25, roas: 0.30 };
    case "retargeting":
    case "brand":
    default:
      return { hookRate: 0.25, holdRate: 0.20, ctr: 0.20, cvr: 0.20, roas: 0.15 };
  }
}

/* ── Score label mapping ── */

function labelFromScore(score: number): { label: ScoreLabel; color: string; bgColor: string } {
  if (score >= 85) return { label: "Scale", color: "text-emerald-400", bgColor: "bg-emerald-500/20 text-emerald-400" };
  if (score >= 70) return { label: "Optimise", color: "text-amber-400", bgColor: "bg-amber-500/20 text-amber-400" };
  if (score >= 55) return { label: "Review", color: "text-orange-400", bgColor: "bg-orange-500/20 text-orange-400" };
  return { label: "Kill", color: "text-red-400", bgColor: "bg-red-500/20 text-red-400" };
}

/* ── Fatigue detection ── */

function computeFatigue(input: ScoreInput): { isFatigued: boolean; fatigueLevel: FatigueLevel } {
  const { platform, frequency, ctr7day, ctr14day, daysRunning } = input;

  // Calculate rolling CTR ratio
  const ctrRatio = (ctr7day && ctr14day && ctr14day > 0) ? (ctr7day / ctr14day) * 100 : 100;

  if (platform === "tiktok") {
    // TikTok: stricter — refresh every 7 days
    if (frequency > 2.5 && ctrRatio < 85) return { isFatigued: true, fatigueLevel: "critical" };
    if ((daysRunning ?? 0) > 7 && ctrRatio < 100) return { isFatigued: true, fatigueLevel: "fatigued" };
    if (frequency > 2.5) return { isFatigued: false, fatigueLevel: "warning" };
    return { isFatigued: false, fatigueLevel: "none" };
  }

  if (platform === "google") {
    // Google: CTR declined 20%+ WoW
    if (ctrRatio < 80) return { isFatigued: true, fatigueLevel: "fatigued" };
    if (ctrRatio < 90) return { isFatigued: false, fatigueLevel: "warning" };
    return { isFatigued: false, fatigueLevel: "none" };
  }

  // Meta
  if (frequency > 3.5 && ctrRatio < 85) return { isFatigued: true, fatigueLevel: "critical" };
  if (frequency > 3.5) return { isFatigued: true, fatigueLevel: "fatigued" };
  if (frequency > 2.5 || ctrRatio < 90) return { isFatigued: false, fatigueLevel: "warning" };
  return { isFatigued: false, fatigueLevel: "none" };
}

/* ── Main scoring function ── */

export function scoreCreative(input: ScoreInput): ScoreResult {
  const { platform, format, channelRole, spend, impressions } = input;

  const isProspecting = channelRole === "prospecting";
  const isVideo = format === "VID";
  const isGoogle = platform === "google" || format === "SEARCH";

  // ── Confidence thresholds ──
  const minSpend = isGoogle
    ? GOOGLE_BENCHMARKS.confidence.minSpend
    : platform === "tiktok"
      ? TIKTOK_BENCHMARKS.confidence.minSpend
      : META_BENCHMARKS.confidence.minSpend;

  if (spend < minSpend) {
    return {
      compositeScore: 0,
      label: "Learning",
      color: "text-slate-400",
      bgColor: "bg-slate-500/20 text-slate-400",
      scoredOn: "",
      notScoredOn: `Below £${minSpend} minimum spend threshold`,
      breakdown: [],
      warnings: [],
      isROASHidden: isProspecting,
      isLearning: true,
      isFatigued: false,
      fatigueLevel: "none",
    };
  }

  // ── Video metric availability ──
  const minImpressions = 5000;
  const videoMetricsAvailable = isVideo && impressions >= minImpressions;

  // ── Get weight set ──
  const weights = getWeights(platform, format, channelRole);
  const isROASHidden = isProspecting || !weights.roas;

  // ── Build breakdown ──
  const breakdown: ScoreBreakdownItem[] = [];
  const scoredMetrics: string[] = [];
  const notScoredMetrics: string[] = [];

  // Determine normalisation ranges — use platform-specific sets
  const socialRanges = platform === "tiktok" ? NORMALISATION_RANGES.tiktok : NORMALISATION_RANGES.meta;
  const googleRanges = NORMALISATION_RANGES.google;

  // Hook rate
  if (weights.hookRate) {
    if (videoMetricsAvailable || platform === "tiktok") {
      const raw = platform === "tiktok" ? (input.twoSecondViewRate ?? input.hookRate) : input.hookRate;
      const norm = normalise(raw, socialRanges.hookRate.min, socialRanges.hookRate.max);
      breakdown.push({ metric: platform === "tiktok" ? "Hook Rate (2s)" : "Hook Rate (3s)", rawValue: raw, normalisedValue: norm, weight: weights.hookRate, weightedScore: norm * weights.hookRate });
      scoredMetrics.push(platform === "tiktok" ? "hook rate (2s)" : "hook rate");
    } else if (isVideo) {
      notScoredMetrics.push("hook rate — insufficient reach (< 5,000 impressions)");
    }
  }

  // Hold rate
  if (weights.holdRate) {
    if (videoMetricsAvailable || platform === "tiktok") {
      const norm = normalise(input.holdRate, socialRanges.holdRate.min, socialRanges.holdRate.max);
      breakdown.push({ metric: "Hold Rate", rawValue: input.holdRate, normalisedValue: norm, weight: weights.holdRate, weightedScore: norm * weights.holdRate });
      scoredMetrics.push("hold rate");
    } else if (isVideo) {
      notScoredMetrics.push("hold rate — insufficient reach (< 5,000 impressions)");
    }
  }

  // CTR
  if (weights.ctr) {
    const ctrRange = isGoogle ? googleRanges.ctr : socialRanges.ctr;
    const norm = normalise(input.ctr, ctrRange.min, ctrRange.max);
    breakdown.push({ metric: "CTR", rawValue: input.ctr, normalisedValue: norm, weight: weights.ctr, weightedScore: norm * weights.ctr });
    scoredMetrics.push("CTR");
  }

  // CVR
  if (weights.cvr) {
    const norm = normalise(input.cvr, socialRanges.cvr.min, socialRanges.cvr.max);
    breakdown.push({ metric: "CVR", rawValue: input.cvr, normalisedValue: norm, weight: weights.cvr, weightedScore: norm * weights.cvr });
    scoredMetrics.push("CVR");
  }

  // ROAS (excluded from prospecting)
  if (weights.roas && !isProspecting) {
    const norm = normalise(input.roas, socialRanges.roas.min, socialRanges.roas.max);
    breakdown.push({ metric: "ROAS", rawValue: input.roas, normalisedValue: norm, weight: weights.roas, weightedScore: norm * weights.roas });
    scoredMetrics.push("ROAS");
  } else if (isProspecting) {
    notScoredMetrics.push("ROAS — prospecting ads are not expected to close purchases directly");
  }

  // Quality Score (Google only)
  if (weights.qualityScore && input.qualityScore !== undefined) {
    const norm = normalise(input.qualityScore, 1, 10);
    breakdown.push({ metric: "Quality Score", rawValue: input.qualityScore, normalisedValue: norm, weight: weights.qualityScore, weightedScore: norm * weights.qualityScore });
    scoredMetrics.push("quality score");
  }

  // CPA vs Target (Google only)
  if (weights.cpaVsTarget && input.targetCPA && input.cpa) {
    const ratio = input.cpa / input.targetCPA;
    // 0.5x target = 100 (great), 2x target = 0 (bad)
    const norm = normalise(ratio, 2, 0.5);
    breakdown.push({ metric: "CPA vs Target", rawValue: ratio, normalisedValue: norm, weight: weights.cpaVsTarget, weightedScore: norm * weights.cpaVsTarget });
    scoredMetrics.push("CPA vs target");
  }

  // Completion rate (TikTok)
  if (weights.completion && input.completionRate !== undefined) {
    const norm = normalise(input.completionRate, 0, 50);
    breakdown.push({ metric: "Completion Rate", rawValue: input.completionRate, normalisedValue: norm, weight: weights.completion, weightedScore: norm * weights.completion });
    scoredMetrics.push("completion rate");
  }

  // ── Compute composite score ──
  // Re-normalise weights to account for any excluded metrics
  const totalWeight = breakdown.reduce((sum, b) => sum + b.weight, 0);
  let compositeScore = 0;
  if (totalWeight > 0) {
    const rawScore = breakdown.reduce((sum, b) => sum + b.weightedScore, 0);
    compositeScore = Math.round(rawScore / totalWeight);
  }

  // ── Honest scoring rules ──
  const warnings: string[] = [];

  // Rule 3: Traffic quality warning
  if (
    input.hookRate > 28 &&
    input.holdRate > 42 &&
    input.ctr > 1.2 &&
    input.cvr < 0.3 &&
    input.targetCPA &&
    input.cpa &&
    input.cpa > input.targetCPA * 2
  ) {
    warnings.push(
      "Traffic quality issue: This creative is driving strong engagement but low conversion rate. " +
      "The problem is likely the landing page, the offer, or a targeting mismatch — not the creative. " +
      "Pause only after ruling out these factors."
    );
  }

  // ── Fatigue ──
  const fatigue = computeFatigue(input);

  // ── Label ──
  // Traffic quality issue overrides Kill → Review
  let scoreInfo = labelFromScore(compositeScore);
  if (warnings.length > 0 && scoreInfo.label === "Kill") {
    scoreInfo = labelFromScore(55); // "Review" tier
  }

  return {
    compositeScore,
    ...scoreInfo,
    scoredOn: scoredMetrics.join(", "),
    notScoredOn: notScoredMetrics.join("; "),
    breakdown,
    warnings,
    isROASHidden,
    isLearning: false,
    ...fatigue,
  };
}
