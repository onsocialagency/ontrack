"use client";

/**
 * Ministry Reports Builder — Tab 6.
 *
 * The previous /reports page was generic (ROAS-flavoured, ecom-leaning).
 * Daisy's brief wants a Ministry-flavoured weekly / monthly performance
 * report with:
 *   - Per-lead-type rows comparing actual vs target (Spend, Leads, CPL)
 *     plus optional manual customer-count + CPA inputs
 *   - A narrative panel with AI-style auto-suggestions
 *   - An optional sales-sequencing card
 *   - Download as PDF (browser print to a stylesheet that hides controls)
 *   - Send to Slack (formatted block kit, copied to clipboard for manual
 *     paste — keeps us off the Slack bot setup until we wire a real
 *     channel webhook)
 *   - Local report history in localStorage
 *
 * Data sources: Windsor (spend + platform conversions per campaign) and
 * HubSpot via Windsor (verified leads). Per-lead-type rollups reuse the
 * same campaign-name pattern matcher (getLeadTypeFromCampaign) used
 * elsewhere so all surfaces agree.
 *
 * Targets (target spend / planned leads / est CPL) come from
 * ministry-config's LEAD_TYPES — budget midpoints, volume midpoints, and
 * target CPL midpoints respectively. When a target hasn't been set on a
 * lead type the column renders "—".
 */

import { useEffect, useMemo, useState } from "react";
import { Download, Send, Trash2, Sparkles, FileText } from "lucide-react";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import type { WindsorRow, HubSpotContact } from "@/lib/windsor";
import { classifyPlatform } from "@/lib/windsor";
import {
  reconcileByCampaign,
  getContactsByCampaign,
  categoriseLeadType,
} from "@/lib/leadReconciliation";
import { LEAD_TYPES, getLeadTypeFromCampaign, type LeadType } from "@/lib/ministry-config";
import { formatCurrency, formatNumber, cn } from "@/lib/utils";

/* ── Types ── */

type PlatformChoice = "meta" | "google" | "both";
// "Paid attributed" = only HubSpot contacts that joined to a paid
// Meta/Google campaign (the number we defend in WBR / MBR).
// "All HubSpot"     = every contact in the period grouped by event-name
// → product, including organic / direct. Useful for headline volume
// reports where Daisy wants the bigger picture.
type LeadSource = "paid" | "all";

interface MetricToggles {
  actualVsTargetSpend: boolean;
  leadsVsPlanned: boolean;
  cplVsEstimated: boolean;
  // CPA stays as an auto-derived metric (spend ÷ qualified leads).
  // No manual override — Daisy: "no manual entries on Reports".
  cpa: boolean;
  narrative: boolean;
  // Page-level metric strip
  spendByPlatform: boolean;     // Meta vs Google split as a strip card
  // Per-lead-type column metrics
  impressions: boolean;
  clicks: boolean;
  ctr: boolean;
  cpc: boolean;
  qualifiedLeads: boolean;      // qualified count + qualification rate
}

interface SavedReport {
  id: string;
  generatedAt: string; // ISO
  // reportType field kept for backward-compat with previously saved
  // localStorage entries; not surfaced in the UI any more (period
  // comes from the global date range now).
  reportType?: string;
  periodLabel: string;
  generatedBy: string;
  payload: ReportPayload;
}

interface ReportRow {
  leadType: LeadType;
  actualSpend: number;
  targetSpend: number; // midpoint of LEAD_TYPE.budget*
  leads: number; // verified or all-HubSpot, depending on LeadSource
  plannedLeads: number; // midpoint of LEAD_TYPE.volume*
  cpl: number; // actualSpend / leads
  estCpl: number; // midpoint of LEAD_TYPE.targetCpl*
  // CPA is auto-derived only — no manual override anywhere in Reports.
  // Spend ÷ qualified leads. Customers / billing-system data isn't
  // wired in (and Daisy: "no manual entries on Reports") so this is
  // the closest meaningful CPA we can compute.
  cpa: number;
  // Per-lead-type Windsor metrics (sums across that product's campaigns)
  impressions: number;
  clicks: number;
  ctr: number; // %
  cpc: number; // £
  qualified: number; // matched contacts marked qualified by hs_lead_status / lifecyclestage
  qualificationRate: number; // %
}

interface ReportPayload {
  periodLabel: string;
  platform: PlatformChoice;
  leadSource: LeadSource;
  metrics: MetricToggles;
  rows: ReportRow[];
  // Parallel previous-period rows aligned by leadType.id when the user
  // toggles "vs previous period". Same length and order as `rows`.
  // Null when comparison is off.
  prevRows: ReportRow[] | null;
  prevPeriodLabel: string | null;
  narrative: Record<string, string>; // keyed by lead type id
  // Page-level platform-split totals for the optional summary strip
  totals: { metaSpend: number; googleSpend: number; totalSpend: number };
  prevTotals: { metaSpend: number; googleSpend: number; totalSpend: number } | null;
}

// Sales sequencing card removed entirely — required manual entry which
// Daisy ruled out for Reports. Re-introduce when we wire a real
// sequencing data source (Apollo / Outreach / HubSpot Sequences).

/* ── Storage ── */

const HISTORY_KEY = "ministry-reports-history";
const MAX_HISTORY = 20;

function loadHistory(): SavedReport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(history: SavedReport[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  } catch {
    // localStorage might be full or disabled — silent failure is OK here,
    // history is convenience not source of truth.
  }
}

/* ── Helpers ── */

const PRODUCT_LEAD_TYPES = LEAD_TYPES.filter((lt) => lt.id !== "general");

function midpoint(min: number | null, max: number | null): number {
  if (min === null || max === null) return 0;
  return +(((min + max) / 2)).toFixed(2);
}

/** A contact looks "qualified" when HubSpot lead status has advanced past
 *  NEW/OPEN, OR when lifecyclestage has reached MQL or beyond. Same
 *  definition the Lead Generation tab uses — keep them in lock-step. */
function isQualifiedLead(c: { lifecyclestage?: string | null; leadStatus?: string | null }): boolean {
  const ls = (c.leadStatus ?? "").toUpperCase().trim();
  const stage = (c.lifecyclestage ?? "").toLowerCase().trim();
  if (ls && !["", "NEW", "OPEN", "UNATTEMPTED", "OPEN_DEAL"].includes(ls)) return true;
  if (["marketingqualifiedlead", "salesqualifiedlead", "opportunity", "customer", "evangelist"].includes(stage)) return true;
  return false;
}

/** Map a HubSpot conversion event name to one of the six product
 *  lead-type ids. Falls through to null when the event doesn't map
 *  cleanly — those contacts get bucketed into the leadType inferred
 *  from their joined campaign instead, or skipped if neither is known. */
function eventNameToProduct(eventName: string | null | undefined): string | null {
  const t = categoriseLeadType(eventName ?? null);
  if (t === "DayPass") return "day_pass";
  // FacebookLead / EnquiryForm don't carry product hints; null sends us
  // to the campaign-name fallback in the caller.
  return null;
}

/** Build the per-lead-type rows from raw Windsor + HubSpot data. */
function buildRows(
  windsor: WindsorRow[],
  contacts: HubSpotContact[],
  platform: PlatformChoice,
  leadSource: LeadSource,
  selectedLeadTypeIds: Set<string>,
): { rows: ReportRow[]; totals: { metaSpend: number; googleSpend: number; totalSpend: number } } {
  // Filter by platform first.
  const filtered = windsor.filter((r) => {
    const p = classifyPlatform(r.source);
    if (platform === "both") return p === "meta" || p === "google";
    return p === platform;
  });

  // Per-product Windsor aggregates (spend / impressions / clicks).
  type ProductAgg = { spend: number; impressions: number; clicks: number; linkClicks: number; metaImpressions: number };
  const byType = new Map<string, ProductAgg>();
  for (const lt of PRODUCT_LEAD_TYPES) byType.set(lt.id, { spend: 0, impressions: 0, clicks: 0, linkClicks: 0, metaImpressions: 0 });
  let metaSpend = 0;
  let googleSpend = 0;
  for (const r of filtered) {
    const lt = getLeadTypeFromCampaign(r.campaign);
    if (lt.id === "general") continue;
    const a = byType.get(lt.id)!;
    a.spend += Number(r.spend) || 0;
    a.impressions += Number(r.impressions) || 0;
    a.clicks += Number(r.clicks) || 0;
    a.linkClicks += Number(r.link_clicks) || 0;
    if (classifyPlatform(r.source) === "meta") {
      a.metaImpressions += Number(r.impressions) || 0;
      metaSpend += Number(r.spend) || 0;
    } else if (classifyPlatform(r.source) === "google") {
      googleSpend += Number(r.spend) || 0;
    }
  }

  // Lead counts per product. Two paths depending on leadSource toggle:
  //   - paid:  use reconcileByCampaign output (URL/event-id matched).
  //   - all:   bucket every HubSpot contact in the period via event-name
  //            (DayPass) with campaign-name fallback when matched, else
  //            "general" (which we skip — it'd be unmapped anyway).
  const leadsByType = new Map<string, number>();
  const qualifiedByType = new Map<string, number>();
  for (const lt of PRODUCT_LEAD_TYPES) {
    leadsByType.set(lt.id, 0);
    qualifiedByType.set(lt.id, 0);
  }

  if (leadSource === "paid") {
    const recon = reconcileByCampaign(contacts, filtered);
    for (const row of recon) {
      const lt = getLeadTypeFromCampaign(row.campaignName);
      if (lt.id === "general") continue;
      leadsByType.set(lt.id, (leadsByType.get(lt.id) ?? 0) + (row.hubspotConfirmed ?? 0));
    }
    // Qualified count requires the actual matched contact lists.
    const contactsByCampaign = getContactsByCampaign(contacts, filtered);
    for (const [key, list] of contactsByCampaign) {
      // key is "platform::campaignId-or-name" — recover campaign name
      // from the recon row that matches this key for the lead-type.
      const reconRow = recon.find((r) => `${r.platform}::${r.campaignId ?? r.campaignName}` === key);
      if (!reconRow) continue;
      const lt = getLeadTypeFromCampaign(reconRow.campaignName);
      if (lt.id === "general") continue;
      const qualified = list.filter(isQualifiedLead).length;
      qualifiedByType.set(lt.id, (qualifiedByType.get(lt.id) ?? 0) + qualified);
    }
  } else {
    // All HubSpot contacts: bucket each by event-name first, then by
    // campaign-name fallback when joined to a paid campaign, else skip.
    const contactsByCampaign = getContactsByCampaign(contacts, filtered);
    const matchedSet = new Set<HubSpotContact>();
    for (const list of contactsByCampaign.values()) {
      for (const c of list) matchedSet.add(c);
    }
    for (const c of contacts) {
      // Prefer event-name → product (DayPass is the only direct hint).
      const eventProduct = eventNameToProduct(c.recentConversionEventName ?? c.firstConversionEventName);
      let productId = eventProduct;
      if (!productId && matchedSet.has(c)) {
        // Fall back to the campaign this contact joined to, if any.
        for (const [key, list] of contactsByCampaign) {
          if (!list.includes(c)) continue;
          // key encodes "platform::campaignId-or-name" — pull the campaign
          // name from the windsor rows since recon isn't computed here.
          const platformMatch = key.split("::")[0];
          const idOrName = key.split("::").slice(1).join("::");
          const sample = filtered.find((r) =>
            classifyPlatform(r.source) === platformMatch &&
            (r.campaign_id === idOrName || r.campaign === idOrName),
          );
          if (sample) {
            const lt = getLeadTypeFromCampaign(sample.campaign);
            if (lt.id !== "general") productId = lt.id;
          }
          break;
        }
      }
      if (!productId) continue;
      leadsByType.set(productId, (leadsByType.get(productId) ?? 0) + 1);
      if (isQualifiedLead(c)) {
        qualifiedByType.set(productId, (qualifiedByType.get(productId) ?? 0) + 1);
      }
    }
  }

  const rows = PRODUCT_LEAD_TYPES
    .filter((lt) => selectedLeadTypeIds.has(lt.id))
    .map((lt) => {
      const a = byType.get(lt.id)!;
      const actualSpend = a.spend;
      const leads = leadsByType.get(lt.id) ?? 0;
      const qualified = qualifiedByType.get(lt.id) ?? 0;
      const cpl = leads > 0 ? actualSpend / leads : 0;
      const targetSpend = midpoint(lt.budgetMin, lt.budgetMax);
      const plannedLeads = midpoint(lt.volumeMin, lt.volumeMax);
      const estCpl = midpoint(lt.targetCplMin, lt.targetCplMax);
      // Use Meta link-clicks when meaningful (matches Ads Manager's CTR).
      // For mixed Meta+Google rows we can't tell — fall back to total clicks.
      const ctrClicks = a.linkClicks > 0 ? a.linkClicks : a.clicks;
      const ctr = a.impressions > 0 ? (ctrClicks / a.impressions) * 100 : 0;
      const cpc = ctrClicks > 0 ? actualSpend / ctrClicks : 0;
      const qualificationRate = leads > 0 ? (qualified / leads) * 100 : 0;
      // CPA = spend ÷ qualified leads. Auto-derived only — no manual
      // override (Daisy: "no manual entries on Reports").
      const cpa = qualified > 0 ? actualSpend / qualified : 0;
      return {
        leadType: lt,
        actualSpend,
        targetSpend,
        leads,
        plannedLeads,
        cpl,
        estCpl,
        cpa,
        impressions: a.impressions,
        clicks: a.clicks,
        ctr,
        cpc,
        qualified,
        qualificationRate,
      };
    });

  return {
    rows,
    totals: { metaSpend, googleSpend, totalSpend: metaSpend + googleSpend },
  };
}

/** AI-style narrative suggestion. Heuristic-driven, no LLM call.
 *  Compares row to its targets and produces a short bullet list. */
function suggestNarrative(row: ReportRow, currency: string): string {
  const lines: string[] = [];
  if (row.targetSpend > 0) {
    const pct = ((row.actualSpend - row.targetSpend) / row.targetSpend) * 100;
    if (Math.abs(pct) >= 10) {
      lines.push(
        `Spend was ${pct > 0 ? "above" : "below"} target by ${Math.abs(pct).toFixed(0)}% (${formatCurrency(row.actualSpend, currency)} vs ${formatCurrency(row.targetSpend, currency)}).`,
      );
    }
  }
  if (row.plannedLeads > 0) {
    const delivered = row.plannedLeads > 0 ? (row.leads / row.plannedLeads) * 100 : 0;
    if (delivered >= 100) {
      lines.push(`Lead volume hit ${delivered.toFixed(0)}% of plan (${row.leads} of ${row.plannedLeads}).`);
    } else if (delivered < 80) {
      lines.push(`Lead volume came in at ${delivered.toFixed(0)}% of plan — investigate creative fatigue or audience saturation.`);
    }
  }
  if (row.cpl > 0 && row.estCpl > 0) {
    const cplPct = ((row.cpl - row.estCpl) / row.estCpl) * 100;
    if (cplPct <= -10) {
      lines.push(`CPL beat target by ${Math.abs(cplPct).toFixed(0)}% (${formatCurrency(row.cpl, currency)} vs ${formatCurrency(row.estCpl, currency)}).`);
    } else if (cplPct >= 10) {
      lines.push(`CPL ran ${cplPct.toFixed(0)}% above target — recommend tightening targeting or refreshing creative.`);
    }
  }
  if (lines.length === 0) {
    lines.push(`Performance broadly on track for ${row.leadType.label.toLowerCase()} — no significant deviation from plan.`);
  }
  return lines.join("\n");
}

/** Format the report payload as Slack block-kit-flavoured markdown
 *  suitable for pasting into a channel. */
function toSlackText(payload: ReportPayload, currency: string): string {
  const lines: string[] = [];
  lines.push(`*Marketing — ${platformLabel(payload.platform)}*`);
  lines.push(`_${payload.periodLabel}_`);
  lines.push(`Leads: ${payload.leadSource === "paid" ? "Paid attributed" : "All HubSpot"}`);
  if (payload.metrics.spendByPlatform && payload.platform === "both") {
    lines.push(
      `Spend: *${formatCurrency(payload.totals.totalSpend, currency)}* — Meta ${formatCurrency(payload.totals.metaSpend, currency)} · Google ${formatCurrency(payload.totals.googleSpend, currency)}`,
    );
  }
  lines.push("");
  lines.push("*Performance*");
  lines.push("```");
  lines.push("Lead type        | Spend / Target  | Leads / Plan | CPL / Est");
  for (const r of payload.rows) {
    lines.push(
      [
        r.leadType.label.padEnd(16, " "),
        `${formatCurrency(r.actualSpend, currency)} / ${formatCurrency(r.targetSpend, currency)}`.padEnd(15, " "),
        `${r.leads} / ${r.plannedLeads}`.padEnd(12, " "),
        `${formatCurrency(r.cpl, currency)} / ${formatCurrency(r.estCpl, currency)}`,
      ].join(" | "),
    );
  }
  lines.push("```");
  if (payload.metrics.qualifiedLeads) {
    lines.push("");
    lines.push("*Qualified leads*");
    for (const r of payload.rows) {
      lines.push(
        `• ${r.leadType.label}: ${r.qualified} / ${r.leads} (${r.leads > 0 ? r.qualificationRate.toFixed(0) : 0}%)`,
      );
    }
  }
  if (payload.metrics.narrative) {
    lines.push("");
    lines.push("*Notes*");
    for (const r of payload.rows) {
      const note = payload.narrative[r.leadType.id];
      if (note?.trim()) {
        lines.push(`• *${r.leadType.label}*: ${note.trim().replace(/\n/g, " ")}`);
      }
    }
  }
  return lines.join("\n");
}

function platformLabel(p: PlatformChoice): string {
  if (p === "meta") return "Meta";
  if (p === "google") return "Google";
  return "Meta + Google";
}

/* ── Component ── */

export interface MinistryReportBuilderProps {
  windsorData: WindsorRow[] | null;
  hubspotData: HubSpotContact[] | null;
  // Optional previous-period datasets — when supplied + compare is on,
  // each row in the preview shows a vs-previous delta. The parent page
  // is responsible for fetching the matching length-and-position
  // window via useWindsor with shifted dateFrom/dateTo.
  prevWindsorData?: WindsorRow[] | null;
  prevHubspotData?: HubSpotContact[] | null;
  prevPeriodLabel?: string;
  currency: string;
  defaultPeriodLabel: string;
}

export function MinistryReportBuilder({
  windsorData,
  hubspotData,
  prevWindsorData,
  prevHubspotData,
  prevPeriodLabel,
  currency,
  defaultPeriodLabel,
}: MinistryReportBuilderProps) {
  /* ── Controls state ──
     "Report type" toggle removed per Daisy — monthly reviews are done
     manually so the type field added no real signal. Period now comes
     entirely from the global date-range picker (passed in as
     defaultPeriodLabel). */
  const [platform, setPlatform] = useState<PlatformChoice>("both");
  const [leadSource, setLeadSource] = useState<LeadSource>("paid");
  const [selectedLeadTypeIds, setSelectedLeadTypeIds] = useState<Set<string>>(
    () => new Set(PRODUCT_LEAD_TYPES.map((lt) => lt.id)),
  );
  const [metrics, setMetrics] = useState<MetricToggles>({
    actualVsTargetSpend: true,
    leadsVsPlanned: true,
    cplVsEstimated: true,
    cpa: false,
    narrative: true,
    spendByPlatform: true,
    impressions: false,
    clicks: false,
    ctr: false,
    cpc: false,
    qualifiedLeads: false,
  });

  /* ── vs previous-period comparison toggle.
        When on, every numeric in the preview gets a small delta
        indicator showing the period-on-period change (▲/▼ + %). The
        previous period is the same length as the current one,
        immediately preceding it (so a "Last 7 Days" view compares
        against the seven days before that). ── */
  const [compareEnabled, setCompareEnabled] = useState(false);

  /* ── Free-text narrative per lead type ── */
  const [narrative, setNarrative] = useState<Record<string, string>>({});

  /* ── Slack channel target — defaults to The Ministry's internal
        channel so the team don't have to remember the name each time.
        Free-text override still possible. */
  const [slackChannel, setSlackChannel] = useState("#ministry-slack");

  /* ── Generated report payload (rendered when present) ── */
  const [generated, setGenerated] = useState<ReportPayload | null>(null);

  /* ── History from localStorage ── */
  const [history, setHistory] = useState<SavedReport[]>([]);
  useEffect(() => { setHistory(loadHistory()); }, []);

  /* ── Derived rows for the live preview ── */
  const liveBuild = useMemo(
    () => buildRows(windsorData ?? [], hubspotData ?? [], platform, leadSource, selectedLeadTypeIds),
    [windsorData, hubspotData, platform, leadSource, selectedLeadTypeIds],
  );
  const liveRows = liveBuild.rows;
  const liveTotals = liveBuild.totals;
  const prevBuild = useMemo(
    () => prevWindsorData && prevHubspotData
      ? buildRows(prevWindsorData, prevHubspotData, platform, leadSource, selectedLeadTypeIds)
      : null,
    [prevWindsorData, prevHubspotData, platform, leadSource, selectedLeadTypeIds],
  );

  /* ── Generate report — locks in the current state into a payload that
        the preview / export buttons render. Auto-fills empty narrative
        slots with AI-style suggestions on first generation. ── */
  function handleGenerate() {
    const filledNarrative: Record<string, string> = {};
    for (const r of liveRows) {
      filledNarrative[r.leadType.id] =
        narrative[r.leadType.id]?.trim() || suggestNarrative(r, currency);
    }
    setNarrative(filledNarrative);
    const payload: ReportPayload = {
      periodLabel: defaultPeriodLabel,
      platform,
      leadSource,
      metrics,
      rows: liveRows,
      prevRows: compareEnabled && prevBuild ? prevBuild.rows : null,
      prevPeriodLabel: compareEnabled && prevBuild ? (prevPeriodLabel ?? "Previous period") : null,
      narrative: filledNarrative,
      totals: liveTotals,
      prevTotals: compareEnabled && prevBuild ? prevBuild.totals : null,
    };
    setGenerated(payload);
    // Push to history
    const entry: SavedReport = {
      id: Date.now().toString(36),
      generatedAt: new Date().toISOString(),
      periodLabel: defaultPeriodLabel,
      generatedBy: typeof window !== "undefined" ? window.localStorage.getItem("user-email") || "OnSocial team" : "OnSocial team",
      payload,
    };
    const next = [entry, ...history].slice(0, MAX_HISTORY);
    setHistory(next);
    saveHistory(next);
  }

  function handleDeleteHistory(id: string) {
    const next = history.filter((h) => h.id !== id);
    setHistory(next);
    saveHistory(next);
  }

  function handleDownloadPDF() {
    // Trigger browser print — the print stylesheet at the bottom of this
    // file hides the controls + history and shows the preview only.
    if (typeof window !== "undefined") window.print();
  }

  async function handleSlackSend() {
    if (!generated) return;
    const text = toSlackText(generated, currency);
    if (!slackChannel.trim()) {
      alert("Add a Slack channel name first (e.g. #the-ministry).");
      return;
    }
    // No live Slack bot wired — copy the formatted block-kit-flavoured
    // text to clipboard so the user can paste manually. Keeps the
    // feature usable today without a bot token.
    try {
      await navigator.clipboard.writeText(text);
      alert(`Report copied to clipboard. Paste into ${slackChannel.trim()}.`);
    } catch {
      alert("Couldn't copy to clipboard — your browser may have blocked it. Open DevTools console to see the formatted text.");
      console.log(text);
    }
  }

  /* ── Render ── */

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* ── Controls ── */}
      <section className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-5 space-y-4 ministry-report-controls">
        <header className="flex items-center gap-2">
          <FileText size={16} className="text-[#C8A96E]" />
          <h2 className="text-sm font-semibold text-white">Build a report</h2>
        </header>

        {/* Period + Platform + Lead source */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>Period</Label>
            {/* Real DateRangePicker — same component used in the page
                header, sharing the same global state. Changing it here
                updates every other Ministry surface that's bound to the
                same context (Overview, Campaigns, etc.). */}
            <div className="report-period-picker">
              <DateRangePicker />
            </div>
            <p className="text-[10px] text-[#64748B] mt-1">
              Synced with the global date picker — change it here or in the header.
            </p>
          </div>
          <div>
            <Label>Platform</Label>
            <PillGroup
              options={[
                { id: "both", label: "Both" },
                { id: "meta", label: "Meta" },
                { id: "google", label: "Google" },
              ]}
              value={platform}
              onChange={(v) => setPlatform(v as PlatformChoice)}
            />
          </div>
          <div>
            <Label>Lead source</Label>
            <PillGroup
              options={[
                { id: "paid", label: "Paid attributed" },
                { id: "all", label: "All HubSpot" },
              ]}
              value={leadSource}
              onChange={(v) => setLeadSource(v as LeadSource)}
            />
            <p className="text-[10px] text-[#64748B] mt-1">
              {leadSource === "paid"
                ? "Only contacts joined to a paid campaign (the number we defend)."
                : "Every HubSpot contact in the period, including organic + direct."}
            </p>
          </div>
        </div>

        {/* Lead types */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <Label>Lead types to include</Label>
            {/* All / None quick-select. Helpful when Daisy wants a
                single-product report — toggle All off then check just
                the one she's reporting on. */}
            <div className="flex gap-1.5">
              <button
                onClick={() => setSelectedLeadTypeIds(new Set(PRODUCT_LEAD_TYPES.map((lt) => lt.id)))}
                className="text-[10px] uppercase tracking-wider font-semibold text-[#C8A96E] hover:text-white transition-colors"
              >
                All
              </button>
              <span className="text-[10px] text-[#475569]">/</span>
              <button
                onClick={() => setSelectedLeadTypeIds(new Set())}
                className="text-[10px] uppercase tracking-wider font-semibold text-[#94A3B8] hover:text-white transition-colors"
              >
                None
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRODUCT_LEAD_TYPES.map((lt) => {
              const checked = selectedLeadTypeIds.has(lt.id);
              return (
                <button
                  key={lt.id}
                  onClick={() => {
                    setSelectedLeadTypeIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(lt.id)) next.delete(lt.id); else next.add(lt.id);
                      return next;
                    });
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors border",
                    checked
                      ? "bg-[#C8A96E]/15 border-[#C8A96E]/40 text-[#C8A96E]"
                      : "bg-white/[0.04] border-white/[0.06] text-[#94A3B8] hover:text-white",
                  )}
                >
                  {lt.label}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-[#64748B] mt-1.5">
            General Enquiry is excluded — it's a catch-all bucket for unmapped
            contacts, not a product. To see those, switch Lead source to
            &quot;All HubSpot&quot;.
          </p>
        </div>

        {/* Metrics — grouped into "performance vs plan" (the spec
            originals) and "extra metrics" (the new ones Daisy asked for).
            Visual separation keeps the long checkbox list readable. */}
        <div>
          <Label>Metrics to include</Label>
          <p className="text-[10px] uppercase tracking-wider text-[#94A3B8]/60 font-semibold mt-0.5 mb-1">Performance vs plan</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            <Checkbox label="Actual vs Target Spend" value={metrics.actualVsTargetSpend} onChange={(v) => setMetrics((m) => ({ ...m, actualVsTargetSpend: v }))} />
            <Checkbox label="Leads vs Planned" value={metrics.leadsVsPlanned} onChange={(v) => setMetrics((m) => ({ ...m, leadsVsPlanned: v }))} />
            <Checkbox label="CPL vs Estimated" value={metrics.cplVsEstimated} onChange={(v) => setMetrics((m) => ({ ...m, cplVsEstimated: v }))} />
            <Checkbox label="CPA (auto-derived)" value={metrics.cpa} onChange={(v) => setMetrics((m) => ({ ...m, cpa: v }))} />
            <Checkbox label="Narrative notes" value={metrics.narrative} onChange={(v) => setMetrics((m) => ({ ...m, narrative: v }))} />
          </div>
          <p className="text-[10px] uppercase tracking-wider text-[#94A3B8]/60 font-semibold mt-3 mb-1">Extra metrics</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            <Checkbox label="Spend split by platform" value={metrics.spendByPlatform} onChange={(v) => setMetrics((m) => ({ ...m, spendByPlatform: v }))} />
            <Checkbox label="Impressions" value={metrics.impressions} onChange={(v) => setMetrics((m) => ({ ...m, impressions: v }))} />
            <Checkbox label="Clicks" value={metrics.clicks} onChange={(v) => setMetrics((m) => ({ ...m, clicks: v }))} />
            <Checkbox label="CTR" value={metrics.ctr} onChange={(v) => setMetrics((m) => ({ ...m, ctr: v }))} />
            <Checkbox label="CPC" value={metrics.cpc} onChange={(v) => setMetrics((m) => ({ ...m, cpc: v }))} />
            <Checkbox label="Qualified leads + rate" value={metrics.qualifiedLeads} onChange={(v) => setMetrics((m) => ({ ...m, qualifiedLeads: v }))} />
          </div>
        </div>

        {/* Period-on-period comparison toggle. When on, the preview
            renders a small ▲/▼ delta beneath each numeric so Daisy can
            read week-on-week change at a glance. Disabled when the
            parent doesn't supply the previous-period data. */}
        <div className="border-t border-white/[0.04] pt-3">
          <Checkbox
            label={prevWindsorData
              ? "Show vs previous period (week-on-week / period-on-period)"
              : "Previous-period comparison unavailable for this date range"}
            value={compareEnabled}
            onChange={(v) => setCompareEnabled(v && !!prevWindsorData)}
          />
          {compareEnabled && prevPeriodLabel && (
            <p className="text-[10px] text-[#64748B] mt-1">
              Comparing against: {prevPeriodLabel}
            </p>
          )}
        </div>

      </section>

      {/* Generate Report — full-width row beneath the controls so it
          reads like a clear "now do it" step in the flow rather than a
          button hidden in the bottom-right of a panel. */}
      <section className="ministry-report-controls bg-emerald-500/5 border border-emerald-500/30 rounded-xl sm:rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Ready to generate?</p>
          <p className="text-[11px] text-[#94A3B8] mt-0.5">
            {selectedLeadTypeIds.size === 0
              ? "Pick at least one lead type to include."
              : `${selectedLeadTypeIds.size} of ${PRODUCT_LEAD_TYPES.length} lead types selected · ${platformLabel(platform)} · ${leadSource === "paid" ? "Paid attributed" : "All HubSpot"}`}
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={selectedLeadTypeIds.size === 0}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Sparkles size={14} />
          Generate Report
        </button>
      </section>

      {/* ── Preview ── */}
      {generated && (
        <section className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl overflow-hidden ministry-report-preview">
          <header className="px-5 py-4 border-b border-white/[0.06]">
            <p className="text-[10px] uppercase tracking-wider text-[#94A3B8]">Preview</p>
            <h3 className="text-lg font-bold text-white mt-0.5">
              Marketing — {platformLabel(generated.platform)}
            </h3>
            <p className="text-xs text-[#94A3B8]">{generated.periodLabel}</p>
          </header>

          <div className="p-5 space-y-5">
            {/* Spend split by platform — page-level summary strip, only
                shown when both platforms are in scope and the metric is
                ticked. Kept as a row of three numbers so it reads
                cleanly in the printed PDF. */}
            {metrics.spendByPlatform && generated.platform === "both" && (
              <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-3 grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-[#94A3B8]">Total spend</p>
                  <p className="text-lg font-bold text-white tabular-nums mt-0.5">{formatCurrency(generated.totals.totalSpend, currency)}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-blue-400">Meta</p>
                  <p className="text-lg font-bold text-white tabular-nums mt-0.5">
                    {formatCurrency(generated.totals.metaSpend, currency)}
                    <span className="text-[10px] font-normal text-[#94A3B8] ml-1">
                      ({generated.totals.totalSpend > 0 ? Math.round((generated.totals.metaSpend / generated.totals.totalSpend) * 100) : 0}%)
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-emerald-400">Google</p>
                  <p className="text-lg font-bold text-white tabular-nums mt-0.5">
                    {formatCurrency(generated.totals.googleSpend, currency)}
                    <span className="text-[10px] font-normal text-[#94A3B8] ml-1">
                      ({generated.totals.totalSpend > 0 ? Math.round((generated.totals.googleSpend / generated.totals.totalSpend) * 100) : 0}%)
                    </span>
                  </p>
                </div>
              </div>
            )}

            {/* Performance table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[680px]">
                <thead className="text-[10px] uppercase tracking-wider text-[#94A3B8]">
                  <tr className="border-b border-white/[0.08]">
                    <th className="text-left p-2">{platformLabel(generated.platform)}</th>
                    {metrics.actualVsTargetSpend && (
                      <>
                        <th className="text-right p-2">Actual Spend</th>
                        <th className="text-right p-2">Target Spend</th>
                      </>
                    )}
                    {metrics.impressions && <th className="text-right p-2">Impr.</th>}
                    {metrics.clicks && <th className="text-right p-2">Clicks</th>}
                    {metrics.ctr && <th className="text-right p-2">CTR</th>}
                    {metrics.cpc && <th className="text-right p-2">CPC</th>}
                    {metrics.leadsVsPlanned && (
                      <>
                        <th className="text-right p-2">Leads</th>
                        <th className="text-right p-2">Planned</th>
                      </>
                    )}
                    {metrics.qualifiedLeads && (
                      <>
                        <th className="text-right p-2">Qualified</th>
                        <th className="text-right p-2">Qual. %</th>
                      </>
                    )}
                    {metrics.cplVsEstimated && (
                      <>
                        <th className="text-right p-2">CPL</th>
                        <th className="text-right p-2">Est. CPL</th>
                      </>
                    )}
                    {metrics.cpa && <th className="text-right p-2">CPA</th>}
                  </tr>
                </thead>
                <tbody>
                  {generated.rows.map((r, i) => {
                    // Pull the matched previous-period row for delta
                    // computation. prevRows is parallel-aligned by index
                    // because both buildRows passes use the same lead-
                    // type filter + order.
                    const prev = generated.prevRows?.[i];
                    return (
                      <tr key={r.leadType.id} className="border-b border-white/[0.04]">
                        <td className="p-2 text-white font-medium">{r.leadType.label}</td>
                        {metrics.actualVsTargetSpend && (
                          <>
                            <td className="p-2 text-right tabular-nums">
                              <CurrencyCell current={r.actualSpend} prev={prev?.actualSpend} currency={currency} />
                            </td>
                            <td className="p-2 text-right tabular-nums text-[#94A3B8]">{r.targetSpend > 0 ? formatCurrency(r.targetSpend, currency) : "—"}</td>
                          </>
                        )}
                        {metrics.impressions && (
                          <td className="p-2 text-right tabular-nums">
                            <NumberCell current={r.impressions} prev={prev?.impressions} />
                          </td>
                        )}
                        {metrics.clicks && (
                          <td className="p-2 text-right tabular-nums">
                            <NumberCell current={r.clicks} prev={prev?.clicks} />
                          </td>
                        )}
                        {metrics.ctr && (
                          <td className="p-2 text-right tabular-nums">
                            <PctCell current={r.impressions > 0 ? r.ctr : null} prev={prev && prev.impressions > 0 ? prev.ctr : null} />
                          </td>
                        )}
                        {metrics.cpc && (
                          <td className="p-2 text-right tabular-nums">
                            <CurrencyCell current={r.cpc} prev={prev?.cpc} currency={currency} invert />
                          </td>
                        )}
                        {metrics.leadsVsPlanned && (
                          <>
                            <td className="p-2 text-right tabular-nums text-emerald-400">
                              <NumberCell current={r.leads} prev={prev?.leads} />
                            </td>
                            <td className="p-2 text-right tabular-nums text-[#94A3B8]">{r.plannedLeads > 0 ? formatNumber(r.plannedLeads) : "—"}</td>
                          </>
                        )}
                        {metrics.qualifiedLeads && (
                          <>
                            <td className="p-2 text-right tabular-nums">
                              <NumberCell current={r.qualified} prev={prev?.qualified} />
                            </td>
                            <td className="p-2 text-right tabular-nums text-[#94A3B8]">{r.leads > 0 ? `${r.qualificationRate.toFixed(0)}%` : "—"}</td>
                          </>
                        )}
                        {metrics.cplVsEstimated && (
                          <>
                            <td className="p-2 text-right tabular-nums">
                              <CurrencyCell current={r.cpl} prev={prev?.cpl} currency={currency} invert />
                            </td>
                            <td className="p-2 text-right tabular-nums text-[#94A3B8]">{r.estCpl > 0 ? formatCurrency(r.estCpl, currency) : "—"}</td>
                          </>
                        )}
                        {metrics.cpa && (
                          <td className="p-2 text-right tabular-nums">
                            <CurrencyCell current={r.cpa} prev={prev?.cpa} currency={currency} invert />
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* Lead-source caption — makes it explicit which counting
                  rule is in force on the table the reader is looking at. */}
              <p className="text-[10px] text-[#64748B] mt-2 italic">
                Leads = {generated.leadSource === "paid"
                  ? "HubSpot contacts joined to a paid campaign (paid-attributed only)"
                  : "all HubSpot contacts in the period (paid + organic + direct)"}.
              </p>
            </div>

            {/* Narrative */}
            {metrics.narrative && (
              <div className="space-y-2">
                <h4 className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-semibold">Notes</h4>
                <div className="space-y-2">
                  {generated.rows.map((r) => (
                    <div key={r.leadType.id} className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-3">
                      <div className="flex items-baseline justify-between gap-2 mb-1">
                        <span className="text-xs font-semibold text-white">{r.leadType.label}</span>
                        <span className="text-[9px] uppercase tracking-wider text-[#64748B]">Editable below</span>
                      </div>
                      <textarea
                        value={narrative[r.leadType.id] ?? ""}
                        onChange={(e) => setNarrative((n) => ({ ...n, [r.leadType.id]: e.target.value }))}
                        className="w-full text-xs text-[#CBD5E1] bg-transparent resize-none focus:outline-none"
                        rows={3}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sales sequencing block removed — was manual entry only,
                Daisy ruled out manual entries on Reports. Re-introduce
                when we wire a real sequencing data source. */}
          </div>

          {/* Action buttons */}
          <footer className="px-5 py-3 border-t border-white/[0.06] bg-white/[0.02] flex flex-wrap items-center gap-3 ministry-report-actions">
            <button
              onClick={handleDownloadPDF}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.10] text-white transition-colors"
            >
              <Download size={12} /> Download as PDF
            </button>
            <input
              value={slackChannel}
              onChange={(e) => setSlackChannel(e.target.value)}
              placeholder="#channel or channel ID"
              className="text-xs bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-white placeholder-[#64748B] focus:outline-none focus:border-white/[0.16] flex-1 min-w-[180px] max-w-[240px]"
            />
            <button
              onClick={handleSlackSend}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/90 hover:bg-emerald-500 text-white transition-colors"
            >
              <Send size={12} /> Send to Slack
            </button>
            <span className="text-[10px] text-[#64748B] ml-auto">
              Slack send copies a formatted block-kit message to your clipboard.
            </span>
          </footer>
        </section>
      )}

      {/* ── History ── */}
      <section className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl overflow-hidden ministry-report-history">
        <header className="px-5 py-3 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-white">Previous reports</h3>
          <p className="text-[11px] text-[#64748B] mt-0.5">Stored locally in your browser. Last {MAX_HISTORY} kept.</p>
        </header>
        {history.length === 0 ? (
          <p className="p-5 text-xs text-[#64748B]">No reports generated yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-[#94A3B8]">
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left p-3">Generated</th>
                  <th className="text-left p-3">Period</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-left p-3">Generated by</th>
                  <th className="text-right p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b border-white/[0.04]">
                    <td className="p-3 text-white tabular-nums">
                      {new Date(h.generatedAt).toLocaleString()}
                    </td>
                    <td className="p-3 text-[#94A3B8]">{h.periodLabel}</td>
                    <td className="p-3 text-[#94A3B8] capitalize">{h.reportType}</td>
                    <td className="p-3 text-[#94A3B8]">{h.generatedBy}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => setGenerated(h.payload)}
                        className="text-[11px] font-medium text-[#C8A96E] hover:text-white mr-3 transition-colors"
                      >
                        Re-open
                      </button>
                      <button
                        onClick={() => handleDeleteHistory(h.id)}
                        className="inline-flex items-center text-[11px] text-red-400/70 hover:text-red-400 transition-colors"
                        title="Remove from history"
                      >
                        <Trash2 size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Print stylesheet — hides controls + history when the user
          presses the Download as PDF button (window.print()). The
          preview alone renders, so the resulting PDF looks like a
          one-page client-facing report. */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .ministry-report-preview, .ministry-report-preview * { visibility: visible; }
          .ministry-report-preview { position: absolute; left: 0; top: 0; width: 100%; }
          .ministry-report-actions { display: none !important; }
          .ministry-report-controls, .ministry-report-history { display: none !important; }
        }
      `}</style>
    </div>
  );
}

/* ── Small UI helpers (kept inline; not exported) ── */

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-semibold mb-1.5">{children}</p>;
}

function PillGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex items-center bg-white/[0.04] border border-white/[0.06] rounded-lg p-0.5 text-[11px] font-semibold">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={cn(
            "px-3 py-1.5 rounded-md transition-colors",
            value === opt.id ? "bg-white/[0.08] text-white" : "text-[#94A3B8] hover:text-white",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Checkbox({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-xs text-[#CBD5E1] hover:text-white transition-colors select-none">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-[#C8A96E] w-3.5 h-3.5"
      />
      <span>{label}</span>
    </label>
  );
}

/* NumberInput removed — Reports no longer accept any manual numeric
   entries (customer count + manual CPA override + sales sequencing
   were the only callers). */

/* ── Delta cells ──
   Render the current value with a small ▲/▼ percentage delta when the
   parent supplies a previous-period value. `invert` flips the colour
   semantics for cost metrics (CPL, CPC, CPA — where down is good). */

function deltaText(current: number, prev: number): { pct: number; up: boolean } {
  if (prev === 0) return { pct: 0, up: current > 0 };
  const pct = ((current - prev) / prev) * 100;
  return { pct, up: pct >= 0 };
}

function DeltaTag({ current, prev, invert }: { current: number; prev: number | undefined; invert?: boolean }) {
  if (prev === undefined || (current === 0 && prev === 0)) return null;
  const { pct, up } = deltaText(current, prev);
  // For cost metrics (invert=true), down is green (good), up is red (bad).
  const isGood = invert ? !up : up;
  const colour = pct === 0 ? "text-[#64748B]" : isGood ? "text-emerald-400" : "text-red-400";
  return (
    <span className={cn("block text-[9px] font-normal mt-0.5", colour)}>
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

function CurrencyCell({ current, prev, currency, invert }: { current: number; prev: number | undefined; currency: string; invert?: boolean }) {
  return (
    <>
      {current > 0 ? formatCurrency(current, currency) : "—"}
      <DeltaTag current={current} prev={prev} invert={invert} />
    </>
  );
}

function NumberCell({ current, prev }: { current: number; prev: number | undefined }) {
  return (
    <>
      {current > 0 ? formatNumber(current) : "—"}
      <DeltaTag current={current} prev={prev} />
    </>
  );
}

function PctCell({ current, prev }: { current: number | null; prev: number | null }) {
  return (
    <>
      {current !== null ? `${current.toFixed(2)}%` : "—"}
      <DeltaTag current={current ?? 0} prev={prev ?? undefined} />
    </>
  );
}
