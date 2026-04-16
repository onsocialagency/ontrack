"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Client } from "@/lib/types";

interface ClientContextValue {
  clientSlug: string;
  clientName: string;
  clientLogo?: string;
  clientColor: string;
  isAdmin: boolean;
  /** Full client config — available for budget, currency, targets, etc. */
  clientConfig?: Client;
}

const ClientContext = createContext<ClientContextValue | null>(null);

export function ClientProvider({
  clientSlug,
  clientName,
  clientLogo,
  clientColor,
  isAdmin,
  clientConfig,
  children,
}: ClientContextValue & { children: ReactNode }) {
  return (
    <ClientContext.Provider value={{ clientSlug, clientName, clientLogo, clientColor, isAdmin, clientConfig }}>
      {children}
    </ClientContext.Provider>
  );
}

export function useClient(): ClientContextValue | null {
  return useContext(ClientContext);
}
