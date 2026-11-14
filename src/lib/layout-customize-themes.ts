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
  /** Color and light behind the frosted dashboard surface. */
  dashboardAtmosphere: string;
  /** Translucent glass over `dashboardAtmosphere`, behind the section cards. */
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
  /** Past-due invoice label. Light on dark themes, deep on Espresso. */
  pastDue: string;
  /** Past-due status chip in the invoice table. */
  pastDuePill: string;
  /** Theme picker strip. Light themes need this because their header fades out. */
  pickerBar?: string;
};

export function isLightDashboardTheme(id: string): boolean {
  return id === "ocean" || id === "harbor" || id === "ash";
}

export const LAYOUT_CUSTOMIZE_THEMES: LayoutCustomizeTheme[] = [
  {
    id: "purple",
    scopeClass: "rv-theme-indigo",
    name: "RavenView Indigo",
    card: "border border-purple-300 bg-white shadow-card",
    header: "relative overflow-hidden bg-gradient-to-b from-[#221c38] to-transparent text-white before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_at_top_left,rgba(167,139,250,0.55),transparent_58%)]",
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
    dashboardAtmosphere:
      "bg-[#1a1430] bg-[radial-gradient(ellipse_at_32%_12%,rgba(196,181,253,0.85),transparent_36%),radial-gradient(ellipse_at_82%_18%,rgba(129,140,248,0.7),transparent_34%),radial-gradient(ellipse_at_58%_78%,rgba(167,139,250,0.62),transparent_40%),radial-gradient(ellipse_at_12%_70%,rgba(139,92,246,0.45),transparent_36%)]",
    dashboardCanvas: "",
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
    pastDue: "text-violet-400",
    pastDuePill: "border-violet-300/40 bg-violet-400/15 text-violet-300",
  },
  {
    id: "forest",
    scopeClass: "rv-theme-evergreen",
    name: "Evergreen Slate",
    card: "border border-emerald-300 bg-white shadow-card",
    header: "relative overflow-hidden bg-gradient-to-b from-[#6ee7b7] via-[#1a7a5c] to-transparent text-white",
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
    dashboardAtmosphere:
      "bg-[#10211a] bg-[radial-gradient(ellipse_at_30%_10%,rgba(110,231,183,0.8),transparent_36%),radial-gradient(ellipse_at_84%_16%,rgba(52,211,153,0.62),transparent_34%),radial-gradient(ellipse_at_60%_80%,rgba(16,185,129,0.55),transparent_40%),radial-gradient(ellipse_at_10%_72%,rgba(45,212,191,0.4),transparent_36%)]",
    dashboardCanvas: "",
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
    detailSectionLabel: "text-emerald-300",
    linkAccent: "text-emerald-300",
    linkAccentHover: "hover:text-emerald-100",
    kpiEmptyState: "border-emerald-300 bg-emerald-100/30",
    attentionMetricTile: "border-emerald-300 bg-emerald-100/50",
    attentionMetricTileIdle: "border-emerald-300 bg-emerald-100/50",
    operationsSummaryChip:
      "rounded-full border border-emerald-100 bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-ink-muted shadow-sm",
    toolbarDivider: "border-emerald-100/80",
    formAccent: "accent-emerald-600",
    pastDue: "text-emerald-300",
    pastDuePill: "border-emerald-300/40 bg-emerald-300/10 text-emerald-200",
  },
  {
    id: "ocean",
    scopeClass: "rv-theme-porcelain",
    name: "Espresso",
    card: "border border-stone-200 bg-white shadow-card",
    header: "relative overflow-hidden bg-gradient-to-b from-[#f7f3ee] to-transparent text-zinc-900",
    headerText: "text-zinc-900",
    headerLink: "text-zinc-700 hover:bg-[#f3ece4] hover:text-zinc-950",
    headerQuiet: "text-zinc-500 hover:bg-[#f3ece4] hover:text-zinc-900",
    badge: "bg-[#f3ece4] text-[#3c2a1e]",
    badgeText: "text-[#3c2a1e]",
    sidebar: "bg-[#f3ece4]/80",
    navActive: "bg-[#3c2a1e] text-[#f7f3ee]",
    navInactive: "bg-white/80 text-ink",
    metricA: "border border-stone-200 bg-white",
    metricB: "border border-stone-200 bg-[#f7f3ee]",
    metricValueA: "text-[#3c2a1e]",
    metricValueB: "text-[#3c2a1e]",
    chartPanel: "border border-stone-200 bg-white/90",
    chartBar: "bg-[#c4b2a0]",
    chartBarHi: "bg-[#6b4f3a]",
    listPanel: "border border-stone-200 bg-[#f7f3ee]/70",
    listRow: "border border-stone-200 bg-white",
    listAccent: "text-[#6b4f3a]",
    dashboardAtmosphere:
      "bg-[#f3eee6] bg-[radial-gradient(ellipse_at_50%_0%,rgba(232,220,204,0.9),transparent_42%)]",
    dashboardCanvas: "",
    sectionPanel: "rounded-2xl border border-stone-200 bg-white shadow-sm",
    sectionHeader: "border-b border-stone-200",
    filterTrack:
      "rounded-xl bg-[#f7f3ee]/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] ring-1 ring-stone-200/80",
    filterControl:
      "border border-stone-200 bg-white text-zinc-800 shadow-sm hover:border-stone-300 focus:border-[#c4b2a0] focus:outline-none focus:ring-2 focus:ring-[#6b4f3a]/15",
    filterChevron: "text-[#6b4f3a]/50",
    filterLabel: "text-ink-subtle",
    filterChipActive: "bg-white text-[#3c2a1e] shadow-sm ring-1 ring-stone-200",
    filterChipIdle: "text-ink-muted hover:bg-white/50 hover:text-ink",
    filterSecondaryButton:
      "border border-stone-200 bg-white text-zinc-800 shadow-sm hover:border-stone-300 hover:bg-[#f7f3ee]",
    filterMenuPanel:
      "rounded-xl border border-stone-200 bg-white py-1 shadow-[0_12px_32px_-12px_rgba(60,42,30,0.18)] ring-1 ring-stone-100",
    filterMenuItemActive: "bg-[#f3ece4] text-[#3c2a1e]",
    filterMenuItemIdle: "text-ink hover:bg-[#f7f3ee]",
    swatches: ["#F7F3EE", "#FFFFFF", "#3C2A1E"],
    swatchRing: "border-stone-300",
    embeddedNavActive: "bg-[#3c2a1e] text-[#f7f3ee] shadow-sm",
    embeddedPeriodActive: "bg-white text-[#3c2a1e] shadow-md ring-1 ring-stone-200",
    chartGridLine: "stroke-stone-200",
    chartAxisLine: "stroke-stone-300",
    chartLine: "stroke-[#6b4f3a]",
    chartPoint: "fill-[#6b4f3a]",
    chartPointHover: "fill-[#3c2a1e]",
    chartArea: "fill-[#6b4f3a]/15",
    widgetListShell:
      "overflow-hidden rounded-xl border border-stone-200 bg-white",
    widgetListDivide: "divide-stone-200",
    widgetListHeader: "border-b border-stone-200 bg-[#f7f3ee]",
    widgetListDivideLight: "divide-stone-100",
    widgetListColDivide: "divide-stone-200",
    widgetListRow: "bg-white",
    widgetListRowAlt: "bg-[#f7f3ee]",
    operationsListHover: "hover:bg-[#f7f3ee]",
    operationsListSelected: "bg-[#f3ece4]",
    tableRowSelected: "bg-[#f3ece4]",
    tableRowSelectedInset: "shadow-[inset_3px_0_0_0_#6b4f3a]",
    detailPanelBorder: "border-stone-200",
    detailSectionLabel: "text-[#6b4f3a]",
    linkAccent: "text-[#6b4f3a]",
    linkAccentHover: "hover:text-[#3c2a1e]",
    kpiEmptyState: "border-stone-300 bg-[#f7f3ee]/60",
    attentionMetricTile: "border-stone-300 bg-[#f7f3ee]",
    attentionMetricTileIdle: "border-stone-300 bg-[#f7f3ee]",
    operationsSummaryChip:
      "rounded-full border border-stone-200 bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-ink-muted shadow-sm",
    toolbarDivider: "border-stone-200",
    formAccent: "accent-[#6b4f3a]",
    pastDue: "text-[#a6846a]",
    pastDuePill: "border-[#c4b2a0] bg-[#f3ece4] text-[#8b6b52]",
    pickerBar: "bg-gradient-to-r from-[#f7f3ee] via-[#cbbba8] to-[#3c2a1e]",
  },
  {
    id: "harbor",
    scopeClass: "rv-theme-harbor",
    name: "Harbor",
    card: "border border-[#d5dee8] bg-white shadow-card",
    header: "relative overflow-hidden bg-gradient-to-b from-[#f4f7fb] to-transparent text-zinc-900",
    headerText: "text-zinc-900",
    headerLink: "text-zinc-700 hover:bg-[#e7eef5] hover:text-zinc-950",
    headerQuiet: "text-zinc-500 hover:bg-[#e7eef5] hover:text-zinc-900",
    badge: "bg-[#e7eef5] text-[#1e3a5f]",
    badgeText: "text-[#1e3a5f]",
    sidebar: "bg-[#e7eef5]/80",
    navActive: "bg-[#1e3a5f] text-[#f4f7fb]",
    navInactive: "bg-white/80 text-ink",
    metricA: "border border-[#d5dee8] bg-white",
    metricB: "border border-[#d5dee8] bg-[#f4f7fb]",
    metricValueA: "text-[#1e3a5f]",
    metricValueB: "text-[#1e3a5f]",
    chartPanel: "border border-[#d5dee8] bg-white/90",
    chartBar: "bg-[#b7c6d6]",
    chartBarHi: "bg-[#1e3a5f]",
    listPanel: "border border-[#d5dee8] bg-[#f4f7fb]/70",
    listRow: "border border-[#d5dee8] bg-white",
    listAccent: "text-[#3d5a80]",
    dashboardAtmosphere:
      "bg-[#f4f7fb] bg-[radial-gradient(ellipse_at_50%_0%,rgba(214,224,236,0.95),transparent_42%)]",
    dashboardCanvas: "",
    sectionPanel: "rounded-2xl border border-[#d5dee8] bg-white shadow-sm",
    sectionHeader: "border-b border-[#d5dee8]",
    filterTrack:
      "rounded-xl bg-[#f4f7fb]/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] ring-1 ring-[#d5dee8]",
    filterControl:
      "border border-[#d5dee8] bg-white text-zinc-800 shadow-sm hover:border-[#b7c6d6] focus:border-[#8aa4c0] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/15",
    filterChevron: "text-[#3d5a80]/50",
    filterLabel: "text-ink-subtle",
    filterChipActive: "bg-white text-[#1e3a5f] shadow-sm ring-1 ring-[#d5dee8]",
    filterChipIdle: "text-ink-muted hover:bg-white/50 hover:text-ink",
    filterSecondaryButton:
      "border border-[#d5dee8] bg-white text-zinc-800 shadow-sm hover:border-[#b7c6d6] hover:bg-[#f4f7fb]",
    filterMenuPanel:
      "rounded-xl border border-[#d5dee8] bg-white py-1 shadow-[0_12px_32px_-12px_rgba(30,58,95,0.18)] ring-1 ring-[#e7eef5]",
    filterMenuItemActive: "bg-[#e7eef5] text-[#1e3a5f]",
    filterMenuItemIdle: "text-ink hover:bg-[#f4f7fb]",
    swatches: ["#F4F7FB", "#FFFFFF", "#1E3A5F"],
    swatchRing: "border-[#b7c6d6]",
    embeddedNavActive: "bg-[#1e3a5f] text-[#f4f7fb] shadow-sm",
    embeddedPeriodActive: "bg-white text-[#1e3a5f] shadow-md ring-1 ring-[#d5dee8]",
    chartGridLine: "stroke-[#d5dee8]",
    chartAxisLine: "stroke-[#b7c6d6]",
    chartLine: "stroke-[#1e3a5f]",
    chartPoint: "fill-[#1e3a5f]",
    chartPointHover: "fill-[#16304f]",
    chartArea: "fill-[#1e3a5f]/15",
    widgetListShell: "overflow-hidden rounded-xl border border-[#d5dee8] bg-white",
    widgetListDivide: "divide-[#d5dee8]",
    widgetListHeader: "border-b border-[#d5dee8] bg-[#f4f7fb]",
    widgetListDivideLight: "divide-[#e7eef5]",
    widgetListColDivide: "divide-[#d5dee8]",
    widgetListRow: "bg-white",
    widgetListRowAlt: "bg-[#f4f7fb]",
    operationsListHover: "hover:bg-[#f4f7fb]",
    operationsListSelected: "bg-[#e7eef5]",
    tableRowSelected: "bg-[#e7eef5]",
    tableRowSelectedInset: "shadow-[inset_3px_0_0_0_#1e3a5f]",
    detailPanelBorder: "border-[#d5dee8]",
    detailSectionLabel: "text-[#3d5a80]",
    linkAccent: "text-[#3d5a80]",
    linkAccentHover: "hover:text-[#1e3a5f]",
    kpiEmptyState: "border-[#b7c6d6] bg-[#f4f7fb]/70",
    attentionMetricTile: "border-[#b7c6d6] bg-[#f4f7fb]",
    attentionMetricTileIdle: "border-[#b7c6d6] bg-[#f4f7fb]",
    operationsSummaryChip:
      "rounded-full border border-[#d5dee8] bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-ink-muted shadow-sm",
    toolbarDivider: "border-[#d5dee8]",
    formAccent: "accent-[#1e3a5f]",
    pastDue: "text-[#5d7a96]",
    pastDuePill: "border-[#b7c6d6] bg-[#e7eef5] text-[#3d5a80]",
    pickerBar: "bg-gradient-to-r from-[#f4f7fb] via-[#8aa4c0] to-[#1e3a5f]",
  },
  {
    id: "carbon",
    scopeClass: "rv-theme-carbon",
    name: "Carbon",
    card: "border border-white/10 bg-white shadow-card",
    header: "relative overflow-hidden bg-gradient-to-b from-[#3a3835] to-transparent text-white",
    headerText: "text-white",
    headerLink: "text-white/90 hover:bg-white/15",
    headerQuiet: "text-white/70 hover:bg-white/10 hover:text-white",
    badge: "bg-white/15",
    badgeText: "text-white",
    sidebar: "bg-white/5",
    navActive: "bg-[#e7e2d8] text-[#1a1a1a]",
    navInactive: "bg-white/10 text-ink",
    metricA: "border border-white/10 bg-[#1e1e1e]",
    metricB: "border border-white/10 bg-[#26231f]",
    metricValueA: "text-[#f4f1ea]",
    metricValueB: "text-[#e7e2d8]",
    chartPanel: "border border-white/10 bg-white/90",
    chartBar: "bg-[#5c5852]",
    chartBarHi: "bg-[#e7e2d8]",
    listPanel: "border border-white/10 bg-white/5",
    listRow: "border border-white/10 bg-[#1e1e1e]",
    listAccent: "text-[#e7e2d8]",
    dashboardAtmosphere:
      "bg-[#141414] bg-[radial-gradient(ellipse_at_50%_0%,rgba(231,226,216,0.22),transparent_42%)]",
    dashboardCanvas: "",
    sectionPanel: "rounded-2xl border border-white/10 bg-[#1c1c1c]",
    sectionHeader: "border-b border-white/10",
    filterTrack: "rounded-xl bg-transparent",
    filterControl:
      "border-transparent bg-transparent text-white shadow-none hover:bg-white/10 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#e7e2d8]/50",
    filterChevron: "text-white/70",
    filterLabel: "text-ink-subtle",
    filterChipActive: "bg-white/15 text-white",
    filterChipIdle: "text-zinc-300 hover:bg-white/10 hover:text-white",
    filterSecondaryButton:
      "border-transparent bg-transparent text-white shadow-none hover:bg-white/10",
    filterMenuPanel: "rounded-xl bg-[#1e1e1e] py-1 shadow-lg",
    filterMenuItemActive: "bg-white/15 text-white",
    filterMenuItemIdle: "text-zinc-200 hover:bg-white/10",
    swatches: ["#141414", "#1E1E1E", "#E7E2D8"],
    swatchRing: "border-[#5c5852]",
    embeddedNavActive: "bg-[#e7e2d8] text-[#1a1a1a] shadow-sm",
    embeddedPeriodActive: "bg-white text-[#1a1a1a] shadow-md ring-1 ring-white/80",
    chartGridLine: "stroke-white/10",
    chartAxisLine: "stroke-white/20",
    chartLine: "stroke-[#e7e2d8]",
    chartPoint: "fill-[#f4f1ea]",
    chartPointHover: "fill-white",
    chartArea: "fill-[#e7e2d8]/20",
    widgetListShell: "overflow-hidden rounded-xl border border-white/10 bg-[#1c1c1c]",
    widgetListDivide: "divide-white/10",
    widgetListHeader: "border-b border-white/10 bg-white/5",
    widgetListDivideLight: "divide-white/10",
    widgetListColDivide: "divide-white/10",
    widgetListRow: "bg-[#1e1e1e]",
    widgetListRowAlt: "bg-white/[0.04]",
    operationsListHover: "hover:bg-white/10",
    operationsListSelected: "bg-[#e7e2d8]/15",
    tableRowSelected: "bg-[#e7e2d8]/10",
    tableRowSelectedInset: "shadow-[inset_3px_0_0_0_#e7e2d8]",
    detailPanelBorder: "border-white/15",
    detailSectionLabel: "text-[#e7e2d8]",
    linkAccent: "text-[#e7e2d8]",
    linkAccentHover: "hover:text-white",
    kpiEmptyState: "border-white/15 bg-white/5",
    attentionMetricTile: "border-white/15 bg-white/5",
    attentionMetricTileIdle: "border-white/15 bg-white/5",
    operationsSummaryChip:
      "rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-ink-muted shadow-sm",
    toolbarDivider: "border-white/10",
    formAccent: "accent-[#e7e2d8]",
    pastDue: "text-[#b7aea3]",
    pastDuePill: "border-[#b7aea3]/40 bg-[#b7aea3]/10 text-[#d6cfc4]",
    pickerBar: "bg-gradient-to-r from-[#141414] via-[#3a3835] to-[#e7e2d8]",
  },
  {
    id: "ash",
    scopeClass: "rv-theme-ash",
    name: "Ash",
    card: "border border-zinc-200 bg-white shadow-card",
    header: "relative overflow-hidden bg-gradient-to-b from-[#f3f4f6] to-transparent text-zinc-900",
    headerText: "text-zinc-900",
    headerLink: "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950",
    headerQuiet: "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900",
    badge: "bg-zinc-100 text-[#2c2c2c]",
    badgeText: "text-[#2c2c2c]",
    sidebar: "bg-zinc-100/80",
    navActive: "bg-[#2c2c2c] text-[#f4f4f5]",
    navInactive: "bg-white/80 text-ink",
    metricA: "border border-zinc-200 bg-white",
    metricB: "border border-zinc-200 bg-[#f3f4f6]",
    metricValueA: "text-[#2c2c2c]",
    metricValueB: "text-[#2c2c2c]",
    chartPanel: "border border-zinc-200 bg-white/90",
    chartBar: "bg-[#c5c7cc]",
    chartBarHi: "bg-[#2c2c2c]",
    listPanel: "border border-zinc-200 bg-[#f3f4f6]/70",
    listRow: "border border-zinc-200 bg-white",
    listAccent: "text-[#4b5563]",
    dashboardAtmosphere:
      "bg-[#f3f4f6] bg-[radial-gradient(ellipse_at_50%_0%,rgba(220,222,226,0.95),transparent_42%)]",
    dashboardCanvas: "",
    sectionPanel: "rounded-2xl border border-zinc-200 bg-white shadow-sm",
    sectionHeader: "border-b border-zinc-200",
    filterTrack:
      "rounded-xl bg-[#f3f4f6]/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] ring-1 ring-zinc-200",
    filterControl:
      "border border-zinc-200 bg-white text-zinc-800 shadow-sm hover:border-zinc-300 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#2c2c2c]/15",
    filterChevron: "text-[#4b5563]/50",
    filterLabel: "text-ink-subtle",
    filterChipActive: "bg-white text-[#2c2c2c] shadow-sm ring-1 ring-zinc-200",
    filterChipIdle: "text-ink-muted hover:bg-white/50 hover:text-ink",
    filterSecondaryButton:
      "border border-zinc-200 bg-white text-zinc-800 shadow-sm hover:border-zinc-300 hover:bg-[#f3f4f6]",
    filterMenuPanel:
      "rounded-xl border border-zinc-200 bg-white py-1 shadow-[0_12px_32px_-12px_rgba(44,44,44,0.18)] ring-1 ring-zinc-100",
    filterMenuItemActive: "bg-zinc-100 text-[#2c2c2c]",
    filterMenuItemIdle: "text-ink hover:bg-[#f3f4f6]",
    swatches: ["#F3F4F6", "#FFFFFF", "#2C2C2C"],
    swatchRing: "border-zinc-300",
    embeddedNavActive: "bg-[#2c2c2c] text-[#f4f4f5] shadow-sm",
    embeddedPeriodActive: "bg-white text-[#2c2c2c] shadow-md ring-1 ring-zinc-200",
    chartGridLine: "stroke-zinc-200",
    chartAxisLine: "stroke-zinc-300",
    chartLine: "stroke-[#4b5563]",
    chartPoint: "fill-[#4b5563]",
    chartPointHover: "fill-[#2c2c2c]",
    chartArea: "fill-[#4b5563]/15",
    widgetListShell: "overflow-hidden rounded-xl border border-zinc-200 bg-white",
    widgetListDivide: "divide-zinc-200",
    widgetListHeader: "border-b border-zinc-200 bg-[#f3f4f6]",
    widgetListDivideLight: "divide-zinc-100",
    widgetListColDivide: "divide-zinc-200",
    widgetListRow: "bg-white",
    widgetListRowAlt: "bg-[#f3f4f6]",
    operationsListHover: "hover:bg-[#f3f4f6]",
    operationsListSelected: "bg-zinc-100",
    tableRowSelected: "bg-zinc-100",
    tableRowSelectedInset: "shadow-[inset_3px_0_0_0_#2c2c2c]",
    detailPanelBorder: "border-zinc-200",
    detailSectionLabel: "text-[#4b5563]",
    linkAccent: "text-[#4b5563]",
    linkAccentHover: "hover:text-[#2c2c2c]",
    kpiEmptyState: "border-zinc-300 bg-[#f3f4f6]/70",
    attentionMetricTile: "border-zinc-300 bg-[#f3f4f6]",
    attentionMetricTileIdle: "border-zinc-300 bg-[#f3f4f6]",
    operationsSummaryChip:
      "rounded-full border border-zinc-200 bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-ink-muted shadow-sm",
    toolbarDivider: "border-zinc-200",
    formAccent: "accent-[#2c2c2c]",
    pastDue: "text-[#6b7280]",
    pastDuePill: "border-zinc-300 bg-zinc-100 text-[#4b5563]",
    pickerBar: "bg-gradient-to-r from-[#f3f4f6] via-[#9ca3af] to-[#2c2c2c]",
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
