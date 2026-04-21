"use client";

import { cn } from "@/lib/utils";

interface PendingBlurProps {
  loading?: boolean;
  children: React.ReactNode;
  className?: string;
  /** Blur intensity. Default "md". */
  intensity?: "sm" | "md" | "lg";
  as?: "span" | "div" | "p";
}

/**
 * Wraps numeric content so it renders blurred while data is pending,
 * then snaps into focus once the real value is available.
 * Use anywhere a KpiCard isn't available (tables, chart labels, inline stats).
 */
export function PendingBlur({
  loading = false,
  children,
  className,
  intensity = "md",
  as: Tag = "span",
}: PendingBlurProps) {
  const blurClass =
    intensity === "sm" ? "blur-sm" : intensity === "lg" ? "blur-lg" : "blur-md";
  return (
    <Tag
      className={cn(
        "inline-block transition-[filter] duration-300 tabular-nums",
        loading && `${blurClass} opacity-70 animate-pulse select-none`,
        className,
      )}
      aria-busy={loading || undefined}
    >
      {children}
    </Tag>
  );
}

export default PendingBlur;
