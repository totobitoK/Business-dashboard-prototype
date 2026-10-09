import { DASHBOARD, dashboardRoutes } from "./routes";

export type DashboardSectionId = "overview" | "revenue" | "schedule";

export const DASHBOARD_SECTIONS: {
  id: DashboardSectionId;
  label: string;
  href: string;
  description: string;
}[] = [
  {
    id: "overview",
    label: "Overview",
    href: dashboardRoutes.home,
    description: "KPIs, activity, and open work",
  },
  {
    id: "revenue",
    label: "Revenue",
    href: dashboardRoutes.revenue,
    description: "Collections, invoices, and aging",
  },
  {
    id: "schedule",
    label: "Schedule",
    href: dashboardRoutes.schedule,
    description: "Calendar and upcoming visits",
  },
];

export function dashboardSectionHref(
  sectionHref: string,
  workspaceId: string
): string {
  const url = new URL(sectionHref, "http://local");
  url.searchParams.set("workspace", workspaceId);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

export function sectionIdFromPathname(pathname: string): DashboardSectionId {
  if (pathname.startsWith(`${DASHBOARD}/revenue`)) return "revenue";
  if (pathname.startsWith(`${DASHBOARD}/schedule`)) return "schedule";
  return "overview";
}
