import { describe, expect, it } from "vitest";
import { parseSetupPaymentObligation } from "./setup-payment-summary";

describe("parseSetupPaymentObligation", () => {
  it("parses unpublished obligation without leaking fee as zero", () => {
    const parsed = parseSetupPaymentObligation({
      fee_confirmed: false,
      setup_fee: null,
      received: 100,
      remaining: null,
      overpayment: null,
      fully_paid: false,
    });
    expect(parsed?.fee_confirmed).toBe(false);
    expect(parsed?.setup_fee).toBeNull();
    expect(parsed?.received).toBe(100);
  });
});
