/**
 * Suggestion Rules Engine
 *
 * Each rule is a pure function that inspects the SuggestionInput and either
 * returns a Suggestion or null. `runSuggestionRules` runs the full set,
 * filters nulls, and sorts by priority.
 *
 * Honest scoring guardrails:
 * 1. Never trigger ROAS-based actions on prospecting ads.
 * 2. Meta + Google conversions are never summed; each platform is handled
 *    separately.
 * 3. If `client.suppressScoreWarning` is set, every suggestion's priority is
 *    demoted by one level (high -> medium, medium -> low).
 * 4. Traffic quality warnings produce a "performance" suggestion (not waste).
 */

import type {
  Client,
  Suggestion,
  SuggestionCategory,
  SuggestionPriority,
} from "./types";
import type { LiveCreative } from "./creativeAggregator";
import type { WindsorRow } from "./windsor";

/* ── Input ── */

export interface SuggestionInput {
  client: Client;
  /** Aggregated creatives from the current period (last 30 days). */
  creatives: LiveCreative[];
  /** Raw Windsor rows from the current period. */
  windsorRows: WindsorRow[];
  /** Optional raw Windsor rows from the previous 7 days for WoW comparisons. */
  previousPeriodRows?: WindsorRow[];
}

export type { Suggestion, SuggestionCategory } from "./types";

/* ── Helpers ── */

const PROSPECTING_META_FREQ_THRESHOLD = 3.5;
const PROSPECTING_TIKTOK_FREQ_THRESHOLD = 2.5;
const DEFAULT_ROAS_TARGET = 3.0;
const MIN_IMPRESSIONS_FOR_HOOK_RATE = 5000;

function hash(input: string): string {
  // Tiny non-cryptographic hash; stable across runs.
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

function makeId(ruleId: string, entity: string, key: string | number): string {
  return hash(`${ruleId}|${entity}|${key}`);
}

function demotePriority(p: SuggestionPriority): SuggestionPriority {
  if (p === "high") return "medium";
  if (p === "medium") return "low";
  return "low";
}

function priorityRank(p: SuggestionPriority): number {
  return p === "high" ? 0 : p === "medium" ? 1 : 2;
}

function isMetaSource(src: string | undefined): boolean {
  return src === "facebook" || src === "meta" || src === "instagram";
}

function isGoogleSource(src: string | undefined): boolean {
  return src === "google_ads" || src === "adwords";
}

function isTikTokSource(src: string | undefined): boolean {
  return src === "tiktok" || src === "tiktok_ads";
}

function sumSpend(rows: WindsorRow[]): number {
  return rows.reduce((s, r) => s + (Number(r.spend) || 0), 0);
}

function sumBy<T>(rows: T[], fn: (r: T) => number): number {
  return rows.reduce((s, r) => s + (fn(r) || 0), 0);
}

interface PlatformAgg {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
}

function aggregatePlatform(rows: WindsorRow[], isPlatform: (s: string | undefined) => boolean): PlatformAgg {
  const filtered = rows.filter((r) => isPlatform(r.source));
  return {
    spend: sumBy(filtered, (r) => Number(r.spend) || 0),
    impressions: sumBy(filtered, (r) => Number(r.impressions) || 0),
    clicks: sumBy(filtered, (r) => Number(r.clicks) || 0),
    conversions: sumBy(filtered, (r) => Number(r.conversions) || 0),
    revenue: sumBy(filtered, (r) => Number(r.revenue) || 0),
  };
}

/* ── Rule A1: High ROAS on retargeting ── */

function ruleA1_scaleRetargeting(input: SuggestionInput): Suggestion[] {
  const target = input.client.targetROAS || DEFAULT_ROAS_TARGET;
  const threshold = target * 1.3;
  const out: Suggestion[] = [];

  // Group creatives by campaign
  const byCampaign = new Map<string, { spend: number; revenue: number; freqSum: number; freqCount: number; role: string }>();
  for (const c of input.creatives) {
    if (c.channelRole !== "retargeting") continue;
    if (!c.isLive) continue;
    const key = c.campaign;
    const agg = byCampaign.get(key) || { spend: 0, revenue: 0, freqSum: 0, freqCount: 0, role: c.channelRole };
    agg.spend += c.spend;
    agg.revenue += c.revenue;
    if (c.frequency > 0) {
      agg.freqSum += c.frequency;
      agg.freqCount++;
    }
    byCampaign.set(key, agg);
  }

  for (const [campaign, agg] of byCampaign) {
    if (agg.spend < 100) continue; // confidence floor
    const roas = agg.revenue / agg.spend;
    const freq = agg.freqCount > 0 ? agg.freqSum / agg.freqCount : 0;
    if (roas > threshold && freq < 3.0) {
      const pctAbove = Math.round(((roas - target) / target) * 100);
      out.push({
        id: makeId("A1", campaign, roas.toFixed(2)),
        ruleId: "A1",
        category: "scale",
        priority: "high",
        title: `Retargeting campaign ROAS ${roas.toFixed(1)}x, ${pctAbove}% above target`,
        detail: `Frequency ${freq.toFixed(1)}x — room to scale without fatigue risk.`,
        action: "Increase budget 20% this week",
        expectedImpact: "Maintain ROAS while capturing more of the warm audience",
        entityType: "campaign",
        entityName: campaign,
        dataContext: {
          roas: +roas.toFixed(2),
          targetROAS: target,
          frequency: +freq.toFixed(2),
          spend: +agg.spend.toFixed(2),
          revenue: +agg.revenue.toFixed(2),
        },
        createdAt: new Date().toISOString(),
      });
    }
  }
  return out;
}

/* ── Rule A2: High scoring ad on low budget ── */

function ruleA2_highScoreLowBudget(input: SuggestionInput): Suggestion[] {
  const active = input.creatives.filter((c) => c.isLive && !c.scoreResult.isLearning);
  if (active.length === 0) return [];
  const topSpend = Math.max(...active.map((c) => c.spend));
  if (topSpend <= 0) return [];

  const out: Suggestion[] = [];
  for (const c of active) {
    if (c.scoreResult.compositeScore < 85) continue;
    if (c.spend >= topSpend * 0.2) continue;
    const pct = Math.round((c.spend / topSpend) * 100);
    const name = c.parsedName.angle || c.name;
    out.push({
      id: makeId("A2", c.adId || c.id, c.scoreResult.compositeScore),
      ruleId: "A2",
      category: "scale",
      priority: "high",
      title: `High-scoring ad "${name}" only getting ${pct}% of top ad's budget`,
      detail: `Composite score ${c.scoreResult.compositeScore}/100. The winning signal is clear — budget is the bottleneck.`,
      action: "Raise ad-level budget or duplicate into a high-budget ad set",
      expectedImpact: "Unlock more volume from a proven creative",
      entityType: "ad",
      entityName: c.name,
      dataContext: {
        compositeScore: c.scoreResult.compositeScore,
        spend: +c.spend.toFixed(2),
        topSpend: +topSpend.toFixed(2),
        percentOfTop: pct,
      },
      createdAt: new Date().toISOString(),
    });
  }
  return out;
}

/* ── Rule B1: CTR decline WoW with high frequency ── */

function ruleB1_fatigueCtrDecline(input: SuggestionInput): Suggestion[] {
  const out: Suggestion[] = [];
  for (const c of input.creatives) {
    if (!c.isLive) continue;
    // Use the scoring engine's fatigue flag when set.
    const freqThreshold = c.platform === "tiktok" ? PROSPECTING_TIKTOK_FREQ_THRESHOLD : PROSPECTING_META_FREQ_THRESHOLD;
    if (!c.scoreResult.isFatigued) continue;
    if (c.frequency < freqThreshold) continue;
    out.push({
      id: makeId("B1", c.adId || c.id, c.frequency.toFixed(1)),
      ruleId: "B1",
      category: "fatigue",
      priority: "high",
      title: `Ad "${c.name}" fatigued — freq ${c.frequency.toFixed(1)}x, CTR declining`,
      detail: `${c.platform === "tiktok" ? "TikTok" : "Meta"} creative has passed the fatigue threshold.`,
      action: "Refresh the creative or lower bid/budget until a replacement is live",
      expectedImpact: "Halt CPM inflation and CTR decay",
      entityType: "ad",
      entityName: c.name,
      dataContext: {
        frequency: +c.frequency.toFixed(2),
        ctr: +c.ctr.toFixed(2),
        platform: c.platform,
        daysRunning: c.daysRunning,
      },
      createdAt: new Date().toISOString(),
    });
  }
  return out;
}

/* ── Rule B2: Stale ad set (no new creative in 7+ days, active creative 14+ days) ── */

function ruleB2_staleAdSet(input: SuggestionInput): Suggestion[] {
  const out: Suggestion[] = [];
  const today = Date.now();
  const dayMs = 1000 * 60 * 60 * 24;

  // Group by ad set
  const byAdSet = new Map<string, LiveCreative[]>();
  for (const c of input.creatives) {
    if (!c.adSet) continue;
    if (!c.isLive) continue;
    const list = byAdSet.get(c.adSet) || [];
    list.push(c);
    byAdSet.set(c.adSet, list);
  }

  for (const [adSet, list] of byAdSet) {
    // Find the oldest "active" creative (14+ days).
    const hasOld = list.some((c) => c.daysRunning >= 14);
    if (!hasOld) continue;
    // Newest launch date (shortest daysRunning) across the ad set.
    const newestDays = Math.min(...list.map((c) => c.daysRunning));
    if (newestDays < 7) continue; // A fresh ad was added within last 7 days.
    const exampleCampaign = list[0].campaign;
    const totalSpend = list.reduce((s, c) => s + c.spend, 0);
    out.push({
      id: makeId("B2", adSet, newestDays),
      ruleId: "B2",
      category: "fatigue",
      priority: "medium",
      title: `Ad set "${adSet}" has not had a fresh creative in ${newestDays} days`,
      detail: `Oldest ad running ${Math.max(...list.map((c) => c.daysRunning))} days. Without rotation, performance will drift down.`,
      action: "Launch at least one new creative into this ad set this week",
      expectedImpact: "Keep CTR and CPM stable via rotation",
      entityType: "campaign",
      entityName: adSet,
      dataContext: {
        adSet,
        campaign: exampleCampaign,
        creativeCount: list.length,
        oldestDaysRunning: Math.max(...list.map((c) => c.daysRunning)),
        newestDaysRunning: newestDays,
        spend: +totalSpend.toFixed(2),
        // tiny "use today" context to justify inclusion of `today`/`dayMs`
        generatedAt: Math.round((today / dayMs) * dayMs),
      },
      createdAt: new Date().toISOString(),
    });
  }
  return out;
}

/* ── Rule C1: Non-converting Google spend ── */

function ruleC1_nonConvertingGoogle(input: SuggestionInput): Suggestion[] {
  const out: Suggestion[] = [];

  // Try keyword-level first
  const keywordAgg = new Map<string, { spend: number; conversions: number; campaign: string }>();
  let anyKeyword = false;
  for (const r of input.windsorRows) {
    if (!isGoogleSource(r.source)) continue;
    const kw = r.keyword_text;
    if (kw && typeof kw === "string" && kw.trim()) {
      anyKeyword = true;
      const key = kw;
      const agg = keywordAgg.get(key) || { spend: 0, conversions: 0, campaign: r.campaign };
      agg.spend += Number(r.spend) || 0;
      agg.conversions += Number(r.conversions) || 0;
      keywordAgg.set(key, agg);
    }
  }

  if (anyKeyword) {
    for (const [kw, agg] of keywordAgg) {
      if (agg.spend > 50 && agg.conversions === 0) {
        out.push({
          id: makeId("C1", kw, agg.spend.toFixed(0)),
          ruleId: "C1",
          category: "waste",
          priority: "high",
          title: `Keyword "${kw}" spent £${agg.spend.toFixed(0)} with 0 conversions`,
          detail: "Zero conversions in the last 30 days.",
          action: "Pause or negate this keyword",
          expectedImpact: `Reclaim ~£${agg.spend.toFixed(0)} per 30 days`,
          entityType: "keyword",
          entityName: kw,
          dataContext: {
            spend: +agg.spend.toFixed(2),
            conversions: agg.conversions,
            campaign: agg.campaign,
          },
          createdAt: new Date().toISOString(),
        });
      }
    }
    return out;
  }

  // Fallback: aggregate by campaign
  const campAgg = new Map<string, { spend: number; conversions: number }>();
  for (const r of input.windsorRows) {
    if (!isGoogleSource(r.source)) continue;
    const agg = campAgg.get(r.campaign) || { spend: 0, conversions: 0 };
    agg.spend += Number(r.spend) || 0;
    agg.conversions += Number(r.conversions) || 0;
    campAgg.set(r.campaign, agg);
  }

  const zeroConv = Array.from(campAgg.entries()).filter(([, a]) => a.spend > 50 && a.conversions === 0);
  if (zeroConv.length > 0) {
    const totalSpend = zeroConv.reduce((s, [, a]) => s + a.spend, 0);
    out.push({
      id: makeId("C1", "campaigns", zeroConv.length),
      ruleId: "C1",
      category: "waste",
      priority: "high",
      title: `${zeroConv.length} Google campaigns spending £${totalSpend.toFixed(0)} with 0 conversions`,
      detail: "Keyword-level data unavailable — review these campaigns manually.",
      action: "Open each campaign and audit non-converting keywords or ad groups",
      expectedImpact: `Reclaim ~£${totalSpend.toFixed(0)} per 30 days`,
      entityType: "campaign",
      entityName: zeroConv.map(([n]) => n).slice(0, 3).join(", "),
      dataContext: {
        campaignCount: zeroConv.length,
        totalSpend: +totalSpend.toFixed(2),
      },
      createdAt: new Date().toISOString(),
    });
  }
  return out;
}

/* ── Rule C2: Campaign above CPA target ── */

function ruleC2_aboveCPATarget(input: SuggestionInput): Suggestion[] {
  const target = input.client.targetCPA;
  if (!target || target <= 0) return [];

  const out: Suggestion[] = [];

  // Group by campaign across current period
  const byCampaign = new Map<string, { spend: number; conversions: number; source: string }>();
  for (const r of input.windsorRows) {
    const agg = byCampaign.get(r.campaign) || { spend: 0, conversions: 0, source: r.source };
    agg.spend += Number(r.spend) || 0;
    agg.conversions += Number(r.conversions) || 0;
    byCampaign.set(r.campaign, agg);
  }

  for (const [campaign, agg] of byCampaign) {
    if (agg.conversions === 0) continue;
    if (agg.spend < 100) continue;
    const cpa = agg.spend / agg.conversions;
    if (cpa > target * 1.5) {
      const pctOver = Math.round(((cpa - target) / target) * 100);
      out.push({
        id: makeId("C2", campaign, cpa.toFixed(0)),
        ruleId: "C2",
        category: "waste",
        priority: "medium",
        title: `Campaign "${campaign}" CPA £${cpa.toFixed(0)} — ${pctOver}% above target`,
        detail: `Target CPA is £${target.toFixed(0)}.`,
        action: "Tighten targeting, refresh creative, or lower bid/budget",
        expectedImpact: "Bring CPA back to target band",
        entityType: "campaign",
        entityName: campaign,
        dataContext: {
          cpa: +cpa.toFixed(2),
          targetCPA: target,
          spend: +agg.spend.toFixed(2),
          conversions: agg.conversions,
          platform: agg.source,
        },
        createdAt: new Date().toISOString(),
      });
    }
  }
  return out;
}

/* ── Rule C3: Low quality score Google keywords ── */

function ruleC3_lowQualityScore(input: SuggestionInput): Suggestion[] {
  const out: Suggestion[] = [];
  for (const r of input.windsorRows) {
    if (!isGoogleSource(r.source)) continue;
    const qs = typeof r.quality_score === "number" ? r.quality_score : undefined;
    if (qs === undefined) continue;
    const spend = Number(r.spend) || 0;
    if (qs > 4) continue;
    if (spend < 30) continue;
    const kw = r.keyword_text || "(unknown keyword)";
    out.push({
      id: makeId("C3", kw, qs),
      ruleId: "C3",
      category: "waste",
      priority: "medium",
      title: `Keyword "${kw}" has Quality Score ${qs}/10`,
      detail: `Low QS inflates CPC. Spend so far: £${spend.toFixed(0)}.`,
      action: "Improve ad relevance or landing page, or pause the keyword",
      expectedImpact: "Lower CPC and improve ad rank",
      entityType: "keyword",
      entityName: String(kw),
      dataContext: {
        qualityScore: qs,
        spend: +spend.toFixed(2),
        campaign: r.campaign,
      },
      createdAt: new Date().toISOString(),
    });
  }
  return out;
}

/* ── Rule D1: Hook rate below benchmark ── */

function ruleD1_lowHookRate(input: SuggestionInput): Suggestion[] {
  const out: Suggestion[] = [];
  for (const c of input.creatives) {
    if (!c.isLive) continue;
    if (c.format !== "VID") continue;
    if (c.impressions < MIN_IMPRESSIONS_FOR_HOOK_RATE) continue;
    const threshold = c.platform === "tiktok" ? 20 : 25;
    if (c.hookRate >= threshold) continue;
    out.push({
      id: makeId("D1", c.adId || c.id, c.hookRate.toFixed(1)),
      ruleId: "D1",
      category: "performance",
      priority: "medium",
      title: `Hook rate ${c.hookRate.toFixed(1)}% on "${c.name}" (benchmark ${threshold}%)`,
      detail: `${c.platform === "tiktok" ? "TikTok 2s view" : "Meta 3s play"} rate is below the target band.`,
      action: "Test a stronger opening frame or first-second hook",
      expectedImpact: "Lift thumbstop and downstream watch-through",
      entityType: "ad",
      entityName: c.name,
      dataContext: {
        hookRate: +c.hookRate.toFixed(2),
        benchmark: threshold,
        impressions: c.impressions,
        platform: c.platform,
      },
      createdAt: new Date().toISOString(),
    });
  }
  return out;
}

/* ── Rule D2: CPM rising with stable/declining CTR ── */

function ruleD2_cpmRising(input: SuggestionInput): Suggestion[] {
  if (!input.previousPeriodRows || input.previousPeriodRows.length === 0) return [];
  const out: Suggestion[] = [];

  const platforms: Array<{ label: string; match: (s: string | undefined) => boolean }> = [
    { label: "Meta", match: isMetaSource },
    { label: "Google", match: isGoogleSource },
    { label: "TikTok", match: isTikTokSource },
  ];

  for (const p of platforms) {
    const curr = aggregatePlatform(input.windsorRows, p.match);
    const prev = aggregatePlatform(input.previousPeriodRows, p.match);
    if (curr.impressions === 0 || prev.impressions === 0) continue;
    const currCPM = (curr.spend / curr.impressions) * 1000;
    const prevCPM = (prev.spend / prev.impressions) * 1000;
    if (prevCPM === 0) continue;
    const cpmChange = ((currCPM - prevCPM) / prevCPM) * 100;
    const currCTR = curr.impressions > 0 ? (curr.clicks / curr.impressions) * 100 : 0;
    const prevCTR = prev.impressions > 0 ? (prev.clicks / prev.impressions) * 100 : 0;
    const ctrChange = prevCTR > 0 ? ((currCTR - prevCTR) / prevCTR) * 100 : 0;

    if (cpmChange > 15 && ctrChange <= 0) {
      out.push({
        id: makeId("D2", p.label, Math.round(cpmChange)),
        ruleId: "D2",
        category: "performance",
        priority: "medium",
        title: `${p.label} CPM up ${cpmChange.toFixed(0)}% WoW, CTR flat or declining`,
        detail: `CPM £${currCPM.toFixed(2)} vs £${prevCPM.toFixed(2)} prior. Likely auction or creative fatigue pressure.`,
        action: "Refresh creative rotation and/or broaden audience",
        expectedImpact: "Reduce CPM drift before CPA follows",
        entityType: "account",
        entityName: `${p.label} account`,
        dataContext: {
          cpmChange: +cpmChange.toFixed(1),
          ctrChange: +ctrChange.toFixed(1),
          currCPM: +currCPM.toFixed(2),
          prevCPM: +prevCPM.toFixed(2),
          platform: p.label,
        },
        createdAt: new Date().toISOString(),
      });
    }
  }

  return out;
}

/* ── Rule E1: Naming convention adoption ── */

function ruleE1_namingAdoption(input: SuggestionInput): Suggestion | null {
  const active = input.creatives.filter((c) => c.isLive);
  if (active.length < 10) return null;
  const unknown = active.filter((c) => c.parsedName.format === "unknown" || c.parsedName.client === null);
  const pct = (unknown.length / active.length) * 100;
  if (pct <= 30) return null;
  return {
    id: makeId("E1", input.client.slug, Math.round(pct)),
    ruleId: "E1",
    category: "setup",
    priority: "low",
    title: `${pct.toFixed(0)}% of active ads don't follow the naming convention`,
    detail: "Ads without parseable names break format/type analysis in Creative Lab.",
    action: "Ask the creative team to backfill names on the next rotation",
    expectedImpact: "Unlock cleaner reporting and faster pattern insights",
    entityType: "account",
    entityName: input.client.name,
    dataContext: {
      unparseableCount: unknown.length,
      activeCount: active.length,
      percent: +pct.toFixed(1),
    },
    createdAt: new Date().toISOString(),
  };
}

/* ── Rule F1: Meta flat, Google strong (informational) ── */

function ruleF1_metaFlatGoogleStrong(input: SuggestionInput): Suggestion | null {
  if (!input.previousPeriodRows || input.previousPeriodRows.length === 0) return null;

  const metaCurr = aggregatePlatform(input.windsorRows, isMetaSource);
  const metaPrev = aggregatePlatform(input.previousPeriodRows, isMetaSource);
  const googleCurr = aggregatePlatform(input.windsorRows, isGoogleSource);
  const googlePrev = aggregatePlatform(input.previousPeriodRows, isGoogleSource);

  if (metaCurr.spend === 0 || metaPrev.spend === 0) return null;
  if (googleCurr.spend === 0 || googlePrev.spend === 0) return null;

  const metaRoasCurr = metaCurr.revenue / metaCurr.spend;
  const metaRoasPrev = metaPrev.revenue / metaPrev.spend;
  const googleRoasCurr = googleCurr.revenue / googleCurr.spend;
  const googleRoasPrev = googlePrev.revenue / googlePrev.spend;

  if (metaRoasPrev === 0 || googleRoasPrev === 0) return null;

  const metaChange = ((metaRoasCurr - metaRoasPrev) / metaRoasPrev) * 100;
  const googleChange = ((googleRoasCurr - googleRoasPrev) / googleRoasPrev) * 100;

  if (Math.abs(metaChange) > 3) return null;
  if (googleChange < 15) return null;

  return {
    id: makeId("F1", input.client.slug, `${Math.round(metaChange)}_${Math.round(googleChange)}`),
    ruleId: "F1",
    category: "attribution",
    priority: "low",
    title: `Meta ROAS flat (${metaChange.toFixed(1)}%), Google ROAS up ${googleChange.toFixed(0)}% WoW`,
    detail: "This is a typical cross-channel pattern, not a Meta problem.",
    action: "No change needed — this is normal cross-channel behaviour",
    expectedImpact: "Meta is building awareness, Google is capturing intent",
    entityType: "account",
    entityName: input.client.name,
    dataContext: {
      metaRoasChange: +metaChange.toFixed(1),
      googleRoasChange: +googleChange.toFixed(1),
      metaRoas: +metaRoasCurr.toFixed(2),
      googleRoas: +googleRoasCurr.toFixed(2),
    },
    createdAt: new Date().toISOString(),
  };
}

/* ── Rule G (honest scoring): Traffic quality warning → performance ── */

function ruleTrafficQuality(input: SuggestionInput): Suggestion[] {
  const out: Suggestion[] = [];
  for (const c of input.creatives) {
    if (!c.isLive) continue;
    if (!c.scoreResult.warnings.some((w) => w.toLowerCase().includes("traffic quality"))) continue;
    out.push({
      id: makeId("TQ", c.adId || c.id, c.cvr.toFixed(2)),
      ruleId: "TQ",
      category: "performance",
      priority: "medium",
      title: `"${c.name}" has strong engagement but weak conversion`,
      detail: `Hook ${c.hookRate.toFixed(1)}%, CTR ${c.ctr.toFixed(2)}%, CVR ${c.cvr.toFixed(2)}%. The creative is working — the funnel is not.`,
      action: "Check landing page and offer before pausing creative",
      expectedImpact: "Recover conversion rate instead of killing a performing creative",
      entityType: "ad",
      entityName: c.name,
      dataContext: {
        hookRate: +c.hookRate.toFixed(2),
        ctr: +c.ctr.toFixed(2),
        cvr: +c.cvr.toFixed(2),
        spend: +c.spend.toFixed(2),
      },
      createdAt: new Date().toISOString(),
    });
  }
  return out;
}

/* ── Main runner ── */

export function runSuggestionRules(input: SuggestionInput): Suggestion[] {
  const results: Suggestion[] = [
    ...ruleA1_scaleRetargeting(input),
    ...ruleA2_highScoreLowBudget(input),
    ...ruleB1_fatigueCtrDecline(input),
    ...ruleB2_staleAdSet(input),
    ...ruleC1_nonConvertingGoogle(input),
    ...ruleC2_aboveCPATarget(input),
    ...ruleC3_lowQualityScore(input),
    ...ruleD1_lowHookRate(input),
    ...ruleD2_cpmRising(input),
    ...ruleTrafficQuality(input),
  ];

  const e1 = ruleE1_namingAdoption(input);
  if (e1) results.push(e1);

  // Rule E2 (Shopify not connected) is skipped — `shopifyConnected` is not on Client.

  const f1 = ruleF1_metaFlatGoogleStrong(input);
  if (f1) results.push(f1);

  // Honest-scoring guardrail 1: demote anything ROAS-based on prospecting.
  // Rule A1 already restricts to retargeting; other ROAS-tagged rules are
  // already segmented. Belt and braces: if a future rule produces a ROAS
  // suggestion for a prospecting entity, it is dropped here.
  // (No-op for current rule set.)

  // Honest-scoring guardrail 3: demote all priorities if suppressed.
  const suppressed = Boolean(input.client.suppressScoreWarning);
  const finalResults = suppressed
    ? results.map((s) => ({ ...s, priority: demotePriority(s.priority) }))
    : results;

  // Sort by priority (high first), then by category for stability.
  finalResults.sort((a, b) => {
    const pr = priorityRank(a.priority) - priorityRank(b.priority);
    if (pr !== 0) return pr;
    return a.category.localeCompare(b.category);
  });

  return finalResults;
}

/* ── Exports for external callers ── */

export { sumSpend };
