"use client";

/**
 * IRG Overview tab — uses the same UX/UI conventions as Ministry,
 * IRG-specific business logic on top.
 *
 * Layout (top to bottom):
 *   1. Brand pill selector
 *   2. Pre-28-April caveat banner
 *   3. KPI strip — 5 cards via the shared <KpiCard> component
 *   4. Platform spend sub-row (Meta / Google / TikTok, never summed)
 *   5. Frequency alerts strip (only when alerts exist)
 *   6. Sales-by-platform table
 *   7. Brand performance grid (4 brand cards) + Hotel read-only row
 *   8. Daily perf chart (toggle Spend / Sales / CPA) + Rocks Club widget
 *
 * Cards / sections / typography all use the existing dashboard
 * primitives (KpiCard, bg-white/[0.04], text-[#94A3B8] section labels)
 * so this matches Ministry's visual language.
 */

import { useMemo, useState } from "react";
import { Header } from "@/components/layout/header";
import { VenueTabs } from "@/components/layout/venue-tabs";
import { KpiCard } from "@/components/ui/kpi-card";
import { useVenue } from "@/lib/venue-context";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import {
  IRG_BRANDS,
  PURCHASE_VALUE_FIX_DATE,
} from "@/lib/irg-brands";
import {
  getIrgHeadlineKpis,
  getSalesByPlatform,
  getBrandGrid,
  getFrequencyAlerts,
  getRocksClubStats,
  getDailyPerfSeries,
} from "@/lib/irg-mock";
import { MetaIcon, GoogleIcon } from "@/components/ui/platform-icons";
import {
  AlertTriangle, Zap, Mail, Users, Euro, Ticket, TrendingUp, Music2,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

const ACCENT_GREEN = "#1D9E75";
const ACCENT_GOLD = "#C8A96E";

export default function IrgOverview() {
  const { activeVenue } = useVenue();
  const kpis = useMemo(() => getIrgHeadlineKpis(activeVenue), [activeVenue]);
  const platformRows = useMemo(() => getSalesByPlatform(), []);
  const brandRows = useMemo(() => getBrandGrid(), []);
  const alerts = useMemo(() => getFrequencyAlerts(), []);
  const rocks = useMemo(() => getRocksClubStats(), []);
  const dailySeries = useMemo(() => getDailyPerfSeries(14), []);

  const [chartMetric, setChartMetric] = useState<"spend" | "sales" | "cpa">("spend");

  return (
    <>
      <Header title="Overview" filterRow={<VenueTabs />} />

      <div className="flex-1 p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-5 overflow-y-auto">
        {/* Pre-28-April caveat — applies to any revenue card downstream */}
        <PreFixDateNote fixedOn={PURCHASE_VALUE_FIX_DATE} />

        {/* 1. KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <KpiCard
            title="Total Spend"
            value={formatCurrency(kpis.totalSpend, "EUR")}
            delta={kpis.totalSpendDeltaPct}
            icon={<Euro size={12} />}
            subLabel="OnSocial managed · vs last week"
            accentColor={ACCENT_GREEN}
          />
          <KpiCard
            title="Events Revenue"
            value={formatCurrency(kpis.eventsRevenue, "EUR")}
            delta={kpis.eventsRevenueDeltaPct}
            icon={<Ticket size={12} />}
            subLabel="Four Venues confirmed"
            accentColor={ACCENT_GREEN}
          />
          <KpiCard
            title="Hotel Revenue"
            value={formatCurrency(kpis.hotelRevenue, "EUR")}
            delta={kpis.hotelRevenueDeltaPct}
            icon={<Users size={12} />}
            subLabel="Up Hotel / Google · context only"
            accentColor="#94A3B8"
          />
          <KpiCard
            title="Overall ROAS"
            value={`${kpis.overallRoas.toFixed(1)}x`}
            delta={Number(((kpis.overallRoasDelta / kpis.overallRoas) * 100).toFixed(1))}
            icon={<TrendingUp size={12} />}
            subLabel="Total revenue ÷ OnSocial spend"
            accentColor={ACCENT_GREEN}
          />
          <KpiCard
            title="Tickets Sold"
            value={formatNumber(kpis.ticketsSold)}
            delta={Number(((kpis.ticketsDelta / kpis.ticketsSold) * 100).toFixed(1))}
            icon={<Ticket size={12} />}
            subLabel="Four Venues confirmed"
            accentColor={ACCENT_GOLD}
          />
        </div>

        {/* 2. Platform spend (never summed) */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <PlatformCard label="Meta" value={formatCurrency(kpis.metaSpend, "EUR")} sub="OnSocial · live" icon={<MetaIcon size={14} />} />
          <PlatformCard label="Google" value={formatCurrency(kpis.googleSpend, "EUR")} sub="OnSocial · live" icon={<GoogleIcon size={14} />} />
          <PlatformCard
            label="TikTok"
            value="—"
            sub="Pre-launch · tracking blocker"
            icon={<Music2 size={14} />}
            preLaunch
          />
        </div>

        {/* 3. Frequency alerts */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            <SectionLabel>Frequency alerts</SectionLabel>
            <div className="space-y-2">
              {alerts.map((a) => <FrequencyAlertRow key={a.id} alert={a} />)}
            </div>
          </div>
        )}

        {/* 4. Sales by platform */}
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/[0.06]">
            <h2 className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
              Sales by platform
            </h2>
            <p className="text-[11px] text-[#64748B] mt-1">
              Source of truth: GA4 (Four Venues confirmed). &ldquo;Sales&rdquo; = ticket / day-pass / VIP purchases. Never combine across rows.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-white/[0.02] text-[10px] uppercase tracking-wider text-[#94A3B8]">
                <tr>
                  <th className="text-left p-3">Platform</th>
                  <th className="text-right p-3">Spend</th>
                  <th className="text-right p-3">Sales</th>
                  <th className="text-right p-3">Revenue</th>
                  <th className="text-right p-3">ROAS</th>
                  <th className="text-right p-3">CPA</th>
                  <th className="text-right p-3">Target CPA</th>
                </tr>
              </thead>
              <tbody>
                {platformRows.map((r) => (
                  <tr key={r.platform} className="border-t border-white/[0.04]">
                    <td className="p-3 text-white font-medium">{r.platform}</td>
                    <td className="p-3 text-right tabular-nums">
                      {r.spend !== null ? formatCurrency(r.spend, "EUR") : "—"}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {r.sales !== null ? formatNumber(r.sales) : "—"}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {r.revenue !== null ? formatCurrency(r.revenue, "EUR") : (
                        <span className="text-[#64748B]">{r.preLaunch ? "Pre-launch" : "—"}</span>
                      )}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {r.roas !== null ? `${r.roas.toFixed(2)}x` : "—"}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {r.cpa !== null ? formatCurrency(r.cpa, "EUR") : "—"}
                    </td>
                    <td className="p-3 text-right">
                      <NotProvidedPill />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 5. Brand performance grid */}
        <div className="space-y-2">
          <SectionLabel>Brand performance</SectionLabel>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            {brandRows.filter((r) => r.brand !== "IR_HOTEL").map((r) => (
              <BrandCard key={r.brand} row={r} />
            ))}
          </div>
          {/* Hotel — read-only row beneath the grid */}
          {brandRows.find((r) => r.brand === "IR_HOTEL") && (
            <HotelReadOnlyRow row={brandRows.find((r) => r.brand === "IR_HOTEL")!} />
          )}
        </div>

        {/* 6. Bottom row: chart + Rocks Club */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          {/* Daily performance chart */}
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                Daily performance · 14 days
              </h2>
              <div className="inline-flex items-center bg-white/[0.04] border border-white/[0.06] rounded-lg p-0.5 text-[10px] font-semibold uppercase tracking-wider">
                {(["spend", "sales", "cpa"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setChartMetric(m)}
                    className={cn(
                      "px-2.5 py-1 rounded-md transition-colors",
                      chartMetric === m ? "bg-white/[0.08] text-white" : "text-[#94A3B8] hover:text-white",
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailySeries} margin={{ top: 8, right: 16, bottom: 0, left: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#94A3B8", fontSize: 9 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: string) => v.slice(5)}
                  />
                  <YAxis
                    tick={{ fill: "#94A3B8", fontSize: 9 }}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tickFormatter={(v: number) =>
                      chartMetric === "sales"
                        ? formatNumber(v)
                        : `€${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}`
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1A1A2E",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                      fontSize: 11,
                    }}
                    labelStyle={{ color: "#94A3B8" }}
                    formatter={(val: unknown) => {
                      const n = Number(val ?? 0);
                      if (chartMetric === "sales") return [formatNumber(n), "Sales"];
                      if (chartMetric === "cpa") return [formatCurrency(n, "EUR"), "CPA"];
                      return [formatCurrency(n, "EUR"), "Spend"];
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey={chartMetric}
                    stroke={ACCENT_GREEN}
                    strokeWidth={2.25}
                    dot={{ r: 2.5, fill: ACCENT_GREEN, stroke: "#0A0A0F", strokeWidth: 1 }}
                    activeDot={{ r: 4, fill: ACCENT_GREEN, stroke: "#0A0A0F", strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Rocks Club widget — gold-tinted variant of the standard card */}
          <div
            className="rounded-xl sm:rounded-2xl border bg-white/[0.04] p-4 sm:p-6 flex flex-col gap-3"
            style={{ borderColor: "rgba(200,169,110,0.25)" }}
          >
            <div className="flex items-center gap-2">
              <Mail size={13} style={{ color: ACCENT_GOLD }} />
              <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: ACCENT_GOLD }}>
                Rocks Club sign-ups
              </span>
            </div>
            <div>
              <p className="text-[28px] font-bold tabular-nums text-white">
                {formatNumber(rocks.total)}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: ACCENT_GREEN }}>
                ▲ {formatNumber(rocks.weekDelta)} this week
              </p>
            </div>
            <p className="text-[11px] text-[#94A3B8] leading-relaxed">
              Email captures feeding hotel funnel. List size 80–100k.
              March email campaign drove £40k hotel revenue.
            </p>
            <div className="space-y-1.5 pt-2 border-t border-white/[0.04]">
              {rocks.funnel.map((step, i) => {
                const pct = i === 0 ? 100 : (step.count / rocks.funnel[0].count) * 100;
                return (
                  <div key={step.stage}>
                    <div className="flex items-baseline justify-between text-[10px] mb-0.5">
                      <span className="text-[#94A3B8]">{step.stage}</span>
                      <span className="text-white tabular-nums font-semibold">
                        {formatNumber(step.count)}
                        {i > 0 && <span className="text-[#64748B] ml-1 font-normal">({pct.toFixed(0)}%)</span>}
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: ACCENT_GOLD, opacity: 0.6 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Sub-components ── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
      {children}
    </h2>
  );
}

function NotProvidedPill() {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border"
      style={{
        backgroundColor: "rgba(200,169,110,0.1)",
        borderColor: "rgba(200,169,110,0.2)",
        color: ACCENT_GOLD,
      }}
    >
      Not provided
    </span>
  );
}

function PreFixDateNote({ fixedOn }: { fixedOn: string }) {
  const fmt = new Date(fixedOn).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return (
    <div
      className="bg-white/[0.04] border rounded-xl sm:rounded-2xl px-4 py-3 flex items-start gap-2.5"
      style={{ borderColor: "rgba(200,169,110,0.18)" }}
    >
      <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" style={{ color: ACCENT_GOLD }} />
      <p className="text-[11px] text-[#94A3B8] leading-relaxed">
        Purchase value tracking fixed by Tristan ({fmt}). Pre-{fmt} data may show
        deposit values not full purchase prices for VIP bookings via Four Venues.
      </p>
    </div>
  );
}

function PlatformCard({
  label, value, sub, icon, preLaunch,
}: {
  label: string; value: string; sub: string; icon: React.ReactNode; preLaunch?: boolean;
}) {
  return (
    <div className={cn(
      "bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl p-3 sm:p-4",
      preLaunch && "opacity-65",
    )}>
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-semibold text-[#94A3B8]">{label}</span>
      </div>
      <p className="text-xl sm:text-2xl font-bold tabular-nums text-white">{value}</p>
      <p className={cn("text-[10px] mt-1", preLaunch ? "text-[#94A3B8]/60" : "text-[#94A3B8]")}>{sub}</p>
    </div>
  );
}

function FrequencyAlertRow({ alert }: { alert: ReturnType<typeof getFrequencyAlerts>[number] }) {
  const isRed = alert.severity === "red";
  const accent = isRed ? "#EF4444" : "#F59E0B";
  return (
    <div
      className="bg-white/[0.04] border rounded-xl px-3 py-2 flex items-center gap-3 flex-wrap"
      style={{ borderColor: `${accent}40` }}
    >
      {isRed ? (
        <AlertTriangle size={13} style={{ color: accent }} />
      ) : (
        <Zap size={13} style={{ color: accent }} />
      )}
      <span className="text-[11px] font-semibold" style={{ color: accent }}>
        {alert.brand}
      </span>
      <span className="text-[11px] text-[#94A3B8]">— &ldquo;{alert.campaign}&rdquo;</span>
      <span className="text-[11px] text-[#64748B]">
        {alert.platform} {alert.window} frequency {alert.frequency.toFixed(1)}x
      </span>
      <span className="ml-auto text-[10px] uppercase tracking-wider font-semibold" style={{ color: accent }}>
        {alert.recommendation}
      </span>
    </div>
  );
}

function BrandCard({ row }: { row: ReturnType<typeof getBrandGrid>[number] }) {
  const brand = IRG_BRANDS[row.brand];
  if (!brand) return null;
  return (
    <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl overflow-hidden">
      <div className="h-[3px] w-full" style={{ backgroundColor: brand.color }} />
      <div className="p-4 sm:p-5 space-y-3">
        <div>
          <h3 className="text-sm font-bold text-white">{brand.label}</h3>
          <p className="text-[10px] text-[#94A3B8] mt-0.5">
            Account: <span className="text-white/80">{brand.accountLabel}</span>
            {" · "}
            <span className="text-white/80">€{(brand.budget / 1000).toFixed(0)}k annual</span>
          </p>
          {brand.accountNote && (
            <p className="text-[10px] text-[#64748B] italic mt-1">{brand.accountNote}</p>
          )}
        </div>

        <div className="grid grid-cols-4 gap-3">
          <BrandStat label="Spend" value={formatCurrency(row.spend, "EUR")} delta={row.spendDeltaPct} deltaSuffix="%" />
          <BrandStat label="Revenue" value={formatCurrency(row.eventsRevenue, "EUR")} delta={row.eventsRevenueDeltaPct} deltaSuffix="%" />
          <BrandStat
            label="ROAS"
            value={row.roas !== null ? `${row.roas.toFixed(1)}x` : "—"}
            delta={row.roasDelta}
            deltaSuffix="x"
            highlight={row.roas !== null && row.roas >= 10}
          />
          <BrandStat
            label="Tickets"
            value={formatNumber(row.tickets)}
            delta={row.ticketsDelta}
            deltaSuffix=""
          />
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.04]">
          <span className="text-[11px] text-[#94A3B8]">
            CPA (actual):{" "}
            <span className="text-white font-medium">
              {row.cpaLabel ?? (row.cpa !== null ? formatCurrency(row.cpa, "EUR") : "—")}
            </span>
          </span>
          <NotProvidedPill />
        </div>
      </div>
    </div>
  );
}

function BrandStat({
  label, value, delta, deltaSuffix = "", highlight,
}: {
  label: string; value: string; delta?: number | null; deltaSuffix?: string; highlight?: boolean;
}) {
  const positive = delta !== null && delta !== undefined && delta >= 0;
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-[#94A3B8]">{label}</p>
      <p className={cn(
        "text-sm font-semibold tabular-nums mt-0.5",
        highlight ? "text-emerald-400" : "text-white",
      )}>
        {value}
      </p>
      {delta !== null && delta !== undefined && (
        <p className={cn("text-[10px] tabular-nums mt-0.5", positive ? "text-emerald-400" : "text-red-400")}>
          {positive ? "▲" : "▼"} {Math.abs(delta).toFixed(delta % 1 === 0 ? 0 : 1)}{deltaSuffix}
        </p>
      )}
    </div>
  );
}

function HotelReadOnlyRow({ row }: { row: ReturnType<typeof getBrandGrid>[number] }) {
  return (
    <div
      className="bg-white/[0.02] border border-white/[0.04] rounded-xl px-4 py-3 flex items-center justify-between flex-wrap gap-3"
    >
      <div className="flex items-center gap-3 flex-wrap">
        <Users size={13} className="text-[#64748B]" />
        <span className="text-[10px] uppercase tracking-wider font-semibold text-[#64748B]">
          Ibiza Rocks Hotel — read only
        </span>
        <span className="text-[11px] text-[#64748B] italic">
          Up Hotel / Google. Not OnSocial campaigns.
        </span>
      </div>
      <div className="flex items-center gap-4 text-[11px] text-[#64748B]">
        <span>Hotel revenue: <span className="text-[#94A3B8] font-medium">{formatCurrency(row.hotelRevenue, "EUR")}</span></span>
        <span>Bookings: <span className="text-[#94A3B8] font-medium">{formatNumber(row.tickets)}</span></span>
        {row.ticketsDelta !== null && (
          <span className={row.ticketsDelta >= 0 ? "text-emerald-400" : "text-red-400"}>
            {row.ticketsDelta >= 0 ? "▲" : "▼"} {Math.abs(row.ticketsDelta)} this week
          </span>
        )}
      </div>
    </div>
  );
}
