"use client";

/**
 * IRG Overview tab — rebuilt to match the 29 April 2026 brief.
 *
 * Page layout (top to bottom):
 *   1. Brand pill selector (All / IR Events / 528 / Pikes / Pool Club)
 *   2. KPI row — 5 cards
 *        Total Spend · Events Revenue · Hotel Revenue · Overall ROAS · Tickets Sold
 *   3. Platform Spend sub-row — Meta / Google / TikTok (never summed)
 *   4. Frequency alert strip (only when alerts exist)
 *   5. Sales-by-platform table
 *   6. Brand performance grid (4 cards) + Hotel read-only row beneath
 *   7. Bottom row: Daily perf chart (left) + Rocks Club widget (right)
 *
 * Mock data throughout via `irg-mock.ts` so every component renders.
 *
 * Hotel data is read-only context. It's NEVER attributed to OnSocial
 * campaigns and is rendered with muted styling.
 */

import { useMemo, useState } from "react";
import { Header } from "@/components/layout/header";
import { VenueTabs } from "@/components/layout/venue-tabs";
import { useVenue } from "@/lib/venue-context";
import { cn } from "@/lib/utils";
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
import { AlertTriangle, Zap, ArrowUpRight, ArrowDownRight, Mail, Users } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

/* ── Visual spec constants ── */

const CARD_BG = "bg-[#1a1a18]";
const CARD_BORDER = "border-white/[0.07]";
const ACCENT_GREEN = "#1D9E75";
const ACCENT_GOLD = "#C8A96E";
const NEGATIVE = "#c0392b";

/* ── Helpers ── */

function fmtEur(value: number, opts: { compact?: boolean } = {}): string {
  if (opts.compact && Math.abs(value) >= 1000) {
    return `€${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  }
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

function fmtEurPrecise(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value);
}

function fmtNumber(value: number): string {
  return new Intl.NumberFormat("en-GB").format(value);
}

/* ── Page ── */

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
      <Header title="Overview" />

      <div
        className="flex-1 px-4 sm:px-6 py-4 sm:py-6 space-y-5 overflow-y-auto"
        style={{ backgroundColor: "#0e0e0c", fontFamily: "var(--font-dm-sans, system-ui)" }}
      >
        {/* Brand selector */}
        <VenueTabs />

        {/* Pre-28-April caveat — global note for any revenue spanning the
            fix date. Lives here so every revenue card downstream
            inherits the context. */}
        <PreFixDateNote fixedOn={PURCHASE_VALUE_FIX_DATE} />

        {/* 1. KPI Row */}
        <SectionLabel>Headline</SectionLabel>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <Kpi
            label="Total Spend"
            value={fmtEur(kpis.totalSpend)}
            deltaPct={kpis.totalSpendDeltaPct}
            deltaUnit="vs last week"
          />
          <Kpi
            label="Events Revenue"
            value={fmtEur(kpis.eventsRevenue)}
            deltaPct={kpis.eventsRevenueDeltaPct}
            deltaUnit="vs last week"
            sub="Four Venues confirmed"
          />
          <Kpi
            label="Hotel Revenue"
            value={fmtEur(kpis.hotelRevenue)}
            deltaPct={kpis.hotelRevenueDeltaPct}
            deltaUnit="vs last week"
            sub="Up Hotel / Google · not OnSocial campaigns"
            muted
          />
          <Kpi
            label="Overall ROAS"
            value={`${kpis.overallRoas.toFixed(1)}x`}
            deltaAbsolute={kpis.overallRoasDelta}
            deltaSuffix="x"
            sub="Total revenue ÷ OnSocial spend"
          />
          <Kpi
            label="Tickets Sold"
            value={fmtNumber(kpis.ticketsSold)}
            deltaAbsolute={kpis.ticketsDelta}
            deltaSuffix=""
            sub="Four Venues"
          />
        </div>

        {/* 2. Platform Spend (never summed) */}
        <SectionLabel>Platform spend (separate budgets)</SectionLabel>
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <PlatformCard
            label="Meta"
            value={fmtEur(kpis.metaSpend)}
            sub="OnSocial · live"
            icon={<MetaIcon size={14} />}
          />
          <PlatformCard
            label="Google"
            value={fmtEur(kpis.googleSpend)}
            sub="OnSocial · live"
            icon={<GoogleIcon size={14} />}
          />
          <PlatformCard
            label="TikTok"
            value="—"
            sub="Pre-launch — tracking blocker"
            preLaunch
          />
        </div>

        {/* 3. Frequency alerts */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            <SectionLabel>Frequency alerts</SectionLabel>
            <div className="space-y-2">
              {alerts.map((a) => (
                <FrequencyAlertRow key={a.id} alert={a} />
              ))}
            </div>
          </div>
        )}

        {/* 4. Sales by platform */}
        <div className={cn("rounded-[10px] border overflow-hidden", CARD_BG, CARD_BORDER)}>
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <SectionLabel>Sales by platform</SectionLabel>
            <p className="text-[11px] text-white/40 mt-1">
              Source of truth: GA4 (Four Venues confirmed).
              &quot;Sales&quot; = ticket / day-pass / VIP purchases. Never combine across rows.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-white/[0.02] text-[10px] uppercase tracking-[0.06em] text-white/40">
                <tr>
                  <th className="text-left px-4 py-2">Platform</th>
                  <th className="text-right px-3 py-2">Spend</th>
                  <th className="text-right px-3 py-2">Sales</th>
                  <th className="text-right px-3 py-2">Revenue</th>
                  <th className="text-right px-3 py-2">ROAS</th>
                  <th className="text-right px-3 py-2">CPA</th>
                  <th className="text-right px-3 py-2">Target CPA</th>
                </tr>
              </thead>
              <tbody>
                {platformRows.map((r) => (
                  <tr key={r.platform} className="border-t border-white/[0.04]">
                    <td className="px-4 py-3 text-white/85 font-medium">{r.platform}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-white/85">
                      {r.spend !== null ? fmtEur(r.spend) : "—"}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-white/85">
                      {r.sales !== null ? fmtNumber(r.sales) : "—"}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-white/85">
                      {r.revenue !== null ? fmtEur(r.revenue) : (
                        <span className="text-white/30">{r.preLaunch ? "Pre-launch" : "—"}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-white/85">
                      {r.roas !== null ? `${r.roas.toFixed(2)}x` : "—"}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-white/85">
                      {r.cpa !== null ? fmtEurPrecise(r.cpa) : "—"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <NotProvidedPill />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 5. Brand performance grid */}
        <SectionLabel>Brand performance</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {brandRows
            .filter((r) => r.brand !== "IR_HOTEL")
            .map((r) => (
              <BrandCard key={r.brand} row={r} />
            ))}
        </div>

        {/* Hotel — read-only row below the grid */}
        {brandRows.find((r) => r.brand === "IR_HOTEL") && (
          <HotelReadOnlyRow row={brandRows.find((r) => r.brand === "IR_HOTEL")!} />
        )}

        {/* 6. Bottom row: chart + Rocks Club */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          {/* Daily performance chart */}
          <div className={cn("rounded-[10px] border p-4", CARD_BG, CARD_BORDER)}>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <SectionLabel>Daily performance · 14 days</SectionLabel>
              <div className="inline-flex items-center bg-white/[0.04] border border-white/[0.06] rounded-lg p-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]">
                {(["spend", "sales", "cpa"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setChartMetric(m)}
                    className={cn(
                      "px-3 py-1 rounded-md transition-colors",
                      chartMetric === m
                        ? "bg-[#1D9E75] text-white"
                        : "text-white/40 hover:text-white",
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
                    tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: string) => v.slice(5)}
                  />
                  <YAxis
                    tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tickFormatter={(v: number) =>
                      chartMetric === "sales"
                        ? fmtNumber(v)
                        : `€${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}`
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1a18",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                      fontSize: 11,
                    }}
                    labelStyle={{ color: "rgba(255,255,255,0.5)" }}
                    formatter={(val: unknown) => {
                      const n = Number(val ?? 0);
                      if (chartMetric === "sales") return [fmtNumber(n), "Sales"];
                      if (chartMetric === "cpa") return [fmtEurPrecise(n), "CPA"];
                      return [fmtEur(n), "Spend"];
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey={chartMetric}
                    stroke={ACCENT_GREEN}
                    strokeWidth={2.25}
                    dot={{ r: 2.5, fill: ACCENT_GREEN, stroke: "#0e0e0c", strokeWidth: 1 }}
                    activeDot={{ r: 4, fill: ACCENT_GREEN, stroke: "#0e0e0c", strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Rocks Club widget */}
          <div
            className="rounded-[10px] border p-4 flex flex-col gap-3"
            style={{
              backgroundColor: "#1a1a18",
              borderColor: "rgba(200,169,110,0.25)",
            }}
          >
            <div className="flex items-center gap-2">
              <Mail size={13} style={{ color: ACCENT_GOLD }} />
              <span className="text-[10px] uppercase tracking-[0.06em] font-semibold" style={{ color: ACCENT_GOLD }}>
                Rocks Club sign-ups
              </span>
            </div>
            <div>
              <p className="text-[28px] font-semibold tabular-nums" style={{ color: "#f0ede8" }}>
                {fmtNumber(rocks.total)}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: ACCENT_GREEN }}>
                ▲ {fmtNumber(rocks.weekDelta)} this week
              </p>
            </div>
            <p className="text-[11px] text-white/45 leading-relaxed">
              Email captures feeding hotel funnel. List size 80–100k.
              March email campaign drove £40k hotel revenue.
            </p>
            {/* Mini funnel */}
            <div className="space-y-1.5 pt-2 border-t border-white/[0.04]">
              {rocks.funnel.map((step, i) => {
                const pct = i === 0 ? 100 : (step.count / rocks.funnel[0].count) * 100;
                return (
                  <div key={step.stage}>
                    <div className="flex items-baseline justify-between text-[10px] mb-0.5">
                      <span className="text-white/55">{step.stage}</span>
                      <span className="text-white/85 tabular-nums font-semibold">
                        {fmtNumber(step.count)}
                        {i > 0 && (
                          <span className="text-white/30 ml-1 font-normal">
                            ({pct.toFixed(0)}%)
                          </span>
                        )}
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
    <p className="text-[10px] uppercase tracking-[0.06em] font-semibold text-white/25">
      {children}
    </p>
  );
}

function NotProvidedPill() {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium"
      style={{
        backgroundColor: "rgba(200,169,110,0.1)",
        border: "1px solid rgba(200,169,110,0.2)",
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
      className="rounded-[10px] border px-3 py-2 flex items-start gap-2"
      style={{
        backgroundColor: "rgba(200,169,110,0.05)",
        borderColor: "rgba(200,169,110,0.18)",
      }}
    >
      <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" style={{ color: ACCENT_GOLD }} />
      <p className="text-[11px] text-white/55 leading-relaxed">
        Purchase value tracking fixed by Tristan ({fmt}). Pre-{fmt} data may show
        deposit values not full purchase prices for VIP bookings via Four Venues.
      </p>
    </div>
  );
}

interface KpiProps {
  label: string;
  value: string;
  sub?: string;
  deltaPct?: number;          // percentage delta (vs last week)
  deltaAbsolute?: number;     // absolute delta (e.g. ROAS x change, ticket count)
  deltaSuffix?: string;       // e.g. "x" for ROAS, "" for tickets
  deltaUnit?: string;         // "vs last week" / "this week"
  muted?: boolean;
}

function Kpi({ label, value, sub, deltaPct, deltaAbsolute, deltaSuffix = "", deltaUnit = "vs last week", muted }: KpiProps) {
  const hasDelta = deltaPct !== undefined || deltaAbsolute !== undefined;
  const numeric = deltaPct !== undefined ? deltaPct : deltaAbsolute;
  const positive = numeric !== undefined && numeric >= 0;
  return (
    <div className={cn("rounded-[10px] border p-4", CARD_BG, CARD_BORDER, muted && "opacity-70")}>
      <p className="text-[10px] uppercase tracking-[0.06em] font-semibold text-white/25 mb-2">{label}</p>
      <p
        className="font-semibold tabular-nums"
        style={{ fontSize: "22px", color: muted ? "rgba(255,255,255,0.45)" : "#f0ede8" }}
      >
        {value}
      </p>
      {hasDelta && (
        <div className="mt-1 flex items-center gap-1 text-[11px]">
          <span style={{ color: positive ? ACCENT_GREEN : NEGATIVE }} className="inline-flex items-center gap-0.5">
            {positive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {deltaPct !== undefined
              ? `${Math.abs(deltaPct).toFixed(deltaPct % 1 === 0 ? 0 : 1)}%`
              : `${Math.abs(deltaAbsolute!).toFixed(deltaAbsolute! % 1 === 0 ? 0 : 1)}${deltaSuffix}`}
          </span>
          <span className="text-white/30">{deltaUnit}</span>
        </div>
      )}
      {sub && <p className="text-[10px] text-white/35 mt-1.5">{sub}</p>}
    </div>
  );
}

function PlatformCard({
  label,
  value,
  sub,
  icon,
  preLaunch,
}: {
  label: string;
  value: string;
  sub: string;
  icon?: React.ReactNode;
  preLaunch?: boolean;
}) {
  return (
    <div className={cn("rounded-[10px] border p-3 sm:p-4", CARD_BG, CARD_BORDER, preLaunch && "opacity-65")}>
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span className="text-[10px] uppercase tracking-[0.06em] font-semibold text-white/45">{label}</span>
      </div>
      <p className="font-semibold tabular-nums" style={{ fontSize: "20px", color: "#f0ede8" }}>{value}</p>
      <p className={cn("text-[10px] mt-1", preLaunch ? "text-white/40" : "text-white/35")}>{sub}</p>
    </div>
  );
}

function FrequencyAlertRow({ alert }: { alert: ReturnType<typeof getFrequencyAlerts>[number] }) {
  const isRed = alert.severity === "red";
  const accent = isRed ? "#c0392b" : "#d97706";
  return (
    <div
      className="rounded-[10px] border px-3 py-2 flex items-center gap-3 flex-wrap"
      style={{
        backgroundColor: `${accent}15`,
        borderColor: `${accent}40`,
      }}
    >
      {isRed ? (
        <AlertTriangle size={13} style={{ color: accent }} />
      ) : (
        <Zap size={13} style={{ color: accent }} />
      )}
      <span className="text-[11px] font-semibold" style={{ color: accent }}>
        {alert.brand}
      </span>
      <span className="text-[11px] text-white/55">— &ldquo;{alert.campaign}&rdquo;</span>
      <span className="text-[11px] text-white/35">
        {alert.platform} {alert.window} frequency {alert.frequency.toFixed(1)}x
      </span>
      <span className="ml-auto text-[10px] uppercase tracking-[0.06em] font-semibold" style={{ color: accent }}>
        {alert.recommendation}
      </span>
    </div>
  );
}

function BrandCard({ row }: { row: ReturnType<typeof getBrandGrid>[number] }) {
  const brand = IRG_BRANDS[row.brand];
  if (!brand) return null;

  return (
    <div className={cn("rounded-[10px] border overflow-hidden", CARD_BG, CARD_BORDER)}>
      {/* 3px accent bar */}
      <div className="h-[3px] w-full" style={{ backgroundColor: brand.color }} />
      <div className="p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: "#f0ede8" }}>
            {brand.label}
          </h3>
          <p className="text-[10px] text-white/35 mt-0.5">
            Account: <span className="text-white/55">{brand.accountLabel}</span>
            {" · "}
            <span className="text-white/55">€{(brand.budget / 1000).toFixed(0)}k annual</span>
          </p>
          {brand.accountNote && (
            <p className="text-[10px] text-white/35 italic mt-1">{brand.accountNote}</p>
          )}
        </div>

        <div className="grid grid-cols-4 gap-3">
          <BrandStat label="Spend" value={fmtEur(row.spend)} delta={row.spendDeltaPct} deltaSuffix="%" />
          <BrandStat label="Revenue" value={fmtEur(row.eventsRevenue)} delta={row.eventsRevenueDeltaPct} deltaSuffix="%" />
          <BrandStat
            label="ROAS"
            value={row.roas !== null ? `${row.roas.toFixed(1)}x` : "—"}
            delta={row.roasDelta}
            deltaSuffix="x"
            highlight={row.roas !== null && row.roas >= 10}
          />
          <BrandStat
            label="Tickets"
            value={fmtNumber(row.tickets)}
            delta={row.ticketsDelta}
            deltaSuffix=""
          />
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.04]">
          <span className="text-[11px] text-white/55">
            CPA (actual):{" "}
            <span className="text-white/85 font-medium">
              {row.cpaLabel ?? (row.cpa !== null ? fmtEurPrecise(row.cpa) : "—")}
            </span>
          </span>
          <NotProvidedPill />
        </div>
      </div>
    </div>
  );
}

function BrandStat({
  label,
  value,
  delta,
  deltaSuffix = "",
  highlight,
}: {
  label: string;
  value: string;
  delta?: number | null;
  deltaSuffix?: string;
  highlight?: boolean;
}) {
  const positive = delta !== null && delta !== undefined && delta >= 0;
  return (
    <div>
      <p className="text-[9px] uppercase tracking-[0.06em] text-white/30">{label}</p>
      <p
        className="text-sm font-semibold tabular-nums mt-0.5"
        style={{ color: highlight ? ACCENT_GREEN : "#f0ede8" }}
      >
        {value}
      </p>
      {delta !== null && delta !== undefined && (
        <p className="text-[10px] tabular-nums mt-0.5" style={{ color: positive ? ACCENT_GREEN : NEGATIVE }}>
          {positive ? "▲" : "▼"} {Math.abs(delta).toFixed(delta % 1 === 0 ? 0 : 1)}{deltaSuffix}
        </p>
      )}
    </div>
  );
}

function HotelReadOnlyRow({ row }: { row: ReturnType<typeof getBrandGrid>[number] }) {
  return (
    <div
      className={cn("rounded-[10px] border px-4 py-3 flex items-center justify-between flex-wrap gap-3", CARD_BG)}
      style={{ borderColor: "rgba(255,255,255,0.04)" }}
    >
      <div className="flex items-center gap-3 flex-wrap">
        <Users size={13} className="text-white/25" />
        <span className="text-[11px] uppercase tracking-[0.06em] font-semibold text-white/25">
          Ibiza Rocks Hotel — read only
        </span>
        <span className="text-[11px] text-white/30 italic">
          Up Hotel / Google. Not OnSocial campaigns.
        </span>
      </div>
      <div className="flex items-center gap-4 text-[11px] text-white/25">
        <span>
          Hotel revenue: <span className="text-white/40 font-medium">{fmtEur(row.hotelRevenue)}</span>
        </span>
        <span>
          Bookings: <span className="text-white/40 font-medium">{fmtNumber(row.tickets)}</span>
        </span>
        {row.ticketsDelta !== null && (
          <span style={{ color: row.ticketsDelta >= 0 ? ACCENT_GREEN : NEGATIVE }}>
            {row.ticketsDelta >= 0 ? "▲" : "▼"} {Math.abs(row.ticketsDelta)} this week
          </span>
        )}
      </div>
    </div>
  );
}
