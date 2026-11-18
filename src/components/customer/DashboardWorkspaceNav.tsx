"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { type ReactNode } from "react";
import {
  DASHBOARD_SECTIONS,
  dashboardRoutesForPathname,
  dashboardSectionHref,
  resolveDashboardSection,
  type DashboardSectionId,
} from "@/lib/dashboard-section-routes";
import { DEMO_DASHBOARD } from "@/lib/routes";
import { useCustomerPortal } from "@/lib/customer-portal-context";
import {
  keepDashboardSectionClick,
  useDashboardSection,
} from "@/components/customer/dashboard-section-context";
import { useDashboardComposition } from "@/components/customer/use-dashboard-composition";
import { useSignedInNav } from "@/components/customer/signed-in-nav-context";
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
      aside: "border-r border-white/10 bg-[#15241c]/45 text-zinc-100 backdrop-blur-xl",
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
      aside: "border-r border-stone-200/80 bg-[#f7f3ee]/70 text-zinc-900 backdrop-blur-xl",
      idle: "text-zinc-600 hover:bg-[#f3ece4] hover:text-zinc-950",
      active: "bg-[#3c2a1e] text-[#f7f3ee]",
      focus:
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b4f3a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f3ee]",
      menu: "border-stone-200 bg-white",
      rule: "bg-stone-200",
    };
  }
  if (theme.id === "harbor") {
    return {
      aside: "border-r border-[#d5dee8] bg-[#f4f7fb]/80 text-zinc-900 backdrop-blur-xl",
      idle: "text-zinc-600 hover:bg-[#e7eef5] hover:text-zinc-950",
      active: "bg-[#1e3a5f] text-[#f4f7fb]",
      focus:
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e3a5f] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f4f7fb]",
      menu: "border-[#d5dee8] bg-white",
      rule: "bg-[#d5dee8]",
    };
  }
  if (theme.id === "ash") {
    return {
      aside: "border-r border-zinc-200 bg-[#f3f4f6]/80 text-zinc-900 backdrop-blur-xl",
      idle: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950",
      active: "bg-[#2c2c2c] text-[#f4f4f5]",
      focus:
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2c2c2c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f3f4f6]",
      menu: "border-zinc-200 bg-white",
      rule: "bg-zinc-200",
    };
  }
  if (theme.id === "carbon") {
    return {
      aside: "border-r border-white/10 bg-[#141414]/55 text-zinc-100 backdrop-blur-xl",
      idle: "text-zinc-300 hover:bg-white/5 hover:text-white",
      active: "bg-[#e7e2d8] text-[#1a1a1a]",
      focus:
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e7e2d8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141414]",
      menu: "border-white/10 bg-[#1c1c1c]",
      rule: "bg-white/15",
    };
  }
  return {
    aside: "border-r border-white/10 bg-[#171924]/45 text-zinc-100 backdrop-blur-xl",
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
  const showingSettings = useSignedInNav()?.showingSettings ?? false;
  return (
    <DashboardShell title={showingSettings ? "Settings" : pageTitleForPath(pathname, searchParams)}>
      <div className="min-h-0 flex-1 p-4 sm:p-5">{children}</div>
    </DashboardShell>
  );
}

/** Customer dashboard chrome: page title and section links in one top bar. */
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
  const { theme, liveSamplePreview, businessName } = useCustomerPortal();
  const routes = dashboardRoutesForPathname(pathname);
  const onConnections = pathname.startsWith(routes.connections);
  const onSettings = pathname.startsWith(routes.settings);
  const showingSettings = useSignedInNav()?.showingSettings ?? false;
  const selectedSection = useDashboardSection()?.section;
  const activeSection =
    onConnections || onSettings || showingSettings
      ? null
      : selectedSection ?? resolveDashboardSection(pathname, searchParams);
  const chrome = navChrome(theme);

  return (
    <div className={`flex min-h-full w-full flex-1 flex-col ${theme.scopeClass} ${theme.dashboardAtmosphere}`}>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className={`relative z-30 overflow-visible ${theme.headerText}`}>
          <div aria-hidden className={`pointer-events-none absolute inset-0 ${theme.header}`} />
          <div className="relative z-10 flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5">
            <h1 className="min-w-0 truncate text-lg font-semibold leading-none sm:text-xl">
              {businessName || title}
            </h1>
            {liveSamplePreview ? null : (
              <DashboardNav activeSection={activeSection} chrome={chrome} />
            )}
            {trailing ? (
              <div className="ml-auto flex w-full min-w-0 shrink-0 basis-full items-center justify-end gap-2 sm:w-auto sm:basis-auto">
                {trailing}
              </div>
            ) : null}
          </div>
          {liveSamplePreview ? (
            <PreviewSectionLinks activeSection={activeSection ?? "overview"} />
          ) : null}
        </div>
        <div className={`flex min-h-0 min-w-0 flex-1 flex-col ${theme.dashboardCanvas}`}>
          {children}
        </div>
      </div>
    </div>
  );
}

function DashboardNav({
  activeSection,
  chrome,
}: {
  activeSection: DashboardSectionId | null;
  chrome: NavChrome;
}) {
  const pathname = usePathname();
  const sectionState = useDashboardSection();
  const signedInNav = useSignedInNav();
  const { workspaceId, navigationBase, liveSamplePreview, theme } = useCustomerPortal();
  const composition = useDashboardComposition();
  const sections = composition
    ? DASHBOARD_SECTIONS.filter((section) => composition.sections.includes(section.id))
    : DASHBOARD_SECTIONS;
  const highlighted =
    activeSection && sections.some((section) => section.id === activeSection)
      ? activeSection
      : null;
  const routes = dashboardRoutesForPathname(pathname);
  const linkBase = navigationBase ?? routes.home;
  const onConnections = pathname.startsWith(routes.connections);
  const onSettings = pathname.startsWith(routes.settings) || (signedInNav?.showingSettings ?? false);
  const showUtility = Boolean(workspaceId) && !navigationBase && !liveSamplePreview;
  const showSignOut =
    showUtility && pathname.startsWith("/dashboard") && !pathname.startsWith(DEMO_DASHBOARD);
  const itemClass = `rounded-md px-2.5 py-1 text-sm font-medium leading-none ${chrome.focus}`;

  const utilityHref = (path: string) =>
    pathname.startsWith(DEMO_DASHBOARD) && workspaceId
      ? `${path}?workspace=${encodeURIComponent(workspaceId)}`
      : path;

  if (!workspaceId) return null;

  return (
    <nav aria-label="Dashboard" className="flex flex-wrap items-center gap-1">
      {sections.map((section) => {
        const isActive = section.id === highlighted;
        return (
          <Link
            key={section.id}
            href={dashboardSectionHref(workspaceId, section.id, linkBase)}
            scroll={false}
            title={section.description}
            aria-current={isActive ? "page" : undefined}
            onClick={(event) => {
              if (
                signedInNav?.canSwap &&
                event.button === 0 &&
                !event.metaKey &&
                !event.ctrlKey &&
                !event.shiftKey &&
                !event.altKey
              ) {
                event.preventDefault();
                signedInNav.showDashboard(section.id);
                return;
              }
              keepDashboardSectionClick(event, sectionState?.selectSection, section.id);
            }}
            className={`${itemClass} ${isActive ? chrome.active : theme.headerLink}`}
          >
            {section.label}
          </Link>
        );
      })}
      {showUtility ? (
        <>
          <Link
            href={utilityHref(routes.connections)}
            aria-current={onConnections ? "page" : undefined}
            className={`${itemClass} ${onConnections ? chrome.active : theme.headerLink}`}
          >
            Connections
          </Link>
          <Link
            href={utilityHref(routes.settings)}
            aria-current={onSettings ? "page" : undefined}
            onClick={(event) => {
              if (
                !signedInNav?.canSwap ||
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              ) {
                return;
              }
              event.preventDefault();
              signedInNav.showSettings();
            }}
            className={`${itemClass} ${onSettings ? chrome.active : theme.headerLink}`}
          >
            Settings
          </Link>
          {showSignOut ? (
            <form action="/auth/logout" method="post">
              <button type="submit" className={`${itemClass} ${theme.headerLink}`}>
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
  const sectionState = useDashboardSection();
  const { workspaceId, theme, navigationBase } = useCustomerPortal();
  const composition = useDashboardComposition();
  const sections = composition
    ? DASHBOARD_SECTIONS.filter((section) => composition.sections.includes(section.id))
    : DASHBOARD_SECTIONS;
  const highlighted = sections.some((section) => section.id === activeSection)
    ? activeSection
    : "overview";
  const linkBase = navigationBase ?? dashboardRoutesForPathname(usePathname()).home;
  if (!workspaceId || !linkBase) return null;
  return (
    <nav aria-label="Preview sections" className="relative z-10 flex flex-wrap gap-1 px-4 pb-3 sm:px-5">
      {sections.map((section) => {
        const isActive = section.id === highlighted;
        return (
          <Link
            key={section.id}
            href={dashboardSectionHref(workspaceId, section.id, linkBase)}
            scroll={false}
            aria-current={isActive ? "page" : undefined}
            onClick={(event) =>
              keepDashboardSectionClick(event, sectionState?.selectSection, section.id)
            }
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

