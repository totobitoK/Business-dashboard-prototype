export type LayoutCustomizeTheme = {
  id: string;
  /** Class on the dashboard root. Dark themes use it to retint shared text. */
  scopeClass: string;
  name: string;
  card: string;
  header: string;
  headerText: string;
  /** Inactive primary section link on the header. */
  headerLink: string;
  /** Connections, Settings, and Sign out on the header. */
  headerQuiet: string;
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
  chartArea: string;
  widgetListShell: string;
  widgetListDivide: string;
  widgetListHeader: string;
  widgetListDivideLight: string;
  widgetListColDivide: string;
  /** Default row fill inside lists and tables. */
  widgetListRow: string;
  /** Alternating invoice row, a step deeper than `widgetListRow`. */
  widgetListRowAlt: string;
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
  /** Checked checkbox accent on the appearance page. */
  formAccent: string;
};

export const LAYOUT_CUSTOMIZE_THEMES: LayoutCustomizeTheme[] = [
  {
    id: "purple",
    scopeClass: "rv-theme-indigo",
    name: "RavenView Indigo",
    card: "border border-purple-300 bg-white shadow-card",
    header: "relative overflow-hidden bg-[#221c38] text-white shadow-[0_0_48px_rgba(139,92,246,0.35)] before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_at_top_left,rgba(167,139,250,0.55),transparent_58%)]",
    headerText: "text-white",
    headerLink: "text-white/90 hover:bg-white/15",
    headerQuiet: "text-white/70 hover:bg-white/10 hover:text-white",
    badge: "bg-white/20",
    badgeText: "text-white",
    sidebar: "bg-purple-100/60",
    navActive: "bg-purple text-white",
    navInactive: "bg-white/70 text-ink",
    metricA: "border border-white/10 bg-[#232734]",
    metricB: "border border-violet-300/30 bg-[#2a2440]",
    metricValueA: "text-violet-200",
    metricValueB: "text-violet-100",
    chartPanel: "border border-purple-300 bg-white/90",
    chartBar: "bg-purple-300",
    chartBarHi: "bg-purple",
    listPanel: "border border-purple-300 bg-purple-50/40",
    listRow: "border border-white/10 bg-[#232734]",
    listAccent: "text-violet-200",
    dashboardCanvas: "bg-[#12141a]",
    sectionPanel: "rounded-2xl border border-white/10 bg-[#1c1f2a]",
    sectionHeader: "border-b border-white/10",
    filterTrack: "rounded-xl bg-transparent",
    filterControl:
      "border-transparent bg-transparent text-white shadow-none hover:bg-white/10 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-white/40",
    filterChevron: "text-white/70",
    filterLabel: "text-ink-subtle",
    filterChipActive: "bg-white/15 text-white",
    filterChipIdle: "text-zinc-300 hover:bg-white/10 hover:text-white",
    filterSecondaryButton:
      "border-transparent bg-transparent text-white shadow-none hover:bg-white/10",
    filterMenuPanel: "rounded-xl bg-[#232734] py-1 shadow-lg",
    filterMenuItemActive: "bg-white/15 text-white",
    filterMenuItemIdle: "text-zinc-200 hover:bg-white/10",
    swatches: ["#12141A", "#2A2440", "#A78BFA"],
    swatchRing: "border-purple-200",
    embeddedNavActive: "bg-[#c7d2fe] text-[#312e81] shadow-sm",
    embeddedPeriodActive: "bg-white text-purple-dark shadow-md ring-1 ring-white/90",
    chartGridLine: "stroke-white/10",
    chartAxisLine: "stroke-white/20",
    chartLine: "stroke-violet-400",
    chartPoint: "fill-violet-200",
    chartPointHover: "fill-violet-100",
    chartArea: "fill-violet-400/25",
    widgetListShell:
      "overflow-hidden rounded-xl border border-white/10 bg-[#1c1f2a]",
    widgetListDivide: "divide-white/10",
    widgetListHeader: "border-b border-white/10 bg-white/5",
    widgetListDivideLight: "divide-white/10",
    widgetListColDivide: "divide-white/10",
    widgetListRow: "bg-[#232734]",
    widgetListRowAlt: "bg-violet-400/10",
    operationsListHover: "hover:bg-purple-50/65",
    operationsListSelected: "bg-violet-400/20",
    tableRowSelected: "bg-violet-400/15",
    tableRowSelectedInset: "shadow-[inset_3px_0_0_0_rgb(167,139,250)]",
    detailPanelBorder: "border-purple-200",
    detailSectionLabel: "text-purple",
    linkAccent: "text-purple",
    linkAccentHover: "hover:text-purple-dark",
    kpiEmptyState: "border-purple-300 bg-purple-50/30",
    attentionMetricTile: "border-purple-300 bg-purple-50",
    attentionMetricTileIdle: "border-purple-300 bg-purple-50",
    operationsSummaryChip:
      "rounded-full border border-purple-100 bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-ink-muted shadow-sm",
    toolbarDivider: "border-purple-100/80",
    formAccent: "accent-purple",
  },
  {
    id: "forest",
    scopeClass: "rv-theme-evergreen",
    name: "Evergreen Slate",
    card: "border border-emerald-300 bg-white shadow-card",
    header: "relative overflow-hidden bg-[#15241c] text-white",
    headerText: "text-white",
    headerLink: "text-white/90 hover:bg-white/15",
    headerQuiet: "text-white/70 hover:bg-white/10 hover:text-white",
    badge: "bg-white/20",
    badgeText: "text-white",
    sidebar: "bg-emerald-100/70",
    navActive: "bg-emerald-600 text-white",
    navInactive: "bg-white/80 text-ink",
    metricA: "border border-white/10 bg-[#24302c]",
    metricB: "border border-emerald-300/25 bg-[#1b3a2f]",
    metricValueA: "text-emerald-100",
    metricValueB: "text-emerald-200",
    chartPanel: "border border-emerald-300 bg-white/90",
    chartBar: "bg-emerald-300",
    chartBarHi: "bg-emerald-600",
    listPanel: "border border-emerald-300 bg-emerald-100/35",
    listRow: "border border-white/10 bg-[#24302c]",
    listAccent: "text-emerald-100",
    dashboardCanvas: "bg-[#121816]",
    sectionPanel: "rounded-2xl border border-white/10 bg-[#1c2422]",
    sectionHeader: "border-b border-white/10",
    filterTrack: "rounded-xl bg-transparent",
    filterControl:
      "border-transparent bg-transparent text-white shadow-none hover:bg-white/10 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-200/70",
    filterChevron: "text-white/70",
    filterLabel: "text-ink-subtle",
    filterChipActive: "bg-white/15 text-white",
    filterChipIdle: "text-zinc-300 hover:bg-white/10 hover:text-white",
    filterSecondaryButton:
      "border-transparent bg-transparent text-white shadow-none hover:bg-white/10",
    filterMenuPanel: "rounded-xl bg-[#24302c] py-1 shadow-lg",
    filterMenuItemActive: "bg-white/15 text-white",
    filterMenuItemIdle: "text-zinc-200 hover:bg-white/10",
    swatches: ["#121816", "#1B3A2F", "#6EE7B7"],
    swatchRing: "border-emerald-200",
    embeddedNavActive: "bg-emerald-200 text-emerald-950 shadow-sm",
    embeddedPeriodActive: "bg-white text-emerald-900 shadow-md ring-1 ring-white/90",
    chartGridLine: "stroke-white/10",
    chartAxisLine: "stroke-white/20",
    chartLine: "stroke-emerald-300",
    chartPoint: "fill-emerald-100",
    chartPointHover: "fill-emerald-50",
    chartArea: "fill-emerald-300/20",
    widgetListShell:
      "overflow-hidden rounded-xl border border-white/10 bg-[#1c2422]",
    widgetListDivide: "divide-white/10",
    widgetListHeader: "border-b border-white/10 bg-white/5",
    widgetListDivideLight: "divide-white/10",
    widgetListColDivide: "divide-white/10",
    widgetListRow: "bg-[#24302c]",
    widgetListRowAlt: "bg-emerald-300/10",
    operationsListHover: "hover:bg-emerald-50/65",
    operationsListSelected: "bg-emerald-300/20",
    tableRowSelected: "bg-emerald-300/15",
    tableRowSelectedInset: "shadow-[inset_3px_0_0_0_rgb(110,231,183)]",
    detailPanelBorder: "border-emerald-200",
    detailSectionLabel: "text-emerald-700",
    linkAccent: "text-emerald-700",
    linkAccentHover: "hover:text-emerald-900",
    kpiEmptyState: "border-emerald-300 bg-emerald-100/30",
    attentionMetricTile: "border-emerald-300 bg-emerald-100/50",
    attentionMetricTileIdle: "border-emerald-300 bg-emerald-100/50",
    operationsSummaryChip:
      "rounded-full border border-emerald-100 bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-ink-muted shadow-sm",
    toolbarDivider: "border-emerald-100/80",
    formAccent: "accent-emerald-600",
  },
  {
    id: "ocean",
    scopeClass: "rv-theme-porcelain",
    name: "Porcelain",
    card: "border border-sky-300 bg-white shadow-card",
    header: "relative overflow-hidden border-b border-stone-200 bg-[#fbfaf7] text-zinc-900",
    headerText: "text-zinc-900",
    headerLink: "text-zinc-700 hover:bg-violet-100 hover:text-zinc-950",
    headerQuiet: "text-zinc-500 hover:bg-violet-50 hover:text-zinc-900",
    badge: "bg-violet-100 text-violet-900",
    badgeText: "text-violet-900",
    sidebar: "bg-sky-100/70",
    navActive: "bg-sky-600 text-white",
    navInactive: "bg-white/80 text-ink",
    metricA: "border border-stone-200 bg-white",
    metricB: "border border-violet-200 bg-violet-50",
    metricValueA: "text-indigo-800",
    metricValueB: "text-indigo-700",
    chartPanel: "border border-sky-300 bg-white/90",
    chartBar: "bg-sky-300",
    chartBarHi: "bg-sky-600",
    listPanel: "border border-sky-300 bg-sky-50/50",
    listRow: "border border-stone-200 bg-white",
    listAccent: "text-indigo-700",
    dashboardCanvas: "bg-[#f7f4ef]",
    sectionPanel: "rounded-2xl border border-stone-200 bg-white shadow-sm",
    sectionHeader: "border-b border-stone-200",
    filterTrack:
      "rounded-xl bg-sky-50/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] ring-1 ring-sky-100/80",
    filterControl:
      "border border-stone-200 bg-white text-zinc-800 shadow-sm hover:border-stone-300 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-600/15",
    filterChevron: "text-sky-600/45",
    filterLabel: "text-ink-subtle",
    filterChipActive: "bg-white text-sky-900 shadow-sm ring-1 ring-sky-100/90",
    filterChipIdle: "text-ink-muted hover:bg-white/50 hover:text-ink",
    filterSecondaryButton:
      "border border-stone-200 bg-white text-zinc-800 shadow-sm hover:border-stone-300 hover:bg-violet-50",
    filterMenuPanel:
      "rounded-xl border border-sky-200/90 bg-gradient-to-b from-white via-white to-sky-50/90 py-1 shadow-[0_12px_32px_-12px_rgba(2,132,199,0.22)] ring-1 ring-sky-100",
    filterMenuItemActive: "bg-sky-50 text-sky-900",
    filterMenuItemIdle: "text-ink hover:bg-sky-50/60",
    swatches: ["#F7F4EF", "#FFFFFF", "#4F46E5"],
    swatchRing: "border-sky-200",
    embeddedNavActive: "bg-violet-100 text-violet-950 shadow-sm",
    embeddedPeriodActive: "bg-white text-sky-900 shadow-md ring-1 ring-white/90",
    chartGridLine: "stroke-stone-200",
    chartAxisLine: "stroke-stone-300",
    chartLine: "stroke-indigo-600",
    chartPoint: "fill-indigo-700",
    chartPointHover: "fill-indigo-900",
    chartArea: "fill-indigo-600/15",
    widgetListShell:
      "overflow-hidden rounded-xl border border-stone-200 bg-white",
    widgetListDivide: "divide-stone-200",
    widgetListHeader: "border-b border-stone-200 bg-stone-50",
    widgetListDivideLight: "divide-stone-100",
    widgetListColDivide: "divide-stone-200",
    widgetListRow: "bg-white",
    widgetListRowAlt: "bg-violet-50/80",
    operationsListHover: "hover:bg-sky-50/65",
    operationsListSelected: "bg-violet-100",
    tableRowSelected: "bg-violet-100",
    tableRowSelectedInset: "shadow-[inset_3px_0_0_0_rgb(79,70,229)]",
    detailPanelBorder: "border-sky-200",
    detailSectionLabel: "text-sky-700",
    linkAccent: "text-sky-700",
    linkAccentHover: "hover:text-sky-900",
    kpiEmptyState: "border-sky-300 bg-sky-50/30",
    attentionMetricTile: "border-sky-300 bg-sky-50",
    attentionMetricTileIdle: "border-sky-300 bg-sky-50",
    operationsSummaryChip:
      "rounded-full border border-sky-100 bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-ink-muted shadow-sm",
    toolbarDivider: "border-sky-100/80",
    formAccent: "accent-sky-600",
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
