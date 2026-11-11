"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import {
  DASHBOARD_SECTIONS,
  dashboardRoutesForPathname,
  dashboardSectionHref,
  resolveDashboardSection,
} from "@/lib/dashboard-section-routes";
import { DEMO_DASHBOARD } from "@/lib/routes";
import { useCustomerPortal } from "@/lib/customer-portal-context";

const sectionClass =
  "rounded-md px-2.5 py-1 text-sm font-semibold leading-none transition-colors";
const quietClass =
  "rounded-md px-2 py-1 text-xs font-medium leading-none text-white/70 transition-colors hover:bg-white/10 hover:text-white";

/** Colored header plus page body, for Settings and Connections. */
export function DashboardPageFrame({ children }: { children: ReactNode }) {
  const { theme, businessName } = useCustomerPortal();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className={`${theme.header} ${theme.headerText}`}>
        <DashboardTopBar title={businessName} />
      </div>
      <div className="min-h-0 flex-1 p-4 sm:p-5">{children}</div>
    </div>
  );
}

/** Section and utility buttons sitting inside the dashboard's colored header. */
export function DashboardTopBar({
  title,
  trailing,
}: {
  title: string;
  trailing?: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { workspaceId, theme, navigationBase, liveSamplePreview } = useCustomerPortal();
  const routes = dashboardRoutesForPathname(pathname);
  const linkBase = navigationBase ?? routes.home;
  const onConnections = pathname.startsWith(routes.connections);
  const onSettings = pathname.startsWith(routes.settings);
  const activeSection =
    onConnections || onSettings ? null : resolveDashboardSection(pathname, searchParams);
  const showUtility = Boolean(workspaceId) && !navigationBase && !liveSamplePreview;
  const showSignOut =
    showUtility &&
    pathname.startsWith("/dashboard") &&
    !pathname.startsWith(DEMO_DASHBOARD);

  const utilityHref = (path: string) =>
    workspaceId ? `${path}?workspace=${encodeURIComponent(workspaceId)}` : path;

  return (
    <div className="relative z-10 flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5">
      <p className="min-w-0 max-w-full truncate text-lg font-semibold leading-none sm:text-xl">
        {title}
      </p>
      {workspaceId ? (
        <nav aria-label="Dashboard" className="flex flex-wrap items-center gap-1">
          {DASHBOARD_SECTIONS.map((section) => {
            const isActive = section.id === activeSection;
            return (
              <Link
                key={section.id}
                href={dashboardSectionHref(workspaceId, section.id, linkBase)}
                scroll={false}
                title={section.description}
                aria-current={isActive ? "page" : undefined}
                className={`${sectionClass} ${
                  isActive
                    ? theme.embeddedNavActive
                    : "text-white/90 hover:bg-white/15"
                }`}
              >
                {section.label}
              </Link>
            );
          })}
          {showUtility ? (
            <>
              <span className="mx-1 hidden h-4 w-px bg-white/25 sm:inline-block" aria-hidden />
              <Link
                href={utilityHref(routes.connections)}
                aria-current={onConnections ? "page" : undefined}
                className={onConnections ? `${sectionClass} ${theme.embeddedNavActive}` : quietClass}
              >
                Connections
              </Link>
              <Link
                href={utilityHref(routes.settings)}
                aria-current={onSettings ? "page" : undefined}
                className={onSettings ? `${sectionClass} ${theme.embeddedNavActive}` : quietClass}
              >
                Settings
              </Link>
              {showSignOut ? (
                <form action="/auth/logout" method="post">
                  <button type="submit" className={quietClass}>
                    Sign out
                  </button>
                </form>
              ) : null}
            </>
          ) : null}
        </nav>
      ) : null}
      {trailing ? (
        <div className="ml-auto flex shrink-0 items-center gap-2">{trailing}</div>
      ) : null}
    </div>
  );
}
