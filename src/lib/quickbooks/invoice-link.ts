const INVOICE_ID = /^[0-9]{1,20}$/;

/**
 * Opens one QuickBooks invoice. The login wrapper doubles the path and shows
 * QuickBooks' missing-page screen, so the link goes straight to /app/invoice.
 */
export function quickBooksInvoiceUrl(input: {
  environment: string | null | undefined;
  realmId: string | null | undefined;
  qboInvoiceId: string | null | undefined;
}): string | null {
  const environment = input.environment;
  const realmId = input.realmId?.trim() ?? "";
  const qboInvoiceId = input.qboInvoiceId?.trim() ?? "";
  if (environment !== "sandbox" && environment !== "production") return null;
  if (!INVOICE_ID.test(realmId) || !INVOICE_ID.test(qboInvoiceId)) return null;
  const origin =
    environment === "sandbox" ? "https://sandbox.qbo.intuit.com" : "https://qbo.intuit.com";
  const url = new URL("/app/invoice", origin);
  url.searchParams.set("txnId", qboInvoiceId);
  url.searchParams.set("deeplinkcompanyid", realmId);
  return url.toString();
}
