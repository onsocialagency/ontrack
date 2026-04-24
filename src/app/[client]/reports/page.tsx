"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Tooltip } from "@/components/ui/tooltip";
import { getClientKPIs, getClientCampaigns } from "@/lib/mock-data";
import { useClient } from "@/lib/client-context";
import { useWindsor } from "@/lib/use-windsor";
import { useDateRange } from "@/lib/date-range-context";
import type { WindsorRow } from "@/lib/windsor";
import { sumConversions, rowConversions } from "@/lib/windsor";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/locale-context";
import { VenueTabs } from "@/components/layout/venue-tabs";
import { FileText, Send, Download, Clock, Loader2, Trash2, Eye } from "lucide-react";

/* ── Windsor aggregation helpers ── */

function aggregateKPIs(rows: WindsorRow[]) {
  const spend = rows.reduce((s, r) => s + (Number(r.spend) || 0), 0);
  const impressions = rows.reduce((s, r) => s + (Number(r.impressions) || 0), 0);
  const clicks = rows.reduce((s, r) => s + (Number(r.clicks) || 0), 0);
  // Shared conversion summation with Google primary→all_conversions fallback
  // (see lib/windsor.ts). Keeps reports consistent with overview pages.
  const c = sumConversions(rows);
  const revenue = c.revenue;
  const conversions = c.total;
  return {
    spend: +spend.toFixed(2),
    revenue: +revenue.toFixed(2),
    roas: spend > 0 ? +(revenue / spend).toFixed(2) : 0,
    mer: spend > 0 ? +(revenue / spend).toFixed(2) : 0,
    cpa: conversions > 0 ? +(spend / conversions).toFixed(2) : 0,
    conversions: Math.round(conversions),
    impressions: Math.round(impressions),
    clicks: Math.round(clicks),
  };
}

function aggregateCampaigns(rows: WindsorRow[]) {
  const useAllConvFallback = sumConversions(rows).usedGoogleAllFallback;
  const map: Record<string, { name: string; spend: number; revenue: number; conversions: number; roas: number }> = {};
  for (const r of rows) {
    const key = `${r.source}::${r.campaign}`;
    if (!map[key]) {
      map[key] = { name: r.campaign, spend: 0, revenue: 0, conversions: 0, roas: 0 };
    }
    const rc = rowConversions(r, useAllConvFallback);
    map[key].spend += Number(r.spend) || 0;
    map[key].revenue += rc.revenue;
    map[key].conversions += rc.conversions;
  }
  return Object.values(map)
    .map((c) => ({ ...c, roas: c.spend > 0 ? +(c.revenue / c.spend).toFixed(2) : 0 }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 8);
}

/* ── Constants ── */

const METRIC_OPTIONS_ECOM = [
  "Spend", "ROAS", "MER", "CPA", "CPL", "Impressions",
  "Clicks", "CTR", "Conversions", "Revenue", "AOV", "Frequency",
];

// Lead-gen clients (Ministry, etc.) never trade on ROAS/revenue/AOV —
// hide the ecommerce-only metrics so they can't be picked for a report.
const METRIC_OPTIONS_LEADGEN = [
  "Spend", "CPL", "CPA", "Impressions",
  "Clicks", "CTR", "Conversions", "Frequency",
];

const LAYOUT_OPTIONS = [
  { value: "executive", label: "Executive Summary", description: "KPIs + key insights for stakeholders" },
  { value: "detailed", label: "Detailed Report", description: "Full breakdown with campaign data" },
  { value: "creative", label: "Creative Performance", description: "Ad creative metrics + scoring" },
  { value: "campaign", label: "Campaign Breakdown", description: "Campaign-level table" },
];

const DATE_LABELS: Record<string, string> = {
  "7d": "Last 7 days",
  "14d": "Last 14 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  MTD: "Month to date",
  QTD: "Quarter to date",
};

/* ── Saved Report type ── */

interface SavedReport {
  id: string;
  name: string;
  date: string;
  type: string;
  dateRange: string;
  metrics: string[];
}

/* ── Page ── */

export default function ReportsPage() {
  const { client: clientSlug } = useParams<{ client: string }>();
  const isIrg = clientSlug === "irg";
  const ctx = useClient();
  const clientOrNull = ctx?.clientConfig;
  const { locale: clientLocale, fullDate: fmtFullDate } = useLocale();
  const { days, preset, dateFrom, dateTo } = useDateRange();
  const customDateProps = preset === "Custom" ? { dateFrom, dateTo } : {};
  const mockKpis = getClientKPIs(clientSlug, clientOrNull ?? undefined);
  const mockCampaigns = getClientCampaigns(clientSlug, undefined, clientOrNull ?? undefined);

  const { data: windsorData, source: dataSource, loading: windsorLoading } = useWindsor<WindsorRow[]>({
    clientSlug,
    type: "campaigns",
    days,
    ...customDateProps,
  });

  const isLive = dataSource === "windsor" && windsorData && windsorData.length > 0;

  const kpis = useMemo(() => {
    if (isLive) return aggregateKPIs(windsorData);
    return {
      spend: mockKpis.spend,
      revenue: mockKpis.revenue,
      roas: mockKpis.roas,
      mer: mockKpis.mer,
      cpa: mockKpis.cpa,
      conversions: mockKpis.conversions,
      impressions: mockKpis.impressions,
      clicks: Math.round(mockKpis.impressions * 0.022),
    };
  }, [isLive, windsorData, mockKpis]);

  const topCampaigns = useMemo(() => {
    if (isLive) return aggregateCampaigns(windsorData);
    return mockCampaigns
      .filter((c) => c.level === "campaign")
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 8)
      .map((c) => ({
        name: c.name,
        spend: c.spend,
        roas: c.roas,
        conversions: c.conversions,
        revenue: c.spend * c.roas,
      }));
  }, [isLive, windsorData, mockCampaigns]);

  const isLeadGen = clientOrNull?.type === "lead_gen";
  const METRIC_OPTIONS = isLeadGen ? METRIC_OPTIONS_LEADGEN : METRIC_OPTIONS_ECOM;
  const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(
    new Set(isLeadGen
      ? ["Spend", "CPL", "CPA", "Conversions", "Clicks"]
      : ["Spend", "ROAS", "CPA", "Conversions", "Revenue"]),
  );
  const [layout, setLayout] = useState("executive");
  const [dateRange, setDateRange] = useState("30d");
  const [generating, setGenerating] = useState(false);
  const [slackSending, setSlackSending] = useState(false);

  // Saved reports — persisted in localStorage
  const storageKey = `ontrack-saved-reports-${clientSlug}`;
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) setSavedReports(JSON.parse(stored));
    } catch {
      // ignore
    }
  }, [storageKey]);

  function saveReport(reportName: string) {
    const report: SavedReport = {
      id: `rpt_${Date.now()}`,
      name: reportName,
      date: new Date().toLocaleDateString(clientLocale),
      type: LAYOUT_OPTIONS.find((l) => l.value === layout)?.label || layout,
      dateRange,
      metrics: Array.from(selectedMetrics),
    };
    const updated = [report, ...savedReports].slice(0, 20); // Keep last 20
    setSavedReports(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  }

  function deleteReport(id: string) {
    const updated = savedReports.filter((r) => r.id !== id);
    setSavedReports(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  }

  if (!clientOrNull) return null;
  const client = clientOrNull;

  function toggleMetric(metric: string) {
    setSelectedMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(metric)) next.delete(metric);
      else next.add(metric);
      return next;
    });
  }

  async function handleGeneratePDF() {
    setGenerating(true);
    try {
      const [{ pdf }, { ReportDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/lib/report-pdf"),
      ]);

      const reportData = {
        clientName: client.name,
        clientColor: client.primaryColor,
        currency: client.currency,
        dateRange: DATE_LABELS[dateRange] ?? dateRange,
        generatedAt: fmtFullDate(new Date()),
        metrics: {
          spend: kpis.spend,
          revenue: kpis.revenue,
          roas: kpis.roas,
          mer: kpis.mer,
          cpa: kpis.cpa,
          conversions: kpis.conversions,
          impressions: kpis.impressions,
          clicks: kpis.clicks,
        },
        selectedMetrics: Array.from(selectedMetrics),
        layout,
        topCampaigns: layout === "detailed" || layout === "campaign" ? topCampaigns : [],
      };

      const blob = await pdf(<ReportDocument data={reportData} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${client.slug}-${dateRange}-report.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Save to recent reports
      const reportName = `${client.name} — ${DATE_LABELS[dateRange] ?? dateRange}`;
      saveReport(reportName);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("PDF generation failed. Check console for details.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSendSlack() {
    setSlackSending(true);
    const settingsKey = `ontrack-settings-${clientSlug}`;
    let webhookUrl = "";
    try {
      const stored = localStorage.getItem(settingsKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        webhookUrl = parsed.slackWebhookUrl ?? "";
      }
    } catch {
      // ignore
    }

    if (!webhookUrl) {
      alert(
        "No Slack webhook configured.\n\nGo to Settings → Integrations and add your Slack Webhook URL.",
      );
      setSlackSending(false);
      return;
    }

    try {
      const currencySymbol =
        client.currency === "GBP" ? "£" : client.currency === "USD" ? "$" : client.currency === "EUR" ? "€" : "AED ";

      const message = {
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: `📊 ${client.name} — ${DATE_LABELS[dateRange] ?? dateRange}` },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Spend*\n${currencySymbol}${kpis.spend.toLocaleString()}` },
              { type: "mrkdwn", text: `*ROAS*\n${kpis.roas.toFixed(2)}x` },
              { type: "mrkdwn", text: `*MER*\n${kpis.mer.toFixed(2)}x` },
              { type: "mrkdwn", text: `*CPA*\n${currencySymbol}${kpis.cpa.toFixed(0)}` },
              { type: "mrkdwn", text: `*Conversions*\n${kpis.conversions.toLocaleString()}` },
              { type: "mrkdwn", text: `*Revenue*\n${currencySymbol}${kpis.revenue.toLocaleString()}` },
            ],
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: `Sent by OnTrack · OnSocial Agency · ${new Date().toLocaleDateString(clientLocale)}`,
              },
            ],
          },
        ],
      };

      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
      });
      alert("Report summary sent to Slack!");
    } catch {
      alert("Failed to send to Slack. Check your webhook URL in Settings.");
    } finally {
      setSlackSending(false);
    }
  }

  return (
    <>
      <Header title="Reports" dataBadge={{ loading: windsorLoading, isLive: !!isLive }} filterRow={isIrg ? <VenueTabs /> : undefined} />

      <div className="flex-1 p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6 overflow-y-auto">

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* ── Report Builder ── */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-5">
              <h2 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider">
                Report Builder
              </h2>

              {/* Metrics */}
              <div className="space-y-2">
                <Tooltip content="Choose which metrics to include in the PDF report" side="right">
                  <label className="text-xs font-medium text-[#94A3B8]">
                    Metrics to Include
                  </label>
                </Tooltip>
                <div className="flex flex-wrap gap-2">
                  {METRIC_OPTIONS.map((metric) => {
                    const isSelected = selectedMetrics.has(metric);
                    return (
                      <button
                        key={metric}
                        onClick={() => toggleMetric(metric)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                          isSelected
                            ? "bg-[#FF6A41]/20 border-[#FF6A41]/40 text-[#FF6A41]"
                            : "bg-white/[0.03] border-white/[0.08] text-[#94A3B8] hover:border-white/20",
                        )}
                      >
                        {metric}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date range */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-[#94A3B8]">
                  Date Range
                </label>
                <div className="flex gap-2 flex-wrap">
                  {["7d", "14d", "30d", "90d", "MTD", "QTD"].map((range) => (
                    <button
                      key={range}
                      onClick={() => setDateRange(range)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                        dateRange === range
                          ? "bg-[#FF6A41] text-white"
                          : "bg-white/[0.05] text-[#94A3B8] hover:text-white",
                      )}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>

              {/* Layout */}
              <div className="space-y-2">
                <Tooltip content="Choose the report template that best fits your audience" side="right">
                  <label className="text-xs font-medium text-[#94A3B8]">
                    Report Layout
                  </label>
                </Tooltip>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {LAYOUT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setLayout(opt.value)}
                      className={cn(
                        "p-3 rounded-xl text-left transition-all border",
                        layout === opt.value
                          ? "bg-[#FF6A41]/10 border-[#FF6A41]/30"
                          : "bg-white/[0.03] border-white/[0.08] hover:border-white/20",
                      )}
                    >
                      <p className={cn(
                        "text-xs font-medium",
                        layout === opt.value ? "text-white" : "text-[#94A3B8]",
                      )}>
                        {opt.label}
                      </p>
                      <p className="text-[10px] text-[#94A3B8]/60 mt-0.5">
                        {opt.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview section */}
              <div className="p-3 sm:p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                <div className="flex items-center gap-2">
                  <Eye size={14} className="text-[#94A3B8]" />
                  <span className="text-xs font-medium text-[#94A3B8]">Preview</span>
                </div>
                <div className="text-[11px] text-[#94A3B8]/80 space-y-1">
                  <p><span className="text-white font-medium">{client.name}</span> — {DATE_LABELS[dateRange] ?? dateRange}</p>
                  <p>Layout: {LAYOUT_OPTIONS.find((l) => l.value === layout)?.label}</p>
                  <p>Metrics: {Array.from(selectedMetrics).join(", ")}</p>
                  {isLive && <p className="text-emerald-400">Using live Windsor data</p>}
                </div>
              </div>

              {/* Export buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                <button
                  onClick={handleGeneratePDF}
                  disabled={generating}
                  className={cn(
                    "inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors w-full sm:w-auto",
                    generating
                      ? "bg-[#FF6A41]/50 text-white cursor-not-allowed"
                      : "bg-[#FF6A41] text-white hover:bg-[#FF6A41]/90",
                  )}
                >
                  {generating ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Download size={14} />
                  )}
                  {generating ? "Generating..." : "Generate PDF"}
                </button>
                <Tooltip content="Sends a summary card to the Slack channel configured in Settings" side="top">
                  <button
                    onClick={handleSendSlack}
                    disabled={slackSending}
                    className={cn(
                      "inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium border transition-colors w-full sm:w-auto",
                      slackSending
                        ? "bg-white/[0.03] text-[#94A3B8] border-white/[0.06] cursor-not-allowed"
                        : "bg-white/[0.06] text-white border-white/[0.1] hover:bg-white/[0.1]",
                    )}
                  >
                    {slackSending ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Send size={14} />
                    )}
                    {slackSending ? "Sending..." : "Send to Slack"}
                  </button>
                </Tooltip>
              </div>
            </div>
          </div>

          {/* ── Saved Reports ── */}
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-3 sm:space-y-4">
            <h2 className="text-sm font-semibold text-[#94A3B8] uppercase tracking-wider">
              Recent Reports
            </h2>
            {savedReports.length === 0 ? (
              <div className="p-4 sm:p-6 text-center">
                <FileText size={24} className="text-[#94A3B8]/30 mx-auto mb-2" />
                <p className="text-xs text-[#94A3B8]/60">
                  No reports generated yet. Create your first report using the builder.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {savedReports.map((report) => (
                  <div
                    key={report.id}
                    className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.05] transition-colors space-y-1.5 group"
                  >
                    <div className="flex items-start gap-2">
                      <FileText
                        size={14}
                        className="text-[#FF6A41] mt-0.5 flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white truncate">
                          {report.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Clock size={10} className="text-[#94A3B8]/60" />
                          <span className="text-[10px] text-[#94A3B8]">
                            {report.date}
                          </span>
                          <span className="text-[10px] text-[#94A3B8]/60">
                            {report.type}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteReport(report.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/[0.1] transition-all"
                        title="Delete report"
                      >
                        <Trash2 size={12} className="text-[#94A3B8]" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
