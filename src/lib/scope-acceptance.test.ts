import { describe, expect, it } from "vitest";
import { demoClients } from "./demo-data";
import { normalizeClient } from "./client-migration";
import { canShowDepositPreview } from "./client-milestones";
import {
  buildCustomerScopeAcceptPatch,
  buildScopeMaterialChangePatch,
  buildScopePublishPatch,
  hasCustomerScopeAcceptanceForDeposit,
  needsCustomerScopeAcceptance,
  touchesCustomerScopeMaterial,
} from "./scope-acceptance";
import type { Client } from "./types";

function baseClient(): Client {
  return {
    ...demoClients[0]!,
    id: "test-scope",
    publishedScopeRevision: undefined,
    scopeCustomerAcceptedRevision: undefined,
    completedSteps: ["requirements-submitted"],
    onboardingFormStatus: "submitted",
  };
}

describe("scope acceptance", () => {
  it("blocks deposit until customer accepts published revision", () => {
    let c = baseClient();
    c = { ...c, ...buildScopePublishPatch(c, new Date().toISOString()) };
    expect(needsCustomerScopeAcceptance(c)).toBe(true);
    expect(hasCustomerScopeAcceptanceForDeposit(c)).toBe(false);
    expect(canShowDepositPreview(c)).toBe(false);

    const accept = buildCustomerScopeAcceptPatch(c, new Date().toISOString());
    c = { ...c, ...accept! };
    expect(hasCustomerScopeAcceptanceForDeposit(c)).toBe(true);
    expect(canShowDepositPreview(c)).toBe(true);
  });

  it("legacy scope confirmation still allows deposit", () => {
    const legacy = normalizeClient(
      demoClients.find((c) => c.completedSteps.includes("scope-pricing-confirmed"))!
    );
    expect(hasCustomerScopeAcceptanceForDeposit(legacy)).toBe(true);
  });

  it("material pricing edits clear customer acceptance", () => {
    let c = baseClient();
    c = {
      ...c,
      publishedScopeRevision: 1,
      scopePublishedAt: new Date().toISOString(),
      scopeRevision: 1,
      scopeCustomerAcceptedRevision: 1,
      scopeCustomerAcceptedAt: new Date().toISOString(),
    };
    expect(touchesCustomerScopeMaterial({ setupFee: 2000 })).toBe(true);
    c = {
      ...c,
      setupFee: 2000,
      ...buildScopeMaterialChangePatch(c, { setupFee: 2000 }),
    };
    expect(c.scopeCustomerAcceptedRevision).toBeUndefined();
    expect(hasCustomerScopeAcceptanceForDeposit(c)).toBe(false);
  });

  it("publish bumps revision and clears prior acceptance", () => {
    let c = baseClient();
    c = {
      ...c,
      scopeRevision: 2,
      publishedScopeRevision: 1,
      scopePublishedAt: new Date().toISOString(),
      scopeCustomerAcceptedRevision: 1,
      scopeCustomerAcceptedAt: new Date().toISOString(),
    };
    const patch = buildScopePublishPatch(c, new Date().toISOString());
    c = { ...c, ...patch };
    expect(c.publishedScopeRevision).toBe(2);
    expect(c.scopeCustomerAcceptedRevision).toBeUndefined();
  });
});
