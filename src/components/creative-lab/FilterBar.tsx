"use client";

import { Search } from "lucide-react";
import { PillToggle } from "@/components/ui/pill-toggle";

const FORMAT_OPTIONS = [
  { value: "all", label: "All" },
  { value: "VID", label: "Video" },
  { value: "STA", label: "Static" },
  { value: "CAR", label: "Carousel" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "paused", label: "Paused/Old" },
];

const SCORE_OPTIONS = [
  { value: "all", label: "All Scores" },
  { value: "Scale", label: "Scale" },
  { value: "Optimise", label: "Optimise" },
  { value: "Review", label: "Review" },
  { value: "Kill", label: "Kill" },
  { value: "Learning", label: "Learning" },
];

interface FilterBarProps {
  formatFilter: string;
  setFormatFilter: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  scoreFilter: string;
  setScoreFilter: (v: string) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  resultCount: number;
}

export function FilterBar({
  formatFilter,
  setFormatFilter,
  statusFilter,
  setStatusFilter,
  scoreFilter,
  setScoreFilter,
  searchQuery,
  setSearchQuery,
  resultCount,
}: FilterBarProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="flex items-center gap-2 overflow-x-auto flex-nowrap pb-1 -mb-1">
          <PillToggle
            options={FORMAT_OPTIONS}
            value={formatFilter}
            onChange={setFormatFilter}
            size="sm"
          />
          <div className="h-5 w-px bg-white/[0.1] hidden sm:block flex-shrink-0" />
          <PillToggle
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={setStatusFilter}
            size="sm"
          />
          <div className="h-5 w-px bg-white/[0.1] hidden sm:block flex-shrink-0" />
          <PillToggle
            options={SCORE_OPTIONS}
            value={scoreFilter}
            onChange={setScoreFilter}
            size="sm"
          />
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          <p className="text-xs text-[#94A3B8] hidden sm:block whitespace-nowrap">
            {resultCount} creative{resultCount !== 1 ? "s" : ""}
          </p>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Search creatives..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs text-white placeholder:text-[#94A3B8]/60 focus:border-[#FF6A41]/40 focus:outline-none w-full sm:w-[180px]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
