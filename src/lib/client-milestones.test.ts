import { describe, expect, it } from "vitest";
import { demoClients } from "./demo-data";
import { getPortalJourneyBookends } from "./client-milestones";

describe("getPortalJourneyBookends", () => {
  it("shows last completed and next milestone for in-progress clients", () => {
    const alpine = demoClients.find((c) => c.id === "client-8")!;
    const { lastCompletedLabel, nextLabel } = getPortalJourneyBookends(alpine);
    expect(lastCompletedLabel).toBeTruthy();
    expect(nextLabel).toBeTruthy();
    expect(lastCompletedLabel).not.toBe(nextLabel);
  });

  it("shows Active as next label when client is live", () => {
    const live = demoClients.find((c) => c.status === "active")!;
    const { nextLabel, lastCompletedLabel } = getPortalJourneyBookends(live);
    expect(nextLabel).toBe("Active");
    expect(lastCompletedLabel).toBe("Final payment");
  });
});
