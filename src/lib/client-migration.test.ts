import { describe, expect, it } from "vitest";
import { demoClients } from "./demo-data";
import { normalizeClients } from "./client-migration";
import { isMilestoneComplete } from "./client-milestones";
import { getCurrentOnboardingTask } from "./onboarding-journey";

describe("normalizeClients milestone migration", () => {
  it("preserves Alpine build-demo admin milestones when migration version is current", () => {
    const alpine = normalizeClients(demoClients).find((c) => c.id === "client-8")!;
    expect(isMilestoneComplete(alpine, "guided-data-setup")).toBe(true);
    expect(isMilestoneComplete(alpine, "building")).toBe(false);
    expect(getCurrentOnboardingTask(alpine)?.phaseKey).toBe("build");
  });
});
