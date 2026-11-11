"use client";

import type { CollectionsPeriodSummary } from "@/lib/daily-dashboard/collections-period";
import type { DailyTheme } from "@/lib/daily-dashboard/theme";
import type { DailyDashboardSnapshot } from "@/lib/daily-dashboard/types";
import type { MoneyView } from "@/lib/dashboard-section-routes";
import { CollectionsPanel, ReceivablesPanel, TextLink } from "./DailyBlocks";

export function DailyMoney({
  view,
  snapshot,
  summary,
  rangeLabel,
  theme,
  links,
  showChart,
  showActivity,
  chartFirst = true,
  compact,
  preview,
}: {
  view: MoneyView;
  snapshot: DailyDashboardSnapshot;
  summary: CollectionsPeriodSummary;
  rangeLabel: string;
  theme: DailyTheme;
  links: { receivables: string; collections: string };
  showChart: boolean;
  showActivity: boolean;
  chartFirst?: boolean;
  compact?: boolean;
  preview?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className={`inline-flex rounded-lg p-1 ${theme.nested}`} role="tablist" aria-label="Money">
        <TextLink
          href={links.receivables}
          preview={preview}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold ${theme.focus} ${
            view === "receivables" ? theme.navActive : theme.navIdle
          }`}
        >
          Receivables
        </TextLink>
        <TextLink
          href={links.collections}
          preview={preview}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold ${theme.focus} ${
            view === "collections" ? theme.navActive : theme.navIdle
          }`}
        >
          Collections
        </TextLink>
      </div>
      {view === "collections" ? (
        <CollectionsPanel
          snapshot={snapshot}
          summary={summary}
          rangeLabel={rangeLabel}
          theme={theme}
          showChart={showChart}
          showActivity={showActivity}
          chartFirst={chartFirst}
          compact={compact}
        />
      ) : (
        <ReceivablesPanel
          snapshot={snapshot}
          theme={theme}
          invoices={snapshot.receivables.invoices}
          emptyLabel="No open invoices in this read."
          preview={preview}
          compact={compact}
          links={{ receivables: links.receivables }}
          showOpenLink={false}
        />
      )}
    </div>
  );
}
