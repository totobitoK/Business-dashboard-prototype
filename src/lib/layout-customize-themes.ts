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
  swatches: string[];
  swatchRing: string;
};

export const LAYOUT_CUSTOMIZE_THEMES: LayoutCustomizeTheme[] = [
  {
    id: "purple",
    name: "RavenView purple",
    card: "border border-purple-200 bg-gradient-to-br from-purple-50/80 via-white to-violet-50/50 shadow-card",
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
    swatches: ["#7C3AED", "#18181B", "#F3E8FF"],
    swatchRing: "border-purple-200",
  },
  {
    id: "forest",
    name: "Forest & slate",
    card: "border border-emerald-200 bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/40 shadow-card",
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
    swatches: ["#059669", "#134E4A", "#D1FAE5"],
    swatchRing: "border-emerald-200",
  },
  {
    id: "ocean",
    name: "Ocean & ink",
    card: "border border-sky-200 bg-gradient-to-br from-sky-50/90 via-white to-indigo-50/40 shadow-card",
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
    swatches: ["#0284C7", "#0F172A", "#E0F2FE"],
    swatchRing: "border-sky-200",
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
