/** Saved appearance ids stay purple / forest / ocean. Harbor, carbon, and ash are additional. */
export const DAILY_THEME_IDS = ["purple", "forest", "ocean", "harbor", "carbon", "ash"] as const;

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
    name: "Espresso",
    description: "Warm ivory canvas, white cards, and an espresso collections line.",
    swatches: ["#F7F3EE", "#FFFFFF", "#3C2A1E"],
    swatchRing: "ring-stone-300",
    canvas: "bg-[#f3eee6] text-zinc-900",
    text: "text-zinc-900",
    muted: "text-zinc-600",
    subtle: "text-zinc-500",
    sidebar: "border-r border-stone-200 bg-[#f7f3ee] text-zinc-900",
    navIdle: "text-zinc-600 hover:bg-[#f3ece4] hover:text-zinc-900",
    navActive: "bg-[#3c2a1e] text-[#f7f3ee]",
    focus: `${focus} focus-visible:ring-[#6b4f3a] focus-visible:ring-offset-[#f7f3ee]`,
    header: "relative overflow-hidden bg-gradient-to-b from-[#f7f3ee] to-transparent text-zinc-900",
    card: "rounded-2xl border border-stone-200 bg-white shadow-sm",
    nested: "rounded-xl border border-stone-200 bg-[#f7f3ee]",
    row: "bg-[#f7f3ee]",
    rowAlt: "bg-white",
    figure: "text-[#3c2a1e]",
    link: "font-semibold text-[#6b4f3a] hover:text-[#3c2a1e]",
    chartLine: "stroke-[#6b4f3a]",
    chartArea: "fill-[#6b4f3a]/15",
    chartGrid: "stroke-stone-200",
    chartAxis: "stroke-stone-300",
    chartPoint: "fill-[#6b4f3a]",
    chartLabel: "fill-zinc-500",
    menu: "rounded-xl border border-stone-200 bg-white shadow-lg",
    attention: "border-amber-300 bg-amber-50 text-amber-950",
    healthy: "text-emerald-800",
    warning: "text-amber-900",
    badge: "bg-[#f3ece4] text-[#3c2a1e] ring-1 ring-stone-200",
    input:
      "border-stone-300 bg-white text-zinc-900 focus:border-[#c4b2a0] focus:ring-[#6b4f3a]/20",
    divider: "border-stone-200",
  },
  {
    id: "harbor",
    name: "Harbor",
    description: "Cool off-white canvas, white cards, and a navy collections line.",
    swatches: ["#F4F7FB", "#FFFFFF", "#1E3A5F"],
    swatchRing: "ring-[#b7c6d6]",
    canvas: "bg-[#f4f7fb] text-zinc-900",
    text: "text-zinc-900",
    muted: "text-zinc-600",
    subtle: "text-zinc-500",
    sidebar: "border-r border-[#d5dee8] bg-[#f4f7fb] text-zinc-900",
    navIdle: "text-zinc-600 hover:bg-[#e7eef5] hover:text-zinc-900",
    navActive: "bg-[#1e3a5f] text-[#f4f7fb]",
    focus: `${focus} focus-visible:ring-[#1e3a5f] focus-visible:ring-offset-[#f4f7fb]`,
    header: "relative overflow-hidden bg-gradient-to-b from-[#f4f7fb] to-transparent text-zinc-900",
    card: "rounded-2xl border border-[#d5dee8] bg-white shadow-sm",
    nested: "rounded-xl border border-[#d5dee8] bg-[#f4f7fb]",
    row: "bg-[#f4f7fb]",
    rowAlt: "bg-white",
    figure: "text-[#1e3a5f]",
    link: "font-semibold text-[#3d5a80] hover:text-[#1e3a5f]",
    chartLine: "stroke-[#1e3a5f]",
    chartArea: "fill-[#1e3a5f]/15",
    chartGrid: "stroke-[#d5dee8]",
    chartAxis: "stroke-[#b7c6d6]",
    chartPoint: "fill-[#1e3a5f]",
    chartLabel: "fill-zinc-500",
    menu: "rounded-xl border border-[#d5dee8] bg-white shadow-lg",
    attention: "border-[#b7c6d6] bg-[#e7eef5] text-[#1e3a5f]",
    healthy: "text-emerald-800",
    warning: "text-[#5d7a96]",
    badge: "bg-[#e7eef5] text-[#1e3a5f] ring-1 ring-[#d5dee8]",
    input: "border-[#d5dee8] bg-white text-zinc-900 focus:border-[#8aa4c0] focus:ring-[#1e3a5f]/20",
    divider: "border-[#d5dee8]",
  },
  {
    id: "carbon",
    name: "Carbon",
    description: "Near-black canvas, graphite cards, and a bone collections line.",
    swatches: ["#141414", "#1E1E1E", "#E7E2D8"],
    swatchRing: "ring-[#5c5852]",
    canvas: "bg-[#141414] text-zinc-100",
    text: "text-zinc-100",
    muted: "text-zinc-400",
    subtle: "text-zinc-500",
    sidebar: "border-r border-white/10 bg-[#141414] text-zinc-100",
    navIdle: "text-zinc-300 hover:bg-white/5 hover:text-white",
    navActive: "bg-[#e7e2d8] text-[#1a1a1a]",
    focus: `${focus} focus-visible:ring-[#e7e2d8] focus-visible:ring-offset-[#141414]`,
    header: "relative overflow-hidden bg-gradient-to-b from-[#3a3835] to-transparent text-white",
    card: "rounded-2xl border border-white/10 bg-[#1c1c1c] shadow-sm",
    nested: "rounded-xl border border-white/10 bg-[#1e1e1e]",
    row: "bg-white/[0.04]",
    rowAlt: "bg-[#e7e2d8]/10",
    figure: "text-[#f4f1ea]",
    link: "font-semibold text-[#e7e2d8] hover:text-white",
    chartLine: "stroke-[#e7e2d8]",
    chartArea: "fill-[#e7e2d8]/20",
    chartGrid: "stroke-white/10",
    chartAxis: "stroke-white/20",
    chartPoint: "fill-[#f4f1ea]",
    chartLabel: "fill-zinc-400",
    menu: "rounded-xl border border-white/10 bg-[#1c1c1c] shadow-xl",
    attention: "border-[#b7aea3]/40 bg-[#b7aea3]/10 text-[#d6cfc4]",
    healthy: "text-emerald-200",
    warning: "text-[#b7aea3]",
    badge: "bg-white/10 text-[#f4f1ea] ring-1 ring-white/15",
    input: "border-white/15 bg-[#141414] text-zinc-100 focus:border-[#e7e2d8]/70 focus:ring-[#e7e2d8]/30",
    divider: "border-white/10",
  },
  {
    id: "ash",
    name: "Ash",
    description: "Cool gray canvas, white cards, and a charcoal collections line.",
    swatches: ["#F3F4F6", "#FFFFFF", "#2C2C2C"],
    swatchRing: "ring-zinc-300",
    canvas: "bg-[#f3f4f6] text-zinc-900",
    text: "text-zinc-900",
    muted: "text-zinc-600",
    subtle: "text-zinc-500",
    sidebar: "border-r border-zinc-200 bg-[#f3f4f6] text-zinc-900",
    navIdle: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
    navActive: "bg-[#2c2c2c] text-[#f4f4f5]",
    focus: `${focus} focus-visible:ring-[#2c2c2c] focus-visible:ring-offset-[#f3f4f6]`,
    header: "relative overflow-hidden bg-gradient-to-b from-[#f3f4f6] to-transparent text-zinc-900",
    card: "rounded-2xl border border-zinc-200 bg-white shadow-sm",
    nested: "rounded-xl border border-zinc-200 bg-[#f3f4f6]",
    row: "bg-[#f3f4f6]",
    rowAlt: "bg-white",
    figure: "text-[#2c2c2c]",
    link: "font-semibold text-[#4b5563] hover:text-[#2c2c2c]",
    chartLine: "stroke-[#4b5563]",
    chartArea: "fill-[#4b5563]/15",
    chartGrid: "stroke-zinc-200",
    chartAxis: "stroke-zinc-300",
    chartPoint: "fill-[#4b5563]",
    chartLabel: "fill-zinc-500",
    menu: "rounded-xl border border-zinc-200 bg-white shadow-lg",
    attention: "border-zinc-300 bg-zinc-100 text-[#2c2c2c]",
    healthy: "text-emerald-800",
    warning: "text-[#6b7280]",
    badge: "bg-zinc-100 text-[#2c2c2c] ring-1 ring-zinc-200",
    input: "border-zinc-300 bg-white text-zinc-900 focus:border-zinc-400 focus:ring-[#2c2c2c]/20",
    divider: "border-zinc-200",
  },
];

const LEGACY_THEME_IDS: Record<string, DailyThemeId> = {
  purple: "purple",
  forest: "forest",
  ocean: "ocean",
  indigo: "purple",
  evergreen: "forest",
  porcelain: "ocean",
  espresso: "ocean",
  harbor: "harbor",
  carbon: "carbon",
  ash: "ash",
};

export function resolveDailyTheme(themeId: string | null | undefined): DailyTheme {
  const id = LEGACY_THEME_IDS[themeId ?? ""] ?? "purple";
  return DAILY_THEMES.find((theme) => theme.id === id) ?? DAILY_THEMES[0]!;
}
