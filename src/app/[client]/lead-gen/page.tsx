"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { KpiCard } from "@/components/ui/kpi-card";
import { KpiDetailModal, type KpiDetailData } from "@/components/ui/kpi-detail-modal";
import { getLeadFunnel, getClientKPIs, getClientCampaigns } from "@/lib/mock-data";
import { useClient } from "@/lib/client-context";
import { formatCurrency, formatNumber, cn } from "@/lib/utils";
import { Target, DollarSign, TrendingUp, Zap } from "lucide-react";

/* ── Page ── */

export default function LeadGenPage() {
  const { client: clientSlug } = useParams<{ client: string }>();
  const ctx = useClient();
  const client = ctx?.clientConfig;
  const kpis = getClientKPIs(clientSlug, client ?? undefined);
  const funnel = getLeadFunnel(clientSlug);
  const campaigns = getClientCampaigns(clientSlug, undefined, client ?? undefined);

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

  // Campaign-level lead quality
  const campaignTopLevel = campaigns.filter((c) => c.level === "campaign");
  const campaignQuality = campaignTopLevel.map((c) => {
    const qualPct = c.conversions > 0 ? Math.min(Math.random() * 0.4 + 0.3, 1) : 0;
    return { name: c.name, conversions: c.conversions, qualifiedPct: qualPct };
  });

  // Funnel max count for width calculation
  const maxCount = funnel.length > 0 ? funnel[0].count : 1;

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
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="text-left p-3 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                    Campaign
                  </th>
                  <th className="text-right p-3 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                    Conversions
                  </th>
                  <th className="text-right p-3 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                    Qualified %
                  </th>
                </tr>
              </thead>
              <tbody>
                {campaignQuality.map((cq) => (
                  <tr
                    key={cq.name}
                    className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="p-3 font-medium text-white truncate max-w-[300px]">
                      {cq.name}
                    </td>
                    <td className="p-3 text-right text-[#94A3B8]">
                      {cq.conversions}
                    </td>
                    <td className="p-3 text-right">
                      <span
                        className={cn(
                          "font-semibold",
                          cq.qualifiedPct >= 0.5
                            ? "text-[#22C55E]"
                            : cq.qualifiedPct >= 0.35
                              ? "text-amber-400"
                              : "text-[#EF4444]",
                        )}
                      >
                        {(cq.qualifiedPct * 100).toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <KpiDetailModal data={kpiDetail} onClose={closeKpiDetail} />
    </>
  );
}
