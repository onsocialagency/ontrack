"use client";

/**
 * IRG Reconciliation tab — explains why platform numbers differ from
 * confirmed sales and makes the gaps unambiguous.
 *
 * Per the 29 April 2026 brief:
 *   - Three summary cards: Meta reported / Google reported / Four
 *     Venues confirmed (the GA4 source of truth)
 *   - Over-attribution ratio = (Meta + Google) ÷ FV confirmed
 *     amber when > 2x, red when > 4x
 *   - Revenue breakdown table:
 *       Total (headline) — events + hotel
 *       — Events (Four Venues, forvenues.com)
 *       — Hotel (WIT Booking, ibizarox.com)
 *       Meta platform-reported revenue (separate, not added)
 *       Google platform-reported revenue (separate, not added)
 *   - Pikes ad-account note (spans 528 + Pikes)
 *   - Pre-28-April purchase-value caveat (Tristan's fix)
 */

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { VenueTabs } from "@/components/layout/venue-tabs";
import { cn } from "@/lib/utils";
import { PURCHASE_VALUE_FIX_DATE } from "@/lib/irg-brands";
import { getIrgReconciliation } from "@/lib/irg-mock";
import { Info, AlertTriangle } from "lucide-react";

const CARD_BG = "bg-white/[0.04]";const CARD_BORDER = "border-white/[0.06]";const ACCENT_GREEN = "#1D9E75";
const ACCENT_GOLD = "#C8A96E";

function fmtEur(v: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
}
function fmtNumber(v: number): string {
  return new Intl.NumberFormat("en-GB").format(v);
}

export default function ReconciliationPage() {
  const { client: clientSlug } = useParams<{ client: string }>();

  if (clientSlug !== "irg") {
    return (
      <>
        <Header title="Reconciliation" showDateRange={false} />
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-sm text-[#94A3B8] max-w-md text-center">
            Reconciliation is part of the IRG dashboard.
            Lead-gen clients have their own CRM Reconciliation tab.
          </p>
        </div>
      </>
    );
  }

  return <IrgReconciliationView />;
}

function IrgReconciliationView() {
  const r = useMemo(() => getIrgReconciliation(), []);

  const claimed = r.metaPlatformReported + r.googlePlatformReported;
  const ratio = r.fourVenuesConfirmed > 0 ? claimed / r.fourVenuesConfirmed : 0;
  let ratioColour = "rgba(255,255,255,0.55)";
  let ratioLabel: string | null = null;
  if (ratio > 4) {
    ratioColour = "#c0392b";
    ratioLabel = "Above 4× — investigate tracking";
  } else if (ratio > 2) {
    ratioColour = "#d97706";
    ratioLabel = "Above 2× — expected, attribution windows overlap";
  } else {
    ratioColour = ACCENT_GREEN;
    ratioLabel = "Within expected range";
  }

  return (
    <>
      <Header title="Reconciliation" />

      <div
        className="flex-1 px-4 sm:px-6 py-4 sm:py-6 space-y-5 overflow-y-auto"

      >
        <VenueTabs />

        {/* Three summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          <SummaryCard
            label="Meta reported"
            value={fmtNumber(r.metaPlatformReported)}
            sub="Platform reported · 7d click / 1d view"
            border="rgba(58,142,255,0.4)"
            text="#60A5FA"
          />
          <SummaryCard
            label="Google reported"
            value={fmtNumber(r.googlePlatformReported)}
            sub="Platform reported · 30d click"
            border="rgba(217,119,6,0.4)"
            text="#fbbf24"
          />
          <SummaryCard
            label="Four Venues confirmed"
            value={fmtNumber(r.fourVenuesConfirmed)}
            sub="GA4 confirmed · the source of truth"
            border="rgba(29,158,117,0.5)"
            text={ACCENT_GREEN}
            highlight
          />
        </div>

        {/* Over-attribution ratio */}
        <div
          className="rounded-xl sm:rounded-2xl border p-4 flex items-center justify-between flex-wrap gap-3"
          style={{ backgroundColor: `${ratioColour}10`, borderColor: `${ratioColour}30` }}
        >
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-[#94A3B8]">
              Over-attribution ratio
            </span>
            <span className="text-2xl font-semibold tabular-nums" style={{ color: ratioColour }}>
              {ratio.toFixed(1)}×
            </span>
            <span className="text-[11px] text-[#94A3B8]">
              ({fmtNumber(claimed)} platform claimed ÷ {fmtNumber(r.fourVenuesConfirmed)} FV confirmed)
            </span>
          </div>
          {ratioLabel && (
            <span
              className="text-[10px] uppercase tracking-wider font-semibold"
              style={{ color: ratioColour }}
            >
              {ratioLabel}
            </span>
          )}
        </div>

        {/* Revenue breakdown */}
        <div className={cn("rounded-xl sm:rounded-2xl border overflow-hidden", CARD_BG, CARD_BORDER)}>
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-[#94A3B8]">
              Revenue breakdown
            </p>
            <p className="text-[11px] text-[#64748B] mt-1">
              Events revenue ={" "}
              <a
                href="https://forvenues.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#94A3B8] underline-offset-2 hover:underline"
              >
                forvenues.com
              </a>
              . Hotel revenue ={" "}
              <a
                href="https://ibizarox.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#94A3B8] underline-offset-2 hover:underline"
              >
                ibizarox.com
              </a>
              . Filtered by GA4 hostname. Never add them.
            </p>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-white/[0.02] text-[10px] uppercase tracking-wider text-[#64748B]">
              <tr>
                <th className="text-left px-4 py-2">Source</th>
                <th className="text-right px-4 py-2">Revenue</th>
                <th className="text-right px-4 py-2">Sales</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-white/[0.04]">
                <td className="px-4 py-2.5 text-white font-semibold">Total (headline)</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-white font-semibold">{fmtEur(r.totalRevenue)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-white font-semibold">
                  {fmtNumber(r.eventsSales + r.hotelSales)}
                </td>
              </tr>
              <tr className="border-t border-white/[0.02]">
                <td className="px-4 py-2.5 pl-8 text-[#94A3B8]">— Events (Four Venues)</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-white">{fmtEur(r.eventsRevenue)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-white">{fmtNumber(r.eventsSales)}</td>
              </tr>
              <tr className="border-t border-white/[0.02]">
                <td className="px-4 py-2.5 pl-8 text-[#94A3B8]">— Hotel (WIT Booking)</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-white">{fmtEur(r.hotelRevenue)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-white">{fmtNumber(r.hotelSales)}</td>
              </tr>
              <tr className="border-t border-white/[0.04]">
                <td className="px-4 py-2.5 text-[#94A3B8] italic">Meta platform reported</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-[#94A3B8] italic">{fmtEur(r.metaPlatformRevenue)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-[#475569]">—</td>
              </tr>
              <tr className="border-t border-white/[0.02]">
                <td className="px-4 py-2.5 text-[#94A3B8] italic">Google platform reported</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-[#94A3B8] italic">{fmtEur(r.googlePlatformRevenue)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-[#475569]">—</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Pikes ad-account note + purchase-value note */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <NoteCard
            icon={<Info size={13} style={{ color: ACCENT_GOLD }} />}
            title="Pikes Presents — multi-account aggregation"
            body="Pikes Presents campaigns live across the [528] and [Pikes] Meta accounts. Both are included in totals when Pikes Presents is selected as a brand. Each campaign row in /campaigns shows which account it belongs to."
            tone={ACCENT_GOLD}
          />
          <NoteCard
            icon={<AlertTriangle size={13} style={{ color: "#fbbf24" }} />}
            title="Purchase value tracking fix"
            body={`Tristan deployed a custom Four Venues purchase tag on ${new Date(PURCHASE_VALUE_FIX_DATE).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}. Pre-fix data may show deposit values (e.g. €110 instead of full €440 for VIP bookings). Meta tracking switched to custom JS the same week. TikTok template tag still records deposits — not yet fixed.`}
            tone="#fbbf24"
          />
        </div>
      </div>
    </>
  );
}

/* ── Pieces ── */

function SummaryCard({
  label, value, sub, border, text, highlight,
}: {
  label: string; value: string; sub: string; border: string; text: string; highlight?: boolean;
}) {
  return (
    <div
      className="rounded-xl sm:rounded-2xl border p-4"
      style={{
        backgroundColor: highlight ? `${border.replace("0.5", "0.08")}` : "#1a1a18",
        borderColor: border,
      }}
    >
      <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: text }}>
        {label}
      </p>
      <p className="font-semibold tabular-nums" style={{ fontSize: "32px", color: "#f0ede8" }}>
        {value}
      </p>
      <p className="text-[10px] text-[#64748B] mt-2">{sub}</p>
    </div>
  );
}

function NoteCard({
  icon, title, body, tone,
}: {
  icon: React.ReactNode; title: string; body: string; tone: string;
}) {
  return (
    <div
      className="rounded-xl sm:rounded-2xl border p-3 flex items-start gap-2.5"
      style={{ backgroundColor: `${tone}08`, borderColor: `${tone}25` }}
    >
      <span className="flex-shrink-0 mt-0.5">{icon}</span>
      <div className="space-y-1">
        <p className="text-[12px] font-semibold" style={{ color: tone }}>{title}</p>
        <p className="text-[11px] text-[#94A3B8] leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
