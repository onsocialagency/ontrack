/**
 * The Ministry — Client Configuration
 *
 * Lead types, channel roles, event mapping, and helpers
 * for the Ministry coworking dashboard.
 */

/* ── Lead Types ── */

export interface LeadType {
  id: string;
  label: string;
  targetCplMin: number | null;
  targetCplMax: number | null;
  budgetMin: number;
  budgetMax: number;
  volumeMin: number | null;
  volumeMax: number | null;
}

export const LEAD_TYPES: LeadType[] = [
  {
    // Club Membership: recurring monthly product. Higher commitment than a
    // Day Pass so CPL tolerance is wider. Targets are placeholders pending
    // confirmation from The Ministry — adjust here when finalised.
    id: "club",
    label: "Club",
    targetCplMin: 12,
    targetCplMax: 25,
    budgetMin: 800,
    budgetMax: 1000,
    volumeMin: 45,
    volumeMax: 70,
  },
  {
    // Day Pass: one-off purchase, easiest acquisition, cheapest CPL.
    // Inherits the original combined Club/Day-Pass range as the proven
    // benchmark for the cheaper end of the funnel.
    id: "day_pass",
    label: "Day Pass",
    targetCplMin: 6,
    targetCplMax: 12,
    budgetMin: 400,
    budgetMax: 500,
    volumeMin: 45,
    volumeMax: 65,
  },
  {
    id: "hot_desk",
    label: "Hot Desk",
    targetCplMin: 14,
    targetCplMax: 18,
    budgetMin: 600,
    budgetMax: 800,
    volumeMin: 35,
    volumeMax: 55,
  },
  {
    id: "dedicated_desk",
    label: "Dedicated Desk",
    targetCplMin: 15,
    targetCplMax: 30,
    budgetMin: 300,
    budgetMax: 500,
    volumeMin: 10,
    volumeMax: 20,
  },
  {
    id: "private_office",
    label: "Private Office",
    targetCplMin: 40,
    targetCplMax: 80,
    budgetMin: 2000,
    budgetMax: 2500,
    volumeMin: 25,
    volumeMax: 40,
  },
  {
    id: "meeting_room",
    label: "Meeting Room",
    targetCplMin: 5,
    targetCplMax: 15,
    budgetMin: 700,
    budgetMax: 1000,
    volumeMin: 85,
    volumeMax: 125,
  },
  {
    id: "general",
    label: "General Enquiry",
    targetCplMin: null,
    targetCplMax: null,
    budgetMin: 0,
    budgetMax: 0,
    volumeMin: null,
    volumeMax: null,
  },
];

/* ── Channel Roles ── */

export interface ChannelRole {
  id: string;
  label: string;
  patterns: string[];
}

export const CHANNEL_ROLES: ChannelRole[] = [
  {
    id: "prospecting",
    label: "Prospecting",
    patterns: ["prospecting", "broad", "awareness", "tof", "cold", "prosp"],
  },
  {
    id: "retargeting",
    label: "Retargeting",
    patterns: ["retargeting", "remarketing", "warm", "bof", "bot", "reta"],
  },
  {
    id: "brand",
    label: "Brand",
    patterns: ["brand", "branded"],
  },
  {
    id: "conversion",
    label: "Conversion",
    patterns: ["conversion", "enquiry", "lead", "conv", "demand"],
  },
];

/**
 * Derive channel role from a campaign name by matching against patterns.
 */
export function getChannelRole(campaignName: string): ChannelRole | null {
  const lower = campaignName.toLowerCase();
  for (const role of CHANNEL_ROLES) {
    if (role.patterns.some((p) => lower.includes(p))) return role;
  }
  return null;
}

/* ── Lead Type Detection from Campaign Names ── */

/**
 * Campaign name patterns → lead type mapping.
 * The Ministry's campaigns are named by product category.
 * This lets us segment leads by type even when Windsor can't
 * surface the enquiry_type custom parameter from Meta CAPI.
 */
// Order matters: more specific patterns first so "day_pass" doesn't get
// captured by a broader "club" rule. Day Pass is matched before Club for
// exactly that reason — a campaign called "club_daypass_q2" should land in
// day_pass, not club membership.
const LEAD_TYPE_PATTERNS: { id: string; patterns: string[] }[] = [
  { id: "day_pass", patterns: ["daypass", "day_pass", "day pass"] },
  { id: "club", patterns: ["clubmembership", "club_membership", "club_member", "clubmember", "club"] },
  { id: "private_office", patterns: ["privateoffice", "private_office", "private office"] },
  { id: "hot_desk", patterns: ["hotdesk", "hot_desk", "hot desk", "hotdesking"] },
  { id: "meeting_room", patterns: ["meetingroom", "meeting_room", "meeting room", "meetingrooms"] },
  { id: "dedicated_desk", patterns: ["dedicateddesk", "dedicated_desk", "dedicated desk"] },
];

/**
 * Derive lead type from a campaign name by matching against patterns.
 * Returns the matching LeadType, or the "general" fallback.
 */
export function getLeadTypeFromCampaign(campaignName: string): LeadType {
  const lower = campaignName.toLowerCase();
  for (const mapping of LEAD_TYPE_PATTERNS) {
    if (mapping.patterns.some((p) => lower.includes(p))) {
      return LEAD_TYPES.find((lt) => lt.id === mapping.id)!;
    }
  }
  return LEAD_TYPES.find((lt) => lt.id === "general")!;
}

/**
 * Aggregate Windsor rows into a lead type breakdown using campaign name patterns.
 * Returns { [leadTypeId]: { conversions, spend } }
 */
export interface LeadTypeBreakdown {
  conversions: number;
  spend: number;
  cpl: number;
  campaigns: string[];
}

export function aggregateByLeadType(
  rows: { campaign: string; conversions: number; spend: number; source: string }[],
): Record<string, LeadTypeBreakdown> {
  const result: Record<string, LeadTypeBreakdown> = {};

  // Initialize all lead types
  for (const lt of LEAD_TYPES) {
    result[lt.id] = { conversions: 0, spend: 0, cpl: 0, campaigns: [] };
  }

  for (const r of rows) {
    const lt = getLeadTypeFromCampaign(r.campaign);
    result[lt.id].conversions += Number(r.conversions) || 0;
    result[lt.id].spend += Number(r.spend) || 0;
    if (!result[lt.id].campaigns.includes(r.campaign)) {
      result[lt.id].campaigns.push(r.campaign);
    }
  }

  // Calculate CPL for each type
  for (const lt of LEAD_TYPES) {
    const b = result[lt.id];
    b.cpl = b.conversions > 0 ? +(b.spend / b.conversions).toFixed(2) : 0;
  }

  return result;
}

/* ── Event Mapping ── */

/**
 * Only these Meta conversion events are valid for The Ministry.
 * All other events (Lead, Purchase, Subscribe) must be excluded.
 */
export const VALID_CONVERSION_EVENTS = ["EnquiryForm", "DayPass"];

/**
 * Events to explicitly exclude — these exist in the account but
 * are not actual leads.
 */
export const EXCLUDED_EVENTS = ["Lead", "Purchase", "Subscribe"];

/**
 * Filter Windsor rows to only include valid conversion events.
 * For non-Meta rows (Google), all conversions pass through since
 * Google doesn't use the same event structure.
 *
 * Windsor may include an `action_type` or `conversion_action` field.
 * If it does, we filter. If not, we pass through all rows.
 */
export function filterValidConversions(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.filter((r) => {
    const actionType = (r.action_type || r.conversion_action || "") as string;
    // If no action_type field, pass through (can't filter)
    if (!actionType) return true;
    // Exclude known bad events
    if (EXCLUDED_EVENTS.some((e) => actionType.includes(e))) return false;
    return true;
  });
}

/* ── CPL Status ── */

export type CplStatus = "ahead" | "on_target" | "above" | "no_target" | "no_data";

/**
 * CPL status against the target range, 3-state:
 *
 *   CPL ≤ targetMin          → "ahead"     green   — cheaper than target = good
 *   targetMin < CPL ≤ Max   → "on_target" amber   — inside expected range
 *   CPL > targetMax          → "above"     red     — more expensive than target = bad
 *
 * Teams previously saw everything below the max as "ON TARGET", which is
 * misleading when a Private Office lead comes in at £12 against a £40–£80
 * range — that's dramatically ahead of target, not on it.
 *
 * Passing `hasData: false` (no leads or no spend) returns "no_data" so the
 * card renders a grey neutral badge instead of a misleading green one.
 */
export function getCplStatus(
  cpl: number,
  leadType: LeadType,
  hasData = true,
): CplStatus {
  if (!hasData) return "no_data";
  if (leadType.targetCplMin === null || leadType.targetCplMax === null) {
    return "no_target";
  }
  if (cpl <= leadType.targetCplMin) return "ahead";
  if (cpl <= leadType.targetCplMax) return "on_target";
  return "above";
}

export const CPL_STATUS_COLORS: Record<CplStatus, { bg: string; text: string; label: string }> = {
  ahead: { bg: "bg-emerald-500/20", text: "text-emerald-400", label: "Ahead of Target" },
  on_target: { bg: "bg-amber-500/20", text: "text-amber-400", label: "On Target" },
  above: { bg: "bg-red-500/20", text: "text-red-400", label: "Above Target" },
  no_target: { bg: "bg-zinc-500/20", text: "text-zinc-400", label: "No Target" },
  no_data: { bg: "bg-zinc-500/20", text: "text-zinc-400", label: "No Data" },
};

/* ── Brand ── */

export const MINISTRY_BRAND = {
  primaryColor: "#1A1A1A",
  accentColor: "#C8A96E",
  accentColorLight: "#C8A96E33",
};

/* ── HubSpot Status ── */

export const HUBSPOT_CONNECTED = false;
export const HUBSPOT_PENDING_MESSAGE =
  "HubSpot not yet connected — CRM data will appear here once access is confirmed.";
