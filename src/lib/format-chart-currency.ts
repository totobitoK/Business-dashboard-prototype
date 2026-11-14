/** Whole dollars stay whole. Amounts with cents keep two decimal places. */
export function formatDashboardMoney(amount: number, currency = "USD"): string {
  const cents = Math.round(Math.abs(amount) * 100) % 100 !== 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  }).format(amount);
}

/** Full USD for chart labels (no k/M abbreviation). */
export function formatChartCurrency(amount: number): string {
  return formatDashboardMoney(amount);
}

const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/** One share of the axis, rounded up to a readable money step. */
function chartYStep(maxValue: number, divisions: number): number {
  if (!(maxValue > 0)) return 100;
  const rough = maxValue / divisions;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const nice = NICE_STEPS.find((step) => step >= normalized - 1e-9) ?? 10;
  return Math.max(1, Math.round(nice * magnitude));
}

/** Even labels up to a ceiling above the peak. Three labels for $2,800 are $1,000, $2,000, $3,000. */
export function chartYAxisTicks(maxValue: number, count: 2 | 3 = 3): number[] {
  const step = chartYStep(maxValue, count);
  return Array.from({ length: count }, (_, index) => step * (index + 1));
}

/** Top axis label, which is also the plot ceiling. */
export function chartYAxisMax(maxValue: number, count: 2 | 3 = 3): number {
  const ticks = chartYAxisTicks(maxValue, count);
  return ticks[ticks.length - 1] ?? 0;
}
