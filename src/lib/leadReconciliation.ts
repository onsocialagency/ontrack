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
 * landing URL. Also captures `utm_source` and `utm_medium` so downstream
 * code can tell paid traffic apart from organic social / email.
 */
export function extractMetaCampaignFromFirstUrl(firstUrl: string | null | undefined): {
  campaignId: string | null;
  campaignName: string | null;
  accountId: string | null;
  utmSource: string | null;
  utmMedium: string | null;
} {
  const empty = { campaignId: null, campaignName: null, accountId: null, utmSource: null, utmMedium: null };
  if (!firstUrl) return empty;
  try {
    const url = new URL(firstUrl);
    const q = url.searchParams;
    return {
      campaignId: q.get("hsa_cam") || null,
      accountId: q.get("hsa_acc") || null,
      campaignName: q.get("utm_campaign") || null,
      utmSource: q.get("utm_source") || null,
      utmMedium: q.get("utm_medium") || null,
    };
  } catch {
    return empty;
  }
}

/** Returns true when `utm_medium` indicates a paid click (cpc, paid, ppc,
 *  paidsocial, paid-social, paid_social). Spaces/underscores/dashes are
 *  normalised so the same value in different notations is recognised. */
export function isPaidUtmMedium(medium: string | null | undefined): boolean {
  if (!medium) return false;
  const m = medium.toLowerCase().replace(/[\s_-]/g, "");
  return ["cpc", "ppc", "paid", "paidsocial", "paidsearch", "display"].includes(m);
}

/** Infer a Meta/Google-level channel from utm_source when set. */
export function channelFromUtmSource(
  utmSource: string | null | undefined,
): "meta" | "google" | null {
  if (!utmSource) return null;
  const s = utmSource.toLowerCase();
  if (s.includes("facebook") || s.includes("instagram") || s === "ig" || s === "fb" || s === "meta") return "meta";
  if (s.includes("google") || s === "adwords") return "google";
  return null;
}

/**
 * Extract a form identifier from HubSpot's conversion event name. Ministry
 * uses WPForms, which embeds selectors like `#wpforms-form-5192` inside the
 * event name string. Returns the numeric form id when found.
 */
export function extractFormIdFromEvent(eventName: string | null | undefined): string | null {
  if (!eventName) return null;
  const wp = eventName.match(/wpforms-form-(\d+)/i);
  if (wp) return wp[1];
  const generic = eventName.match(/form[-_ ]?id[-_ :=]?\s*(\d+)/i);
  if (generic) return generic[1];
  return null;
}

/**
 * Ministry enquiry type fallback chain. `contact.enquiryType` is the
 * primary source (GTM data-layer push) but coverage is imperfect — we've
 * historically seen ~25% of contacts land with no value. Before giving up
 * and calling them "(untagged)" we try:
 *
 *   1. Explicit  — `contact.enquiryType`
 *   2. Event     — conversion event name ("Day Pass", "Private Office", …)
 *   3. URL path  — `first_url` path segment ("/private-office", "/day-pass")
 *   4. UTM       — `utm_campaign` via ministry-config pattern matcher
 *
 * The `source` flag tells the UI where the value came from so we can surface
 * a data-quality banner when too much of the mix is inferred rather than
 * explicit.
 */
const ENQUIRY_LABEL_MAP: { needle: string; label: string }[] = [
  { needle: "private office", label: "Private Office" },
  { needle: "privateoffice", label: "Private Office" },
  { needle: "private-office", label: "Private Office" },
  { needle: "dedicated desk", label: "Dedicated Desk" },
  { needle: "dedicateddesk", label: "Dedicated Desk" },
  { needle: "dedicated-desk", label: "Dedicated Desk" },
  { needle: "hot desk", label: "Hot Desk" },
  { needle: "hotdesk", label: "Hot Desk" },
  { needle: "hot-desk", label: "Hot Desk" },
  { needle: "meeting room", label: "Meeting Room" },
  { needle: "meetingroom", label: "Meeting Room" },
  { needle: "meeting-room", label: "Meeting Room" },
  { needle: "day pass", label: "Day Pass" },
  { needle: "daypass", label: "Day Pass" },
  { needle: "day-pass", label: "Day Pass" },
  { needle: "club", label: "Club" },
];

export type EnquiryTagSource = "explicit" | "event" | "url" | "utm" | "untagged";

export function deriveEnquiryType(contact: HubSpotContact): {
  value: string;
  source: EnquiryTagSource;
} {
  if (contact.enquiryType && contact.enquiryType.trim()) {
    return { value: contact.enquiryType.trim(), source: "explicit" };
  }
  const event = (contact.recentConversionEventName ?? contact.firstConversionEventName ?? "").toLowerCase();
  for (const { needle, label } of ENQUIRY_LABEL_MAP) {
    if (event.includes(needle)) return { value: label, source: "event" };
  }
  if (contact.firstUrl) {
    try {
      const path = new URL(contact.firstUrl).pathname.toLowerCase();
      for (const { needle, label } of ENQUIRY_LABEL_MAP) {
        if (path.includes(needle.replace(/\s/g, "-")) || path.includes(needle.replace(/\s/g, ""))) {
          return { value: label, source: "url" };
        }
      }
    } catch {
      // bad URL — fall through
    }
  }
  const utmCampaign = extractMetaCampaignFromFirstUrl(contact.firstUrl).campaignName;
  if (utmCampaign) {
    const lower = utmCampaign.toLowerCase();
    for (const { needle, label } of ENQUIRY_LABEL_MAP) {
      if (lower.includes(needle)) return { value: label, source: "utm" };
    }
  }
  return { value: "(untagged)", source: "untagged" };
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
  // 0. Unique Event ID — deterministic join key written by GTM on form submit
  //    and mirrored to Meta CAPI + Google + HubSpot. If present this is
  //    proof-of-ad-lead without any heuristics (Ministry brief §5.3).
  if (contact.uniqueEventId) {
    return "verified";
  }

  // 1. Click-ID proofs. If HubSpot captured an fbclid/gclid, the user reached
  //    the site from an ad click — no heuristic needed. Meta/Google append
  //    these parameters to every ad-clickthrough URL.
  if (contact.facebookClickId || contact.googleClickId) {
    return "verified";
  }

  // 2. Facebook Lead Ads events are end-to-end Meta-owned (the form lives
  //    inside Meta). Verifiable as ad-driven even without UTMs.
  const eventName = (contact.recentConversionEventName ?? contact.firstConversionEventName ?? "").toLowerCase();
  if (eventName.includes("facebook lead") || eventName.includes("lead ads")) {
    return "verified";
  }

  const parsed = extractMetaCampaignFromFirstUrl(contact.firstUrl);
  const { campaignId, campaignName, utmSource, utmMedium } = parsed;

  // 3. Exact campaign-ID match against Windsor.
  if (campaignId) {
    const idMatch = windsorRows.some(
      (r) => (r.campaign_id as string | undefined) === campaignId,
    );
    if (idMatch) return "verified";
  }
  // 4. Campaign-name match (utm_campaign, then HubSpot's analyticsSourceData2).
  const joinName = campaignName ?? contact.analyticsSourceData2 ?? null;
  if (joinName) {
    const nameMatch = windsorRows.some((r) => r.campaign === joinName);
    if (nameMatch) return "verified";
  }
  // 5. utm_medium says "paid" AND utm_source names a paid channel → verified
  //    even when the campaign itself doesn't join (the URL proves ad-origin).
  if (isPaidUtmMedium(utmMedium) && channelFromUtmSource(utmSource) !== null) {
    return "verified";
  }

  const channel = mapAnalyticsSourceToChannel(contact.analyticsSource);
  if (channel === "meta" || channel === "google") return "heuristic_paid";
  return "other";
}

export interface LeadTypeBreakdown {
  type: LeadType;
  count: number;
}

export interface EnquiryTypeBreakdown {
  enquiryType: string;
  total: number;
  verified: number;
  heuristicPaid: number;
  other: number;
}

export interface FormBreakdown {
  formId: string;
  total: number;
}

/** Daily rollup of verification status, keyed by contact createdate (YYYY-MM-DD). */
export interface VerifiedByDateBreakdown {
  date: string;
  total: number;
  verified: number;
  heuristicPaid: number;
  other: number;
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
  /** Rollup by Ministry's `enquiry_type` data-layer value. `"(untagged)"` bucket
   *  captures contacts where the property was empty. */
  byEnquiryType: EnquiryTypeBreakdown[];
  /** Rollup by WPForms form ID extracted from conversion event names. */
  byForm: FormBreakdown[];
  /** Daily bucketed verification counts — sparkline source for the Verified
   *  Ad Leads and Verified CPL cards. */
  byDate: VerifiedByDateBreakdown[];
  /** Contacts with analyticsSource = null/OFFLINE/OTHER — can't be attributed. */
  unattributed: HubSpotContact[];
  /** How each contact's enquiry type was resolved — explicit data-layer value
   *  vs. inferred from event name / URL / UTM. A high `untagged` ratio means
   *  the GTM data-layer push is broken on some subset of forms. */
  enquiryTagSources: Record<EnquiryTagSource, number>;
  /** Share of contacts where the enquiry type could not be derived at all
   *  (0–1). Surface a banner when this crosses ~0.20. */
  untaggedRate: number;
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
  const tagSourceCounts: Record<EnquiryTagSource, number> = {
    explicit: 0, event: 0, url: 0, utm: 0, untagged: 0,
  };
  let totalAdVerified = 0;
  let totalHeuristicPaid = 0;

  type ETAgg = { total: number; verified: number; heuristicPaid: number; other: number };
  const enquiryCounts = new Map<string, ETAgg>();
  const formCounts = new Map<string, number>();
  type DateAgg = { total: number; verified: number; heuristicPaid: number; other: number };
  const dateCounts = new Map<string, DateAgg>();

  for (const c of contacts) {
    // Primary: hs_analytics_source. Override when a click-ID or utm_source
    // proves a different channel (HubSpot often tags real Meta clicks as
    // OTHER_CAMPAIGNS when GA wasn't decorating the URL).
    let channel: LeadChannel = mapAnalyticsSourceToChannel(c.analyticsSource);
    if (c.facebookClickId) channel = "meta";
    else if (c.googleClickId) channel = "google";
    else {
      const { utmSource, utmMedium } = extractMetaCampaignFromFirstUrl(c.firstUrl);
      const utmChannel = channelFromUtmSource(utmSource);
      if (utmChannel && (channel === "other" || channel === "direct" || isPaidUtmMedium(utmMedium))) {
        channel = utmChannel;
      }
    }
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

    const derived = deriveEnquiryType(c);
    tagSourceCounts[derived.source] += 1;
    const agg = enquiryCounts.get(derived.value) ?? { total: 0, verified: 0, heuristicPaid: 0, other: 0 };
    agg.total += 1;
    if (status === "verified") agg.verified += 1;
    else if (status === "heuristic_paid") agg.heuristicPaid += 1;
    else agg.other += 1;
    enquiryCounts.set(derived.value, agg);

    const formId = extractFormIdFromEvent(
      c.recentConversionEventName ?? c.firstConversionEventName,
    );
    if (formId) {
      formCounts.set(formId, (formCounts.get(formId) ?? 0) + 1);
    }

    // Daily bucket — strip time portion off createdate so all ISO variants
    // (2026-04-17, 2026-04-17T09:31:00Z, 2026-04-17 09:31:00) land in one slot.
    const rawDate = (c.createdate ?? "").slice(0, 10);
    if (rawDate) {
      const agg = dateCounts.get(rawDate) ?? { total: 0, verified: 0, heuristicPaid: 0, other: 0 };
      agg.total += 1;
      if (status === "verified") agg.verified += 1;
      else if (status === "heuristic_paid") agg.heuristicPaid += 1;
      else agg.other += 1;
      dateCounts.set(rawDate, agg);
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

  const byEnquiryType: EnquiryTypeBreakdown[] = Array.from(enquiryCounts.entries())
    .map(([enquiryType, a]) => ({ enquiryType, ...a }))
    .sort((a, b) => b.total - a.total);

  const byForm: FormBreakdown[] = Array.from(formCounts.entries())
    .map(([formId, total]) => ({ formId, total }))
    .sort((a, b) => b.total - a.total);

  const byDate: VerifiedByDateBreakdown[] = Array.from(dateCounts.entries())
    .map(([date, a]) => ({ date, ...a }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalHubSpotLeads: contacts.length,
    totalPlatformClaimed: platformTotals.total,
    totalAdVerified,
    totalHeuristicPaid,
    byChannel,
    byLeadType,
    byEnquiryType,
    byForm,
    byDate,
    unattributed,
    enquiryTagSources: tagSourceCounts,
    untaggedRate: contacts.length > 0 ? tagSourceCounts.untagged / contacts.length : 0,
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
    // Apply the same channel override rules as reconcileLeads so a Meta
    // click mis-tagged as OTHER_CAMPAIGNS still routes onto a Meta campaign.
    const parsedChannel = mapAnalyticsSourceToChannel(c.analyticsSource);
    const { utmSource, utmMedium } = extractMetaCampaignFromFirstUrl(c.firstUrl);
    const utmChannel = channelFromUtmSource(utmSource);
    let channel: LeadChannel = parsedChannel;
    if (c.facebookClickId) channel = "meta";
    else if (c.googleClickId) channel = "google";
    else if (utmChannel && (channel === "other" || channel === "direct" || isPaidUtmMedium(utmMedium))) {
      channel = utmChannel;
    }
    if (channel !== "meta" && channel !== "google") continue;
    const { campaignId, campaignName } = extractMetaCampaignFromFirstUrl(c.firstUrl);
    // Join preference: campaign ID → campaign name from URL → analyticsSourceData2 → latestSourceData1.
    const joinName = campaignName ?? c.analyticsSourceData2 ?? c.latestSourceData1 ?? null;
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
