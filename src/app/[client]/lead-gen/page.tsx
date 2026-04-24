"use client";

import { useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { KpiCard } from "@/components/ui/kpi-card";
import { KpiDetailModal, type KpiDetailData } from "@/components/ui/kpi-detail-modal";
import { getLeadFunnel, getClientKPIs } from "@/lib/mock-data";
import { useClient } from "@/lib/client-context";
import { useDateRange } from "@/lib/date-range-context";
import { useWindsor } from "@/lib/use-windsor";
import type { WindsorRow, HubSpotContact } from "@/lib/windsor";
import { reconcileByCampaign } from "@/lib/leadReconciliation";
import { formatCurrency, formatNumber, cn } from "@/lib/utils";
import { MetricCell } from "@/components/ui/metric-cell";
import { Target, DollarSign, TrendingUp, Zap } from "lucide-react";

/* ── Page ──
 *
 * The Lead Quality by Campaign table was previously reading mock data
 * (Math.random() qualified percentages, fabricated campaign names). It
 * never called useDateRange(), so changing the global date preset did
 * nothing on this page.
 *
 * This version:
 *  - Pulls live Windsor + HubSpot data through useWindsor, keyed on the
 *    global date range, so the picker now updates the table.
 *  - Uses reconcileByCampaign() — the same join logic as the Ministry
 *    overview — so campaigns reflect real spend + lead attribution.
 *  - Hides the "Qualified %" column until Zack confirms its definition
 *    (brief Fix 6 — no data source defined yet). TODO restored when we
 *    agree what ratio this represents (HubSpot ÷ platform? SQL ÷ lead?).
 *  - Top-row KPIs still fall back to mock aggregates via getClientKPIs
 *    because per-stage funnel counts require lifecycle stage parsing
 *    that isn't scoped for this pass.
 */

export default function LeadGenPage() {
  const { client: clientSlug } = useParams<{ client: string }>();
  const ctx = useClient();
  const client = ctx?.clientConfig;
  const { days, preset, dateFrom, dateTo } = useDateRange();
  const customDateProps = preset === "Custom" ? { dateFrom, dateTo } : {};

  // Real campaign data — keyed on the date range so the picker updates the table.
  const { data: windsorData } = useWindsor<WindsorRow[]>({
    clientSlug,
    type: "campaigns",
    days,
    ...customDateProps,
  });
  const { data: hubspotData } = useWindsor<HubSpotContact[]>({
    clientSlug,
    type: "hubspot",
    days,
    ...customDateProps,
  });

  const campaignRecon = useMemo(
    () => reconcileByCampaign(hubspotData ?? [], windsorData ?? []),
    [hubspotData, windsorData],
  );

  // Fall back to mock KPIs for the top row (funnel stages aren't yet
  // derived from HubSpot lifecyclestage — separate piece of work).
  const kpis = getClientKPIs(clientSlug, client ?? undefined);
  const funnel = getLeadFunnel(clientSlug);

  const [kpiDetail, setKpiDetail] = useState<KpiDetailData | null>(null);
  const closeKpiDetail = useCallback(() => setKpiDetail(null), []);

  if (!client) return null;

  // Only render for lead_gen or hybrid clients
  if (client.type !== "lead_gen" && client.type !== "hybrid") {
    return (
      <>
        <Header title="Lead Generation" showDateRange={false} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-8 text-center space-y-2">
            <p className="text-sm text-[#94A3B8]">
              Lead generation view is only available for lead gen and hybrid
              clients.
            </p>
          </div>
        </div>
      </>
    );
  }

  // Derived KPIs
  const cpl = kpis.cpl ?? 0;
  const leadsStage = funnel.find((s) => s.name.toLowerCase().includes("lead") || s.name.toLowerCase().includes("form"));
  const sqlStage = funnel.find((s) => s.name === "SQL");
  const closedStage = funnel.find((s) => s.name.toLowerCase().includes("closed"));
  const cpql =
    sqlStage && sqlStage.count > 0 ? kpis.spend / sqlStage.count : 0;
  const pipelineValue =
    closedStage && client.averageDealValue
      ? closedStage.count * client.averageDealValue
      : 0;
  const leadVelocityRate = leadsStage
    ? ((leadsStage.count - leadsStage.count * 0.85) /
        (leadsStage.count * 0.85)) *
      100
    : 0;

  // Funnel max count for width calculation
  const maxCount = funnel.length > 0 ? funnel[0].count : 1;

  // Real campaign quality rows — sorted by spend desc, top 20.
  const campaignQuality = campaignRecon
    .slice()
    .sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0))
    .slice(0, 20);

  return (
    <>
      <Header title="Lead Generation" showAttribution />

      <div className="flex-1 p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-5 overflow-y-auto">
        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <KpiCard
            title="CPL"
            value={formatCurrency(cpl, client.currency)}
            delta={kpis.cplDelta ?? 0}
            invertDelta
            icon={<Target size={16} />}
            onClick={() => setKpiDetail({
              title: "Cost Per Lead", icon: <Target size={18} />, currentValue: formatCurrency(cpl, client.currency),
              currentLabel: "Current period", dailyData: [], breakdown: funnel.map((s, i) => ({ name: s.name, value: s.count, formatted: formatNumber(s.count), color: ["#FF6A41", "#3B82F6", "#22C55E", "#F59E0B", "#8B5CF6", "#EC4899"][i % 6] })),
              accentColor: "#FF6A41", formatValue: (v) => formatCurrency(v, client.currency),
            })}
          />
          <KpiCard
            title="CPQL"
            value={formatCurrency(cpql, client.currency)}
            delta={-4.2}
            invertDelta
            icon={<DollarSign size={16} />}
            onClick={() => setKpiDetail({
              title: "Cost Per Qualified Lead", icon: <DollarSign size={18} />, currentValue: formatCurrency(cpql, client.currency),
              currentLabel: "Current period", dailyData: [], breakdown: [],
              accentColor: "#3B82F6", formatValue: (v) => formatCurrency(v, client.currency),
            })}
          />
          <KpiCard
            title="Pipeline Value"
            value={formatCurrency(pipelineValue, client.currency)}
            delta={12.5}
            icon={<TrendingUp size={16} />}
            onClick={() => setKpiDetail({
              title: "Pipeline Value", icon: <TrendingUp size={18} />, currentValue: formatCurrency(pipelineValue, client.currency),
              currentLabel: "Current period", dailyData: [], breakdown: [],
              accentColor: "#22C55E", formatValue: (v) => formatCurrency(v, client.currency),
            })}
          />
          <KpiCard
            title="Lead Velocity Rate"
            value={`${leadVelocityRate.toFixed(1)}%`}
            delta={leadVelocityRate}
            icon={<Zap size={16} />}
            onClick={() => setKpiDetail({
              title: "Lead Velocity Rate", icon: <Zap size={18} />, currentValue: `${leadVelocityRate.toFixed(1)}%`,
              currentLabel: "Current period", dailyData: [], breakdown: [],
              accentColor: "#F59E0B", formatValue: (v) => `${v.toFixed(1)}%`,
            })}
          />
        </div>

        {/* ── Lead Funnel ── */}
        <section className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4">
          <h2 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider">
            Lead Funnel
          </h2>
          <div className="space-y-2">
            {funnel.map((stage, idx) => {
              const widthPct =
                maxCount > 0 ? Math.max((stage.count / maxCount) * 100, 8) : 8;
              const nextStage = funnel[idx + 1];
              return (
                <div key={stage.name}>
                  <div className="flex items-center gap-3">
                    <div className="w-16 sm:w-24 text-[10px] sm:text-xs text-[#94A3B8] text-right flex-shrink-0">
                      {stage.name}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className="h-8 sm:h-10 rounded-lg bg-[#FF6A41]/20 border border-[#FF6A41]/30 flex items-center px-2 sm:px-3 transition-all"
                        style={{ width: `${widthPct}%` }}
                      >
                        <span className="text-xs sm:text-sm font-semibold text-white whitespace-nowrap">
                          {formatNumber(stage.count)}
                        </span>
                      </div>
                    </div>
                  </div>
                  {nextStage && (
                    <div className="flex items-center gap-3 py-0.5">
                      <div className="w-16 sm:w-24" />
                      <div className="text-[10px] text-[#94A3B8]/60 pl-2">
                        {(stage.conversionRate * 100).toFixed(1)}% conversion
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Lead Quality by Campaign ── */}
        <section className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/[0.08]">
            <h2 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider">
              Lead Quality by Campaign
            </h2>
            <p className="text-[11px] text-[#64748B] mt-1">
              Real spend + HubSpot-verified leads by campaign, for the selected date range.
            </p>
          </div>
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm min-w-[680px]">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="text-left p-3 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                    Campaign
                  </th>
                  <th className="text-right p-3 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                    Spend
                  </th>
                  <th className="text-right p-3 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                    Platform Leads
                  </th>
                  <th className="text-right p-3 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                    HS Verified
                  </th>
                  <th className="text-right p-3 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                    CPL
                  </th>
                  {/* TODO(Zack): restore "Qualified %" column once ratio is defined.
                      Candidates: HubSpot verified ÷ platform reported, or SQL ÷ lead
                      (needs lifecyclestage parsing). Hidden for now rather than show
                      an undefined number. */}
                </tr>
              </thead>
              <tbody>
                {campaignQuality.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-[#64748B] text-xs">
                      No campaign data for this date range.
                    </td>
                  </tr>
                ) : (
                  campaignQuality.map((cq) => {
                    const cpl = cq.hubspotConfirmed > 0 ? cq.spend / cq.hubspotConfirmed : 0;
                    return (
                      <tr
                        key={cq.campaignName || cq.campaignId}
                        className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors"
                      >
                        <td className="p-3 font-medium text-white truncate max-w-[280px]">
                          {cq.campaignName || "(unknown)"}
                        </td>
                        <td className="p-3 text-right text-[#94A3B8]">
                          {formatCurrency(cq.spend, client.currency)}
                        </td>
                        <td className="p-3 text-right text-[#94A3B8]">
                          {formatNumber(cq.platformClaimed)}
                        </td>
                        <td className="p-3 text-right font-semibold text-white">
                          {formatNumber(cq.hubspotConfirmed)}
                        </td>
                        <td className="p-3 text-right">
                          <span
                            className={cn(
                              "font-semibold",
                              cpl === 0
                                ? "text-[#64748B]"
                                : cpl <= 40
                                  ? "text-[#22C55E]"
                                  : cpl <= 80
                                    ? "text-amber-400"
                                    : "text-[#EF4444]",
                            )}
                          >
                            {cpl > 0 ? formatCurrency(cpl, client.currency) : "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden p-3 space-y-2">
            {campaignQuality.length === 0 ? (
              <p className="text-center text-[#64748B] text-xs p-4">
                No campaign data for this date range.
              </p>
            ) : (
              campaignQuality.map((cq) => {
                const cpl = cq.hubspotConfirmed > 0 ? cq.spend / cq.hubspotConfirmed : 0;
                return (
                  <div
                    key={cq.campaignName || cq.campaignId}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 space-y-2"
                  >
                    <span className="text-sm font-semibold text-white truncate block">
                      {cq.campaignName || "(unknown)"}
                    </span>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.04]">
                      <MetricCell label="Spend" value={formatCurrency(cq.spend, client.currency)} emphasis />
                      <MetricCell label="HS Verified" value={formatNumber(cq.hubspotConfirmed)} emphasis />
                      <MetricCell label="Platform" value={formatNumber(cq.platformClaimed)} />
                      <MetricCell label="CPL" value={cpl > 0 ? formatCurrency(cpl, client.currency) : "—"} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <KpiDetailModal data={kpiDetail} onClose={closeKpiDetail} />
    </>
  );
}
