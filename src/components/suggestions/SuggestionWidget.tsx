"use client";

import Link from "next/link";
import { ArrowRight, Lightbulb, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSuggestionAlerts } from "@/lib/suggestion-alert-context";
import { useClient } from "@/lib/client-context";
import type { Suggestion, SuggestionCategory, SuggestionPriority } from "@/lib/types";

/* ── Styling tables ── */

const PRIORITY_DOT: Record<SuggestionPriority, string> = {
  high: "bg-red-500",
  medium: "bg-amber-400",
  low: "bg-slate-400",
};

const CATEGORY_COLOR: Record<SuggestionCategory, string> = {
  scale: "text-emerald-300",
  fatigue: "text-red-300",
  waste: "text-amber-300",
  performance: "text-amber-300",
  setup: "text-blue-300",
  attribution: "text-slate-300",
};

const CATEGORY_LABEL: Record<SuggestionCategory, string> = {
  scale: "Scale",
  fatigue: "Fatigue",
  waste: "Waste",
  performance: "Performance",
  setup: "Setup",
  attribution: "Attribution",
};

/* ── Component ── */

/**
 * Condensed "top suggestions" widget shown at the top of overview pages.
 * Prioritises high-priority items; shows top 3 overall.
 */
export function SuggestionWidget() {
  const { suggestions, loading, summary } = useSuggestionAlerts();
  const client = useClient();
  if (!client) return null;
  const fullHref = `/${client.clientSlug}/suggestions`;

  const top: Suggestion[] = suggestions.slice(0, 3);

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#FF6A41]/15 text-[#FF6A41]">
            <Lightbulb size={16} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Top suggestions</h3>
            <p className="text-[11px] text-[#8192A6]">
              {loading
                ? "Analysing last 30 days..."
                : `${summary.totalActive} active · ${summary.highCount} high priority`}
            </p>
          </div>
        </div>
        <Link
          href={fullHref}
          className="flex items-center gap-1 text-[11px] font-semibold text-[#FF6A41] hover:text-[#FF8A61] transition-colors"
        >
          View all
          <ArrowRight size={12} />
        </Link>
      </div>

      {/* Empty state */}
      {!loading && top.length === 0 && (
        <div className="flex items-center gap-2 py-3 px-3 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/[0.15]">
          <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
          <p className="text-xs text-emerald-200">
            No high-priority suggestions right now. Account is running clean.
          </p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && top.length === 0 && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-11 rounded-lg bg-white/[0.02] border border-white/[0.04] animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Top 3 list */}
      {top.length > 0 && (
        <div className="space-y-1.5">
          {top.map((s) => (
            <Link
              key={s.id}
              href={fullHref}
              className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg hover:bg-white/[0.04] transition-colors group"
            >
              <span
                className={cn(
                  "mt-1.5 w-2 h-2 rounded-full flex-shrink-0",
                  PRIORITY_DOT[s.priority],
                )}
              />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-white leading-snug group-hover:text-white">
                  {s.title}
                </p>
                <p className="text-[11px] mt-0.5 flex items-center gap-1.5">
                  <span className={cn("font-medium", CATEGORY_COLOR[s.category])}>
                    {CATEGORY_LABEL[s.category]}
                  </span>
                  <span className="text-[#8192A6]">·</span>
                  <span className="text-[#A8BBCC]">{s.action}</span>
                </p>
              </div>
              <ArrowRight
                size={14}
                className="mt-1 text-[#8192A6] group-hover:text-white transition-colors flex-shrink-0"
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default SuggestionWidget;
