import { describe, expect, it } from "vitest";
import { demoClients } from "./demo-data";
import { normalizeClient } from "./client-migration";
import { canShowDepositPreview } from "./client-milestones";
import {
  applyAcceptScopeToClient,
  applyPublishScopeToClient,
  applyScopeAcceptanceMigration,
  buildCustomerScopeAcceptPatch,
  buildScopeMaterialChangePatch,
  buildScopePublishPatch,
  getCustomerFacingScope,
  hasCustomerAcceptedCurrentPublishedScope,
  hasCustomerScopeAcceptanceForDeposit,
  hasUnpublishedScopeDraftChanges,
  isScopeDepositGrandfathered,
  needsCustomerScopeAcceptance,
  touchesCustomerScopeMaterial,
  validateCustomerScopeAcceptance,
} from "./scope-acceptance";
import type { Client } from "./types";

function baseClient(): Client {
  return {
    ...demoClients[0]!,
    id: "test-scope",
    status: "pending",
    launchedAt: undefined,
    scopeDepositGrandfathered: false,
    publishedScopeRevision: undefined,
    scopeCustomerAcceptedRevision: undefined,
    scopeCustomerAcceptedAt: undefined,
    scopeCustomerAcceptanceSource: undefined,
    publishedScopeSnapshot: undefined,
    scopePricingConfirmedAt: undefined,
    completedSteps: ["requirements-submitted"],
    onboardingFormStatus: "submitted",
    scopeMigrationVersion: 1,
    acceptedSourcesIn: ["Google Sheets"],
    acceptedScreens: ["Overview"],
    agreedScopeSummary: "Test scope",
  };
}

describe("scope acceptance", () => {
  it("blocks deposit until customer accepts published revision", () => {
    let c = baseClient();
    c = { ...c, ...buildScopePublishPatch(c, new Date().toISOString()) };
    expect(needsCustomerScopeAcceptance(c)).toBe(true);
    expect(hasCustomerScopeAcceptanceForDeposit(c)).toBe(false);
    expect(canShowDepositPreview(c)).toBe(false);

    const accept = buildCustomerScopeAcceptPatch(c, new Date().toISOString(), 1);
    c = { ...c, ...accept! };
    expect(hasCustomerScopeAcceptanceForDeposit(c)).toBe(true);
    expect(canShowDepositPreview(c)).toBe(true);
  });

  it("grandfathers previously launched clients without customer acceptance", () => {
    const live = demoClients.find((c) => c.status === "active" && c.onboardingPath === "full")!;
    expect(isScopeDepositGrandfathered(live)).toBe(true);
    expect(hasCustomerScopeAcceptanceForDeposit(live)).toBe(true);
  });

  it("legacy admin confirmation on pending clients requires customer acceptance", () => {
    const pending = normalizeClient(
      demoClients.find((c) => c.id === "client-4")!
    );
    expect(pending.scopeCustomerAcceptanceSource).toBe("customer");
    expect(hasCustomerScopeAcceptanceForDeposit(pending)).toBe(true);
  });

  it("material pricing edits clear customer acceptance and block deposit", () => {
    let c = baseClient();
    c = {
      ...c,
      ...buildScopePublishPatch(c, new Date().toISOString()),
      ...buildCustomerScopeAcceptPatch(c, new Date().toISOString(), 1)!,
    };
    expect(touchesCustomerScopeMaterial({ setupFee: 2000 })).toBe(true);
    c = {
      ...c,
      setupFee: 2000,
      ...buildScopeMaterialChangePatch(c, { setupFee: 2000 }),
    };
    expect(c.scopeCustomerAcceptedRevision).toBeUndefined();
    expect(hasUnpublishedScopeDraftChanges(c)).toBe(true);
    expect(hasCustomerScopeAcceptanceForDeposit(c)).toBe(false);
  });

  it("customer review shows published snapshot while admin draft differs", () => {
    let c = baseClient();
    c = {
      ...c,
      acceptedSourcesIn: ["QuickBooks Online"],
      agreedScopeSummary: "Published summary",
    };
    c = { ...c, ...buildScopePublishPatch(c, "2026-01-01T00:00:00.000Z") };
    c = { ...c, ...buildCustomerScopeAcceptPatch(c, "2026-01-02T00:00:00.000Z", 1)! };
    c = {
      ...c,
      acceptedSourcesIn: ["Stripe"],
      agreedScopeSummary: "Draft summary",
      ...buildScopeMaterialChangePatch(c, { acceptedSourcesIn: ["Stripe"] }),
    };
    const facing = getCustomerFacingScope(c)!;
    expect(facing.acceptedSourcesIn).toEqual(["QuickBooks Online"]);
    expect(facing.agreedScopeSummary).toBe("Published summary");
    expect(hasCustomerScopeAcceptanceForDeposit(c)).toBe(false);
  });

  it("publish bumps revision and clears prior acceptance", () => {
    let c = baseClient();
    c = {
      ...c,
      scopeRevision: 2,
      publishedScopeRevision: 1,
      scopePublishedAt: new Date().toISOString(),
      publishedScopeSnapshot: {
        revision: 1,
        publishedAt: new Date().toISOString(),
        setupFee: c.setupFee,
        monthlyFee: c.monthlyFee,
        acceptedSourcesIn: ["A"],
        acceptedScreens: ["Overview"],
      },
      scopeCustomerAcceptedRevision: 1,
      scopeCustomerAcceptedAt: new Date().toISOString(),
      scopeCustomerAcceptanceSource: "customer",
    };
    const patch = buildScopePublishPatch(c, new Date().toISOString());
    c = { ...c, ...patch };
    expect(c.publishedScopeRevision).toBe(2);
    expect(c.scopeCustomerAcceptedRevision).toBeUndefined();
    expect(c.publishedScopeSnapshot?.revision).toBe(2);
  });

  it("rejects stale acceptance from an older published revision", () => {
    let c = baseClient();
    c = { ...c, ...buildScopePublishPatch(c, new Date().toISOString()) };
    expect(c.publishedScopeRevision).toBe(1);
    const stale = validateCustomerScopeAcceptance(c, 99);
    expect(stale.ok).toBe(false);
    expect(applyAcceptScopeToClient(c, new Date().toISOString(), 99)).toBeNull();
  });

  it("migration does not fabricate customer acceptance for pending legacy scope", () => {
    const pendingLegacy: Client = {
      ...baseClient(),
      scopeMigrationVersion: 0,
      scopeDepositGrandfathered: false,
      scopePricingConfirmedAt: "2025-01-01T00:00:00.000Z",
      completedSteps: ["requirements-submitted", "scope-pricing-confirmed"],
      acceptedSourcesIn: ["Google Sheets"],
      acceptedScreens: ["Overview"],
      agreedScopeSummary: "Legacy admin confirmed",
      scopeCustomerAcceptedAt: "2025-01-02T00:00:00.000Z",
      scopeCustomerAcceptedRevision: 1,
    };
    const patch = applyScopeAcceptanceMigration(pendingLegacy);
    const merged = { ...pendingLegacy, ...patch };
    expect(merged.scopeCustomerAcceptedAt).toBeUndefined();
    expect(merged.scopeAcceptanceNeedsReview).toBe(true);
    expect(merged.publishedScopeRevision).toBe(1);
    expect(merged.publishedScopeSnapshot?.agreedScopeSummary).toBe("Legacy admin confirmed");
    expect(hasCustomerAcceptedCurrentPublishedScope(merged)).toBe(false);
  });

  it("republish requires acceptance of the new revision", () => {
    let c = baseClient();
    c = {
      ...c,
      acceptedSourcesIn: ["Sheets"],
      acceptedScreens: ["Overview"],
      agreedScopeSummary: "v1",
    };
    c = { ...c, ...buildScopePublishPatch(c, "2026-01-01T00:00:00.000Z") };
    c = { ...c, ...buildCustomerScopeAcceptPatch(c, "2026-01-02T00:00:00.000Z", 1)! };
    c = {
      ...c,
      agreedScopeSummary: "v2 draft",
      ...buildScopeMaterialChangePatch(c, { agreedScopeSummary: "v2 draft" }),
    };
    c = applyPublishScopeToClient(c, "2026-01-03T00:00:00.000Z")!;
    expect(c.publishedScopeRevision).toBe(2);
    expect(hasCustomerScopeAcceptanceForDeposit(c)).toBe(false);
    c = applyAcceptScopeToClient(c, "2026-01-04T00:00:00.000Z", 2)!;
    expect(hasCustomerScopeAcceptanceForDeposit(c)).toBe(true);
  });
});
