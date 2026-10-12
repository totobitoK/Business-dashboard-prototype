export type LayoutCustomizeTheme = {
  id: string;
  name: string;
  card: string;
  header: string;
  headerText: string;
  badge: string;
  badgeText: string;
  sidebar: string;
  navActive: string;
  navInactive: string;
  metricA: string;
  metricB: string;
  metricValueA: string;
  metricValueB: string;
  chartPanel: string;
  chartBar: string;
  chartBarHi: string;
  listPanel: string;
  listRow: string;
  listAccent: string;
  /** Background behind stacked section cards inside the dashboard shell. */
  dashboardCanvas: string;
  /** Primary widget / subsection card surface. */
  sectionPanel: string;
  /** Divider under section headers. */
  sectionHeader: string;
  filterTrack: string;
  filterControl: string;
  filterChevron: string;
  filterLabel: string;
  filterChipActive: string;
  filterChipIdle: string;
  filterSecondaryButton: string;
  filterMenuPanel: string;
  filterMenuItemActive: string;
  filterMenuItemIdle: string;
  swatches: string[];
  swatchRing: string;
  /** Active Overview/Revenue/Schedule tab on the gradient dashboard header. */
  embeddedNavActive: string;
  /** Active reporting-period chip on the dashboard header. */
  embeddedPeriodActive: string;
  chartGridLine: string;
  chartAxisLine: string;
  chartLine: string;
  chartPoint: string;
  chartPointHover: string;
  widgetListShell: string;
  widgetListDivide: string;
  widgetListHeader: string;
  widgetListDivideLight: string;
  widgetListColDivide: string;
  operationsListHover: string;
  operationsListSelected: string;
  tableRowSelected: string;
  tableRowSelectedInset: string;
  detailPanelBorder: string;
  detailSectionLabel: string;
  linkAccent: string;
  linkAccentHover: string;
  kpiEmptyState: string;
  attentionMetricTile: string;
  attentionMetricTileIdle: string;
  operationsSummaryChip: string;
  toolbarDivider: string;
};

export const LAYOUT_CUSTOMIZE_THEMES: LayoutCustomizeTheme[] = [
  {
    id: "purple",
    name: "RavenView purple",
    card: "border border-purple-200/90 bg-white shadow-card",
    header: "bg-gradient-to-r from-purple to-purple-dark",
    headerText: "text-white",
    badge: "bg-white/20",
    badgeText: "text-white",
    sidebar: "bg-purple-100/60",
    navActive: "bg-purple text-white",
    navInactive: "bg-white/70 text-ink",
    metricA: "border border-purple-200 bg-gradient-to-br from-purple-50 to-white",
    metricB: "border border-violet-200 bg-gradient-to-br from-violet-50 to-white",
    metricValueA: "text-purple-dark",
    metricValueB: "text-purple",
    chartPanel: "border border-purple-200 bg-white/90",
    chartBar: "bg-purple-300",
    chartBarHi: "bg-purple",
    listPanel: "border border-purple-200 bg-purple-50/40",
    listRow: "border border-purple-100 bg-white",
    listAccent: "text-purple-dark",
    dashboardCanvas: "bg-gradient-to-b from-purple-50/40 via-slate-50/30 to-violet-50/20",
    sectionPanel:
      "rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 to-white",
    sectionHeader: "border-b border-purple-100/90",
    filterTrack:
      "rounded-xl bg-purple-50/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] ring-1 ring-purple-100/80",
    filterControl:
      "border-purple-100/90 bg-white text-purple-dark hover:border-purple-200 focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple/15",
    filterChevron: "text-purple/50",
    filterLabel: "text-ink-subtle",
    filterChipActive: "bg-white text-purple-dark shadow-sm ring-1 ring-purple-100/90",
    filterChipIdle: "text-ink-muted hover:bg-white/50 hover:text-ink",
    filterSecondaryButton:
      "border-purple-200/90 bg-white text-purple-dark hover:border-purple-300 hover:bg-purple-50/60",
    filterMenuPanel:
      "rounded-xl border border-purple-200/90 bg-gradient-to-b from-white via-white to-purple-50/90 py-1 shadow-[0_12px_32px_-12px_rgba(124,58,237,0.35)] ring-1 ring-purple-100",
    filterMenuItemActive: "bg-purple-50 text-purple-dark",
    filterMenuItemIdle: "text-ink hover:bg-purple-50/60",
    swatches: ["#7C3AED", "#18181B", "#F3E8FF"],
    swatchRing: "border-purple-200",
    embeddedNavActive: "bg-white text-purple-dark shadow-sm",
    embeddedPeriodActive: "bg-white text-purple-dark shadow-md ring-1 ring-white/90",
    chartGridLine: "stroke-purple-100",
    chartAxisLine: "stroke-purple-200",
    chartLine: "stroke-purple",
    chartPoint: "fill-purple",
    chartPointHover: "fill-purple-dark",
    widgetListShell:
      "overflow-hidden rounded-xl border border-purple-200/90 bg-gradient-to-b from-white via-white to-purple-50/40 shadow-sm ring-1 ring-purple-100/60",
    widgetListDivide: "divide-purple-200/80",
    widgetListHeader: "border-b border-purple-200/80 bg-purple-50/55",
    widgetListDivideLight: "divide-purple-100/90",
    widgetListColDivide: "divide-purple-100/80",
    operationsListHover: "hover:bg-purple-50/65",
    operationsListSelected: "bg-purple-50/85",
    tableRowSelected: "bg-purple-50/80",
    tableRowSelectedInset: "shadow-[inset_3px_0_0_0_rgb(124,58,237)]",
    detailPanelBorder: "border-purple-100/80",
    detailSectionLabel: "text-purple",
    linkAccent: "text-purple",
    linkAccentHover: "hover:text-purple-dark",
    kpiEmptyState: "border-purple-200 bg-purple-50/30",
    attentionMetricTile: "border-purple-200 bg-gradient-to-br from-purple-50 to-white",
    attentionMetricTileIdle: "border-purple-200 bg-gradient-to-br from-purple-50 to-white",
    operationsSummaryChip:
      "rounded-full border border-purple-100 bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-ink-muted shadow-sm",
    toolbarDivider: "border-purple-100/80",
  },
  {
    id: "forest",
    name: "Forest & slate",
    card: "border border-emerald-200/90 bg-white shadow-card",
    header: "bg-gradient-to-r from-emerald-600 to-teal-600",
    headerText: "text-white",
    badge: "bg-white/20",
    badgeText: "text-white",
    sidebar: "bg-emerald-100/70",
    navActive: "bg-emerald-600 text-white",
    navInactive: "bg-white/80 text-ink",
    metricA: "border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white",
    metricB: "border border-teal-200 bg-gradient-to-br from-teal-50 to-white",
    metricValueA: "text-emerald-800",
    metricValueB: "text-teal-700",
    chartPanel: "border border-emerald-200 bg-white/90",
    chartBar: "bg-emerald-300",
    chartBarHi: "bg-emerald-600",
    listPanel: "border border-emerald-200 bg-emerald-50/50",
    listRow: "border border-emerald-100 bg-white",
    listAccent: "text-emerald-800",
    dashboardCanvas: "bg-gradient-to-b from-emerald-50/35 via-slate-50/30 to-teal-50/15",
    sectionPanel:
      "rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white",
    sectionHeader: "border-b border-emerald-100/90",
    filterTrack:
      "rounded-xl bg-emerald-50/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] ring-1 ring-emerald-100/80",
    filterControl:
      "border-emerald-100/90 bg-white text-emerald-900 hover:border-emerald-200 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-600/15",
    filterChevron: "text-emerald-600/45",
    filterLabel: "text-ink-subtle",
    filterChipActive: "bg-white text-emerald-900 shadow-sm ring-1 ring-emerald-100/90",
    filterChipIdle: "text-ink-muted hover:bg-white/50 hover:text-ink",
    filterSecondaryButton:
      "border-emerald-200/90 bg-white text-emerald-900 hover:border-emerald-300 hover:bg-emerald-50/60",
    filterMenuPanel:
      "rounded-xl border border-emerald-200/90 bg-gradient-to-b from-white via-white to-emerald-50/90 py-1 shadow-[0_12px_32px_-12px_rgba(5,150,105,0.22)] ring-1 ring-emerald-100",
    filterMenuItemActive: "bg-emerald-50 text-emerald-900",
    filterMenuItemIdle: "text-ink hover:bg-emerald-50/60",
    swatches: ["#059669", "#134E4A", "#D1FAE5"],
    swatchRing: "border-emerald-200",
    embeddedNavActive: "bg-white text-emerald-900 shadow-sm",
    embeddedPeriodActive: "bg-white text-emerald-900 shadow-md ring-1 ring-white/90",
    chartGridLine: "stroke-emerald-100",
    chartAxisLine: "stroke-emerald-200",
    chartLine: "stroke-emerald-600",
    chartPoint: "fill-emerald-600",
    chartPointHover: "fill-emerald-800",
    widgetListShell:
      "overflow-hidden rounded-xl border border-emerald-200/90 bg-gradient-to-b from-white via-white to-emerald-50/40 shadow-sm ring-1 ring-emerald-100/60",
    widgetListDivide: "divide-emerald-200/80",
    widgetListHeader: "border-b border-emerald-200/80 bg-emerald-50/55",
    widgetListDivideLight: "divide-emerald-100/90",
    widgetListColDivide: "divide-emerald-100/80",
    operationsListHover: "hover:bg-emerald-50/65",
    operationsListSelected: "bg-emerald-50/85",
    tableRowSelected: "bg-emerald-50/80",
    tableRowSelectedInset: "shadow-[inset_3px_0_0_0_rgb(5,150,105)]",
    detailPanelBorder: "border-emerald-100/80",
    detailSectionLabel: "text-emerald-700",
    linkAccent: "text-emerald-700",
    linkAccentHover: "hover:text-emerald-900",
    kpiEmptyState: "border-emerald-200 bg-emerald-50/30",
    attentionMetricTile: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white",
    attentionMetricTileIdle: "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white",
    operationsSummaryChip:
      "rounded-full border border-emerald-100 bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-ink-muted shadow-sm",
    toolbarDivider: "border-emerald-100/80",
  },
  {
    id: "ocean",
    name: "Ocean & ink",
    card: "border border-sky-200/90 bg-white shadow-card",
    header: "bg-gradient-to-r from-sky-600 to-indigo-600",
    headerText: "text-white",
    badge: "bg-white/20",
    badgeText: "text-white",
    sidebar: "bg-sky-100/70",
    navActive: "bg-sky-600 text-white",
    navInactive: "bg-white/80 text-ink",
    metricA: "border border-sky-200 bg-gradient-to-br from-sky-50 to-white",
    metricB: "border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white",
    metricValueA: "text-sky-900",
    metricValueB: "text-indigo-700",
    chartPanel: "border border-sky-200 bg-white/90",
    chartBar: "bg-sky-300",
    chartBarHi: "bg-sky-600",
    listPanel: "border border-sky-200 bg-sky-50/50",
    listRow: "border border-sky-100 bg-white",
    listAccent: "text-sky-900",
    dashboardCanvas: "bg-gradient-to-b from-sky-50/35 via-slate-50/30 to-indigo-50/15",
    sectionPanel:
      "rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white",
    sectionHeader: "border-b border-sky-100/90",
    filterTrack:
      "rounded-xl bg-sky-50/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] ring-1 ring-sky-100/80",
    filterControl:
      "border-sky-100/90 bg-white text-sky-900 hover:border-sky-200 focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-600/15",
    filterChevron: "text-sky-600/45",
    filterLabel: "text-ink-subtle",
    filterChipActive: "bg-white text-sky-900 shadow-sm ring-1 ring-sky-100/90",
    filterChipIdle: "text-ink-muted hover:bg-white/50 hover:text-ink",
    filterSecondaryButton:
      "border-sky-200/90 bg-white text-sky-900 hover:border-sky-300 hover:bg-sky-50/60",
    filterMenuPanel:
      "rounded-xl border border-sky-200/90 bg-gradient-to-b from-white via-white to-sky-50/90 py-1 shadow-[0_12px_32px_-12px_rgba(2,132,199,0.22)] ring-1 ring-sky-100",
    filterMenuItemActive: "bg-sky-50 text-sky-900",
    filterMenuItemIdle: "text-ink hover:bg-sky-50/60",
    swatches: ["#0284C7", "#0F172A", "#E0F2FE"],
    swatchRing: "border-sky-200",
    embeddedNavActive: "bg-white text-sky-900 shadow-sm",
    embeddedPeriodActive: "bg-white text-sky-900 shadow-md ring-1 ring-white/90",
    chartGridLine: "stroke-sky-100",
    chartAxisLine: "stroke-sky-200",
    chartLine: "stroke-sky-600",
    chartPoint: "fill-sky-600",
    chartPointHover: "fill-sky-900",
    widgetListShell:
      "overflow-hidden rounded-xl border border-sky-200/90 bg-gradient-to-b from-white via-white to-sky-50/40 shadow-sm ring-1 ring-sky-100/60",
    widgetListDivide: "divide-sky-200/80",
    widgetListHeader: "border-b border-sky-200/80 bg-sky-50/55",
    widgetListDivideLight: "divide-sky-100/90",
    widgetListColDivide: "divide-sky-100/80",
    operationsListHover: "hover:bg-sky-50/65",
    operationsListSelected: "bg-sky-50/85",
    tableRowSelected: "bg-sky-50/80",
    tableRowSelectedInset: "shadow-[inset_3px_0_0_0_rgb(2,132,199)]",
    detailPanelBorder: "border-sky-100/80",
    detailSectionLabel: "text-sky-700",
    linkAccent: "text-sky-700",
    linkAccentHover: "hover:text-sky-900",
    kpiEmptyState: "border-sky-200 bg-sky-50/30",
    attentionMetricTile: "border-sky-200 bg-gradient-to-br from-sky-50 to-white",
    attentionMetricTileIdle: "border-sky-200 bg-gradient-to-br from-sky-50 to-white",
    operationsSummaryChip:
      "rounded-full border border-sky-100 bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-ink-muted shadow-sm",
    toolbarDivider: "border-sky-100/80",
  },
];

/** Sample dashboard figures — same structure, reads clearly at small size. */
export const LAYOUT_CUSTOMIZE_SAMPLE = {
  nav: ["Overview", "Revenue", "Schedule"],
  metrics: [
    { label: "Revenue MTD", value: "$48.2K" },
    { label: "Open invoices", value: "$12.8K" },
  ],
  chartHeights: [42, 55, 48, 62, 58, 70, 65],
  chartLabels: ["M", "T", "W", "T", "F", "S", "S"],
  appointments: [
    { time: "9:00 AM", title: "Site visit — Oak St" },
    { time: "1:30 PM", title: "Estimate — Plaza HVAC" },
  ],
} as const;
