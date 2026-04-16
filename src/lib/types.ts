export type ClientType = "ecommerce" | "lead_gen" | "hybrid";
export type Currency = "GBP" | "USD" | "EUR" | "AED";
export type Tier = "tier_1" | "tier_2" | "tier_3" | "tier_4" | "premium";
export type Platform = "meta" | "google" | "all";
export type AttributionModel = "first_click" | "last_click" | "linear" | "time_decay" | "position_based" | "blended";

export interface Client {
  id: string;
  name: string;
  slug: string;
  type: ClientType;
  industry: string;
  currency: Currency;
  monthlyBudget: number;
  metaAllocation: number;
  googleAllocation: number;
  targetROAS: number;
  targetCPL?: number;
  targetCPA: number;
  targetMER: number;
  pacingThreshold: number;
  tier: Tier;
  retainerFee: number;
  contractStart: string;
  contractRenewal: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  password: string;
  windsorApiKey?: string;
  metaAccountIds: string[];
  googleCustomerIds: string[];
  averageDealValue?: number;
  historicalCloseRate?: number;
  /** BCP 47 locale tag — drives date/number formatting. e.g. "en-GB", "en-AE", "es-ES" */
  locale?: string;
  /** IANA timezone — drives "last updated" timestamps. e.g. "Europe/London", "Asia/Dubai" */
  timezone?: string;
  /** Day of month the billing period starts (from contract start date). e.g. 29 for The Ministry */
  billingStartDay?: number;

  /* ── Creative Lab fields ── */

  /** Campaign-name patterns for channel role detection. If no pattern matches, defaults to "retargeting". */
  channelRoles?: {
    prospecting?: string[];
    retargeting?: string[];
    brand?: string[];
    conversion?: string[];
  };

  /** Yellow banner message shown at the top of Creative Lab. null = no banner. */
  suppressScoreWarning?: string | null;

  /** Manual A/B test tracker entries managed by the account team. */
  testTracker?: Array<{
    id: string;
    hypothesis: string;
    creativeA: string;
    creativeB: string;
    winner: string | null;
    status: "running" | "concluded" | "paused";
    weekStarted: string;
  }>;

  /** TikTok ad account IDs for Windsor TikTok connector. */
  tiktokAccountIds?: string[];
}

/* ── Creative Lab types ── */

export type ChannelRole = "prospecting" | "retargeting" | "brand" | "conversion" | "unknown";
export type CreativeFormat = "VID" | "STA" | "CAR" | "SEARCH";
export type CreativeType = "UGC" | "BRAND" | "PRODUCT" | "MOTION" | "SEARCH" | "UNKNOWN";
export type ScoreLabel = "Scale" | "Optimise" | "Review" | "Kill" | "Learning";
export type FatigueLevel = "none" | "warning" | "fatigued" | "critical";
export type CreativePlatform = "meta" | "tiktok" | "google";

export interface DailyMetric {
  date: string;
  platform: Platform;
  campaign: string;
  adSet?: string;
  adName?: string;
  adId?: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpa: number;
  roas: number;
  videoPlays3s?: number;
  thruPlays?: number;
  videoCompletions?: number;
  frequency?: number;
  thumbnailUrl?: string;
}

export interface KPISummary {
  spend: number;
  spendDelta: number;
  roas: number;
  roasDelta: number;
  mer: number;
  merDelta: number;
  cpa: number;
  cpaDelta: number;
  impressions: number;
  impressionsDelta: number;
  conversions: number;
  conversionsDelta: number;
  revenue: number;
  revenueDelta: number;
  cpl?: number;
  cplDelta?: number;
}

export interface CampaignRow {
  id: string;
  name: string;
  platform: Platform;
  level: "campaign" | "adset" | "ad";
  parentId?: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversions: number;
  cpa: number;
  roas: number;
  cpl?: number;
  thumbnailUrl?: string;
  children?: CampaignRow[];
}

export interface Creative {
  id: string;
  adId: string;
  name: string;
  campaign: string;
  platform: Platform;
  format: "VID" | "STA" | "CAR" | "SEARCH";
  type: "UGC" | "BRAND" | "PRODUCT" | "MOTION" | "SEARCH";
  angle: string;
  week: string;
  thumbnailUrl: string;
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
  confidenceWeight: number;
  fatigueScore: number;
  isFatigued: boolean;
  // Google Ads fields
  adTitle?: string;
  adBody?: string;
  adSet?: string;
  keywordText?: string;
  keywordMatchType?: string;
  websiteDestUrl?: string;
}

export interface LeadFunnelStage {
  name: string;
  count: number;
  conversionRate: number;
}

export interface RevenueClient {
  clientId: string;
  clientName: string;
  tier: Tier;
  retainerFee: number;
  currency: Currency;
  currentSpend: number;
  renewalDate: string;
  upsellFlag: boolean;
  downgradeFlag: boolean;
}

export interface Alert {
  id: string;
  type: "pacing" | "fatigue" | "cpa_spike" | "renewal";
  clientId: string;
  clientName: string;
  message: string;
  severity: "warning" | "critical" | "info";
  timestamp: string;
}

export interface TierConfig {
  tier: Tier;
  fee: number;
  spendMin: number;
  spendMax: number;
  notes: string;
}
