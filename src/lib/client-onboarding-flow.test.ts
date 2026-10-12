import { describe, expect, it } from "vitest";
import { canShowDepositPreview } from "./client-milestones";
import { mutatePersistedClientList } from "./client-store-persistence";
import { demoClients } from "./demo-data";
import {
  applyAcceptScopeToClient,
  applyPublishScopeToClient,
  hasCustomerScopeAcceptanceForDeposit,
} from "./scope-acceptance";
import type { Client } from "./types";

function memoryStorage() {
  let raw: string | null = null;
  return { read: () => raw, write: (json: string) => { raw = json; } };
}

function pendingFullClient(id: string): Client {
  const base = demoClients.find((c) => c.status === "pending" && c.onboardingPath === "full");
  return {
    ...(base ?? demoClients[0]!),
    id,
    status: "pending",
    onboardingPath: "full",
    completedSteps: ["requirements-submitted"],
    onboardingFormStatus: "submitted",
    setupPaidAmount: 0,
    publishedScopeRevision: undefined,
    scopeCustomerAcceptedRevision: undefined,
    scopePricingConfirmedAt: undefined,
    acceptedSourcesIn: ["Google Sheets"],
    acceptedScreens: ["Overview"],
    agreedScopeSummary: "Ops dashboard",
  };
}

describe("onboarding flow integration (storage-shaped)", () => {
  it("publish then accept unlocks deposit preview", () => {
    const mem = memoryStorage();
    const id = "flow-full";
    mem.write(JSON.stringify([pendingFullClient(id)]));

    const at = "2026-03-01T12:00:00.000Z";
    mutatePersistedClientList(
      demoClients,
      (list) =>
        list.map((c) => {
          if (c.id !== id) return c;
          const next = applyPublishScopeToClient(c, at);
          return next ?? c;
        }),
      mem.read,
      mem.write
    );

    let clients = JSON.parse(mem.read()!) as Client[];
    let c = clients.find((x) => x.id === id)!;
    expect(c.publishedScopeRevision).toBe(1);
    expect(hasCustomerScopeAcceptanceForDeposit(c)).toBe(false);
    expect(canShowDepositPreview(c)).toBe(false);

    mutatePersistedClientList(
      demoClients,
      (list) =>
        list.map((x) => {
          if (x.id !== id) return x;
          const next = applyAcceptScopeToClient(x, at, x.publishedScopeRevision ?? 1);
          return next ?? x;
        }),
      mem.read,
      mem.write
    );

    clients = JSON.parse(mem.read()!) as Client[];
    c = clients.find((x) => x.id === id)!;
    expect(hasCustomerScopeAcceptanceForDeposit(c)).toBe(true);
    expect(canShowDepositPreview(c)).toBe(true);
  });

  it("payment-only requires prep before deposit even after scope accept", () => {
    const mem = memoryStorage();
    const id = "flow-po";
    const client: Client = {
      ...pendingFullClient(id),
      onboardingPath: "payment-only",
      onboardingFormStatus: undefined,
      completedSteps: [],
      paymentOnlyPrepConfirmed: false,
    };
    mem.write(JSON.stringify([client]));

    const at = "2026-03-01T12:00:00.000Z";
    mutatePersistedClientList(
      demoClients,
      (list) =>
        list.map((c) => {
          if (c.id !== id) return c;
          let next = applyPublishScopeToClient(c, at);
          next = next ? applyAcceptScopeToClient(next, at, next.publishedScopeRevision ?? 1) : null;
          return next ?? c;
        }),
      mem.read,
      mem.write
    );

    let c = (JSON.parse(mem.read()!) as Client[]).find((x) => x.id === id)!;
    expect(hasCustomerScopeAcceptanceForDeposit(c)).toBe(true);
    expect(canShowDepositPreview(c)).toBe(false);

    mutatePersistedClientList(
      demoClients,
      (list) =>
        list.map((x) => (x.id === id ? { ...x, paymentOnlyPrepConfirmed: true } : x)),
      mem.read,
      mem.write
    );

    c = (JSON.parse(mem.read()!) as Client[]).find((x) => x.id === id)!;
    expect(canShowDepositPreview(c)).toBe(true);
  });
});
