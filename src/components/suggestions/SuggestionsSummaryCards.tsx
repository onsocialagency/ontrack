"use client";

import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Suggestion } from "@/lib/types";

interface Props {
  suggestions: Suggestion[];
  activeFilter?: "all" | "high" | "medium" | "low";
  onFilterChange?: (next: "all" | "high" | "medium" | "low") => void;
}

export function SuggestionsSummaryCards({ suggestions, activeFilter, onFilterChange }: Props) {
  const counts = {
    high: suggestions.filter((s) => s.priority === "high").length,
    medium: suggestions.filter((s) => s.priority === "medium").length,
    low: suggestions.filter((s) => s.priority === "low").length,
  };

  const cards: Array<{
    key: "high" | "medium" | "low";
    label: string;
    count: number;
    icon: React.ReactNode;
    color: string;
    activeRing: string;
  }> = [
    {
      key: "high",
      label: "High priority",
      count: counts.high,
      icon: <AlertCircle size={18} />,
      color: "text-red-400 bg-red-500/10 border-red-500/20",
      activeRing: "ring-red-500/40",
    },
    {
      key: "medium",
      label: "Medium priority",
      count: counts.medium,
      icon: <AlertTriangle size={18} />,
      color: "text-amber-300 bg-amber-500/10 border-amber-500/20",
      activeRing: "ring-amber-500/40",
    },
    {
      key: "low",
      label: "Low / informational",
      count: counts.low,
      icon: <Info size={18} />,
      color: "text-slate-300 bg-slate-500/10 border-slate-500/20",
      activeRing: "ring-slate-400/40",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {cards.map((card) => {
        const isActive = activeFilter === card.key;
        return (
          <button
            type="button"
            key={card.key}
            onClick={() => onFilterChange?.(isActive ? "all" : card.key)}
            className={cn(
              "text-left rounded-xl border px-4 py-3 flex items-center gap-3 transition-all",
              card.color,
              isActive && `ring-2 ${card.activeRing}`,
              "hover:brightness-110",
            )}
          >
            <div className="flex-shrink-0">{card.icon}</div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-wider opacity-80">{card.label}</p>
              <p className="text-2xl font-bold leading-none mt-0.5">{card.count}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default SuggestionsSummaryCards;
