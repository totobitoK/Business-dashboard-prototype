import { describe, expect, it } from "vitest";
import {
  getCurrentPreviewRevision,
  isPreviewApprovedForCurrentRevision,
} from "./preview-review";
import type { Client } from "./types";

const client = (patch: Partial<Client>): Client =>
  ({
    id: "c",
    company: "Co",
    contactName: "N",
    email: "e@e.com",
    phone: "1",
    status: "pending",
    setupFee: 0,
    monthlyFee: 0,
    onboardingPath: "full",
    completedSteps: [],
    setupPaidAmount: 0,
    subscriptionActive: false,
    payments: [],
    notes: [],
    files: [],
    createdAt: "2025-01-01",
    ...patch,
  }) as Client;

describe("preview revision approval", () => {
  it("requires approval on current revision", () => {
    expect(
      isPreviewApprovedForCurrentRevision(
        client({
          previewApprovedAt: "2025-01-02",
          previewApprovedRevision: 1,
          previewRevisionVersion: 2,
        })
      )
    ).toBe(false);
  });

  it("accepts matching revision", () => {
    expect(
      isPreviewApprovedForCurrentRevision(
        client({
          previewApprovedAt: "2025-01-02",
          previewApprovedRevision: 2,
          previewRevisionVersion: 2,
        })
      )
    ).toBe(true);
  });

  it("defaults revision to 1", () => {
    expect(getCurrentPreviewRevision(client({}))).toBe(1);
  });
});
