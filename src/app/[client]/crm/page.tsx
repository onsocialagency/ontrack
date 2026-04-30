"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Tooltip } from "@/components/ui/tooltip";
import { useClient } from "@/lib/client-context";
import { useWindsor } from "@/lib/use-windsor";
import { useDateRange } from "@/lib/date-range-context";
import type { HubSpotContact, WindsorRow } from "@/lib/windsor";
import { sumConversions } from "@/lib/windsor";
import {
  categoriseLeadType,
  mapAnalyticsSourceToChannel,
  reconcileByCampaign,
  reconcileLeads,
  type LeadChannel,
} from "@/lib/leadReconciliation";
import { formatCurrency, formatNumber, cn } from "@/lib/utils";
import { MetricCell } from "@/components/ui/metric-cell";
import {
  LEAD_TYPES,
  MINISTRY_BRAND,
  getCplStatus,
  CPL_STATUS_COLORS,
} from "@/lib/ministry-config";
import { MetaIcon, GoogleIcon } from "@/components/ui/platform-icons";
import { Info } from "lucide-react";

/* ── Channel labels ── */

const CHANNEL_LABEL: Record<LeadChannel, string> = {
  meta: "Meta (Paid Social)",
  google: "Google (Paid Search)",
  organic: "Organic Search",
  direct: "Direct",
  email: "Email",
  referral: "Referrals",
  other: "Other / Offline",
};

/* ── Page ── */

export default function CrmReconciliationPage() {
  const { client: clientSlug } = useParams<{ client: string }>();
  const { days, preset, dateFrom, dateTo } = useDateRange();
  const customDateProps = preset === "Custom" ? { dateFrom, dateTo } : {};
  const ctx = useClient();
  const client = ctx?.clientConfig;

  const { data: windsorData, source: dataSource, loading: windsorLoading } = useWindsor<WindsorRow[]>({
    clientSlug,
    type: "campaigns",
    days,
    ...customDateProps,
  });

  const { data: hubspotData, loading: hubspotLoading } = useWindsor<HubSpotContact[]>({
    clientSlug,
    type: "hubspot",
    days,
    ...customDateProps,
  });

  const rows = windsorData ?? [];
  const contacts = hubspotData ?? [];

  const totals = useMemo(() => sumConversions(rows), [rows]);
  const reconciliation = useMemo(() => reconcileLeads(contacts, rows), [contacts, rows]);
  const campaignRows = useMemo(() => reconcileByCampaign(contacts, rows), [contacts, rows]);

  // Lead-type rollup for the lower table. Contacts keyed on the lead type
  // parsed from the HubSpot conversion event; platform conversions + spend
  // stay from Windsor for the CPL row so the "vs target" badge still works.
  const leadTypeHubSpotCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of contacts) {
      const t = categoriseLeadType(c.recentConversionEventName ?? c.firstConversionEventName);
      m.set(t, (m.get(t) ?? 0) + 1);
    }
    return m;
  }, [contacts]);

  if (!client) return null;

  if (client.type !== "lead_gen" && client.type !== "hybrid") {
    return (
      <>
        <Header title="CRM Reconciliation" showDateRange={false} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-[#12121A] border border-white/[0.06] rounded-2xl p-8 text-center space-y-2">
            <p className="text-sm text-[#94A3B8]">
              CRM reconciliation is only available for lead-gen and hybrid clients.
            </p>
          </div>
        </div>
      </>
    );
  }

  const currency = client.currency ?? "GBP";
  const loading = windsorLoading || hubspotLoading;

  return (
    <>
      <Header title="CRM Reconciliation" dataBadge={{ loading, isLive: dataSource === "windsor" }} />

      <div className="flex-1 p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-5 overflow-y-auto">

        {/* ── Top Three Cards — ordered by "hardness" of evidence ──
            Per Daisy's spec: Meta Claimed | Google Claimed | HubSpot
            Verified. The previous 4-card layout had a "HubSpot Total"
            soft-context card; that number now lives in the over-
            attribution ratio strip below + the untagged banner so the
            top row is purely "platform vs source-of-truth" comparison. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          {/* Meta Claimed */}
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-[10px] sm:text-xs font-medium text-[#94A3B8] uppercase tracking-wider">
                Meta Claimed
              </span>
            </div>
            <p className="text-3xl sm:text-4xl font-bold text-white mt-2">
              {formatNumber(totals.meta)}
            </p>
            <p className="text-[10px] sm:text-xs text-[#94A3B8] mt-2">
              Platform reported · 7d click / 1d view
            </p>
          </div>

          {/* Google Claimed */}
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[10px] sm:text-xs font-medium text-[#94A3B8] uppercase tracking-wider">
                Google Claimed
              </span>
            </div>
            <p className="text-3xl sm:text-4xl font-bold text-white mt-2">
              {formatNumber(totals.google)}
            </p>
            <p className="text-[10px] sm:text-xs text-[#94A3B8] mt-2">
              Platform reported · 30d click
            </p>
          </div>

          {/* HubSpot Verified — the agency-defensible number. Paid-source
              only by construction: reconcileLeads() puts a contact in the
              "verified" bucket only when matched via GTM event ID, fbclid/
              gclid, FB Lead Ads event, hsa_cam, or paid utm_medium +
              utm_source. Organic / direct contacts never land here. */}
          <div
            className="rounded-xl sm:rounded-2xl p-4 sm:p-6 border-2"
            style={{ borderColor: MINISTRY_BRAND.accentColor, background: `${MINISTRY_BRAND.accentColor}12` }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ background: MINISTRY_BRAND.accentColor }} />
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider" style={{ color: MINISTRY_BRAND.accentColor }}>
                HubSpot Verified
              </span>
            </div>
            <p className="text-3xl sm:text-4xl font-bold text-white mt-2">
              {formatNumber(reconciliation.totalAdVerified)}
            </p>
            <p className="text-[10px] sm:text-xs text-[#94A3B8] mt-2">
              Paid-source contacts only · matched via hsa_cam, fbclid/gclid, FB Lead Ads, or paid UTMs
            </p>
          </div>
        </div>

        {/* Over-attribution ratio — Meta + Google divided by HubSpot
            Verified. Lights up amber when platforms claim >2x what the
            CRM can prove. The number itself isn't bad — small ratios are
            normal due to platform view-through windows — but >2x is the
            agreed Ministry threshold for "platforms are over-counting". */}
        {(() => {
          const verified = reconciliation.totalAdVerified;
          const claimed = totals.meta + totals.google;
          const ratio = verified > 0 ? claimed / verified : 0;
          const flagged = ratio > 2;
          return (
            <div className={cn(
              "rounded-xl sm:rounded-2xl border p-3 sm:p-4 flex items-center justify-between gap-3 flex-wrap",
              flagged
                ? "bg-amber-500/10 border-amber-500/30"
                : "bg-white/[0.04] border-white/[0.06]",
            )}>
              <div className="flex items-center gap-3">
                <span className={cn(
                  "text-[10px] uppercase tracking-wider font-semibold",
                  flagged ? "text-amber-400" : "text-[#94A3B8]",
                )}>
                  Over-attribution ratio
                </span>
                <span className="text-xl font-bold tabular-nums text-white">
                  {verified > 0 ? `${ratio.toFixed(1)}×` : "—"}
                </span>
                <span className="text-[11px] text-[#64748B]">
                  {formatNumber(claimed)} claimed ÷ {formatNumber(verified)} verified
                </span>
              </div>
              {flagged && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-semibold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Above 2× threshold
                </span>
              )}
            </div>
          );
        })()}

        {/* Untagged-leads warning — when more than 20% of HubSpot
            contacts have no resolvable enquiry source (no event-name
            match, no URL path match, no UTM campaign), surface an amber
            banner. Tracked sources will under-count until this is fixed
            in GTM / form configuration. */}
        {reconciliation.untaggedRate > 0.2 && (
          <div className="rounded-xl sm:rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 sm:p-4 flex items-start gap-3">
            <Info size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-400">
                {Math.round(reconciliation.untaggedRate * 100)}% of HubSpot contacts have no source
              </p>
              <p className="text-[11px] text-amber-300/80 mt-0.5 leading-relaxed">
                {formatNumber(reconciliation.enquiryTagSources.untagged)} of{" "}
                {formatNumber(reconciliation.totalHubSpotLeads)} contacts couldn&apos;t
                be tagged from the data layer, event name, landing URL, or UTM
                campaign. Lead-type breakdowns and channel attribution will
                under-count these. Check the GTM data-layer push on forms
                where the enquiry_type field is missing.
              </p>
            </div>
          </div>
        )}

        {/* ── Attribution Explanation Banner ── */}
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-5">
          <div className="flex gap-3 sm:gap-4">
            <div className="flex-shrink-0 pt-0.5">
              <Info size={16} className="text-[#C8A96E]" />
            </div>
            <div className={cn("border-l-2 pl-4 space-y-3")} style={{ borderColor: MINISTRY_BRAND.accentColor }}>
              <p className="text-sm text-[#94A3B8]">
                Meta includes post-view conversions. Google measures post-click only. HubSpot reflects leads confirmed in the CRM, matched back to campaigns via the `hsa_cam` / `utm_campaign` parameters on the landing URL.
              </p>
              <p className="text-sm text-[#94A3B8]">
                These three numbers will never be identical. Discrepancies are expected and do not indicate a tracking error — they reveal over-attribution (platforms claiming conversions the CRM never saw) and under-attribution (leads whose UTM data was stripped).
              </p>
            </div>
          </div>
        </div>

        {/* ── Channel Reconciliation (top-level) ── */}
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-white/[0.06]">
            <h2 className="text-lg font-semibold text-white">Channel Reconciliation</h2>
            <p className="text-xs text-[#94A3B8] mt-1">
              <span style={{ color: MINISTRY_BRAND.accentColor }}>Verified</span> = cross-referenced to a live campaign. <span className="text-[#94A3B8]/70">HubSpot Tagged</span> = first-touch channel HubSpot picked, may not join back to a specific campaign.
            </p>
          </div>

          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-5 py-3 text-xs font-medium text-[#94A3B8] uppercase tracking-wider">Channel</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[#94A3B8] uppercase tracking-wider">Platform Claimed</th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: MINISTRY_BRAND.accentColor }}>
                    <Tooltip content="Leads whose landing URL joins to a live Windsor campaign, OR which came from a Facebook Lead Ads form. This is the agency-defensible number.">
                      <span className="cursor-help border-b border-dashed" style={{ borderColor: `${MINISTRY_BRAND.accentColor}80` }}>Verified</span>
                    </Tooltip>
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[#94A3B8] uppercase tracking-wider">
                    <Tooltip content="All HubSpot contacts with this first-touch channel. Includes contacts we can't join back to a specific campaign.">
                      <span className="cursor-help border-b border-dashed border-[#94A3B8]/40">HubSpot Tagged</span>
                    </Tooltip>
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[#94A3B8] uppercase tracking-wider">
                    <Tooltip content="Verified − Platform Claimed. Positive = HubSpot verified more than the pixel counted. Negative = platform over-reports vs CRM.">
                      <span className="cursor-help border-b border-dashed border-[#94A3B8]/40">Gap vs Claimed</span>
                    </Tooltip>
                  </th>
                </tr>
              </thead>
              <tbody>
                {reconciliation.byChannel
                  .filter((r) => r.platformClaimed > 0 || r.hubspotConfirmed > 0)
                  .map((r) => {
                    const verifiedGap = r.adVerified - r.platformClaimed;
                    return (
                      <tr key={r.channel} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3 text-white font-medium">{CHANNEL_LABEL[r.channel]}</td>
                        <td className="px-4 py-3 text-right text-white tabular-nums">
                          {r.platformClaimed > 0 ? formatNumber(r.platformClaimed) : <span className="text-[#94A3B8]/40">&mdash;</span>}
                        </td>
                        <td
                          className="px-4 py-3 text-right font-semibold tabular-nums"
                          style={{ color: r.adVerified > 0 ? MINISTRY_BRAND.accentColor : "#64748B" }}
                        >
                          {r.adVerified > 0 ? formatNumber(r.adVerified) : <span className="text-[#94A3B8]/40">&mdash;</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-[#94A3B8] tabular-nums">{formatNumber(r.hubspotConfirmed)}</td>
                        <td className={cn(
                          "px-4 py-3 text-right tabular-nums",
                          (r.channel === "meta" || r.channel === "google")
                            ? verifiedGap < 0 ? "text-amber-400" : verifiedGap > 0 ? "text-emerald-400" : "text-[#94A3B8]"
                            : "text-[#94A3B8]/40",
                        )}>
                          {(r.channel === "meta" || r.channel === "google")
                            ? `${verifiedGap > 0 ? "+" : ""}${formatNumber(verifiedGap)}`
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="lg:hidden p-3 space-y-2">
            {reconciliation.byChannel
              .filter((r) => r.platformClaimed > 0 || r.hubspotConfirmed > 0)
              .map((r) => (
                <div key={r.channel} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 space-y-2">
                  <span className="text-sm font-semibold text-white">{CHANNEL_LABEL[r.channel]}</span>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.04]">
                    <MetricCell label="Claimed" value={r.platformClaimed > 0 ? formatNumber(r.platformClaimed) : "—"} />
                    <MetricCell label="Verified" value={r.adVerified > 0 ? formatNumber(r.adVerified) : "—"} emphasis />
                    <MetricCell label="HS Tagged" value={formatNumber(r.hubspotConfirmed)} />
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* ── Campaign Reconciliation ── */}
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-white/[0.06]">
            <h2 className="text-lg font-semibold text-white">Campaign Reconciliation</h2>
            <p className="text-xs text-[#94A3B8] mt-1">
              HubSpot contacts joined to campaigns via `hsa_cam` / `utm_campaign` on the landing URL
            </p>
          </div>

          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-5 py-3 text-xs font-medium text-[#94A3B8] uppercase tracking-wider min-w-[240px]">Campaign</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-[#94A3B8] uppercase tracking-wider">Platform</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[#94A3B8] uppercase tracking-wider">Spend</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[#94A3B8] uppercase tracking-wider">Platform Claimed</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[#94A3B8] uppercase tracking-wider">HubSpot Confirmed</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[#94A3B8] uppercase tracking-wider">
                    <Tooltip content="Spend / HubSpot confirmed — the real CPL after the CRM's filter.">
                      <span className="cursor-help border-b border-dashed border-[#94A3B8]/40">Confirmed CPL</span>
                    </Tooltip>
                  </th>
                </tr>
              </thead>
              <tbody>
                {campaignRows.map((c) => (
                  <tr key={`${c.platform}::${c.campaignId ?? c.campaignName}`} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 text-white font-medium min-w-[240px]">{c.campaignName}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider",
                        c.platform === "meta" ? "bg-blue-500/20 text-blue-400" : "bg-emerald-500/20 text-emerald-400",
                      )}>
                        {c.platform === "meta" ? <MetaIcon className="w-3 h-3" /> : <GoogleIcon className="w-3 h-3" />}
                        {c.platform === "meta" ? "Meta" : "Google"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-white tabular-nums">{formatCurrency(c.spend, currency)}</td>
                    <td className="px-4 py-3 text-right text-white tabular-nums">{formatNumber(c.platformClaimed)}</td>
                    <td className="px-4 py-3 text-right text-white tabular-nums">{formatNumber(c.hubspotConfirmed)}</td>
                    <td className="px-4 py-3 text-right text-white tabular-nums">
                      {c.confirmedCpl != null ? formatCurrency(c.confirmedCpl, currency) : <span className="text-[#94A3B8]/40">&mdash;</span>}
                    </td>
                  </tr>
                ))}

                <tr className="bg-white/[0.02]">
                  <td className="px-5 py-3 text-white font-semibold">Total</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right text-white font-semibold tabular-nums">{formatCurrency(campaignRows.reduce((s, c) => s + c.spend, 0), currency)}</td>
                  <td className="px-4 py-3 text-right text-white font-semibold tabular-nums">{formatNumber(campaignRows.reduce((s, c) => s + c.platformClaimed, 0))}</td>
                  <td className="px-4 py-3 text-right text-white font-semibold tabular-nums">{formatNumber(campaignRows.reduce((s, c) => s + c.hubspotConfirmed, 0))}</td>
                  <td className="px-4 py-3 text-right" />
                </tr>
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="lg:hidden p-3 space-y-2">
            {campaignRows.map((c) => (
              <div key={`${c.platform}::${c.campaignId ?? c.campaignName}`} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-white truncate flex-1 min-w-0">{c.campaignName}</span>
                  <span className={cn(
                    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase flex-shrink-0",
                    c.platform === "meta" ? "bg-blue-500/20 text-blue-400" : "bg-emerald-500/20 text-emerald-400",
                  )}>
                    {c.platform === "meta" ? <MetaIcon className="w-3 h-3" /> : <GoogleIcon className="w-3 h-3" />}
                    {c.platform === "meta" ? "Meta" : "Google"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.04]">
                  <MetricCell label="Claimed" value={formatNumber(c.platformClaimed)} />
                  <MetricCell label="CRM" value={formatNumber(c.hubspotConfirmed)} emphasis />
                  <MetricCell label="CPL" value={c.confirmedCpl != null ? formatCurrency(c.confirmedCpl, currency) : "—"} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Lead Type Breakdown ── */}
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-white/[0.06]">
            <h2 className="text-lg font-semibold text-white">Lead Type Performance vs Targets</h2>
            <p className="text-xs text-[#94A3B8] mt-1">
              HubSpot lead types inferred from the contact&apos;s conversion event name
            </p>
          </div>

          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-5 py-3 text-xs font-medium text-[#94A3B8] uppercase tracking-wider">Lead Type</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[#94A3B8] uppercase tracking-wider">HubSpot Confirmed</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-[#94A3B8] uppercase tracking-wider">vs Target Range</th>
                </tr>
              </thead>
              <tbody>
                {LEAD_TYPES.map((leadType) => {
                  // Map ministry-config lead type id → leadReconciliation LeadType key
                  const key =
                    leadType.id === "day_pass" ? "DayPass"
                    : leadType.id === "general" ? "FacebookLead"
                    : leadType.id.includes("enquiry") ? "EnquiryForm"
                    : "EnquiryForm";
                  const count = leadTypeHubSpotCounts.get(key) ?? 0;
                  // No per-lead-type spend available from HubSpot alone — hide CPL vs target when count is 0
                  const hasData = count > 0;
                  const status = getCplStatus(0, leadType, hasData);
                  const statusStyle = CPL_STATUS_COLORS[status];
                  const targetLabel =
                    leadType.targetCplMin !== null && leadType.targetCplMax !== null
                      ? `${formatCurrency(leadType.targetCplMin, currency)}\u2013${formatCurrency(leadType.targetCplMax, currency)}`
                      : "No target";

                  return (
                    <tr key={leadType.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3 text-white font-medium">{leadType.label}</td>
                      <td className="px-4 py-3 text-right text-white tabular-nums">
                        {hasData ? formatNumber(count) : <span className="text-[#94A3B8]/40">&mdash;</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold", statusStyle.bg, statusStyle.text)}>
                          {statusStyle.label}
                        </span>
                        <span className="text-[10px] text-[#94A3B8]/60 block mt-0.5">{targetLabel}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Unattributed leads panel ── */}
        {reconciliation.unattributed.length > 0 && (
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-white/[0.06]">
              <h2 className="text-lg font-semibold text-white">Unattributed Leads</h2>
              <p className="text-xs text-[#94A3B8] mt-1">
                Contacts HubSpot classified as Direct Traffic or Other — UTMs likely stripped. Review manually.
              </p>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {reconciliation.unattributed.slice(0, 20).map((c) => (
                <div key={c.hsObjectId} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="text-white truncate">{c.firstname} {c.lastname} — {c.email}</p>
                    <p className="text-[11px] text-[#94A3B8]/70 truncate">
                      {c.recentConversionEventName ?? "No conversion event"} · {c.analyticsSource ?? "no source"}
                    </p>
                  </div>
                  <span className="text-[10px] text-[#94A3B8]/60 ml-3 flex-shrink-0">
                    {CHANNEL_LABEL[mapAnalyticsSourceToChannel(c.analyticsSource)]}
                  </span>
                </div>
              ))}
              {reconciliation.unattributed.length > 20 && (
                <p className="px-5 py-3 text-xs text-[#94A3B8]/60">
                  +{reconciliation.unattributed.length - 20} more unattributed leads
                </p>
              )}
            </div>
          </div>
        )}

      </div>
    </>
  );
}
