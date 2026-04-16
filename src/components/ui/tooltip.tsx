"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    timeoutRef.current = setTimeout(() => setVisible(true), 300);
  }, []);

  const hide = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(false);
  }, []);

  const positionClasses: Record<string, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
    left: "right-full top-1/2 -translate-y-1/2 mr-1.5",
    right: "left-full top-1/2 -translate-y-1/2 ml-1.5",
  };

  return (
    <div className="relative" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {visible && (
        <div
          className={cn(
            "absolute z-50 px-2.5 py-1.5 rounded-lg text-[10px] leading-tight font-medium",
            "bg-[#1E1E2A] text-[#E2E8F0] border border-white/[0.1] shadow-xl",
            "max-w-[200px] whitespace-normal pointer-events-none",
            "animate-in fade-in-0 zoom-in-95 duration-150",
            positionClasses[side],
            className,
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}
