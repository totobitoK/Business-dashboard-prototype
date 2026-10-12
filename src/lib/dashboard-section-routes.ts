import { DASHBOARD, dashboardRoutes } from "./routes";

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
  sectionId: DashboardSectionId = "overview"
): string {
  const url = new URL(dashboardRoutes.home, "http://local");
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
  if (pathname.startsWith(`${DASHBOARD}/revenue`)) return "revenue";
  if (pathname.startsWith(`${DASHBOARD}/schedule`)) return "schedule";

  if (pathname === dashboardRoutes.home || pathname === DASHBOARD) {
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
