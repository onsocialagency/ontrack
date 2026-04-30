"use client";

/**
 * IRG brand selector — pill tabs.
 *
 * Order per the 29 April 2026 brief:
 *   All brands · Ibiza Rocks Events · 528 Ibiza · Pikes Presents · Pool Club
 *
 * IR Hotel is intentionally absent — it's a read-only brand surfaced
 * as a muted context row beneath tables, not as a brand filter.
 *
 * Active pill uses OnSocial green; inactive pills are muted text on
 * a transparent background. Brand color dot is omitted on the active
 * state (the green bg communicates active enough).
 */

import { cn } from "@/lib/utils";
import { useVenue, type VenueTab } from "@/lib/venue-context";
import { IRG_BRAND_PILL_ORDER, IRG_BRANDS } from "@/lib/irg-brands";

const TABS: { id: VenueTab; label: string; color?: string }[] = [
  { id: "all", label: "All brands" },
  ...IRG_BRAND_PILL_ORDER.map((id) => ({
    id: id as VenueTab,
    label: IRG_BRANDS[id].shortLabel,
    color: IRG_BRANDS[id].color,
  })),
];

export function VenueTabs() {
  const { activeVenue, setActiveVenue } = useVenue();

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {TABS.map((tab) => {
        const isActive = activeVenue === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveVenue(tab.id)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all whitespace-nowrap",
              isActive
                ? "bg-[#1D9E75] text-white shadow-sm"
                : "text-white/40 hover:text-white/80 hover:bg-white/[0.04] border border-transparent",
            )}
          >
            {!isActive && tab.color && (
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: tab.color }}
              />
            )}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
