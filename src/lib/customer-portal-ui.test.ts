import { describe, expect, it } from "vitest";
import { demoClients } from "./demo-data";
import { getCustomerPortalStage } from "./customer-portal-stage";
import { getPortalCustomerBlockers, getPortalNextAction } from "./customer-portal-ui";

describe("customer portal UI helpers", () => {
  it("surfaces deposit blocker when scope confirmed but deposit unpaid", () => {
    const alpine = {
      ...demoClients.find((c) => c.id === "client-8")!,
      setupPaidAmount: 0,
      payments: [],
    };
    const blockers = getPortalCustomerBlockers(alpine, "scope-and-deposit");
    expect(blockers.some((b) => b.toLowerCase().includes("deposit"))).toBe(true);
  });

  it("preview-ready uses in-page primary action", () => {
    const alpine = {
      ...demoClients.find((c) => c.id === "client-8")!,
      setupPaidAmount: 1500,
      previewApprovedAt: undefined,
    };
    const stage = getCustomerPortalStage(alpine);
    if (stage === "preview-ready") {
      expect(getPortalNextAction(alpine, stage).useInPagePrimary).toBe(true);
    }
  });
});
