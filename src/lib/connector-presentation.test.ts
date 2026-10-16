import { describe, expect, it } from "vitest";
import { CONNECTOR_DEFINITIONS } from "./connector-catalog";
import {
  connectorCanConnect,
  getConnectorPublicPhase,
  getPublicMarketingConnectors,
  getPublicStatusBadge,
} from "./connector-presentation";

describe("connector presentation policy", () => {
  it("hides public marketing connectors during private build", () => {
    expect(getConnectorPublicPhase()).toBe("private_build");
    expect(getPublicMarketingConnectors("private_build")).toHaveLength(0);
  });

  it("shows no public status badges during private build", () => {
    for (const c of CONNECTOR_DEFINITIONS) {
      expect(getPublicStatusBadge(c, "private_build")).toBeNull();
    }
  });

  it("at launch advertises operational connectors and optional coming soon teasers only", () => {
    const launchList = getPublicMarketingConnectors("launch");
    expect(launchList.every((c) => c.implementationStatus === "operational" || c.publicTeaser === "coming_soon")).toBe(
      true
    );
    expect(launchList.some((c) => c.implementationStatus === "candidate")).toBe(false);
  });

  it("gates Connect on operational status and runtime configuration", () => {
    const calendar = CONNECTOR_DEFINITIONS.find((c) => c.id === "google-calendar")!;
    expect(calendar.implementationStatus).toBe("operational");
    expect(connectorCanConnect(calendar)).toBe(
      process.env.GOOGLE_CALENDAR_INTEGRATION_ENABLED === "true" &&
        Boolean(process.env.GOOGLE_CLIENT_ID) &&
        Boolean(process.env.GOOGLE_CLIENT_SECRET) &&
        Boolean(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY)
    );
    expect(
      connectorCanConnect({
        ...CONNECTOR_DEFINITIONS.find((c) => c.id === "quickbooks")!,
        implementationStatus: "operational",
      })
    ).toBe(true);
  });
});
