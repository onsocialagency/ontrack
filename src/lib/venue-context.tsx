"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { IrgBrandId } from "@/lib/irg-brands";

export type VenueTab = "all" | IrgBrandId;

interface VenueContextValue {
  activeVenue: VenueTab;
  setActiveVenue: (venue: VenueTab) => void;
}

const VenueContext = createContext<VenueContextValue | null>(null);

export function VenueProvider({ children }: { children: React.ReactNode }) {
  const [activeVenue, setVenue] = useState<VenueTab>("all");
  const setActiveVenue = useCallback((v: VenueTab) => setVenue(v), []);

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
