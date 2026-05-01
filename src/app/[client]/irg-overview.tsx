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
import { useParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { VenueTabs } from "@/components/layout/venue-tabs";
import { KpiCard } from "@/components/ui/kpi-card";
import { useVenue } from "@/lib/venue-context";
import { useDateRange } from "@/lib/date-range-context";
import { useWindsor } from "@/lib/use-windsor";
import type { WindsorRow } from "@/lib/windsor";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import {
  IRG_BRANDS,
  PURCHASE_VALUE_FIX_DATE,
} from "@/lib/irg-brands";
import {
  getIrgHeadlineKpis,
  getSalesByPlatform,
  getBrandGrid,
  getRocksClubStats,
  getDailyPerfSeries,
} from "@/lib/irg-mock";
import {
  aggregateHeadlineKpis,
  aggregateSalesByPlatform,
  aggregateBrandGrid,
  aggregateDailySeries,
} from "@/lib/irg-live";
import { MetaIcon, GoogleIcon } from "@/components/ui/platform-icons";
import {
  AlertTriangle, Mail, Users, Euro, Ticket, TrendingUp, Music2,
} from "lucide-react";
import {
  ResponsiveContainer, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  ComposedChart, Bar,
} from "recharts";

const ACCENT_GREEN = "#1D9E75";
const ACCENT_GOLD = "#C8A96E";

export default function IrgOverview() {
  const { client: clientSlug } = useParams<{ client: string }>();
  const { activeVenue } = useVenue();
  const { days, preset, dateFrom, dateTo, prevDateFrom, prevDateTo } = useDateRange();
  const customDateProps = preset === "Custom" ? { dateFrom, dateTo } : {};

  // Live Windsor pull. Returns null when the API key isn't configured
  // (`source === "mock"`); we fall back to the mock helpers below so
  // every component still renders.
  const { data: liveData } = useWindsor<WindsorRow[]>({
    clientSlug,
    type: "campaigns",
    days,
    ...customDateProps,
  });
  const { data: prevLiveData } = useWindsor<WindsorRow[]>({
    clientSlug,
    type: "campaigns",
    days,
    dateFrom: prevDateFrom,
    dateTo: prevDateTo,
  });
  const isLive = !!liveData && liveData.length > 0;

  const kpis = useMemo(
    () => (isLive
      ? aggregateHeadlineKpis(liveData!, prevLiveData ?? null, activeVenue) ?? getIrgHeadlineKpis(activeVenue)
      : getIrgHeadlineKpis(activeVenue)),
    [isLive, liveData, prevLiveData, activeVenue],
  );
  const platformRows = useMemo(
    () => (isLive ? aggregateSalesByPlatform(liveData!) : getSalesByPlatform()),
    [isLive, liveData],
  );
  const brandRows = useMemo(
    () => (isLive ? aggregateBrandGrid(liveData!, prevLiveData ?? null) : getBrandGrid()),
    [isLive, liveData, prevLiveData],
  );
  const dailySeries = useMemo(
    () => {
      if (!isLive) return getDailyPerfSeries(14);
      const live = aggregateDailySeries(liveData!);
      return live.length > 0 ? live : getDailyPerfSeries(14);
    },
    [isLive, liveData],
  );

  // Rocks Club still mock — needs HubSpot / GA4 sign-up events that
  // aren't wired yet. Frequency alerts removed from the overview at
  // Zack's request (will live elsewhere when the creatives feed lands).
  const rocks = useMemo(() => getRocksClubStats(), []);

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

        {/* Sales by platform */}
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

        {/* Brand performance — OnSocial-managed brands grouped together,
            Hotel split into its own clearly-labelled section beneath
            (Up Hotel runs that, it's Google-only, never combined with
            OnSocial totals). */}
        <div className="space-y-2">
          <SectionLabel>Brand performance — OnSocial managed</SectionLabel>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            {brandRows.filter((r) => r.brand !== "IR_HOTEL").map((r) => (
              <BrandCard key={r.brand} row={r} />
            ))}
          </div>
        </div>

        {brandRows.find((r) => r.brand === "IR_HOTEL") && (
          <div className="space-y-2">
            <h2 className="text-[10px] font-semibold uppercase tracking-wider flex items-center gap-2 text-[#94A3B8]">
              <Users size={11} />
              Ibiza Rocks Hotel — Up Hotel / Google · read-only
            </h2>
            <HotelCard row={brandRows.find((r) => r.brand === "IR_HOTEL")!} />
          </div>
        )}

        {/* Brand performance — horizontal bar chart so the eye reads
            spend / revenue / ROAS across brands at a glance. Sits
            above the daily chart since brand mix is the higher-level
            comparison; daily trend is the drill-down. */}
        <BrandComparisonChart rows={brandRows} />

        {/* Bottom row: daily chart + Rocks Club */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          {/* Daily performance chart — composed:
              Bars (left axis €)   = Spend
              Line (right axis €)  = Events Revenue
              Toggle adds CPA / Sales line variants for drill-down. */}
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-3">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                  Daily performance · 14 days
                </h2>
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  Bars = spend · Line = {chartMetric === "spend" ? "events revenue" : chartMetric === "sales" ? "tickets sold" : "CPA"}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[10px] text-[#94A3B8]">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: ACCENT_GOLD, opacity: 0.5 }} />
                  Spend
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-[#94A3B8]">
                  <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: ACCENT_GREEN }} />
                  {chartMetric === "spend" ? "Revenue" : chartMetric === "sales" ? "Sales" : "CPA"}
                </span>
                <div className="inline-flex items-center bg-white/[0.04] border border-white/[0.06] rounded-lg p-0.5 text-[10px] font-semibold uppercase tracking-wider">
                  {([
                    { id: "spend", label: "Revenue" },
                    { id: "sales", label: "Sales" },
                    { id: "cpa", label: "CPA" },
                  ] as const).map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setChartMetric(m.id)}
                      className={cn(
                        "px-2.5 py-1 rounded-md transition-colors",
                        chartMetric === m.id ? "bg-white/[0.08] text-white" : "text-[#94A3B8] hover:text-white",
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dailySeries} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#94A3B8", fontSize: 9 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: string) => v.slice(5)}
                  />
                  {/* Left axis = spend in €. Always currency. */}
                  <YAxis
                    yAxisId="left"
                    tick={{ fill: "#94A3B8", fontSize: 9 }}
                    tickLine={false}
                    axisLine={false}
                    width={52}
                    tickFormatter={(v: number) =>
                      `€${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}`
                    }
                  />
                  {/* Right axis units depend on which line is shown. */}
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fill: "#94A3B8", fontSize: 9 }}
                    tickLine={false}
                    axisLine={false}
                    width={chartMetric === "sales" ? 36 : 48}
                    allowDecimals={chartMetric !== "sales"}
                    tickFormatter={(v: number) =>
                      chartMetric === "sales"
                        ? formatNumber(v)
                        : `€${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}`
                    }
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    contentStyle={{
                      backgroundColor: "#1A1A2E",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                      fontSize: 11,
                      padding: "8px 10px",
                    }}
                    labelStyle={{ color: "#94A3B8", fontWeight: 600, marginBottom: 4 }}
                    formatter={(val: unknown, name: unknown) => {
                      const n = Number(val ?? 0);
                      if (name === "spend") return [formatCurrency(n, "EUR"), "Spend"];
                      if (name === "sales") return [formatNumber(n), "Sales"];
                      if (name === "cpa") return [formatCurrency(n, "EUR"), "CPA"];
                      if (name === "revenue") return [formatCurrency(n, "EUR"), "Revenue"];
                      return [String(val), String(name)];
                    }}
                  />
                  {/* Spend bars are always shown — base layer that
                      the secondary line is read against. */}
                  <Bar
                    yAxisId="left"
                    dataKey="spend"
                    fill={ACCENT_GOLD}
                    fillOpacity={0.5}
                    radius={[3, 3, 0, 0]}
                    name="spend"
                    maxBarSize={28}
                  />
                  {/* Secondary series swaps based on the toggle. */}
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey={chartMetric === "spend" ? "revenue" : chartMetric}
                    stroke={ACCENT_GREEN}
                    strokeWidth={2.25}
                    dot={{ r: 2.5, fill: ACCENT_GREEN, stroke: "#0A0A0F", strokeWidth: 1 }}
                    activeDot={{ r: 4, fill: ACCENT_GREEN, stroke: "#0A0A0F", strokeWidth: 2 }}
                    name={chartMetric === "spend" ? "revenue" : chartMetric}
                    isAnimationActive={false}
                  />
                </ComposedChart>
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

/**
 * Horizontal comparison chart — one row per OnSocial brand showing
 * three bars (spend / revenue / ROAS×1000 to share the same scale).
 * Hotel is excluded because OnSocial has no spend there. Each bar
 * picks up the brand's accent colour so the chart reads as an
 * extension of the brand cards above it.
 */
function BrandComparisonChart({
  rows,
}: {
  rows: ReturnType<typeof getBrandGrid>;
}) {
  const data = useMemo(() => {
    return rows
      .filter((r) => r.brand !== "IR_HOTEL" && r.spend > 0)
      .map((r) => ({
        brand: IRG_BRANDS[r.brand].shortLabel,
        color: IRG_BRANDS[r.brand].color,
        spend: r.spend,
        revenue: r.eventsRevenue,
        roas: r.roas ?? 0,
      }));
  }, [rows]);

  if (data.length === 0) return null;

  return (
    <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-3">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h2 className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
          Brand comparison · spend vs revenue
        </h2>
        <p className="text-[11px] text-[#64748B]">
          ROAS shown inline on each row
        </p>
      </div>

      <div className="space-y-3">
        {data.map((d) => {
          const maxRevenue = Math.max(...data.map((x) => x.revenue));
          const maxSpend = Math.max(...data.map((x) => x.spend));
          // Bars share a common axis so eye-comparing across brands
          // is meaningful. Use the global max so a tiny brand isn't
          // visually inflated.
          const widthBasis = Math.max(maxRevenue, maxSpend, 1);
          const spendPct = (d.spend / widthBasis) * 100;
          const revenuePct = (d.revenue / widthBasis) * 100;
          return (
            <div key={d.brand}>
              <div className="flex items-baseline justify-between text-[11px] mb-1.5">
                <span className="font-semibold text-white">{d.brand}</span>
                <span className="text-[#94A3B8]">
                  ROAS:{" "}
                  <span
                    className="font-semibold tabular-nums"
                    style={{ color: d.roas >= 10 ? ACCENT_GREEN : "#f0ede8" }}
                  >
                    {d.roas.toFixed(1)}x
                  </span>
                </span>
              </div>
              <div className="space-y-1.5">
                {/* Spend bar — muted, narrower */}
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-[#64748B] w-14">Spend</span>
                  <div className="flex-1 h-2 rounded-full bg-white/[0.04] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${spendPct}%`,
                        backgroundColor: d.color,
                        opacity: 0.45,
                      }}
                    />
                  </div>
                  <span className="text-[10px] tabular-nums text-[#94A3B8] w-16 text-right">
                    {formatCurrency(d.spend, "EUR")}
                  </span>
                </div>
                {/* Revenue bar — full opacity, the headline number */}
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-[#64748B] w-14">Revenue</span>
                  <div className="flex-1 h-2 rounded-full bg-white/[0.04] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${revenuePct}%`,
                        backgroundColor: d.color,
                      }}
                    />
                  </div>
                  <span className="text-[10px] tabular-nums text-white w-16 text-right">
                    {formatCurrency(d.revenue, "EUR")}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
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

/**
 * Hotel card — same layout as a BrandCard so the eye reads the data
 * the same way, but on a muted base (lower-opacity bg + dashed border)
 * and a single Google-only badge to make it unambiguously "different
 * provenance". Spend / ROAS deliberately omitted because OnSocial
 * doesn't run paid here.
 */
function HotelCard({ row }: { row: ReturnType<typeof getBrandGrid>[number] }) {
  const brand = IRG_BRANDS.IR_HOTEL;
  return (
    <div
      className="bg-white/[0.02] border border-dashed border-white/[0.10] rounded-xl sm:rounded-2xl overflow-hidden"
    >
      <div className="h-[3px] w-full" style={{ backgroundColor: brand.color, opacity: 0.5 }} />
      <div className="p-4 sm:p-5 space-y-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-[#94A3B8]">{brand.label}</h3>
            <p className="text-[10px] text-[#64748B] mt-0.5">
              Account: <span className="text-[#94A3B8]">{brand.accountLabel}</span>
              {" · "}
              <span className="text-[#94A3B8]">€{(brand.budget / 1000).toFixed(0)}k annual budget</span>
            </p>
            <p className="text-[10px] text-[#64748B] italic mt-1">
              Google-only. Up Hotel manages these campaigns. Read-only context.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400/80">
            <GoogleIcon size={10} /> Google only
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <BrandStat
            label="Hotel revenue"
            value={formatCurrency(row.hotelRevenue, "EUR")}
            delta={row.eventsRevenueDeltaPct}
            deltaSuffix="%"
          />
          <BrandStat
            label="Bookings"
            value={formatNumber(row.tickets)}
            delta={row.ticketsDelta}
            deltaSuffix=""
          />
          <BrandStat label="Spend" value="—" />
        </div>

        <p className="text-[10px] text-[#64748B] pt-2 border-t border-white/[0.04]">
          Hotel ROAS / CPA not tracked in OnSocial — Up Hotel reports on these
          internally. Numbers above are revenue and bookings only.
        </p>
      </div>
    </div>
  );
}
