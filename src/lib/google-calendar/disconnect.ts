import type { SupabaseClient } from "@supabase/supabase-js";

/** Removes credentials, stops sync, and clears imported events for the company. */
export async function disconnectGoogleCalendar(
  admin: SupabaseClient,
  companyId: string,
  connectionId: string
): Promise<void> {
  const now = new Date().toISOString();
  await admin.from("google_calendar_events").delete().eq("company_id", companyId);
  await admin.from("google_calendar_selected_calendars").delete().eq("company_id", companyId);
  await admin.from("google_calendar_connection_secrets").delete().eq("connection_id", connectionId);
  await admin
    .from("google_calendar_connections")
    .update({
      status: "disconnected",
      disconnected_at: now,
      google_sub: null,
      google_email: null,
      last_sync_error_code: null,
      sync_cursor: {},
      updated_at: now,
    })
    .eq("id", connectionId);
}

/** Clears imported data before linking a different Google account (explicit replace). */
export async function purgeGoogleCalendarImportData(
  admin: SupabaseClient,
  companyId: string,
  connectionId: string
): Promise<void> {
  await admin.from("google_calendar_events").delete().eq("company_id", companyId);
  await admin.from("google_calendar_selected_calendars").delete().eq("company_id", companyId);
  await admin.from("google_calendar_connection_secrets").delete().eq("connection_id", connectionId);
}
