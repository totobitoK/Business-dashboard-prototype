import type { SupabaseClient } from "@supabase/supabase-js";
import { bumpConnectionSyncGeneration } from "./connection-generation";
import { assertDbOk } from "./db-write";

/** Removes credentials, stops sync, and clears imported events for the company. */
export async function disconnectGoogleCalendar(
  admin: SupabaseClient,
  companyId: string,
  connectionId: string
): Promise<void> {
  await bumpConnectionSyncGeneration(admin, connectionId);
  const now = new Date().toISOString();
  const { error: evErr } = await admin.from("google_calendar_events").delete().eq("company_id", companyId);
  assertDbOk(evErr, "DISCONNECT_EVENTS");
  const { error: calErr } = await admin
    .from("google_calendar_selected_calendars")
    .delete()
    .eq("company_id", companyId);
  assertDbOk(calErr, "DISCONNECT_CALENDARS");
  const { error: secErr } = await admin
    .from("google_calendar_connection_secrets")
    .delete()
    .eq("connection_id", connectionId);
  assertDbOk(secErr, "DISCONNECT_SECRETS");
  const { error: connErr } = await admin
    .from("google_calendar_connections")
    .update({
      status: "disconnected",
      disconnected_at: now,
      google_sub: null,
      google_email: null,
      last_sync_error_code: null,
      sync_cursor: {},
      syncing_started_at: null,
      next_sync_attempt_at: null,
      updated_at: now,
    })
    .eq("id", connectionId);
  assertDbOk(connErr, "DISCONNECT_CONN");
}

/** Clears imported data before linking a different Google account (explicit replace). */
export async function purgeGoogleCalendarImportData(
  admin: SupabaseClient,
  companyId: string,
  connectionId: string
): Promise<void> {
  const { error: evErr } = await admin.from("google_calendar_events").delete().eq("company_id", companyId);
  assertDbOk(evErr, "PURGE_EVENTS");
  const { error: calErr } = await admin
    .from("google_calendar_selected_calendars")
    .delete()
    .eq("company_id", companyId);
  assertDbOk(calErr, "PURGE_CALENDARS");
  const { error: secErr } = await admin
    .from("google_calendar_connection_secrets")
    .delete()
    .eq("connection_id", connectionId);
  assertDbOk(secErr, "PURGE_SECRETS");
}
