import { Header } from "@/components/layout/header";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  getAgencyKPIs,
  getAgencyAlerts,
  getClientKPIs,
} from "@/lib/mock-data";
import {
  formatCurrency,
  formatROAS,
  getPacingColor,
  getPacingTextColor,
  cn,
  getEffectiveMonthlyBudget,
} from "@/lib/utils";
import type { Alert, Client } from "@/lib/types";
import { getAllClients } from "@/lib/client-store";
import Link from "next/link";
import {
  DollarSign,
  TrendingUp,
  Users,
  AlertTriangle,
  CalendarClock,
} from "lucide-react";

/* ── Helpers ── */

function severityBadge(severity: Alert["severity"]) {
  const styles = {
    critical: "bg-[#EF4444]/20 text-[#EF4444]",
    warning: "bg-amber-500/20 text-amber-400",
    info: "bg-blue-500/20 text-blue-400",
  };
  return (
    <span
      className={cn(
        "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider",
        styles[severity],
      )}
    >
      {severity}
    </span>
  );
}

/* ── Page ── */

export default async function MasterDashboardPage() {
  const allClients = await getAllClients();
  const agencyKPIs = getAgencyKPIs(allClients);
  const alerts = getAgencyAlerts();

  // Per-client data for the health grid
  const clientData = allClients.map((c: Client) => {
    const kpis = getClientKPIs(c.slug, c);
    const effectiveBudget = getEffectiveMonthlyBudget(c);
    const pacing =
      effectiveBudget > 0
        ? Math.round((kpis.spend / effectiveBudget) * 100)
        : 0;
    return { client: c, kpis, pacing };
  });

  // Calculate Meta vs Google split for the stacked bar
  const totalMeta = allClients.reduce(
    (sum: number, c: Client) =>
      sum + getEffectiveMonthlyBudget(c) * c.metaAllocation,
    0,
  );
  const totalGoogle = allClients.reduce(
    (sum: number, c: Client) =>
      sum + getEffectiveMonthlyBudget(c) * c.googleAllocation,
    0,
  );
  const totalBudget = totalMeta + totalGoogle;
  const metaPct = totalBudget > 0 ? (totalMeta / totalBudget) * 100 : 50;
  const googlePct = totalBudget > 0 ? (totalGoogle / totalBudget) * 100 : 50;

  return (
    <>
      <Header title="Agency Dashboard" />

      <div className="flex-1 p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6 overflow-y-auto">
        {/* ── KPI Strip ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <KpiCard
            title="Total Spend"
            value={formatCurrency(agencyKPIs.totalSpend)}
            delta={5.2}
            icon={<DollarSign size={16} />}
          />
          <KpiCard
            title="Blended MER"
            value={formatROAS(agencyKPIs.blendedMER)}
            delta={3.1}
            icon={<TrendingUp size={16} />}
          />
          <KpiCard
            title="Active Clients"
            value={String(agencyKPIs.activeClients)}
            delta={0}
            icon={<Users size={16} />}
          />
          <KpiCard
            title="Fatigued Creatives"
            value={String(agencyKPIs.fatiguedCreatives)}
            delta={-8.3}
            icon={<AlertTriangle size={16} />}
          />
          <KpiCard
            title="Next Renewal"
            value={agencyKPIs.nextRenewal}
            delta={0}
            icon={<CalendarClock size={16} />}
          />
        </div>

        {/* ── Client Health Grid ── */}
        <section>
          <h2 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider mb-4">
            Client Health
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {clientData.map(({ client, kpis, pacing }) => (
              <Link key={client.id} href={`/${client.slug}`}>
                <div className="glass-card glass-card-hover rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-3 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-white">{client.name}</h3>
                    <span className="text-xs text-[#94A3B8] capitalize">
                      {client.type.replace("_", " ")}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-[#94A3B8] text-xs">Spend</span>
                      <p className="font-semibold">
                        {formatCurrency(kpis.spend, client.currency)}
                      </p>
                    </div>
                    <div>
                      <span className="text-[#94A3B8] text-xs">
                        {client.type === "lead_gen" ? "CPL" : "ROAS"}
                      </span>
                      <p className="font-semibold">
                        {client.type === "lead_gen"
                          ? kpis.cpl !== undefined
                            ? formatCurrency(kpis.cpl, client.currency)
                            : "N/A"
                          : formatROAS(kpis.roas)}
                      </p>
                    </div>
                  </div>

                  {/* Pacing bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#94A3B8]">Pacing</span>
                      <span className={getPacingTextColor(pacing)}>
                        {pacing}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          getPacingColor(pacing),
                        )}
                        style={{ width: `${Math.min(pacing, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5">
          {/* ── Agency Spend Chart ── */}
          <section className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4">
            <h2 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider">
              Agency Spend Split
            </h2>
            <div className="space-y-3">
              {/* Labels */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-blue-500" />
                  <span className="text-[#94A3B8]">Meta</span>
                </div>
                <span className="font-semibold">
                  {formatCurrency(totalMeta)} ({metaPct.toFixed(0)}%)
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                  <span className="text-[#94A3B8]">Google</span>
                </div>
                <span className="font-semibold">
                  {formatCurrency(totalGoogle)} ({googlePct.toFixed(0)}%)
                </span>
              </div>
              {/* Stacked bar */}
              <div className="h-8 rounded-lg overflow-hidden flex">
                <div
                  className="bg-blue-500 h-full transition-all"
                  style={{ width: `${metaPct}%` }}
                />
                <div
                  className="bg-emerald-500 h-full transition-all"
                  style={{ width: `${googlePct}%` }}
                />
              </div>
              {/* Per-client breakdown */}
              <div className="space-y-2 pt-2">
                {allClients.map((c: Client) => {
                  const effective = getEffectiveMonthlyBudget(c);
                  const cMeta = effective * c.metaAllocation;
                  const cGoogle = effective * c.googleAllocation;
                  const cTotal = cMeta + cGoogle;
                  const cMetaPct = cTotal > 0 ? (cMeta / cTotal) * 100 : 50;
                  return (
                    <div key={c.id} className="space-y-1">
                      <div className="flex justify-between text-xs text-[#94A3B8]">
                        <span>{c.name}</span>
                        <span>{formatCurrency(cTotal, c.currency)}</span>
                      </div>
                      <div className="h-3 rounded-md overflow-hidden flex">
                        <div
                          className="bg-blue-500/80 h-full"
                          style={{ width: `${cMetaPct}%` }}
                        />
                        <div
                          className="bg-emerald-500/80 h-full"
                          style={{ width: `${100 - cMetaPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ── Active Alerts Panel ── */}
          <section className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4">
            <h2 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider">
              Active Alerts
            </h2>
            <div className="space-y-3 max-h-[200px] sm:max-h-[280px] lg:max-h-[400px] overflow-y-auto pr-1">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 p-2.5 sm:p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]"
                >
                  <div className="pt-0.5">{severityBadge(alert.severity)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white leading-snug">
                      {alert.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-[#94A3B8]">
                        {alert.clientName}
                      </span>
                      <span className="text-[10px] text-[#94A3B8]/50">
                        {new Date(alert.timestamp).toLocaleDateString("en-GB")}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {alerts.length === 0 && (
                <p className="text-sm text-[#94A3B8] text-center py-8">
                  No active alerts
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
