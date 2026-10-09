/** Full USD for chart labels (no k/M abbreviation). */
export function formatChartCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Y-axis ceiling: e.g. $3,350 peak → $4,000. */
export function chartYAxisMax(maxValue: number): number {
  if (maxValue <= 0) return 1000;
  if (maxValue < 1000) {
    const step = maxValue <= 200 ? 50 : 100;
    return Math.ceil(maxValue / step) * step || step;
  }
  return Math.ceil(maxValue / 1000) * 1000;
}
