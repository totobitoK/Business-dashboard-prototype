"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { DEMO_DASHBOARD } from "@/lib/routes";
import {
  dashboardMoneyHref,
  dashboardRoutesForPathname,
  dashboardSectionHref,
  moneyViewFromSearchParams,
  resolveDashboardSection,
} from "@/lib/dashboard-section-routes";
import { resolveDailyTheme } from "@/lib/daily-dashboard/theme";
import { useCustomerPortal } from "@/lib/customer-portal-context";

export function DailyDashboardFrame(props: {
  companyName?: string;
  sampleLabel?: string | null;
  periodControl?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#12141a]" />}>
      <DailyDashboardFrameBody {...props} />
    </Suspense>
  );
}

function DailyDashboardFrameBody({
  companyName,
  sampleLabel,
  periodControl,
  children,
}: {
  companyName?: string;
  sampleLabel?: string | null;
  periodControl?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { workspaceId, businessName, settings } = useCustomerPortal();
  const theme = resolveDailyTheme(settings.themeId);
  const routes = dashboardRoutesForPathname(pathname);
  const demo = pathname.startsWith("/demo");
  const title = companyName ?? businessName;
  const sample = sampleLabel !== undefined ? sampleLabel : demo ? "Sample data" : null;
  const onSettings = pathname.startsWith(routes.settings);
  const onConnections = pathname.startsWith(routes.connections);
  const section = onSettings || onConnections ? null : resolveDashboardSection(pathname, searchParams);
  const moneyView = moneyViewFromSearchParams(searchParams);
  const showSignOut = pathname.startsWith("/dashboard") && !pathname.startsWith(DEMO_DASHBOARD);
  const query = searchParams.toString();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname, query]);

  const workspace = workspaceId || "";
  const primary = [
    { id: "overview" as const, label: "Overview", href: dashboardSectionHref(workspace, "overview", routes.home) },
    { id: "revenue" as const, label: "Money", href: dashboardSectionHref(workspace, "revenue", routes.home) },
    { id: "schedule" as const, label: "Schedule", href: dashboardSectionHref(workspace, "schedule", routes.home) },
  ];
  const moneyLinks = [
    { id: "receivables" as const, label: "Receivables", href: dashboardMoneyHref(workspace, "receivables", routes.home) },
    { id: "collections" as const, label: "Collections", href: dashboardMoneyHref(workspace, "collections", routes.home) },
  ];
  const utility = [
    { label: "Connections", href: withWorkspace(routes.connections, workspace), active: onConnections },
    { label: "Settings", href: withWorkspace(routes.settings, workspace), active: onSettings },
  ];

  function navClass(active: boolean) {
    return `rounded-md px-2.5 py-1.5 text-sm font-semibold ${theme.focus} ${
      active ? theme.navActive : theme.navIdle
    }`;
  }

  return (
    <div className={`flex min-h-screen w-full ${theme.canvas}`}>
      <aside className={`hidden w-60 shrink-0 flex-col lg:flex ${theme.sidebar}`}>
        <p className={`px-4 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-[0.16em] ${theme.subtle}`}>
          RavenView
        </p>
        <nav aria-label="Dashboard" className="flex flex-1 flex-col gap-1 px-3">
          {primary.map((item) => (
            <div key={item.id}>
              <Link href={item.href} aria-current={section === item.id ? "page" : undefined} className={navClass(section === item.id)}>
                {item.label}
              </Link>
              {item.id === "revenue" ? (
                <div className="ml-3 mt-1 flex flex-col gap-1">
                  {moneyLinks.map((link) => (
                    <Link
                      key={link.id}
                      href={link.href}
                      aria-current={section === "revenue" && moneyView === link.id ? "page" : undefined}
                      className={navClass(section === "revenue" && moneyView === link.id)}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </nav>
        <div className={`mt-auto space-y-1 border-t px-3 py-3 ${theme.divider}`}>
          {utility.map((item) => (
            <Link key={item.label} href={item.href} aria-current={item.active ? "page" : undefined} className={navClass(item.active)}>
              {item.label}
            </Link>
          ))}
          {showSignOut ? (
            <form action="/auth/logout" method="post">
              <button type="submit" className={`${navClass(false)} w-full text-left`}>
                Sign out
              </button>
            </form>
          ) : null}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className={`${theme.header} px-4 py-3 sm:px-5`}>
          <div className="relative z-10 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold leading-tight">{title}</p>
              {sample ? (
                <p className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${theme.badge}`}>
                  {sample}
                </p>
              ) : null}
            </div>
            {periodControl ? <div className="relative z-10">{periodControl}</div> : null}
          </div>
          <div className="relative z-10 mt-3 flex items-center gap-1 lg:hidden">
            {primary.map((item) => (
              <Link key={item.id} href={item.href} className={navClass(section === item.id)}>
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              className={`ml-auto ${navClass(menuOpen)}`}
              aria-expanded={menuOpen}
              aria-controls="dashboard-utility-menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              Menu
            </button>
          </div>
          {menuOpen ? (
            <div id="dashboard-utility-menu" className={`relative z-10 mt-2 p-2 lg:hidden ${theme.menu}`}>
              {utility.map((item) => (
                <Link key={item.label} href={item.href} className={`block ${navClass(item.active)}`}>
                  {item.label}
                </Link>
              ))}
              {showSignOut ? (
                <form action="/auth/logout" method="post">
                  <button type="submit" className={`${navClass(false)} w-full text-left`}>
                    Sign out
                  </button>
                </form>
              ) : null}
            </div>
          ) : null}
        </header>
        <div className="min-w-0 flex-1 p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}

function withWorkspace(path: string, workspaceId: string) {
  if (!workspaceId) return path;
  return `${path}?workspace=${encodeURIComponent(workspaceId)}`;
}
