import { describe, expect, it } from "vitest";
import { demoClients } from "./demo-data";
import {
  canShowGuidedDataSetup,
  getPortalJourneyBookends,
  isDepositPaid,
  isZeroSetupFee,
} from "./client-milestones";
import type { Client } from "./types";

function baseClient(overrides: Partial<Client> = {}): Client {
  const template = demoClients[0]!;
  return { ...template, ...overrides };
}

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
    expect(lastCompletedLabel).toBe("Final Payment");
  });
});

describe("deposit and guided setup gates", () => {
  it("treats $0 setup fee as deposit satisfied", () => {
    const client = baseClient({ setupFee: 0, setupPaidAmount: 0 });
    expect(isZeroSetupFee(client)).toBe(true);
    expect(isDepositPaid(client)).toBe(true);
  });

  it("opens guided setup after the discovery call is marked", () => {
    const client = baseClient({
      onboardingFormStatus: "submitted",
      completedSteps: ["requirements-submitted"],
      adminCompletedMilestones: ["discovery"],
      setupFee: 1000,
      setupPaidAmount: 0,
    });
    expect(canShowGuidedDataSetup(client)).toBe(true);
  });

  it("keeps guided setup closed until discovery is marked", () => {
    const client = baseClient({
      onboardingFormStatus: "submitted",
      completedSteps: ["requirements-submitted"],
      adminCompletedMilestones: [],
      setupFee: 1000,
      setupPaidAmount: 0,
    });
    expect(isDepositPaid(client)).toBe(false);
    expect(canShowGuidedDataSetup(client)).toBe(false);
  });
});
