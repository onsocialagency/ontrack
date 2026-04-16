"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/locale-context";

interface DataBadgeProps {
  loading: boolean;
  isLive: boolean;
}

export function DataBadge({ loading, isLive }: DataBadgeProps) {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { timestamp } = useLocale();

  useEffect(() => {
    if (!loading) {
      setLastUpdated(new Date());
    }
  }, [loading]);

  return (
    <div className="flex justify-end">
      <div className="flex flex-col items-end gap-0.5">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider",
            loading
              ? "bg-white/10 text-[#94A3B8]"
              : isLive
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-amber-500/20 text-amber-400",
          )}
        >
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              loading
                ? "bg-[#94A3B8] animate-pulse"
                : isLive
                  ? "bg-emerald-400"
                  : "bg-amber-400",
            )}
          />
          {loading ? "Loading..." : isLive ? "Live Data" : "Mock Data"}
        </span>
        {lastUpdated && !loading && (
          <span className="text-[9px] text-[#94A3B8]/60">
            Updated {timestamp(lastUpdated)}
          </span>
        )}
      </div>
    </div>
  );
}
