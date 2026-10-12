export const OVERVIEW_KPI_IDS = [
  "payments_collected",
  "jobs_completed",
  "outstanding_balance",
  "overdue_balance",
] as const;

export const REVENUE_KPI_IDS = [
  "weekly_revenue",
  "monthly_revenue",
  "month_pipeline",
  "overdue_ar",
] as const;

export type OverviewKpiId = (typeof OVERVIEW_KPI_IDS)[number];
export type RevenueKpiId = (typeof REVENUE_KPI_IDS)[number];

export const OVERVIEW_KPI_LABELS: Record<OverviewKpiId, string> = {
  payments_collected: "Payments collected",
  jobs_completed: "Completed jobs",
  outstanding_balance: "Outstanding invoice balance",
  overdue_balance: "Overdue invoice balance",
};

export const REVENUE_KPI_LABELS: Record<RevenueKpiId, string> = {
  weekly_revenue: "Weekly revenue",
  monthly_revenue: "Monthly revenue",
  month_pipeline: "Month pipeline",
  overdue_ar: "Overdue AR",
};

function normalizeKpiOrder<T extends string>(
  allIds: readonly T[],
  rawOrder: T[] | undefined,
  hidden: T[] | undefined
): { order: T[]; hidden: T[] } {
  const hiddenSet = new Set((hidden ?? []).filter((id) => allIds.includes(id)));
  const raw = (rawOrder ?? []).filter((id) => allIds.includes(id));
  const order = [...new Set(raw)] as T[];
  const missing = allIds.filter((id) => !order.includes(id) && !hiddenSet.has(id));
  const trailingHidden = allIds.filter((id) => hiddenSet.has(id) && !order.includes(id));
  const mergedOrder = [...order, ...missing, ...trailingHidden];

  const visible = mergedOrder.filter((id) => !hiddenSet.has(id));
  if (visible.length === 0 && mergedOrder.length > 0) {
    const first = mergedOrder[0]!;
    hiddenSet.delete(first);
  }

  return { order: mergedOrder, hidden: [...hiddenSet] };
}

export function normalizeOverviewKpiLayout(partial?: {
  overviewKpiOrder?: OverviewKpiId[];
  overviewHiddenKpis?: OverviewKpiId[];
}) {
  return normalizeKpiOrder(
    OVERVIEW_KPI_IDS,
    partial?.overviewKpiOrder,
    partial?.overviewHiddenKpis
  );
}

export function normalizeRevenueKpiLayout(partial?: {
  revenueKpiOrder?: RevenueKpiId[];
  revenueHiddenKpis?: RevenueKpiId[];
}) {
  return normalizeKpiOrder(
    REVENUE_KPI_IDS,
    partial?.revenueKpiOrder,
    partial?.revenueHiddenKpis
  );
}

export function visibleKpiIds<T extends string>(order: T[], hidden: T[]): T[] {
  return order.filter((id) => !hidden.includes(id));
}

export function moveKpi<T extends string>(
  order: T[],
  id: T,
  direction: "up" | "down"
): T[] {
  const idx = order.indexOf(id);
  if (idx < 0) return order;
  const swap = direction === "up" ? idx - 1 : idx + 1;
  if (swap < 0 || swap >= order.length) return order;
  const next = [...order];
  [next[idx], next[swap]] = [next[swap], next[idx]];
  return next;
}

export function toggleKpiHidden<T extends string>(
  order: T[],
  hidden: T[],
  id: T
): T[] {
  const hiddenSet = new Set(hidden);
  const visibleCount = order.filter((k) => !hiddenSet.has(k)).length;

  if (hiddenSet.has(id)) {
    hiddenSet.delete(id);
  } else if (visibleCount > 1) {
    hiddenSet.add(id);
  }

  return [...hiddenSet];
}
