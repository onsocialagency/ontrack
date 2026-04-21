/**
 * Windsor.ai API Client
 *
 * Connects to Meta Ads, Google Ads, and GA4 via Windsor's REST API.
 * Falls back to mock data when no API key is provided.
 *
 * API docs: https://connectors.windsor.ai/
 */

const WINDSOR_BASE = "https://connectors.windsor.ai";

/* ── Platform classification ─────────────────────────────────────────
 * Single source of truth for mapping a `WindsorRow.source` string to a
 * logical platform bucket. Windsor surfaces the same platform under
 * several source values (Meta = "facebook" | "meta" | "instagram";
 * Google = "google_ads" | "google" | "adwords"; TikTok = "tiktok" | "tiktok_ads").
 *
 * **Always** use this helper instead of writing `source === "facebook"`
 * checks inline — otherwise Instagram- and meta-sourced rows silently
 * drop out of Meta buckets on some pages.
 */
export type Platform = "meta" | "google" | "tiktok" | "other";

export function classifyPlatform(source: string | null | undefined): Platform {
  const s = (source ?? "").toLowerCase().trim();
  if (s === "facebook" || s === "meta" || s === "instagram" || s === "fb") {
    return "meta";
  }
  if (s === "google" || s === "google_ads" || s === "googleads" || s === "adwords") {
    return "google";
  }
  if (s === "tiktok" || s === "tiktok_ads" || s === "tt") {
    return "tiktok";
  }
  return "other";
}

export const isMetaSource = (source: string | null | undefined): boolean =>
  classifyPlatform(source) === "meta";

export const isGoogleSource = (source: string | null | undefined): boolean =>
  classifyPlatform(source) === "google";

export const isTikTokSource = (source: string | null | undefined): boolean =>
  classifyPlatform(source) === "tiktok";

/**
 * Sum conversions + revenue from a set of Windsor rows, applying the Google
 * primary→all_conversions fallback at the TOTAL level (never per-row).
 *
 * - Meta rows: primary `conversions`/`revenue` only (no secondary concept).
 * - Google rows: primary by default. If primary is zero across the entire
 *   range but all_conversions is non-zero, fall back to all_conversions. This
 *   covers clients like Ministry (GTM-imported lead forms logged as secondary)
 *   without contaminating clients whose primary column is correct (Laurastar).
 *
 * Use this in every client aggregator that mixes Meta + Google rows so the
 * behaviour is consistent everywhere.
 */
export function sumConversions(rows: WindsorRow[]): {
  total: number;
  meta: number;
  google: number;
  revenue: number;
  metaRevenue: number;
  googleRevenue: number;
  usedGoogleAllFallback: boolean;
} {
  let meta = 0, google = 0, googleAll = 0;
  let metaRevenue = 0, googleRevenue = 0, googleAllRevenue = 0;
  for (const r of rows) {
    const conv = Number(r.conversions) || 0;
    const rev = Number(r.revenue) || 0;
    const platform = classifyPlatform(r.source);
    if (platform === "meta") {
      meta += conv;
      metaRevenue += rev;
    } else if (platform === "google") {
      google += conv;
      googleRevenue += rev;
      googleAll += Number(r.all_conversions) || 0;
      googleAllRevenue += Number(r.all_conversion_value) || 0;
    }
  }
  const usedGoogleAllFallback = google === 0 && googleAll > 0;
  if (usedGoogleAllFallback) {
    google = googleAll;
    if (googleRevenue === 0) googleRevenue = googleAllRevenue;
  }
  return {
    total: meta + google,
    meta,
    google,
    revenue: metaRevenue + googleRevenue,
    metaRevenue,
    googleRevenue,
    usedGoogleAllFallback,
  };
}

/** Row-level helper mirroring sumConversions, for daily aggregation. Pass
 *  the `usedGoogleAllFallback` flag from the totals pass so daily buckets
 *  stay consistent with range totals. */
export function rowConversions(r: WindsorRow, useGoogleAllFallback: boolean): { conversions: number; revenue: number } {
  const platform = classifyPlatform(r.source);
  if (platform === "google" && useGoogleAllFallback) {
    return {
      conversions: Number(r.all_conversions) || 0,
      revenue: Number(r.all_conversion_value) || Number(r.revenue) || 0,
    };
  }
  return {
    conversions: Number(r.conversions) || 0,
    revenue: Number(r.revenue) || 0,
  };
}


interface WindsorParams {
  apiKey: string;
  fields: string[];
  datePreset?: string;
  dateFrom?: string;
  dateTo?: string;
  source?: "facebook" | "google_ads" | "tiktok" | "all";
}

export interface WindsorRow {
  date: string;
  source: string;
  campaign: string;
  account_name?: string;
  account_id?: string;
  adset?: string;
  ad_name?: string;
  ad_id?: string;
  spend: number;
  impressions: number;
  clicks: number;
  /** Meta only: link clicks (excludes likes/comments/reactions/profile taps).
   *  Matches Meta Ads Manager's default "CTR (link click-through rate)". */
  link_clicks?: number;
  conversions: number;
  /** Google only: all_conversions (primary + secondary/imported events).
   *  Exposed so aggregators can choose to fall back when a client's
   *  primary-conversion setup is empty (e.g. Ministry's GTM-imported leads).
   *  DO NOT SUM for clients whose Google UI "Conversions" column is correct —
   *  this inflates totals by secondary events (add_to_cart, page_view, etc). */
  all_conversions?: number;
  revenue: number;
  /** Google only: all_conversion_value counterpart to all_conversions. */
  all_conversion_value?: number;
  // Video metrics (Facebook)
  video_plays?: number;
  video_thruplay?: number;
  video_p25?: number;
  video_p50?: number;
  video_p75?: number;
  video_p95?: number;
  video_p100?: number;
  video_30s?: number;
  video_avg_time?: number;
  // Creative data
  frequency?: number;
  thumbnail_url?: string;
  body?: string;
  title?: string;
  created_time?: string;
  user_segment?: string;
  website_ctr?: number;
  website_destination_url?: string;
  website_purchase_roas?: number;
  // Google Ads
  keyword_text?: string;
  keyword_match_type?: string;
  ad_headlines?: string;
  ad_descriptions?: string;
  ad_final_urls?: string;
  objective?: string;
  // Google Ads — Quality Score components (keyword-level)
  quality_score?: number;
  expected_ctr?: string;         // "ABOVE_AVERAGE" | "AVERAGE" | "BELOW_AVERAGE"
  ad_relevance?: string;         // "ABOVE_AVERAGE" | "AVERAGE" | "BELOW_AVERAGE"
  landing_page_experience?: string; // "ABOVE_AVERAGE" | "AVERAGE" | "BELOW_AVERAGE"
  average_cpc?: number;
  cost_per_conversion?: number;
  // Google Ads — RSA asset-level
  asset_performance_label?: string; // "BEST" | "GOOD" | "LOW" | "LEARNING" | "UNRATED"
  ad_strength?: string;           // "EXCELLENT" | "GOOD" | "AVERAGE" | "POOR"
  headline?: string;
  description?: string;
  // Google Ads — Search terms
  search_term?: string;
  // TikTok
  video_watched_2s?: number;
  video_watched_6s?: number;
  average_video_play?: number;
  ad_group_name?: string;
  [key: string]: string | number | undefined;
}

async function fetchRaw(params: WindsorParams): Promise<Record<string, unknown>[]> {
  const url = new URL(`${WINDSOR_BASE}/${params.source || "all"}`);
  url.searchParams.set("api_key", params.apiKey);
  url.searchParams.set("fields", params.fields.join(","));
  url.searchParams.set("_renderer", "json");

  if (params.datePreset) {
    url.searchParams.set("date_preset", params.datePreset);
  }
  if (params.dateFrom) {
    url.searchParams.set("date_from", params.dateFrom);
  }
  if (params.dateTo) {
    url.searchParams.set("date_to", params.dateTo);
  }

  console.log(`[Windsor] Fetching: ${url.toString().replace(/api_key=[^&]+/, 'api_key=***')}`);

  const res = await fetch(url.toString(), {
    cache: "no-store",
  });

  if (!res.ok) {
    console.error(`[Windsor] Error: ${res.status} ${res.statusText}`);
    throw new Error(`Windsor API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const rows = data.data || data || [];
  console.log(`[Windsor] Got ${rows.length} rows from ${params.source}. Sample keys: ${rows[0] ? Object.keys(rows[0]).join(', ') : 'none'}`);
  return rows;
}

/**
 * Extract a numeric value from Facebook's actions array.
 * Returns BOTH the matching action_type AND the value, so callers can look up
 * the corresponding revenue for the SAME action type (avoids the classic
 * count/value mismatch where conversions uses `purchase` but value uses
 * `offsite_conversion.fb_pixel_purchase`, inflating ROAS).
 * Facebook returns conversions as: actions: [{ action_type: "purchase", value: "23" }, ...]
 */
function extractAction(
  actions: { action_type: string; value: string }[] | undefined,
  actionTypes: string[],
): { value: number; matchedType: string | null } {
  if (!actions || !Array.isArray(actions)) return { value: 0, matchedType: null };
  for (const type of actionTypes) {
    const found = actions.find((a) => a.action_type === type);
    if (found) return { value: Number(found.value) || 0, matchedType: type };
  }
  return { value: 0, matchedType: null };
}

/** Look up a specific action_type's value in action_values. Used to pair the
 *  revenue to the exact purchase-action that was counted. */
function findActionValue(
  actionValues: { action_type: string; value: string }[] | undefined,
  actionType: string | null,
): number {
  if (!actionType || !actionValues || !Array.isArray(actionValues)) return 0;
  const found = actionValues.find((a) => a.action_type === actionType);
  return found ? Number(found.value) || 0 : 0;
}

/* ── Facebook conversion action types by category ──
 * Ordered by priority (first match wins). The top choice on each list is the
 * aggregated action the Meta Ads Manager UI shows by default — secondary
 * entries are covered only when the primary is missing (e.g. pre-Omni
 * accounts that only log pixel events). Count and value extraction use the
 * same list so the row-level ROAS matches Meta's UI. */

/** Ecommerce / purchase conversion events. `purchase` and `omni_purchase` are
 *  Meta's aggregated cross-surface totals — they match the "Purchases" column
 *  in Ads Manager. Pixel/onsite/web_app/offline entries are fallbacks for
 *  accounts that don't emit an aggregated `purchase` action. */
const FB_PURCHASE_ACTIONS = [
  "purchase",
  "omni_purchase",
  "onsite_web_purchase",
  "onsite_web_app_purchase",
  "web_app_purchase",
  "offsite_conversion.fb_pixel_purchase",
  "offline_conversion.fb_pixel_purchase",
];

/** Lead / enquiry conversion events. `lead` is Meta's aggregated total —
 *  matches the "Leads" column in Ads Manager. `complete_registration`
 *  covers accounts whose lead event is logged as registration. */
const FB_LEAD_ACTIONS = [
  "lead",
  "complete_registration",
  "onsite_web_lead",
  "offsite_conversion.fb_pixel_lead",
  "offsite_conversion.fb_pixel_complete_registration",
  "offsite_conversion.fb_pixel_custom",
];

/**
 * Normalize raw Windsor data from different sources into a common WindsorRow format.
 *
 * For Facebook, we extract conversions from the actions array. The logic is:
 * 1. Try purchase-type actions first (ecommerce clients)
 * 2. If no purchases found, try lead-type actions (lead gen clients)
 * 3. Use whichever has a higher count (handles accounts with both)
 *
 * This ensures lead gen accounts like The Ministry pick up lead, fb_pixel_lead,
 * and fb_pixel_custom events instead of returning 0.
 */
function normalizeRow(raw: Record<string, unknown>, source: string): WindsorRow {
  // Facebook uses campaign_name, Google uses campaign
  const campaign = String(raw.campaign_name || raw.campaign || "Unknown");
  const spend = Number(raw.spend) || 0;
  const impressions = Number(raw.impressions) || 0;
  const clicks = Number(raw.clicks) || 0;
  // Meta only — used to compute link CTR that matches Ads Manager's default.
  const linkClicksRaw = Number(raw.inline_link_clicks);
  const linkClicks = source === "facebook" && Number.isFinite(linkClicksRaw) && linkClicksRaw > 0
    ? linkClicksRaw
    : undefined;

  let conversions = 0;
  let revenue = 0;

  if (source === "facebook") {
    // Facebook: extract from actions/action_values arrays. Mirrors the Google
    // logic: prefer the aggregated UI-facing action (`purchase` / `lead`),
    // fall back to pixel/onsite/offline events only if the aggregated one is
    // missing. Count and value always resolve against the same action_type so
    // row-level ROAS can't diverge from Ads Manager.
    const actions = raw.actions as { action_type: string; value: string }[] | undefined;
    const actionValues = raw.action_values as { action_type: string; value: string }[] | undefined;

    const purchase = extractAction(actions, FB_PURCHASE_ACTIONS);
    // Lead extraction: "first match wins" in priority order (not sum) — Meta
    // often emits `lead` alongside `fb_pixel_lead` as the same event, summing
    // would double-count.
    const lead = extractAction(actions, FB_LEAD_ACTIONS);

    // Use whichever category has more conversions. Keep the matched action so
    // revenue looks up the same row in action_values.
    if (purchase.value >= lead.value) {
      conversions = purchase.value;
      revenue = findActionValue(actionValues, purchase.matchedType);
    } else {
      conversions = lead.value;
      revenue = 0; // Lead events don't carry revenue
    }
  } else {
    // Google Ads: direct fields
    //
    // `conversions` = primary conversion actions (matches Google Ads UI
    //   default "Conversions" column).
    // `all_conversions` = primary + secondary/imported actions (e.g. GTM
    //   imports, store visits, phone calls, lead form fills marked secondary).
    //
    // We emit PRIMARY conversions only in `conversions` so totals match the
    // Google Ads UI "Conversions" column exactly. `all_conversions` is also
    // exposed on the row for aggregators that want an account-level fallback
    // (e.g. Ministry: GTM-imported lead forms logged as secondary).
    //
    // The previous per-row fallback (`primary > 0 ? primary : all`) caused
    // totals like Laurastar's 159 when the UI says 16 — any day with 0
    // primary silently swapped in all_conversions, which counts secondary
    // events (add_to_cart, page_view, etc).
    //
    // We deliberately do NOT round per row — Google data-driven attribution
    // reports fractional conversions (e.g. 0.4/day) and rounding systematically
    // under-counts over long ranges. Downstream display formats the final total.
    conversions = Number(raw.conversions) || 0;
    revenue = Number(raw.conversion_value) || 0;
  }

  const allConvRaw = source !== "facebook" ? Number(raw.all_conversions) : NaN;
  const allConvValueRaw = source !== "facebook" ? Number(raw.all_conversion_value) : NaN;

  return {
    date: String(raw.date_start || raw.date || ""),
    source,
    campaign,
    account_name: String(raw.account_name || ""),
    account_id: String(raw.account_id || ""),
    spend,
    impressions,
    clicks,
    link_clicks: linkClicks,
    conversions,
    all_conversions: Number.isFinite(allConvRaw) ? allConvRaw : undefined,
    revenue,
    all_conversion_value: Number.isFinite(allConvValueRaw) ? allConvValueRaw : undefined,
  };
}

/* ── Field sets per source ── */

const FACEBOOK_CAMPAIGN_FIELDS = [
  "date_start",
  "account_name",
  "account_id",
  "campaign_name",
  "spend",
  "impressions",
  "clicks",
  "inline_link_clicks",
  "actions",
  "action_values",
  "frequency",
];

const GOOGLE_CAMPAIGN_FIELDS = [
  "date",
  "account_name",
  "account_id",
  "campaign",
  "spend",
  "impressions",
  "clicks",
  "conversions",
  "conversion_value",
  "all_conversions",
  "all_conversion_value",
];

// Windsor API limitation: `actions`/`action_values` and dedicated `video_play_actions_*`
// fields are mutually exclusive. When requested together, video fields return null.
// We split into two parallel requests and merge by ad_id + date.
const FACEBOOK_CREATIVE_FIELDS = [
  "date_start",
  "account_name",
  "account_id",
  "campaign_name",
  "adset_name",
  "ad_name",
  "ad_id",
  "spend",
  "impressions",
  "clicks",
  "inline_link_clicks",
  "actions",
  "action_values",
  "frequency",
  // Corrected field names (validated against Windsor API)
  "thumbnail_url",          // was: creative_thumbnail_url
  "body",                   // was: ad_creative_body
  "title",                  // was: ad_creative_title
  "ad_created_time",        // was: created_time
  "user_segment",
  "website_destination_url",
  "website_ctr_link_click",
  "website_purchase_roas_offsite_conversion_fb_pixel_purchase",
  "objective",
];

// Separate request for video metrics (cannot combine with actions/action_values)
const FACEBOOK_VIDEO_FIELDS = [
  "date_start",
  "ad_id",
  "ad_name",
  "video_play_actions_video_view",
  "video_thruplay_watched_actions_video_view",
  "video_p25_watched_actions_video_view",
  "video_p50_watched_actions_video_view",
  "video_p75_watched_actions_video_view",
  "video_p95_watched_actions_video_view",
  "video_p100_watched_actions_video_view",
  "video_30_sec_watched_actions_video_view",
  "video_avg_time_watched_actions_video_view",
];

// Google Ads: ad-level fields (keywords must be fetched separately due to API restrictions)
const GOOGLE_AD_FIELDS = [
  "date",
  "account_name",
  "account_id",
  "campaign",
  "ad_group_name",
  "ad_name",
  "ad_id",
  "spend",
  "impressions",
  "clicks",
  "conversions",
  "conversion_value",
  "all_conversions",
  "all_conversion_value",
  "ad_final_urls",
  "ad_responsive_search_ad_headlines_combined_text",
  "ad_responsive_search_ad_descriptions_combined_text",
];

// Google Ads: keyword-level fields (can't combine with ad-level fields)
const GOOGLE_KEYWORD_FIELDS = [
  "date",
  "campaign",
  "keyword_text",
  "keyword_match_type",
  "spend",
  "impressions",
  "clicks",
];

/* ── Public API ── */

/**
 * Fetch campaign data from both Meta and Google, normalize to common format.
 */
export async function getWindsorCampaignData(
  apiKey: string,
  days = 30,
  dateRange?: { dateFrom: string; dateTo: string },
): Promise<WindsorRow[]> {
  // When an explicit date range is provided, use dateFrom/dateTo; otherwise use preset
  const dateParams: Pick<WindsorParams, "datePreset" | "dateFrom" | "dateTo"> = dateRange
    ? { dateFrom: dateRange.dateFrom, dateTo: dateRange.dateTo }
    : { datePreset: `last_${days}d` };
  const results: WindsorRow[] = [];

  // Fetch Facebook and Google in parallel
  const [fbRaw, gRaw] = await Promise.allSettled([
    fetchRaw({ apiKey, fields: FACEBOOK_CAMPAIGN_FIELDS, ...dateParams, source: "facebook" }),
    fetchRaw({ apiKey, fields: GOOGLE_CAMPAIGN_FIELDS, ...dateParams, source: "google_ads" }),
  ]);

  if (fbRaw.status === "fulfilled") {
    for (const row of fbRaw.value) {
      results.push(normalizeRow(row, "facebook"));
    }
  }

  if (gRaw.status === "fulfilled") {
    for (const row of gRaw.value) {
      results.push(normalizeRow(row, "google_ads"));
    }
  }

  return results;
}

/**
 * Extract a numeric value from a Windsor video metric field.
 * Windsor returns these as either a number or an array like [{ action_type: "video_view", value: "589" }]
 */
function extractVideoMetric(val: unknown): number {
  if (!val) return 0;
  if (typeof val === "number") return val;
  if (typeof val === "string") return Number(val) || 0;
  if (Array.isArray(val) && val.length > 0) {
    return Number(val[0]?.value) || 0;
  }
  return 0;
}

/**
 * Fetch ad-level data with creative metrics for Creative Lab (Meta + Google)
 */
export async function getWindsorCreativeData(
  apiKey: string,
  days = 30,
  dateRange?: { dateFrom: string; dateTo: string },
): Promise<WindsorRow[]> {
  const dateParams: Pick<WindsorParams, "datePreset" | "dateFrom" | "dateTo"> = dateRange
    ? { dateFrom: dateRange.dateFrom, dateTo: dateRange.dateTo }
    : { datePreset: `last_${days}d` };
  const results: WindsorRow[] = [];

  // Fetch Facebook creative data, video metrics, and Google ads in parallel.
  // Video metrics must be a separate call because Windsor returns null for
  // video_play_actions_* fields when combined with actions/action_values.
  const [fbRaw, fbVideoRaw, gRaw] = await Promise.allSettled([
    fetchRaw({
      apiKey,
      fields: FACEBOOK_CREATIVE_FIELDS,
      ...dateParams,
      source: "facebook",
    }),
    fetchRaw({
      apiKey,
      fields: FACEBOOK_VIDEO_FIELDS,
      ...dateParams,
      source: "facebook",
    }),
    fetchRaw({
      apiKey,
      fields: GOOGLE_AD_FIELDS,
      ...dateParams,
      source: "google_ads",
    }),
  ]);

  // Build a lookup map from the video metrics response: key = "ad_id|date"
  const videoMap = new Map<string, Record<string, unknown>>();
  if (fbVideoRaw.status === "fulfilled") {
    for (const vRow of fbVideoRaw.value) {
      const key = `${vRow.ad_id}|${vRow.date_start}`;
      videoMap.set(key, vRow);
    }
    console.log(`[Windsor] Video metrics: ${fbVideoRaw.value.length} rows, ${videoMap.size} unique ad+date entries`);
  }

  if (fbRaw.status === "fulfilled") {
    for (const row of fbRaw.value) {
      const normalized = normalizeRow(row, "facebook");

      // Look up video metrics from the separate fetch
      const videoKey = `${row.ad_id}|${row.date_start}`;
      const vRow = videoMap.get(videoKey);

      const videoPlays = vRow ? extractVideoMetric(vRow.video_play_actions_video_view) : 0;
      const videoThruplay = vRow ? extractVideoMetric(vRow.video_thruplay_watched_actions_video_view) : 0;
      const videoP25 = vRow ? extractVideoMetric(vRow.video_p25_watched_actions_video_view) : 0;
      const videoP50 = vRow ? extractVideoMetric(vRow.video_p50_watched_actions_video_view) : 0;
      const videoP75 = vRow ? extractVideoMetric(vRow.video_p75_watched_actions_video_view) : 0;
      const videoP95 = vRow ? extractVideoMetric(vRow.video_p95_watched_actions_video_view) : 0;
      const videoP100 = vRow ? extractVideoMetric(vRow.video_p100_watched_actions_video_view) : 0;
      const video30s = vRow ? extractVideoMetric(vRow.video_30_sec_watched_actions_video_view) : 0;
      const videoAvgTime = vRow ? extractVideoMetric(vRow.video_avg_time_watched_actions_video_view) : 0;

      results.push({
        ...normalized,
        adset: String(row.adset_name || ""),
        ad_name: String(row.ad_name || ""),
        ad_id: String(row.ad_id || ""),
        frequency: Number(row.frequency) || 0,
        thumbnail_url: String(row.thumbnail_url || ""),
        body: String(row.body || ""),
        title: String(row.title || ""),
        created_time: String(row.ad_created_time || ""),
        user_segment: String(row.user_segment || ""),
        website_destination_url: String(row.website_destination_url || ""),
        website_ctr: Number(row.website_ctr_link_click) || 0,
        website_purchase_roas: Number(row.website_purchase_roas_offsite_conversion_fb_pixel_purchase) || 0,
        video_plays: videoPlays,
        video_thruplay: videoThruplay,
        video_p25: videoP25,
        video_p50: videoP50,
        video_p75: videoP75,
        video_p95: videoP95,
        video_p100: videoP100,
        video_30s: video30s,
        video_avg_time: videoAvgTime,
      });
    }
  }

  if (gRaw.status === "fulfilled") {
    for (const row of gRaw.value) {
      const normalized = normalizeRow(row, "google_ads");
      results.push({
        ...normalized,
        adset: String(row.ad_group_name || ""),
        ad_name: String(row.ad_name || ""),
        ad_id: String(row.ad_id || ""),
        ad_headlines: String(row.ad_responsive_search_ad_headlines_combined_text || ""),
        ad_descriptions: String(row.ad_responsive_search_ad_descriptions_combined_text || ""),
        ad_final_urls: String(row.ad_final_urls || ""),
      });
    }
  }

  return results;
}

/**
 * Fetch keyword-level data from Google Ads (separate from ad-level due to API restrictions)
 */
export async function getWindsorKeywordData(
  apiKey: string,
  days = 30,
): Promise<WindsorRow[]> {
  const results: WindsorRow[] = [];

  try {
    const raw = await fetchRaw({
      apiKey,
      fields: GOOGLE_KEYWORD_FIELDS,
      datePreset: `last_${days}d`,
      source: "google_ads",
    });

    for (const row of raw) {
      results.push({
        date: String(row.date || ""),
        source: "google_ads",
        campaign: String(row.campaign || ""),
        spend: Number(row.spend) || 0,
        impressions: Number(row.impressions) || 0,
        clicks: Number(row.clicks) || 0,
        conversions: 0,
        revenue: 0,
        keyword_text: String(row.keyword_text || ""),
        keyword_match_type: String(row.keyword_match_type || ""),
      });
    }
  } catch {
    // Keywords are supplementary — don't fail the whole request
  }

  return results;
}

/* ── Creative Lab — additional fetch functions ── */

import { buildCacheKey, getCached, setCache } from "./windsor-cache";

/** Google Ads RSA asset-level data — per-headline/description performance labels */
const GOOGLE_RSA_ASSET_FIELDS = [
  "date", "campaign", "ad_group_name", "ad_id",
  "headline", "description",
  "asset_performance_label", "ad_strength",
  "impressions", "clicks", "conversions", "conversion_value", "spend",
];

export async function getWindsorRSAAssetData(
  apiKey: string,
  days = 30,
  dateRange?: { dateFrom: string; dateTo: string },
): Promise<WindsorRow[]> {
  const cacheKey = buildCacheKey("rsa_assets", apiKey, days, dateRange?.dateFrom, dateRange?.dateTo);
  const cached = getCached<WindsorRow[]>(cacheKey);
  if (cached) return cached;

  const results: WindsorRow[] = [];
  try {
    const raw = await fetchRaw({
      apiKey,
      fields: GOOGLE_RSA_ASSET_FIELDS,
      ...(dateRange ? { dateFrom: dateRange.dateFrom, dateTo: dateRange.dateTo } : { datePreset: `last_${days}d` }),
      source: "google_ads",
    });
    for (const row of raw) {
      results.push({
        date: String(row.date || ""),
        source: "google_ads",
        campaign: String(row.campaign || ""),
        ad_group_name: String(row.ad_group_name || ""),
        ad_id: String(row.ad_id || ""),
        headline: String(row.headline || ""),
        description: String(row.description || ""),
        asset_performance_label: String(row.asset_performance_label || ""),
        ad_strength: String(row.ad_strength || ""),
        spend: Number(row.spend) || 0,
        impressions: Number(row.impressions) || 0,
        clicks: Number(row.clicks) || 0,
        conversions: Number(row.conversions) || 0,
        revenue: Number(row.conversion_value) || 0,
      });
    }
  } catch { /* supplementary — don't fail */ }

  setCache(cacheKey, results);
  return results;
}

/** Google Ads keyword data with quality score components */
const GOOGLE_KEYWORD_QS_FIELDS = [
  "date", "campaign", "ad_group_name",
  "keyword_text", "keyword_match_type",
  "quality_score", "expected_ctr", "ad_relevance", "landing_page_experience",
  "spend", "impressions", "clicks", "conversions", "conversion_value",
  "average_cpc", "cost_per_conversion",
];

export async function getWindsorKeywordQSData(
  apiKey: string,
  days = 30,
  dateRange?: { dateFrom: string; dateTo: string },
): Promise<WindsorRow[]> {
  const cacheKey = buildCacheKey("keyword_qs", apiKey, days, dateRange?.dateFrom, dateRange?.dateTo);
  const cached = getCached<WindsorRow[]>(cacheKey);
  if (cached) return cached;

  const results: WindsorRow[] = [];
  try {
    const raw = await fetchRaw({
      apiKey,
      fields: GOOGLE_KEYWORD_QS_FIELDS,
      ...(dateRange ? { dateFrom: dateRange.dateFrom, dateTo: dateRange.dateTo } : { datePreset: `last_${days}d` }),
      source: "google_ads",
    });
    for (const row of raw) {
      results.push({
        date: String(row.date || ""),
        source: "google_ads",
        campaign: String(row.campaign || ""),
        ad_group_name: String(row.ad_group_name || ""),
        keyword_text: String(row.keyword_text || ""),
        keyword_match_type: String(row.keyword_match_type || ""),
        quality_score: Number(row.quality_score) || undefined,
        expected_ctr: String(row.expected_ctr || ""),
        ad_relevance: String(row.ad_relevance || ""),
        landing_page_experience: String(row.landing_page_experience || ""),
        spend: Number(row.spend) || 0,
        impressions: Number(row.impressions) || 0,
        clicks: Number(row.clicks) || 0,
        conversions: Number(row.conversions) || 0,
        revenue: Number(row.conversion_value) || 0,
        average_cpc: Number(row.average_cpc) || 0,
        cost_per_conversion: Number(row.cost_per_conversion) || 0,
      });
    }
  } catch { /* supplementary */ }

  setCache(cacheKey, results);
  return results;
}

/** Google Ads search term report — the actual queries people typed */
const GOOGLE_SEARCH_TERM_FIELDS = [
  "date", "campaign", "ad_group_name",
  "search_term", "keyword_text", "keyword_match_type",
  "spend", "impressions", "clicks", "conversions", "conversion_value",
  "cost_per_conversion",
];

export async function getWindsorSearchTermData(
  apiKey: string,
  days = 30,
  dateRange?: { dateFrom: string; dateTo: string },
): Promise<WindsorRow[]> {
  const cacheKey = buildCacheKey("search_terms", apiKey, days, dateRange?.dateFrom, dateRange?.dateTo);
  const cached = getCached<WindsorRow[]>(cacheKey);
  if (cached) return cached;

  const results: WindsorRow[] = [];
  try {
    const raw = await fetchRaw({
      apiKey,
      fields: GOOGLE_SEARCH_TERM_FIELDS,
      ...(dateRange ? { dateFrom: dateRange.dateFrom, dateTo: dateRange.dateTo } : { datePreset: `last_${days}d` }),
      source: "google_ads",
    });
    for (const row of raw) {
      results.push({
        date: String(row.date || ""),
        source: "google_ads",
        campaign: String(row.campaign || ""),
        ad_group_name: String(row.ad_group_name || ""),
        search_term: String(row.search_term || ""),
        keyword_text: String(row.keyword_text || ""),
        keyword_match_type: String(row.keyword_match_type || ""),
        spend: Number(row.spend) || 0,
        impressions: Number(row.impressions) || 0,
        clicks: Number(row.clicks) || 0,
        conversions: Number(row.conversions) || 0,
        revenue: Number(row.conversion_value) || 0,
        cost_per_conversion: Number(row.cost_per_conversion) || 0,
      });
    }
  } catch { /* supplementary */ }

  setCache(cacheKey, results);
  return results;
}

/* ── HubSpot (CRM) via Windsor ────────────────────────────────────────
 * Windsor proxies HubSpot under /hubspot using the same API key as Meta +
 * Google. There is no separate HubSpot private-app token. All contact
 * properties are exposed with a `contact_` prefix.
 *
 * Used by Ministry's CRM reconciliation (/ministry/crm) to compare
 * platform-reported conversions against HubSpot-confirmed leads.
 */

export type HubSpotAnalyticsSource =
  | "PAID_SOCIAL"
  | "PAID_SEARCH"
  | "ORGANIC_SEARCH"
  | "DIRECT_TRAFFIC"
  | "REFERRALS"
  | "SOCIAL_MEDIA"
  | "EMAIL_MARKETING"
  | "OTHER_CAMPAIGNS"
  | "OFFLINE"
  | string;

export interface HubSpotContact {
  hsObjectId: string;
  email: string;
  firstname: string;
  lastname: string;
  company: string | null;
  phone: string | null;
  lifecyclestage: string | null;
  leadStatus: string | null;
  createdate: string;
  firstConversionDate: string | null;
  recentConversionDate: string | null;
  firstConversionEventName: string | null;
  recentConversionEventName: string | null;
  analyticsSource: HubSpotAnalyticsSource | null;
  latestSource: HubSpotAnalyticsSource | null;
  analyticsSourceData1: string | null;
  analyticsSourceData2: string | null;
  latestSourceData1: string | null;
  latestSourceData2: string | null;
  firstUrl: string | null;
  lastUrl: string | null;
  firstReferrer: string | null;
  lastReferrer: string | null;
  numConversionEvents: number;
  numAssociatedDeals: number;
  ownerId: string | null;
  message: string | null;
  /** HubSpot-captured Google click ID (gclid). Presence proves the contact
   *  came from a Google Ads click. */
  googleClickId: string | null;
  /** HubSpot-captured Facebook click ID (fbclid). Presence proves the
   *  contact came from a Meta ad click. */
  facebookClickId: string | null;
  /** Ministry data-layer field — e.g. "Club / Off Peak", "Private Office". */
  enquiryType: string | null;
  /** Custom form-submission UUID sent via GTM to Meta CAPI + Google + stored
   *  on the HubSpot contact. When present, this is the deterministic join key
   *  (no heuristics needed). Foundation per Ministry brief §5.3. */
  uniqueEventId: string | null;
  /** Associated deal stage from HubSpot — used for Lead→Customer conversion
   *  reporting (brief §6 "future optional"). */
  dealStage: string | null;
  /** Closed-won deal amount (GBP) for revenue / CPA reporting. */
  dealAmount: number | null;
  /** Deal close date — lets us compute lead→customer conversion lag. */
  dealCloseDate: string | null;
}

const HUBSPOT_CONTACT_FIELDS = [
  "contact_hs_object_id",
  "contact_email",
  "contact_firstname",
  "contact_lastname",
  "contact_company",
  "contact_phone",
  "contact_lifecyclestage",
  "contact_hs_lead_status",
  "contact_createdate",
  "contact_first_conversion_date",
  "contact_recent_conversion_date",
  "contact_first_conversion_event_name",
  "contact_recent_conversion_event_name",
  "contact_hs_analytics_source",
  "contact_hs_latest_source",
  "contact_hs_analytics_source_data_1",
  "contact_hs_analytics_source_data_2",
  "contact_hs_latest_source_data_1",
  "contact_hs_latest_source_data_2",
  "contact_hs_analytics_first_url",
  "contact_hs_analytics_last_url",
  "contact_hs_analytics_first_referrer",
  "contact_hs_analytics_last_referrer",
  "contact_num_conversion_events",
  "contact_num_associated_deals",
  "contact_hubspot_owner_id",
  "contact_message",
  "contact_hs_google_click_id",
  "contact_hs_facebook_click_id",
  "contact_enquiry_type",
  // Speculative custom properties — rename here once the HubSpot side confirms
  // the actual property internal names. Windsor will 400 with the allowed
  // field list if these don't exist, so you'll see which to correct.
  "contact_unique_event_id",
  "contact_deal_stage",
  "contact_amount",
  "contact_closedate",
];

function normalizeHubSpotContact(raw: Record<string, unknown>): HubSpotContact {
  const str = (v: unknown): string | null => {
    if (v == null || v === "") return null;
    return String(v);
  };
  return {
    hsObjectId: String(raw.contact_hs_object_id || ""),
    email: String(raw.contact_email || ""),
    firstname: String(raw.contact_firstname || ""),
    lastname: String(raw.contact_lastname || ""),
    company: str(raw.contact_company),
    phone: str(raw.contact_phone),
    lifecyclestage: str(raw.contact_lifecyclestage),
    leadStatus: str(raw.contact_hs_lead_status),
    createdate: String(raw.contact_createdate || ""),
    firstConversionDate: str(raw.contact_first_conversion_date),
    recentConversionDate: str(raw.contact_recent_conversion_date),
    firstConversionEventName: str(raw.contact_first_conversion_event_name),
    recentConversionEventName: str(raw.contact_recent_conversion_event_name),
    analyticsSource: str(raw.contact_hs_analytics_source),
    latestSource: str(raw.contact_hs_latest_source),
    analyticsSourceData1: str(raw.contact_hs_analytics_source_data_1),
    analyticsSourceData2: str(raw.contact_hs_analytics_source_data_2),
    latestSourceData1: str(raw.contact_hs_latest_source_data_1),
    latestSourceData2: str(raw.contact_hs_latest_source_data_2),
    firstUrl: str(raw.contact_hs_analytics_first_url),
    lastUrl: str(raw.contact_hs_analytics_last_url),
    firstReferrer: str(raw.contact_hs_analytics_first_referrer),
    lastReferrer: str(raw.contact_hs_analytics_last_referrer),
    numConversionEvents: Number(raw.contact_num_conversion_events) || 0,
    numAssociatedDeals: Number(raw.contact_num_associated_deals) || 0,
    ownerId: str(raw.contact_hubspot_owner_id),
    message: str(raw.contact_message),
    googleClickId: str(raw.contact_hs_google_click_id),
    facebookClickId: str(raw.contact_hs_facebook_click_id),
    enquiryType: str(raw.contact_enquiry_type),
    uniqueEventId: str(raw.contact_unique_event_id),
    dealStage: str(raw.contact_deal_stage),
    dealAmount: raw.contact_amount != null && raw.contact_amount !== "" ? Number(raw.contact_amount) : null,
    dealCloseDate: str(raw.contact_closedate),
  };
}

/**
 * Fetch HubSpot contacts via Windsor. Date range filters against contact
 * createdate. Cached for 1h alongside the other Windsor fetchers.
 */
export async function getWindsorHubSpotContacts(
  apiKey: string,
  days = 30,
  dateRange?: { dateFrom: string; dateTo: string },
): Promise<HubSpotContact[]> {
  const cacheKey = buildCacheKey("hubspot_contacts", apiKey, days, dateRange?.dateFrom, dateRange?.dateTo);
  const cached = getCached<HubSpotContact[]>(cacheKey);
  if (cached) return cached;

  const results: HubSpotContact[] = [];
  try {
    const raw = await fetchRaw({
      apiKey,
      fields: HUBSPOT_CONTACT_FIELDS,
      ...(dateRange ? { dateFrom: dateRange.dateFrom, dateTo: dateRange.dateTo } : { datePreset: `last_${days}d` }),
      // TS union doesn't list hubspot; cast via unknown to keep fetchRaw typed.
      source: "hubspot" as unknown as WindsorParams["source"],
    });
    for (const row of raw) {
      results.push(normalizeHubSpotContact(row));
    }
  } catch (err) {
    console.error("[Windsor] HubSpot fetch failed:", err);
  }

  setCache(cacheKey, results);
  return results;
}

/** TikTok creative data — placeholder until Windsor TikTok connector is confirmed */
const TIKTOK_CREATIVE_FIELDS = [
  "date", "campaign_name", "ad_group_name", "ad_name", "ad_id",
  "spend", "impressions", "clicks", "conversions", "conversion_value",
  "video_watched_2s", "video_watched_6s",
  "video_views_p25", "video_views_p50", "video_views_p75", "video_views_p100",
  "average_video_play",
];

export async function getWindsorTikTokCreativeData(
  apiKey: string,
  days = 30,
  dateRange?: { dateFrom: string; dateTo: string },
): Promise<WindsorRow[]> {
  const cacheKey = buildCacheKey("tiktok_creatives", apiKey, days, dateRange?.dateFrom, dateRange?.dateTo);
  const cached = getCached<WindsorRow[]>(cacheKey);
  if (cached) return cached;

  const results: WindsorRow[] = [];
  try {
    const raw = await fetchRaw({
      apiKey,
      fields: TIKTOK_CREATIVE_FIELDS,
      ...(dateRange ? { dateFrom: dateRange.dateFrom, dateTo: dateRange.dateTo } : { datePreset: `last_${days}d` }),
      source: "tiktok",
    });
    for (const row of raw) {
      results.push({
        date: String(row.date || ""),
        source: "tiktok",
        campaign: String(row.campaign_name || row.campaign || ""),
        ad_group_name: String(row.ad_group_name || ""),
        ad_name: String(row.ad_name || ""),
        ad_id: String(row.ad_id || ""),
        spend: Number(row.spend) || 0,
        impressions: Number(row.impressions) || 0,
        clicks: Number(row.clicks) || 0,
        conversions: Number(row.conversions) || 0,
        revenue: Number(row.conversion_value) || 0,
        video_watched_2s: Number(row.video_watched_2s) || 0,
        video_watched_6s: Number(row.video_watched_6s) || 0,
        video_p25: Number(row.video_views_p25) || 0,
        video_p50: Number(row.video_views_p50) || 0,
        video_p75: Number(row.video_views_p75) || 0,
        video_p100: Number(row.video_views_p100) || 0,
        average_video_play: Number(row.average_video_play) || 0,
      });
    }
  } catch { /* TikTok connector may not be available */ }

  setCache(cacheKey, results);
  return results;
}

/**
 * Filter Windsor rows to only include data belonging to a specific client.
 */
export function filterByClient(
  rows: WindsorRow[],
  opts: {
    accountIds?: string[];
    accountNames?: string[];
    clientName?: string;
  },
): WindsorRow[] {
  if (!opts.accountIds?.length && !opts.accountNames?.length && !opts.clientName) {
    return rows;
  }

  // Normalize account IDs: Google Ads Customer IDs are written as
  // "771-197-5192" in the UI but Windsor returns them digits-only as
  // "7711975192". Match on digits-only so both forms reconcile.
  const normalize = (id: string | number | undefined | null) =>
    String(id ?? "").replace(/\D+/g, "");
  const wantedIds = new Set((opts.accountIds ?? []).map(normalize).filter(Boolean));

  return rows.filter((row) => {
    if (wantedIds.size > 0 && row.account_id) {
      if (wantedIds.has(normalize(row.account_id))) return true;
    }

    if (opts.accountNames?.length && row.account_name) {
      const rowAcct = row.account_name.toLowerCase();
      if (opts.accountNames.some((n) => rowAcct.includes(n.toLowerCase()))) return true;
    }

    if (opts.clientName) {
      const name = opts.clientName.toLowerCase();
      if (row.account_name?.toLowerCase().includes(name)) return true;
      if (row.campaign?.toLowerCase().includes(name)) return true;
    }

    return false;
  });
}

/**
 * Discover all unique account names and IDs from Windsor.
 */
export async function discoverAccounts(apiKey: string): Promise<
  { accountName: string; accountId: string; source: string }[]
> {
  const results: { accountName: string; accountId: string; source: string }[] = [];

  const [fbRaw, gRaw] = await Promise.allSettled([
    fetchRaw({ apiKey, fields: ["account_name", "account_id"], datePreset: "last_7d", source: "facebook" }),
    fetchRaw({ apiKey, fields: ["account_name", "account_id"], datePreset: "last_7d", source: "google_ads" }),
  ]);

  const seen = new Set<string>();

  function addAccounts(rows: Record<string, unknown>[], source: string) {
    for (const row of rows) {
      const key = `${row.account_id}_${source}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          accountName: String(row.account_name || "Unknown"),
          accountId: String(row.account_id || ""),
          source,
        });
      }
    }
  }

  if (fbRaw.status === "fulfilled") addAccounts(fbRaw.value, "facebook");
  if (gRaw.status === "fulfilled") addAccounts(gRaw.value, "google_ads");

  return results;
}

/* ── GA4 Web Analytics ── */

export interface GA4Row {
  date: string;
  sessions: number;
  users: number;
  newUsers: number;
  pageviews: number;
  bounceRate: number;
  avgSessionDuration: number;
  pagesPerSession: number;
  conversions: number;
  revenue: number;
  addToCarts: number;
  source?: string;
  medium?: string;
  channelGrouping?: string;
  [key: string]: string | number | undefined;
}

const GA4_FIELDS = [
  "date",
  "sessions",
  "users",
  "screen_page_views",
  "bounce_rate",
  "average_session_duration",
  "conversions",
  "purchase_revenue",
  "ecommerce_purchases",
  "add_to_carts",
  "source",
  "medium",
  "default_channel_group",
  "account_name",
  "account_id",
  "datasource",
];

function normalizeGA4Row(raw: Record<string, unknown>): GA4Row {
  const sessions = Number(raw.sessions) || 0;
  const pageviews = Number(raw.screen_page_views) || Number(raw.screenPageViews) || Number(raw.pageviews) || 0;

  return {
    date: String(raw.date || ""),
    sessions,
    users: Number(raw.users) || Number(raw.totalUsers) || Number(raw.total_users) || 0,
    newUsers: Number(raw.new_users) || Number(raw.newUsers) || 0,
    pageviews,
    bounceRate: Number(raw.bounce_rate) || Number(raw.bounceRate) || 0,
    avgSessionDuration: Number(raw.average_session_duration) || Number(raw.averageSessionDuration) || 0,
    pagesPerSession: sessions > 0 ? pageviews / sessions : 0,
    conversions: Number(raw.conversions) || Number(raw.ecommerce_purchases) || 0,
    revenue: Number(raw.purchase_revenue) || Number(raw.totalRevenue) || Number(raw.transaction_revenue) || 0,
    addToCarts: Number(raw.add_to_carts) || Number(raw.addToCarts) || 0,
    source: String(raw.source || raw.sessionSource || ""),
    medium: String(raw.medium || raw.sessionMedium || ""),
    channelGrouping: String(raw.default_channel_group || raw.sessionDefaultChannelGrouping || raw.channel_grouping || ""),
  };
}

/**
 * Fetch GA4 web analytics data via Windsor.
 *
 * Windsor does not expose a dedicated GA4 source endpoint — GA4 data is only
 * available through the "all" source. We request all data with GA4-compatible
 * fields, then filter rows where `datasource === "googleanalytics4"`.
 */
export async function getWindsorGA4Data(
  apiKey: string,
  days = 30,
  dateRange?: { dateFrom: string; dateTo: string },
): Promise<GA4Row[]> {
  const dateParams: Pick<WindsorParams, "datePreset" | "dateFrom" | "dateTo"> = dateRange
    ? { dateFrom: dateRange.dateFrom, dateTo: dateRange.dateTo }
    : { datePreset: `last_${days}d` };

  try {
    const raw = await fetchRaw({
      apiKey,
      fields: GA4_FIELDS,
      ...dateParams,
      source: "all",
    });

    // Filter to GA4 rows only (Windsor mixes all datasources in the "all" endpoint)
    const ga4Rows = raw.filter(
      (row) => row.datasource === "googleanalytics4",
    );

    console.log(
      `[Windsor] GA4: ${ga4Rows.length} rows (filtered from ${raw.length} total)`,
    );

    if (ga4Rows.length > 0) {
      return ga4Rows.map((row) => normalizeGA4Row(row));
    }
  } catch (err) {
    console.error("[Windsor] GA4 fetch failed:", err);
  }

  return [];
}

// Re-export field arrays for backward compatibility
export const CAMPAIGN_FIELDS = GOOGLE_CAMPAIGN_FIELDS;
export const AD_LEVEL_FIELDS = FACEBOOK_CREATIVE_FIELDS;
