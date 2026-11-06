import { CurrencyAmount } from "@/components/CurrencyAmount";
import type { ReceivablesViewModel } from "@/lib/quickbooks/receivables-presentation";

function formatIsoDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function LiveReceivablesSection({ model }: { model: ReceivablesViewModel }) {
  const shown = model.invoices.length;
  return (
    <section className="rounded-lg border border-purple-100 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">{model.title}</h2>
          <p className="mt-1 text-sm text-ink-muted">{model.intro}</p>
        </div>
        {model.environmentLabel ? (
          <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-dark ring-1 ring-inset ring-purple-100">
            {model.environmentLabel}
            {model.companyName ? ` · ${model.companyName}` : ""}
          </span>
        ) : null}
      </div>

      {model.messages.map((message) => (
        <p
          key={message}
          className="mt-3 rounded-lg border border-purple-100 bg-purple-50/40 px-3 py-2 text-sm text-ink"
        >
          {message}
        </p>
      ))}

      {model.showBalances ? (
        <>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink-muted">{model.openLabel}</dt>
              <dd className="text-lg font-semibold">
                {model.openBalance === null ? (
                  <span className="text-sm font-medium text-ink-muted">Unavailable</span>
                ) : (
                  <CurrencyAmount amount={model.openBalance} detailed />
                )}
              </dd>
            </div>
            <div>
              <dt className="text-ink-muted">{model.overdueLabel}</dt>
              <dd className="text-lg font-semibold">
                {model.overdueBalance === null ? (
                  <span className="text-sm font-medium text-ink-muted">Unavailable</span>
                ) : (
                  <CurrencyAmount amount={model.overdueBalance} detailed />
                )}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-ink-muted">{model.overdueRule}</p>
          <p className="mt-1 text-xs text-ink-muted">
            {model.reportingDate
              ? `Reporting date ${formatIsoDate(model.reportingDate)}${
                  model.reportingTimezone ? ` (${model.reportingTimezone})` : ""
                }.`
              : "Reporting date is missing."}{" "}
            {model.lastSuccessfulSyncAt
              ? `Last successful sync ${new Date(model.lastSuccessfulSyncAt).toLocaleString()}.`
              : "No successful sync yet."}
          </p>
        </>
      ) : null}

      {model.showBalances ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-ink">{model.listLabel}</h3>
          {model.invoices.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">No open invoices in the last successful sync.</p>
          ) : (
            <ul className="mt-2 divide-y divide-purple-50">
              {model.invoices.map((invoice) => (
                <li
                  key={invoice.id}
                  className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-ink">
                      Invoice {invoice.docNumber ?? invoice.id}
                      {invoice.overdue && model.reportingDate ? (
                        <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">
                          Overdue
                        </span>
                      ) : null}
                    </p>
                    <p className="text-sm text-ink-muted">{invoice.customerName ?? "Customer not named"}</p>
                    <p className="text-sm text-ink">
                      {invoice.dueDate ? `Due ${formatIsoDate(invoice.dueDate)}` : "No due date"}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm">
                    <CurrencyAmount amount={invoice.remainingBalance} detailed />
                    <span className="ml-1 text-xs text-ink-muted">still owed</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
          {model.invoiceCount > shown ? (
            <p className="mt-2 text-xs text-ink-muted">
              Showing {shown} of {model.invoiceCount} open invoices. Balances above include the full open set.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
