/**
 * Creative Lab — Ad Name Parser & Channel Role Detection
 *
 * Parses the OnSocial naming convention:
 *   [CLIENT]_[FORMAT]_[TYPE]_[ANGLE]_[WEEK]
 *
 * Examples:
 *   BAYA_VID_UGC_TESTIMONIAL_W14
 *   MINISTRY_STA_BRAND_OFFER_W15
 *
 * Never throws — degrades gracefully for non-conforming names.
 */

import type { Client, ChannelRole } from "./types";

/* ── Parsed result ── */

export interface ParsedAdName {
  client: string | null;
  format: "video" | "static" | "carousel" | "unknown";
  type: "ugc" | "brand" | "product" | "motion" | "unknown";
  angle: string | null;
  week: string | null;
  raw: string;
}

/* ── Format token map ── */

const FORMAT_MAP: Record<string, ParsedAdName["format"]> = {
  VID: "video",
  VIDEO: "video",
  STA: "static",
  IMG: "static",
  STATIC: "static",
  CAR: "carousel",
  CAROUSEL: "carousel",
  DPA: "carousel",
};

/* ── Type token map ── */

const TYPE_MAP: Record<string, ParsedAdName["type"]> = {
  UGC: "ugc",
  BRAND: "brand",
  PROD: "product",
  PRODUCT: "product",
  MOTION: "motion",
};

/* ── Main parser ── */

export function parseAdName(adName: string): ParsedAdName {
  const raw = adName;
  if (!adName || typeof adName !== "string") {
    return { client: null, format: "unknown", type: "unknown", angle: null, week: null, raw };
  }

  // Normalise: uppercase, split on _ or -
  const upper = adName.toUpperCase().trim();
  const tokens = upper.split(/[_\-]+/).filter(Boolean);

  let client: string | null = null;
  let format: ParsedAdName["format"] = "unknown";
  let type: ParsedAdName["type"] = "unknown";
  let angle: string | null = null;
  let week: string | null = null;

  // Extract week token (W + digits anywhere in the tokens)
  const weekIdx = tokens.findIndex((t) => /^W\d{1,3}$/.test(t));
  if (weekIdx !== -1) {
    week = tokens[weekIdx];
    tokens.splice(weekIdx, 1);
  }

  // Try to match the convention: [CLIENT]_[FORMAT]_[TYPE]_[ANGLE...]
  // We need at least 3 tokens (client + format + type) for a valid parse
  if (tokens.length >= 3) {
    // First token is always client
    client = tokens[0];

    // Try to find a format token
    for (let i = 1; i < tokens.length; i++) {
      if (FORMAT_MAP[tokens[i]]) {
        format = FORMAT_MAP[tokens[i]];
        // Try the next token as type
        if (i + 1 < tokens.length && TYPE_MAP[tokens[i + 1]]) {
          type = TYPE_MAP[tokens[i + 1]];
          // Everything after type (before week, already removed) is the angle
          const angleTokens = tokens.slice(i + 2);
          if (angleTokens.length > 0) {
            angle = angleTokens.join("_");
          }
        }
        break;
      }
    }
  }

  // If we didn't find format but have 2+ tokens, still try to extract what we can
  if (format === "unknown" && tokens.length >= 2) {
    // Check if any token is a type
    for (const t of tokens) {
      if (TYPE_MAP[t]) {
        type = TYPE_MAP[t];
        break;
      }
    }
  }

  return { client, format, type, angle, week, raw };
}

/* ── Channel role detection ── */

const BUILTIN_PATTERNS: Record<Exclude<ChannelRole, "unknown">, string[]> = {
  prospecting: [
    "prospecting", "broad", "awareness", "tof", "cold", "prosp",
    "lookalike", "lal", "interest", "top of funnel", "top_of_funnel",
  ],
  retargeting: [
    "retargeting", "remarketing", "warm", "bof", "bot", "reta",
    "website visitors", "engaged", "mofu", "mid funnel",
  ],
  brand: [
    "brand", "branded",
  ],
  conversion: [
    "conversion", "enquiry", "lead", "conv", "purchase", "sales",
    "dpa", "dynamic product", "catalog",
  ],
};

/**
 * Detect channel role from campaign + ad set names.
 * Checks client-configured patterns first, then built-in patterns.
 * Defaults to "retargeting" if nothing matches.
 */
export function detectChannelRole(
  campaignName: string,
  adSetName: string = "",
  patterns?: Client["channelRoles"],
): ChannelRole {
  const searchText = `${campaignName} ${adSetName}`.toLowerCase();

  // Check client-configured patterns first
  if (patterns) {
    for (const [role, keywords] of Object.entries(patterns)) {
      if (keywords && keywords.some((kw) => searchText.includes(kw.toLowerCase()))) {
        return role as ChannelRole;
      }
    }
  }

  // Fall back to built-in patterns
  for (const [role, keywords] of Object.entries(BUILTIN_PATTERNS)) {
    if (keywords.some((kw) => searchText.includes(kw))) {
      return role as ChannelRole;
    }
  }

  // Default per spec: retargeting
  return "retargeting";
}

/**
 * Detect creative format from signals (used when ad name parsing fails).
 */
export function detectFormatFromSignals(opts: {
  adName: string;
  campaignName: string;
  source: string;
  hasVideoMetrics: boolean;
  hasKeyword: boolean;
  hasThumbnail: boolean;
  hasAdCopy: boolean;
}): "VID" | "STA" | "CAR" | "SEARCH" {
  const { adName, campaignName, source, hasVideoMetrics, hasKeyword } = opts;
  const combined = `${adName} ${campaignName}`.toLowerCase();

  // Google search detection
  if (
    source === "google_ads" &&
    (hasKeyword ||
      /\b(search|pmax|rsa|responsive)\b/.test(combined))
  ) {
    return "SEARCH";
  }

  // Video detection
  if (
    hasVideoMetrics ||
    /\b(video|vid|ugc|reel|story|stories)\b/.test(combined)
  ) {
    return "VID";
  }

  // Carousel detection
  if (/\b(carousel|car|dpa|catalog|catalogue)\b/.test(combined)) {
    return "CAR";
  }

  return "STA";
}
