"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { DateRangeProvider } from "@/lib/date-range-context";
import { LocaleProvider } from "@/lib/locale-context";
import { ClientProvider } from "@/lib/client-context";
import { AttributionProvider } from "@/lib/attribution-context";
import { VenueProvider } from "@/lib/venue-context";
import { SuggestionAlertProvider } from "@/lib/suggestion-alert-context";
import { cn } from "@/lib/utils";
import type { Client } from "@/lib/types";

/* ── Types ── */

type ClientType = "ecommerce" | "lead_gen" | "hybrid";

interface ClientLayoutProps {
  clientSlug: string;
  clientType: ClientType;
  clientName: string;
  clientColor: string;
  clientLogo?: string;
  clientLocale?: string;
  clientTimezone?: string;
  isAdmin?: boolean;
  clientConfig?: Client;
  children: React.ReactNode;
}

/* ── Component ── */

export function ClientLayout({
  clientSlug,
  clientType,
  clientName,
  clientColor,
  clientLogo,
  clientLocale,
  clientTimezone,
  isAdmin = false,
  clientConfig,
  children,
}: ClientLayoutProps) {
  const isIrg = clientSlug === "irg";

  const inner = (
    <div className="flex min-h-screen overflow-x-hidden">
      <Sidebar
        mode="client"
        clientSlug={clientSlug}
        clientType={clientType}
        clientName={clientName}
        clientColor={clientColor}
        clientLogo={clientLogo}
        isAdmin={isAdmin}
      />
      <main
        className={cn(
          "flex-1 flex flex-col min-h-screen min-w-0",
          "ml-0 lg:ml-[240px]",
          "transition-all duration-300",
        )}
      >
        {children}
      </main>
    </div>
  );

  return (
    <LocaleProvider locale={clientLocale} timezone={clientTimezone}>
      <ClientProvider clientSlug={clientSlug} clientName={clientName} clientLogo={clientLogo} clientColor={clientColor} isAdmin={isAdmin} clientConfig={clientConfig}>
        <DateRangeProvider>
        <AttributionProvider>
          <SuggestionAlertProvider>
            {isIrg ? <VenueProvider>{inner}</VenueProvider> : inner}
          </SuggestionAlertProvider>
        </AttributionProvider>
        </DateRangeProvider>
      </ClientProvider>
    </LocaleProvider>
  );
}

export default ClientLayout;
