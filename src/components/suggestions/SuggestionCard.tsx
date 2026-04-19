"use client";

import { useState } from "react";
import { ArrowRight, Check, Clock, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Suggestion, SuggestionCategory, SuggestionPriority } from "@/lib/types";

/* ── Styling tables ── */

const PRIORITY_DOT: Record<SuggestionPriority, string> = {
  high: "bg-red-500",
  medium: "bg-amber-400",
  low: "bg-slate-400",
};

const PRIORITY_LABEL: Record<SuggestionPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const CATEGORY_META: Record<SuggestionCategory, { label: string; color: string }> = {
  scale: { label: "Scale", color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20" },
  fatigue: { label: "Fatigue", color: "bg-red-500/15 text-red-300 border-red-500/20" },
  waste: { label: "Waste", color: "bg-amber-500/15 text-amber-300 border-amber-500/20" },
  performance: { label: "Performance", color: "bg-amber-500/15 text-amber-300 border-amber-500/20" },
  setup: { label: "Setup", color: "bg-blue-500/15 text-blue-300 border-blue-500/20" },
  attribution: { label: "Attribution", color: "bg-slate-500/15 text-slate-300 border-slate-500/20" },
};

/* ── Props ── */

interface SuggestionCardProps {
  suggestion: Suggestion;
  onMarkDone: (id: string) => void;
  onSnooze: (id: string) => void;
  onDismiss: (id: string) => void;
}

/* ── Component ── */

export function SuggestionCard({ suggestion, onMarkDone, onSnooze, onDismiss }: SuggestionCardProps) {
  const [contextOpen, setContextOpen] = useState(false);
  const category = CATEGORY_META[suggestion.category];
  const dataEntries = Object.entries(suggestion.dataContext);

  return (
    <div className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 hover:bg-white/[0.05] transition-colors">
      <div className="flex items-start gap-4">
        {/* Priority dot */}
        <div className="flex flex-col items-center pt-1.5">
          <span
            className={cn("w-2.5 h-2.5 rounded-full", PRIORITY_DOT[suggestion.priority])}
            aria-label={`${PRIORITY_LABEL[suggestion.priority]} priority`}
          />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Category + entity */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border",
                category.color,
              )}
            >
              {category.label}
            </span>
            <span className="text-[10px] text-[#8192A6] uppercase tracking-wider">
              {suggestion.entityType}
            </span>
            {suggestion.entityName && (
              <span className="text-[11px] text-[#A8BBCC] truncate">{suggestion.entityName}</span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-[14px] font-semibold text-white leading-snug">
            {suggestion.title}
          </h3>

          {/* Detail */}
          {suggestion.detail && (
            <p className="text-[12px] text-[#A8BBCC] leading-relaxed">{suggestion.detail}</p>
          )}

          {/* Action */}
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-white pt-1">
            <ArrowRight size={14} className="text-[#FF6A41]" />
            <span>{suggestion.action}</span>
          </div>

          {/* Expected impact */}
          {suggestion.expectedImpact && (
            <p className="text-[11px] text-[#8192A6] italic">
              Expected impact: {suggestion.expectedImpact}
            </p>
          )}

          {/* Data context (collapsible) */}
          {dataEntries.length > 0 && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setContextOpen((o) => !o)}
                className="flex items-center gap-1 text-[10px] font-medium text-[#8192A6] hover:text-[#A8BBCC] transition-colors uppercase tracking-wider"
              >
                <ChevronDown
                  size={12}
                  className={cn("transition-transform", contextOpen && "rotate-180")}
                />
                Data context
              </button>
              {contextOpen && (
                <div className="mt-2 rounded-lg bg-black/20 border border-white/[0.04] p-3 grid grid-cols-2 gap-x-4 gap-y-1">
                  {dataEntries.map(([key, value]) => (
                    <div key={key} className="flex items-baseline justify-between gap-2 min-w-0">
                      <span className="text-[10px] text-[#8192A6] truncate">{key}</span>
                      <span className="text-[11px] font-mono text-[#E2E8F0] truncate">
                        {String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions (right-aligned) */}
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => onMarkDone(suggestion.id)}
            className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 px-2.5 py-1.5 rounded-lg transition-colors"
            aria-label="Mark as done"
          >
            <Check size={12} />
            Mark done
          </button>
          <button
            type="button"
            onClick={() => onSnooze(suggestion.id)}
            className="flex items-center gap-1.5 text-[11px] font-medium text-[#A8BBCC] hover:text-white hover:bg-white/[0.06] px-2.5 py-1.5 rounded-lg transition-colors"
            aria-label="Snooze 7 days"
          >
            <Clock size={12} />
            Snooze 7d
          </button>
          <button
            type="button"
            onClick={() => onDismiss(suggestion.id)}
            className="flex items-center gap-1.5 text-[11px] font-medium text-[#8192A6] hover:text-red-400 hover:bg-red-500/10 px-2.5 py-1.5 rounded-lg transition-colors"
            aria-label="Dismiss"
          >
            <X size={12} />
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

export default SuggestionCard;
