"use client";

/**
 * Campaigns table — Tab 2 for The Ministry (and any other lead-gen client).
 *
 * Replaces the old redirect-to-attribution stub. Shows a sortable, filterable
 * campaign roll-up with both platform-claimed and HubSpot-confirmed numbers
 * side-by-side so the agency can read "what Meta says" against "what HubSpot
 * proves" in a single view.
 *
 * Data sources
 * ─────────────
 *   - Windsor.ai (campaigns endpoint) — spend, impressions, clicks,
 *     link_clicks (Meta), conversions, all_conversions (Google fallback).
 *   - HubSpot via Windsor (hubspot endpoint) — contacts joined per campaign
 *     by reconcileByCampaign + getContactsByCampaign.
 *
 * For non-lead-gen clients we keep redirecting to /attribution since the
 * "Meta Leads / Google Leads / HubSpot Confirmed" framing isn't applicable
 * to e-commerce or hybrid revenue clients yet.
 */

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import IrgCampaignsView from "@/components/irg/IrgCampaignsView";
import { Header } from "@/components/layout/header";
import { useClient } from "@/lib/client-context";
import { useWindsor } from "@/lib/use-windsor";
import { useDateRange } from "@/lib/date-range-context";
import type { HubSpotContact, WindsorRow } from "@/lib/windsor";
import { classifyPlatform } from "@/lib/windsor";
import { reconcileByCampaign } from "@/lib/leadReconciliation";
import { formatCurrency, formatNumber, cn } from "@/lib/utils";
import {
  LEAD_TYPES,
  getLeadTypeFromCampaign,
} from "@/lib/ministry-config";
import { MetaIcon, GoogleIcon } from "@/components/ui/platform-icons";

/* ── Types ── */

type PlatformFilter = "all" | "meta" | "google";

// Per-row shape rendered in the table — combines Windsor metrics with the
// HubSpot reconciliation. Lead-type id is derived from campaign name.
interface CampaignTableRow {
  key: string;
  platform: "meta" | "google" | "tiktok" | "other";
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  linkClicks: number;
  ctr: number;
  cpc: number;
  metaLeads: number; // platform-claimed for Meta rows, 0 for Google
  googleLeads: number; // platform-claimed for Google rows, 0 for Meta
  hubspotConfirmed: number;
  blendedCpl: number | null; // null when 0 leads; renders "—"
  leadTypeId: string;
  leadTypeLabel: string;
}

type SortKey =
  | "platform"
  | "campaignName"
  | "spend"
  | "impressions"
  | "clicks"
  | "ctr"
  | "cpc"
  | "metaLeads"
  | "googleLeads"
  | "hubspotConfirmed"
  | "blendedCpl"
  | "leadTypeLabel";

/* ── Page ── */

export default function CampaignsPage() {
  const router = useRouter();
  const { client: clientSlug } = useParams<{ client: string }>();
  const { days, preset, dateFrom, dateTo } = useDateRange();
  const customDateProps = preset === "Custom" ? { dateFrom, dateTo } : {};
  const ctx = useClient();
  const client = ctx?.clientConfig;

  const { data: windsorData, source: dataSource, loading: windsorLoading } = useWindsor<WindsorRow[]>({
    clientSlug,
    type: "campaigns",
    days,
    ...customDateProps,
  });

  const { data: hubspotData, loading: hubspotLoading } = useWindsor<HubSpotContact[]>({
    clientSlug,
    type: "hubspot",
    days,
    ...customDateProps,
  });

  /* ── Filters & sort state ── */

  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [leadTypeFilter, setLeadTypeFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  // Expansion sub-row removed: it bucketed contacts by HubSpot
  // conversion event name (FB Lead Ads / Day Pass / Enquiry Form /
  // Unknown) which read as a "product breakdown" given the labels —
  // confusing on a campaign whose product is already known. The Lead
  // Type column carries that signal; we don't need a second view.

  /* ── Aggregate rows ── */

  const rows = useMemo<CampaignTableRow[]>(() => {
    const windsor = windsorData ?? [];
    const contacts = hubspotData ?? [];

    // Window 1: campaign-level Windsor metrics, keyed exactly the same way
    // as reconcileByCampaign so we can join the two outputs.
    type Agg = {
      key: string;
      platform: "meta" | "google" | "tiktok" | "other";
      campaignName: string;
      spend: number;
      impressions: number;
      clicks: number;
      linkClicks: number;
      conversions: number;
    };
    const aggs = new Map<string, Agg>();
    for (const r of windsor) {
      const platform = classifyPlatform(r.source);
      const name = r.campaign || "(unnamed)";
      const id = (r.campaign_id as string | undefined) || null;
      const key = `${platform}::${id ?? name}`;
      const a = aggs.get(key) ?? {
        key,
        platform,
        campaignName: name,
        spend: 0,
        impressions: 0,
        clicks: 0,
        linkClicks: 0,
        conversions: 0,
      };
      a.spend += Number(r.spend) || 0;
      a.impressions += Number(r.impressions) || 0;
      a.clicks += Number(r.clicks) || 0;
      a.linkClicks += Number(r.link_clicks) || 0;
      // Use platform-claimed conversions exactly as reconcileByCampaign
      // does — so Meta/Google "Leads" columns line up with the headline
      // KPIs on the Overview tab.
      if (platform === "meta") {
        a.conversions += Number(r.conversions) || 0;
      } else if (platform === "google") {
        a.conversions += Number(r.conversions) || 0;
      }
      aggs.set(key, a);
    }

    // Window 2: HubSpot reconciliation — confirmed counts per campaign.
    const recon = reconcileByCampaign(contacts, windsor);
    const reconByKey = new Map<string, (typeof recon)[number]>();
    for (const r of recon) {
      const k = `${r.platform}::${r.campaignId ?? r.campaignName}`;
      reconByKey.set(k, r);
    }

    const result: CampaignTableRow[] = [];
    for (const a of aggs.values()) {
      const reconRow = reconByKey.get(a.key);
      const hubspotConfirmed = reconRow?.hubspotConfirmed ?? 0;
      const blendedCpl = hubspotConfirmed > 0 ? a.spend / hubspotConfirmed : null;

      // Derive product type from the campaign name. Most Ministry
      // campaigns map cleanly via the LEAD_TYPE_PATTERNS list.
      const lt = getLeadTypeFromCampaign(a.campaignName);

      // Use link_clicks for Meta CTR (Meta's own definition) so this
      // matches what the client sees in Ads Manager. Google rows fall
      // back to total clicks because Google doesn't expose link_clicks.
      const ctrClicks = a.platform === "meta" && a.linkClicks > 0 ? a.linkClicks : a.clicks;
      const ctr = a.impressions > 0 ? (ctrClicks / a.impressions) * 100 : 0;
      const cpc = ctrClicks > 0 ? a.spend / ctrClicks : 0;

      result.push({
        key: a.key,
        platform: a.platform,
        campaignName: a.campaignName,
        spend: a.spend,
        impressions: a.impressions,
        clicks: a.clicks,
        linkClicks: a.linkClicks,
        ctr,
        cpc,
        metaLeads: a.platform === "meta" ? a.conversions : 0,
        googleLeads: a.platform === "google" ? a.conversions : 0,
        hubspotConfirmed,
        blendedCpl,
        leadTypeId: lt.id,
        leadTypeLabel: lt.label,
      });
    }
    return result;
  }, [windsorData, hubspotData]);

  /* ── Apply filters + sort ── */

  const visibleRows = useMemo(() => {
    let out = rows;
    if (platformFilter !== "all") {
      out = out.filter((r) => r.platform === platformFilter);
    }
    if (leadTypeFilter !== "all") {
      out = out.filter((r) => r.leadTypeId === leadTypeFilter);
    }
    const dir = sortDir === "asc" ? 1 : -1;
    return [...out].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      // null (blendedCpl) sorts to the end regardless of direction
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [rows, platformFilter, leadTypeFilter, sortKey, sortDir]);

  /* ── IRG gets its own brand-aware view ── */
  if (clientSlug === "irg") {
    return <IrgCampaignsView />;
  }

  /* ── Other ecom clients fall back to attribution ── */
  if (client && client.type !== "lead_gen" && client.type !== "hybrid") {
    router.replace(`/${clientSlug}/attribution`);
    return null;
  }
  if (!client) return null;

  const currency = client.currency ?? "GBP";
  const loading = windsorLoading || hubspotLoading;

  /* ── Render ── */

  return (
    <>
      <Header title="Campaigns" dataBadge={{ loading, isLive: dataSource === "windsor" }} />

      <div className="flex-1 p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-5 overflow-y-auto">

        {/* Filters */}
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-wrap items-center gap-3">
          <PlatformFilterButtons value={platformFilter} onChange={setPlatformFilter} />
          <span className="h-5 w-px bg-white/[0.08] hidden sm:block" />
          <LeadTypeFilter value={leadTypeFilter} onChange={setLeadTypeFilter} />
          <span className="ml-auto text-[11px] text-[#64748B]">
            {visibleRows.length} {visibleRows.length === 1 ? "campaign" : "campaigns"}
          </span>
        </div>

        {/* Table */}
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-white/[0.02] text-[10px] uppercase tracking-wider text-[#94A3B8]">
                <tr>
                  <SortHeader label="Platform" k="platform" sortKey={sortKey} sortDir={sortDir} setSort={(k) => toggle(k, sortKey, sortDir, setSortKey, setSortDir)} className="text-left" />
                  <SortHeader label="Campaign" k="campaignName" sortKey={sortKey} sortDir={sortDir} setSort={(k) => toggle(k, sortKey, sortDir, setSortKey, setSortDir)} className="text-left" />
                  <SortHeader label="Spend" k="spend" sortKey={sortKey} sortDir={sortDir} setSort={(k) => toggle(k, sortKey, sortDir, setSortKey, setSortDir)} className="text-right" />
                  <SortHeader label="Impr." k="impressions" sortKey={sortKey} sortDir={sortDir} setSort={(k) => toggle(k, sortKey, sortDir, setSortKey, setSortDir)} className="text-right" />
                  <SortHeader label="Clicks" k="clicks" sortKey={sortKey} sortDir={sortDir} setSort={(k) => toggle(k, sortKey, sortDir, setSortKey, setSortDir)} className="text-right" />
                  <SortHeader label="CTR" k="ctr" sortKey={sortKey} sortDir={sortDir} setSort={(k) => toggle(k, sortKey, sortDir, setSortKey, setSortDir)} className="text-right" />
                  <SortHeader label="CPC" k="cpc" sortKey={sortKey} sortDir={sortDir} setSort={(k) => toggle(k, sortKey, sortDir, setSortKey, setSortDir)} className="text-right" />
                  <SortHeader label="Meta Leads" k="metaLeads" sortKey={sortKey} sortDir={sortDir} setSort={(k) => toggle(k, sortKey, sortDir, setSortKey, setSortDir)} className="text-right" />
                  <SortHeader label="Google Leads" k="googleLeads" sortKey={sortKey} sortDir={sortDir} setSort={(k) => toggle(k, sortKey, sortDir, setSortKey, setSortDir)} className="text-right" />
                  <SortHeader label="HubSpot Confirmed" k="hubspotConfirmed" sortKey={sortKey} sortDir={sortDir} setSort={(k) => toggle(k, sortKey, sortDir, setSortKey, setSortDir)} className="text-right text-emerald-400" />
                  <SortHeader label="Blended CPL" k="blendedCpl" sortKey={sortKey} sortDir={sortDir} setSort={(k) => toggle(k, sortKey, sortDir, setSortKey, setSortDir)} className="text-right" />
                  <SortHeader label="Lead Type" k="leadTypeLabel" sortKey={sortKey} sortDir={sortDir} setSort={(k) => toggle(k, sortKey, sortDir, setSortKey, setSortDir)} className="text-left" />
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={12} className="p-6 text-center text-[#64748B]">
                      {loading ? "Loading campaigns…" : "No campaigns match the current filters."}
                    </td>
                  </tr>
                )}
                {visibleRows.map((r) => (
                  <tr key={r.key} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-2 py-2">
                      <PlatformBadge platform={r.platform} />
                    </td>
                    <td className="px-2 py-2 text-white max-w-[260px] truncate" title={r.campaignName}>
                      {r.campaignName}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(r.spend, currency)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatNumber(r.impressions)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatNumber(r.clicks)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{r.ctr.toFixed(2)}%</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(r.cpc, currency)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{r.metaLeads > 0 ? formatNumber(r.metaLeads) : "—"}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{r.googleLeads > 0 ? formatNumber(r.googleLeads) : "—"}</td>
                    <td className="px-2 py-2 text-right tabular-nums font-semibold text-emerald-400">
                      {r.hubspotConfirmed > 0 ? formatNumber(r.hubspotConfirmed) : "—"}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {r.blendedCpl !== null ? formatCurrency(r.blendedCpl, currency) : "—"}
                    </td>
                    <td className="px-2 py-2 text-[#94A3B8]">{r.leadTypeLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer note — explains where each column comes from. The
            CRM/Reconciliation tab has the deeper explanation; this is
            just enough context to read the table without leaving. */}
        <p className="text-[11px] text-[#64748B] leading-relaxed">
          <strong className="text-[#94A3B8]">HubSpot Confirmed</strong> counts contacts
          we matched to a live campaign via hsa_cam, fbclid/gclid, FB Lead
          Ads event, or paid UTM. <strong className="text-[#94A3B8]">Blended CPL</strong> = total
          spend ÷ HubSpot Confirmed (shown as — when there are no confirmed
          leads). Meta CTR/CPC use link clicks; Google uses total clicks.
        </p>
      </div>
    </>
  );
}

/* ── Sub-components ── */

function PlatformFilterButtons({
  value,
  onChange,
}: {
  value: PlatformFilter;
  onChange: (v: PlatformFilter) => void;
}) {
  const options: { id: PlatformFilter; label: string }[] = [
    { id: "all", label: "Both" },
    { id: "meta", label: "Meta" },
    { id: "google", label: "Google" },
  ];
  return (
    <div className="inline-flex items-center bg-white/[0.04] border border-white/[0.06] rounded-lg p-0.5 text-[11px] font-semibold">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={cn(
            "px-3 py-1.5 rounded-md transition-colors",
            value === opt.id
              ? "bg-white/[0.08] text-white"
              : "text-[#94A3B8] hover:text-white",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function LeadTypeFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-[11px] font-semibold text-white focus:outline-none focus:border-white/[0.16]"
    >
      <option value="all">All lead types</option>
      {LEAD_TYPES.filter((lt) => lt.id !== "general").map((lt) => (
        <option key={lt.id} value={lt.id}>
          {lt.label}
        </option>
      ))}
    </select>
  );
}

function SortHeader({
  label,
  k,
  sortKey,
  sortDir,
  setSort,
  className,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  setSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = sortKey === k;
  return (
    <th
      className={cn(
        "px-2 py-2.5 font-semibold cursor-pointer select-none whitespace-nowrap hover:text-white",
        active && "text-white",
        className,
      )}
      onClick={() => setSort(k)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && <span className="text-[8px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </span>
    </th>
  );
}

function toggle(
  k: SortKey,
  current: SortKey,
  dir: "asc" | "desc",
  setKey: (k: SortKey) => void,
  setDir: (d: "asc" | "desc") => void,
) {
  if (k === current) {
    setDir(dir === "asc" ? "desc" : "asc");
  } else {
    setKey(k);
    // Numeric columns get sane defaults so a fresh click on Spend shows
    // the biggest spenders first; alphabetical columns default to A→Z.
    setDir(["spend", "impressions", "clicks", "ctr", "cpc", "metaLeads", "googleLeads", "hubspotConfirmed", "blendedCpl"].includes(k) ? "desc" : "asc");
  }
}

function PlatformBadge({ platform }: { platform: "meta" | "google" | "tiktok" | "other" }) {
  if (platform === "meta") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-[10px] font-semibold">
        <MetaIcon size={11} /> Meta
      </span>
    );
  }
  if (platform === "google") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold">
        <GoogleIcon size={11} /> Google
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-500/10 text-zinc-400 text-[10px] font-semibold">
      Other
    </span>
  );
}
