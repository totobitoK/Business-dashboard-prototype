export const DASHBOARD_WIDGET_IDS = [
  "metrics",
  "trend",
  "appointments",
  "invoices",
] as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];

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
  const order = partial?.widgetOrder?.length
    ? [...partial.widgetOrder]
    : [...DEFAULT_WORKSPACE_LAYOUT.widgetOrder];
  const hidden = partial?.hiddenWidgets ?? [];
  const visibleOrder = order.filter((id) => !hidden.includes(id));
  const missing = DASHBOARD_WIDGET_IDS.filter(
    (id) => !visibleOrder.includes(id) && !hidden.includes(id)
  );
  return {
    themeId: partial?.themeId ?? DEFAULT_WORKSPACE_LAYOUT.themeId,
    showCompactMetrics:
      partial?.showCompactMetrics ?? DEFAULT_WORKSPACE_LAYOUT.showCompactMetrics,
    widgetOrder: [...visibleOrder, ...missing, ...hidden.filter((h) => !order.includes(h))],
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
