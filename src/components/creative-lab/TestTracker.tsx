"use client";

import { FlaskConical, CheckCircle, PauseCircle, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Client } from "@/lib/types";

interface TestTrackerProps {
  tests: NonNullable<Client["testTracker"]>;
}

const STATUS_CONFIG = {
  running: { icon: <Play size={12} />, color: "text-emerald-400", bg: "bg-emerald-500/20", label: "Running" },
  concluded: { icon: <CheckCircle size={12} />, color: "text-sky-400", bg: "bg-sky-500/20", label: "Concluded" },
  paused: { icon: <PauseCircle size={12} />, color: "text-amber-400", bg: "bg-amber-500/20", label: "Paused" },
};

export function TestTracker({ tests }: TestTrackerProps) {
  if (!tests || tests.length === 0) {
    return (
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-white/[0.06] bg-white/[0.02] flex items-center gap-2">
          <FlaskConical size={14} className="text-violet-400" />
          <h3 className="text-sm font-semibold text-white">A/B Test Tracker</h3>
        </div>
        <div className="p-8 text-center">
          <p className="text-sm text-[#94A3B8]">No tests configured.</p>
          <p className="text-[11px] text-[#64748B] mt-1">
            Add test entries in the client config to track creative A/B tests here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl overflow-hidden">
      <div className="px-4 sm:px-5 py-3 border-b border-white/[0.06] bg-white/[0.02] flex items-center gap-2">
        <FlaskConical size={14} className="text-violet-400" />
        <h3 className="text-sm font-semibold text-white">A/B Test Tracker</h3>
        <span className="text-[10px] text-[#64748B]">{tests.length} test{tests.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-white/[0.08]">
              <th className="text-left p-3 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Hypothesis</th>
              <th className="text-left p-3 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Creative A</th>
              <th className="text-left p-3 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Creative B</th>
              <th className="text-center p-3 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Status</th>
              <th className="text-left p-3 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Winner</th>
              <th className="text-left p-3 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Week</th>
            </tr>
          </thead>
          <tbody>
            {tests.map((test) => {
              const status = STATUS_CONFIG[test.status];
              return (
                <tr key={test.id} className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                  <td className="p-3 text-xs text-white max-w-[200px]">
                    <p className="line-clamp-2">{test.hypothesis}</p>
                  </td>
                  <td className="p-3 text-xs text-[#94A3B8] font-mono">{test.creativeA}</td>
                  <td className="p-3 text-xs text-[#94A3B8] font-mono">{test.creativeB}</td>
                  <td className="p-3 text-center">
                    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold", status.bg, status.color)}>
                      {status.icon}
                      {status.label}
                    </span>
                  </td>
                  <td className="p-3 text-xs font-medium">
                    {test.winner ? (
                      <span className="text-emerald-400">{test.winner}</span>
                    ) : (
                      <span className="text-[#64748B]">--</span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-[#94A3B8]">{test.weekStarted}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden p-3 space-y-2">
        {tests.map((test) => {
          const status = STATUS_CONFIG[test.status];
          return (
            <div
              key={test.id}
              className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-white line-clamp-3 flex-1 min-w-0">{test.hypothesis}</p>
                <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold flex-shrink-0", status.bg, status.color)}>
                  {status.icon}
                  {status.label}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.04]">
                <div className="min-w-0">
                  <p className="text-[9px] text-[#8192A6] uppercase tracking-wider truncate">Creative A</p>
                  <p className="text-[11px] text-[#94A3B8] font-mono truncate">{test.creativeA}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] text-[#8192A6] uppercase tracking-wider truncate">Creative B</p>
                  <p className="text-[11px] text-[#94A3B8] font-mono truncate">{test.creativeB}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] text-[#8192A6] uppercase tracking-wider truncate">Winner</p>
                  <p className="text-[11px] font-medium truncate">
                    {test.winner ? (
                      <span className="text-emerald-400">{test.winner}</span>
                    ) : (
                      <span className="text-[#64748B]">—</span>
                    )}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] text-[#8192A6] uppercase tracking-wider truncate">Week</p>
                  <p className="text-[11px] text-[#94A3B8] truncate">{test.weekStarted}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
