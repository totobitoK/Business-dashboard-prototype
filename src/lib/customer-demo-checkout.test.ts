import { describe, expect, it } from "vitest";
import { demoClients } from "./demo-data";
import {
  getDemoCheckoutOffer,
  getOutstandingDepositAmount,
} from "./customer-demo-checkout";

describe("customer demo checkout", () => {
  it("charges outstanding deposit, not full 50% when partially paid", () => {
    const base = demoClients.find((c) => c.id === "client-8")!;
    const client = {
      ...base,
      setupPaidAmount: 300,
      payments: [],
      previewApprovedAt: undefined,
      adminCompletedMilestones: base.adminCompletedMilestones,
    };
    expect(getOutstandingDepositAmount(client)).toBe(450);
    const offer = getDemoCheckoutOffer(client);
    expect(offer.ok).toBe(true);
    if (offer.ok) {
      expect(offer.kind).toBe("deposit");
      expect(offer.amount).toBe(450);
    }
  });

  it("blocks final balance until current preview revision is approved", () => {
    const base = demoClients.find((c) => c.id === "client-8")!;
    const client = {
      ...base,
      setupPaidAmount: 750,
      previewApprovedAt: undefined,
      previewApprovedRevision: undefined,
    };
    const offer = getDemoCheckoutOffer(client);
    expect(offer.ok).toBe(false);
    if (!offer.ok) {
      expect(offer.reason).toMatch(/approve the current preview/i);
    }
  });

  it("offers remaining setup balance after deposit and preview approval", () => {
    const base = demoClients.find((c) => c.id === "client-8")!;
    const client = {
      ...base,
      setupPaidAmount: 750,
      previewApprovedAt: new Date().toISOString(),
      previewApprovedRevision: base.previewRevision ?? 1,
    };
    const offer = getDemoCheckoutOffer(client);
    expect(offer.ok).toBe(true);
    if (offer.ok) {
      expect(offer.kind).toBe("final-balance");
      expect(offer.amount).toBe(750);
    }
  });
});
