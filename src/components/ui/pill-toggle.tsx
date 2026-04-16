"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

/* ── Types ── */

interface PillOption {
  value: string;
  label: string;
}

interface PillToggleProps {
  options: PillOption[];
  value: string;
  onChange: (value: string) => void;
  size?: "sm" | "md";
}

/* ── Component ── */

export function PillToggle({ options, value, onChange, size = "md" }: PillToggleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{
    left: number;
    width: number;
  }>({ left: 0, width: 0 });

  const updateIndicator = useCallback(() => {
    if (!containerRef.current) return;

    const activeIndex = options.findIndex((o) => o.value === value);
    if (activeIndex < 0) return;

    const buttons = containerRef.current.querySelectorAll<HTMLButtonElement>(
      "[data-pill-btn]",
    );
    const activeBtn = buttons[activeIndex];
    if (!activeBtn) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();

    setIndicatorStyle({
      left: btnRect.left - containerRect.left,
      width: btnRect.width,
    });
  }, [options, value]);

  useEffect(() => {
    updateIndicator();
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [updateIndicator]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative inline-flex items-center gap-0.5 bg-white/[0.05] flex-shrink-0",
        size === "sm" ? "rounded-lg p-0.5" : "rounded-xl p-1",
      )}
    >
      {/* Animated active indicator */}
      <div
        className={cn(
          "absolute rounded-lg bg-[#FF6A41] shadow-sm shadow-[#FF6A41]/25 transition-all duration-300 ease-out",
          size === "sm" ? "top-0.5 bottom-0.5" : "top-1 bottom-1",
        )}
        style={{
          left: `${indicatorStyle.left}px`,
          width: `${indicatorStyle.width}px`,
        }}
      />

      {/* Option buttons */}
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            data-pill-btn
            onClick={() => onChange(option.value)}
            className={cn(
              "relative z-10 rounded-lg font-medium transition-colors duration-200",
              size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3.5 py-1.5 text-xs",
              isActive ? "text-white" : "text-[#94A3B8] hover:text-white",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default PillToggle;
