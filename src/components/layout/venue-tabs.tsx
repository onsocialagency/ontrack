"use client";

import { cn } from "@/lib/utils";
import { useVenue, type VenueTab } from "@/lib/venue-context";
import { IRG_BRAND_ORDER, IRG_BRANDS } from "@/lib/irg-brands";

const TABS: { id: VenueTab; label: string; color?: string }[] = [
  { id: "all", label: "All Venues" },
  ...IRG_BRAND_ORDER.map((id) => ({
    id: id as VenueTab,
    label: IRG_BRANDS[id].shortLabel,
    color: IRG_BRANDS[id].color,
  })),
];

export function VenueTabs() {
  const { activeVenue, setActiveVenue } = useVenue();

  return (
    <div className="flex items-center gap-1">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveVenue(tab.id)}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap",
            activeVenue === tab.id
              ? "bg-white/[0.12] text-white"
              : "text-[#64748B] hover:text-[#94A3B8] hover:bg-white/[0.04]",
          )}
        >
          {tab.color && (
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: tab.color }}
            />
          )}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
