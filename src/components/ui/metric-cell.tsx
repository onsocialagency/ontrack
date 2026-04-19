import { cn } from "@/lib/utils";

/**
 * Compact metric display used in mobile card layouts where wide data
 * tables collapse into a 3-column grid. Each cell shows a short uppercase
 * label and a value; values and labels truncate rather than wrap so the
 * grid stays predictable at ~375px viewport width.
 */
export function MetricCell({
  label,
  value,
  emphasis,
  className,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[9px] text-[#8192A6] uppercase tracking-wider truncate">{label}</p>
      <p
        className={cn(
          "text-[12px] truncate",
          emphasis ? "text-white font-semibold" : "text-[#E2E8F0]"
        )}
      >
        {value}
      </p>
    </div>
  );
}
