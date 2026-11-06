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
  const zone = isValidIanaTimeZone(timeZone) ? timeZone : "UTC";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function configuredReportingTimeZone(): { timeZone: string; source: "configured" | "utc_default" } {
  const raw = process.env.QUICKBOOKS_REPORTING_TIMEZONE?.trim() ?? "";
  if (raw && isValidIanaTimeZone(raw)) {
    return { timeZone: raw, source: "configured" };
  }
  return { timeZone: "UTC", source: "utc_default" };
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
