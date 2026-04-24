"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isWithinInterval,
  isBefore,
  isAfter,
  isToday as isDateToday,
} from "date-fns";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/locale-context";
import { useDateRange, type DatePreset } from "@/lib/date-range-context";

/* ── Types ── */

export interface DateRange {
  from: Date;
  to: Date;
}

/* ── Preset config ── */

const PRESETS: { value: DatePreset; label: string }[] = [
  { value: "Today", label: "Today" },
  { value: "Yesterday", label: "Yesterday" },
  { value: "7D", label: "Last 7 Days" },
  { value: "14D", label: "Last 14 Days" },
  { value: "30D", label: "Last 30 Days" },
  { value: "90D", label: "Last 90 Days" },
  { value: "365D", label: "Last 365 Days" },
  { value: "Last Month", label: "Last Month" },
];

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/* ── Component ── */

export function DateRangePicker() {
  const { preset, dateRange, setPreset, setCustomRange } = useDateRange();
  const { timezone, dateRangeShort } = useLocale();

  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(dateRange.from));
  const [selecting, setSelecting] = useState<"from" | "to" | null>(null);
  const [tempFrom, setTempFrom] = useState<Date | null>(null);
  const [hoverDay, setHoverDay] = useState<Date | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click / touch (mousedown alone misses some iOS WebKit cases)
  useEffect(() => {
    function handleOutside(e: Event) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSelecting(null);
        setTempFrom(null);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleOutside);
      document.addEventListener("touchstart", handleOutside, { passive: true });
    }
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setSelecting(null);
        setTempFrom(null);
      }
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  function handlePresetClick(p: DatePreset) {
    setPreset(p);
    setSelecting(null);
    setTempFrom(null);
    setOpen(false);
  }

  // Lock out future dates — metrics for days that haven't happened yet are
  // always zero and selecting them produces an off-by-N blended window.
  const todayStart = useMemo(() => startOfDay(new Date()), []);

  function handleDayClick(day: Date) {
    if (isAfter(day, todayStart)) return;
    if (!selecting || selecting === "from") {
      setTempFrom(day);
      setSelecting("to");
    } else {
      const from = tempFrom!;
      const range = isBefore(day, from)
        ? { from: day, to: from }
        : { from, to: day };
      setCustomRange(range);
      setSelecting(null);
      setTempFrom(null);
      setOpen(false);
    }
  }

  function openPicker() {
    setOpen(true);
    setSelecting("from");
    setTempFrom(null);
    setViewMonth(startOfMonth(dateRange.from));
  }

  function handleCancel() {
    setOpen(false);
    setSelecting(null);
    setTempFrom(null);
  }

  // Build calendar grid
  const weeks = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const result: Date[][] = [];
    let day = calStart;
    while (day <= calEnd) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(day);
        day = addDays(day, 1);
      }
      result.push(week);
    }
    return result;
  }, [viewMonth]);

  // Determine which range to highlight
  const displayFrom = tempFrom || dateRange.from;
  const displayTo = selecting === "to" ? (hoverDay || null) : dateRange.to;

  // Button label
  const buttonLabel = preset === "Custom"
    ? dateRangeShort(dateRange.from, dateRange.to)
    : PRESETS.find((p) => p.value === preset)?.label || preset;

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        onClick={openPicker}
        className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all min-w-0 max-w-[180px] sm:max-w-none",
          open
            ? "bg-[#FF6A41]/15 text-[#FF6A41] border border-[#FF6A41]/30"
            : "bg-white/[0.05] text-[#94A3B8] hover:text-white hover:bg-white/[0.08] border border-white/[0.08]",
        )}
      >
        <Calendar size={13} className="flex-shrink-0" />
        <span className="truncate min-w-0">{buttonLabel}</span>
        <ChevronRight size={11} className={cn("flex-shrink-0 transition-transform", open && "rotate-90")} />
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 rounded-2xl border border-white/[0.1] bg-[#12121A] shadow-2xl overflow-hidden flex flex-col sm:flex-row w-[calc(100vw-2rem)] sm:w-auto max-w-[580px]">

          {/* Left: Presets */}
          <div className="flex sm:flex-col gap-1 sm:gap-0 p-3 sm:p-0 sm:py-2 border-b sm:border-b-0 sm:border-r border-white/[0.08] sm:w-[160px] overflow-x-auto sm:overflow-x-visible flex-shrink-0">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => handlePresetClick(p.value)}
                className={cn(
                  "whitespace-nowrap text-left px-4 py-2.5 text-sm transition-colors rounded-lg sm:rounded-none flex-shrink-0",
                  preset === p.value && selecting === null
                    ? "bg-[#FF6A41]/10 text-[#FF6A41] font-medium"
                    : "text-[#CBD5E1] hover:bg-white/[0.06] hover:text-white",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Right: Calendar */}
          <div className="p-4 flex-1 min-w-[280px]">
            {/* Selection guidance */}
            <div className="mb-2 text-[11px] text-[#94A3B8] flex items-center justify-between gap-2">
              <span>
                {selecting === "from" && "Tap start date"}
                {selecting === "to" && tempFrom && (
                  <>
                    Start:{" "}
                    <span className="text-white font-medium">
                      {format(tempFrom, "MMM d, yyyy")}
                    </span>
                    {" "}— tap end date
                  </>
                )}
                {selecting === null && "Pick a preset or a custom range"}
              </span>
            </div>
            {/* Month nav */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setViewMonth(subMonths(viewMonth, 1))}
                className="p-1.5 rounded-lg hover:bg-white/[0.08] text-[#94A3B8] hover:text-white transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold text-[#60A5FA]">
                {format(viewMonth, "MMMM  yyyy")}
              </span>
              <button
                onClick={() => setViewMonth(addMonths(viewMonth, 1))}
                className="p-1.5 rounded-lg hover:bg-white/[0.08] text-[#94A3B8] hover:text-white transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-1">
              {WEEKDAYS.map((d, i) => (
                <div
                  key={d}
                  className={cn(
                    "text-center text-[11px] font-semibold py-1.5",
                    i === 0 || i === 6 ? "text-[#64748B]" : "text-[#94A3B8]",
                  )}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7">
              {weeks.flat().map((d, i) => {
                const inMonth = isSameMonth(d, viewMonth);
                const today = isDateToday(d);
                const isFrom = isSameDay(d, displayFrom);
                const isTo = displayTo ? isSameDay(d, displayTo) : false;
                const inRange =
                  displayFrom && displayTo != null
                    ? isWithinInterval(d, {
                        start: isBefore(displayFrom, displayTo) ? displayFrom : displayTo,
                        end: isAfter(displayFrom, displayTo) ? displayFrom : displayTo,
                      })
                    : false;

                const isEndpoint = isFrom || isTo;
                const isRangeStart = isFrom && displayTo != null && !isBefore(displayTo, displayFrom);
                const isRangeEnd = isTo && displayTo != null && !isAfter(displayFrom, displayTo);
                const isFuture = isAfter(d, todayStart);

                return (
                  <button
                    key={i}
                    onClick={() => handleDayClick(d)}
                    disabled={isFuture}
                    onMouseEnter={() => selecting === "to" && !isFuture && setHoverDay(d)}
                    className={cn(
                      "relative h-9 text-[13px] transition-colors",
                      // Range background (full cell)
                      inRange && !isEndpoint && "bg-[#3B82F6]/15",
                      // Range start: right half highlighted
                      isRangeStart && "bg-gradient-to-r from-transparent to-[#3B82F6]/15",
                      // Range end: left half highlighted
                      isRangeEnd && "bg-gradient-to-l from-transparent to-[#3B82F6]/15",
                      // Out of month
                      !inMonth && "text-[#94A3B8]/25",
                      // Future dates — not selectable
                      isFuture && "cursor-not-allowed",
                    )}
                  >
                    <span
                      className={cn(
                        "relative z-10 flex items-center justify-center w-9 h-9 mx-auto rounded-full transition-colors",
                        // Endpoint styling
                        isEndpoint && "bg-[#3B82F6] text-white font-bold",
                        // Today ring
                        today && !isEndpoint && "ring-1 ring-[#3B82F6]/50 font-semibold text-[#60A5FA]",
                        // Future — muted, un-hoverable
                        isFuture && !isEndpoint && "text-[#94A3B8]/25",
                        // Normal in-month
                        inMonth && !isEndpoint && !today && !isFuture && "text-white hover:bg-white/[0.1]",
                      )}
                    >
                      {format(d, "d")}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Timezone */}
            <div className="mt-4 pt-3 border-t border-white/[0.08] flex items-center justify-between">
              <p className="text-[11px] text-[#64748B]">
                Timezone: {timezone}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancel}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium text-[#94A3B8] hover:text-white hover:bg-white/[0.06] border border-white/[0.08] transition-colors"
                >
                  Cancel
                </button>
                {selecting === "to" && tempFrom && (
                  <button
                    onClick={() => {
                      // Apply with just the start date as single-day range
                      setCustomRange({ from: tempFrom, to: tempFrom });
                      setSelecting(null);
                      setTempFrom(null);
                      setOpen(false);
                    }}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#3B82F6] text-white hover:bg-[#2563EB] transition-colors"
                  >
                    Apply
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
