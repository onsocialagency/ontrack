"use client";

/**
 * IRG Creative Lab view.
 *
 * Per the 29 April 2026 brief — IRG-specific scoring rules:
 *
 *   Awareness / prospecting ads:
 *     scored on reach, CPM, hook rate, hold rate
 *     NOT on ROAS or CPA
 *     badge: "Awareness — not judged on ROAS"
 *
 *   Conversion ads (tickets, day passes):
 *     scored on CPA per ticket, ROAS, CTR
 *
 *   TikTok renders as a separate section (never combined with Meta):
 *     no ROAS, no CPA columns
 *     hook rate = 2-second views ÷ impressions (not 3-second like Meta)
 *     fatigue threshold = 7 days
 *
 *   Fatigue thresholds:
 *     Meta 30d > 3.5x      = REFRESH (red)
 *     Meta 30d 2.5–3.5x    = Monitor (amber)
 *     Meta 30d < 2.5x      = Fresh (green)
 *     TikTok 7d > 2.5x     = REFRESH (red)
 *
 * Mock data via `getIrgCreatives()`.
 */

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { VenueTabs } from "@/components/layout/venue-tabs";
import { useVenue } from "@/lib/venue-context";
import { useDateRange } from "@/lib/date-range-context";
import { useWindsor } from "@/lib/use-windsor";
import type { WindsorRow } from "@/lib/windsor";
import { cn } from "@/lib/utils";
import { IRG_BRANDS } from "@/lib/irg-brands";
import {
  getIrgCreatives,
  type IrgCreativeRow,
  type IrgCreativeRole,
  type IrgCreativePillar,
  type IrgAudienceSkew,
} from "@/lib/irg-mock";
import { aggregateCreatives } from "@/lib/irg-live";
import { Sparkles, AlertTriangle, Music2 } from "lucide-react";

const CARD_BG = "bg-white/[0.04]";const CARD_BORDER = "border-white/[0.06]";const ACCENT_GREEN = "#1D9E75";
const ACCENT_GOLD = "#C8A96E";

function fmtEur(v: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
}
function fmtEurPrecise(v: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(v);
}
function fmtNumber(v: number): string {
  return new Intl.NumberFormat("en-GB").format(v);
}

export default function IrgCreativeLabView() {
  const { client: clientSlug } = useParams<{ client: string }>();
  const { activeVenue } = useVenue();
  const { days, preset, dateFrom, dateTo } = useDateRange();
  const customDateProps = preset === "Custom" ? { dateFrom, dateTo } : {};

  // Live creatives feed — 1,519 ad-day rows for IRG. aggregateCreatives
  // groups by ad_id, derives role/pillar/audience from name patterns,
  // computes hook rate as video_p25 / video_plays, hold rate as
  // video_p75 / video_p25, frequency as impression-weighted average.
  const { data: liveData } = useWindsor<WindsorRow[]>({
    clientSlug,
    type: "creatives",
    days,
    ...customDateProps,
  });

  const all = useMemo<IrgCreativeRow[]>(() => {
    if (liveData && liveData.length > 0) {
      const live = aggregateCreatives(liveData);
      if (live.length > 0) return live;
    }
    return getIrgCreatives();
  }, [liveData]);

  const [roleFilter, setRoleFilter] = useState<"all" | IrgCreativeRole>("all");
  const [pillarFilter, setPillarFilter] = useState<"all" | IrgCreativePillar>("all");
  const [audienceFilter, setAudienceFilter] = useState<"all" | IrgAudienceSkew>("all");

  const filtered = useMemo(() => {
    let rows = all;
    if (activeVenue !== "all") rows = rows.filter((r) => r.brand === activeVenue);
    if (roleFilter !== "all") rows = rows.filter((r) => r.role === roleFilter);
    if (pillarFilter !== "all") rows = rows.filter((r) => r.pillar === pillarFilter);
    if (audienceFilter !== "all") rows = rows.filter((r) => r.audienceSkew === audienceFilter);
    return rows;
  }, [all, activeVenue, roleFilter, pillarFilter, audienceFilter]);

  const meta = filtered.filter((r) => r.platform === "Meta");
  const tiktok = filtered.filter((r) => r.platform === "TikTok");

  return (
    <>
      <Header title="Creative Lab" />

      <div
        className="flex-1 px-4 sm:px-6 py-4 sm:py-6 space-y-5 overflow-y-auto"

      >
        <VenueTabs />

        {/* Filters */}
        <div className={cn("rounded-xl sm:rounded-2xl border p-3 flex flex-wrap items-center gap-3", CARD_BG, CARD_BORDER)}>
          <Pills
            label="Role"
            value={roleFilter}
            options={[
              { id: "all", label: "All" },
              { id: "Awareness", label: "Awareness" },
              { id: "Conversion", label: "Conversion" },
              { id: "Retargeting", label: "Retargeting" },
            ]}
            onChange={(v) => setRoleFilter(v as typeof roleFilter)}
          />
          <span className="h-5 w-px bg-white/[0.06] hidden sm:block" />
          <Pills
            label="Pillar"
            value={pillarFilter}
            options={[
              { id: "all", label: "All" },
              { id: "Brand story", label: "Brand story" },
              { id: "Artist hype", label: "Artist hype" },
              { id: "Day-pass", label: "Day-pass" },
              { id: "Hotel + events", label: "Hotel + events" },
              { id: "Social proof", label: "Social proof" },
            ]}
            onChange={(v) => setPillarFilter(v as typeof pillarFilter)}
          />
          <span className="h-5 w-px bg-white/[0.06] hidden sm:block" />
          <Pills
            label="Audience"
            value={audienceFilter}
            options={[
              { id: "all", label: "All" },
              { id: "Younger", label: "Younger" },
              { id: "Mixed", label: "Mixed" },
              { id: "Older", label: "Older" },
            ]}
            onChange={(v) => setAudienceFilter(v as typeof audienceFilter)}
          />
          <span className="ml-auto text-[11px] text-[#64748B]">
            {filtered.length} {filtered.length === 1 ? "creative" : "creatives"}
          </span>
        </div>

        {/* Meta section */}
        <section>
          <div className="flex items-baseline justify-between gap-2 mb-3 flex-wrap">
            <h2 className="text-[10px] uppercase tracking-wider font-semibold text-[#94A3B8]">
              Meta — conversion + awareness
            </h2>
            <p className="text-[10px] text-[#475569]">
              Hook rate = 3-second views ÷ impressions · Fatigue threshold 30d
            </p>
          </div>
          {meta.length === 0 ? (
            <p className={cn("rounded-xl sm:rounded-2xl border p-6 text-center text-[#64748B] text-sm", CARD_BG, CARD_BORDER)}>
              No Meta creatives match the current filters.
            </p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
              {meta.map((c) => (
                <CreativeCard key={c.id} creative={c} platform="Meta" />
              ))}
            </div>
          )}
        </section>

        {/* TikTok section — separate from Meta, no ROAS/CPA */}
        <section>
          <div className="flex items-baseline justify-between gap-2 mb-3 flex-wrap">
            <h2 className="text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1.5" style={{ color: ACCENT_GOLD }}>
              <Music2 size={11} />
              TikTok — awareness platform
            </h2>
            <p className="text-[10px] text-[#475569]">
              Hook rate = 2-second views · Fatigue threshold 7d · No ROAS / CPA
            </p>
          </div>
          {tiktok.length === 0 ? (
            <p className={cn("rounded-xl sm:rounded-2xl border p-6 text-center text-[#64748B] text-sm", CARD_BG, CARD_BORDER)}>
              No TikTok creatives match the current filters.
            </p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
              {tiktok.map((c) => (
                <CreativeCard key={c.id} creative={c} platform="TikTok" />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

/* ── Pieces ── */

function Pills<T extends string>({
  label,
  value,
  options,
  onChange,
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

function CreativeCard({ creative, platform }: { creative: IrgCreativeRow; platform: "Meta" | "TikTok" }) {
  const brand = IRG_BRANDS[creative.brand];
  const isAwareness = creative.role === "Awareness";

  // Fatigue label per platform window
  const fatigue = (() => {
    if (platform === "TikTok") {
      if (creative.frequency > 2.5) return { label: "Refresh", colour: "#c0392b" };
      return { label: "Fresh", colour: ACCENT_GREEN };
    }
    if (creative.frequency > 3.5) return { label: "Refresh", colour: "#c0392b" };
    if (creative.frequency >= 2.5) return { label: "Monitor", colour: "#d97706" };
    return { label: "Fresh", colour: ACCENT_GREEN };
  })();

  return (
    <div className={cn("rounded-xl sm:rounded-2xl border overflow-hidden", CARD_BG, CARD_BORDER)}>
      {/* 3px accent bar */}
      <div className="h-[3px] w-full" style={{ backgroundColor: brand.color }} />
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[12px] text-white font-medium truncate" title={creative.name}>
              {creative.name}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[10px] text-[#94A3B8]">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: brand.color }} />
                {brand.shortLabel}
              </span>
              <Pill colour={isAwareness ? "#3a8eff" : ACCENT_GREEN} label={creative.role} />
              <Pill colour={ACCENT_GOLD} label={creative.pillar} faint />
              <Pill colour="#94A3B8" label={creative.audienceSkew} faint />
            </div>
          </div>
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider flex-shrink-0"
            style={{ backgroundColor: `${fatigue.colour}20`, color: fatigue.colour }}
          >
            {fatigue.label}
          </span>
        </div>

        {/* Awareness banner */}
        {isAwareness && (
          <div
            className="flex items-center gap-1.5 text-[10px] rounded px-2 py-1"
            style={{ backgroundColor: "rgba(58,142,255,0.1)", color: "#60A5FA" }}
          >
            <Sparkles size={10} />
            Awareness — not judged on ROAS
          </div>
        )}

        {creative.associatedEvent && (
          <p className="text-[10px] text-[#94A3B8]">
            Event: <span className="text-white/65">{creative.associatedEvent}</span>
          </p>
        )}

        {/* Metrics grid — different shape per platform/role */}
        <div className="grid grid-cols-3 gap-2 pt-1.5 border-t border-white/[0.04]">
          <Stat label="Spend" value={fmtEur(creative.spend)} />
          <Stat label="Reach" value={fmtNumber(creative.reach)} />
          <Stat label="CPM" value={fmtEurPrecise(creative.cpm)} />
          <Stat
            label={platform === "TikTok" ? "Hook (2s)" : "Hook (3s)"}
            value={`${creative.hookRate.toFixed(1)}%`}
          />
          <Stat label="Hold" value={`${creative.holdRate.toFixed(1)}%`} />
          {platform === "TikTok" ? (
            <Stat label="Freq 7d" value={`${creative.frequency.toFixed(1)}x`} colour={fatigue.colour} />
          ) : (
            <Stat label="CTR" value={`${creative.ctr.toFixed(2)}%`} />
          )}
          {platform === "Meta" && !isAwareness && (
            <>
              <Stat label="FV sales" value={fmtNumber(creative.fourVenuesSales)} highlight />
              <Stat
                label="CPA"
                value={creative.cpaPerCreative !== null ? fmtEurPrecise(creative.cpaPerCreative) : "—"}
              />
              <Stat
                label="ROAS"
                value={creative.roas !== null ? `${creative.roas.toFixed(2)}x` : "—"}
                highlight={creative.roas !== null && creative.roas >= 10}
              />
            </>
          )}
          {platform === "Meta" && isAwareness && (
            <>
              <Stat label="Freq 30d" value={`${creative.frequency.toFixed(1)}x`} colour={fatigue.colour} />
              <Stat label="ROAS" value="n/a" muted />
              <Stat label="CPA" value="n/a" muted />
            </>
          )}
        </div>

        {/* Frequency warning — only when creative has crossed the threshold */}
        {fatigue.label === "Refresh" && (
          <div
            className="flex items-center gap-1.5 text-[10px] rounded px-2 py-1"
            style={{ backgroundColor: "rgba(192,57,43,0.1)", color: "#fca5a5" }}
          >
            <AlertTriangle size={10} />
            Frequency above threshold — refresh creative or rotate audience.
          </div>
        )}
      </div>
    </div>
  );
}

function Pill({ colour, label, faint }: { colour: string; label: string; faint?: boolean }) {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium"
      style={{ backgroundColor: `${colour}${faint ? "12" : "20"}`, color: colour }}
    >
      {label}
    </span>
  );
}

function Stat({
  label,
  value,
  highlight,
  muted,
  colour,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  muted?: boolean;
  colour?: string;
}) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-[#475569]">{label}</p>
      <p
        className="text-[12px] font-semibold tabular-nums mt-0.5"
        style={{ color: muted ? "rgba(255,255,255,0.3)" : colour ?? (highlight ? ACCENT_GREEN : "#f0ede8") }}
      >
        {value}
      </p>
    </div>
  );
}
