"use client";

/**
 * IRG Events tab — performance per event, with purchase-timing split.
 *
 * Per the 29 April 2026 brief:
 *   - List / Calendar / Artist view toggle
 *   - Filters: brand, venue, artist, date range, type
 *   - Table columns: event / brand / date / artist / account / spend /
 *     tickets sold / events revenue / CPA per ticket / ROAS /
 *     purchase timing split / status badge
 *   - Purchase timing split = stacked horizontal bar inside the cell
 *     (advance / near / day-of) so the team can see ad-strategy
 *     timing at a glance
 *   - Expandable row: top 2 ads (spend / CPA / frequency)
 *   - Artist view: groups by artist across the season
 *
 * Mock data via `getIrgEvents()` so every component renders.
 *
 * For non-IRG clients this route renders a simple fallback message.
 */

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { VenueTabs } from "@/components/layout/venue-tabs";
import { useVenue } from "@/lib/venue-context";
import { cn } from "@/lib/utils";
import { IRG_BRANDS } from "@/lib/irg-brands";
import { getIrgEvents, type IrgEventRow, type EventStatus } from "@/lib/irg-mock";
import { CalendarDays, List as ListIcon, Mic2, ChevronDown, ChevronRight } from "lucide-react";

const CARD_BG = "bg-white/[0.04]";const CARD_BORDER = "border-white/[0.06]";const ACCENT_GREEN = "#1D9E75";
const ACCENT_GOLD = "#C8A96E";

type ViewMode = "list" | "calendar" | "artist";

function fmtEur(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}
function fmtEurPrecise(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value);
}
function fmtNumber(value: number): string {
  return new Intl.NumberFormat("en-GB").format(value);
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

const STATUS_COLOURS: Record<EventStatus, { bg: string; text: string }> = {
  Strong:    { bg: "rgba(29,158,117,0.15)", text: ACCENT_GREEN },
  "On track":{ bg: "rgba(59,130,246,0.15)", text: "#60A5FA" },
  Slow:      { bg: "rgba(217,119,6,0.15)", text: "#d97706" },
  "Sold out":{ bg: "rgba(200,169,110,0.18)", text: ACCENT_GOLD },
};

export default function EventsPage() {
  const { client: clientSlug } = useParams<{ client: string }>();
  const { activeVenue } = useVenue();

  const all = useMemo(() => getIrgEvents(), []);
  const [view, setView] = useState<ViewMode>("list");
  const [typeFilter, setTypeFilter] = useState<"all" | IrgEventRow["type"]>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Non-IRG client fallback
  if (clientSlug !== "irg") {
    return (
      <>
        <Header title="Events" showDateRange={false} />
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-sm text-[#94A3B8] max-w-md text-center">
            The Events tab is part of the IRG dashboard. Other clients
            don&apos;t have an event-driven funnel surfaced here.
          </p>
        </div>
      </>
    );
  }

  const filtered = useMemo(() => {
    let rows = all;
    if (activeVenue !== "all") rows = rows.filter((r) => r.brand === activeVenue);
    if (typeFilter !== "all") rows = rows.filter((r) => r.type === typeFilter);
    return rows.sort((a, b) => a.date.localeCompare(b.date));
  }, [all, activeVenue, typeFilter]);

  return (
    <>
      <Header title="Events" />

      <div
        className="flex-1 px-4 sm:px-6 py-4 sm:py-6 space-y-5 overflow-y-auto"

      >
        <VenueTabs />

        {/* Filters + view toggle */}
        <div className={cn("rounded-xl sm:rounded-2xl border p-3 flex flex-wrap items-center gap-3", CARD_BG, CARD_BORDER)}>
          <div className="flex items-center gap-2">
            <span className="text-[9px] uppercase tracking-wider font-semibold text-[#64748B]">Type</span>
            <div className="inline-flex items-center bg-white/[0.04] border border-white/[0.06] rounded-lg p-0.5 text-[11px] font-medium">
              {(["all", "Day party", "Night", "Residency"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={cn(
                    "px-2.5 py-1 rounded-md transition-colors",
                    typeFilter === t ? "bg-white/[0.08] text-white" : "text-[#94A3B8] hover:text-white",
                  )}
                >
                  {t === "all" ? "All" : t}
                </button>
              ))}
            </div>
          </div>

          <span className="ml-auto inline-flex items-center bg-white/[0.04] border border-white/[0.06] rounded-lg p-0.5">
            {([
              { id: "list", label: "List", icon: <ListIcon size={11} /> },
              { id: "calendar", label: "Calendar", icon: <CalendarDays size={11} /> },
              { id: "artist", label: "Artist", icon: <Mic2 size={11} /> },
            ] as const).map((v) => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
                  view === v.id ? "bg-white/[0.08] text-white" : "text-[#94A3B8] hover:text-white",
                )}
              >
                {v.icon}
                {v.label}
              </button>
            ))}
          </span>

          <span className="text-[11px] text-[#64748B] w-full sm:w-auto sm:ml-3">
            {filtered.length} {filtered.length === 1 ? "event" : "events"}
          </span>
        </div>

        {/* Headline note about purchase timing */}
        <div
          className="rounded-xl sm:rounded-2xl border px-3 py-2 flex items-start gap-2"
          style={{
            backgroundColor: "rgba(29,158,117,0.05)",
            borderColor: "rgba(29,158,117,0.18)",
          }}
        >
          <CalendarDays size={12} className="flex-shrink-0 mt-0.5" style={{ color: ACCENT_GREEN }} />
          <p className="text-[11px] text-[#94A3B8] leading-relaxed">
            Purchase timing split shows when each event&apos;s tickets are bought:
            <span className="ml-1" style={{ color: ACCENT_GREEN }}>green = 7+ days advance</span>,
            <span className="ml-1 text-amber-400">amber = 1–6 days</span>,
            <span className="ml-1 text-red-400">red = day-of</span>.
            Drives day-specific ad strategy — slow advance ratio means push retargeting hard close to the date.
          </p>
        </div>

        {view === "list" && (
          <EventsList
            events={filtered}
            expanded={expanded}
            setExpanded={setExpanded}
          />
        )}
        {view === "calendar" && <EventsCalendar events={filtered} />}
        {view === "artist" && <ArtistView events={filtered} />}
      </div>
    </>
  );
}

/* ── List view ── */

function EventsList({
  events,
  expanded,
  setExpanded,
}: {
  events: IrgEventRow[];
  expanded: string | null;
  setExpanded: (id: string | null) => void;
}) {
  return (
    <div className={cn("rounded-xl sm:rounded-2xl border overflow-hidden", CARD_BG, CARD_BORDER)}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[1100px]">
          <thead className="bg-white/[0.02] text-[10px] uppercase tracking-wider text-[#64748B]">
            <tr>
              <th className="text-left px-3 py-2 w-8" />
              <th className="text-left px-3 py-2">Event</th>
              <th className="text-left px-3 py-2">Brand</th>
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-left px-3 py-2">Artist</th>
              <th className="text-left px-3 py-2">Account</th>
              <th className="text-right px-3 py-2">Spend</th>
              <th className="text-right px-3 py-2">Tickets</th>
              <th className="text-right px-3 py-2">Events €</th>
              <th className="text-right px-3 py-2">CPA</th>
              <th className="text-right px-3 py-2">ROAS</th>
              <th className="text-left px-3 py-2 min-w-[180px]">Purchase timing</th>
              <th className="text-left px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => {
              const brand = IRG_BRANDS[e.brand];
              const isOpen = expanded === e.id;
              return (
                <>
                  <tr
                    key={e.id}
                    onClick={() => setExpanded(isOpen ? null : e.id)}
                    className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors cursor-pointer"
                  >
                    <td className="px-3 py-2.5 text-[#64748B]">
                      {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </td>
                    <td className="px-3 py-2.5 text-white font-medium max-w-[220px] truncate" title={e.name}>
                      {e.name}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: brand.color }} />
                        <span className="text-[#94A3B8] text-[11px]">{brand.shortLabel}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[#94A3B8] tabular-nums">{fmtDate(e.date)}</td>
                    <td className="px-3 py-2.5 text-white">{e.artist}</td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/[0.04] text-[#94A3B8]">
                        {e.accountLabel}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-white">{fmtEur(e.spend)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      <span className="text-emerald-400 font-semibold">{fmtNumber(e.ticketsSold)}</span>
                      <span className="text-[#94A3B8] ml-1">/ {fmtNumber(e.ticketsCapacity)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-white">{fmtEur(e.eventsRevenue)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-white">{fmtEurPrecise(e.cpa)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-white">{e.roas.toFixed(1)}x</td>
                    <td className="px-3 py-2.5">
                      <TimingBar split={e.timingSplit} />
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={e.status} />
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-white/[0.02] border-t border-white/[0.04]">
                      <td colSpan={13} className="px-6 py-3">
                        <p className="text-[10px] uppercase tracking-wider font-semibold text-[#64748B] mb-2">
                          Top ads driving this event
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {e.topAds.map((ad) => (
                            <div key={ad.name} className="rounded-md bg-white/[0.02] border border-white/[0.04] p-2.5">
                              <p className="text-[11px] text-white font-medium truncate" title={ad.name}>{ad.name}</p>
                              <div className="flex items-baseline gap-3 mt-1.5 text-[11px]">
                                <span className="text-[#64748B]">Spend</span>
                                <span className="tabular-nums">{fmtEur(ad.spend)}</span>
                                <span className="text-[#64748B]">CPA</span>
                                <span className="tabular-nums">{ad.cpa ? fmtEurPrecise(ad.cpa) : "—"}</span>
                                <span className="text-[#64748B]">Freq</span>
                                <span className={cn(
                                  "tabular-nums",
                                  ad.frequency > 3.5 ? "text-red-400" : ad.frequency > 2.5 ? "text-amber-400" : "text-emerald-400",
                                )}>
                                  {ad.frequency.toFixed(1)}x
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Calendar view ── */

function EventsCalendar({ events }: { events: IrgEventRow[] }) {
  // Group events by month then by date.
  const byMonth = useMemo(() => {
    const m = new Map<string, IrgEventRow[]>();
    for (const e of events) {
      const key = e.date.slice(0, 7);
      const arr = m.get(key) ?? [];
      arr.push(e);
      m.set(key, arr);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [events]);

  return (
    <div className="space-y-5">
      {byMonth.map(([month, evs]) => (
        <div key={month} className={cn("rounded-xl sm:rounded-2xl border p-4", CARD_BG, CARD_BORDER)}>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-[#64748B] mb-3">
            {new Date(month + "-01").toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {evs.map((e) => {
              const brand = IRG_BRANDS[e.brand];
              return (
                <div
                  key={e.id}
                  className="rounded-md p-3 border border-white/[0.04] hover:border-white/[0.12] transition-colors cursor-pointer"
                  style={{ backgroundColor: `${brand.color}10` }}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-[11px] tabular-nums text-[#94A3B8] font-mono">{fmtDate(e.date)}</p>
                    <StatusBadge status={e.status} small />
                  </div>
                  <p className="text-[12px] text-white font-medium leading-tight">{e.name}</p>
                  <p className="text-[10px] text-[#94A3B8] mt-0.5">{brand.shortLabel} · {e.venue}</p>
                  <div className="mt-2 flex items-baseline justify-between text-[10px]">
                    <span className="text-[#64748B]">Tickets</span>
                    <span className="tabular-nums text-emerald-400 font-semibold">
                      {fmtNumber(e.ticketsSold)} / {fmtNumber(e.ticketsCapacity)}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <TimingBar split={e.timingSplit} compact />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Artist view — group across season ── */

function ArtistView({ events }: { events: IrgEventRow[] }) {
  const grouped = useMemo(() => {
    const m = new Map<string, IrgEventRow[]>();
    for (const e of events) {
      const arr = m.get(e.artist) ?? [];
      arr.push(e);
      m.set(e.artist, arr);
    }
    return Array.from(m.entries())
      .map(([artist, evs]) => {
        const spend = evs.reduce((s, e) => s + e.spend, 0);
        const tickets = evs.reduce((s, e) => s + e.ticketsSold, 0);
        const revenue = evs.reduce((s, e) => s + e.eventsRevenue, 0);
        const cpa = tickets > 0 ? spend / tickets : 0;
        const roas = spend > 0 ? revenue / spend : 0;
        return { artist, evs, spend, tickets, revenue, cpa, roas };
      })
      .sort((a, b) => b.spend - a.spend);
  }, [events]);

  return (
    <div className={cn("rounded-xl sm:rounded-2xl border overflow-hidden", CARD_BG, CARD_BORDER)}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-white/[0.02] text-[10px] uppercase tracking-wider text-[#64748B]">
            <tr>
              <th className="text-left px-3 py-2">Artist</th>
              <th className="text-left px-3 py-2">Brand</th>
              <th className="text-right px-3 py-2">Dates</th>
              <th className="text-right px-3 py-2">Spend</th>
              <th className="text-right px-3 py-2">Tickets</th>
              <th className="text-right px-3 py-2">Revenue</th>
              <th className="text-right px-3 py-2">CPA</th>
              <th className="text-right px-3 py-2">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((g) => {
              const brand = IRG_BRANDS[g.evs[0].brand];
              return (
                <tr key={g.artist} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="px-3 py-2.5 text-white font-medium">{g.artist}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: brand.color }} />
                      <span className="text-[#94A3B8] text-[11px]">{brand.shortLabel}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-[#94A3B8] tabular-nums">{g.evs.length}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-white">{fmtEur(g.spend)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-emerald-400 font-semibold">{fmtNumber(g.tickets)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-white">{fmtEur(g.revenue)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-white">{fmtEurPrecise(g.cpa)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-white">{g.roas.toFixed(1)}x</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Helpers ── */

function StatusBadge({ status, small }: { status: EventStatus; small?: boolean }) {
  const c = STATUS_COLOURS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded font-semibold uppercase tracking-wider",
        small ? "px-1.5 py-0.5 text-[8px]" : "px-2 py-0.5 text-[10px]",
      )}
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {status}
    </span>
  );
}

function TimingBar({
  split,
  compact,
}: {
  split: { advance: number; near: number; dayOf: number };
  compact?: boolean;
}) {
  const total = split.advance + split.near + split.dayOf;
  if (total === 0) return <span className="text-[#475569] text-[11px]">—</span>;
  const a = (split.advance / total) * 100;
  const n = (split.near / total) * 100;
  const d = (split.dayOf / total) * 100;
  return (
    <div className="space-y-1">
      <div className={cn("flex w-full overflow-hidden rounded", compact ? "h-1.5" : "h-2")}>
        <div className="h-full" style={{ width: `${a}%`, backgroundColor: "#1D9E75" }} title={`Advance: ${split.advance}`} />
        <div className="h-full" style={{ width: `${n}%`, backgroundColor: "#d97706" }} title={`Near: ${split.near}`} />
        <div className="h-full" style={{ width: `${d}%`, backgroundColor: "#c0392b" }} title={`Day-of: ${split.dayOf}`} />
      </div>
      {!compact && (
        <div className="flex items-baseline gap-2 text-[9px] text-[#64748B] tabular-nums">
          <span style={{ color: "#1D9E75" }}>{a.toFixed(0)}%</span>
          <span>·</span>
          <span style={{ color: "#d97706" }}>{n.toFixed(0)}%</span>
          <span>·</span>
          <span style={{ color: "#c0392b" }}>{d.toFixed(0)}%</span>
        </div>
      )}
    </div>
  );
}
