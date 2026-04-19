"use client";

import { useMemo, useState } from "react";
import { RefreshCw, AlertCircle, CheckCircle2, Lightbulb } from "lucide-react";
import { Header } from "@/components/layout/header";
import { SuggestionCard } from "@/components/suggestions/SuggestionCard";
import { SuggestionsSummaryCards } from "@/components/suggestions/SuggestionsSummaryCards";
import { useSuggestionAlerts } from "@/lib/suggestion-alert-context";
import { useClient } from "@/lib/client-context";
import { getDone } from "@/lib/suggestionStorage";
import { cn } from "@/lib/utils";
import type { Suggestion, SuggestionPriority } from "@/lib/types";

/* ── Helpers ── */

function timeAgo(input: string | Date | null): string {
  if (!input) return "just now";
  const ts = input instanceof Date ? input.getTime() : new Date(input).getTime();
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

type FilterValue = "all" | "high" | "medium" | "low";

/* ── Page ── */

export default function SuggestionsPage() {
  const client = useClient();
  const {
    suggestions,
    generatedAt,
    loading,
    error,
    refresh,
    markDone,
    snooze,
    dismiss,
  } = useSuggestionAlerts();
  const [filter, setFilter] = useState<FilterValue>("all");

  const clientSlug = client?.clientSlug ?? "";
  const clientName = client?.clientName ?? "Client";
  const suppressionMessage = client?.clientConfig?.suppressScoreWarning ?? null;

  // Filtered list
  const filtered = useMemo(() => {
    if (filter === "all") return suggestions;
    return suggestions.filter((s) => s.priority === filter);
  }, [suggestions, filter]);

  // Actioned-this-month recap (last 10)
  const actionedRecently = useMemo(() => {
    if (!clientSlug || typeof window === "undefined") return [] as Array<{
      id: string;
      actionedAt: string;
    }>;
    const entries = getDone(clientSlug);
    const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return entries
      .filter((e) => new Date(e.actionedAt).getTime() >= oneMonthAgo)
      .sort((a, b) => new Date(b.actionedAt).getTime() - new Date(a.actionedAt).getTime())
      .slice(0, 10);
  }, [clientSlug, suggestions]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header title={`Suggestions for ${clientName}`} showDateRange={false} />

      <div className="flex-1 px-4 sm:px-6 lg:px-8 py-6 space-y-6 max-w-[1200px] mx-auto w-full">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <p className="text-xs text-[#8192A6]">
              Generated {timeAgo(generatedAt)} from last 30 days of data
            </p>
          </div>
          <div className="flex items-center gap-2">
            <FilterDropdown value={filter} onChange={setFilter} />
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                "bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] text-[#E2E8F0]",
                loading && "opacity-60 cursor-not-allowed",
              )}
              aria-label="Refresh suggestions"
            >
              <RefreshCw size={12} className={cn(loading && "animate-spin")} />
              Refresh
            </button>
          </div>
        </div>

        {/* Suppression banner */}
        {suppressionMessage && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
            <AlertCircle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm text-amber-100">
              <p className="font-semibold mb-0.5">Performance context</p>
              <p className="text-amber-200/90">{suppressionMessage}</p>
              <p className="text-[11px] text-amber-200/70 mt-1.5 italic">
                All suggestion priorities downgraded by one level while this is set.
              </p>
            </div>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-3">
            <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm text-red-100">
              <p className="font-semibold mb-0.5">Could not generate suggestions</p>
              <p className="text-red-200/80">{error}</p>
            </div>
          </div>
        )}

        {/* Summary cards */}
        <SuggestionsSummaryCards
          suggestions={suggestions}
          activeFilter={filter}
          onFilterChange={setFilter}
        />

        {/* Suggestions list */}
        <div className="space-y-3">
          {loading && suggestions.length === 0 && <LoadingSkeleton />}

          {!loading && filtered.length === 0 && (
            <EmptyState filter={filter} totalSuggestions={suggestions.length} />
          )}

          {filtered.map((s: Suggestion) => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              onMarkDone={markDone}
              onSnooze={snooze}
              onDismiss={dismiss}
            />
          ))}
        </div>

        {/* Actioned this month recap */}
        {actionedRecently.length > 0 && (
          <div className="pt-6 border-t border-white/[0.06]">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">Actioned this month</h3>
              <span className="text-[11px] text-[#8192A6]">
                Last {actionedRecently.length}
              </span>
            </div>
            <div className="space-y-1.5">
              {actionedRecently.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]"
                >
                  <span className="text-xs font-mono text-[#A8BBCC] truncate flex-1">
                    {entry.id}
                  </span>
                  <span className="text-[10px] text-[#8192A6] flex-shrink-0">
                    {timeAgo(entry.actionedAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function FilterDropdown({
  value,
  onChange,
}: {
  value: FilterValue;
  onChange: (v: FilterValue) => void;
}) {
  const options: Array<{ value: FilterValue; label: string }> = [
    { value: "all", label: "All priorities" },
    { value: "high", label: "High" },
    { value: "medium", label: "Medium" },
    { value: "low", label: "Low" },
  ];
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as FilterValue)}
      className="bg-white/[0.04] border border-white/[0.06] rounded-lg text-xs font-medium text-[#E2E8F0] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white/[0.1]"
      aria-label="Filter by priority"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-[#12121A]">
          {o.label}
        </option>
      ))}
    </select>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-32 rounded-2xl bg-white/[0.02] border border-white/[0.04] animate-pulse"
        />
      ))}
    </div>
  );
}

function EmptyState({
  filter,
  totalSuggestions,
}: {
  filter: FilterValue;
  totalSuggestions: number;
}) {
  if (totalSuggestions === 0) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-8 text-center">
        <CheckCircle2 size={28} className="text-emerald-400 mx-auto mb-3" />
        <p className="text-sm font-semibold text-white mb-1">
          No active suggestions
        </p>
        <p className="text-xs text-[#A8BBCC]">
          The account is running clean. Nothing triggered in the last 30 days.
        </p>
      </div>
    );
  }
  const priorityLabel: Record<SuggestionPriority, string> = {
    high: "high priority",
    medium: "medium priority",
    low: "low priority",
  };
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
      <Lightbulb size={24} className="text-[#8192A6] mx-auto mb-3" />
      <p className="text-sm text-white mb-1">
        No {filter === "all" ? "suggestions" : priorityLabel[filter as SuggestionPriority]} match this filter
      </p>
      <p className="text-xs text-[#8192A6]">Try a different priority level or refresh to re-run the rules.</p>
    </div>
  );
}
