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
import { Download, Send, Trash2, Sparkles, Calendar, FileText } from "lucide-react";
import type { WindsorRow, HubSpotContact } from "@/lib/windsor";
import { classifyPlatform } from "@/lib/windsor";
import { reconcileByCampaign, getContactsByCampaign } from "@/lib/leadReconciliation";
import { LEAD_TYPES, getLeadTypeFromCampaign, type LeadType } from "@/lib/ministry-config";
import { formatCurrency, formatNumber, cn } from "@/lib/utils";

/* ── Types ── */

type ReportType = "weekly" | "monthly";
type PlatformChoice = "meta" | "google" | "both";

interface MetricToggles {
  actualVsTargetSpend: boolean;
  leadsVsPlanned: boolean;
  cplVsEstimated: boolean;
  customerCount: boolean;
  cpa: boolean;
  salesSequencing: boolean;
  narrative: boolean;
}

interface SavedReport {
  id: string;
  generatedAt: string; // ISO
  reportType: ReportType;
  periodLabel: string;
  generatedBy: string;
  payload: ReportPayload;
}

interface ReportRow {
  leadType: LeadType;
  actualSpend: number;
  targetSpend: number; // midpoint of LEAD_TYPE.budget*
  leads: number; // HubSpot verified
  plannedLeads: number; // midpoint of LEAD_TYPE.volume*
  cpl: number; // actualSpend / leads
  estCpl: number; // midpoint of LEAD_TYPE.targetCpl*
  customerCount: number; // manual
  cpa: number; // manual
}

interface ReportPayload {
  reportType: ReportType;
  periodLabel: string;
  platform: PlatformChoice;
  metrics: MetricToggles;
  rows: ReportRow[];
  narrative: Record<string, string>; // keyed by lead type id
  sequencing: SequencingStats;
}

interface SequencingStats {
  enrolled: number;
  opened: number;
  clicked: number;
  replied: number;
  meetings: number;
}

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

/** Build the per-lead-type rows from raw Windsor + HubSpot data. */
function buildRows(
  windsor: WindsorRow[],
  contacts: HubSpotContact[],
  platform: PlatformChoice,
  selectedLeadTypeIds: Set<string>,
  manualOverrides: Record<string, { customerCount: number; cpa: number }>,
): ReportRow[] {
  // Filter by platform first.
  const filtered = windsor.filter((r) => {
    const p = classifyPlatform(r.source);
    if (platform === "both") return p === "meta" || p === "google";
    return p === platform;
  });

  // Aggregate spend per lead type via campaign name → product matcher.
  const spendByType = new Map<string, number>();
  for (const lt of PRODUCT_LEAD_TYPES) spendByType.set(lt.id, 0);
  for (const r of filtered) {
    const lt = getLeadTypeFromCampaign(r.campaign);
    spendByType.set(lt.id, (spendByType.get(lt.id) ?? 0) + (Number(r.spend) || 0));
  }

  // Aggregate verified leads per lead type via reconciler — matched
  // contacts on each campaign, grouped by the same product matcher.
  const recon = reconcileByCampaign(contacts, filtered);
  const verifiedByType = new Map<string, number>();
  for (const lt of PRODUCT_LEAD_TYPES) verifiedByType.set(lt.id, 0);
  for (const row of recon) {
    const lt = getLeadTypeFromCampaign(row.campaignName);
    verifiedByType.set(lt.id, (verifiedByType.get(lt.id) ?? 0) + (row.hubspotConfirmed ?? 0));
  }
  // Touch the per-campaign contact list so future per-lead-type narrative
  // hooks have somewhere to plug in (tag-source breakdown, qualification,
  // etc.) without rebuilding the join.
  void getContactsByCampaign;

  return PRODUCT_LEAD_TYPES
    .filter((lt) => selectedLeadTypeIds.has(lt.id))
    .map((lt) => {
      const actualSpend = spendByType.get(lt.id) ?? 0;
      const leads = verifiedByType.get(lt.id) ?? 0;
      const cpl = leads > 0 ? actualSpend / leads : 0;
      const targetSpend = midpoint(lt.budgetMin, lt.budgetMax);
      const plannedLeads = midpoint(lt.volumeMin, lt.volumeMax);
      const estCpl = midpoint(lt.targetCplMin, lt.targetCplMax);
      const override = manualOverrides[lt.id] ?? { customerCount: 0, cpa: 0 };
      return {
        leadType: lt,
        actualSpend,
        targetSpend,
        leads,
        plannedLeads,
        cpl,
        estCpl,
        customerCount: override.customerCount,
        cpa: override.cpa,
      };
    });
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
  if (payload.metrics.salesSequencing) {
    const s = payload.sequencing;
    lines.push("");
    lines.push("*Sales sequencing*");
    lines.push(`Enrolled ${s.enrolled} · Opened ${s.opened} · Clicked ${s.clicked} · Replied ${s.replied} · Meetings ${s.meetings}`);
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
  currency: string;
  defaultPeriodLabel: string;
}

export function MinistryReportBuilder({
  windsorData,
  hubspotData,
  currency,
  defaultPeriodLabel,
}: MinistryReportBuilderProps) {
  /* ── Controls state ── */
  const [reportType, setReportType] = useState<ReportType>("weekly");
  const [platform, setPlatform] = useState<PlatformChoice>("both");
  const [selectedLeadTypeIds, setSelectedLeadTypeIds] = useState<Set<string>>(
    () => new Set(PRODUCT_LEAD_TYPES.map((lt) => lt.id)),
  );
  const [metrics, setMetrics] = useState<MetricToggles>({
    actualVsTargetSpend: true,
    leadsVsPlanned: true,
    cplVsEstimated: true,
    customerCount: false,
    cpa: false,
    salesSequencing: false,
    narrative: true,
  });

  /* ── Manual overrides for customer count + CPA per lead type ── */
  const [manualOverrides, setManualOverrides] = useState<Record<string, { customerCount: number; cpa: number }>>({});
  const updateOverride = (id: string, field: "customerCount" | "cpa", value: number) => {
    setManualOverrides((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { customerCount: 0, cpa: 0 }), [field]: value },
    }));
  };

  /* ── Free-text narrative per lead type ── */
  const [narrative, setNarrative] = useState<Record<string, string>>({});

  /* ── Sales sequencing manual inputs ── */
  const [sequencing, setSequencing] = useState<SequencingStats>({
    enrolled: 0, opened: 0, clicked: 0, replied: 0, meetings: 0,
  });

  /* ── Slack channel target (text input, not a connector) ── */
  const [slackChannel, setSlackChannel] = useState("");

  /* ── Generated report payload (rendered when present) ── */
  const [generated, setGenerated] = useState<ReportPayload | null>(null);

  /* ── History from localStorage ── */
  const [history, setHistory] = useState<SavedReport[]>([]);
  useEffect(() => { setHistory(loadHistory()); }, []);

  /* ── Derived rows for the live preview ── */
  const liveRows = useMemo(
    () => buildRows(windsorData ?? [], hubspotData ?? [], platform, selectedLeadTypeIds, manualOverrides),
    [windsorData, hubspotData, platform, selectedLeadTypeIds, manualOverrides],
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
    setGenerated({
      reportType,
      periodLabel: defaultPeriodLabel,
      platform,
      metrics,
      rows: liveRows,
      narrative: filledNarrative,
      sequencing,
    });
    // Push to history
    const entry: SavedReport = {
      id: Date.now().toString(36),
      generatedAt: new Date().toISOString(),
      reportType,
      periodLabel: defaultPeriodLabel,
      generatedBy: typeof window !== "undefined" ? window.localStorage.getItem("user-email") || "OnSocial team" : "OnSocial team",
      payload: {
        reportType,
        periodLabel: defaultPeriodLabel,
        platform,
        metrics,
        rows: liveRows,
        narrative: filledNarrative,
        sequencing,
      },
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

        {/* Period + Platform + Type */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>Report type</Label>
            <PillGroup
              options={[
                { id: "weekly", label: "Weekly Update" },
                { id: "monthly", label: "Monthly Review" },
              ]}
              value={reportType}
              onChange={(v) => setReportType(v as ReportType)}
            />
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
            <Label>Period</Label>
            <p className="text-xs text-white bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 flex items-center gap-2">
              <Calendar size={12} className="text-[#94A3B8]" />
              {defaultPeriodLabel}
            </p>
          </div>
        </div>

        {/* Lead types */}
        <div>
          <Label>Lead types to include</Label>
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
        </div>

        {/* Metrics */}
        <div>
          <Label>Metrics to include</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            <Checkbox label="Actual vs Target Spend" value={metrics.actualVsTargetSpend} onChange={(v) => setMetrics((m) => ({ ...m, actualVsTargetSpend: v }))} />
            <Checkbox label="Leads vs Planned" value={metrics.leadsVsPlanned} onChange={(v) => setMetrics((m) => ({ ...m, leadsVsPlanned: v }))} />
            <Checkbox label="CPL vs Estimated" value={metrics.cplVsEstimated} onChange={(v) => setMetrics((m) => ({ ...m, cplVsEstimated: v }))} />
            <Checkbox label="Customer count (manual)" value={metrics.customerCount} onChange={(v) => setMetrics((m) => ({ ...m, customerCount: v }))} />
            <Checkbox label="CPA (manual)" value={metrics.cpa} onChange={(v) => setMetrics((m) => ({ ...m, cpa: v }))} />
            <Checkbox label="Sales sequencing stats" value={metrics.salesSequencing} onChange={(v) => setMetrics((m) => ({ ...m, salesSequencing: v }))} />
            <Checkbox label="Narrative notes" value={metrics.narrative} onChange={(v) => setMetrics((m) => ({ ...m, narrative: v }))} />
          </div>
        </div>

        {/* Manual customer / CPA inputs (per lead type) — only shown if
            either toggle is on. Keeps the controls panel compact when
            the user isn't tracking customers. */}
        {(metrics.customerCount || metrics.cpa) && liveRows.length > 0 && (
          <div>
            <Label>Manual customer + CPA per lead type</Label>
            <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-white/[0.02]">
                  <tr className="text-[10px] uppercase tracking-wider text-[#94A3B8]">
                    <th className="text-left p-2">Lead type</th>
                    {metrics.customerCount && <th className="text-right p-2">Customers</th>}
                    {metrics.cpa && <th className="text-right p-2">CPA</th>}
                  </tr>
                </thead>
                <tbody>
                  {liveRows.map((r) => (
                    <tr key={r.leadType.id} className="border-t border-white/[0.04]">
                      <td className="p-2 text-white">{r.leadType.label}</td>
                      {metrics.customerCount && (
                        <td className="p-2 text-right">
                          <NumberInput value={r.customerCount} onChange={(v) => updateOverride(r.leadType.id, "customerCount", v)} />
                        </td>
                      )}
                      {metrics.cpa && (
                        <td className="p-2 text-right">
                          <NumberInput value={r.cpa} onChange={(v) => updateOverride(r.leadType.id, "cpa", v)} />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Sales sequencing — manual entry */}
        {metrics.salesSequencing && (
          <div>
            <Label>Sales sequencing (manual entry)</Label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {(["enrolled", "opened", "clicked", "replied", "meetings"] as const).map((k) => (
                <div key={k}>
                  <p className="text-[10px] uppercase tracking-wider text-[#94A3B8] mb-1">{k}</p>
                  <NumberInput value={sequencing[k]} onChange={(v) => setSequencing((s) => ({ ...s, [k]: v }))} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-white/[0.04]">
          <button
            onClick={handleGenerate}
            disabled={selectedLeadTypeIds.size === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/90 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Sparkles size={14} />
            Generate Report
          </button>
        </div>
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
                    {metrics.leadsVsPlanned && (
                      <>
                        <th className="text-right p-2">Leads</th>
                        <th className="text-right p-2">Planned</th>
                      </>
                    )}
                    {metrics.cplVsEstimated && (
                      <>
                        <th className="text-right p-2">CPL</th>
                        <th className="text-right p-2">Est. CPL</th>
                      </>
                    )}
                    {metrics.customerCount && <th className="text-right p-2">Customers</th>}
                    {metrics.cpa && <th className="text-right p-2">CPA</th>}
                  </tr>
                </thead>
                <tbody>
                  {generated.rows.map((r) => (
                    <tr key={r.leadType.id} className="border-b border-white/[0.04]">
                      <td className="p-2 text-white font-medium">{r.leadType.label}</td>
                      {metrics.actualVsTargetSpend && (
                        <>
                          <td className="p-2 text-right tabular-nums">{formatCurrency(r.actualSpend, currency)}</td>
                          <td className="p-2 text-right tabular-nums text-[#94A3B8]">{r.targetSpend > 0 ? formatCurrency(r.targetSpend, currency) : "—"}</td>
                        </>
                      )}
                      {metrics.leadsVsPlanned && (
                        <>
                          <td className="p-2 text-right tabular-nums text-emerald-400">{formatNumber(r.leads)}</td>
                          <td className="p-2 text-right tabular-nums text-[#94A3B8]">{r.plannedLeads > 0 ? formatNumber(r.plannedLeads) : "—"}</td>
                        </>
                      )}
                      {metrics.cplVsEstimated && (
                        <>
                          <td className="p-2 text-right tabular-nums">{r.cpl > 0 ? formatCurrency(r.cpl, currency) : "—"}</td>
                          <td className="p-2 text-right tabular-nums text-[#94A3B8]">{r.estCpl > 0 ? formatCurrency(r.estCpl, currency) : "—"}</td>
                        </>
                      )}
                      {metrics.customerCount && (
                        <td className="p-2 text-right tabular-nums">{r.customerCount > 0 ? formatNumber(r.customerCount) : "—"}</td>
                      )}
                      {metrics.cpa && (
                        <td className="p-2 text-right tabular-nums">{r.cpa > 0 ? formatCurrency(r.cpa, currency) : "—"}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
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

            {/* Sales sequencing */}
            {metrics.salesSequencing && (
              <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-4">
                <h4 className="text-[10px] uppercase tracking-wider text-[#94A3B8] font-semibold mb-2">Sales sequencing</h4>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 text-center">
                  {(["enrolled", "opened", "clicked", "replied", "meetings"] as const).map((k) => (
                    <div key={k}>
                      <p className="text-[9px] uppercase tracking-wider text-[#94A3B8]">{k}</p>
                      <p className="text-base font-bold text-white tabular-nums">{formatNumber(generated.sequencing[k])}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
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

function NumberInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      min={0}
      value={value || ""}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className="w-20 bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-xs text-white text-right focus:outline-none focus:border-white/[0.16]"
      placeholder="0"
    />
  );
}
