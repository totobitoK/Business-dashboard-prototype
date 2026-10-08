import { describe, expect, it } from "vitest";
import { parseOfflinePaymentAmount } from "./offline-payment-input";
import { getSetupBalanceRemaining } from "./client-milestones";
import { demoClients } from "./demo-data";

describe("parseOfflinePaymentAmount", () => {
  it("accepts two decimal places", () => {
    expect(parseOfflinePaymentAmount("750.00")).toEqual({ ok: true, amount: 750 });
  });

  it("rejects more than two decimals", () => {
    expect(parseOfflinePaymentAmount("10.999").ok).toBe(false);
  });

  it("rejects zero", () => {
    expect(parseOfflinePaymentAmount("0").ok).toBe(false);
  });
});

describe("remaining balance", () => {
  it("alpine seed shows 750 remaining after partial pay", () => {
    const alpine = demoClients.find((c) => c.id === "client-8")!;
    expect(getSetupBalanceRemaining(alpine)).toBe(750);
  });
});
