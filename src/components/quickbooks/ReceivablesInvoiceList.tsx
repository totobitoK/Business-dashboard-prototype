"use client";

import { useId, useState, type ReactNode } from "react";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import type { ReceivablesInvoiceRow } from "@/lib/quickbooks/receivables-presentation";

function formatIsoDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="break-words text-sm text-ink">{children}</dd>
    </div>
  );
}

export function ReceivablesInvoiceList({
  invoices,
  reportingDate,
}: {
  invoices: ReceivablesInvoiceRow[];
  reportingDate: string | null;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const baseId = useId();

  return (
    <ul className="mt-2 divide-y divide-purple-50">
      {invoices.map((invoice) => {
        const open = expandedId === invoice.id;
        const panelId = `${baseId}-${invoice.id}`;
        const number = invoice.docNumber ?? "Not numbered";
        return (
          <li key={invoice.id} className="min-w-0 py-1">
            <button
              type="button"
              className="flex w-full min-w-0 flex-col gap-1 rounded-md px-1 py-2 text-left hover:bg-purple-50/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple sm:flex-row sm:items-start sm:justify-between"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setExpandedId(open ? null : invoice.id)}
            >
              <span className="min-w-0">
                <span className="block break-words font-medium text-ink">
                  Invoice {number}
                  {invoice.overdue && reportingDate ? (
                    <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">
                      Overdue
                    </span>
                  ) : null}
                </span>
                <span className="block break-words text-sm text-ink-muted">
                  {invoice.customerName ?? "Customer not named"}
                </span>
                <span className="block text-sm text-ink">
                  {invoice.dueDate ? `Due ${formatIsoDate(invoice.dueDate)}` : "No due date"}
                </span>
              </span>
              <span className="shrink-0 text-sm">
                <CurrencyAmount amount={invoice.remainingBalance} detailed />
                <span className="ml-1 text-xs text-ink-muted">still owed</span>
              </span>
            </button>
            {open ? (
              <div id={panelId} className="mb-2 min-w-0 rounded-md bg-purple-50/40 px-3 py-2">
                <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                  <Detail label="Invoice number">{number}</Detail>
                  <Detail label="Customer">{invoice.customerName ?? "Customer not named"}</Detail>
                  <Detail label="Issue date">
                    {invoice.txnDate ? formatIsoDate(invoice.txnDate) : "Not provided"}
                  </Detail>
                  <Detail label="Due date">
                    {invoice.dueDate ? formatIsoDate(invoice.dueDate) : "No due date"}
                  </Detail>
                  <Detail label="Original total">
                    {invoice.totalAmount === null ? (
                      "Not provided"
                    ) : (
                      <CurrencyAmount amount={invoice.totalAmount} detailed />
                    )}
                  </Detail>
                  <Detail label="Remaining balance">
                    <CurrencyAmount amount={invoice.remainingBalance} detailed />
                  </Detail>
                  <Detail label="Overdue status">{invoice.overdue ? "Overdue" : "Not overdue"}</Detail>
                </dl>
                {invoice.quickBooksUrl ? (
                  <a
                    href={invoice.quickBooksUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex max-w-full items-center rounded-md border border-purple-200 bg-white px-2.5 py-1 text-xs font-semibold text-purple-dark hover:bg-purple-50"
                  >
                    Open in QuickBooks ↗
                  </a>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
