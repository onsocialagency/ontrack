"use client";

/**
 * Venue / brand context for IRG.
 *
 * Active brand is persisted to the `?brand=` URL param so the
 * selection survives tab navigation (Overview → Campaigns → Events →
 * etc.). The 29 April 2026 IRG brief required this explicitly.
 *
 * Hotel is intentionally NOT a pill option — it's a read-only
 * context brand surfaced in muted rows beneath relevant tables.
 */

import { createContext, useContext, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { IRG_BRAND_PILL_ORDER, type IrgBrandId } from "@/lib/irg-brands";

export type VenueTab = "all" | IrgBrandId;

const VALID_PILL_VALUES = new Set<VenueTab>(["all", ...IRG_BRAND_PILL_ORDER]);

function parseBrand(raw: string | null): VenueTab {
  if (!raw) return "all";
  return VALID_PILL_VALUES.has(raw as VenueTab) ? (raw as VenueTab) : "all";
}

interface VenueContextValue {
  activeVenue: VenueTab;
  setActiveVenue: (venue: VenueTab) => void;
}

const VenueContext = createContext<VenueContextValue | null>(null);

export function VenueProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialise from URL on mount + every time the search params change.
  // Falls back to "all" when no/invalid brand is in the URL.
  const [activeVenue, setVenue] = useState<VenueTab>(() => parseBrand(searchParams.get("brand")));

  // Keep state in sync with the URL when the user navigates back/forward
  // or arrives via a deep link.
  useEffect(() => {
    const next = parseBrand(searchParams.get("brand"));
    setVenue((prev) => (prev === next ? prev : next));
  }, [searchParams]);

  const setActiveVenue = useCallback(
    (v: VenueTab) => {
      setVenue(v);
      // Mutate the existing query string so other params (date range etc.)
      // are preserved. "all" → drop the param entirely so URLs stay clean.
      const params = new URLSearchParams(searchParams.toString());
      if (v === "all") params.delete("brand");
      else params.set("brand", v);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  return (
    <VenueContext.Provider value={{ activeVenue, setActiveVenue }}>
      {children}
    </VenueContext.Provider>
  );
}

const DEFAULT_VALUE: VenueContextValue = {
  activeVenue: "all",
  setActiveVenue: () => {},
};

export function useVenue(): VenueContextValue {
  const ctx = useContext(VenueContext);
  return ctx ?? DEFAULT_VALUE;
}
