"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Tooltip } from "@/components/ui/tooltip";
import { useClient } from "@/lib/client-context";
import { useWindsor } from "@/lib/use-windsor";
import { useDateRange } from "@/lib/date-range-context";
import type { WindsorRow } from "@/lib/windsor";
import { formatCurrency, formatNumber, cn } from "@/lib/utils";
import { MetricCell } from "@/components/ui/metric-cell";
import {
  LEAD_TYPES,
  MINISTRY_BRAND,
  getCplStatus,
  CPL_STATUS_COLORS,
  aggregateByLeadType,
} from "@/lib/ministry-config";
import { MetaIcon, GoogleIcon } from "@/components/ui/platform-icons";
import { Lock, Info } from "lucide-react";

/* ── Mock Campaigns ── */

interface MockCampaign {
  name: string;
  platform: "meta" | "google";
  conversions: number;
  spend: number;
}

const MOCK_CAMPAIGNS: MockCampaign[] = [
  { name: "Ministry | Prospecting | Day Pass", platform: "meta", conversions: 48, spend: 420 },
  { name: "Ministry | Retargeting | Office Enquiry", platform: "meta", conversions: 35, spend: 310 },
  { name: "Ministry | Broad | Hot Desk", platform: "meta", conversions: 37, spend: 290 },
  { name: "Ministry - Brand - Search", platform: "google", conversions: 28, spend: 380 },
  { name: "Ministry - Generic - Coworking", platform: "google", conversions: 32, spend: 440 },
];

/* ── Helpers ── */

interface CampaignSummary {
  name: string;
  platform: "meta" | "google";
  conversions: number;
  spend: number;
}

function aggregateCampaigns(rows: WindsorRow[]): CampaignSummary[] {
  const map = new Map<string, CampaignSummary>();
  for (const row of rows) {
    const key = row.campaign;
    const existing = map.get(key);
    const platform = row.source === "facebook" ? "meta" : "google";
    if (existing) {
      existing.conversions += row.conversions;
      existing.spend += row.spend;
    } else {
      map.set(key, {
        name: row.campaign,
        platform,
        conversions: row.conversions,
        spend: row.spend,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.spend - a.spend);
}

/* ── Page ── */

export default function CrmReconciliationPage() {
  const { client: clientSlug } = useParams<{ client: string }>();
  const { days, preset, dateFrom, dateTo } = useDateRange();
  const customDateProps = preset === "Custom" ? { dateFrom, dateTo } : {};
  const ctx = useClient();
  const client = ctx?.clientConfig;

  const {
    data: windsorData,
    source: dataSource,
    loading: windsorLoading,
  } = useWindsor<WindsorRow[]>({
    clientSlug,
    type: "campaigns",
    days,
    ...customDateProps,
  });

  // Aggregate campaigns from Windsor or fall back to mock
  const campaigns = useMemo<CampaignSummary[]>(() => {
    if (windsorData && windsorData.length > 0) {
      return aggregateCampaigns(windsorData);
    }
    return MOCK_CAMPAIGNS;
  }, [windsorData]);

  // Totals
  const metaConversions = useMemo(
    () => campaigns.filter((c) => c.platform === "meta").reduce((s, c) => s + c.conversions, 0),
    [campaigns],
  );
  const googleConversions = useMemo(
    () => campaigns.filter((c) => c.platform === "google").reduce((s, c) => s + c.conversions, 0),
    [campaigns],
  );

  // Lead type breakdown from campaign names
  const leadTypeBreakdown = useMemo(() => {
    const rows = campaigns.map((c) => ({
      campaign: c.name,
      conversions: c.conversions,
      spend: c.spend,
      source: c.platform === "meta" ? "facebook" : "google_ads",
    }));
    return aggregateByLeadType(rows);
  }, [campaigns]);

  if (!client) return null;

  const currency = client.currency ?? "GBP";

  return (
    <>
      <Header title="CRM Reconciliation" dataBadge={{ loading: windsorLoading, isLive: dataSource === "windsor" }} />

      <div className="flex-1 p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-5 overflow-y-auto">

        {/* ── Top Three Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          {/* Meta Reported */}
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-xs font-medium text-[#94A3B8] uppercase tracking-wider">
                Meta Reported
              </span>
            </div>
            <p className="text-4xl font-bold text-white mt-2">
              {formatNumber(metaConversions)}
            </p>
            <p className="text-xs text-[#94A3B8] mt-2">
              Post-click + post-view (7-day window)
            </p>
          </div>

          {/* Google Reported */}
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-medium text-[#94A3B8] uppercase tracking-wider">
                Google Reported
              </span>
            </div>
            <p className="text-4xl font-bold text-white mt-2">
              {formatNumber(googleConversions)}
            </p>
            <p className="text-xs text-[#94A3B8] mt-2">
              Post-click only (30-day window)
            </p>
          </div>

          {/* HubSpot Confirmed */}
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 opacity-50">
            <div className="flex items-center gap-2 mb-1">
              <Lock size={12} className="text-[#94A3B8]" />
              <span className="text-xs font-medium text-[#94A3B8] uppercase tracking-wider">
                HubSpot Confirmed
              </span>
            </div>
            <p className="text-2xl font-semibold text-[#94A3B8] mt-2">
              Pending
            </p>
            <p className="text-xs text-[#94A3B8] mt-2">
              Connect HubSpot in Windsor to populate
            </p>
            <p className="text-[10px] text-[#94A3B8]/60 mt-1">
              CRM-confirmed via UTM matching
            </p>
          </div>
        </div>

        {/* ── Attribution Explanation Banner ── */}
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-5">
          <div className="flex gap-3 sm:gap-4">
            <div className="flex-shrink-0 pt-0.5">
              <Info size={16} className="text-[#C8A96E]" />
            </div>
            <div className={cn("border-l-2 pl-4 space-y-3")} style={{ borderColor: MINISTRY_BRAND.accentColor }}>
              <p className="text-sm text-[#94A3B8]">
                Meta includes post-view conversions. Google measures post-click only. HubSpot reflects leads confirmed in the CRM, matched back to campaigns via UTM parameters.
              </p>
              <p className="text-sm text-[#94A3B8]">
                These three numbers will never be identical. Discrepancies are expected and do not indicate a tracking error. The objective is not to eliminate discrepancies but to ensure like-for-like comparisons.
              </p>
              <p className="text-sm text-[#94A3B8]">
                For example: comparing Meta post-view conversions against Google post-click conversions is not methodologically correct. Each number in this section is clearly labelled with its source and measurement methodology.
              </p>
            </div>
          </div>
        </div>

        {/* ── Reconciliation Table ── */}
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-white/[0.06]">
            <h2 className="text-lg font-semibold text-white">Campaign Reconciliation</h2>
            <p className="text-xs text-[#94A3B8] mt-1">
              Side-by-side comparison across attribution sources
            </p>
          </div>

          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-5 py-3 text-xs font-medium text-[#94A3B8] uppercase tracking-wider min-w-[240px]">
                    Campaign
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-[#94A3B8] uppercase tracking-wider">
                    Platform
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[#94A3B8] uppercase tracking-wider">
                    <Tooltip content="Conversions reported by Meta within 7-day click / 1-day view attribution window">
                      <span className="cursor-help border-b border-dashed border-[#94A3B8]/40">
                        Meta Reported
                      </span>
                    </Tooltip>
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[#94A3B8] uppercase tracking-wider">
                    <Tooltip content="Conversions reported by Google within 30-day click attribution window">
                      <span className="cursor-help border-b border-dashed border-[#94A3B8]/40">
                        Google Reported
                      </span>
                    </Tooltip>
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[#94A3B8] uppercase tracking-wider">
                    <Tooltip content="Pending HubSpot connection. Will show CRM-confirmed leads matched via UTM parameters.">
                      <span className="cursor-help border-b border-dashed border-[#94A3B8]/40 opacity-50">
                        HubSpot Confirmed
                      </span>
                    </Tooltip>
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[#94A3B8] uppercase tracking-wider">
                    <Tooltip content="Once HubSpot is connected: (Meta + Google) - HubSpot confirmed. Shows potential double-counting across platforms.">
                      <span className="cursor-help border-b border-dashed border-[#94A3B8]/40 opacity-50">
                        Over-attribution Gap
                      </span>
                    </Tooltip>
                  </th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr
                    key={campaign.name}
                    className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-3 text-white font-medium min-w-[240px]">
                      {campaign.name}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider",
                          campaign.platform === "meta"
                            ? "bg-blue-500/20 text-blue-400"
                            : "bg-emerald-500/20 text-emerald-400",
                        )}
                      >
                        {campaign.platform === "meta" ? (
                          <MetaIcon className="w-3 h-3" />
                        ) : (
                          <GoogleIcon className="w-3 h-3" />
                        )}
                        {campaign.platform === "meta" ? "Meta" : "Google"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-white tabular-nums">
                      {campaign.platform === "meta" ? formatNumber(campaign.conversions) : (
                        <span className="text-[#94A3B8]/40">&mdash;</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-white tabular-nums">
                      {campaign.platform === "google" ? formatNumber(campaign.conversions) : (
                        <span className="text-[#94A3B8]/40">&mdash;</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-[#94A3B8]/40">&mdash;</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-[#94A3B8]/40">&mdash;</span>
                    </td>
                  </tr>
                ))}

                {/* Footer totals */}
                <tr className="bg-white/[0.02]">
                  <td className="px-5 py-3 text-white font-semibold">Total</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right text-white font-semibold tabular-nums">
                    {formatNumber(metaConversions)}
                  </td>
                  <td className="px-4 py-3 text-right text-white font-semibold tabular-nums">
                    {formatNumber(googleConversions)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-[#94A3B8]/40">&mdash;</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-[#94A3B8]/40">&mdash;</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Mobile reconciliation cards */}
          <div className="lg:hidden p-3 space-y-2">
            {campaigns.map((campaign) => (
              <div
                key={campaign.name}
                className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-white truncate flex-1 min-w-0">
                    {campaign.name}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase flex-shrink-0",
                      campaign.platform === "meta"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-emerald-500/20 text-emerald-400",
                    )}
                  >
                    {campaign.platform === "meta" ? (
                      <MetaIcon className="w-3 h-3" />
                    ) : (
                      <GoogleIcon className="w-3 h-3" />
                    )}
                    {campaign.platform === "meta" ? "Meta" : "Google"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.04]">
                  <MetricCell
                    label="Meta"
                    value={campaign.platform === "meta" ? formatNumber(campaign.conversions) : "—"}
                    emphasis={campaign.platform === "meta"}
                  />
                  <MetricCell
                    label="Google"
                    value={campaign.platform === "google" ? formatNumber(campaign.conversions) : "—"}
                    emphasis={campaign.platform === "google"}
                  />
                  <MetricCell label="HubSpot" value="—" />
                </div>
              </div>
            ))}
            <div className="rounded-xl border border-white/[0.10] bg-white/[0.05] p-3 space-y-2">
              <span className="text-sm font-bold text-white">Total</span>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.06]">
                <MetricCell label="Meta" value={formatNumber(metaConversions)} emphasis />
                <MetricCell label="Google" value={formatNumber(googleConversions)} emphasis />
                <MetricCell label="HubSpot" value="—" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Lead Type Breakdown ── */}
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-white/[0.06]">
            <h2 className="text-lg font-semibold text-white">Lead Type Performance vs Targets</h2>
          </div>

          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-5 py-3 text-xs font-medium text-[#94A3B8] uppercase tracking-wider">
                    Lead Type
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[#94A3B8] uppercase tracking-wider">
                    Platform Conversions
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[#94A3B8] uppercase tracking-wider">
                    CPL
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-[#94A3B8] uppercase tracking-wider">
                    vs Target
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[#94A3B8] uppercase tracking-wider opacity-50">
                    HubSpot Confirmed
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[#94A3B8] uppercase tracking-wider opacity-50">
                    HubSpot CPL
                  </th>
                </tr>
              </thead>
              <tbody>
                {LEAD_TYPES.map((leadType) => {
                  const breakdown = leadTypeBreakdown[leadType.id];
                  const conversions = breakdown?.conversions ?? 0;
                  const spend = breakdown?.spend ?? 0;
                  const cpl = conversions > 0 ? spend / conversions : 0;
                  const hasData = conversions > 0;
                  const status = hasData ? getCplStatus(cpl, leadType) : "no_target";
                  const statusStyle = CPL_STATUS_COLORS[status];

                  const targetLabel =
                    leadType.targetCplMin !== null && leadType.targetCplMax !== null
                      ? `${formatCurrency(leadType.targetCplMin, currency)}\u2013${formatCurrency(leadType.targetCplMax, currency)}`
                      : "No target";

                  return (
                    <tr
                      key={leadType.id}
                      className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-5 py-3 text-white font-medium">
                        {leadType.label}
                        {hasData && breakdown.campaigns.length > 0 && (
                          <span className="text-[10px] text-[#94A3B8]/50 block mt-0.5">
                            {breakdown.campaigns.length} campaign{breakdown.campaigns.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-white tabular-nums">
                        {hasData ? (
                          formatNumber(conversions)
                        ) : (
                          <span className="text-[#94A3B8]/40">&mdash;</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-white tabular-nums">
                        {hasData ? (
                          formatCurrency(cpl, currency)
                        ) : (
                          <span className="text-[#94A3B8]/40">&mdash;</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold",
                            statusStyle.bg,
                            statusStyle.text,
                          )}
                        >
                          {statusStyle.label}
                        </span>
                        <span className="text-[10px] text-[#94A3B8]/60 block mt-0.5">
                          {targetLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[#94A3B8]/40">&mdash;</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[#94A3B8]/40">&mdash;</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile lead type cards */}
          <div className="lg:hidden p-3 space-y-2">
            {LEAD_TYPES.map((leadType) => {
              const breakdown = leadTypeBreakdown[leadType.id];
              const conversions = breakdown?.conversions ?? 0;
              const spend = breakdown?.spend ?? 0;
              const cpl = conversions > 0 ? spend / conversions : 0;
              const hasData = conversions > 0;
              const status = hasData ? getCplStatus(cpl, leadType) : "no_target";
              const statusStyle = CPL_STATUS_COLORS[status];

              const targetLabel =
                leadType.targetCplMin !== null && leadType.targetCplMax !== null
                  ? `${formatCurrency(leadType.targetCplMin, currency)}\u2013${formatCurrency(leadType.targetCplMax, currency)}`
                  : "No target";

              return (
                <div
                  key={leadType.id}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-semibold text-white truncate block">
                        {leadType.label}
                      </span>
                      {hasData && breakdown.campaigns.length > 0 && (
                        <span className="text-[10px] text-[#94A3B8]/50 block mt-0.5">
                          {breakdown.campaigns.length} campaign{breakdown.campaigns.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold flex-shrink-0",
                        statusStyle.bg,
                        statusStyle.text,
                      )}
                    >
                      {statusStyle.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#94A3B8]/60">Target: {targetLabel}</p>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.04]">
                    <MetricCell
                      label="Conv"
                      value={hasData ? formatNumber(conversions) : "—"}
                      emphasis={hasData}
                    />
                    <MetricCell
                      label="CPL"
                      value={hasData ? formatCurrency(cpl, currency) : "—"}
                      emphasis={hasData}
                    />
                    <MetricCell label="CRM" value="—" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
