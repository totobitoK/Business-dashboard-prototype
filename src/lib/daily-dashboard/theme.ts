/** Saved appearance ids stay purple / forest / ocean. Names are the new themes. */
export const DAILY_THEME_IDS = ["purple", "forest", "ocean"] as const;

export type DailyThemeId = (typeof DAILY_THEME_IDS)[number];

export type DailyTheme = {
  id: DailyThemeId;
  name: string;
  description: string;
  swatches: string[];
  swatchRing: string;
  canvas: string;
  text: string;
  muted: string;
  subtle: string;
  sidebar: string;
  navIdle: string;
  navActive: string;
  focus: string;
  header: string;
  card: string;
  nested: string;
  row: string;
  rowAlt: string;
  figure: string;
  link: string;
  chartLine: string;
  chartArea: string;
  chartGrid: string;
  chartAxis: string;
  chartPoint: string;
  chartLabel: string;
  menu: string;
  attention: string;
  healthy: string;
  warning: string;
  badge: string;
  input: string;
  divider: string;
};

const focus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

export const DAILY_THEMES: DailyTheme[] = [
  {
    id: "purple",
    name: "RavenView Indigo",
    description: "Graphite canvas, charcoal cards, and a violet collections line.",
    swatches: ["#12141A", "#2A2440", "#A78BFA"],
    swatchRing: "ring-violet-300",
    canvas: "bg-[#12141a] text-zinc-100",
    text: "text-zinc-100",
    muted: "text-zinc-400",
    subtle: "text-zinc-500",
    sidebar: "border-r border-white/10 bg-[#171924] text-zinc-100",
    navIdle: "text-zinc-300 hover:bg-white/5 hover:text-white",
    navActive: "bg-violet-400/15 text-violet-100",
    focus: `${focus} focus-visible:ring-violet-300 focus-visible:ring-offset-[#12141a]`,
    header:
      "relative overflow-hidden border-b border-white/10 bg-[#221c38] text-white shadow-[0_0_42px_rgba(139,92,246,0.28)] before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_at_top_left,rgba(167,139,250,0.5),transparent_58%)]",
    card: "rounded-2xl border border-white/10 bg-[#1c1f2a] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
    nested: "rounded-xl border border-white/10 bg-white/[0.03]",
    row: "bg-white/[0.04]",
    rowAlt: "bg-violet-400/[0.07]",
    figure: "text-white",
    link: "font-semibold text-violet-200 hover:text-white",
    chartLine: "stroke-violet-400",
    chartArea: "fill-violet-400/25",
    chartGrid: "stroke-white/10",
    chartAxis: "stroke-white/20",
    chartPoint: "fill-violet-200",
    chartLabel: "fill-zinc-400",
    menu: "rounded-xl border border-white/10 bg-[#1c1f2a] shadow-xl",
    attention: "border-amber-300/40 bg-amber-400/10 text-amber-50",
    healthy: "text-emerald-200",
    warning: "text-amber-200",
    badge: "bg-white/10 text-violet-100 ring-1 ring-white/15",
    input:
      "border-white/15 bg-[#12141a] text-zinc-100 focus:border-violet-300/70 focus:ring-violet-400/30",
    divider: "border-white/10",
  },
  {
    id: "forest",
    name: "Evergreen Slate",
    description: "Deep slate canvas, a pine sidebar, and a muted jade line.",
    swatches: ["#121816", "#1B3A2F", "#6EE7B7"],
    swatchRing: "ring-emerald-300",
    canvas: "bg-[#121816] text-zinc-100",
    text: "text-zinc-100",
    muted: "text-zinc-400",
    subtle: "text-zinc-500",
    sidebar: "border-r border-emerald-300/10 bg-[#15241c] text-zinc-100",
    navIdle: "text-zinc-300 hover:bg-white/5 hover:text-white",
    navActive: "bg-emerald-300/15 text-emerald-50",
    focus: `${focus} focus-visible:ring-emerald-300 focus-visible:ring-offset-[#121816]`,
    header: "relative overflow-hidden border-b border-white/10 bg-[#15241c] text-white",
    card: "rounded-2xl border border-white/10 bg-[#1c2422] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
    nested: "rounded-xl border border-white/10 bg-white/[0.03]",
    row: "bg-white/[0.04]",
    rowAlt: "bg-emerald-300/[0.08]",
    figure: "text-white",
    link: "font-semibold text-emerald-100 hover:text-white",
    chartLine: "stroke-emerald-300",
    chartArea: "fill-emerald-300/20",
    chartGrid: "stroke-white/10",
    chartAxis: "stroke-white/20",
    chartPoint: "fill-emerald-100",
    chartLabel: "fill-zinc-400",
    menu: "rounded-xl border border-white/10 bg-[#1c2422] shadow-xl",
    attention: "border-amber-300/40 bg-amber-400/10 text-amber-50",
    healthy: "text-emerald-200",
    warning: "text-amber-200",
    badge: "bg-white/10 text-emerald-50 ring-1 ring-white/15",
    input:
      "border-white/15 bg-[#121816] text-zinc-100 focus:border-emerald-300/70 focus:ring-emerald-300/30",
    divider: "border-white/10",
  },
  {
    id: "ocean",
    name: "Porcelain",
    description: "Warm off-white canvas, white cards, and an indigo collections line.",
    swatches: ["#F7F4EF", "#FFFFFF", "#4F46E5"],
    swatchRing: "ring-indigo-300",
    canvas: "bg-[#f7f4ef] text-zinc-900",
    text: "text-zinc-900",
    muted: "text-zinc-600",
    subtle: "text-zinc-500",
    sidebar: "border-r border-stone-200 bg-[#fbfaf7] text-zinc-900",
    navIdle: "text-zinc-600 hover:bg-violet-50 hover:text-zinc-900",
    navActive: "bg-violet-100 text-violet-950",
    focus: `${focus} focus-visible:ring-indigo-500 focus-visible:ring-offset-[#f7f4ef]`,
    header: "relative overflow-hidden border-b border-stone-200 bg-white text-zinc-900",
    card: "rounded-2xl border border-stone-200 bg-white shadow-sm",
    nested: "rounded-xl border border-stone-200 bg-stone-50",
    row: "bg-violet-50/70",
    rowAlt: "bg-white",
    figure: "text-zinc-950",
    link: "font-semibold text-indigo-700 hover:text-indigo-950",
    chartLine: "stroke-indigo-600",
    chartArea: "fill-indigo-600/15",
    chartGrid: "stroke-stone-200",
    chartAxis: "stroke-stone-300",
    chartPoint: "fill-indigo-700",
    chartLabel: "fill-zinc-500",
    menu: "rounded-xl border border-stone-200 bg-white shadow-lg",
    attention: "border-amber-300 bg-amber-50 text-amber-950",
    healthy: "text-emerald-800",
    warning: "text-amber-900",
    badge: "bg-violet-50 text-violet-900 ring-1 ring-violet-100",
    input:
      "border-stone-300 bg-white text-zinc-900 focus:border-indigo-400 focus:ring-indigo-200",
    divider: "border-stone-200",
  },
];

const LEGACY_THEME_IDS: Record<string, DailyThemeId> = {
  purple: "purple",
  forest: "forest",
  ocean: "ocean",
  indigo: "purple",
  evergreen: "forest",
  porcelain: "ocean",
};

export function resolveDailyTheme(themeId: string | null | undefined): DailyTheme {
  const id = LEGACY_THEME_IDS[themeId ?? ""] ?? "purple";
  return DAILY_THEMES.find((theme) => theme.id === id) ?? DAILY_THEMES[0]!;
}
