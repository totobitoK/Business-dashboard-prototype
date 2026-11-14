"use client";

import { usePathname } from "next/navigation";
import { Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { CustomerSettingsPage } from "@/components/customer/CustomerSettingsPage";
import { selectMountedDashboardSection } from "@/components/customer/dashboard-section-context";
import { SignedInNavContext } from "@/components/customer/signed-in-nav-context";
import { dashboardBaseFromPathname, type DashboardSectionId } from "@/lib/dashboard-section-routes";

/**
 * Settings is a different route, so a normal click waits on the server and then
 * loads the company snapshot again on the way back. While the dashboard is open,
 * keep it mounted and show Settings on top.
 */
export function SignedInDashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const dashboardHome = dashboardBaseFromPathname(pathname);
  const canSwap = pathname === dashboardHome;
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!canSwap) setShowSettings(false);
  }, [canSwap]);

  useEffect(() => {
    function onPopState() {
      setShowSettings(window.location.pathname.startsWith(`${dashboardHome}/settings`));
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [dashboardHome]);

  const openSettings = useCallback(() => {
    setShowSettings(true);
    const url = new URL(window.location.href);
    url.pathname = `${dashboardHome}/settings`;
    url.searchParams.delete("section");
    window.history.pushState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [dashboardHome]);

  const openDashboard = useCallback((section?: DashboardSectionId) => {
    setShowSettings(false);
    if (section) selectMountedDashboardSection(section);
  }, []);

  return (
    <SignedInNavContext.Provider
      value={{ canSwap, showingSettings: canSwap && showSettings, showSettings: openSettings, showDashboard: openDashboard }}
    >
      {canSwap && showSettings ? (
        <>
          <div className="hidden" inert aria-hidden>
            {children}
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <Suspense fallback={null}>
              <CustomerSettingsPage />
            </Suspense>
          </div>
        </>
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      )}
    </SignedInNavContext.Provider>
  );
}
