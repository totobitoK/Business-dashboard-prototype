import { DASHBOARD, DEMO_DASHBOARD, dashboardRoutes, demoDashboardRoutes } from "./routes";

export function dashboardBaseFromPathname(pathname: string): string {
  return pathname.startsWith(DEMO_DASHBOARD) ? DEMO_DASHBOARD : DASHBOARD;
}

export function dashboardRoutesForPathname(pathname: string) {
  return pathname.startsWith(DEMO_DASHBOARD) ? demoDashboardRoutes : dashboardRoutes;
}

export type DashboardSectionId = "overview" | "revenue" | "schedule";

export const DASHBOARD_SECTIONS: {
  id: DashboardSectionId;
  label: string;
  description: string;
}[] = [
  {
    id: "overview",
    label: "Overview",
    description: "KPIs, activity, and open work",
  },
  {
    id: "revenue",
    label: "Revenue",
    description: "Collections, invoices, and aging",
  },
  {
    id: "schedule",
    label: "Schedule",
    description: "Calendar and upcoming visits",
  },
];

export function dashboardSectionHref(
  workspaceId: string,
  sectionId: DashboardSectionId = "overview",
  basePath: string = dashboardRoutes.home
): string {
  const url = new URL(basePath, "http://local");
  url.searchParams.set("workspace", workspaceId);
  if (sectionId !== "overview") {
    url.searchParams.set("section", sectionId);
  }
  return `${url.pathname}?${url.searchParams.toString()}`;
}

export function resolveDashboardSection(
  pathname: string,
  searchParams: Pick<URLSearchParams, "get">
): DashboardSectionId {
  const base = dashboardBaseFromPathname(pathname);
  const routes = dashboardRoutesForPathname(pathname);
  if (pathname.startsWith(`${base}/revenue`)) return "revenue";
  if (pathname.startsWith(`${base}/schedule`)) return "schedule";

  if (pathname === routes.home || pathname === base) {
    const section = searchParams.get("section");
    if (section === "revenue" || section === "schedule") return section;
    return "overview";
  }

  return "overview";
}

/** @deprecated Use resolveDashboardSection(pathname, searchParams) */
export function sectionIdFromPathname(pathname: string): DashboardSectionId {
  if (pathname.startsWith(`${DASHBOARD}/revenue`)) return "revenue";
  if (pathname.startsWith(`${DASHBOARD}/schedule`)) return "schedule";
  return "overview";
}
