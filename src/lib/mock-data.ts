import type {
  Client,
  Platform,
  DailyMetric,
  KPISummary,
  CampaignRow,
  Creative,
  LeadFunnelStage,
  RevenueClient,
  Alert,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Seeded pseudo-random so numbers are stable across renders. */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const rand = seededRandom(42);

function vary(base: number, pct: number): number {
  return +(base * (1 + (rand() - 0.5) * 2 * pct)).toFixed(2);
}

function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function dateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function isoTimestamp(daysAgo: number): string {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(d.getHours() + randInt(0, 12));
  return d.toISOString();
}

function uuid(): string {
  const hex = () =>
    Math.floor(rand() * 16)
      .toString(16);
  let out = "";
  for (let i = 0; i < 32; i++) out += hex();
  return (
    out.slice(0, 8) +
    "-" +
    out.slice(8, 12) +
    "-" +
    out.slice(12, 16) +
    "-" +
    out.slice(16, 20) +
    "-" +
    out.slice(20)
  );
}

// ---------------------------------------------------------------------------
// Client configs
// ---------------------------------------------------------------------------

const irgClient: Client = {
  id: "cl_irg_001",
  name: "Ibiza Rocks Group",
  slug: "irg",
  type: "ecommerce",
  industry: "Hospitality / Events",
  currency: "EUR",
  monthlyBudget: 304000, // Season total (Mar-Oct 2026) — see budgetPeriod flag
  budgetPeriod: "seasonal",
  seasonStart: "2026-03-01",
  seasonEnd: "2026-10-31",
  metaAllocation: 0.45,
  googleAllocation: 0.55,
  targetROAS: 0, // ROAS unavailable — AOV data not received from IRG
  targetCPA: 0, // TBD
  targetMER: 0, // TBD
  pacingThreshold: 0.9,
  tier: "tier_4",
  retainerFee: 5000,
  contractStart: "2026-03-01",
  contractRenewal: "2026-10-31",
  logoUrl: "https://www.google.com/s2/favicons?domain=ibizarocks.com&sz=128",
  primaryColor: "#3266ad",
  secondaryColor: "#E8F0FE",
  password: "irg2026",
  metaAccountIds: ["699834239363956", "511748048632829"],
  googleCustomerIds: ["278-470-9624", "534-641-8417"],
  averageDealValue: 0, // Not yet provided by IRG
  locale: "en-ES",
  timezone: "Europe/Madrid",
  billingStartDay: 1, // Season-based (Mar 1)
};

const dentClient: Client = {
  id: "cl_dent_002",
  name: "Dent",
  slug: "dent",
  type: "ecommerce",
  industry: "Automotive / Retail",
  currency: "GBP",
  monthlyBudget: 8000,
  metaAllocation: 0.6,
  googleAllocation: 0.4,
  targetROAS: 4.0,
  targetCPA: 22,
  targetMER: 4.5,
  pacingThreshold: 0.85,
  tier: "tier_2",
  retainerFee: 1800,
  contractStart: "2026-01-15",
  contractRenewal: "2027-01-15",
  logoUrl: "https://www.google.com/s2/favicons?domain=dent.global&sz=128",
  primaryColor: "#2563EB",
  secondaryColor: "#EFF6FF",
  password: "dent2026",
  metaAccountIds: ["act_dent_meta_01"],
  googleCustomerIds: ["dent-google-01"],
  averageDealValue: 85,
  locale: "en-GB",
  timezone: "Europe/London",
  billingStartDay: 15, // Contract start Jan 15
};

const mosaicClient: Client = {
  id: "cl_mosaic_003",
  name: "Mosaic",
  slug: "mosaic",
  type: "hybrid",
  industry: "SaaS / Tech",
  currency: "USD",
  monthlyBudget: 22000,
  metaAllocation: 0.65,
  googleAllocation: 0.35,
  targetROAS: 3.5,
  targetCPL: 40,
  targetCPA: 32,
  targetMER: 4.0,
  pacingThreshold: 0.88,
  tier: "tier_4",
  retainerFee: 3500,
  contractStart: "2025-06-01",
  contractRenewal: "2026-06-01",
  logoUrl: "https://www.google.com/s2/favicons?domain=mosaic.tech&sz=128",
  primaryColor: "#8B5CF6",
  secondaryColor: "#F5F3FF",
  password: "mosaic2026",
  metaAccountIds: ["act_mosaic_meta_01", "act_mosaic_meta_02"],
  googleCustomerIds: ["mosaic-google-01"],
  averageDealValue: 450,
  historicalCloseRate: 0.1,
  locale: "en-US",
  timezone: "America/New_York",
  billingStartDay: 1, // Contract start Jun 1
};

const bayaClient: Client = {
  id: "cl_baya_004",
  name: "Baya",
  slug: "baya",
  type: "ecommerce",
  industry: "Healthcare / Consumer Goods",
  currency: "AED",
  monthlyBudget: 10000,
  metaAllocation: 0.5,
  googleAllocation: 0.5,
  targetROAS: 3.5,
  targetCPA: 45,
  targetMER: 4.0,
  pacingThreshold: 0.9,
  tier: "tier_2",
  retainerFee: 3000,
  contractStart: "2026-03-01",
  contractRenewal: "2027-03-01",
  logoUrl: "https://www.google.com/s2/favicons?domain=baya.life&sz=128",
  primaryColor: "#10857F",
  secondaryColor: "#E6F7F6",
  password: "baya2026",
  metaAccountIds: ["1869940510009915"],
  googleCustomerIds: ["292-865-1335"],
  averageDealValue: 120,
  locale: "en-AE",
  timezone: "Asia/Dubai",
  billingStartDay: 1, // Contract start Mar 1
};

const laurastarClient: Client = {
  id: "cl_laurastar_006",
  name: "Laurastar UAE",
  slug: "laurastar",
  type: "ecommerce",
  industry: "Premium Home Appliances",
  currency: "AED",
  monthlyBudget: 20000,
  metaAllocation: 0.55,
  googleAllocation: 0.45,
  targetROAS: 4.0,
  targetCPA: 120,
  targetMER: 3.5,
  pacingThreshold: 0.9,
  tier: "tier_2",
  retainerFee: 4000,
  contractStart: "2026-03-01",
  contractRenewal: "2027-03-01",
  logoUrl: "https://www.google.com/s2/favicons?domain=laurastar.com&sz=128",
  primaryColor: "#1A1A2E",
  secondaryColor: "#E8E8F0",
  password: "laurastar2026",
  metaAccountIds: ["1410031896770867"],
  googleCustomerIds: ["185-852-9370"],
  averageDealValue: 2200, // AED — premium steam stations
  locale: "en-AE",
  timezone: "Asia/Dubai",
  billingStartDay: 1,
};

const ministryClient: Client = {
  id: "cl_ministry_005",
  name: "The Ministry",
  slug: "ministry",
  type: "lead_gen",
  industry: "Coworking / Flexible Workspace",
  currency: "GBP",
  monthlyBudget: 5000,
  metaAllocation: 0.6,
  googleAllocation: 0.4,
  targetROAS: 0,
  targetCPA: 0,
  targetMER: 0,
  pacingThreshold: 0.8,
  tier: "tier_1",
  retainerFee: 2500,
  contractStart: "2026-01-29",
  contractRenewal: "2027-01-29",
  logoUrl: "https://www.google.com/s2/favicons?domain=theministry.com&sz=128",
  primaryColor: "#1A1A1A",
  secondaryColor: "#C8A96E",
  password: "ministry2026",
  metaAccountIds: ["241012023"],
  googleCustomerIds: ["771-197-5192"],
  locale: "en-GB",
  timezone: "Europe/London",
  billingStartDay: 29, // Contract start Jan 29
};

export const clients: Client[] = [irgClient, dentClient, mosaicClient, bayaClient, laurastarClient, ministryClient];

export function getClient(slug: string): Client | undefined {
  return clients.find((c) => c.slug === slug);
}

// ---------------------------------------------------------------------------
// Campaign structures per client
// ---------------------------------------------------------------------------

interface CampaignSeed {
  id: string;
  name: string;
  platform: Platform;
  dailyBudget: number;
  avgCPC: number;
  avgCVR: number;
  avgAOV: number;
  adSets: {
    id: string;
    name: string;
    ads: { id: string; name: string; thumbIdx: number }[];
  }[];
}

const irgCampaigns: CampaignSeed[] = [
  {
    id: "irg_c1",
    name: "IRG_Meta_Prospecting_TOF",
    platform: "meta",
    dailyBudget: 180,
    avgCPC: 0.62,
    avgCVR: 0.028,
    avgAOV: 92,
    adSets: [
      {
        id: "irg_as1",
        name: "IRG_Meta_Broad_25-55",
        ads: [
          { id: "irg_ad1", name: "IRG_VID_UGC_TESTIMONIAL_W14", thumbIdx: 0 },
          { id: "irg_ad2", name: "IRG_STA_PRODUCT_LIFESTYLE_W14", thumbIdx: 1 },
          { id: "irg_ad3", name: "IRG_CAR_PRODUCT_BESTSELLER_W13", thumbIdx: 2 },
        ],
      },
      {
        id: "irg_as2",
        name: "IRG_Meta_Interest_HomeDecor",
        ads: [
          { id: "irg_ad4", name: "IRG_VID_BRAND_STORY_W14", thumbIdx: 3 },
          { id: "irg_ad5", name: "IRG_STA_UGC_UNBOXING_W13", thumbIdx: 4 },
        ],
      },
    ],
  },
  {
    id: "irg_c2",
    name: "IRG_Meta_Retargeting_BOF",
    platform: "meta",
    dailyBudget: 120,
    avgCPC: 0.45,
    avgCVR: 0.052,
    avgAOV: 105,
    adSets: [
      {
        id: "irg_as3",
        name: "IRG_Meta_VC_7d",
        ads: [
          { id: "irg_ad6", name: "IRG_VID_MOTION_SALE_W14", thumbIdx: 5 },
          { id: "irg_ad7", name: "IRG_CAR_PRODUCT_NEWDROP_W14", thumbIdx: 6 },
        ],
      },
    ],
  },
  {
    id: "irg_c3",
    name: "IRG_Meta_DPA",
    platform: "meta",
    dailyBudget: 50,
    avgCPC: 0.38,
    avgCVR: 0.061,
    avgAOV: 78,
    adSets: [
      {
        id: "irg_as4",
        name: "IRG_Meta_DPA_AllProducts",
        ads: [
          { id: "irg_ad8", name: "IRG_CAR_PRODUCT_DPA_W14", thumbIdx: 7 },
        ],
      },
    ],
  },
  {
    id: "irg_c4",
    name: "IRG_Google_Shopping",
    platform: "google",
    dailyBudget: 90,
    avgCPC: 0.52,
    avgCVR: 0.035,
    avgAOV: 88,
    adSets: [
      {
        id: "irg_as5",
        name: "IRG_Google_PMAX_AllProducts",
        ads: [
          { id: "irg_ad9", name: "IRG_STA_PRODUCT_PMAX_W14", thumbIdx: 8 },
        ],
      },
    ],
  },
  {
    id: "irg_c5",
    name: "IRG_Google_Search_Brand",
    platform: "google",
    dailyBudget: 60,
    avgCPC: 0.28,
    avgCVR: 0.082,
    avgAOV: 95,
    adSets: [
      {
        id: "irg_as6",
        name: "IRG_Google_Brand_Exact",
        ads: [
          { id: "irg_ad10", name: "IRG_STA_BRAND_SEARCH_W14", thumbIdx: 9 },
        ],
      },
    ],
  },
];

const dentCampaigns: CampaignSeed[] = [
  {
    id: "dent_c1",
    name: "Dent_Meta_LeadGen_TOF",
    platform: "meta",
    dailyBudget: 95,
    avgCPC: 1.1,
    avgCVR: 0.04,
    avgAOV: 0,
    adSets: [
      {
        id: "dent_as1",
        name: "Dent_Meta_Lookalike_1pct",
        ads: [
          { id: "dent_ad1", name: "DENT_VID_UGC_CASESTUDY_W14", thumbIdx: 0 },
          { id: "dent_ad2", name: "DENT_STA_BRAND_TRUSTPILOT_W14", thumbIdx: 1 },
          { id: "dent_ad3", name: "DENT_VID_MOTION_EXPLAINER_W13", thumbIdx: 2 },
        ],
      },
      {
        id: "dent_as2",
        name: "Dent_Meta_Interest_SME",
        ads: [
          { id: "dent_ad4", name: "DENT_CAR_UGC_BEFOREAFTER_W14", thumbIdx: 3 },
          { id: "dent_ad5", name: "DENT_STA_PRODUCT_STAT_W13", thumbIdx: 4 },
        ],
      },
    ],
  },
  {
    id: "dent_c2",
    name: "Dent_Meta_Retargeting",
    platform: "meta",
    dailyBudget: 65,
    avgCPC: 0.85,
    avgCVR: 0.065,
    avgAOV: 0,
    adSets: [
      {
        id: "dent_as3",
        name: "Dent_Meta_VC_Engaged",
        ads: [
          { id: "dent_ad6", name: "DENT_VID_BRAND_TESTIMONIAL_W14", thumbIdx: 5 },
          { id: "dent_ad7", name: "DENT_STA_MOTION_CTA_W14", thumbIdx: 6 },
        ],
      },
    ],
  },
  {
    id: "dent_c3",
    name: "Dent_Google_Search_NonBrand",
    platform: "google",
    dailyBudget: 70,
    avgCPC: 2.8,
    avgCVR: 0.05,
    avgAOV: 0,
    adSets: [
      {
        id: "dent_as4",
        name: "Dent_Google_NB_Services",
        ads: [
          { id: "dent_ad8", name: "DENT_STA_BRAND_SEARCH_W14", thumbIdx: 7 },
        ],
      },
    ],
  },
  {
    id: "dent_c4",
    name: "Dent_Google_Search_Brand",
    platform: "google",
    dailyBudget: 36,
    avgCPC: 0.65,
    avgCVR: 0.11,
    avgAOV: 0,
    adSets: [
      {
        id: "dent_as5",
        name: "Dent_Google_Brand_Exact",
        ads: [
          { id: "dent_ad9", name: "DENT_STA_BRAND_BRAND_W14", thumbIdx: 8 },
        ],
      },
    ],
  },
];

const mosaicCampaigns: CampaignSeed[] = [
  {
    id: "mosaic_c1",
    name: "Mosaic_Meta_Prospecting_TOF",
    platform: "meta",
    dailyBudget: 250,
    avgCPC: 0.95,
    avgCVR: 0.022,
    avgAOV: 145,
    adSets: [
      {
        id: "mosaic_as1",
        name: "Mosaic_Meta_Broad_US",
        ads: [
          { id: "mosaic_ad1", name: "MOSAIC_VID_UGC_DEMO_W14", thumbIdx: 0 },
          { id: "mosaic_ad2", name: "MOSAIC_STA_BRAND_FEATURE_W14", thumbIdx: 1 },
          { id: "mosaic_ad3", name: "MOSAIC_VID_MOTION_PRODUCT_W13", thumbIdx: 2 },
        ],
      },
      {
        id: "mosaic_as2",
        name: "Mosaic_Meta_Lookalike_2pct",
        ads: [
          { id: "mosaic_ad4", name: "MOSAIC_CAR_PRODUCT_COMPARE_W14", thumbIdx: 3 },
          { id: "mosaic_ad5", name: "MOSAIC_VID_UGC_REVIEW_W13", thumbIdx: 4 },
        ],
      },
    ],
  },
  {
    id: "mosaic_c2",
    name: "Mosaic_Meta_Retargeting_BOF",
    platform: "meta",
    dailyBudget: 150,
    avgCPC: 0.7,
    avgCVR: 0.045,
    avgAOV: 165,
    adSets: [
      {
        id: "mosaic_as3",
        name: "Mosaic_Meta_VC_14d",
        ads: [
          { id: "mosaic_ad6", name: "MOSAIC_VID_BRAND_CASESTUDY_W14", thumbIdx: 5 },
          { id: "mosaic_ad7", name: "MOSAIC_STA_MOTION_OFFER_W14", thumbIdx: 6 },
        ],
      },
    ],
  },
  {
    id: "mosaic_c3",
    name: "Mosaic_Meta_LeadGen_MQL",
    platform: "meta",
    dailyBudget: 75,
    avgCPC: 1.2,
    avgCVR: 0.035,
    avgAOV: 0,
    adSets: [
      {
        id: "mosaic_as4",
        name: "Mosaic_Meta_LeadForm_US",
        ads: [
          { id: "mosaic_ad8", name: "MOSAIC_VID_UGC_TESTIMONIAL_W14", thumbIdx: 7 },
          { id: "mosaic_ad9", name: "MOSAIC_STA_PRODUCT_WHITEPAPER_W13", thumbIdx: 8 },
        ],
      },
    ],
  },
  {
    id: "mosaic_c4",
    name: "Mosaic_Google_PMAX",
    platform: "google",
    dailyBudget: 130,
    avgCPC: 1.05,
    avgCVR: 0.031,
    avgAOV: 155,
    adSets: [
      {
        id: "mosaic_as5",
        name: "Mosaic_Google_PMAX_AllAssets",
        ads: [
          { id: "mosaic_ad10", name: "MOSAIC_STA_PRODUCT_PMAX_W14", thumbIdx: 9 },
        ],
      },
    ],
  },
  {
    id: "mosaic_c5",
    name: "Mosaic_Google_Search_NB",
    platform: "google",
    dailyBudget: 95,
    avgCPC: 1.85,
    avgCVR: 0.042,
    avgAOV: 140,
    adSets: [
      {
        id: "mosaic_as6",
        name: "Mosaic_Google_NB_SaaS",
        ads: [
          { id: "mosaic_ad11", name: "MOSAIC_STA_BRAND_SEARCH_W14", thumbIdx: 10 },
        ],
      },
    ],
  },
  {
    id: "mosaic_c6",
    name: "Mosaic_Google_Search_Brand",
    platform: "google",
    dailyBudget: 33,
    avgCPC: 0.45,
    avgCVR: 0.095,
    avgAOV: 160,
    adSets: [
      {
        id: "mosaic_as7",
        name: "Mosaic_Google_Brand_Exact",
        ads: [
          { id: "mosaic_ad12", name: "MOSAIC_STA_BRAND_BRAND_W14", thumbIdx: 11 },
        ],
      },
    ],
  },
];

const bayaCampaigns: CampaignSeed[] = [
  {
    id: "baya_c1",
    name: "Baya_Meta_Prospecting_TOF",
    platform: "meta",
    dailyBudget: 85,
    avgCPC: 0.55,
    avgCVR: 0.022,
    avgAOV: 135,
    adSets: [
      {
        id: "baya_as1",
        name: "Baya_Meta_Broad_UAE",
        ads: [
          { id: "baya_ad1", name: "BAYA_VID_UGC_HEALTH_W14", thumbIdx: 0 },
          { id: "baya_ad2", name: "BAYA_STA_PRODUCT_WELLNESS_W14", thumbIdx: 1 },
        ],
      },
      {
        id: "baya_as2",
        name: "Baya_Meta_Interest_Health",
        ads: [
          { id: "baya_ad3", name: "BAYA_VID_BRAND_TRUST_W13", thumbIdx: 2 },
          { id: "baya_ad4", name: "BAYA_CAR_PRODUCT_RANGE_W13", thumbIdx: 3 },
        ],
      },
    ],
  },
  {
    id: "baya_c2",
    name: "Baya_Meta_Retargeting_BOF",
    platform: "meta",
    dailyBudget: 65,
    avgCPC: 0.42,
    avgCVR: 0.045,
    avgAOV: 150,
    adSets: [
      {
        id: "baya_as3",
        name: "Baya_Meta_VC_7d",
        ads: [
          { id: "baya_ad5", name: "BAYA_VID_MOTION_OFFER_W14", thumbIdx: 4 },
          { id: "baya_ad6", name: "BAYA_STA_PRODUCT_PROMO_W14", thumbIdx: 5 },
        ],
      },
    ],
  },
  {
    id: "baya_c3",
    name: "Baya_Google_Shopping",
    platform: "google",
    dailyBudget: 100,
    avgCPC: 0.72,
    avgCVR: 0.032,
    avgAOV: 125,
    adSets: [
      {
        id: "baya_as4",
        name: "Baya_Google_Shopping_AllProducts",
        ads: [
          { id: "baya_ad7", name: "BAYA_STA_PRODUCT_SHOPPING_W14", thumbIdx: 6 },
        ],
      },
    ],
  },
  {
    id: "baya_c4",
    name: "Baya_Google_Search_Brand",
    platform: "google",
    dailyBudget: 55,
    avgCPC: 0.35,
    avgCVR: 0.065,
    avgAOV: 140,
    adSets: [
      {
        id: "baya_as5",
        name: "Baya_Google_Brand_Exact",
        ads: [
          { id: "baya_ad8", name: "BAYA_STA_BRAND_SEARCH_W14", thumbIdx: 7 },
        ],
      },
    ],
  },
];

const laurastarCampaigns: CampaignSeed[] = [
  {
    id: "ls_c1",
    name: "LS_Meta_Prospecting_TOF",
    platform: "meta",
    dailyBudget: 140,
    avgCPC: 1.85,
    avgCVR: 0.012,
    avgAOV: 2200,
    adSets: [
      {
        id: "ls_as1",
        name: "LS_Meta_Broad_UAE_25-55",
        ads: [
          { id: "ls_ad1", name: "LS_VID_UGC_UNBOXING_W14", thumbIdx: 0 },
          { id: "ls_ad2", name: "LS_STA_PRODUCT_HERO_W14", thumbIdx: 1 },
          { id: "ls_ad3", name: "LS_VID_BRAND_LIFESTYLE_W13", thumbIdx: 2 },
        ],
      },
      {
        id: "ls_as2",
        name: "LS_Meta_Interest_HomeAppliance",
        ads: [
          { id: "ls_ad4", name: "LS_CAR_PRODUCT_RANGE_W14", thumbIdx: 3 },
          { id: "ls_ad5", name: "LS_VID_MOTION_DEMO_W13", thumbIdx: 4 },
        ],
      },
    ],
  },
  {
    id: "ls_c2",
    name: "LS_Meta_Retargeting_BOF",
    platform: "meta",
    dailyBudget: 95,
    avgCPC: 1.2,
    avgCVR: 0.028,
    avgAOV: 2400,
    adSets: [
      {
        id: "ls_as3",
        name: "LS_Meta_VC_7d_ATC",
        ads: [
          { id: "ls_ad6", name: "LS_VID_MOTION_OFFER_W14", thumbIdx: 5 },
          { id: "ls_ad7", name: "LS_STA_PRODUCT_REVIEW_W14", thumbIdx: 6 },
        ],
      },
    ],
  },
  {
    id: "ls_c3",
    name: "LS_Meta_Seasonal_Ramadan",
    platform: "meta",
    dailyBudget: 65,
    avgCPC: 1.5,
    avgCVR: 0.018,
    avgAOV: 2100,
    adSets: [
      {
        id: "ls_as4",
        name: "LS_Meta_Ramadan_Gifting",
        ads: [
          { id: "ls_ad8", name: "LS_VID_BRAND_RAMADAN_W14", thumbIdx: 7 },
          { id: "ls_ad9", name: "LS_STA_PRODUCT_GIFT_W14", thumbIdx: 8 },
        ],
      },
    ],
  },
  {
    id: "ls_c4",
    name: "LS_Google_PMAX_Shopping",
    platform: "google",
    dailyBudget: 120,
    avgCPC: 2.4,
    avgCVR: 0.015,
    avgAOV: 2300,
    adSets: [
      {
        id: "ls_as5",
        name: "LS_Google_PMAX_AllProducts",
        ads: [
          { id: "ls_ad10", name: "LS_STA_PRODUCT_PMAX_W14", thumbIdx: 9 },
        ],
      },
    ],
  },
  {
    id: "ls_c5",
    name: "LS_Google_Search_Brand",
    platform: "google",
    dailyBudget: 80,
    avgCPC: 0.95,
    avgCVR: 0.045,
    avgAOV: 2500,
    adSets: [
      {
        id: "ls_as6",
        name: "LS_Google_Brand_Exact",
        ads: [
          { id: "ls_ad11", name: "LS_STA_BRAND_SEARCH_W14", thumbIdx: 10 },
        ],
      },
    ],
  },
  {
    id: "ls_c6",
    name: "LS_Google_Search_NonBrand",
    platform: "google",
    dailyBudget: 75,
    avgCPC: 3.2,
    avgCVR: 0.009,
    avgAOV: 2150,
    adSets: [
      {
        id: "ls_as7",
        name: "LS_Google_NB_SteamIron",
        ads: [
          { id: "ls_ad12", name: "LS_STA_BRAND_NB_SEARCH_W14", thumbIdx: 11 },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Dynamic campaign seed generator — creates seeds for ANY client from config
// ---------------------------------------------------------------------------

function generateCampaignSeeds(client: Client): CampaignSeed[] {
  const prefix = client.slug.toUpperCase();
  const dailyBudget = client.monthlyBudget / 30;
  const metaBudget = dailyBudget * client.metaAllocation;
  const googleBudget = dailyBudget * client.googleAllocation;
  const isLeadGen = client.type === "lead_gen";
  const avgAOV = client.averageDealValue ?? (isLeadGen ? 0 : 85);

  const seeds: CampaignSeed[] = [];

  // Meta campaigns
  if (client.metaAllocation > 0) {
    seeds.push({
      id: `${client.slug}_c1`,
      name: `${prefix}_Meta_Prospecting_TOF`,
      platform: "meta",
      dailyBudget: +(metaBudget * 0.5).toFixed(2),
      avgCPC: isLeadGen ? 1.1 : 0.62,
      avgCVR: isLeadGen ? 0.04 : 0.028,
      avgAOV,
      adSets: [
        {
          id: `${client.slug}_as1`,
          name: `${prefix}_Meta_Broad`,
          ads: [
            { id: `${client.slug}_ad1`, name: `${prefix}_VID_UGC_TESTIMONIAL_W14`, thumbIdx: 0 },
            { id: `${client.slug}_ad2`, name: `${prefix}_STA_PRODUCT_LIFESTYLE_W14`, thumbIdx: 1 },
          ],
        },
      ],
    });
    seeds.push({
      id: `${client.slug}_c2`,
      name: `${prefix}_Meta_Retargeting_BOF`,
      platform: "meta",
      dailyBudget: +(metaBudget * 0.35).toFixed(2),
      avgCPC: isLeadGen ? 0.85 : 0.45,
      avgCVR: isLeadGen ? 0.065 : 0.052,
      avgAOV,
      adSets: [
        {
          id: `${client.slug}_as2`,
          name: `${prefix}_Meta_VC_7d`,
          ads: [
            { id: `${client.slug}_ad3`, name: `${prefix}_VID_MOTION_SALE_W14`, thumbIdx: 2 },
            { id: `${client.slug}_ad4`, name: `${prefix}_STA_BRAND_CTA_W14`, thumbIdx: 3 },
          ],
        },
      ],
    });
    if (!isLeadGen) {
      seeds.push({
        id: `${client.slug}_c3`,
        name: `${prefix}_Meta_DPA`,
        platform: "meta",
        dailyBudget: +(metaBudget * 0.15).toFixed(2),
        avgCPC: 0.38,
        avgCVR: 0.061,
        avgAOV,
        adSets: [
          {
            id: `${client.slug}_as3`,
            name: `${prefix}_Meta_DPA_AllProducts`,
            ads: [
              { id: `${client.slug}_ad5`, name: `${prefix}_CAR_PRODUCT_DPA_W14`, thumbIdx: 4 },
            ],
          },
        ],
      });
    }
  }

  // Google campaigns
  if (client.googleAllocation > 0) {
    seeds.push({
      id: `${client.slug}_c4`,
      name: isLeadGen ? `${prefix}_Google_Search_NonBrand` : `${prefix}_Google_Shopping`,
      platform: "google",
      dailyBudget: +(googleBudget * 0.6).toFixed(2),
      avgCPC: isLeadGen ? 2.8 : 0.52,
      avgCVR: isLeadGen ? 0.05 : 0.035,
      avgAOV,
      adSets: [
        {
          id: `${client.slug}_as4`,
          name: isLeadGen ? `${prefix}_Google_NB_Services` : `${prefix}_Google_PMAX_AllProducts`,
          ads: [
            { id: `${client.slug}_ad6`, name: `${prefix}_STA_PRODUCT_PMAX_W14`, thumbIdx: 5 },
          ],
        },
      ],
    });
    seeds.push({
      id: `${client.slug}_c5`,
      name: `${prefix}_Google_Search_Brand`,
      platform: "google",
      dailyBudget: +(googleBudget * 0.4).toFixed(2),
      avgCPC: 0.28,
      avgCVR: 0.082,
      avgAOV,
      adSets: [
        {
          id: `${client.slug}_as5`,
          name: `${prefix}_Google_Brand_Exact`,
          ads: [
            { id: `${client.slug}_ad7`, name: `${prefix}_STA_BRAND_SEARCH_W14`, thumbIdx: 6 },
          ],
        },
      ],
    });
  }

  return seeds;
}

/** Hardcoded seeds for the original clients; dynamic generation for any others */
const campaignSeedMap: Record<string, CampaignSeed[]> = {
  irg: irgCampaigns,
  dent: dentCampaigns,
  mosaic: mosaicCampaigns,
  baya: bayaCampaigns,
  laurastar: laurastarCampaigns,
};

function getCampaignSeeds(client: Client): CampaignSeed[] {
  return campaignSeedMap[client.slug] ?? generateCampaignSeeds(client);
}

// ---------------------------------------------------------------------------
// Daily metric generation
// ---------------------------------------------------------------------------

function generateDailyMetrics(
  seeds: CampaignSeed[],
  days: number
): DailyMetric[] {
  const metrics: DailyMetric[] = [];
  for (let d = days - 1; d >= 0; d--) {
    const date = dateStr(d);
    for (const c of seeds) {
      const daySpend = vary(c.dailyBudget, 0.15);
      const clicks = Math.round(daySpend / vary(c.avgCPC, 0.12));
      const impressions = Math.round(clicks / vary(0.012, 0.25));
      const conversions = Math.round(clicks * vary(c.avgCVR, 0.2));
      const revenue = conversions * vary(c.avgAOV, 0.15);

      const isVideo = c.adSets.some((as) =>
        as.ads.some((a) => a.name.includes("VID"))
      );

      metrics.push({
        date,
        platform: c.platform as Platform,
        campaign: c.name,
        spend: +daySpend.toFixed(2),
        impressions,
        clicks,
        conversions,
        revenue: +revenue.toFixed(2),
        ctr: +(clicks / impressions * 100).toFixed(2),
        cpc: +(daySpend / clicks).toFixed(2),
        cpm: +(daySpend / impressions * 1000).toFixed(2),
        cpa: conversions > 0 ? +(daySpend / conversions).toFixed(2) : 0,
        roas: daySpend > 0 ? +(revenue / daySpend).toFixed(2) : 0,
        ...(isVideo
          ? {
              videoPlays3s: Math.round(impressions * vary(0.35, 0.15)),
              thruPlays: Math.round(impressions * vary(0.18, 0.2)),
              videoCompletions: Math.round(impressions * vary(0.08, 0.25)),
            }
          : {}),
        frequency: +(1 + rand() * 2.5).toFixed(2),
      });
    }
  }
  return metrics;
}

const dailyMetricsCache: Record<string, DailyMetric[]> = {};

function getDailyMetricsForClient(client: Client, days: number): DailyMetric[] {
  const key = `${client.slug}_${days}`;
  if (!dailyMetricsCache[key]) {
    const seeds = getCampaignSeeds(client);
    dailyMetricsCache[key] = generateDailyMetrics(seeds, days);
  }
  return dailyMetricsCache[key];
}

export function getClientDailyMetrics(
  slug: string,
  days = 30,
  clientObj?: Client,
): DailyMetric[] {
  const client = clientObj ?? clients.find((c) => c.slug === slug);
  if (!client) return [];
  const all = getDailyMetricsForClient(client, Math.max(days, 30));
  if (days >= 30) return all;
  const cutoff = dateStr(days);
  return all.filter((m) => m.date >= cutoff);
}

// ---------------------------------------------------------------------------
// KPI summaries
// ---------------------------------------------------------------------------

function summarise(metrics: DailyMetric[], days: number): KPISummary {
  const cutoff = dateStr(days);
  const prevCutoff = dateStr(days * 2);
  const current = metrics.filter((m) => m.date >= cutoff);
  const previous = metrics.filter(
    (m) => m.date >= prevCutoff && m.date < cutoff
  );

  const sum = (arr: DailyMetric[], key: keyof DailyMetric) =>
    arr.reduce((a, b) => a + (Number(b[key]) || 0), 0);

  const curSpend = sum(current, "spend");
  const prevSpend = sum(previous, "spend") || 1;
  const curRevenue = sum(current, "revenue");
  const prevRevenue = sum(previous, "revenue") || 1;
  const curConversions = sum(current, "conversions");
  const prevConversions = sum(previous, "conversions") || 1;
  const curImpressions = sum(current, "impressions");
  const prevImpressions = sum(previous, "impressions") || 1;
  const curRoas = curSpend > 0 ? curRevenue / curSpend : 0;
  const prevRoas = prevSpend > 0 ? prevRevenue / prevSpend : 0;
  const curCpa = curConversions > 0 ? curSpend / curConversions : 0;
  const prevCpa = prevConversions > 0 ? prevSpend / prevConversions : 0;
  const curMer = curSpend > 0 ? curRevenue / curSpend : 0;
  const prevMer = prevSpend > 0 ? prevRevenue / prevSpend : 0;

  const delta = (cur: number, prev: number) =>
    prev !== 0 ? +((cur - prev) / prev * 100).toFixed(1) : 0;

  const result: KPISummary = {
    spend: +curSpend.toFixed(2),
    spendDelta: delta(curSpend, prevSpend),
    roas: +curRoas.toFixed(2),
    roasDelta: delta(curRoas, prevRoas),
    mer: +curMer.toFixed(2),
    merDelta: delta(curMer, prevMer),
    cpa: +curCpa.toFixed(2),
    cpaDelta: delta(curCpa, prevCpa),
    impressions: Math.round(curImpressions),
    impressionsDelta: delta(curImpressions, prevImpressions),
    conversions: Math.round(curConversions),
    conversionsDelta: delta(curConversions, prevConversions),
    revenue: +curRevenue.toFixed(2),
    revenueDelta: delta(curRevenue, prevRevenue),
  };

  // Add CPL for lead gen / hybrid
  if (curConversions > 0) {
    result.cpl = +(curSpend / curConversions).toFixed(2);
    result.cplDelta = delta(
      curSpend / curConversions,
      prevSpend / (prevConversions || 1)
    );
  }

  return result;
}

export function getClientKPIs(slug: string, clientObj?: Client): KPISummary {
  const client = clientObj ?? clients.find((c) => c.slug === slug);
  if (!client) return summarise([], 30);
  const metrics = getDailyMetricsForClient(client, 60);
  return summarise(metrics, 30);
}

// ---------------------------------------------------------------------------
// Campaign hierarchy
// ---------------------------------------------------------------------------

function buildCampaignRows(seeds: CampaignSeed[]): CampaignRow[] {
  return seeds.map((c) => {
    const campaignSpend = vary(c.dailyBudget * 30, 0.08);
    const campaignClicks = Math.round(campaignSpend / vary(c.avgCPC, 0.1));
    const campaignImpressions = Math.round(campaignClicks / vary(0.013, 0.2));
    const campaignConversions = Math.round(
      campaignClicks * vary(c.avgCVR, 0.15)
    );
    const campaignRevenue = campaignConversions * vary(c.avgAOV, 0.12);

    const adSetRows: CampaignRow[] = c.adSets.map((as) => {
      const asFraction = 1 / c.adSets.length;
      const asSpend = vary(campaignSpend * asFraction, 0.12);
      const asClicks = Math.round(asSpend / vary(c.avgCPC, 0.12));
      const asImpressions = Math.round(asClicks / vary(0.013, 0.2));
      const asConversions = Math.round(asClicks * vary(c.avgCVR, 0.18));
      const asRevenue = asConversions * vary(c.avgAOV, 0.12);

      const adRows: CampaignRow[] = as.ads.map((ad) => {
        const adFraction = 1 / as.ads.length;
        const adSpend = vary(asSpend * adFraction, 0.15);
        const adClicks = Math.round(adSpend / vary(c.avgCPC, 0.15));
        const adImpressions = Math.round(adClicks / vary(0.013, 0.25));
        const adConversions = Math.round(adClicks * vary(c.avgCVR, 0.22));
        const adRevenue = adConversions * vary(c.avgAOV, 0.15);
        return {
          id: ad.id,
          name: ad.name,
          platform: c.platform as Platform,
          level: "ad" as const,
          parentId: as.id,
          spend: +adSpend.toFixed(2),
          impressions: adImpressions,
          clicks: adClicks,
          ctr: +(adClicks / adImpressions * 100).toFixed(2),
          cpc: +(adSpend / adClicks).toFixed(2),
          cpm: +(adSpend / adImpressions * 1000).toFixed(2),
          conversions: adConversions,
          cpa: adConversions > 0 ? +(adSpend / adConversions).toFixed(2) : 0,
          roas: adSpend > 0 ? +(adRevenue / adSpend).toFixed(2) : 0,
          cpl:
            adConversions > 0
              ? +(adSpend / adConversions).toFixed(2)
              : undefined,
          thumbnailUrl: `/thumbs/${ad.id}.jpg`,
        };
      });

      return {
        id: as.id,
        name: as.name,
        platform: c.platform as Platform,
        level: "adset" as const,
        parentId: c.id,
        spend: +asSpend.toFixed(2),
        impressions: asImpressions,
        clicks: asClicks,
        ctr: +(asClicks / asImpressions * 100).toFixed(2),
        cpc: +(asSpend / asClicks).toFixed(2),
        cpm: +(asSpend / asImpressions * 1000).toFixed(2),
        conversions: asConversions,
        cpa: asConversions > 0 ? +(asSpend / asConversions).toFixed(2) : 0,
        roas: asSpend > 0 ? +(asRevenue / asSpend).toFixed(2) : 0,
        cpl:
          asConversions > 0
            ? +(asSpend / asConversions).toFixed(2)
            : undefined,
        children: adRows,
      };
    });

    return {
      id: c.id,
      name: c.name,
      platform: c.platform as Platform,
      level: "campaign" as const,
      spend: +campaignSpend.toFixed(2),
      impressions: campaignImpressions,
      clicks: campaignClicks,
      ctr: +(campaignClicks / campaignImpressions * 100).toFixed(2),
      cpc: +(campaignSpend / campaignClicks).toFixed(2),
      cpm: +(campaignSpend / campaignImpressions * 1000).toFixed(2),
      conversions: campaignConversions,
      cpa:
        campaignConversions > 0
          ? +(campaignSpend / campaignConversions).toFixed(2)
          : 0,
      roas:
        campaignSpend > 0
          ? +(campaignRevenue / campaignSpend).toFixed(2)
          : 0,
      cpl:
        campaignConversions > 0
          ? +(campaignSpend / campaignConversions).toFixed(2)
          : undefined,
      children: adSetRows,
    };
  });
}

const campaignRowCache: Record<string, CampaignRow[]> = {};

export function getClientCampaigns(
  slug: string,
  platform?: Platform,
  clientObj?: Client,
): CampaignRow[] {
  const client = clientObj ?? clients.find((c) => c.slug === slug);
  if (!client) return [];
  if (!campaignRowCache[slug]) {
    campaignRowCache[slug] = buildCampaignRows(getCampaignSeeds(client));
  }
  const all = campaignRowCache[slug];
  if (!platform || platform === "all") return all;
  return all.filter((c) => c.platform === platform);
}

// ---------------------------------------------------------------------------
// Creatives
// ---------------------------------------------------------------------------

const META_FORMATS: Creative["format"][] = ["VID", "STA", "CAR"];
const META_TYPES: Creative["type"][] = ["UGC", "BRAND", "PRODUCT", "MOTION"];
const ANGLES = [
  "TESTIMONIAL",
  "LIFESTYLE",
  "BESTSELLER",
  "STORY",
  "UNBOXING",
  "SALE",
  "NEWDROP",
  "DPA",
  "CASESTUDY",
  "EXPLAINER",
  "BEFOREAFTER",
  "STAT",
  "CTA",
  "DEMO",
  "FEATURE",
  "COMPARE",
  "REVIEW",
  "OFFER",
  "WHITEPAPER",
];

/* ── Google Ads mock data pools ── */

const GOOGLE_HEADLINES = [
  "Shop Now — Free Delivery", "Official Store — Up to 50% Off", "New Arrivals This Week",
  "Premium Quality Guaranteed", "Limited Time Offer", "Trusted by 10,000+ Customers",
  "Award-Winning Products", "Get Started Today", "Book Your Free Consultation",
  "Expert Solutions for You", "Save Big This Season", "Exclusive Online Deals",
  "Fast & Free Shipping", "Top Rated on Trustpilot", "Try Risk-Free for 30 Days",
  "Best Price Guarantee", "Transform Your Business", "See Real Results",
  "Join 50K+ Happy Clients", "Professional Grade Quality", "As Seen on TV",
  "Eco-Friendly & Sustainable", "Subscribe & Save 20%", "Handcrafted with Care",
  "5-Star Customer Reviews", "Next Day Delivery Available", "Unbeatable Value",
  "Industry-Leading Innovation", "Schedule a Demo Today", "Made in the UK",
];

const GOOGLE_DESCRIPTIONS = [
  "Discover our range of premium products designed to deliver exceptional results. Shop now with free returns.",
  "Join thousands of satisfied customers. Expert support available 24/7 to help you get the most out of your purchase.",
  "Our award-winning formula has been trusted since 2010. See the difference quality makes in your routine.",
  "Get personalised recommendations from our team of experts. Book your free consultation today.",
  "Limited stock available — order now to guarantee delivery before the weekend. Free shipping on orders over £50.",
  "Transform the way you work with our innovative solutions. Rated 4.8 stars by over 5,000 verified buyers.",
  "Save up to 40% in our biggest sale of the year. Premium quality at prices you won't find anywhere else.",
  "Sustainably sourced, ethically made. Feel good about every purchase knowing it makes a difference.",
  "Professional results from the comfort of home. Everything you need in one easy-to-use kit.",
  "Experience the difference — try risk-free with our 60-day money-back guarantee. No questions asked.",
];

const GOOGLE_KEYWORDS = [
  { text: "buy online", matchType: "broad" },
  { text: "best deals", matchType: "broad" },
  { text: "premium products", matchType: "phrase" },
  { text: "free delivery uk", matchType: "phrase" },
  { text: "affordable quality", matchType: "broad" },
  { text: "top rated", matchType: "phrase" },
  { text: "official store", matchType: "exact" },
  { text: "near me", matchType: "broad" },
  { text: "reviews", matchType: "broad" },
  { text: "discount code", matchType: "phrase" },
  { text: "best price", matchType: "phrase" },
  { text: "compare prices", matchType: "broad" },
  { text: "how to use", matchType: "broad" },
  { text: "professional grade", matchType: "exact" },
  { text: "eco friendly", matchType: "phrase" },
  { text: "sale today", matchType: "broad" },
  { text: "gift ideas", matchType: "broad" },
  { text: "new collection", matchType: "phrase" },
  { text: "subscription box", matchType: "exact" },
  { text: "fast shipping", matchType: "phrase" },
];

const GOOGLE_AD_GROUPS = [
  "Brand — Core", "Brand — Competitors", "Non-Brand — Generic",
  "Non-Brand — Product", "Non-Brand — Informational", "Shopping — Top Sellers",
  "Shopping — New Arrivals", "DSA — All Pages", "RLSA — Past Visitors",
  "PMAX — Signals", "Discovery — Audiences",
];

function generateCreatives(
  clientSlug: string,
  seeds: CampaignSeed[],
  count: number
): Creative[] {
  const prefix = clientSlug.toUpperCase();
  const creatives: Creative[] = [];

  const metaSeeds = seeds.filter((s) => s.platform === "meta");
  const googleSeeds = seeds.filter((s) => s.platform === "google");

  // Generate Meta creatives
  const metaCount = Math.max(3, Math.round(count * (metaSeeds.length / seeds.length)));
  for (let i = 0; i < metaCount && metaSeeds.length > 0; i++) {
    const format = pick(META_FORMATS);
    const type = pick(META_TYPES);
    const angle = pick(ANGLES);
    const week = `W${randInt(10, 14)}`;
    const camp = pick(metaSeeds);
    const name = `${prefix}_${format}_${type}_${angle}_${week}`;

    const spend = vary(camp.dailyBudget * 30 * 0.15, 0.35);
    const clicks = Math.round(spend / vary(camp.avgCPC, 0.2));
    const impressions = Math.round(clicks / vary(0.014, 0.25));
    const conversions = Math.round(clicks * vary(camp.avgCVR, 0.3));
    const revenue = conversions * vary(camp.avgAOV, 0.2);

    const hookRate = +(20 + rand() * 25).toFixed(1);
    const holdRate = +(30 + rand() * 35).toFixed(1);
    const frequency = +(1.2 + rand() * 3).toFixed(2);
    const fatigueScore = +(
      frequency > 3.0 ? 60 + rand() * 40
      : frequency > 2.2 ? 30 + rand() * 30
      : rand() * 30
    ).toFixed(0);
    const compositeScore = +(
      (hookRate / 45) * 25 + (holdRate / 65) * 25 +
      (conversions > 0 ? (revenue / spend) / 6 * 25 : 0) +
      ((100 - Number(fatigueScore)) / 100) * 25
    ).toFixed(1);

    creatives.push({
      id: uuid(),
      adId: `${clientSlug}_ad_cr_${i}`,
      name,
      campaign: camp.name,
      platform: "meta",
      format,
      type,
      angle,
      week,
      thumbnailUrl: `/thumbs/${clientSlug}_cr_${i}.jpg`,
      spend: +spend.toFixed(2),
      impressions,
      clicks,
      conversions,
      revenue: +revenue.toFixed(2),
      ctr: +(clicks / impressions * 100).toFixed(2),
      cvr: clicks > 0 ? +(conversions / clicks * 100).toFixed(2) : 0,
      roas: spend > 0 ? +(revenue / spend).toFixed(2) : 0,
      hookRate,
      holdRate,
      frequency: +frequency,
      compositeScore: +compositeScore,
      confidenceWeight: +(0.5 + rand() * 0.5).toFixed(2),
      fatigueScore: +fatigueScore,
      isFatigued: +fatigueScore > 65,
    });
  }

  // Generate Google Ads creatives
  const googleCount = Math.max(4, count - metaCount);
  for (let i = 0; i < googleCount && googleSeeds.length > 0; i++) {
    const camp = pick(googleSeeds);
    const isSearch = camp.name.toLowerCase().includes("search") || camp.name.toLowerCase().includes("brand");
    const isShopping = camp.name.toLowerCase().includes("shopping");
    const isPmax = camp.name.toLowerCase().includes("pmax");

    // Pick 3-5 random headlines and 2-3 descriptions (RSA format)
    const numHeadlines = randInt(3, 5);
    const numDescs = randInt(2, 3);
    const adHeadlines: string[] = [];
    const adDescs: string[] = [];
    for (let h = 0; h < numHeadlines; h++) adHeadlines.push(pick(GOOGLE_HEADLINES));
    for (let d = 0; d < numDescs; d++) adDescs.push(pick(GOOGLE_DESCRIPTIONS));

    const keyword = pick(GOOGLE_KEYWORDS);
    const adGroup = pick(GOOGLE_AD_GROUPS);

    const spend = vary(camp.dailyBudget * 30 * 0.12, 0.4);
    const clicks = Math.round(spend / vary(camp.avgCPC, 0.2));
    const impressions = Math.round(clicks / vary(isSearch ? 0.045 : 0.012, 0.3));
    const conversions = Math.round(clicks * vary(camp.avgCVR, 0.3));
    const revenue = conversions * vary(camp.avgAOV, 0.25);

    const frequency = +(1.0 + rand() * 1.5).toFixed(2);
    const ctr = impressions > 0 ? +(clicks / impressions * 100).toFixed(2) : 0;
    const roas = spend > 0 ? +(revenue / spend).toFixed(2) : 0;
    const compositeScore = +(
      (Math.min(+ctr / 5, 1)) * 40 +
      (Math.min(roas / 5, 1)) * 40 +
      20 - (frequency > 2 ? Math.min((frequency - 2) * 5, 15) : 0)
    ).toFixed(1);

    const adName = isSearch
      ? `RSA — ${adHeadlines[0].slice(0, 30)}`
      : isShopping
        ? `Shopping — ${prefix} Products ${randInt(1, 20)}`
        : `PMAX — ${adGroup}`;

    creatives.push({
      id: uuid(),
      adId: `${clientSlug}_gad_${i}`,
      name: adName,
      campaign: camp.name,
      platform: "google",
      format: "SEARCH" as Creative["format"],
      type: "SEARCH" as Creative["type"],
      angle: isSearch ? "SEARCH" : isShopping ? "SHOPPING" : "PMAX",
      week: `W${randInt(10, 14)}`,
      thumbnailUrl: "",
      spend: +spend.toFixed(2),
      impressions,
      clicks,
      conversions,
      revenue: +revenue.toFixed(2),
      ctr: +ctr,
      cvr: clicks > 0 ? +(conversions / clicks * 100).toFixed(2) : 0,
      roas: +roas,
      hookRate: 0,
      holdRate: 0,
      frequency: +frequency,
      compositeScore: +compositeScore,
      confidenceWeight: +(0.5 + rand() * 0.5).toFixed(2),
      fatigueScore: 0,
      isFatigued: false,
      // Google-specific fields
      adTitle: adHeadlines.join(" | "),
      adBody: adDescs.join(" | "),
      adSet: adGroup,
      keywordText: (isSearch || isPmax) ? keyword.text : "",
      keywordMatchType: (isSearch || isPmax) ? keyword.matchType : "",
      websiteDestUrl: `https://${clientSlug}.com/${isSearch ? "products" : isShopping ? "shop" : "landing"}`,
    });
  }

  return creatives;
}

const creativeCache: Record<string, Creative[]> = {};

export function getClientCreatives(slug: string, clientObj?: Client): Creative[] {
  const client = clientObj ?? clients.find((c) => c.slug === slug);
  if (!client) return [];
  if (!creativeCache[slug]) {
    const seeds = getCampaignSeeds(client);
    const count = Math.max(6, Math.min(12, Math.round(client.monthlyBudget / 2000)));
    creativeCache[slug] = generateCreatives(slug, seeds, count);
  }
  return creativeCache[slug];
}

// ---------------------------------------------------------------------------
// Lead funnel
// ---------------------------------------------------------------------------

const leadFunnelStore: Record<string, LeadFunnelStage[]> = {
  dent: [
    { name: "Ad Click", count: 3420, conversionRate: 100 },
    { name: "Landing Page Visit", count: 3120, conversionRate: 91.2 },
    { name: "Form Submit (Lead)", count: 312, conversionRate: 10.0 },
    { name: "MQL", count: 187, conversionRate: 59.9 },
    { name: "SQL", count: 84, conversionRate: 44.9 },
    { name: "Proposal Sent", count: 52, conversionRate: 61.9 },
    { name: "Closed Won", count: 22, conversionRate: 42.3 },
  ],
  mosaic: [
    { name: "Ad Click", count: 5840, conversionRate: 100 },
    { name: "Landing Page Visit", count: 5290, conversionRate: 90.6 },
    { name: "Trial Signup / Form Submit", count: 528, conversionRate: 9.98 },
    { name: "MQL", count: 285, conversionRate: 54.0 },
    { name: "SQL", count: 114, conversionRate: 40.0 },
    { name: "Demo Booked", count: 68, conversionRate: 59.6 },
    { name: "Closed Won", count: 31, conversionRate: 45.6 },
  ],
};

export function getLeadFunnel(slug: string): LeadFunnelStage[] {
  return leadFunnelStore[slug] ?? [];
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

const agencyAlerts: Alert[] = [
  {
    id: "alert_001",
    type: "pacing",
    clientId: "cl_irg_001",
    clientName: "IRG",
    message:
      "Meta Prospecting TOF campaign is pacing 18% over daily budget for the last 3 days.",
    severity: "warning",
    timestamp: isoTimestamp(0),
  },
  {
    id: "alert_002",
    type: "fatigue",
    clientId: "cl_irg_001",
    clientName: "IRG",
    message:
      "3 creatives have fatigue scores above 65. Consider refreshing IRG_VID_UGC_TESTIMONIAL_W14.",
    severity: "critical",
    timestamp: isoTimestamp(1),
  },
  {
    id: "alert_003",
    type: "cpa_spike",
    clientId: "cl_dent_002",
    clientName: "Dent",
    message:
      "Google Non-Brand CPA spiked to \u00a338.50 (target: \u00a325). Check search term report.",
    severity: "critical",
    timestamp: isoTimestamp(0),
  },
  {
    id: "alert_004",
    type: "renewal",
    clientId: "cl_mosaic_003",
    clientName: "Mosaic",
    message:
      "Contract renewal in 58 days (2026-06-01). Schedule QBR and prepare renewal deck.",
    severity: "info",
    timestamp: isoTimestamp(2),
  },
  {
    id: "alert_005",
    type: "pacing",
    clientId: "cl_mosaic_003",
    clientName: "Mosaic",
    message:
      "Overall spend is at 78% of monthly budget with 10 days remaining. May under-deliver.",
    severity: "warning",
    timestamp: isoTimestamp(1),
  },
  {
    id: "alert_006",
    type: "fatigue",
    clientId: "cl_mosaic_003",
    clientName: "Mosaic",
    message:
      "MOSAIC_VID_UGC_DEMO_W14 frequency hit 3.8. Recommend rotating creative.",
    severity: "warning",
    timestamp: isoTimestamp(0),
  },
  {
    id: "alert_007",
    type: "cpa_spike",
    clientId: "cl_irg_001",
    clientName: "IRG",
    message:
      "Google Shopping CPA rose 22% week-over-week. Review product feed quality.",
    severity: "warning",
    timestamp: isoTimestamp(3),
  },
];

export function getAgencyAlerts(): Alert[] {
  return agencyAlerts;
}

// ---------------------------------------------------------------------------
// Revenue / client table
// ---------------------------------------------------------------------------

export function getRevenueClients(clientList?: Client[]): RevenueClient[] {
  const list = clientList ?? clients;
  return list.map((c) => ({
    clientId: c.id,
    clientName: c.name,
    tier: c.tier,
    retainerFee: c.retainerFee,
    currency: c.currency,
    currentSpend: getClientKPIs(c.slug, c).spend,
    renewalDate: c.contractRenewal,
    upsellFlag: false,
    downgradeFlag: false,
  }));
}

// ---------------------------------------------------------------------------
// Agency-wide KPIs
// ---------------------------------------------------------------------------

export function getAgencyKPIs(clientList?: Client[]): {
  totalSpend: number;
  blendedMER: number;
  activeClients: number;
  fatiguedCreatives: number;
  nextRenewal: string;
} {
  const list = clientList ?? clients;
  const allKPIs = list.map((c) => getClientKPIs(c.slug, c));
  const totalSpend = allKPIs.reduce((a, k) => a + k.spend, 0);
  const totalRevenue = allKPIs.reduce((a, k) => a + k.revenue, 0);

  const allCreatives = list.flatMap((c) => getClientCreatives(c.slug, c));
  const fatiguedCount = allCreatives.filter((cr) => cr.isFatigued).length;

  const renewalDates = list.map((c) => c.contractRenewal).filter(Boolean).sort();

  return {
    totalSpend: +totalSpend.toFixed(2),
    blendedMER: totalSpend > 0 ? +(totalRevenue / totalSpend).toFixed(2) : 0,
    activeClients: list.length,
    fatiguedCreatives: fatiguedCount,
    nextRenewal: renewalDates[0] ?? "",
  };
}
