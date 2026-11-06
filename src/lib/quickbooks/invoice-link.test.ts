import { describe, expect, it } from "vitest";
import { quickBooksInvoiceUrl } from "./invoice-link";

describe("QuickBooks invoice link", () => {
  it("opens the sandbox invoice by QuickBooks id, not the display number", () => {
    const url = quickBooksInvoiceUrl({
      environment: "sandbox",
      realmId: "9341458650768455",
      qboInvoiceId: "16",
    });
    expect(url).toBe(
      "https://sandbox.qbo.intuit.com/app/invoice?txnId=16&deeplinkcompanyid=9341458650768455"
    );
    expect(url?.startsWith("https://sandbox.qbo.intuit.com/app/invoice?")).toBe(true);
    expect(url?.includes("txnId%3D1007")).toBe(false);
  });

  it("uses the production host for a production company", () => {
    const url = quickBooksInvoiceUrl({
      environment: "production",
      realmId: "1234567890",
      qboInvoiceId: "16",
    });
    expect(url).toMatch(/^https:\/\/qbo\.intuit\.com\/app\/invoice\?/);
    expect(url).not.toContain("sandbox.qbo.intuit.com");
    expect(url).toContain("txnId=16");
  });

  it("hides the link when the invoice id or company id is not a QuickBooks id", () => {
    expect(
      quickBooksInvoiceUrl({
        environment: "sandbox",
        realmId: "9341458650768455",
        qboInvoiceId: "INV-1007",
      })
    ).toBeNull();
    expect(
      quickBooksInvoiceUrl({
        environment: "sandbox",
        realmId: "not-a-realm",
        qboInvoiceId: "16",
      })
    ).toBeNull();
    expect(
      quickBooksInvoiceUrl({
        environment: "preview",
        realmId: "9341458650768455",
        qboInvoiceId: "16",
      })
    ).toBeNull();
    expect(
      quickBooksInvoiceUrl({ environment: "sandbox", realmId: null, qboInvoiceId: "16" })
    ).toBeNull();
  });
});
