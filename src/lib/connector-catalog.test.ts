import { describe, expect, it } from "vitest";
import {
  CONNECTOR_CATALOG,
  MARKETING_CONNECTORS,
  ONBOARDING_CONNECTORS,
  connectorCanConnect,
} from "./connector-catalog";

describe("connector catalog", () => {
  it("includes the expanded provider lineup on marketing and onboarding", () => {
    const ids = CONNECTOR_CATALOG.map((c) => c.id);
    expect(ids).toContain("google-calendar");
    expect(ids).toContain("quickbooks");
    expect(ids).toContain("google-sheets");
    expect(ids).toContain("square");
    expect(ids).toContain("hubspot");
    expect(ids).toContain("google-ads");
    expect(ids).toContain("meta-ads");
  });

  it("does not expose Connect-ready providers until implemented", () => {
    expect(CONNECTOR_CATALOG.some((c) => connectorCanConnect(c.availability))).toBe(false);
    expect(CONNECTOR_CATALOG.find((c) => c.id === "google-calendar")?.availability).toBe(
      "in_development"
    );
  });

  it("keeps marketing and onboarding lists in sync with catalog flags", () => {
    expect(MARKETING_CONNECTORS.length).toBeGreaterThanOrEqual(7);
    expect(ONBOARDING_CONNECTORS.map((c) => c.id)).toEqual(
      CONNECTOR_CATALOG.filter((c) => c.includeInOnboarding).map((c) => c.id)
    );
  });
});
