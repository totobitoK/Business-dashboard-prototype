"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  DASHBOARD_SECTIONS,
  dashboardRoutesForPathname,
  dashboardSectionHref,
  resolveDashboardSection,
  type DashboardSectionId,
} from "@/lib/dashboard-section-routes";
import { DEMO_DASHBOARD } from "@/lib/routes";
import { useCustomerPortal } from "@/lib/customer-portal-context";
import type { LayoutCustomizeTheme } from "@/lib/layout-customize-themes";

type NavChrome = {
  aside: string;
  idle: string;
  active: string;
  focus: string;
  menu: string;
  rule: string;
};

function navChrome(theme: LayoutCustomizeTheme): NavChrome {
  if (theme.id === "forest") {
    return {
      aside: "border-r border-white/10 bg-[#15241c] text-zinc-100",
      idle: "text-zinc-300 hover:bg-white/5 hover:text-white",
      active: "bg-emerald-200 text-emerald-950",
      focus:
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#15241c]",
      menu: "border-white/10 bg-[#15241c]",
      rule: "bg-white/15",
    };
  }
  if (theme.id === "ocean") {
    return {
      aside: "border-r border-stone-200 bg-[#fbfaf7] text-zinc-900",
      idle: "text-zinc-600 hover:bg-violet-50 hover:text-zinc-950",
      active: "bg-violet-100 text-violet-950",
      focus:
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f4ef]",
      menu: "border-stone-200 bg-white",
      rule: "bg-stone-200",
    };
  }
  return {
    aside: "border-r border-white/10 bg-[#171924] text-zinc-100",
    idle: "text-zinc-300 hover:bg-white/5 hover:text-white",
    active: "bg-[#c7d2fe] text-[#312e81]",
    focus:
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#171924]",
    menu: "border-white/10 bg-[#171924]",
    rule: "bg-white/15",
  };
}

function pageTitleForPath(
  pathname: string,
  searchParams: Pick<URLSearchParams, "get">
): string {
  const routes = dashboardRoutesForPathname(pathname);
  if (pathname.startsWith(routes.connections)) return "Connections";
  if (pathname.startsWith(routes.settings)) return "Settings";
  const section = resolveDashboardSection(pathname, searchParams);
  return DASHBOARD_SECTIONS.find((item) => item.id === section)?.label ?? "Overview";
}

/** Sidebar plus a title header. Settings and Connections use this frame. */
export function DashboardPageFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (
    <DashboardShell title={pageTitleForPath(pathname, searchParams)}>
      <div className="min-h-0 flex-1 p-4 sm:p-5">{children}</div>
    </DashboardShell>
  );
}

/** Customer dashboard chrome: slim sidebar, and a header with the page title only. */
export function DashboardShell({
  title,
  trailing,
  children,
}: {
  title: string;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { theme, liveSamplePreview } = useCustomerPortal();
  const routes = dashboardRoutesForPathname(pathname);
  const onConnections = pathname.startsWith(routes.connections);
  const onSettings = pathname.startsWith(routes.settings);
  const activeSection =
    onConnections || onSettings ? null : resolveDashboardSection(pathname, searchParams);
  const [menuOpen, setMenuOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(activeSection != null);

  useEffect(() => {
    if (activeSection) setGroupOpen(true);
  }, [activeSection]);

  const query = searchParams.toString();
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname, query]);

  const chrome = navChrome(theme);

  return (
    <div
      className={`flex min-h-full w-full flex-1 flex-col lg:flex-row ${theme.scopeClass} ${theme.dashboardCanvas}`}
    >
      {liveSamplePreview ? null : (
        <aside className={`hidden w-48 shrink-0 lg:flex lg:flex-col ${chrome.aside}`}>
          <DashboardNav
            idPrefix="desktop"
            activeSection={activeSection}
            groupOpen={groupOpen}
            onToggleGroup={() => setGroupOpen((open) => !open)}
            chrome={chrome}
          />
        </aside>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className={`relative z-20 ${theme.header} ${theme.headerText}`}>
          <div className="relative z-10 flex items-center gap-3 px-4 py-3 sm:px-5">
            {liveSamplePreview ? null : (
              <button
                type="button"
                className={`rounded-md border border-current/20 px-2.5 py-1.5 text-sm font-semibold lg:hidden ${chrome.focus} ${chrome.idle}`}
                aria-expanded={menuOpen}
                aria-controls="mobile-dashboard-menu"
                onClick={() => setMenuOpen((open) => !open)}
              >
                {menuOpen ? "Close" : "Menu"}
              </button>
            )}
            <h1 className="min-w-0 truncate text-lg font-semibold leading-none sm:text-xl">{title}</h1>
            {trailing ? (
              <div className="ml-auto flex shrink-0 items-center gap-2">{trailing}</div>
            ) : null}
          </div>
          {liveSamplePreview ? (
            <PreviewSectionLinks activeSection={activeSection ?? "overview"} />
          ) : null}
          {menuOpen && !liveSamplePreview ? (
            <div
              id="mobile-dashboard-menu"
              className={`border-t lg:hidden ${chrome.menu} ${chrome.aside}`}
            >
              <DashboardNav
                idPrefix="mobile"
                activeSection={activeSection}
                groupOpen={groupOpen}
                onToggleGroup={() => setGroupOpen((open) => !open)}
                onNavigate={() => setMenuOpen(false)}
                chrome={chrome}
              />
            </div>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}

function DashboardNav({
  idPrefix,
  activeSection,
  groupOpen,
  onToggleGroup,
  onNavigate,
  chrome,
}: {
  idPrefix: string;
  activeSection: DashboardSectionId | null;
  groupOpen: boolean;
  onToggleGroup: () => void;
  onNavigate?: () => void;
  chrome: NavChrome;
}) {
  const pathname = usePathname();
  const { workspaceId, navigationBase, liveSamplePreview } = useCustomerPortal();
  const routes = dashboardRoutesForPathname(pathname);
  const linkBase = navigationBase ?? routes.home;
  const onConnections = pathname.startsWith(routes.connections);
  const onSettings = pathname.startsWith(routes.settings);
  const showUtility = Boolean(workspaceId) && !navigationBase && !liveSamplePreview;
  const showSignOut =
    showUtility && pathname.startsWith("/dashboard") && !pathname.startsWith(DEMO_DASHBOARD);
  const sectionsId = `${idPrefix}-dashboard-sections`;
  const itemClass = `rounded-md px-2.5 py-2 text-left text-sm font-medium leading-none ${chrome.focus}`;

  const utilityHref = (path: string) =>
    workspaceId ? `${path}?workspace=${encodeURIComponent(workspaceId)}` : path;

  if (!workspaceId) return null;

  return (
    <nav aria-label="Dashboard" className="flex flex-col gap-1 p-3">
      <button
        type="button"
        className={`${itemClass} flex items-center justify-between gap-2 font-semibold ${
          activeSection && !groupOpen ? chrome.active : chrome.idle
        }`}
        aria-expanded={groupOpen}
        aria-controls={sectionsId}
        onClick={onToggleGroup}
      >
        Dashboard
        <Chevron expanded={groupOpen} />
      </button>
      <div id={sectionsId} className={`${groupOpen ? "flex" : "hidden"} flex-col gap-1 pl-3`}>
        {DASHBOARD_SECTIONS.map((section) => {
          const isActive = section.id === activeSection;
          return (
            <Link
              key={section.id}
              href={dashboardSectionHref(workspaceId, section.id, linkBase)}
              scroll={false}
              title={section.description}
              aria-current={isActive ? "page" : undefined}
              onClick={onNavigate}
              className={`${itemClass} ${isActive ? chrome.active : chrome.idle}`}
            >
              {section.label}
            </Link>
          );
        })}
      </div>
      {showUtility ? (
        <>
          <span className={`mx-2 my-1 h-px ${chrome.rule}`} aria-hidden />
          <Link
            href={utilityHref(routes.connections)}
            aria-current={onConnections ? "page" : undefined}
            onClick={onNavigate}
            className={`${itemClass} ${onConnections ? chrome.active : chrome.idle}`}
          >
            Connections
          </Link>
          <Link
            href={utilityHref(routes.settings)}
            aria-current={onSettings ? "page" : undefined}
            onClick={onNavigate}
            className={`${itemClass} ${onSettings ? chrome.active : chrome.idle}`}
          >
            Settings
          </Link>
          {showSignOut ? (
            <form action="/auth/logout" method="post">
              <button type="submit" className={`${itemClass} w-full ${chrome.idle}`}>
                Sign out
              </button>
            </form>
          ) : null}
        </>
      ) : null}
    </nav>
  );
}

function PreviewSectionLinks({ activeSection }: { activeSection: DashboardSectionId }) {
  const { workspaceId, theme, navigationBase } = useCustomerPortal();
  const linkBase = navigationBase ?? dashboardRoutesForPathname(usePathname()).home;
  if (!workspaceId || !linkBase) return null;
  return (
    <nav aria-label="Preview sections" className="relative z-10 flex flex-wrap gap-1 px-4 pb-3 sm:px-5">
      {DASHBOARD_SECTIONS.map((section) => {
        const isActive = section.id === activeSection;
        return (
          <Link
            key={section.id}
            href={dashboardSectionHref(workspaceId, section.id, linkBase)}
            scroll={false}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-md px-2.5 py-1 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 ${
              isActive ? theme.embeddedNavActive : theme.headerLink
            }`}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="shrink-0">
      <path
        d={expanded ? "M4 6.5 8 10.5 12 6.5" : "M6.5 4 10.5 8 6.5 12"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
