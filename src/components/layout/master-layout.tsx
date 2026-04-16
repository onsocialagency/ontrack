"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { cn } from "@/lib/utils";

/* ── Types ── */

interface MasterLayoutProps {
  children: React.ReactNode;
}

/* ── Component ── */

export function MasterLayout({ children }: MasterLayoutProps) {
  return (
    <div className="flex min-h-screen overflow-x-hidden">
      <Sidebar mode="master" />
      <main
        className={cn(
          "flex-1 flex flex-col min-h-screen min-w-0",
          "ml-0 lg:ml-[240px]",
          "transition-all duration-300",
        )}
      >
        {children}
      </main>
    </div>
  );
}

export default MasterLayout;
