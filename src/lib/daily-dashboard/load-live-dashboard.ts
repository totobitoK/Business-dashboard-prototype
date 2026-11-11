import { getAuthContext } from "@/lib/auth/authorization";
import { formatAppointmentWhen } from "@/lib/google-calendar/format-appointment";
import { isGoogleCalendarIntegrationConfigured } from "@/lib/google-calendar/config";
import { EASTERN_TIME_ZONE } from "@/lib/company-time-zone";
import { getQuickBooksEnvironment } from "@/lib/quickbooks/config";
import {
  buildReceivablesViewModel,
  type QuickBooksStatusPayload,
} from "@/lib/quickbooks/receivables-presentation";
import { getSquareEnvironment } from "@/lib/square/config";
import {
  buildSquareCollectionsViewModel,
  type SquareStatusPayload,
} from "@/lib/square/collections-presentation";
import { createClient } from "@/lib/supabase/server";
import { classifyCalendar, classifyQuickBooks, classifySquare } from "./connector-state";
import { emptyLiveSnapshot, type DailyAppointment, type DailyDashboardSnapshot } from "./types";

type AppointmentRecord = {
  id: string;
  title: string;
  google_calendar_id: string;
  starts_at: string | null;
  ends_at: string | null;
  all_day: boolean;
  all_day_start?: string | null;
  all_day_end?: string | null;
  timezone: string | null;
  imported_at?: string;
};

type CalendarStatus = {
  connected?: boolean;
  status?: string;
  last_sync_at?: string | null;
  selected_calendar_count?: number;
};

/**
 * Signed-in dashboard read.
 * The company id comes from the caller's membership list, the same id the
 * dashboard layout already selected. A demo selector or URL parameter is not read here.
 */
export async function loadLiveDailyDashboard(): Promise<DailyDashboardSnapshot> {
  const supabase = await createClient();
  const ctx = await getAuthContext(supabase);
  const companyId = ctx?.companyIds[0] ?? null;
  const today = todayInTimeZone(EASTERN_TIME_ZONE);
  if (!ctx || !companyId) return emptyLiveSnapshot("Your company", today);

  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", companyId)
    .maybeSingle();
  const companyName =
    typeof company?.name === "string" && company.name.trim() ? company.name : "Your company";

  const quickBooksDeployment = getQuickBooksEnvironment();
  const squareDeployment = getSquareEnvironment();
  const calendarConfigured = isGoogleCalendarIntegrationConfigured();

  const [
    quickBooksStatusResult,
    quickBooksInvoiceResult,
    squareStatusResult,
    squareTransactionResult,
    calendarStatusResult,
    calendarAppointmentResult,
    calendarListResult,
  ] = await Promise.all([
    supabase.rpc("member_get_quickbooks_status", { p_company_id: companyId }),
    supabase.rpc("member_list_quickbooks_invoices", { p_company_id: companyId }),
    supabase.rpc("member_get_square_status", { p_company_id: companyId }),
    supabase.rpc("member_list_square_transactions", { p_company_id: companyId }),
    supabase.rpc("member_get_google_calendar_status", { p_company_id: companyId }),
    supabase.rpc("member_list_google_calendar_appointments", { p_company_id: companyId }),
    supabase
      .from("google_calendar_selected_calendars")
      .select("google_calendar_id, summary")
      .eq("company_id", companyId)
      .eq("selected", true),
  ]);

  const quickBooksLoadError = Boolean(
    quickBooksStatusResult.error || quickBooksInvoiceResult.error
  );
  const quickBooksStatus = (
    quickBooksLoadError ? null : quickBooksStatusResult.data
  ) as QuickBooksStatusPayload | null;
  const receivablesModel = buildReceivablesViewModel({
    status: quickBooksStatus,
    invoices: quickBooksLoadError ? [] : quickBooksInvoiceResult.data,
    loadError: quickBooksLoadError,
    deploymentEnvironment: quickBooksDeployment,
  });
  const quickBooksState = classifyQuickBooks({
    loadError: quickBooksLoadError,
    deploymentConfigured: Boolean(quickBooksDeployment),
    connected: Boolean(quickBooksStatus?.connected),
    environmentMismatch: environmentsDiffer(
      quickBooksDeployment,
      quickBooksStatus?.intuit_environment
    ),
    connectionStatus: quickBooksStatus?.status ?? null,
    hasSuccessfulSync: Boolean(quickBooksStatus?.last_successful_sync_at),
    showBalances: receivablesModel.showBalances,
    stale: receivablesModel.stale,
    openBalance: receivablesModel.openBalance,
    visibleInvoiceCount: receivablesModel.invoices.length,
  });

  const squareLoadError = Boolean(squareStatusResult.error || squareTransactionResult.error);
  const squareStatus = (squareLoadError ? null : squareStatusResult.data) as SquareStatusPayload | null;
  const collectionsModel = buildSquareCollectionsViewModel({
    deploymentEnvironment: squareDeployment,
    status: squareStatus,
    transactions: squareLoadError ? [] : squareTransactionResult.data,
    loadError: squareLoadError,
  });
  const squareState = classifySquare({
    loadError: squareLoadError,
    deploymentConfigured: Boolean(squareDeployment),
    connected: Boolean(squareStatus?.connected),
    environmentMismatch: environmentsDiffer(squareDeployment, squareStatus?.square_environment),
    locationsReady:
      Boolean(squareStatus?.locations_confirmed) && (squareStatus?.selected_location_count ?? 0) > 0,
    connectionStatus: squareStatus?.status ?? null,
    hasSuccessfulSync: Boolean(squareStatus?.last_successful_sync_at),
    showTotals: collectionsModel.showTotals,
    stale: collectionsModel.stale,
    zeroActivity: collectionsModel.zeroActivity,
    transactionCount: collectionsModel.transactions.length,
  });

  const calendarLoadError = Boolean(calendarStatusResult.error || calendarAppointmentResult.error);
  const calendarStatus = (
    calendarLoadError ? null : calendarStatusResult.data
  ) as CalendarStatus | null;
  const calendarNames: Record<string, string> = {};
  for (const row of calendarListResult.data ?? []) {
    calendarNames[row.google_calendar_id as string] = row.summary as string;
  }
  const appointments = calendarLoadError
    ? []
    : mapAppointments((calendarAppointmentResult.data ?? []) as AppointmentRecord[], calendarNames);
  const calendarState = classifyCalendar({
    loadError: calendarLoadError,
    deploymentConfigured: calendarConfigured,
    connected: Boolean(calendarStatus?.connected),
    connectionStatus: calendarStatus?.status ?? null,
    selectedCalendarCount: calendarStatus?.selected_calendar_count ?? 0,
    appointmentCount: appointments.length,
  });

  const timeZone =
    collectionsModel.reportingTimezone ||
    receivablesModel.reportingTimezone ||
    EASTERN_TIME_ZONE;
  const asOfDate =
    (collectionsModel.showTotals ? collectionsModel.reportingDate : null) ||
    receivablesModel.reportingDate ||
    todayInTimeZone(timeZone);

  const overdueInvoices = receivablesModel.invoices.filter((invoice) => invoice.overdue);

  return {
    source: "live",
    sampleLabel: null,
    companyName,
    asOfDate,
    timeZone,
    receivables: {
      state: quickBooksState,
      messages: receivablesModel.messages,
      showBalances: receivablesModel.showBalances,
      asOfDate: receivablesModel.reportingDate,
      openBalance: receivablesModel.openBalance,
      overdueBalance: receivablesModel.overdueBalance,
      overdueCount: overdueInvoices.length,
      invoices: receivablesModel.invoices.map((invoice) => ({
        id: invoice.id,
        customer: invoice.customerName ?? "Customer",
        docNumber: invoice.docNumber,
        balance: invoice.remainingBalance,
        dueDate: invoice.dueDate,
        overdue: invoice.overdue,
        href: invoice.quickBooksUrl,
      })),
      invoiceCount: receivablesModel.invoiceCount,
      listTruncated: receivablesModel.invoiceCount > receivablesModel.invoices.length,
      lastSuccessfulSyncAt: receivablesModel.lastSuccessfulSyncAt,
      environmentLabel: receivablesModel.environmentLabel,
      sourceCompanyName: receivablesModel.companyName,
    },
    collections: {
      state: squareState,
      messages: collectionsModel.messages,
      showTotals: collectionsModel.showTotals,
      timeZone: collectionsModel.reportingTimezone,
      lastSuccessfulSyncAt: collectionsModel.lastSuccessfulSyncAt,
      environmentLabel: collectionsModel.environmentLabel,
      merchantName: collectionsModel.merchantName,
      authoritativeDay:
        collectionsModel.showTotals && collectionsModel.reportingDate
          ? { date: collectionsModel.reportingDate, currencies: collectionsModel.currencies }
          : null,
      transactions: collectionsModel.transactions,
      loadedCap: 40,
    },
    schedule: {
      state: calendarState,
      messages: calendarMessages(calendarState),
      windowLabel: "Today / Upcoming",
      lastSyncAt: calendarStatus?.last_sync_at ?? null,
      appointments,
    },
    connectors: [
      {
        id: "quickbooks",
        label: "QuickBooks",
        state: quickBooksState,
        detail: receivablesModel.messages[0] ?? "QuickBooks receivables",
        lastSuccessfulSyncAt: receivablesModel.lastSuccessfulSyncAt,
      },
      {
        id: "square",
        label: "Square",
        state: squareState,
        detail: collectionsModel.messages[0] ?? "Square collections",
        lastSuccessfulSyncAt: collectionsModel.lastSuccessfulSyncAt,
      },
      {
        id: "google-calendar",
        label: "Google Calendar",
        state: calendarState,
        detail: calendarMessages(calendarState)[0] ?? "Appointments",
        lastSuccessfulSyncAt: calendarStatus?.connected ? calendarStatus.last_sync_at ?? null : null,
      },
    ],
  };
}

function environmentsDiffer(
  deployment: string | null,
  connected: string | null | undefined
): boolean {
  return Boolean(deployment && connected && connected !== deployment);
}

function calendarMessages(state: DailyDashboardSnapshot["schedule"]["state"]): string[] {
  switch (state) {
    case "disconnected":
      return ["No Google Calendar is connected. An owner can connect one in Connections."];
    case "unavailable":
      return ["Google Calendar is not configured in this environment, so appointments are hidden."];
    case "setup_incomplete":
      return ["Connected, but no calendars are selected yet. Owners choose calendars in Connections."];
    case "reconnect_required":
      return ["Google Calendar needs to be reconnected before appointments can update."];
    case "syncing":
      return ["Syncing appointments from Google Calendar."];
    case "load_error":
      return ["Appointments could not be loaded. Refresh the page or contact RavenView if this continues."];
    case "verified_empty":
      return ["No appointments in the Today / Upcoming window."];
    case "stale":
      return ["The last sync hit an error. Appointments shown may be out of date."];
    default:
      return [];
  }
}

function mapAppointments(
  rows: AppointmentRecord[],
  calendarNames: Record<string, string>
): DailyAppointment[] {
  return rows.flatMap((row) => {
    const isoDate = appointmentIso(row);
    if (!isoDate) return [];
    return [
      {
        id: row.id,
        title: row.title || "Appointment",
        whenLabel: formatAppointmentWhen({
          startsAt: row.starts_at,
          endsAt: row.ends_at,
          allDay: row.all_day,
          allDayStart: row.all_day_start,
          allDayEnd: row.all_day_end,
          timezone: row.timezone,
        }),
        isoDate,
        startsAt: row.starts_at ?? (row.all_day ? `${isoDate}T12:00:00Z` : null),
        calendarName: calendarNames[row.google_calendar_id] ?? null,
      },
    ];
  });
}

function appointmentIso(row: AppointmentRecord): string {
  if (row.all_day && row.all_day_start) return row.all_day_start.slice(0, 10);
  if (!row.starts_at) return "";
  const zone = row.timezone || "UTC";
  const date = new Date(row.starts_at);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return row.starts_at.slice(0, 10);
  }
}

function todayInTimeZone(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }
}
