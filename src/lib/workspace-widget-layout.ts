export const DASHBOARD_WIDGET_IDS = [
  "metrics",
  "collections_chart",
  "needs_attention",
  "job_activity",
  "appointments",
  "invoices",
] as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];

const LEGACY_WIDGET_MAP: Record<string, DashboardWidgetId> = {
  trend: "collections_chart",
};

export function migrateWidgetId(id: string): DashboardWidgetId | null {
  if (LEGACY_WIDGET_MAP[id]) return LEGACY_WIDGET_MAP[id];
  if ((DASHBOARD_WIDGET_IDS as readonly string[]).includes(id)) {
    return id as DashboardWidgetId;
  }
  return null;
}

export interface WorkspaceLayoutSettings {
  themeId: string;
  showCompactMetrics: boolean;
  widgetOrder: DashboardWidgetId[];
  hiddenWidgets: DashboardWidgetId[];
}

export const DEFAULT_WORKSPACE_LAYOUT: WorkspaceLayoutSettings = {
  themeId: "purple",
  showCompactMetrics: false,
  widgetOrder: [...DASHBOARD_WIDGET_IDS],
  hiddenWidgets: [],
};

export function normalizeLayoutSettings(
  partial?: Partial<WorkspaceLayoutSettings>
): WorkspaceLayoutSettings {
  const rawOrder = partial?.widgetOrder?.length
    ? partial.widgetOrder.map((id) => migrateWidgetId(id)).filter(Boolean)
    : [...DEFAULT_WORKSPACE_LAYOUT.widgetOrder];
  const order = [...new Set(rawOrder)] as DashboardWidgetId[];

  const hidden = (partial?.hiddenWidgets ?? [])
    .map((id) => migrateWidgetId(id))
    .filter(Boolean) as DashboardWidgetId[];

  const visibleOrder = order.filter((id) => !hidden.includes(id));
  const missing = DASHBOARD_WIDGET_IDS.filter(
    (id) => !visibleOrder.includes(id) && !hidden.includes(id)
  );

  const mergedOrder = [
    ...visibleOrder,
    ...missing,
    ...hidden.filter((h) => !order.includes(h)),
  ];

  return {
    themeId: partial?.themeId ?? DEFAULT_WORKSPACE_LAYOUT.themeId,
    showCompactMetrics:
      partial?.showCompactMetrics ?? DEFAULT_WORKSPACE_LAYOUT.showCompactMetrics,
    widgetOrder: mergedOrder,
    hiddenWidgets: hidden,
  };
}

export function moveWidget(
  order: DashboardWidgetId[],
  id: DashboardWidgetId,
  direction: "up" | "down"
): DashboardWidgetId[] {
  const idx = order.indexOf(id);
  if (idx < 0) return order;
  const swap = direction === "up" ? idx - 1 : idx + 1;
  if (swap < 0 || swap >= order.length) return order;
  const next = [...order];
  [next[idx], next[swap]] = [next[swap], next[idx]];
  return next;
}

export const WIDGET_LABELS: Record<DashboardWidgetId, string> = {
  metrics: "KPI summary",
  collections_chart: "Collections trend",
  needs_attention: "Needs attention",
  job_activity: "Job activity",
  appointments: "Upcoming appointments",
  invoices: "Invoice table",
};
