/**
 * Lead reconciliation — compares platform-reported conversions (Meta/Google
 * pixels) against HubSpot-confirmed contacts to surface the gap between what
 * Ads Manager says happened and what actually landed in the CRM.
 *
 * Pure helpers. No I/O. Called from the /ministry/crm page and the overview
 * KPI strip once HubSpot data is fetched from /api/windsor?type=hubspot.
 */

import type { HubSpotContact } from "./windsor";
import { classifyPlatform, sumConversions, type Platform, type WindsorRow } from "./windsor";

export type LeadChannel = "meta" | "google" | "direct" | "organic" | "email" | "referral" | "other";

export type LeadType = "EnquiryForm" | "DayPass" | "FacebookLead" | "Unknown";

/**
 * Map HubSpot's `hs_analytics_source` / `hs_latest_source` enum values onto
 * the channel buckets the dashboard uses. Values arrive as uppercase strings
 * like PAID_SOCIAL, ORGANIC_SEARCH, etc.
 */
export function mapAnalyticsSourceToChannel(source: string | null | undefined): LeadChannel {
  if (!source) return "other";
  const s = source.toUpperCase();
  if (s === "PAID_SOCIAL" || s === "SOCIAL_MEDIA") return "meta";
  if (s === "PAID_SEARCH") return "google";
  if (s === "ORGANIC_SEARCH") return "organic";
  if (s === "DIRECT_TRAFFIC") return "direct";
  if (s === "EMAIL_MARKETING") return "email";
  if (s === "REFERRALS") return "referral";
  return "other";
}

/**
 * Classify the lead type from HubSpot's conversion event name.
 * Ministry today emits events like:
 *   "Facebook Lead Ads: Club_TheMinistry"  → FacebookLead
 *   "Enquiry Form", "Enquiry form submission" → EnquiryForm
 *   "Day Pass", "DayPass booking" → DayPass
 * Falls back to Unknown so new event names are visible in the UI rather
 * than silently bucketed.
 */
export function categoriseLeadType(eventName: string | null | undefined): LeadType {
  if (!eventName) return "Unknown";
  const e = eventName.toLowerCase();
  if (e.includes("facebook lead") || e.includes("lead ads")) return "FacebookLead";
  if (e.includes("day pass") || e.includes("daypass")) return "DayPass";
  if (e.includes("enquiry") || e.includes("enquire")) return "EnquiryForm";
  return "Unknown";
}

/**
 * Extract a Meta campaign identifier from the HubSpot `first_url`. Meta's
 * Lead Ads pass `hsa_cam=<campaign_id>` and `utm_campaign=<name>` in the
 * landing URL. Returns whatever is most joinable to Windsor rows:
 *   { campaignId, campaignName, accountId }
 */
export function extractMetaCampaignFromFirstUrl(firstUrl: string | null | undefined): {
  campaignId: string | null;
  campaignName: string | null;
  accountId: string | null;
} {
  const empty = { campaignId: null, campaignName: null, accountId: null };
  if (!firstUrl) return empty;
  try {
    // `first_url` is the landing URL — query string holds the hsa_/utm_ params.
    const url = new URL(firstUrl);
    const q = url.searchParams;
    const campaignId = q.get("hsa_cam") || null;
    const accountId = q.get("hsa_acc") || null;
    const campaignName = q.get("utm_campaign") || null;
    return { campaignId, campaignName, accountId };
  } catch {
    return empty;
  }
}

/* ── Reconciliation ──────────────────────────────────────────────── */

export interface ChannelReconciliation {
  channel: LeadChannel;
  platformClaimed: number;
  hubspotConfirmed: number;
  /** Subset of hubspotConfirmed that cross-references to a live Windsor campaign.
   *  This is the number an agency can actually defend as "driven by our ads". */
  adVerified: number;
  /** confirmed − claimed. Negative = platform over-reports, positive = CRM has more leads than the pixel. */
  gap: number;
  /** hubspotConfirmed / platformClaimed. null when claimed is 0. */
  confirmedRate: number | null;
}

/**
 * Three-tier verification status for a contact:
 * - "verified"        — cross-references to a live Windsor Meta/Google campaign
 *                       via `hsa_cam` → campaign_id, `utm_campaign` → campaign name,
 *                       OR the conversion event is a Facebook Lead Ads form.
 *                       This is the number we can defend as "driven by our ads".
 * - "heuristic_paid"  — HubSpot tagged PAID_SOCIAL / PAID_SEARCH but we couldn't
 *                       match a specific Windsor campaign. Likely paid, unprovable.
 * - "other"           — organic / direct / referral / email / offline.
 */
export type VerificationStatus = "verified" | "heuristic_paid" | "other";

export function classifyVerification(
  contact: HubSpotContact,
  windsorRows: WindsorRow[],
): VerificationStatus {
  // Facebook Lead Ads events are end-to-end Meta-owned — the contact came
  // from a lead form inside Meta's ecosystem, so it's verifiable as ad-driven
  // even when the landing URL doesn't carry UTMs.
  const eventName = (contact.recentConversionEventName ?? contact.firstConversionEventName ?? "").toLowerCase();
  if (eventName.includes("facebook lead") || eventName.includes("lead ads")) {
    return "verified";
  }

  const { campaignId, campaignName } = extractMetaCampaignFromFirstUrl(contact.firstUrl);
  if (campaignId) {
    const idMatch = windsorRows.some(
      (r) => (r.campaign_id as string | undefined) === campaignId,
    );
    if (idMatch) return "verified";
  }
  const joinName = campaignName ?? contact.analyticsSourceData2 ?? null;
  if (joinName) {
    const nameMatch = windsorRows.some((r) => r.campaign === joinName);
    if (nameMatch) return "verified";
  }

  const channel = mapAnalyticsSourceToChannel(contact.analyticsSource);
  if (channel === "meta" || channel === "google") return "heuristic_paid";
  return "other";
}

export interface LeadTypeBreakdown {
  type: LeadType;
  count: number;
}

export interface ReconciliationResult {
  /** Total HubSpot contacts whose createdate falls in the window. */
  totalHubSpotLeads: number;
  /** Total conversions claimed by Meta + Google pixels in the same window. */
  totalPlatformClaimed: number;
  /** Contacts verified as ad-driven (Facebook Lead Ads form OR first_url joins
   *  to a live Windsor campaign via hsa_cam / utm_campaign). The headline
   *  agency-facing number. */
  totalAdVerified: number;
  /** Contacts HubSpot tagged paid (PAID_SOCIAL / PAID_SEARCH) but with no
   *  joinable campaign on the landing URL. Likely paid, unprovable. */
  totalHeuristicPaid: number;
  byChannel: ChannelReconciliation[];
  byLeadType: LeadTypeBreakdown[];
  /** Contacts with analyticsSource = null/OFFLINE/OTHER — can't be attributed. */
  unattributed: HubSpotContact[];
}

/**
 * Reconcile HubSpot contacts against Windsor Meta + Google rows for the same
 * date range. Count-only (HubSpot rows don't carry revenue).
 */
export function reconcileLeads(
  contacts: HubSpotContact[],
  windsorRows: WindsorRow[],
): ReconciliationResult {
  const platformTotals = sumConversions(windsorRows);

  // Bucket HubSpot contacts by first-touch channel and verification tier.
  const channelCounts: Record<LeadChannel, number> = {
    meta: 0, google: 0, direct: 0, organic: 0, email: 0, referral: 0, other: 0,
  };
  const channelVerified: Record<LeadChannel, number> = {
    meta: 0, google: 0, direct: 0, organic: 0, email: 0, referral: 0, other: 0,
  };
  const typeCounts: Record<LeadType, number> = {
    EnquiryForm: 0, DayPass: 0, FacebookLead: 0, Unknown: 0,
  };
  const unattributed: HubSpotContact[] = [];
  let totalAdVerified = 0;
  let totalHeuristicPaid = 0;

  for (const c of contacts) {
    const channel = mapAnalyticsSourceToChannel(c.analyticsSource);
    channelCounts[channel] += 1;
    if (channel === "other" || channel === "direct") {
      unattributed.push(c);
    }
    const leadType = categoriseLeadType(c.recentConversionEventName ?? c.firstConversionEventName);
    typeCounts[leadType] += 1;

    const status = classifyVerification(c, windsorRows);
    if (status === "verified") {
      totalAdVerified += 1;
      channelVerified[channel] += 1;
    } else if (status === "heuristic_paid") {
      totalHeuristicPaid += 1;
    }
  }

  // Only the paid channels have a corresponding platform-claimed number.
  const platformByChannel: Partial<Record<LeadChannel, number>> = {
    meta: platformTotals.meta,
    google: platformTotals.google,
  };

  const channels: LeadChannel[] = ["meta", "google", "direct", "organic", "email", "referral", "other"];
  const byChannel: ChannelReconciliation[] = channels.map((channel) => {
    const platformClaimed = platformByChannel[channel] ?? 0;
    const hubspotConfirmed = channelCounts[channel];
    const adVerified = channelVerified[channel];
    return {
      channel,
      platformClaimed,
      hubspotConfirmed,
      adVerified,
      gap: hubspotConfirmed - platformClaimed,
      confirmedRate: platformClaimed > 0 ? hubspotConfirmed / platformClaimed : null,
    };
  });

  const byLeadType: LeadTypeBreakdown[] = (Object.keys(typeCounts) as LeadType[])
    .map((type) => ({ type, count: typeCounts[type] }));

  return {
    totalHubSpotLeads: contacts.length,
    totalPlatformClaimed: platformTotals.total,
    totalAdVerified,
    totalHeuristicPaid,
    byChannel,
    byLeadType,
    unattributed,
  };
}

/* ── Campaign-level reconciliation ───────────────────────────────── */

export interface CampaignReconciliation {
  platform: Platform;
  campaignId: string | null;
  campaignName: string;
  spend: number;
  platformClaimed: number;
  hubspotConfirmed: number;
  gap: number;
  /** spend / hubspotConfirmed — the CPL the CRM actually delivered. null when 0. */
  confirmedCpl: number | null;
}

/**
 * Per-campaign reconciliation. Joins HubSpot contacts to Windsor campaigns
 * via the Meta campaign ID parsed from `first_url` (`hsa_cam`) or, as a
 * fallback, the campaign name in `hs_analytics_source_data_2`.
 *
 * Google campaigns can only be joined by name today because HubSpot's
 * analytics fields don't expose a Google campaign ID; Ministry's paid-search
 * volume is small enough that this is acceptable.
 */
export function reconcileByCampaign(
  contacts: HubSpotContact[],
  windsorRows: WindsorRow[],
): CampaignReconciliation[] {
  // Aggregate Windsor rows by campaign.
  type Agg = { platform: Platform; campaignId: string | null; campaignName: string; spend: number; claimed: number };
  const campaigns = new Map<string, Agg>();
  const sums = sumConversions(windsorRows);
  const useGoogleAllFallback = sums.usedGoogleAllFallback;

  for (const r of windsorRows) {
    const platform = classifyPlatform(r.source);
    const name = r.campaign || "(unnamed)";
    const id = (r.campaign_id as string | undefined) || null;
    const key = `${platform}::${id ?? name}`;
    const existing = campaigns.get(key) ?? { platform, campaignId: id, campaignName: name, spend: 0, claimed: 0 };
    existing.spend += Number(r.spend) || 0;
    if (platform === "meta") {
      existing.claimed += Number(r.conversions) || 0;
    } else if (platform === "google") {
      existing.claimed += useGoogleAllFallback
        ? Number(r.all_conversions) || 0
        : Number(r.conversions) || 0;
    }
    campaigns.set(key, existing);
  }

  // Bucket HubSpot contacts onto campaigns.
  const hubspotByKey = new Map<string, number>();
  for (const c of contacts) {
    const channel = mapAnalyticsSourceToChannel(c.analyticsSource);
    if (channel !== "meta" && channel !== "google") continue;
    const { campaignId, campaignName } = extractMetaCampaignFromFirstUrl(c.firstUrl);
    // Join preference: campaign ID → campaign name from URL → analyticsSourceData2.
    const joinName = campaignName ?? c.analyticsSourceData2 ?? null;
    const platform: Platform = channel;
    let key: string | null = null;
    if (campaignId) {
      key = `${platform}::${campaignId}`;
      if (!campaigns.has(key)) key = null;
    }
    if (!key && joinName) {
      for (const [ck, agg] of campaigns) {
        if (agg.platform === platform && agg.campaignName === joinName) {
          key = ck;
          break;
        }
      }
    }
    if (!key) continue;
    hubspotByKey.set(key, (hubspotByKey.get(key) ?? 0) + 1);
  }

  const rows: CampaignReconciliation[] = [];
  for (const [key, agg] of campaigns) {
    const hubspotConfirmed = hubspotByKey.get(key) ?? 0;
    rows.push({
      platform: agg.platform,
      campaignId: agg.campaignId,
      campaignName: agg.campaignName,
      spend: agg.spend,
      platformClaimed: agg.claimed,
      hubspotConfirmed,
      gap: hubspotConfirmed - agg.claimed,
      confirmedCpl: hubspotConfirmed > 0 ? agg.spend / hubspotConfirmed : null,
    });
  }
  return rows.sort((a, b) => b.spend - a.spend);
}
