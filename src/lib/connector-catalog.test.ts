import { describe, expect, it } from "vitest";
import {
  CONNECTOR_DEFINITIONS,
  connectorsPendingEarlyExternalApproval,
} from "./connector-catalog";
import { getOnboardingConnectorChoices } from "./connector-presentation";

describe("connector catalog (internal)", () => {
  it("tracks seven researched providers as internal candidates", () => {
    const ids = CONNECTOR_DEFINITIONS.map((c) => c.id);
    expect(ids).toContain("google-calendar");
    expect(ids).toContain("quickbooks");
    expect(ids).toContain("google-sheets");
    expect(ids).toContain("square");
    expect(ids).toContain("hubspot");
    expect(ids).toContain("google-ads");
    expect(ids).toContain("meta-ads");
  });

  it("prioritizes Google Calendar first internally", () => {
    const calendar = CONNECTOR_DEFINITIONS.find((c) => c.id === "google-calendar");
    expect(calendar?.implementationStatus).toBe("in_development");
    expect(calendar?.implementationPriority).toBe(1);
    const others = CONNECTOR_DEFINITIONS.filter(
      (c) => c.id !== "google-calendar" && c.id !== "other" && c.id !== "excel-csv"
    );
    expect(others.every((c) => c.implementationStatus === "candidate")).toBe(true);
  });

  it("flags Google Ads and Meta for early external approval tracking", () => {
    const early = connectorsPendingEarlyExternalApproval().map((c) => c.id);
    expect(early).toContain("google-ads");
    expect(early).toContain("meta-ads");
  });

  it("keeps onboarding choices on internal catalog without public marketing requirement", () => {
    expect(getOnboardingConnectorChoices().length).toBeGreaterThanOrEqual(7);
    expect(getOnboardingConnectorChoices().every((c) => c.publicTeaser === "hidden")).toBe(true);
  });
});
