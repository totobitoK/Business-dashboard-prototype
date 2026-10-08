import { describe, expect, it } from "vitest";
import { getActivationEligibility } from "./client-activation";
import type { Client } from "./types";

function baseClient(overrides: Partial<Client> = {}): Client {
  return {
    id: "test",
    company: "Test Co",
    contactName: "Test",
    email: "t@test.com",
    phone: "555",
    status: "pending",
    setupFee: 1000,
    monthlyFee: 100,
    onboardingPath: "full",
    completedSteps: ["requirements-submitted", "scope-pricing-confirmed"],
    setupPaidAmount: 1000,
    subscriptionActive: false,
    payments: [],
    notes: [],
    files: [],
    createdAt: "2025-01-01T00:00:00Z",
    onboardingFormStatus: "submitted",
    adminCompletedMilestones: [
      "discovery",
      "guided-data-setup",
      "building",
      "client-review",
    ],
    previewApprovedAt: "2025-02-01T00:00:00Z",
    previewApprovedRevision: 1,
    previewRevisionVersion: 1,
    previewFeedbackUnresolved: false,
    ...overrides,
  };
}

describe("getActivationEligibility", () => {
  it("allows pending client when all prerequisites met", () => {
    const r = getActivationEligibility(baseClient());
    expect(r.canActivate).toBe(true);
  });

  it("blocks when setup payment incomplete", () => {
    const r = getActivationEligibility(
      baseClient({ setupPaidAmount: 500, setupFee: 1000 })
    );
    expect(r.canActivate).toBe(false);
    expect(r.blockedReasons.some((x) => x.includes("setup payment"))).toBe(true);
  });

  it("allows $0 setup fee without payment", () => {
    const r = getActivationEligibility(
      baseClient({ setupFee: 0, setupPaidAmount: 0 })
    );
    expect(r.canActivate).toBe(true);
  });

  it("blocks unresolved preview feedback", () => {
    const r = getActivationEligibility(
      baseClient({ previewFeedbackUnresolved: true })
    );
    expect(r.canActivate).toBe(false);
  });

  it("blocks when preview approved for wrong revision", () => {
    const r = getActivationEligibility(
      baseClient({
        previewRevisionVersion: 2,
        previewApprovedRevision: 1,
      })
    );
    expect(r.canActivate).toBe(false);
  });

  it("allows archived reactivation when previously launched", () => {
    const r = getActivationEligibility(
      baseClient({
        status: "archived",
        launchedAt: "2024-01-01T00:00:00Z",
        setupPaidAmount: 0,
        previewApprovedAt: undefined,
      })
    );
    expect(r.canActivate).toBe(true);
  });

  it("blocks archived never-launched without full prerequisites", () => {
    const r = getActivationEligibility(
      baseClient({
        status: "archived",
        launchedAt: undefined,
        setupPaidAmount: 0,
        previewApprovedAt: undefined,
      })
    );
    expect(r.canActivate).toBe(false);
  });
});
