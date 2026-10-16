import type { DashboardSectionId } from "./dashboard-section-routes";

export function liveProjectPreviewBase(projectId: string): string {
  return `/onboarding/${projectId}/preview`;
}

export function livePreviewSectionHref(
  projectId: string,
  sectionId: DashboardSectionId = "overview"
): string {
  const url = new URL(liveProjectPreviewBase(projectId), "http://local");
  if (sectionId !== "overview") {
    url.searchParams.set("section", sectionId);
  }
  const qs = url.searchParams.toString();
  return qs ? `${url.pathname}?${qs}` : url.pathname;
}
