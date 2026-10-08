import { describe, expect, it, beforeEach } from "vitest";
import { demoClients } from "./demo-data";
import {
  loadPersistedClients,
  mutatePersistedClientList,
} from "./client-store-persistence";
import { getCurrentPreviewRevision } from "./preview-review";
import type { Client, Payment } from "./types";

function memoryStorage() {
  let raw: string | null = null;
  return {
    read: () => raw,
    write: (json: string) => {
      raw = json;
    },
    clear: () => {
      raw = null;
    },
  };
}

function alpinePartial(): Client {
  const base = demoClients.find((c) => c.id === "client-8")!;
  return structuredClone(base);
}

function addOfflinePayment(client: Client, amount: number): Client {
  const payment: Payment = {
    id: "pay-test",
    date: new Date().toISOString(),
    amount,
    type: "setup",
    recordSource: "offline",
  };
  const setupPayments = [...client.payments, payment]
    .filter((p) => p.type === "setup")
    .reduce((s, p) => s + p.amount, 0);
  return {
    ...client,
    payments: [...client.payments, payment],
    setupPaidAmount: setupPayments,
    completedSteps: setupPayments >= client.setupFee
      ? [...new Set([...client.completedSteps, "setup-payment-received"])]
      : client.completedSteps.filter((s) => s !== "setup-payment-received"),
  };
}

function approvePreview(client: Client): Client {
  const rev = getCurrentPreviewRevision(client);
  return {
    ...client,
    previewApprovedAt: new Date().toISOString(),
    previewApprovedRevision: rev,
    previewFeedbackUnresolved: false,
  };
}

describe("client store persistence — cross-tab stale state", () => {
  const mem = memoryStorage();

  beforeEach(() => {
    mem.clear();
  });

  it("payment then approval preserves payment when approval reads from storage", () => {
    const start = [alpinePartial()];
    mem.write(JSON.stringify(start));

    mutatePersistedClientList(
      demoClients,
      (base) => base.map((c) => (c.id === "client-8" ? addOfflinePayment(c, 750) : c)),
      mem.read,
      mem.write
    );

    const afterPay = loadPersistedClients(demoClients, mem.read);
    expect(afterPay.find((c) => c.id === "client-8")?.setupPaidAmount).toBe(1500);

    mutatePersistedClientList(
      demoClients,
      (base) => base.map((c) => (c.id === "client-8" ? approvePreview(c) : c)),
      mem.read,
      mem.write
    );

    const final = loadPersistedClients(demoClients, mem.read);
    const alpine = final.find((c) => c.id === "client-8")!;
    expect(alpine.setupPaidAmount).toBe(1500);
    expect(alpine.previewApprovedAt).toBeTruthy();
    expect(alpine.previewApprovedRevision).toBe(getCurrentPreviewRevision(alpine));
  });

  it("approval then payment preserves approval when payment reads from storage", () => {
    const start = [alpinePartial()];
    mem.write(JSON.stringify(start));

    mutatePersistedClientList(
      demoClients,
      (base) => base.map((c) => (c.id === "client-8" ? approvePreview(c) : c)),
      mem.read,
      mem.write
    );

    mutatePersistedClientList(
      demoClients,
      (base) => base.map((c) => (c.id === "client-8" ? addOfflinePayment(c, 750) : c)),
      mem.read,
      mem.write
    );

    const alpine = loadPersistedClients(demoClients, mem.read).find(
      (c) => c.id === "client-8"
    )!;
    expect(alpine.setupPaidAmount).toBe(1500);
    expect(alpine.previewApprovedAt).toBeTruthy();
  });

  it("does not drop unrelated client fields on payment", () => {
    const start = [alpinePartial()];
    mem.write(JSON.stringify(start));

    mutatePersistedClientList(
      demoClients,
      (base) => base.map((c) => (c.id === "client-8" ? addOfflinePayment(c, 750) : c)),
      mem.read,
      mem.write
    );

    const alpine = loadPersistedClients(demoClients, mem.read).find(
      (c) => c.id === "client-8"
    )!;
    expect(alpine.agreedScopeSummary).toContain("QuickBooks");
    expect(alpine.buildStatusNote).toContain("Sample preview");
    expect(alpine.previewRevisionVersion ?? 1).toBe(1);
  });
});

describe("partial setup balance", () => {
  it("750 deposit does not satisfy full setup fee on alpine seed", () => {
    const alpine = alpinePartial();
    expect(alpine.setupFee).toBe(1500);
    expect(alpine.setupPaidAmount).toBe(750);
    expect(alpine.setupPaidAmount).toBeLessThan(alpine.setupFee);
  });
});
