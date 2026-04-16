"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { PillToggle } from "@/components/ui/pill-toggle";
import { formatCurrency, cn } from "@/lib/utils";
import type { Currency, TierConfig, RevenueClient } from "@/lib/types";

/* ── Tier reference tables ── */

const tierTables: Record<string, TierConfig[]> = {
  GBP: [
    { tier: "premium", fee: 0, spendMin: 25000, spendMax: 999999, notes: "8% of spend above 25K" },
    { tier: "tier_4", fee: 4000, spendMin: 18000, spendMax: 25000, notes: "Fixed 4K" },
    { tier: "tier_3", fee: 3500, spendMin: 12000, spendMax: 18000, notes: "Fixed 3.5K" },
    { tier: "tier_2", fee: 2500, spendMin: 6000, spendMax: 12000, notes: "Fixed 2.5K" },
    { tier: "tier_1", fee: 2000, spendMin: 2000, spendMax: 6000, notes: "Fixed 2K" },
  ],
  USD: [
    { tier: "premium", fee: 5333, spendMin: 34000, spendMax: 999999, notes: "$5,333 + 8% above $34K" },
    { tier: "tier_4", fee: 5333, spendMin: 24600, spendMax: 34000, notes: "Fixed $5,333" },
    { tier: "tier_3", fee: 4800, spendMin: 16400, spendMax: 24600, notes: "Fixed $4,800" },
    { tier: "tier_2", fee: 3450, spendMin: 8200, spendMax: 16400, notes: "Fixed $3,450" },
    { tier: "tier_1", fee: 2750, spendMin: 2750, spendMax: 8200, notes: "Fixed $2,750" },
  ],
  EUR: [
    { tier: "premium", fee: 4680, spendMin: 29250, spendMax: 999999, notes: "4,680 + 8% above 29.25K" },
    { tier: "tier_4", fee: 4680, spendMin: 21000, spendMax: 29250, notes: "Fixed 4,680" },
    { tier: "tier_3", fee: 4095, spendMin: 14000, spendMax: 21000, notes: "Fixed 4,095" },
    { tier: "tier_2", fee: 2925, spendMin: 7000, spendMax: 14000, notes: "Fixed 2,925" },
    { tier: "tier_1", fee: 2300, spendMin: 2300, spendMax: 7000, notes: "Fixed 2,300" },
  ],
  AED: [
    { tier: "premium", fee: 0, spendMin: 125000, spendMax: 999999, notes: "8% of spend above 125K" },
    { tier: "tier_4", fee: 20000, spendMin: 90000, spendMax: 124000, notes: "Fixed 20K" },
    { tier: "tier_3", fee: 17500, spendMin: 60000, spendMax: 89000, notes: "Fixed 17.5K" },
    { tier: "tier_2", fee: 12500, spendMin: 30000, spendMax: 59000, notes: "Fixed 12.5K" },
    { tier: "tier_1", fee: 10000, spendMin: 10000, spendMax: 29000, notes: "Fixed 10K" },
  ],
};

const currencyTabs = [
  { value: "GBP", label: "GBP" },
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
  { value: "AED", label: "AED" },
];

/* ── Page ── */

export function RevenuePageClient({
  revenueClients,
}: {
  revenueClients: RevenueClient[];
}) {
  const [activeCurrency, setActiveCurrency] = useState("GBP");

  // Calculate total MRR (convert to GBP rough approximation)
  const fxToGBP: Record<string, number> = {
    GBP: 1,
    USD: 0.79,
    EUR: 0.86,
    AED: 0.22,
  };
  const totalMRR = revenueClients.reduce(
    (sum, rc) => sum + rc.retainerFee * (fxToGBP[rc.currency] || 1),
    0,
  );

  const activeTiers = tierTables[activeCurrency] || [];

  return (
    <>
      <Header title="Agency Revenue" />

      <div className="flex-1 p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-5 overflow-y-auto">
        {/* ── MRR Card ── */}
        <div className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#94A3B8] uppercase tracking-wider mb-1">
              Monthly Recurring Revenue (GBP equiv.)
            </p>
            <p className="text-3xl font-bold tracking-tight">
              {formatCurrency(totalMRR, "GBP")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[#94A3B8]">
              {revenueClients.length} active retainers
            </p>
          </div>
        </div>

        {/* ── Per-Client Revenue Table ── */}
        <section className="glass-card rounded-xl sm:rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/[0.08]">
            <h2 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider">
              Client Revenue
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="text-left p-4 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                    Client
                  </th>
                  <th className="text-center p-4 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                    Tier
                  </th>
                  <th className="text-right p-4 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                    Retainer Fee
                  </th>
                  <th className="text-center p-4 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                    Currency
                  </th>
                  <th className="text-right p-4 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                    Current Spend
                  </th>
                  <th className="text-center p-4 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                    Renewal
                  </th>
                  <th className="text-center p-4 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                    Flags
                  </th>
                </tr>
              </thead>
              <tbody>
                {revenueClients.map((rc) => (
                  <tr
                    key={rc.clientId}
                    className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="p-4 font-semibold text-white">
                      {rc.clientName}
                    </td>
                    <td className="p-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-[#FF6A41]/20 text-[#FF6A41]">
                        {rc.tier.replace("_", " ")}
                      </span>
                    </td>
                    <td className="p-4 text-right font-medium">
                      {formatCurrency(rc.retainerFee, rc.currency)}
                    </td>
                    <td className="p-4 text-center text-[#94A3B8]">
                      {rc.currency}
                    </td>
                    <td className="p-4 text-right font-medium">
                      {formatCurrency(rc.currentSpend, rc.currency)}
                    </td>
                    <td className="p-4 text-center text-[#94A3B8]">
                      {rc.renewalDate}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {rc.upsellFlag && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/20 text-emerald-400">
                            Upsell
                          </span>
                        )}
                        {rc.downgradeFlag && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-[#EF4444]/20 text-[#EF4444]">
                            Downgrade
                          </span>
                        )}
                        {!rc.upsellFlag && !rc.downgradeFlag && (
                          <span className="text-[#94A3B8]/40 text-xs">--</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Tier Reference Tables ── */}
        <section className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider whitespace-nowrap">
              Tier Pricing Reference
            </h2>
            <div className="overflow-x-auto flex-nowrap">
              <PillToggle
                options={currencyTabs}
                value={activeCurrency}
                onChange={setActiveCurrency}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="text-left p-3 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                    Tier
                  </th>
                  <th className="text-right p-3 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                    Fee
                  </th>
                  <th className="text-right p-3 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                    Spend Min
                  </th>
                  <th className="text-right p-3 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                    Spend Max
                  </th>
                  <th className="text-left p-3 text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                {activeTiers.map((t) => (
                  <tr
                    key={t.tier}
                    className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="p-3 font-semibold text-white capitalize">
                      {t.tier.replace("_", " ")}
                    </td>
                    <td className="p-3 text-right font-medium">
                      {t.fee > 0
                        ? formatCurrency(t.fee, activeCurrency as Currency)
                        : "--"}
                    </td>
                    <td className="p-3 text-right text-[#94A3B8]">
                      {formatCurrency(t.spendMin, activeCurrency as Currency)}
                    </td>
                    <td className="p-3 text-right text-[#94A3B8]">
                      {t.spendMax >= 999999
                        ? "No cap"
                        : formatCurrency(
                            t.spendMax,
                            activeCurrency as Currency,
                          )}
                    </td>
                    <td className="p-3 text-[#94A3B8]">{t.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
