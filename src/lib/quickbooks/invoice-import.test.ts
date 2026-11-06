import { describe, expect, it } from "vitest";
import { QBO_INVOICE_PAGE_SIZE } from "./config";
import {
  buildOpenInvoiceQuery,
  collectOpenInvoices,
  indexOpenInvoices,
  invoicesFromQueryResponse,
  nextInvoiceStartPosition,
  openInvoiceFromQbo,
} from "./invoice-import";

const reportingDate = "2026-11-05";

describe("QuickBooks open invoice import", () => {
  it("uses the remaining balance for a partially paid invoice", () => {
    const invoice = openInvoiceFromQbo(
      { Id: "10", DocNumber: "1001", TotalAmt: 150, Balance: 40, DueDate: "2026-11-01", TxnDate: "2026-10-01" },
      reportingDate
    );
    expect(invoice?.remainingBalance).toBe(40);
    expect(invoice?.totalAmount).toBe(150);
    expect(invoice?.overdue).toBe(true);
  });

  it("drops fully paid invoices", () => {
    expect(openInvoiceFromQbo({ Id: "11", TotalAmt: 80, Balance: 0, DueDate: "2026-10-01" }, reportingDate)).toBeNull();
  });

  it("drops voided invoices even when a balance is still present", () => {
    expect(
      openInvoiceFromQbo(
        { Id: "12", TotalAmt: 80, Balance: 80, DueDate: "2026-10-01", voided: true },
        reportingDate
      )
    ).toBeNull();
    expect(
      openInvoiceFromQbo(
        { Id: "13", Balance: 80, DueDate: "2026-10-01", PrivateNote: "Voided" },
        reportingDate
      )
    ).toBeNull();
  });

  it("does not treat a missing due date as overdue", () => {
    const invoice = openInvoiceFromQbo({ Id: "14", Balance: 25, TotalAmt: 25 }, reportingDate);
    expect(invoice?.dueDate).toBeNull();
    expect(invoice?.overdue).toBe(false);
    expect(invoice?.remainingBalance).toBe(25);
  });

  it("treats the reporting date itself as not overdue", () => {
    const invoice = openInvoiceFromQbo(
      { Id: "15", Balance: 10, DueDate: reportingDate },
      reportingDate
    );
    expect(invoice?.overdue).toBe(false);
  });

  it("paginates until a short page and keeps the later copy of a duplicate id", async () => {
    expect(nextInvoiceStartPosition(1, QBO_INVOICE_PAGE_SIZE)).toBe(1 + QBO_INVOICE_PAGE_SIZE);
    expect(nextInvoiceStartPosition(1, QBO_INVOICE_PAGE_SIZE - 1)).toBeNull();
    const query = buildOpenInvoiceQuery(1001);
    expect(query).toContain("Balance > '0'");
    expect(query).toContain("startposition 1001");
    expect(query.toLowerCase()).not.toContain("insert");
    expect(query.toLowerCase()).not.toContain("update");

    const page = Array.from({ length: QBO_INVOICE_PAGE_SIZE }, (_, index) => ({
      Id: String(index + 1),
      Balance: 5,
      DueDate: "2026-12-01",
    }));
    const calls: number[] = [];
    const invoices = await collectOpenInvoices({
      reportingDate,
      fetchPage: async (start) => {
        calls.push(start);
        if (start === 1) return { QueryResponse: { Invoice: page } };
        return {
          QueryResponse: {
            Invoice: { Id: "1", Balance: 7, DueDate: "2026-12-01", TotalAmt: 9 },
          },
        };
      },
    });
    expect(calls).toEqual([1, 1 + QBO_INVOICE_PAGE_SIZE]);
    const first = invoices.find((invoice) => invoice.qboInvoiceId === "1");
    expect(first?.remainingBalance).toBe(7);
    expect(invoicesFromQueryResponse({ QueryResponse: {} })).toEqual([]);
    expect(indexOpenInvoices(invoices)).toHaveLength(QBO_INVOICE_PAGE_SIZE);
  });
});
