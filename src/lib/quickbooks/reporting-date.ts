import { EASTERN_TIME_ZONE } from "@/lib/company-time-zone";

export function isValidIanaTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/** Calendar date in the company time zone, YYYY-MM-DD. */
export function reportingDateInTimeZone(timeZone: string, now: Date): string {
  const zone = isValidIanaTimeZone(timeZone) ? timeZone : EASTERN_TIME_ZONE;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Deployment override. Empty means each company keeps its own time zone. */
export function reportingTimeZoneOverride(): string | null {
  const raw = process.env.QUICKBOOKS_REPORTING_TIMEZONE?.trim() ?? "";
  return raw && isValidIanaTimeZone(raw) ? raw : null;
}

/**
 * The company time zone wins. A deployment override replaces it.
 * QuickBooks CompanyInfo is not a source: a sync must not move the reporting date.
 */
export function selectReportingTimeZone(
  companyTimeZone: string | null | undefined,
  override: string | null = reportingTimeZoneOverride()
): string {
  if (override && isValidIanaTimeZone(override)) return override;
  if (companyTimeZone && isValidIanaTimeZone(companyTimeZone)) return companyTimeZone;
  return EASTERN_TIME_ZONE;
}

/**
 * Overdue means the due date is strictly before the company's reporting date.
 * A missing due date is not overdue. The due date on the reporting date is not overdue.
 */
export function isInvoiceOverdue(
  dueDate: string | null | undefined,
  reportingDate: string | null | undefined
): boolean {
  if (!dueDate || !reportingDate) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !/^\d{4}-\d{2}-\d{2}$/.test(reportingDate)) {
    return false;
  }
  return dueDate < reportingDate;
}
