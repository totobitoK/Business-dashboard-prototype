import { IMPORT_WINDOW_FUTURE_DAYS, IMPORT_WINDOW_PAST_DAYS, IMPORT_WINDOW_ROLL_MS } from "./config";
import { importWindowBounds } from "./google-api";

export function shouldRollImportWindow(anchorAt: string | null | undefined, now = new Date()): boolean {
  if (!anchorAt) return true;
  return now.getTime() - new Date(anchorAt).getTime() >= IMPORT_WINDOW_ROLL_MS;
}

export function frozenImportWindow(now = new Date()): { timeMin: string; timeMax: string; anchorAt: string } {
  const { timeMin, timeMax } = importWindowBounds(now);
  return { timeMin, timeMax, anchorAt: now.toISOString() };
}

export function windowDaySpan(): { past: number; future: number } {
  return { past: IMPORT_WINDOW_PAST_DAYS, future: IMPORT_WINDOW_FUTURE_DAYS };
}
