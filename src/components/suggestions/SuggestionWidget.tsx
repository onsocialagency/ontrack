"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Lightbulb, CheckCircle2, ChevronDown, RefreshCw } from "lucide-react";
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
 * On mobile (<sm) the list collapses behind a toggle to avoid crowding the screen.
 */
export function SuggestionWidget() {
  const { suggestions, loading, summary, refresh, generatedAt } = useSuggestionAlerts();
  const client = useClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  if (!client) return null;
  const fullHref = `/${client.clientSlug}/suggestions`;

  const top: Suggestion[] = suggestions.slice(0, 3);
  const subtitle = loading
    ? "Analysing last 30 days…"
    : generatedAt
      ? `${summary.totalActive} active · ${summary.highCount} high priority`
      : "Tap refresh to load";

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 sm:p-5 overflow-hidden">
      {/* Header — also acts as the mobile toggle */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left sm:cursor-default"
          aria-expanded={mobileOpen}
          aria-controls="suggestion-widget-body"
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#FF6A41]/15 text-[#FF6A41] flex-shrink-0">
            <Lightbulb size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-white truncate">Top suggestions</h3>
            <p className="text-[11px] text-[#8192A6] truncate">{subtitle}</p>
          </div>
          <ChevronDown
            size={16}
            className={cn(
              "text-[#8192A6] flex-shrink-0 transition-transform sm:hidden",
              mobileOpen && "rotate-180",
            )}
          />
        </button>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              refresh();
            }}
            disabled={loading}
            aria-label="Refresh suggestions"
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-lg border border-white/[0.06] bg-white/[0.04] hover:bg-white/[0.08] text-[#E2E8F0] transition-colors",
              loading && "opacity-60 cursor-not-allowed",
            )}
          >
            <RefreshCw size={12} className={cn(loading && "animate-spin")} />
          </button>
          <Link
            href={fullHref}
            className="hidden sm:flex items-center gap-1 text-[11px] font-semibold text-[#FF6A41] hover:text-[#FF8A61] transition-colors"
          >
            View all
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      {/* Body — always visible on ≥sm, collapsible on mobile */}
      <div
        id="suggestion-widget-body"
        className={cn("mt-3", !mobileOpen && "hidden sm:block")}
      >
        {/* Empty state */}
        {!loading && top.length === 0 && (
          <div className="flex items-start gap-2 py-3 px-3 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/[0.15]">
            <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-200 break-words">
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
                  <p className="text-[13px] font-medium text-white leading-snug group-hover:text-white break-words">
                    {s.title}
                  </p>
                  <p className="text-[11px] mt-0.5 flex flex-wrap items-start gap-x-1.5 gap-y-0.5">
                    <span className={cn("font-medium flex-shrink-0", CATEGORY_COLOR[s.category])}>
                      {CATEGORY_LABEL[s.category]}
                    </span>
                    <span className="text-[#8192A6] flex-shrink-0">·</span>
                    <span className="text-[#A8BBCC] break-words min-w-0">{s.action}</span>
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

        {/* Mobile-only "View all" link */}
        <Link
          href={fullHref}
          className="sm:hidden flex items-center justify-center gap-1 mt-2 py-2 text-[11px] font-semibold text-[#FF6A41] hover:text-[#FF8A61] transition-colors"
        >
          View all
          <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}

export default SuggestionWidget;
