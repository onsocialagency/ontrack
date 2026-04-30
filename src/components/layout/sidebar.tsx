"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Target,
  Palette,
  Users,
  FileText,
  Settings,
  TrendingUp,
  ShoppingCart,
  DollarSign,
  ChevronLeft,
  Menu,
  LogOut,
  BarChart3,
  Megaphone,
  GitCompare,
  Lightbulb,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSuggestionAlerts } from "@/lib/suggestion-alert-context";

/* ── Types ── */

type ClientType = "ecommerce" | "lead_gen" | "hybrid";

interface SidebarProps {
  mode: "master" | "client";
  clientSlug?: string;
  clientType?: ClientType;
  clientName?: string;
  clientColor?: string;
  clientLogo?: string;
  isAdmin?: boolean;
  /** Show green dot on Creative Lab nav when there are alerts */
  creativeLabHasAlerts?: boolean;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  /** Show a small green dot badge (e.g. for Creative Lab alerts) */
  badge?: boolean;
  /** Show a numeric count badge next to the label */
  countBadge?: number;
}

/* ── Navigation Definitions ── */

function getMasterNav(): NavItem[] {
  return [
    { label: "Dashboard", href: "/master", icon: <LayoutDashboard size={20} /> },
    { label: "Clients", href: "/master/clients", icon: <Users size={20} /> },
    { label: "Revenue", href: "/master/revenue", icon: <DollarSign size={20} /> },
  ];
}

function getMinistryNav(slug: string): NavItem[] {
  const base = `/${slug}`;
  return [
    { label: "Overview", href: base, icon: <LayoutDashboard size={20} /> },
    { label: "Suggestions", href: `${base}/suggestions`, icon: <Lightbulb size={20} /> },
    // Campaigns → the new sortable / filterable table (formerly a redirect to /attribution).
    { label: "Campaigns", href: `${base}/campaigns`, icon: <Megaphone size={20} /> },
    { label: "Creative Lab", href: `${base}/creative-lab`, icon: <Palette size={20} /> },
    { label: "Lead Generation", href: `${base}/lead-gen`, icon: <Target size={20} /> },
    { label: "CRM Reconciliation", href: `${base}/crm`, icon: <GitCompare size={20} /> },
    // Reports tab — Ministry-flavoured weekly/monthly builder lives at /reports.
    { label: "Reports", href: `${base}/reports`, icon: <FileText size={20} /> },
    { label: "Settings", href: `${base}/settings`, icon: <Settings size={20} /> },
  ];
}

function getIrgNav(slug: string): NavItem[] {
  const base = `/${slug}`;
  // Order per the 29 April 2026 IRG brief.
  // Note: Campaigns now points at the dedicated /campaigns route (was
  // a redirect to /attribution previously). Events + Reconciliation
  // are new IRG-specific tabs.
  return [
    { label: "Overview", href: base, icon: <LayoutDashboard size={20} /> },
    { label: "Suggestions", href: `${base}/suggestions`, icon: <Lightbulb size={20} /> },
    { label: "Campaigns", href: `${base}/campaigns`, icon: <Megaphone size={20} /> },
    // Events tab dropped — IRG runs brand-level always-on / awareness
    // campaigns rather than per-event campaigns, so a per-event view
    // had no genuine signal to show. If artist-tagged campaigns ship
    // later this can come back; for now Campaigns covers the territory.
    { label: "Creative Lab", href: `${base}/creative-lab`, icon: <Palette size={20} /> },
    { label: "Reconciliation", href: `${base}/reconciliation`, icon: <GitCompare size={20} /> },
    { label: "Reports", href: `${base}/reports`, icon: <FileText size={20} /> },
    { label: "Settings", href: `${base}/settings`, icon: <Settings size={20} /> },
  ];
}

function getLaurastarNav(slug: string): NavItem[] {
  const base = `/${slug}`;
  return [
    { label: "Overview", href: base, icon: <LayoutDashboard size={20} /> },
    { label: "Suggestions", href: `${base}/suggestions`, icon: <Lightbulb size={20} /> },
    { label: "Campaigns", href: `${base}/attribution`, icon: <Megaphone size={20} /> },
    { label: "Creative Lab", href: `${base}/creative-lab`, icon: <Palette size={20} /> },
    { label: "Ecom", href: `${base}/ecom`, icon: <ShoppingCart size={20} /> },
    { label: "Reports", href: `${base}/reports`, icon: <FileText size={20} /> },
    { label: "Settings", href: `${base}/settings`, icon: <Settings size={20} /> },
  ];
}

function getClientNav(slug: string, clientType: ClientType): NavItem[] {
  // Custom nav for specific clients
  if (slug === "ministry") return getMinistryNav(slug);
  if (slug === "irg") return getIrgNav(slug);
  if (slug === "laurastar") return getLaurastarNav(slug);

  const base = `/${slug}`;
  const items: NavItem[] = [
    { label: "Overview", href: base, icon: <LayoutDashboard size={20} /> },
    { label: "Suggestions", href: `${base}/suggestions`, icon: <Lightbulb size={20} /> },
    { label: "Attribution", href: `${base}/attribution`, icon: <TrendingUp size={20} /> },
    { label: "Creative Lab", href: `${base}/creative-lab`, icon: <Palette size={20} /> },
    { label: "Web Analytics", href: `${base}/analytics`, icon: <BarChart3 size={20} /> },
  ];

  if (clientType === "lead_gen" || clientType === "hybrid") {
    items.push({ label: "Lead Gen", href: `${base}/lead-gen`, icon: <Target size={20} /> });
    items.push({ label: "CRM Reconciliation", href: `${base}/crm`, icon: <GitCompare size={20} /> });
  }

  if (clientType === "ecommerce" || clientType === "hybrid") {
    items.push({ label: "Ecom", href: `${base}/ecom`, icon: <ShoppingCart size={20} /> });
  }

  items.push(
    { label: "Reports", href: `${base}/reports`, icon: <FileText size={20} /> },
    { label: "Settings", href: `${base}/settings`, icon: <Settings size={20} /> },
  );

  return items;
}

/* ── Component ── */

export function Sidebar({
  mode,
  clientSlug,
  clientType = "hybrid",
  clientName,
  clientColor,
  clientLogo,
  isAdmin = false,
  creativeLabHasAlerts = false,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { summary: suggestionSummary } = useSuggestionAlerts();

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const navItems =
    mode === "master"
      ? getMasterNav()
      : getClientNav(clientSlug ?? "", clientType).map((item) => {
          if (item.label === "Creative Lab" && creativeLabHasAlerts) {
            return { ...item, badge: true };
          }
          if (item.label === "Suggestions") {
            const next: NavItem = { ...item };
            if (suggestionSummary.hasHighPriority) next.badge = true;
            if (suggestionSummary.totalActive > 0) next.countBadge = suggestionSummary.totalActive;
            return next;
          }
          return item;
        });

  const homeHref = mode === "master" ? "/master" : `/${clientSlug}`;

  // Ministry uses gold accent instead of orange
  const isMinistry = clientSlug === "ministry";
  const accentBg = isMinistry ? "bg-[#C8A96E]/15" : "bg-[#FF6A41]/15";
  const accentText = isMinistry ? "text-[#C8A96E]" : "text-[#FF6A41]";

  function isActive(href: string): boolean {
    if (href === "/master" || href === `/${clientSlug}`) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  }

  const sidebarContent = (
    <>
      {/* OnTrack brand logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-white/[0.08]">
        <Link href={homeHref} className="flex items-center gap-2 overflow-hidden">
          <svg
            width="32"
            height="32"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="flex-shrink-0"
          >
            <circle cx="30" cy="55" r="28" fill="#FF6A41" />
            <path d="M52,55 a25,25 0 0,1 50,0 L52,55 Z" fill="#FF6A41" />
          </svg>
          {!collapsed && (
            <span className="text-base font-semibold tracking-tight whitespace-nowrap">
              OnTrack
            </span>
          )}
        </Link>
        {/* Desktop collapse button */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="hidden lg:flex items-center justify-center w-6 h-6 rounded-md hover:bg-white/10 transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft
            size={16}
            className={cn("transition-transform", collapsed && "rotate-180")}
          />
        </button>
        {/* Mobile close button */}
        <button
          onClick={() => setMobileOpen(false)}
          className="flex lg:hidden items-center justify-center w-8 h-8 rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </div>

      {/* Client identity section (client mode only) */}
      {mode === "client" && clientName && (
        <div
          className={cn(
            "border-b border-white/[0.08] transition-all relative",
            collapsed ? "px-2 py-3" : "px-4 py-3",
          )}
        >
          {/* Client switcher dropdown removed from in-client views.
              Even for admins, having a "switch to other client"
              dropdown next to a client's branding implies the current
              page can pivot to other tenants — confusing UX and a
              data-leak optic. Admins go to /master/clients to
              navigate between clients instead. */}
          <div
            className={cn(
              "flex items-center gap-2.5",
              collapsed && "justify-center",
            )}
          >
            {clientLogo ? (
              <div className="flex-shrink-0 w-8 h-8 rounded-xl overflow-hidden flex items-center justify-center bg-white/10 shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={clientLogo}
                  alt={`${clientName} logo`}
                  className="max-w-[120px] w-auto max-h-[32px] object-contain"
                />
              </div>
            ) : (
              <div
                className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-lg"
                style={{ backgroundColor: clientColor || "#FF6A41" }}
              >
                {clientName.slice(0, 2).toUpperCase()}
              </div>
            )}
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white truncate">
                    {clientName}
                  </p>
                  <p className="text-[10px] text-[#A8BBCC]">
                    {isAdmin ? "Admin View" : "Client Dashboard"}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                active
                  ? cn(accentBg, accentText)
                  : "text-[#A8BBCC] hover:text-white hover:bg-white/[0.06]",
                collapsed && "justify-center px-0",
              )}
            >
              <span
                className={cn(
                  "flex-shrink-0 transition-colors",
                  active ? accentText : "text-[#A8BBCC] group-hover:text-white",
                )}
              >
                {item.icon}
              </span>
              {!collapsed && <span className="truncate">{item.label}</span>}
              {!collapsed && typeof item.countBadge === "number" && item.countBadge > 0 && (
                <span className="ml-auto flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/[0.08] text-[#E2E8F0]">
                  {item.countBadge}
                </span>
              )}
              {item.badge && (
                <span className={cn(
                  "w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0 animate-pulse",
                  !collapsed && typeof item.countBadge !== "number" && "ml-auto",
                )} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/[0.08] space-y-3">
        <button
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            router.push("/login");
          }}
          className={cn(
            "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium text-[#A8BBCC] hover:text-white hover:bg-white/[0.06] transition-colors",
            collapsed && "justify-center px-0",
          )}
        >
          <LogOut size={16} />
          {!collapsed && "Sign Out"}
        </button>
        {!collapsed && (
          <p className="text-[10px] text-[#A8BBCC]/60 text-center">
            Powered by{" "}
            <a
              href="https://onsocial.agency"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#A8BBCC]/80 hover:text-[#FF6A41] transition-colors"
            >
              OnSocial
            </a>
          </p>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger toggle — only visible when sidebar is closed */}
      {!mobileOpen && (
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed top-4 left-4 z-50 p-2.5 rounded-xl bg-[#12121A]/90 border border-white/[0.08] backdrop-blur-sm lg:hidden active:scale-95 transition-transform"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
      )}

      {/* Mobile backdrop overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col w-[260px]",
          "bg-[#0D0D14]/95 backdrop-blur-xl border-r border-white/[0.08]",
          "transition-transform duration-300 ease-in-out",
          "lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex-col hidden lg:flex",
          "bg-[#0D0D14]/80 backdrop-blur-xl border-r border-white/[0.08]",
          "transition-all duration-300 ease-in-out",
          collapsed ? "w-[68px]" : "w-[240px]",
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}

export default Sidebar;
