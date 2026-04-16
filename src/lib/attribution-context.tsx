"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { ModelName } from "@/lib/attribution";

interface AttributionContextValue {
  activeModel: ModelName;
  setActiveModel: (model: ModelName) => void;
}

const AttributionContext = createContext<AttributionContextValue | null>(null);

export function AttributionProvider({ children }: { children: React.ReactNode }) {
  const [activeModel, setModel] = useState<ModelName>("lastClick");
  const setActiveModel = useCallback((m: ModelName) => setModel(m), []);

  return (
    <AttributionContext.Provider value={{ activeModel, setActiveModel }}>
      {children}
    </AttributionContext.Provider>
  );
}

const DEFAULT_VALUE: AttributionContextValue = {
  activeModel: "lastClick",
  setActiveModel: () => {},
};

export function useAttribution(): AttributionContextValue {
  const ctx = useContext(AttributionContext);
  return ctx ?? DEFAULT_VALUE;
}
