import type { SupabaseClient } from "@supabase/supabase-js";
import { SYNC_RUN_TIME_BUDGET_MS } from "./config";
import { getValidAccessToken, markReconnectRequired } from "./access-token";
import { assertDbOk } from "./db-write";
import { acquireSyncLease, releaseSyncLease } from "./sync-lease";
import { parseProgress, type SyncProgress } from "./sync-progress";
import { syncOneCalendar, type CalendarRow } from "./sync-one-calendar";

export type { SyncProgress };

export type SyncCompanyResult =
  | { ok: true; partial?: false }
  | { ok: true; partial: true; reason: "TIME_BUDGET" }
  | { ok: false; reason: string };

function deadlineExceeded(startedAt: number, budgetMs: number): boolean {
  return Date.now() - startedAt >= budgetMs;
}

async function loadConnectionForSync(admin: SupabaseClient, companyId: string) {
  const { data, error } = await admin
    .from("google_calendar_connections")
    .select(
      "id, status, disconnected_at, sync_generation, sync_cursor, syncing_started_at, last_sync_error_code"
    )
    .eq("company_id", companyId)
    .maybeSingle();
  assertDbOk(error, "LOAD_CONNECTION");
  return data;
}

async function persistProgress(
  admin: SupabaseClient,
  connectionId: string,
  generation: number,
  progress: SyncProgress
): Promise<void> {
  const { error } = await admin
    .from("google_calendar_connections")
    .update({
      sync_cursor: progress,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId)
    .eq("sync_generation", generation);
  assertDbOk(error, "PERSIST_PROGRESS");
}

function computeRetryDelayMs(lastCode: string | null | undefined): number {
  const base = 15 * 60 * 1000;
  if (!lastCode) return base;
  if (lastCode.includes("429") || lastCode.includes("TRANSIENT")) return base;
  return base * 2;
}

export async function syncCompanyGoogleCalendar(
  admin: SupabaseClient,
  companyId: string,
  options?: { deadlineMs?: number }
): Promise<SyncCompanyResult> {
  const conn = await loadConnectionForSync(admin, companyId);
  if (!conn || conn.disconnected_at || conn.status === "disconnected") {
    return { ok: false, reason: "NOT_CONNECTED" };
  }

  const connectionId = conn.id as string;
  const generation = Number(conn.sync_generation ?? 0);
  const budgetMs = options?.deadlineMs ?? SYNC_RUN_TIME_BUDGET_MS;
  const startedAt = Date.now();

  const { error: markSyncErr } = await admin
    .from("google_calendar_connections")
    .update({
      status: "syncing",
      syncing_started_at: conn.syncing_started_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId)
    .eq("sync_generation", generation);
  assertDbOk(markSyncErr, "MARK_SYNCING");

  try {
    const accessToken = await getValidAccessToken(admin, connectionId, companyId, generation);

    const { data: calendars, error: calErr } = await admin
      .from("google_calendar_selected_calendars")
      .select("id, google_calendar_id, sync_token, import_window_anchor_at")
      .eq("connection_id", connectionId)
      .eq("selected", true)
      .order("google_calendar_id");
    assertDbOk(calErr, "LIST_CALENDARS");

    if (!calendars?.length) {
      await admin
        .from("google_calendar_connections")
        .update({
          status: "connected",
          syncing_started_at: null,
          sync_cursor: {},
          updated_at: new Date().toISOString(),
        })
        .eq("id", connectionId)
        .eq("sync_generation", generation);
      return { ok: true };
    }

    let progress = parseProgress(conn.sync_cursor, generation);
    const startIndex = progress?.calendarIndex ?? 0;

    for (let i = startIndex; i < calendars.length; i++) {
      if (deadlineExceeded(startedAt, budgetMs)) {
        if (progress) {
          await persistProgress(admin, connectionId, generation, progress);
        }
        return { ok: true, partial: true, reason: "TIME_BUDGET" };
      }

      const cal = calendars[i] as CalendarRow;
      const calProgress =
        i === startIndex && progress?.googleCalendarId === cal.google_calendar_id ? progress : null;

      const result = await syncOneCalendar(admin, {
        accessToken,
        companyId,
        connectionId,
        generation,
        cal,
        calendarIndex: i,
        progress: calProgress,
        startedAt,
        budgetMs,
      });

      if (!result.done) {
        await persistProgress(admin, connectionId, generation, result.partial);
        return { ok: true, partial: true, reason: "TIME_BUDGET" };
      }

      if (result.finalSyncToken) {
        const { error: tokErr } = await admin
          .from("google_calendar_selected_calendars")
          .update({
            sync_token: result.finalSyncToken,
            last_synced_at: new Date().toISOString(),
            import_window_anchor_at: result.anchorAt ?? cal.import_window_anchor_at,
            updated_at: new Date().toISOString(),
          })
          .eq("id", cal.id)
          .eq("connection_id", connectionId);
        assertDbOk(tokErr, "CHECKPOINT_CALENDAR");
      } else if (result.anchorAt) {
        const { error: anchorErr } = await admin
          .from("google_calendar_selected_calendars")
          .update({
            import_window_anchor_at: result.anchorAt,
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", cal.id)
          .eq("connection_id", connectionId);
        assertDbOk(anchorErr, "CHECKPOINT_ANCHOR");
      }

      progress = null;
    }

    const { error: doneErr } = await admin
      .from("google_calendar_connections")
      .update({
        status: "connected",
        last_sync_at: new Date().toISOString(),
        last_sync_error_code: null,
        next_sync_attempt_at: null,
        syncing_started_at: null,
        sync_cursor: {},
        updated_at: new Date().toISOString(),
      })
      .eq("id", connectionId)
      .eq("sync_generation", generation);
    assertDbOk(doneErr, "SYNC_COMPLETE");

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "RECONNECT_REQUIRED" || msg.includes("TOKEN_REFRESH_PERMANENT")) {
      await markReconnectRequired(admin, connectionId, msg, generation);
      return { ok: false, reason: "RECONNECT_REQUIRED" };
    }
    if (msg === "SYNC_ABORTED") {
      return { ok: false, reason: "SYNC_ABORTED" };
    }
    const retryAt = new Date(Date.now() + computeRetryDelayMs(msg)).toISOString();
    const { error: errUpd } = await admin
      .from("google_calendar_connections")
      .update({
        status: "error",
        last_sync_error_code: msg.slice(0, 120),
        next_sync_attempt_at: retryAt,
        syncing_started_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connectionId)
      .eq("sync_generation", generation);
    assertDbOk(errUpd, "SYNC_ERROR");
    return { ok: false, reason: msg };
  }
}

/** @deprecated Use acquireSyncLease */
export async function tryAcquireSyncLock(
  admin: SupabaseClient,
  companyId: string,
  workerId: string
): Promise<boolean> {
  return acquireSyncLease(admin, companyId, workerId);
}

/** @deprecated Use releaseSyncLease */
export async function releaseSyncLock(
  admin: SupabaseClient,
  companyId: string,
  workerId?: string
): Promise<void> {
  if (!workerId) return;
  await releaseSyncLease(admin, companyId, workerId);
}
