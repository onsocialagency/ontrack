"use client";

/**
 * IRG Campaigns table (Tab 2).
 *
 * Per the 29 April 2026 brief:
 *   - Filters: brand / platform / type
 *   - Columns: brand badge, ad-account badge ([IRG]/[528]/[Pikes]),
 *     platform, campaign name, type, spend, impressions, clicks,
 *     CTR, CPC, platform-reported sales (context), Four Venues sales
 *     (confirmed), events revenue, hotel revenue, ROAS, CPA,
 *     Target CPA = amber "Not provided"
 *   - Sortable; default = spend desc
 *   - Hotel rows (Up Hotel / Google) render muted — never combined
 *     into OnSocial totals
 *   - 528 Ibiza is on a dedicated isolated account; never mixed
 *
 * Mock data via `getIrgCampaigns()`.
 */

import { useMemo, useState } from "react";
import { Header } from "@/components/layout/header";
import { VenueTabs } from "@/components/layout/venue-tabs";
import { useVenue } from "@/lib/venue-context";
import { cn } from "@/lib/utils";
import { IRG_BRANDS } from "@/lib/irg-brands";
import { getIrgCampaigns, type IrgCampaignRow } from "@/lib/irg-mock";
import { MetaIcon, GoogleIcon } from "@/components/ui/platform-icons";

const CARD_BG = "bg-white/[0.04]";const CARD_BORDER = "border-white/[0.06]";const ACCENT_GOLD = "#C8A96E";

type SortKey = keyof Pick<
  IrgCampaignRow,
  "spend" | "impressions" | "clicks" | "ctr" | "cpc" | "platformReportedSales" | "fourVenuesSales" | "eventsRevenue" | "hotelRevenue" | "roas" | "cpa"
> | "campaignName" | "platform" | "brand" | "type";

type PlatformFilter = "all" | "Meta" | "Google" | "TikTok";
type TypeFilter = "all" | IrgCampaignRow["type"];

function fmtEur(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}
function fmtEurPrecise(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value);
}
function fmtNumber(value: number): string {
  return new Intl.NumberFormat("en-GB").format(value);
}

export default function IrgCampaignsView() {
  const { activeVenue } = useVenue();
  const all = useMemo(() => getIrgCampaigns(), []);

  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState<string | null>(null);

  const visible = useMemo(() => {
    let rows = all;
    // Brand filter via the URL-persisted pill
    if (activeVenue !== "all") {
      rows = rows.filter((r) => r.brand === activeVenue);
    }
    if (platformFilter !== "all") rows = rows.filter((r) => r.platform === platformFilter);
    if (typeFilter !== "all") rows = rows.filter((r) => r.type === typeFilter);
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[sortKey] as unknown;
      const bv = b[sortKey] as unknown;
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [all, activeVenue, platformFilter, typeFilter, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      // Numeric defaults to descending so a fresh click on Spend lands
      // the biggest spenders first.
      const numeric: SortKey[] = ["spend", "impressions", "clicks", "ctr", "cpc", "platformReportedSales", "fourVenuesSales", "eventsRevenue", "hotelRevenue", "roas", "cpa"];
      setSortDir(numeric.includes(k) ? "desc" : "asc");
    }
  }

  return (
    <>
      <Header title="Campaigns" />

      <div
        className="flex-1 px-4 sm:px-6 py-4 sm:py-6 space-y-5 overflow-y-auto"

      >
        <VenueTabs />

        {/* Filters */}
        <div className={cn("rounded-xl sm:rounded-2xl border p-3 flex flex-wrap items-center gap-3", CARD_BG, CARD_BORDER)}>
          <PillGroup
            label="Platform"
            value={platformFilter}
            options={[
              { id: "all", label: "All" },
              { id: "Meta", label: "Meta" },
              { id: "Google", label: "Google" },
              { id: "TikTok", label: "TikTok" },
            ]}
            onChange={(v) => setPlatformFilter(v as PlatformFilter)}
          />
          <span className="h-5 w-px bg-white/[0.06] hidden sm:block" />
          <PillGroup
            label="Type"
            value={typeFilter}
            options={[
              { id: "all", label: "All" },
              { id: "Always-on", label: "Always-on" },
              { id: "Event", label: "Event" },
              { id: "Artist residency", label: "Residency" },
              { id: "Hotel", label: "Hotel" },
              { id: "Awareness", label: "Awareness" },
            ]}
            onChange={(v) => setTypeFilter(v as TypeFilter)}
          />
          <span className="ml-auto text-[11px] text-[#64748B]">
            {visible.length} {visible.length === 1 ? "campaign" : "campaigns"}
          </span>
        </div>

        {/* Table */}
        <div className={cn("rounded-xl sm:rounded-2xl border overflow-hidden", CARD_BG, CARD_BORDER)}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[1280px]">
              <thead className="bg-white/[0.02] text-[10px] uppercase tracking-wider text-[#64748B]">
                <tr>
                  <SortHeader k="brand" current={sortKey} dir={sortDir} onClick={toggleSort} className="text-left">Brand</SortHeader>
                  <th className="text-left px-3 py-2">Account</th>
                  <SortHeader k="platform" current={sortKey} dir={sortDir} onClick={toggleSort} className="text-left">Platform</SortHeader>
                  <SortHeader k="campaignName" current={sortKey} dir={sortDir} onClick={toggleSort} className="text-left">Campaign</SortHeader>
                  <SortHeader k="type" current={sortKey} dir={sortDir} onClick={toggleSort} className="text-left">Type</SortHeader>
                  <SortHeader k="spend" current={sortKey} dir={sortDir} onClick={toggleSort} className="text-right">Spend</SortHeader>
                  <SortHeader k="impressions" current={sortKey} dir={sortDir} onClick={toggleSort} className="text-right">Impr.</SortHeader>
                  <SortHeader k="clicks" current={sortKey} dir={sortDir} onClick={toggleSort} className="text-right">Clicks</SortHeader>
                  <SortHeader k="ctr" current={sortKey} dir={sortDir} onClick={toggleSort} className="text-right">CTR</SortHeader>
                  <SortHeader k="cpc" current={sortKey} dir={sortDir} onClick={toggleSort} className="text-right">CPC</SortHeader>
                  <SortHeader k="platformReportedSales" current={sortKey} dir={sortDir} onClick={toggleSort} className="text-right">Platform sales</SortHeader>
                  <SortHeader k="fourVenuesSales" current={sortKey} dir={sortDir} onClick={toggleSort} className="text-right text-emerald-400">FV sales</SortHeader>
                  <SortHeader k="eventsRevenue" current={sortKey} dir={sortDir} onClick={toggleSort} className="text-right">Events €</SortHeader>
                  <SortHeader k="hotelRevenue" current={sortKey} dir={sortDir} onClick={toggleSort} className="text-right">Hotel €</SortHeader>
                  <SortHeader k="roas" current={sortKey} dir={sortDir} onClick={toggleSort} className="text-right">ROAS</SortHeader>
                  <SortHeader k="cpa" current={sortKey} dir={sortDir} onClick={toggleSort} className="text-right">CPA</SortHeader>
                  <th className="text-right px-3 py-2">Target CPA</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr><td colSpan={17} className="p-6 text-center text-[#64748B]">No campaigns match the current filters.</td></tr>
                )}
                {visible.map((r) => {
                  const brand = IRG_BRANDS[r.brand];
                  const isHotel = r.brand === "IR_HOTEL";
                  const isOpen = expanded === r.campaignName;
                  return (
                    <>
                      <tr
                        key={r.campaignName}
                        onClick={() => setExpanded(isOpen ? null : r.campaignName)}
                        className={cn(
                          "border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors cursor-pointer",
                          isHotel && "opacity-60",
                        )}
                      >
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: brand.color }} />
                            <span className="text-white font-medium text-[11px]">{brand.shortLabel}</span>
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/[0.04] text-[#94A3B8]">
                            {r.accountLabel}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <PlatformBadge platform={r.platform} />
                        </td>
                        <td className="px-3 py-2.5 text-white max-w-[260px] truncate" title={r.campaignName}>
                          {r.campaignName}
                        </td>
                        <td className="px-3 py-2.5 text-[#94A3B8]">{r.type}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-white">{fmtEur(r.spend)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-[#94A3B8]">{fmtNumber(r.impressions)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-[#94A3B8]">{fmtNumber(r.clicks)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-[#94A3B8]">{r.ctr.toFixed(2)}%</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-[#94A3B8]">{fmtEurPrecise(r.cpc)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-[#94A3B8]">
                          {r.platformReportedSales > 0 ? fmtNumber(r.platformReportedSales) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-emerald-400">
                          {r.fourVenuesSales > 0 ? fmtNumber(r.fourVenuesSales) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-white">
                          {r.eventsRevenue > 0 ? fmtEur(r.eventsRevenue) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-[#94A3B8]">
                          {r.hotelRevenue > 0 ? fmtEur(r.hotelRevenue) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-white">
                          {r.roas !== null ? `${r.roas.toFixed(2)}x` : (
                            r.type === "Awareness" ? <span className="text-[#475569] text-[10px]">awareness</span> : "—"
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-white">
                          {r.cpa !== null ? fmtEurPrecise(r.cpa) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <NotProvidedPill />
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-white/[0.02] border-t border-white/[0.04]">
                          <td colSpan={17} className="px-6 py-3">
                            <p className="text-[10px] uppercase tracking-wider font-semibold text-[#64748B] mb-2">
                              Ad set breakdown — mock
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                              <AdSetStat label="Top ad set" value="LookAlikes 1%" />
                              <AdSetStat label="Spend" value={fmtEur(r.spend * 0.62)} />
                              <AdSetStat label="Sales" value={fmtNumber(Math.round(r.fourVenuesSales * 0.7))} />
                              <AdSetStat label="ROAS" value={r.roas ? `${(r.roas * 1.05).toFixed(2)}x` : "—"} />
                              <AdSetStat label="Second ad set" value="Retarget 90d" />
                              <AdSetStat label="Spend" value={fmtEur(r.spend * 0.38)} />
                              <AdSetStat label="Sales" value={fmtNumber(Math.round(r.fourVenuesSales * 0.3))} />
                              <AdSetStat label="ROAS" value={r.roas ? `${(r.roas * 0.85).toFixed(2)}x` : "—"} />
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

        <p className="text-[11px] text-[#64748B] leading-relaxed">
          Events revenue and hotel revenue are separate. Do not add them
          together. Source of truth: GA4 via Four Venues
          (<span className="text-[#94A3B8]">forvenues.com</span>) and WIT Booking
          (<span className="text-[#94A3B8]">ibizarox.com</span>).
        </p>
      </div>
    </>
  );
}

/* ── Helpers ── */

function SortHeader({
  k, current, dir, onClick, className, children,
}: {
  k: SortKey; current: SortKey; dir: "asc" | "desc"; onClick: (k: SortKey) => void; className?: string; children: React.ReactNode;
}) {
  const active = k === current;
  return (
    <th
      onClick={() => onClick(k)}
      className={cn("px-3 py-2 cursor-pointer select-none whitespace-nowrap font-semibold hover:text-white", active && "text-white", className)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {active && <span className="text-[8px]">{dir === "asc" ? "▲" : "▼"}</span>}
      </span>
    </th>
  );
}

function PillGroup<T extends string>({
  label, value, options, onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] uppercase tracking-wider font-semibold text-[#64748B]">{label}</span>
      <div className="inline-flex items-center bg-white/[0.04] border border-white/[0.06] rounded-lg p-0.5 text-[11px] font-medium">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={cn(
              "px-2.5 py-1 rounded-md transition-colors",
              value === opt.id ? "bg-white/[0.08] text-white" : "text-[#94A3B8] hover:text-white",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PlatformBadge({ platform }: { platform: "Meta" | "Google" | "TikTok" }) {
  if (platform === "Meta") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-400">
        <MetaIcon size={10} /> Meta
      </span>
    );
  }
  if (platform === "Google") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400">
        <GoogleIcon size={10} /> Google
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-pink-500/10 text-pink-400">
      TikTok
    </span>
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

function AdSetStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-[#475569]">{label}</p>
      <p className="text-white tabular-nums font-medium mt-0.5">{value}</p>
    </div>
  );
}
