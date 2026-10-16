import type { SupabaseClient } from "@supabase/supabase-js";
import { SYNC_LOCK_TTL_MS } from "./config";
import { getValidAccessToken, markReconnectRequired } from "./access-token";
import { listEventsPage } from "./google-api";
import { parseGoogleEvent } from "./parse-event";

export async function tryAcquireSyncLock(
  admin: SupabaseClient,
  companyId: string,
  workerId: string
): Promise<boolean> {
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + SYNC_LOCK_TTL_MS);
  const { data: existing } = await admin
    .from("google_calendar_sync_locks")
    .select("locked_until")
    .eq("company_id", companyId)
    .maybeSingle();

  if (existing?.locked_until && new Date(existing.locked_until as string) > now) {
    return false;
  }

  const { error } = await admin.from("google_calendar_sync_locks").upsert(
    {
      company_id: companyId,
      locked_until: lockedUntil.toISOString(),
      locked_by: workerId,
      updated_at: now.toISOString(),
    },
    { onConflict: "company_id" }
  );
  return !error;
}

export async function releaseSyncLock(admin: SupabaseClient, companyId: string): Promise<void> {
  await admin
    .from("google_calendar_sync_locks")
    .update({ locked_until: null, locked_by: null, updated_at: new Date().toISOString() })
    .eq("company_id", companyId);
}

export async function syncCompanyGoogleCalendar(
  admin: SupabaseClient,
  companyId: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { data: conn, error: connErr } = await admin
    .from("google_calendar_connections")
    .select("id, status, disconnected_at")
    .eq("company_id", companyId)
    .maybeSingle();

  if (connErr) return { ok: false, reason: connErr.message };
  if (!conn || conn.disconnected_at) return { ok: false, reason: "NOT_CONNECTED" };
  if (conn.status === "disconnected") return { ok: false, reason: "NOT_CONNECTED" };

  const connectionId = conn.id as string;

  await admin
    .from("google_calendar_connections")
    .update({ status: "syncing", updated_at: new Date().toISOString() })
    .eq("id", connectionId);

  try {
    const accessToken = await getValidAccessToken(admin, connectionId, companyId);

    const { data: calendars, error: calErr } = await admin
      .from("google_calendar_selected_calendars")
      .select("id, google_calendar_id, sync_token")
      .eq("connection_id", connectionId)
      .eq("selected", true);

    if (calErr) throw calErr;

    for (const cal of calendars ?? []) {
      const { data: stillConnected } = await admin
        .from("google_calendar_connections")
        .select("disconnected_at, status")
        .eq("id", connectionId)
        .maybeSingle();
      if (
        !stillConnected ||
        stillConnected.disconnected_at ||
        stillConnected.status === "disconnected"
      ) {
        return { ok: false, reason: "DISCONNECTED_DURING_SYNC" };
      }

      let syncToken = (cal.sync_token as string | null) ?? null;
      let pageToken: string | undefined;
      let finalSyncToken: string | undefined;

      for (;;) {
        try {
          const page = await listEventsPage({
            accessToken,
            calendarId: cal.google_calendar_id as string,
            syncToken: pageToken ? undefined : syncToken,
            pageToken,
          });
          for (const item of page.items) {
            const parsed = parseGoogleEvent(item);
            if (parsed.status === "cancelled") {
              await admin
                .from("google_calendar_events")
                .delete()
                .eq("company_id", companyId)
                .eq("google_calendar_id", cal.google_calendar_id)
                .eq("google_event_id", parsed.googleEventId);
              continue;
            }
            await admin.from("google_calendar_events").upsert(
              {
                company_id: companyId,
                connection_id: connectionId,
                google_calendar_id: cal.google_calendar_id,
                google_event_id: parsed.googleEventId,
                title: parsed.title,
                starts_at: parsed.startsAt,
                ends_at: parsed.endsAt,
                all_day: parsed.allDay,
                timezone: parsed.timezone,
                status: parsed.status,
                google_updated_at: parsed.googleUpdatedAt,
                imported_at: new Date().toISOString(),
              },
              { onConflict: "company_id,google_calendar_id,google_event_id" }
            );
          }
          pageToken = page.nextPageToken;
          if (page.nextSyncToken) finalSyncToken = page.nextSyncToken;
          if (!pageToken) break;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg === "SYNC_TOKEN_EXPIRED") {
            syncToken = null;
            pageToken = undefined;
            await admin
              .from("google_calendar_selected_calendars")
              .update({
                sync_token: null,
                sync_token_invalidated_at: new Date().toISOString(),
              })
              .eq("id", cal.id);
            continue;
          }
          throw e;
        }
      }

      if (finalSyncToken) {
        await admin
          .from("google_calendar_selected_calendars")
          .update({
            sync_token: finalSyncToken,
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", cal.id);
      }
    }

    await admin
      .from("google_calendar_connections")
      .update({
        status: "connected",
        last_sync_at: new Date().toISOString(),
        last_sync_error_code: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connectionId);

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("TOKEN_REFRESH_FAILED") || msg === "RECONNECT_REQUIRED") {
      await markReconnectRequired(admin, connectionId, msg);
      return { ok: false, reason: "RECONNECT_REQUIRED" };
    }
    await admin
      .from("google_calendar_connections")
      .update({
        status: "error",
        last_sync_error_code: msg.slice(0, 120),
        updated_at: new Date().toISOString(),
      })
      .eq("id", connectionId);
    return { ok: false, reason: msg };
  }
}
