"use client";

import { cn } from "@/lib/utils";
import { Link2Off } from "lucide-react";

interface DataBlurProps {
  /** true when data comes from mock / no Windsor connection */
  isBlurred: boolean;
  /** true while Windsor fetch is in progress — kept for API compat, no visual effect */
  isLoading?: boolean;
  /** optional message shown on the overlay */
  message?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Wraps content with a blur effect when the data source is mock (not connected).
 * Loading state is communicated via the header badge — no opacity flicker here.
 */
export function DataBlur({
  isBlurred,
  isLoading = false,
  message = "Connect data source to view live metrics",
  children,
  className,
}: DataBlurProps) {
  const shouldBlur = isBlurred && !isLoading;

  return (
    <div className="relative">
      <div
        className={cn(
          "transition-all duration-500 ease-out",
          shouldBlur && "blur-[6px] opacity-50 select-none pointer-events-none",
          className,
        )}
      >
        {children}
      </div>

      {shouldBlur && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="glass-card rounded-xl px-5 py-3.5 flex items-center gap-3 border border-white/[0.08] shadow-xl backdrop-blur-sm">
            <div className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center">
              <Link2Off size={16} className="text-[#A8BBCC]" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">{message}</p>
              <p className="text-xs text-[#A8BBCC] mt-0.5">
                Set up Windsor API key in Settings
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
