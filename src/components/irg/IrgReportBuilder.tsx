"use client";

/**
 * IRG Reports builder — Tab 6.
 *
 * Per the 29 April 2026 brief, IRG runs two report types:
 *   - Monthly strategic review (Zack → Imogen + Michael, first week)
 *   - Weekly optimisation (internal, Tuesday 11:30 sync)
 *
 * Sections (checkboxes):
 *   ☑ Spend by brand and platform
 *   ☑ Events revenue by brand
 *   ☑ Hotel revenue (Up Hotel context, read-only)
 *   ☑ Overall ROAS
 *   ☑ Top 5 events by spend
 *   ☑ Top 3 / bottom 3 creatives by CPA (not ROAS)
 *   ☑ Purchase timing split summary (advance vs day-of)
 *   ☑ Rocks Club sign-ups
 *   ☑ Platform reconciliation note
 *   ☐ Optimisation log (free text)
 *   ☐ Next period: events launching
 *
 * Export: PDF (window.print) + Slack copy-to-clipboard, default
 * channel #ibizarocks-os. History persisted in localStorage.
 */

import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/header";
import { VenueTabs } from "@/components/layout/venue-tabs";
import { useVenue } from "@/lib/venue-context";
import { cn } from "@/lib/utils";
import { IRG_BRANDS, IRG_BRAND_GRID_ORDER, type IrgBrandId } from "@/lib/irg-brands";
import {
  getBrandGrid,
  getIrgEvents,
  getIrgCreatives,
  getIrgReconciliation,
  getRocksClubStats,
  getIrgHeadlineKpis,
} from "@/lib/irg-mock";
import { Sparkles, Download, Send, Trash2, FileText } from "lucide-react";

const CARD_BG = "bg-white/[0.04]";const CARD_BORDER = "border-white/[0.06]";const ACCENT_GREEN = "#1D9E75";
const ACCENT_GOLD = "#C8A96E";

/* ── Types ── */

type ReportType = "monthly" | "weekly";

interface SectionToggles {
  spendByBrandPlatform: boolean;
  eventsRevenueByBrand: boolean;
  hotelRevenue: boolean;
  overallRoas: boolean;
  topEvents: boolean;
  topAndBottomCreatives: boolean;
  purchaseTimingSummary: boolean;
  rocksClub: boolean;
  reconciliationNote: boolean;
  optimisationLog: boolean;
  nextPeriodEvents: boolean;
}

interface SavedReport {
  id: string;
  generatedAt: string;
  reportType: ReportType;
  brandLabel: string;
  generatedBy: string;
}

/* ── Helpers ── */

const HISTORY_KEY = "irg-reports-history";
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
function saveHistory(items: SavedReport[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
  } catch {
    // localStorage may be disabled — silent failure is fine.
  }
}

function fmtEur(v: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
}
function fmtEurPrecise(v: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(v);
}
function fmtNumber(v: number): string {
  return new Intl.NumberFormat("en-GB").format(v);
}

/* ── Page ── */

export default function IrgReportBuilder() {
  const { activeVenue } = useVenue();
  const brandLabel = activeVenue === "all" ? "All brands" : IRG_BRANDS[activeVenue].label;

  const [reportType, setReportType] = useState<ReportType>("weekly");
  const [sections, setSections] = useState<SectionToggles>({
    spendByBrandPlatform: true,
    eventsRevenueByBrand: true,
    hotelRevenue: true,
    overallRoas: true,
    topEvents: true,
    topAndBottomCreatives: true,
    purchaseTimingSummary: true,
    rocksClub: true,
    reconciliationNote: true,
    optimisationLog: false,
    nextPeriodEvents: false,
  });
  const [optimisationNotes, setOptimisationNotes] = useState("");
  const [nextPeriodNotes, setNextPeriodNotes] = useState("");
  const [slackChannel, setSlackChannel] = useState("#ibizarocks-os");
  const [generated, setGenerated] = useState(false);
  const [history, setHistory] = useState<SavedReport[]>([]);
  useEffect(() => { setHistory(loadHistory()); }, []);

  // Pull all the mock data we need for the preview. Filter by brand
  // where appropriate; some sections (reconciliation, Rocks Club)
  // are page-level regardless of the active brand.
  const kpis = useMemo(() => getIrgHeadlineKpis(activeVenue), [activeVenue]);
  const brandRows = useMemo(() => getBrandGrid(), []);
  const events = useMemo(() => {
    let rows = getIrgEvents();
    if (activeVenue !== "all") rows = rows.filter((e) => e.brand === activeVenue);
    return rows;
  }, [activeVenue]);
  const creatives = useMemo(() => {
    let rows = getIrgCreatives();
    if (activeVenue !== "all") rows = rows.filter((c) => c.brand === activeVenue);
    return rows;
  }, [activeVenue]);
  const recon = useMemo(() => getIrgReconciliation(), []);
  const rocks = useMemo(() => getRocksClubStats(), []);

  const topEvents = useMemo(
    () => [...events].sort((a, b) => b.spend - a.spend).slice(0, 5),
    [events],
  );
  // Top 3 / bottom 3 by CPA — exclude awareness creatives without a CPA.
  const conversionCreatives = useMemo(
    () => creatives.filter((c) => c.cpaPerCreative !== null),
    [creatives],
  );
  const topByCpa = useMemo(
    () => [...conversionCreatives].sort((a, b) => (a.cpaPerCreative ?? Infinity) - (b.cpaPerCreative ?? Infinity)).slice(0, 3),
    [conversionCreatives],
  );
  const bottomByCpa = useMemo(
    () => [...conversionCreatives].sort((a, b) => (b.cpaPerCreative ?? -Infinity) - (a.cpaPerCreative ?? -Infinity)).slice(0, 3),
    [conversionCreatives],
  );

  // Roll-up of purchase timing across all events in scope
  const timingSummary = useMemo(() => {
    let advance = 0, near = 0, dayOf = 0;
    for (const e of events) {
      advance += e.timingSplit.advance;
      near += e.timingSplit.near;
      dayOf += e.timingSplit.dayOf;
    }
    const total = advance + near + dayOf;
    return {
      advance, near, dayOf, total,
      advancePct: total > 0 ? (advance / total) * 100 : 0,
      nearPct: total > 0 ? (near / total) * 100 : 0,
      dayOfPct: total > 0 ? (dayOf / total) * 100 : 0,
    };
  }, [events]);

  function handleGenerate() {
    setGenerated(true);
    const entry: SavedReport = {
      id: Date.now().toString(36),
      generatedAt: new Date().toISOString(),
      reportType,
      brandLabel,
      generatedBy: typeof window !== "undefined"
        ? window.localStorage.getItem("user-email") || "Zack Isaacs"
        : "Zack Isaacs",
    };
    const next = [entry, ...history].slice(0, MAX_HISTORY);
    setHistory(next);
    saveHistory(next);
  }

  function handleDownloadPdf() {
    if (typeof window !== "undefined") window.print();
  }

  async function handleSlackSend() {
    if (!generated) {
      alert("Generate the report first.");
      return;
    }
    if (!slackChannel.trim()) {
      alert("Enter a Slack channel.");
      return;
    }
    const text = buildSlackText({
      brandLabel, reportType, sections, kpis, brandRows, topEvents,
      topByCpa, bottomByCpa, timingSummary, recon, rocks, optimisationNotes,
      nextPeriodNotes,
    });
    try {
      await navigator.clipboard.writeText(text);
      alert(`Copied to clipboard. Paste into ${slackChannel.trim()}.`);
    } catch {
      console.log(text);
      alert("Couldn't write to clipboard — formatted text logged to console.");
    }
  }

  function handleDeleteHistory(id: string) {
    const next = history.filter((h) => h.id !== id);
    setHistory(next);
    saveHistory(next);
  }

  return (
    <>
      <Header title="Reports" />

      <div
        className="flex-1 px-4 sm:px-6 py-4 sm:py-6 space-y-5 overflow-y-auto"

      >
        <VenueTabs />

        {/* Builder */}
        <section className={cn("rounded-xl sm:rounded-2xl border p-4 space-y-4 irg-report-controls", CARD_BG, CARD_BORDER)}>
          <header className="flex items-center gap-2">
            <FileText size={14} style={{ color: ACCENT_GOLD }} />
            <h2 className="text-sm font-semibold text-white">Build a report</h2>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Report type</Label>
              <div className="inline-flex items-center bg-white/[0.04] border border-white/[0.06] rounded-lg p-0.5 text-[11px] font-medium">
                {(["monthly", "weekly"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setReportType(t)}
                    className={cn(
                      "px-3 py-1.5 rounded-md transition-colors capitalize",
                      reportType === t ? "bg-white/[0.08] text-white" : "text-[#94A3B8] hover:text-white",
                    )}
                  >
                    {t === "monthly" ? "Monthly review" : "Weekly optimisation"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Brand</Label>
              <p className="text-[12px] text-white bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2">
                {brandLabel}
              </p>
              <p className="text-[10px] text-[#64748B] mt-1">Set via the brand pills above.</p>
            </div>
          </div>

          <div>
            <Label>Sections to include</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              <Check label="Spend by brand and platform" value={sections.spendByBrandPlatform} onChange={(v) => setSections((s) => ({ ...s, spendByBrandPlatform: v }))} />
              <Check label="Events revenue by brand" value={sections.eventsRevenueByBrand} onChange={(v) => setSections((s) => ({ ...s, eventsRevenueByBrand: v }))} />
              <Check label="Hotel revenue (Up Hotel context)" value={sections.hotelRevenue} onChange={(v) => setSections((s) => ({ ...s, hotelRevenue: v }))} />
              <Check label="Overall ROAS" value={sections.overallRoas} onChange={(v) => setSections((s) => ({ ...s, overallRoas: v }))} />
              <Check label="Top 5 events by spend" value={sections.topEvents} onChange={(v) => setSections((s) => ({ ...s, topEvents: v }))} />
              <Check label="Top 3 / bottom 3 creatives by CPA" value={sections.topAndBottomCreatives} onChange={(v) => setSections((s) => ({ ...s, topAndBottomCreatives: v }))} />
              <Check label="Purchase timing split summary" value={sections.purchaseTimingSummary} onChange={(v) => setSections((s) => ({ ...s, purchaseTimingSummary: v }))} />
              <Check label="Rocks Club sign-ups" value={sections.rocksClub} onChange={(v) => setSections((s) => ({ ...s, rocksClub: v }))} />
              <Check label="Platform reconciliation note" value={sections.reconciliationNote} onChange={(v) => setSections((s) => ({ ...s, reconciliationNote: v }))} />
              <Check label="Optimisation log (free text)" value={sections.optimisationLog} onChange={(v) => setSections((s) => ({ ...s, optimisationLog: v }))} />
              <Check label="Next period: events launching" value={sections.nextPeriodEvents} onChange={(v) => setSections((s) => ({ ...s, nextPeriodEvents: v }))} />
            </div>
          </div>

          {sections.optimisationLog && (
            <div>
              <Label>Optimisation log</Label>
              <textarea
                value={optimisationNotes}
                onChange={(e) => setOptimisationNotes(e.target.value)}
                placeholder="Free text — what we changed, what worked, what didn't."
                rows={3}
                className="w-full text-xs bg-white/[0.04] border border-white/[0.06] rounded-lg p-2 text-white placeholder-white/25 focus:outline-none focus:border-white/[0.16] resize-none"
              />
            </div>
          )}
          {sections.nextPeriodEvents && (
            <div>
              <Label>Next period — events launching</Label>
              <textarea
                value={nextPeriodNotes}
                onChange={(e) => setNextPeriodNotes(e.target.value)}
                placeholder="Free text — events going live, brief notes, planned creative."
                rows={3}
                className="w-full text-xs bg-white/[0.04] border border-white/[0.06] rounded-lg p-2 text-white placeholder-white/25 focus:outline-none focus:border-white/[0.16] resize-none"
              />
            </div>
          )}
        </section>

        {/* Generate */}
        <section
          className="irg-report-controls rounded-xl sm:rounded-2xl border p-4 flex flex-wrap items-center justify-between gap-3"
          style={{ backgroundColor: "rgba(29,158,117,0.05)", borderColor: "rgba(29,158,117,0.30)" }}
        >
          <div>
            <p className="text-sm font-semibold text-white">Ready to generate?</p>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">
              {reportType === "monthly" ? "Monthly strategic review" : "Weekly optimisation"} · {brandLabel}
            </p>
          </div>
          <button
            onClick={handleGenerate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
            style={{ backgroundColor: ACCENT_GREEN, color: "white" }}
          >
            <Sparkles size={14} />
            Generate report
          </button>
        </section>

        {/* Preview */}
        {generated && (
          <section className={cn("rounded-xl sm:rounded-2xl border overflow-hidden irg-report-preview", CARD_BG, CARD_BORDER)}>
            <header className="px-5 py-4 border-b border-white/[0.06]">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-[#64748B]">Preview</p>
              <h3 className="text-lg font-bold mt-0.5" style={{ color: "#f0ede8" }}>
                IRG — {reportType === "monthly" ? "Monthly review" : "Weekly optimisation"}
              </h3>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">{brandLabel}</p>
            </header>

            <div className="p-5 space-y-5">
              {sections.overallRoas && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <PreviewKpi label="Total spend" value={fmtEur(kpis.totalSpend)} />
                  <PreviewKpi label="Events revenue" value={fmtEur(kpis.eventsRevenue)} />
                  <PreviewKpi label="Overall ROAS" value={`${kpis.overallRoas.toFixed(1)}x`} />
                  <PreviewKpi label="Tickets" value={fmtNumber(kpis.ticketsSold)} />
                </div>
              )}

              {sections.spendByBrandPlatform && (
                <PreviewSection title="Spend by brand and platform">
                  <table className="w-full text-xs">
                    <thead className="text-[10px] uppercase tracking-wider text-[#64748B]">
                      <tr>
                        <th className="text-left py-1">Brand</th>
                        <th className="text-right py-1">Spend</th>
                        <th className="text-right py-1">Meta</th>
                        <th className="text-right py-1">Google</th>
                      </tr>
                    </thead>
                    <tbody>
                      {IRG_BRAND_GRID_ORDER.filter((b) => b !== "IR_HOTEL").map((id) => {
                        const k = getIrgHeadlineKpis(id as IrgBrandId);
                        return (
                          <tr key={id} className="border-t border-white/[0.04]">
                            <td className="py-1 text-white">{IRG_BRANDS[id].shortLabel}</td>
                            <td className="py-1 text-right tabular-nums">{fmtEur(k.totalSpend)}</td>
                            <td className="py-1 text-right tabular-nums text-[#94A3B8]">{fmtEur(k.metaSpend)}</td>
                            <td className="py-1 text-right tabular-nums text-[#94A3B8]">{fmtEur(k.googleSpend)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </PreviewSection>
              )}

              {sections.eventsRevenueByBrand && (
                <PreviewSection title="Events revenue by brand (Four Venues)">
                  <table className="w-full text-xs">
                    <thead className="text-[10px] uppercase tracking-wider text-[#64748B]">
                      <tr>
                        <th className="text-left py-1">Brand</th>
                        <th className="text-right py-1">Events €</th>
                        <th className="text-right py-1">Tickets</th>
                        <th className="text-right py-1">ROAS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {brandRows.filter((r) => r.brand !== "IR_HOTEL").map((r) => (
                        <tr key={r.brand} className="border-t border-white/[0.04]">
                          <td className="py-1 text-white">{IRG_BRANDS[r.brand].shortLabel}</td>
                          <td className="py-1 text-right tabular-nums">{fmtEur(r.eventsRevenue)}</td>
                          <td className="py-1 text-right tabular-nums text-emerald-400">{fmtNumber(r.tickets)}</td>
                          <td className="py-1 text-right tabular-nums">
                            {r.roas !== null ? `${r.roas.toFixed(1)}x` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </PreviewSection>
              )}

              {sections.hotelRevenue && (
                <PreviewSection title="Hotel revenue — Up Hotel context (read-only)">
                  <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                    Hotel revenue: <span className="text-white/75 font-medium">{fmtEur(brandRows.find((r) => r.brand === "IR_HOTEL")?.hotelRevenue ?? 0)}</span>
                    {" · "}
                    Bookings: <span className="text-white/75 font-medium">{fmtNumber(brandRows.find((r) => r.brand === "IR_HOTEL")?.tickets ?? 0)}</span>
                    {". Up Hotel / Google. Not OnSocial campaigns."}
                  </p>
                </PreviewSection>
              )}

              {sections.topEvents && topEvents.length > 0 && (
                <PreviewSection title="Top 5 events by spend">
                  <table className="w-full text-xs">
                    <thead className="text-[10px] uppercase tracking-wider text-[#64748B]">
                      <tr>
                        <th className="text-left py-1">Event</th>
                        <th className="text-left py-1">Brand</th>
                        <th className="text-right py-1">Spend</th>
                        <th className="text-right py-1">Tickets</th>
                        <th className="text-right py-1">CPA</th>
                        <th className="text-right py-1">ROAS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topEvents.map((e) => (
                        <tr key={e.id} className="border-t border-white/[0.04]">
                          <td className="py-1 text-white">{e.name}</td>
                          <td className="py-1 text-[#94A3B8]">{IRG_BRANDS[e.brand].shortLabel}</td>
                          <td className="py-1 text-right tabular-nums">{fmtEur(e.spend)}</td>
                          <td className="py-1 text-right tabular-nums text-emerald-400">{fmtNumber(e.ticketsSold)}</td>
                          <td className="py-1 text-right tabular-nums">{fmtEurPrecise(e.cpa)}</td>
                          <td className="py-1 text-right tabular-nums">{e.roas.toFixed(1)}x</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </PreviewSection>
              )}

              {sections.topAndBottomCreatives && (
                <PreviewSection title="Top 3 / bottom 3 creatives by CPA (lower = better)">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-400 mb-1">Top — best CPA</p>
                      <ul className="space-y-1">
                        {topByCpa.map((c) => (
                          <li key={c.id} className="flex items-baseline justify-between gap-2">
                            <span className="text-white truncate" title={c.name}>{c.name}</span>
                            <span className="tabular-nums text-emerald-400 font-semibold">{c.cpaPerCreative !== null ? fmtEurPrecise(c.cpaPerCreative) : "—"}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-red-400 mb-1">Bottom — worst CPA</p>
                      <ul className="space-y-1">
                        {bottomByCpa.map((c) => (
                          <li key={c.id} className="flex items-baseline justify-between gap-2">
                            <span className="text-white truncate" title={c.name}>{c.name}</span>
                            <span className="tabular-nums text-red-400 font-semibold">{c.cpaPerCreative !== null ? fmtEurPrecise(c.cpaPerCreative) : "—"}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <p className="text-[10px] text-[#64748B] mt-2 italic">
                    Sorted by CPA per creative, not ROAS. Awareness creatives excluded.
                  </p>
                </PreviewSection>
              )}

              {sections.purchaseTimingSummary && timingSummary.total > 0 && (
                <PreviewSection title="Purchase timing — across all events in scope">
                  <div className="flex w-full overflow-hidden rounded h-2.5 mb-2">
                    <div className="h-full" style={{ width: `${timingSummary.advancePct}%`, backgroundColor: "#1D9E75" }} />
                    <div className="h-full" style={{ width: `${timingSummary.nearPct}%`, backgroundColor: "#d97706" }} />
                    <div className="h-full" style={{ width: `${timingSummary.dayOfPct}%`, backgroundColor: "#c0392b" }} />
                  </div>
                  <p className="text-[11px] text-[#94A3B8]">
                    <span style={{ color: "#1D9E75" }}>{timingSummary.advancePct.toFixed(0)}% advance</span>
                    {" · "}
                    <span style={{ color: "#d97706" }}>{timingSummary.nearPct.toFixed(0)}% near</span>
                    {" · "}
                    <span style={{ color: "#c0392b" }}>{timingSummary.dayOfPct.toFixed(0)}% day-of</span>
                    <span className="text-[#64748B]">
                      {" "}({fmtNumber(timingSummary.total)} tickets across {events.length} events)
                    </span>
                  </p>
                </PreviewSection>
              )}

              {sections.rocksClub && (
                <PreviewSection title="Rocks Club sign-ups">
                  <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                    <span className="font-semibold text-white">{fmtNumber(rocks.total)}</span>{" "}
                    sign-ups this period (▲ {fmtNumber(rocks.weekDelta)} this week).
                    Email captures feeding hotel funnel — list size 80–100k.
                    March email campaign drove £40k hotel revenue.
                  </p>
                </PreviewSection>
              )}

              {sections.reconciliationNote && (
                <PreviewSection title="Platform reconciliation">
                  <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                    Platforms reported {fmtNumber(recon.metaPlatformReported + recon.googlePlatformReported)} sales
                    ({fmtNumber(recon.metaPlatformReported)} Meta + {fmtNumber(recon.googlePlatformReported)} Google).
                    Four Venues confirmed {fmtNumber(recon.fourVenuesConfirmed)} — over-attribution{" "}
                    {((recon.metaPlatformReported + recon.googlePlatformReported) / recon.fourVenuesConfirmed).toFixed(1)}×.
                    GA4 (Four Venues) is the source of truth.
                  </p>
                </PreviewSection>
              )}

              {sections.optimisationLog && optimisationNotes.trim() && (
                <PreviewSection title="Optimisation log">
                  <p className="text-[11px] text-white/65 whitespace-pre-wrap leading-relaxed">{optimisationNotes}</p>
                </PreviewSection>
              )}

              {sections.nextPeriodEvents && nextPeriodNotes.trim() && (
                <PreviewSection title="Next period — events launching">
                  <p className="text-[11px] text-white/65 whitespace-pre-wrap leading-relaxed">{nextPeriodNotes}</p>
                </PreviewSection>
              )}
            </div>

            {/* Action row */}
            <footer className="px-5 py-3 border-t border-white/[0.06] bg-white/[0.02] flex flex-wrap items-center gap-3 irg-report-actions">
              <button
                onClick={handleDownloadPdf}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.10] text-white transition-colors"
              >
                <Download size={12} /> Download PDF
              </button>
              <input
                value={slackChannel}
                onChange={(e) => setSlackChannel(e.target.value)}
                className="text-xs bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-white placeholder-white/25 flex-1 min-w-[180px] max-w-[240px] focus:outline-none focus:border-white/[0.16]"
              />
              <button
                onClick={handleSlackSend}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={{ backgroundColor: ACCENT_GREEN, color: "white" }}
              >
                <Send size={12} /> Send to Slack
              </button>
              <span className="text-[10px] text-[#64748B] ml-auto">
                Slack copies a formatted block-kit message to your clipboard.
              </span>
            </footer>
          </section>
        )}

        {/* History */}
        <section className={cn("rounded-xl sm:rounded-2xl border overflow-hidden irg-report-history", CARD_BG, CARD_BORDER)}>
          <header className="px-5 py-3 border-b border-white/[0.06]">
            <h3 className="text-sm font-semibold text-white">Previous reports</h3>
            <p className="text-[11px] text-[#64748B] mt-0.5">Stored locally — last {MAX_HISTORY} kept.</p>
          </header>
          {history.length === 0 ? (
            <p className="p-5 text-xs text-[#64748B]">No reports generated yet.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-[#64748B]">
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-4 py-2">Generated</th>
                  <th className="text-left px-4 py-2">Period</th>
                  <th className="text-left px-4 py-2">Brand</th>
                  <th className="text-left px-4 py-2">Generated by</th>
                  <th className="text-right px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b border-white/[0.04]">
                    <td className="px-4 py-2 text-white tabular-nums">{new Date(h.generatedAt).toLocaleString()}</td>
                    <td className="px-4 py-2 text-[#94A3B8] capitalize">{h.reportType}</td>
                    <td className="px-4 py-2 text-[#94A3B8]">{h.brandLabel}</td>
                    <td className="px-4 py-2 text-[#94A3B8]">{h.generatedBy}</td>
                    <td className="px-4 py-2 text-right">
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
          )}
        </section>

        {/* Print stylesheet */}
        <style jsx global>{`
          @media print {
            body * { visibility: hidden; }
            .irg-report-preview, .irg-report-preview * { visibility: visible; }
            .irg-report-preview { position: absolute; left: 0; top: 0; width: 100%; }
            .irg-report-actions, .irg-report-controls, .irg-report-history { display: none !important; }
          }
        `}</style>
      </div>
    </>
  );
}

/* ── Slack export ── */

function buildSlackText(opts: {
  brandLabel: string;
  reportType: ReportType;
  sections: SectionToggles;
  kpis: ReturnType<typeof getIrgHeadlineKpis>;
  brandRows: ReturnType<typeof getBrandGrid>;
  topEvents: ReturnType<typeof getIrgEvents>;
  topByCpa: ReturnType<typeof getIrgCreatives>;
  bottomByCpa: ReturnType<typeof getIrgCreatives>;
  timingSummary: { advancePct: number; nearPct: number; dayOfPct: number; total: number };
  recon: ReturnType<typeof getIrgReconciliation>;
  rocks: ReturnType<typeof getRocksClubStats>;
  optimisationNotes: string;
  nextPeriodNotes: string;
}): string {
  const { brandLabel, reportType, sections, kpis, brandRows, topEvents, topByCpa, bottomByCpa, timingSummary, recon, rocks, optimisationNotes, nextPeriodNotes } = opts;
  const lines: string[] = [];
  lines.push(`*IRG — ${reportType === "monthly" ? "Monthly review" : "Weekly optimisation"}*`);
  lines.push(`_${brandLabel}_`);
  lines.push("");
  if (sections.overallRoas) {
    lines.push(`Spend ${fmtEur(kpis.totalSpend)} · Events €${fmtNumber(kpis.eventsRevenue)} · ROAS ${kpis.overallRoas.toFixed(1)}x · ${fmtNumber(kpis.ticketsSold)} tickets`);
  }
  if (sections.eventsRevenueByBrand) {
    lines.push("");
    lines.push("*Brand performance*");
    for (const r of brandRows.filter((b) => b.brand !== "IR_HOTEL")) {
      lines.push(`• ${IRG_BRANDS[r.brand].shortLabel}: ${fmtEur(r.eventsRevenue)} · ${fmtNumber(r.tickets)} tickets · ${r.roas !== null ? `${r.roas.toFixed(1)}x` : "—"}`);
    }
  }
  if (sections.topEvents && topEvents.length > 0) {
    lines.push("");
    lines.push("*Top 5 events by spend*");
    for (const e of topEvents) {
      lines.push(`• ${e.name} — ${fmtEur(e.spend)} → ${fmtNumber(e.ticketsSold)} tickets · ${e.roas.toFixed(1)}x`);
    }
  }
  if (sections.topAndBottomCreatives) {
    lines.push("");
    lines.push("*Best 3 creatives by CPA*");
    for (const c of topByCpa) lines.push(`• ${c.name}: CPA ${c.cpaPerCreative !== null ? fmtEurPrecise(c.cpaPerCreative) : "—"}`);
    lines.push("*Worst 3 creatives by CPA*");
    for (const c of bottomByCpa) lines.push(`• ${c.name}: CPA ${c.cpaPerCreative !== null ? fmtEurPrecise(c.cpaPerCreative) : "—"}`);
  }
  if (sections.purchaseTimingSummary) {
    lines.push("");
    lines.push(`*Purchase timing*: ${timingSummary.advancePct.toFixed(0)}% advance · ${timingSummary.nearPct.toFixed(0)}% near · ${timingSummary.dayOfPct.toFixed(0)}% day-of`);
  }
  if (sections.rocksClub) {
    lines.push("");
    lines.push(`*Rocks Club*: ${fmtNumber(rocks.total)} sign-ups (▲ ${rocks.weekDelta} this week)`);
  }
  if (sections.reconciliationNote) {
    lines.push("");
    lines.push(`*Reconciliation*: Meta ${fmtNumber(recon.metaPlatformReported)} + Google ${fmtNumber(recon.googlePlatformReported)} → FV ${fmtNumber(recon.fourVenuesConfirmed)} (${((recon.metaPlatformReported + recon.googlePlatformReported) / recon.fourVenuesConfirmed).toFixed(1)}× over-attribution).`);
  }
  if (sections.optimisationLog && optimisationNotes.trim()) {
    lines.push("");
    lines.push("*Optimisation log*");
    lines.push(optimisationNotes.trim());
  }
  if (sections.nextPeriodEvents && nextPeriodNotes.trim()) {
    lines.push("");
    lines.push("*Next period — events launching*");
    lines.push(nextPeriodNotes.trim());
  }
  return lines.join("\n");
}

/* ── Pieces ── */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-wider font-semibold text-[#94A3B8] mb-1.5">{children}</p>
  );
}

function Check({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-[12px] text-white/65 cursor-pointer hover:text-white transition-colors select-none">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-[#1D9E75] w-3.5 h-3.5"
      />
      <span>{label}</span>
    </label>
  );
}

function PreviewKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.04] rounded-md p-2.5">
      <p className="text-[9px] uppercase tracking-wider text-[#64748B] mb-1">{label}</p>
      <p className="text-base font-semibold tabular-nums" style={{ color: "#f0ede8" }}>{value}</p>
    </div>
  );
}

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-semibold text-[#94A3B8] mb-2">{title}</p>
      <div className="bg-white/[0.02] border border-white/[0.04] rounded-md p-3">
        {children}
      </div>
    </div>
  );
}
