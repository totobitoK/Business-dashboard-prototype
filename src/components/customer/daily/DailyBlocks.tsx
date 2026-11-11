"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import type { AttentionItem } from "@/lib/daily-dashboard/connector-state";
import type { CollectionsPeriodSummary } from "@/lib/daily-dashboard/collections-period";
import type { DailyTheme } from "@/lib/daily-dashboard/theme";
import type { DailyDashboardSnapshot, DailyInvoice } from "@/lib/daily-dashboard/types";
import { CONNECTOR_STATE_LABEL } from "@/lib/daily-dashboard/types";
import { companyTimeZoneLabel } from "@/lib/company-time-zone";
import { formatMinorAmount } from "@/lib/square/collections-presentation";
import { formatCalendarDateDisplay } from "@/lib/workspace-reporting-period";
import { DailyCollectionsChart } from "./DailyCollectionsChart";

export function TextLink({
  href,
  external,
  preview,
  className,
  children,
}: {
  href: string;
  external?: boolean;
  preview?: boolean;
  className: string;
  children: ReactNode;
}) {
  if (preview) return <span className={className}>{children}</span>;
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export function StateBadge({ state, theme }: { state: string; theme: DailyTheme }) {
  const label = CONNECTOR_STATE_LABEL[state as keyof typeof CONNECTOR_STATE_LABEL] ?? state;
  const tone =
    state === "ready" || state === "verified_empty" || state === "syncing"
      ? theme.healthy
      : state === "stale" || state === "reconnect_required" || state === "load_error"
        ? theme.warning
        : theme.muted;
  return <span className={`text-xs font-semibold ${tone}`}>{label}</span>;
}

export function formatSync(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SectionCard({
  theme,
  title,
  eyebrow,
  action,
  children,
  compact,
}: {
  theme: DailyTheme;
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <section className={theme.card}>
      <div className={`flex items-start justify-between gap-3 ${compact ? "px-3 py-3" : "px-4 py-4 sm:px-5"}`}>
        <div className="min-w-0">
          {eyebrow ? (
            <p className={`text-[11px] font-semibold uppercase tracking-wide ${theme.subtle}`}>{eyebrow}</p>
          ) : null}
          <h2 className={`${eyebrow ? "mt-1" : ""} text-base font-semibold ${theme.text}`}>{title}</h2>
        </div>
        {action}
      </div>
      <div className={`${theme.divider} border-t ${compact ? "px-3 py-3" : "px-4 py-4 sm:px-5"}`}>
        {children}
      </div>
    </section>
  );
}

export function MessageList({ messages, theme }: { messages: string[]; theme: DailyTheme }) {
  if (messages.length === 0) return null;
  return (
    <div className="space-y-2">
      {messages.map((message) => (
        <p key={message} className={`rounded-lg px-3 py-2 text-sm ${theme.nested} ${theme.text}`}>
          {message}
        </p>
      ))}
    </div>
  );
}

export function NeedsAttention({
  items,
  theme,
  preview,
  compact,
}: {
  items: AttentionItem[];
  theme: DailyTheme;
  preview?: boolean;
  compact?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section className={`rounded-2xl border px-4 py-3 ${theme.attention} ${compact ? "px-3" : ""}`}>
      <h2 className="text-sm font-semibold">Needs attention</h2>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="text-sm">
            <TextLink href={item.href} external={item.external} preview={preview} className="font-semibold underline-offset-2 hover:underline">
              {item.title}
            </TextLink>
            <span className="ml-2 opacity-80">{item.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ReceivablesPanel({
  snapshot,
  theme,
  invoices,
  emptyLabel,
  preview,
  compact,
  links,
  showOpenLink = true,
}: {
  snapshot: DailyDashboardSnapshot;
  theme: DailyTheme;
  invoices: DailyInvoice[];
  emptyLabel: string;
  preview?: boolean;
  compact?: boolean;
  links: { receivables: string };
  showOpenLink?: boolean;
}) {
  const data = snapshot.receivables;
  const asOf = data.asOfDate ? formatCalendarDateDisplay(data.asOfDate) : null;
  const synced = formatSync(data.lastSuccessfulSyncAt);
  return (
    <SectionCard
      theme={theme}
      eyebrow="QuickBooks"
      title="Receivables"
      compact={compact}
      action={<StateBadge state={data.state} theme={theme} />}
    >
      <p className={`text-sm ${theme.muted}`}>
        {snapshot.source === "demo" ? "Sample open invoices. " : null}
        Unpaid balances on open invoices. These are not revenue and not money collected.
      </p>
      <p className={`mt-2 text-xs tabular-nums ${theme.subtle}`}>
        {asOf ? `As of ${asOf}` : "As-of date unavailable"}
        {data.environmentLabel ? ` · ${data.environmentLabel}` : ""}
        {synced ? ` · Last successful sync ${synced}` : ""}
      </p>
      <div className="mt-3">
        <MessageList messages={data.messages} theme={theme} />
      </div>
      {data.showBalances ? (
        <>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <Figure label="Open balance" theme={theme} compact={compact}>
              {data.openBalance === null ? (
                <Unavailable theme={theme} />
              ) : (
                <CurrencyAmount amount={data.openBalance} detailed colorClass={theme.figure} className="text-2xl font-semibold tabular-nums" />
              )}
            </Figure>
            <Figure label="Overdue balance" theme={theme} compact={compact}>
              {data.overdueBalance === null ? (
                <Unavailable theme={theme} />
              ) : (
                <CurrencyAmount amount={data.overdueBalance} detailed colorClass={theme.figure} className="text-2xl font-semibold tabular-nums" />
              )}
            </Figure>
            <Figure label="Overdue invoices" theme={theme} compact={compact}>
              <span className={`text-2xl font-semibold tabular-nums ${theme.figure}`}>{data.overdueCount}</span>
            </Figure>
          </dl>
          <div className="mt-4">
            {invoices.length === 0 ? (
              <p className={`text-sm ${theme.muted}`}>{emptyLabel}</p>
            ) : (
              <InvoiceList invoices={invoices} theme={theme} preview={preview} />
            )}
            {data.listTruncated ? (
              <p className={`mt-2 text-xs ${theme.subtle}`}>
                Showing {data.invoices.length} of {data.invoiceCount} open invoices. Balances include the full open set.
              </p>
            ) : null}
          </div>
        </>
      ) : null}
      {showOpenLink ? (
        <p className="mt-3 text-sm">
          <TextLink href={links.receivables} preview={preview} className={theme.link}>
            Open receivables
          </TextLink>
        </p>
      ) : null}
    </SectionCard>
  );
}

export function CollectionsPanel({
  snapshot,
  summary,
  rangeLabel,
  theme,
  showChart,
  showActivity,
  chartFirst = true,
  compact,
}: {
  snapshot: DailyDashboardSnapshot;
  summary: CollectionsPeriodSummary;
  rangeLabel: string;
  theme: DailyTheme;
  showChart: boolean;
  showActivity: boolean;
  chartFirst?: boolean;
  compact?: boolean;
}) {
  const data = snapshot.collections;
  const zone = companyTimeZoneLabel(data.timeZone ?? snapshot.timeZone);
  const synced = formatSync(data.lastSuccessfulSyncAt);
  return (
    <SectionCard
      theme={theme}
      eyebrow="Square"
      title="Collections"
      compact={compact}
      action={<StateBadge state={data.state} theme={theme} />}
    >
      <p className={`text-sm ${theme.muted}`}>
        Completed payments and refunds before processing fees. Not QuickBooks receivables.
      </p>
      <p className={`mt-2 text-xs tabular-nums ${theme.subtle}`}>
        {rangeLabel} · {zone}
        {data.environmentLabel ? ` · ${data.environmentLabel}` : ""}
        {synced ? ` · Last successful sync ${synced}` : ""}
      </p>
      <div className="mt-3">
        <MessageList messages={data.messages} theme={theme} />
      </div>
      {data.showTotals ? (
        <div className="mt-4 flex flex-col gap-4">
          {summary.partial ? (
            <p className={`text-sm ${theme.warning}`}>
              This range starts before the latest loaded activity. Totals, the chart, and the list use that same loaded activity.
            </p>
          ) : null}
          {summary.totalsExceedList ? (
            <p className={`text-xs ${theme.subtle}`}>
              Totals are the full reporting date. The list shows the latest loaded activity for that date.
            </p>
          ) : null}
          {summary.verifiedEmpty ? (
            <div>
              <p className={`text-sm ${theme.muted}`}>No completed payments or refunds in this range.</p>
              <p className={`mt-2 text-2xl font-semibold tabular-nums ${theme.figure}`}>$0.00</p>
            </div>
          ) : (
            summary.currencies.map((row) => (
              <div key={row.currency}>
                <p className={`text-[11px] font-semibold uppercase tracking-wide ${theme.subtle}`}>{row.currency}</p>
                <dl className="mt-2 grid gap-3 sm:grid-cols-3">
                  <Figure label="Completed payments" theme={theme} compact={compact}>
                    <Minor amount={row.paymentsMinor} currency={row.currency} theme={theme} />
                  </Figure>
                  <Figure label="Completed refunds" theme={theme} compact={compact}>
                    <Minor amount={row.refundsMinor} currency={row.currency} theme={theme} />
                  </Figure>
                  <Figure label="Net before fees" theme={theme} compact={compact}>
                    <Minor amount={row.netMinor} currency={row.currency} theme={theme} />
                  </Figure>
                </dl>
              </div>
            ))
          )}
          {showChart && summary.showChart && summary.currency ? (
            <div className={`${theme.nested} p-3 ${chartFirst ? "order-1" : "order-2"}`}>
              <p className={`mb-1 text-xs font-semibold ${theme.muted}`}>
                {summary.currency} net before fees
              </p>
              <DailyCollectionsChart trend={summary.trend} currency={summary.currency} theme={theme} />
            </div>
          ) : null}
          {showActivity ? (
            <div className={chartFirst ? "order-2" : "order-1"}>
              <h3 className={`text-sm font-semibold ${theme.text}`}>Transactions</h3>
              {summary.transactions.length === 0 ? (
                <p className={`mt-2 text-sm ${theme.muted}`}>No loaded transactions in this range.</p>
              ) : (
                <ul className={`mt-2 divide-y ${theme.divider}`}>
                  {summary.transactions.map((row) => (
                    <li key={row.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className={`font-medium ${theme.text}`}>
                          {row.kind === "refund" ? "Refund" : "Payment"}
                          {row.sourceType ? ` · ${row.sourceType.toLowerCase().replace(/_/g, " ")}` : ""}
                        </p>
                        <p className={`truncate ${theme.muted}`}>
                          {row.locationName ?? "Location not named"} · {formatCalendarDateDisplay(row.reportingDate)}
                        </p>
                      </div>
                      <p className={`shrink-0 font-semibold tabular-nums ${theme.figure}`}>
                        {formatMinorAmount(row.kind === "refund" ? -row.amountMinor : row.amountMinor, row.currency)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </SectionCard>
  );
}

export function NextUp({
  snapshot,
  theme,
  preview,
  compact,
  scheduleHref,
}: {
  snapshot: DailyDashboardSnapshot;
  theme: DailyTheme;
  preview?: boolean;
  compact?: boolean;
  scheduleHref: string;
}) {
  const upcoming = snapshot.schedule.appointments
    .filter((appointment) => appointment.isoDate >= snapshot.asOfDate)
    .slice(0, 4);
  const next = upcoming[0];
  const blocked = ["disconnected", "unavailable", "setup_incomplete", "reconnect_required", "load_error"].includes(
    snapshot.schedule.state
  );
  return (
    <SectionCard
      theme={theme}
      eyebrow={snapshot.schedule.windowLabel}
      title="Next up"
      compact={compact}
      action={<StateBadge state={snapshot.schedule.state} theme={theme} />}
    >
      {blocked ? <MessageList messages={snapshot.schedule.messages} theme={theme} /> : null}
      {!blocked && !next ? (
        <p className={`text-sm ${theme.muted}`}>No appointments in the Today / Upcoming window.</p>
      ) : null}
      {!blocked && next ? (
        <div>
          <p className={`text-sm font-semibold ${theme.text}`}>{next.title}</p>
          <p className={`mt-1 text-sm tabular-nums ${theme.muted}`}>{next.whenLabel}</p>
          {next.calendarName ? <p className={`text-xs ${theme.subtle}`}>{next.calendarName}</p> : null}
          {upcoming.length > 1 ? (
            <ul className="mt-3 space-y-2">
              {upcoming.slice(1).map((appointment) => (
                <li key={appointment.id} className={`rounded-lg px-2 py-1.5 text-sm ${theme.row}`}>
                  <p className={`font-medium ${theme.text}`}>{appointment.title}</p>
                  <p className={`tabular-nums ${theme.muted}`}>{appointment.whenLabel}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <p className="mt-3 text-sm">
        <TextLink href={scheduleHref} preview={preview} className={theme.link}>
          Open schedule
        </TextLink>
      </p>
    </SectionCard>
  );
}

export function ConnectorHealth({
  snapshot,
  theme,
  preview,
  compact,
  connectionsHref,
}: {
  snapshot: DailyDashboardSnapshot;
  theme: DailyTheme;
  preview?: boolean;
  compact?: boolean;
  connectionsHref: string;
}) {
  return (
    <SectionCard theme={theme} title="Connections" compact={compact}>
      <ul className="space-y-3">
        {snapshot.connectors.map((connector) => {
          const synced = formatSync(connector.lastSuccessfulSyncAt);
          return (
            <li key={connector.id} className={`rounded-lg px-3 py-2 ${theme.row}`}>
              <div className="flex items-center justify-between gap-2">
                <p className={`text-sm font-semibold ${theme.text}`}>{connector.label}</p>
                <StateBadge state={connector.state} theme={theme} />
              </div>
              <p className={`mt-1 text-xs ${theme.muted}`}>{connector.detail}</p>
              <p className={`mt-1 text-xs tabular-nums ${theme.subtle}`}>
                {synced ? `Last successful sync ${synced}` : "No successful sync yet"}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-sm">
        <TextLink href={connectionsHref} preview={preview} className={theme.link}>
          Manage connections
        </TextLink>
      </p>
    </SectionCard>
  );
}

function Figure({
  label,
  theme,
  compact,
  children,
}: {
  label: string;
  theme: DailyTheme;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`min-w-0 rounded-xl px-3 py-2 ${theme.nested}`}>
      <dt className={`text-[11px] font-semibold uppercase tracking-wide ${theme.subtle}`}>{label}</dt>
      <dd className={compact ? "mt-1" : "mt-1.5"}>{children}</dd>
    </div>
  );
}

function Minor({ amount, currency, theme }: { amount: number; currency: string; theme: DailyTheme }) {
  return (
    <span className={`text-2xl font-semibold tabular-nums ${theme.figure}`}>
      {formatMinorAmount(amount, currency)}
    </span>
  );
}

function Unavailable({ theme }: { theme: DailyTheme }) {
  return <span className={`text-sm font-medium ${theme.muted}`}>Unavailable</span>;
}

function InvoiceList({
  invoices,
  theme,
  preview,
}: {
  invoices: DailyInvoice[];
  theme: DailyTheme;
  preview?: boolean;
}) {
  return (
    <ul className={`divide-y overflow-hidden rounded-xl border ${theme.divider}`}>
      <li className={`hidden px-3 py-2 text-[11px] font-semibold uppercase tracking-wide lg:grid lg:grid-cols-[1.4fr_1fr_auto_auto] lg:gap-3 ${theme.subtle}`}>
        <span>Customer</span>
        <span>Due</span>
        <span className="text-right">Balance</span>
        <span>QuickBooks</span>
      </li>
      {invoices.map((invoice, index) => (
        <li
          key={invoice.id}
          id={`inv-${invoice.id}`}
          className={`scroll-mt-24 px-3 py-2 lg:grid lg:grid-cols-[1.4fr_1fr_auto_auto] lg:items-center lg:gap-3 ${
            index % 2 === 0 ? theme.row : theme.rowAlt
          }`}
        >
          <details className="lg:hidden">
            <summary className={`cursor-pointer text-sm font-semibold ${theme.text}`}>
              {invoice.customer}
              <span className={`ml-2 tabular-nums ${theme.figure}`}>
                <CurrencyAmount amount={invoice.balance} detailed colorClass={theme.figure} />
              </span>
            </summary>
            <InvoiceMeta invoice={invoice} theme={theme} preview={preview} />
          </details>
          <div className="hidden text-sm lg:contents">
            <span className={`font-medium ${theme.text}`}>
              {invoice.docNumber ? `${invoice.docNumber} · ` : ""}
              {invoice.customer}
            </span>
            <span className={`tabular-nums ${theme.muted}`}>
              {invoice.dueDate ? formatCalendarDateDisplay(invoice.dueDate) : "No due date"}
              {invoice.overdue ? " · Past due" : ""}
            </span>
            <span className="text-right tabular-nums">
              <CurrencyAmount amount={invoice.balance} detailed colorClass={theme.figure} />
            </span>
            <span>
              {invoice.href ? (
                <TextLink href={invoice.href} external preview={preview} className={theme.link}>
                  View
                </TextLink>
              ) : (
                <span className={theme.subtle}>Sample</span>
              )}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function InvoiceMeta({
  invoice,
  theme,
  preview,
}: {
  invoice: DailyInvoice;
  theme: DailyTheme;
  preview?: boolean;
}) {
  return (
    <div className={`mt-2 space-y-1 text-sm ${theme.muted}`}>
      <p className="tabular-nums">
        {invoice.dueDate ? `Due ${formatCalendarDateDisplay(invoice.dueDate)}` : "No due date"}
        {invoice.overdue ? " · Past due" : ""}
      </p>
      {invoice.href ? (
        <TextLink href={invoice.href} external preview={preview} className={theme.link}>
          Open in QuickBooks
        </TextLink>
      ) : (
        <p>Sample invoice</p>
      )}
    </div>
  );
}
