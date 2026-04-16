"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

/* ── Types ── */

export interface KpiDetailData {
  title: string;
  icon?: React.ReactNode;
  currentValue: string;
  previousValue?: string;
  currentLabel: string;
  previousLabel?: string;
  dailyData: { date: string; current: number; previous?: number }[];
  breakdown: { name: string; value: number; formatted: string; color: string }[];
  accentColor?: string;
  formatValue?: (v: number) => string;
}

interface KpiDetailModalProps {
  data: KpiDetailData | null;
  onClose: () => void;
}

type TabId = "trend" | "bars" | "breakdown";

const TABS: { id: TabId; label: string }[] = [
  { id: "trend", label: "Trend" },
  { id: "bars", label: "Daily" },
  { id: "breakdown", label: "Breakdown" },
];

/* ── Component ── */

export function KpiDetailModal({ data, onClose }: KpiDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>("trend");

  useEffect(() => {
    if (data) setActiveTab("trend");
  }, [data]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (data) {
      document.addEventListener("keydown", handleKey);
      // Prevent body scroll on mobile
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", handleKey);
        document.body.style.overflow = "";
      };
    }
  }, [data, onClose]);

  if (!data) return null;

  const accent = data.accentColor || "#FF6A41";
  const fmt = data.formatValue || ((v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 2 }));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

      <div
        className={cn(
          "relative w-full bg-[#0F0F17] border-t sm:border border-white/[0.08] sm:rounded-2xl shadow-2xl overflow-hidden",
          "max-h-[90vh] sm:max-h-[85vh] sm:max-w-3xl",
          "rounded-t-2xl sm:rounded-2xl",
          "flex flex-col",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag indicator */}
        <div className="sm:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5 sm:gap-3">
            {data.icon && (
              <span
                className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl"
                style={{ backgroundColor: `${accent}15` }}
              >
                <span style={{ color: accent }}>{data.icon}</span>
              </span>
            )}
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">{data.title}</h2>
              <p className="text-[10px] sm:text-[11px] text-[#64748B] mt-0.5">{data.currentLabel}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors text-[#94A3B8] hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Value + Tabs row */}
          <div className="px-4 sm:px-8 pt-4 sm:pt-5 pb-3 sm:pb-4">
            <div className="flex items-end justify-between mb-4 sm:mb-5">
              <div>
                <p className="text-2xl sm:text-[32px] font-bold text-white leading-none">{data.currentValue}</p>
                {data.previousValue && (
                  <p className="text-xs sm:text-sm text-[#64748B] mt-1 sm:mt-1.5">vs {data.previousValue} previous period</p>
                )}
              </div>
            </div>

            {/* Tab pills */}
            <div className="flex items-center gap-1 p-1 bg-white/[0.04] rounded-xl w-full sm:w-fit">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex-1 sm:flex-none px-4 sm:px-5 py-2 rounded-lg text-xs font-semibold transition-all duration-200",
                    activeTab === tab.id
                      ? "bg-white/[0.1] text-white shadow-sm"
                      : "text-[#64748B] hover:text-[#94A3B8]",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Chart content */}
          <div className="px-4 sm:px-8 pb-6 sm:pb-8">
            {activeTab === "trend" && (
              <div className="h-[220px] sm:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.dailyData}>
                    <defs>
                      <linearGradient id="kpiDetailGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={accent} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={accent} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "#64748B", fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: "#64748B", fontSize: 9 }} tickLine={false} axisLine={false} width={45} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1A1A2E",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "12px",
                        fontSize: 11,
                        padding: "8px 12px",
                      }}
                      labelStyle={{ color: "#94A3B8", marginBottom: 4 }}
                      formatter={(val) => [fmt(Number(val))]}
                      cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }}
                    />
                    {data.dailyData.some((d) => d.previous !== undefined) && (
                      <Area type="monotone" dataKey="previous" name="Previous Period" stroke="#64748B" fill="none" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                    )}
                    <Area type="monotone" dataKey="current" name="Current Period" stroke={accent} fill="url(#kpiDetailGrad)" strokeWidth={2} dot={false} activeDot={{ r: 3.5, fill: accent, stroke: "#0F0F17", strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {activeTab === "bars" && (
              <div className="h-[220px] sm:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.dailyData} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "#64748B", fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: "#64748B", fontSize: 9 }} tickLine={false} axisLine={false} width={45} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1A1A2E",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "12px",
                        fontSize: 11,
                        padding: "8px 12px",
                      }}
                      labelStyle={{ color: "#94A3B8", marginBottom: 4 }}
                      formatter={(val) => [fmt(Number(val))]}
                      cursor={{ fill: "rgba(255,255,255,0.02)" }}
                    />
                    <Bar dataKey="current" name="Current" fill={accent} radius={[3, 3, 0, 0]} />
                    {data.dailyData.some((d) => d.previous !== undefined) && (
                      <Bar dataKey="previous" name="Previous" fill="rgba(100,116,139,0.3)" radius={[3, 3, 0, 0]} />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {activeTab === "breakdown" && (
              <div className="space-y-2 pt-2">
                {data.breakdown.length > 0 ? (
                  <>
                    {data.breakdown.map((item) => {
                      const total = data.breakdown.reduce((s, b) => s + b.value, 0);
                      const pct = total > 0 ? (item.value / total) * 100 : 0;
                      return (
                        <div
                          key={item.name}
                          className="flex items-center justify-between py-3 sm:py-4 px-3 sm:px-4 rounded-xl bg-white/[0.03] border border-white/[0.04] hover:bg-white/[0.05] transition-colors"
                        >
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded flex-shrink-0" style={{ backgroundColor: item.color }} />
                            <span className="text-xs sm:text-sm font-medium text-white truncate">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-2 sm:gap-5 flex-shrink-0 ml-2">
                            <div className="hidden sm:block w-24 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: item.color }} />
                            </div>
                            <span className="text-[10px] sm:text-[11px] text-[#64748B] w-8 sm:w-10 text-right">{pct.toFixed(0)}%</span>
                            <span className="text-xs sm:text-sm font-bold text-white min-w-[70px] sm:min-w-[90px] text-right">
                              {item.formatted}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    <div className="flex items-center justify-between py-3 sm:py-4 px-3 sm:px-4 mt-2 border-t border-white/[0.06]">
                      <span className="text-xs sm:text-sm font-semibold text-[#64748B]">Total</span>
                      <span className="text-sm sm:text-base font-bold text-white">{data.currentValue}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-[#64748B] text-center py-12">No breakdown data available</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
