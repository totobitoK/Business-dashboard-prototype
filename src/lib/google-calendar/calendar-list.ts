import type { SupabaseClient } from "@supabase/supabase-js";
import { listCalendars } from "./google-api";
import { assertDbOk } from "./db-write";

export async function upsertCalendarListPreservingSelection(
  admin: SupabaseClient,
  params: {
    connectionId: string;
    companyId: string;
    accessToken: string;
  }
): Promise<void> {
  const { data: existing, error: exErr } = await admin
    .from("google_calendar_selected_calendars")
    .select("google_calendar_id, selected, sync_token")
    .eq("connection_id", params.connectionId);
  assertDbOk(exErr, "LOAD_CALENDARS");
  const byId = new Map(
    (existing ?? []).map((r) => [
      r.google_calendar_id as string,
      { selected: r.selected as boolean, sync_token: r.sync_token as string | null },
    ])
  );

  const calendars = await listCalendars(params.accessToken);
  for (const c of calendars) {
    const prev = byId.get(c.id);
    const { error } = await admin.from("google_calendar_selected_calendars").upsert(
      {
        connection_id: params.connectionId,
        company_id: params.companyId,
        google_calendar_id: c.id,
        summary: c.summary || c.id,
        selected: prev?.selected ?? false,
        sync_token: prev?.sync_token ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "connection_id,google_calendar_id" }
    );
    assertDbOk(error, "UPSERT_CALENDAR");
  }
}
