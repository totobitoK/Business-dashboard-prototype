"use client";

import type { ReactNode } from "react";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import { CountUpMoney } from "@/components/customer/CountUpFigure";
import type { SalesInsight, SalesSlice } from "@/lib/sales-insight";
import { isLightDashboardTheme, type LayoutCustomizeTheme } from "@/lib/layout-customize-themes";

function shareLabel(share: number): string {
  return `${Math.round(share * 100)}%`;
}

function ShareRows({
  rows,
  theme,
}: {
  rows: SalesSlice[];
  theme: LayoutCustomizeTheme;
}) {
  const track = isLightDashboardTheme(theme.id) ? "bg-black/10" : "bg-white/10";
  return (
    <ul className="mt-3 flex flex-col gap-2.5">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm text-ink">
            <span className="min-w-0 truncate font-semibold">{row.label}</span>
            <span className="shrink-0 tabular-nums">
              <CurrencyAmount amount={row.amount} colorClass="text-ink" className="inline" />
              <span className="ml-2">{shareLabel(row.share)}</span>
            </span>
          </div>
          <div className={`mt-1 h-1.5 overflow-hidden rounded-full ${track}`}>
            <div
              className={`h-full rounded-full ${theme.chartBar}`}
              style={{ width: `${Math.max(8, Math.round(row.share * 100))}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function InsightCard({
  theme,
  label,
  value,
  children,
}: {
  theme: LayoutCustomizeTheme;
  label: string;
  value: ReactNode;
  children: ReactNode;
}) {
  const rule = isLightDashboardTheme(theme.id) ? theme.detailPanelBorder : "border-white/10";
  return (
    <article className={`flex flex-col p-4 ${theme.sectionPanel}`}>
      <p className="text-xs font-semibold text-ink">{label}</p>
      <div className="mt-1">{value}</div>
      <div className={`mt-3 border-t pt-3 text-sm leading-relaxed text-ink ${rule}`}>{children}</div>
    </article>
  );
}

/** Ticket size, who paid, and what the money was for, sitting under collections. */
export function SalesInsightCards({
  insight,
  theme,
}: {
  insight: SalesInsight;
  theme: LayoutCustomizeTheme;
}) {
  const topAccount = insight.topAccounts[0];
  const topMix = insight.mix[0];
  const saleWord = insight.count === 1 ? "sale" : "sales";
  const repeat =
    insight.repeatAccountCount === 0
      ? "No account paid more than once in this range."
      : `${insight.repeatAccountCount} of ${insight.accountCount} accounts paid more than once.`;

  return (
    <div className="grid grid-cols-1 items-stretch gap-3 xl:grid-cols-3">
      <InsightCard
        theme={theme}
        label="Average sale"
        value={
          <CountUpMoney
            amount={insight.average}
            className="text-2xl font-semibold tabular-nums"
            colorClass={theme.metricValueA}
          />
        }
      >
        <p>
          <CurrencyAmount
            amount={insight.total}
            colorClass={theme.metricValueA}
            className="inline font-semibold"
          />{" "}
          collected across {insight.count} {saleWord}. The median sale is{" "}
          <CurrencyAmount amount={insight.median} colorClass="text-ink" className="inline font-semibold" />.
          {" "}
          {insight.compare.text}
        </p>
        {insight.largest ? (
          <p className="mt-2">
            Largest sale is {insight.largest.label} at{" "}
            <CurrencyAmount
              amount={insight.largest.amount}
              colorClass={theme.metricValueA}
              className="inline font-semibold"
            /> ({shareLabel(insight.largest.share)} of collections in this range).
          </p>
        ) : null}
      </InsightCard>

      <InsightCard
        theme={theme}
        label="Accounts"
        value={
          <p className={`text-2xl font-semibold tabular-nums ${theme.metricValueA}`}>
            {insight.accountCount}
          </p>
        }
      >
        <p>
          {topAccount
            ? `${topAccount.label} is ${shareLabel(insight.topAccountShare)} of collections.`
            : "No account breakdown in this range."}{" "}
          {repeat}
        </p>
        <ShareRows rows={insight.topAccounts} theme={theme} />
      </InsightCard>

      <InsightCard
        theme={theme}
        label={insight.mixLabel}
        value={
          <CountUpMoney
            amount={insight.mixTotal}
            className="text-2xl font-semibold tabular-nums"
            colorClass={theme.metricValueA}
          />
        }
      >
        <p>
          {topMix
            ? `${topMix.label} is ${shareLabel(topMix.share)} of collections in this range.`
            : "No line breakdown in this range."}
        </p>
        <ShareRows rows={insight.mix} theme={theme} />
      </InsightCard>
    </div>
  );
}
