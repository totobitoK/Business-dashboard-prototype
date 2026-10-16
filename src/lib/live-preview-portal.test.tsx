import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { LiveSamplePreviewProvider } from "./live-sample-preview-context";
import { useCustomerPortal } from "./customer-portal-context-shared";
import { dashboardSectionHref } from "./dashboard-section-routes";
import { livePreviewSectionHref } from "./live-preview-section-routes";
import { WORKSPACE_ALPINE_HVAC } from "./customer-workspaces";

function PortalProbe() {
  const { workspaceId, liveSamplePreview, navigationBase } = useCustomerPortal();
  return (
    <div
      data-workspace={workspaceId}
      data-live={liveSamplePreview ? "1" : "0"}
      data-nav={navigationBase ?? ""}
    />
  );
}

describe("live sample preview portal", () => {
  it("renders without demo ClientStoreProvider", () => {
    const projectId = "00000000-0000-4000-8000-000000000101";
    const navBase = `/onboarding/${projectId}/preview`;
    const html = renderToString(
      <LiveSamplePreviewProvider workspaceId={WORKSPACE_ALPINE_HVAC} navigationBase={navBase}>
        <PortalProbe />
      </LiveSamplePreviewProvider>
    );
    expect(html).toContain(`data-workspace="${WORKSPACE_ALPINE_HVAC}"`);
    expect(html).toContain('data-live="1"');
    expect(html).toContain(`data-nav="${navBase}"`);
  });

  it("keeps section navigation on the authorized project preview path", () => {
    const projectId = "00000000-0000-4000-8000-000000000101";
    const revenue = livePreviewSectionHref(projectId, "revenue");
    expect(revenue).toBe(`/onboarding/${projectId}/preview?section=revenue`);
    expect(revenue).not.toContain("/dashboard");

    const liveBase = `/onboarding/${projectId}/preview`;
    const schedule = dashboardSectionHref(WORKSPACE_ALPINE_HVAC, "schedule", liveBase);
    expect(schedule).toBe(`${liveBase}?section=schedule`);
    expect(schedule).not.toContain("workspace=");
  });
});
