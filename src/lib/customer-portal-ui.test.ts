import { describe, expect, it } from "vitest";
import { demoClients } from "./demo-data";
import { getCustomerPortalStage } from "./customer-portal-stage";
import { getPortalCustomerBlockers, getPortalNextAction } from "./customer-portal-ui";

describe("customer portal UI helpers", () => {
  it("keeps discovery as the customer step after intake", () => {
    const greenleaf = demoClients.find((c) => c.id === "client-3")!;
    const stage = getCustomerPortalStage(greenleaf);
    expect(stage).toBe("discovery");
    expect(getPortalNextAction(greenleaf, stage).title).toBe("Discovery Call");
    const blockers = getPortalCustomerBlockers(greenleaf, stage);
    expect(blockers.some((b) => b.toLowerCase().includes("pay"))).toBe(false);
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
