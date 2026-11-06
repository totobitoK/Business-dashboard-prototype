import { describe, expect, it } from "vitest";
import {
  civilDateInTimeZone,
  collectCompletedTransactions,
  collectPages,
  type SquarePaymentPayload,
  type SquareRefundPayload,
} from "./import-transactions";

const selected = ["LOC1"];

describe("Square pagination and completed activity", () => {
  it("follows cursors and stops on the last page", async () => {
    const pages = [
      { items: ["a"], cursor: "next" },
      { items: ["b"], cursor: null },
    ];
    const seen: Array<string | null> = [];
    const items = await collectPages(async (cursor) => {
      seen.push(cursor);
      const page = pages.shift();
      if (!page) throw new Error("extra page");
      return page;
    });
    expect(seen).toEqual([null, "next"]);
    expect(items).toEqual(["a", "b"]);
  });

  it("keeps one copy when the same completed payment appears twice", () => {
    const payment: SquarePaymentPayload = {
      id: "pay_1",
      status: "COMPLETED",
      created_at: "2026-11-06T16:00:00Z",
      location_id: "LOC1",
      amount_money: { amount: 1000, currency: "USD" },
      source_type: "CARD",
    };
    const rows = collectCompletedTransactions({
      payments: [payment, { ...payment, amount_money: { amount: 1200, currency: "USD" } }],
      refunds: [],
      timeZone: "America/New_York",
      selectedLocationIds: selected,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.amountMinor).toBe(1200);
  });

  it("counts completed payments and partial refunds, and drops other statuses", () => {
    const payments: SquarePaymentPayload[] = [
      {
        id: "pay_1",
        status: "COMPLETED",
        created_at: "2026-11-07T03:30:00Z",
        location_id: "LOC1",
        amount_money: { amount: 1000, currency: "USD" },
        source_type: "CARD",
      },
      {
        id: "pay_pending",
        status: "PENDING",
        created_at: "2026-11-06T16:00:00Z",
        location_id: "LOC1",
        amount_money: { amount: 500, currency: "USD" },
      },
      {
        id: "pay_other_location",
        status: "COMPLETED",
        created_at: "2026-11-06T16:00:00Z",
        location_id: "LOC2",
        amount_money: { amount: 500, currency: "USD" },
      },
    ];
    const refunds: SquareRefundPayload[] = [
      {
        id: "ref_1",
        status: "COMPLETED",
        created_at: "2026-11-06T18:00:00Z",
        location_id: "LOC1",
        payment_id: "pay_1",
        amount_money: { amount: 250, currency: "USD" },
        destination_type: "CARD",
      },
      {
        id: "ref_pending",
        status: "PENDING",
        created_at: "2026-11-06T18:00:00Z",
        location_id: "LOC1",
        amount_money: { amount: 100, currency: "USD" },
      },
    ];
    const rows = collectCompletedTransactions({
      payments,
      refunds,
      timeZone: "America/New_York",
      selectedLocationIds: selected,
    });
    expect(rows.map((row) => [row.kind, row.amountMinor, row.reportingDate])).toEqual([
      ["payment", 1000, "2026-11-06"],
      ["refund", 250, "2026-11-06"],
    ]);
  });

  it("uses the company time zone for the reporting date", () => {
    expect(civilDateInTimeZone("2026-11-07T04:30:00Z", "America/New_York")).toBe("2026-11-06");
    expect(civilDateInTimeZone("2026-11-07T05:30:00Z", "America/New_York")).toBe("2026-11-07");
  });
});
