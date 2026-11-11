"use client";

import { usePathname, useSearchParams } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  resolveDashboardSection,
  type DashboardSectionId,
} from "@/lib/dashboard-section-routes";

type DashboardSectionContextValue = {
  section: DashboardSectionId;
  selectSection: (section: DashboardSectionId) => void;
};

const DashboardSectionContext = createContext<DashboardSectionContextValue | null>(null);

let mountedSelectSection: ((section: DashboardSectionId) => void) | null = null;

/** Switches the dashboard that is already mounted, including while Settings covers it. */
export function selectMountedDashboardSection(section: DashboardSectionId) {
  mountedSelectSection?.(section);
}

function sectionUrl(section: DashboardSectionId): string {
  const url = new URL(window.location.href);
  if (url.pathname === "/dashboard/settings" || url.pathname === "/dashboard/connections") {
    url.pathname = "/dashboard";
  }
  if (section === "overview") url.searchParams.delete("section");
  else url.searchParams.set("section", section);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Keeps Overview, Revenue, and Schedule on the page that is already open. */
export function DashboardSectionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlSection = resolveDashboardSection(pathname, searchParams);
  const [section, setSection] = useState(urlSection);

  useEffect(() => {
    function onPopState() {
      const params = new URLSearchParams(window.location.search);
      setSection(resolveDashboardSection(window.location.pathname, params));
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const selectSection = useCallback((next: DashboardSectionId) => {
    setSection(next);
    const nextUrl = sectionUrl(next);
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== current) {
      window.history.pushState(window.history.state, "", nextUrl);
    }
  }, []);

  useEffect(() => {
    mountedSelectSection = selectSection;
    return () => {
      if (mountedSelectSection === selectSection) mountedSelectSection = null;
    };
  }, [selectSection]);

  return (
    <DashboardSectionContext.Provider value={{ section, selectSection }}>
      {children}
    </DashboardSectionContext.Provider>
  );
}

export function useDashboardSection() {
  return useContext(DashboardSectionContext);
}

/** Plain left-clicks switch the open dashboard. Modified clicks keep the real link. */
export function keepDashboardSectionClick(
  event: MouseEvent<HTMLAnchorElement>,
  selectSection: ((section: DashboardSectionId) => void) | undefined,
  section: DashboardSectionId
) {
  if (!selectSection) return;
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }
  event.preventDefault();
  selectSection(section);
}
