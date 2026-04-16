/**
 * Creative Lab -- Aggregation Engine
 *
 * Converts raw WindsorRow[] into LiveCreative[] with:
 * - Ad-name parsing via creativeParser
 * - Channel role detection
 * - Format detection from signals
 * - Composite scoring via creativeScoring
 */

import type { WindsorRow } from "./windsor";
import type { Client, ChannelRole, CreativePlatform } from "./types";
import { parseAdName, detectChannelRole, detectFormatFromSignals, type ParsedAdName } from "./creativeParser";
import { scoreCreative, type ScoreResult } from "./creativeScoring";

/* ── LiveCreative interface ── */

export interface LiveCreative {
  id: string;
  adId: string;
  name: string;
  campaign: string;
  adSet: string;
  platform: CreativePlatform;
  format: "VID" | "STA" | "CAR" | "SEARCH";
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  ctr: number;
  cvr: number;
  roas: number;
  hookRate: number;
  holdRate: number;
  frequency: number;
  compositeScore: number;
  isFatigued: boolean;
  thumbnailUrl: string;
  adBody: string;
  adTitle: string;
  daysRunning: number;
  isLive: boolean;
  // Video metrics
  videoPlays: number;
  videoThruplay: number;
  videoP25: number;
  videoP50: number;
  videoP75: number;
  videoP95: number;
  videoP100: number;
  video30s: number;
  videoAvgTime: number;
  // Extended fields
  userSegment: string;
  websiteCtr: number;
  websiteDestUrl: string;
  websitePurchaseRoas: number;
  // Google-specific
  keywordText: string;
  keywordMatchType: string;
  // New: scoring + parsing
  scoreResult: ScoreResult;
  channelRole: ChannelRole;
  parsedName: ParsedAdName;
  // TikTok-specific
  twoSecondViewRate: number;
  completionRate: number;
}

/* ── Accumulator shape ── */

interface CreativeAccumulator {
  name: string;
  adId: string;
  campaign: string;
  adSet: string;
  source: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  frequency: number;
  frequencyCount: number;
  video_thruplay: number;
  video_plays: number;
  video_p25: number;
  video_p50: number;
  video_p75: number;
  video_p95: number;
  video_p100: number;
  video_30s: number;
  video_avg_time: number;
  thumbnailUrl: string;
  adBody: string;
  adTitle: string;
  createdTime: string;
  earliestDate: string;
  latestDate: string;
  userSegment: string;
  websiteCtr: number;
  websiteDestUrl: string;
  websitePurchaseRoas: number;
  keywordText: string;
  keywordMatchType: string;
  // TikTok
  video_watched_2s: number;
  average_video_play: number;
  ad_group_name: string;
}

/* ── Main aggregation function ── */

export function aggregateCreatives(
  rows: WindsorRow[],
  client?: Client,
): LiveCreative[] {
  const map: Record<string, CreativeAccumulator> = {};

  for (const r of rows) {
    const key = r.ad_id || r.ad_name || r.campaign;
    if (!map[key]) {
      map[key] = {
        name: r.ad_name || r.campaign,
        adId: r.ad_id || key,
        campaign: r.campaign,
        adSet: r.adset || r.ad_group_name || "",
        source: r.source,
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        revenue: 0,
        frequency: 0,
        frequencyCount: 0,
        video_thruplay: 0,
        video_plays: 0,
        video_p25: 0,
        video_p50: 0,
        video_p75: 0,
        video_p95: 0,
        video_p100: 0,
        video_30s: 0,
        video_avg_time: 0,
        thumbnailUrl: "",
        adBody: "",
        adTitle: "",
        createdTime: "",
        earliestDate: r.date || "",
        latestDate: r.date || "",
        userSegment: "",
        websiteCtr: 0,
        websiteDestUrl: "",
        websitePurchaseRoas: 0,
        keywordText: "",
        keywordMatchType: "",
        video_watched_2s: 0,
        average_video_play: 0,
        ad_group_name: r.ad_group_name || "",
      };
    }

    const acc = map[key];
    acc.spend += Number(r.spend) || 0;
    acc.impressions += Number(r.impressions) || 0;
    acc.clicks += Number(r.clicks) || 0;
    acc.conversions += Number(r.conversions) || 0;
    acc.revenue += Number(r.revenue) || 0;
    if (r.frequency) {
      acc.frequency += Number(r.frequency) || 0;
      acc.frequencyCount++;
    }
    acc.video_thruplay += Number(r.video_thruplay) || 0;
    acc.video_plays += Number(r.video_plays) || 0;
    acc.video_p25 += Number(r.video_p25) || 0;
    acc.video_p50 += Number(r.video_p50) || 0;
    acc.video_p75 += Number(r.video_p75) || 0;
    acc.video_p95 += Number(r.video_p95) || 0;
    acc.video_p100 += Number(r.video_p100) || 0;
    acc.video_30s += Number(r.video_30s) || 0;
    acc.video_avg_time += Number(r.video_avg_time) || 0;
    acc.video_watched_2s += Number(r.video_watched_2s) || 0;
    acc.average_video_play += Number(r.average_video_play) || 0;

    if (r.thumbnail_url && !acc.thumbnailUrl) acc.thumbnailUrl = r.thumbnail_url;
    if (r.body && !acc.adBody) acc.adBody = r.body;
    if (r.title && !acc.adTitle) acc.adTitle = r.title;
    if (r.created_time && !acc.createdTime) acc.createdTime = r.created_time;
    if (r.user_segment && !acc.userSegment) acc.userSegment = r.user_segment;
    if (r.website_ctr && !acc.websiteCtr) acc.websiteCtr = Number(r.website_ctr) || 0;
    if (r.website_destination_url && !acc.websiteDestUrl) acc.websiteDestUrl = r.website_destination_url;
    if (r.website_purchase_roas && !acc.websitePurchaseRoas) acc.websitePurchaseRoas = Number(r.website_purchase_roas) || 0;
    if (r.keyword_text && !acc.keywordText) acc.keywordText = r.keyword_text;
    if (r.keyword_match_type && !acc.keywordMatchType) acc.keywordMatchType = r.keyword_match_type;
    if (r.ad_headlines && !acc.adTitle && typeof r.ad_headlines === "string") acc.adTitle = r.ad_headlines;
    if (r.ad_descriptions && !acc.adBody && typeof r.ad_descriptions === "string") acc.adBody = r.ad_descriptions;
    if (r.ad_group_name && !acc.ad_group_name) acc.ad_group_name = r.ad_group_name;

    // Track date range
    if (r.date) {
      if (r.date < acc.earliestDate || !acc.earliestDate) acc.earliestDate = r.date;
      if (r.date > acc.latestDate) acc.latestDate = r.date;
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Object.entries(map).map(([key, c]) => {
    const calculatedCtr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
    const ctr = c.websiteCtr > 0 ? c.websiteCtr : calculatedCtr;
    const roas = c.spend > 0 ? c.revenue / c.spend : 0;
    const avgFreq = c.frequencyCount > 0 ? c.frequency / c.frequencyCount : 0;
    const cvr = c.clicks > 0 ? (c.conversions / c.clicks) * 100 : 0;

    // Detect platform
    const isTikTok = c.source === "tiktok" || c.source === "tiktok_ads";
    const isGoogle = c.source === "google_ads" || c.source === "adwords";
    const platform: CreativePlatform = isTikTok ? "tiktok" : isGoogle ? "google" : "meta";

    // Hook / hold rates
    const hookRate = platform === "tiktok"
      ? (c.impressions > 0 ? (c.video_watched_2s / c.impressions) * 100 : 0)
      : (c.impressions > 0 ? (c.video_plays / c.impressions) * 100 : 0);
    const holdRate = platform === "tiktok"
      ? (c.video_watched_2s > 0 ? (c.video_p100 / c.video_watched_2s) * 100 : 0)
      : (c.video_plays > 0 ? (c.video_thruplay / c.video_plays) * 100 : 0);

    // TikTok-specific
    const twoSecondViewRate = c.impressions > 0 ? (c.video_watched_2s / c.impressions) * 100 : 0;
    const completionRate = c.video_watched_2s > 0 ? (c.video_p100 / c.video_watched_2s) * 100 : 0;

    // Format detection via new parser
    const hasVideoMetrics = c.video_plays > 0 || c.video_thruplay > 0 || c.video_p25 > 0 || c.video_watched_2s > 0;
    const formatSignal = detectFormatFromSignals({
      adName: c.name,
      campaignName: c.campaign,
      source: c.source,
      hasVideoMetrics,
      hasKeyword: c.keywordText !== "",
      hasThumbnail: c.thumbnailUrl !== "",
      hasAdCopy: c.adTitle !== "" || c.adBody !== "",
    });
    const format = formatSignal;

    // Parse ad name
    const parsedName = parseAdName(c.name);

    // Detect channel role
    const channelRole = detectChannelRole(
      c.campaign,
      c.adSet || c.ad_group_name,
      client?.channelRoles,
    );

    // Days running
    const startDate = c.createdTime ? new Date(c.createdTime) : (c.earliestDate ? new Date(c.earliestDate) : today);
    const daysRunning = Math.max(1, Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

    // Is live: has data in last 3 days
    const latestDate = c.latestDate ? new Date(c.latestDate) : new Date(0);
    const daysSinceLatest = Math.floor((today.getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24));
    const isLive = daysSinceLatest <= 3 && c.spend > 0;

    // Composite scoring via scoring engine
    const scoreResult = scoreCreative({
      platform,
      format,
      channelRole,
      hookRate,
      holdRate,
      ctr,
      cvr,
      roas,
      frequency: avgFreq,
      spend: c.spend,
      impressions: c.impressions,
      clientType: client?.type || "ecommerce",
      targetCPA: client?.targetCPA,
      cpa: c.conversions > 0 ? c.spend / c.conversions : undefined,
      twoSecondViewRate: platform === "tiktok" ? twoSecondViewRate : undefined,
      completionRate: platform === "tiktok" ? completionRate : undefined,
      daysRunning,
    });

    return {
      id: key,
      adId: c.adId,
      name: c.name,
      campaign: c.campaign,
      adSet: c.adSet || c.ad_group_name,
      platform,
      format,
      spend: c.spend,
      impressions: c.impressions,
      clicks: c.clicks,
      conversions: c.conversions,
      revenue: c.revenue,
      ctr,
      cvr,
      roas,
      hookRate,
      holdRate,
      frequency: avgFreq,
      compositeScore: scoreResult.compositeScore,
      isFatigued: scoreResult.isFatigued,
      thumbnailUrl: c.thumbnailUrl,
      adBody: c.adBody,
      adTitle: c.adTitle,
      daysRunning,
      isLive,
      videoPlays: c.video_plays,
      videoThruplay: c.video_thruplay,
      videoP25: c.video_p25,
      videoP50: c.video_p50,
      videoP75: c.video_p75,
      videoP95: c.video_p95,
      videoP100: c.video_p100,
      video30s: c.video_30s,
      videoAvgTime: c.video_avg_time,
      userSegment: c.userSegment,
      websiteCtr: c.websiteCtr,
      websiteDestUrl: c.websiteDestUrl,
      websitePurchaseRoas: c.websitePurchaseRoas,
      keywordText: c.keywordText,
      keywordMatchType: c.keywordMatchType,
      scoreResult,
      channelRole,
      parsedName,
      twoSecondViewRate,
      completionRate,
    };
  });
}
