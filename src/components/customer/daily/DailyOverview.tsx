"use client";

import { buildAttentionItems } from "@/lib/daily-dashboard/connector-state";
import type { CollectionsPeriodSummary } from "@/lib/daily-dashboard/collections-period";
import type { DailyTheme } from "@/lib/daily-dashboard/theme";
import type { DailyDashboardSnapshot } from "@/lib/daily-dashboard/types";
import {
  CollectionsPanel,
  ConnectorHealth,
  NeedsAttention,
  NextUp,
  ReceivablesPanel,
} from "./DailyBlocks";

export function DailyOverview({
  snapshot,
  summary,
  rangeLabel,
  theme,
  links,
  showChart,
  showActivity,
  chartFirst,
  compact,
  preview,
  note,
}: {
  snapshot: DailyDashboardSnapshot;
  summary: CollectionsPeriodSummary;
  rangeLabel: string;
  theme: DailyTheme;
  links: { receivables: string; schedule: string; connections: string };
  showChart: boolean;
  showActivity: boolean;
  chartFirst?: boolean;
  compact?: boolean;
  preview?: boolean;
  note?: string;
}) {
  const attention = buildAttentionItems(snapshot, {
    receivables: links.receivables,
    connections: links.connections,
  });
  const pastDue = snapshot.receivables.invoices.filter((invoice) => invoice.overdue).slice(0, 4);

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      {note ? (
        <p className={`order-1 rounded-xl px-3 py-2 text-sm lg:col-span-2 ${theme.nested}`}>{note}</p>
      ) : null}
      {attention.length > 0 ? (
        <div className="order-1 lg:col-span-2">
          <NeedsAttention items={attention} theme={theme} preview={preview} compact={compact} />
        </div>
      ) : null}
      <div className="order-2">
        <ReceivablesPanel
          snapshot={snapshot}
          theme={theme}
          invoices={pastDue}
          emptyLabel="No past-due invoices in this read."
          preview={preview}
          compact={compact}
          links={{ receivables: links.receivables }}
        />
      </div>
      <div className="order-3 lg:row-span-2">
        <div className="space-y-4">
          <NextUp
            snapshot={snapshot}
            theme={theme}
            preview={preview}
            compact={compact}
            scheduleHref={links.schedule}
          />
          <ConnectorHealth
            snapshot={snapshot}
            theme={theme}
            preview={preview}
            compact={compact}
            connectionsHref={links.connections}
          />
        </div>
      </div>
      <div className="order-4">
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
      </div>
    </div>
  );
}
