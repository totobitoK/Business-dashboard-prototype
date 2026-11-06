import { companyTimeZoneLabel } from "@/lib/company-time-zone";
import {
  formatMinorAmount,
  type SquareCollectionsViewModel,
  type SquareTransactionRow,
} from "@/lib/square/collections-presentation";

function formatIsoDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function activityLabel(row: SquareTransactionRow): string {
  const kind = row.kind === "refund" ? "Refund" : "Payment";
  const source = row.sourceType ? row.sourceType.toLowerCase().replace(/_/g, " ") : null;
  return source ? `${kind} · ${source}` : kind;
}

export function LiveSquareCollectionsSection({ model }: { model: SquareCollectionsViewModel }) {
  return (
    <section className="min-w-0 rounded-lg border border-purple-100 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-ink">{model.title}</h2>
          <p className="mt-1 text-sm text-ink-muted">{model.intro}</p>
        </div>
        {model.environmentLabel ? (
          <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-dark ring-1 ring-inset ring-purple-100">
            {model.environmentLabel}
            {model.merchantName ? ` · ${model.merchantName}` : ""}
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

      {model.showTotals ? (
        <>
          <p className="mt-4 text-xs text-ink-muted">
            {model.reportingDate
              ? `Reporting date ${formatIsoDate(model.reportingDate)} (${companyTimeZoneLabel(model.reportingTimezone)}).`
              : "Reporting date is missing."}{" "}
            {model.lastSuccessfulSyncAt
              ? `Last successful sync ${new Date(model.lastSuccessfulSyncAt).toLocaleString()}.`
              : "No successful sync yet."}
          </p>
          {model.zeroActivity ? (
            <p className="mt-3 text-sm text-ink">
              No completed payments or refunds on{" "}
              {model.reportingDate ? formatIsoDate(model.reportingDate) : "this reporting date"}.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {model.currencies.map((row) => (
                <div key={row.currency} className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{row.currency}</p>
                  <dl className="mt-2 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                    <div className="min-w-0">
                      <dt className="text-ink-muted">{model.paymentsLabel}</dt>
                      <dd className="break-words font-semibold text-ink">
                        {formatMinorAmount(row.paymentsMinor, row.currency)}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-ink-muted">{model.refundsLabel}</dt>
                      <dd className="break-words font-semibold text-ink">
                        {formatMinorAmount(row.refundsMinor, row.currency)}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-ink-muted">{model.netLabel}</dt>
                      <dd className="break-words font-semibold text-ink">
                        {formatMinorAmount(row.netMinor, row.currency)}
                      </dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 min-w-0">
            <h3 className="text-sm font-semibold text-ink">{model.listLabel}</h3>
            {model.transactions.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">No completed payments or refunds in the last sync.</p>
            ) : (
              <ul className="mt-2 divide-y divide-purple-50">
                {model.transactions.map((row) => (
                  <li
                    key={row.id}
                    className="flex min-w-0 flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="break-words font-medium text-ink">{activityLabel(row)}</p>
                      <p className="break-words text-sm text-ink-muted">
                        {row.locationName ?? "Location not named"}
                      </p>
                      <p className="text-sm text-ink">{formatIsoDate(row.reportingDate)}</p>
                    </div>
                    <p className="shrink-0 text-sm font-medium text-ink">
                      {formatMinorAmount(row.kind === "refund" ? -row.amountMinor : row.amountMinor, row.currency)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
