import type { SupabaseClient } from "@supabase/supabase-js";
import { SYNC_RUN_TIME_BUDGET_MS } from "./config";
import { getValidAccessToken, markReconnectRequired } from "./access-token";
import { listEventsPage, type EventsListQuery } from "./google-api";
import { parseGoogleEvent } from "./parse-event";
import { assertDbOk } from "./db-write";
import { generationStillValid } from "./connection-generation";
import { frozenImportWindow, shouldRollImportWindow } from "./sync-window";
import { GoogleApiError, isTransientGoogleError } from "./google-errors";
import { acquireSyncLease, releaseSyncLease } from "./sync-lease";

export type SyncProgress = {
  generation: number;
  calendarIndex: number;
  googleCalendarId?: string;
  pageToken?: string;
  mode: "incremental" | "full";
  timeMin?: string;
  timeMax?: string;
};

export type SyncCompanyResult =
  | { ok: true; partial?: false }
  | { ok: true; partial: true; reason: "TIME_BUDGET" }
  | { ok: false; reason: string };

type CalendarRow = {
  id: string;
  google_calendar_id: string;
  sync_token: string | null;
  import_window_anchor_at: string | null;
};

function parseProgress(raw: unknown, generation: number): SyncProgress | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as SyncProgress;
  if (p.generation !== generation) return null;
  return p;
}

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

async function assertSyncAllowed(
  admin: SupabaseClient,
  connectionId: string,
  generation: number
): Promise<void> {
  const { data, error } = await admin
    .from("google_calendar_connections")
    .select("disconnected_at, status, sync_generation")
    .eq("id", connectionId)
    .single();
  assertDbOk(error, "SYNC_GUARD");
  if (
    !data ||
    data.disconnected_at ||
    data.status === "disconnected" ||
    !generationStillValid(Number(data.sync_generation), generation)
  ) {
    throw new Error("SYNC_ABORTED");
  }
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

async function reconcileFullSync(
  admin: SupabaseClient,
  params: {
    companyId: string;
    connectionId: string;
    googleCalendarId: string;
    seenEventIds: Set<string>;
    generation: number;
  }
): Promise<void> {
  const { data: existing, error } = await admin
    .from("google_calendar_events")
    .select("google_event_id")
    .eq("company_id", params.companyId)
    .eq("google_calendar_id", params.googleCalendarId);
  assertDbOk(error, "RECONCILE_LIST");
  for (const row of existing ?? []) {
    await assertSyncAllowed(admin, params.connectionId, params.generation);
    const eventId = row.google_event_id as string;
    if (params.seenEventIds.has(eventId)) continue;
    const { error: delErr } = await admin
      .from("google_calendar_events")
      .delete()
      .eq("company_id", params.companyId)
      .eq("google_calendar_id", params.googleCalendarId)
      .eq("google_event_id", eventId);
    assertDbOk(delErr, "RECONCILE_DELETE");
  }
}

async function writeParsedEvent(
  admin: SupabaseClient,
  params: {
    companyId: string;
    connectionId: string;
    googleCalendarId: string;
    generation: number;
    parsed: ReturnType<typeof parseGoogleEvent>;
  }
): Promise<void> {
  await assertSyncAllowed(admin, params.connectionId, params.generation);
  const { parsed } = params;
  if (parsed.status === "cancelled") {
    const { error } = await admin
      .from("google_calendar_events")
      .delete()
      .eq("company_id", params.companyId)
      .eq("google_calendar_id", params.googleCalendarId)
      .eq("google_event_id", parsed.googleEventId);
    assertDbOk(error, "DELETE_CANCELLED");
    return;
  }
  const { error } = await admin.from("google_calendar_events").upsert(
    {
      company_id: params.companyId,
      connection_id: params.connectionId,
      google_calendar_id: params.googleCalendarId,
      google_event_id: parsed.googleEventId,
      title: parsed.title,
      starts_at: parsed.startsAt,
      ends_at: parsed.endsAt,
      all_day: parsed.allDay,
      all_day_start: parsed.allDayStart,
      all_day_end: parsed.allDayEnd,
      timezone: parsed.timezone,
      status: parsed.status,
      google_updated_at: parsed.googleUpdatedAt,
      imported_at: new Date().toISOString(),
    },
    { onConflict: "company_id,google_calendar_id,google_event_id" }
  );
  assertDbOk(error, "UPSERT_EVENT");
}

async function syncOneCalendar(
  admin: SupabaseClient,
  params: {
    accessToken: string;
    companyId: string;
    connectionId: string;
    generation: number;
    cal: CalendarRow;
    calendarIndex: number;
    progress: SyncProgress | null;
    startedAt: number;
    budgetMs: number;
  }
): Promise<
  | { done: true; finalSyncToken?: string; anchorAt?: string }
  | { done: false; partial: SyncProgress }
> {
  const googleCalendarId = params.cal.google_calendar_id;
  let mode: "incremental" | "full" =
    params.progress?.googleCalendarId === googleCalendarId
      ? params.progress.mode
      : "incremental";
  let pageToken =
    params.progress?.googleCalendarId === googleCalendarId ? params.progress.pageToken : undefined;
  let syncToken = params.cal.sync_token;
  let timeMin = params.progress?.timeMin;
  let timeMax = params.progress?.timeMax;
  let finalSyncToken: string | undefined;
  const seen = new Set<string>();

  const useIncremental =
    mode === "incremental" &&
    syncToken &&
    !shouldRollImportWindow(params.cal.import_window_anchor_at);

  if (!useIncremental) {
    mode = "full";
    if (!timeMin || !timeMax) {
      const frozen = frozenImportWindow();
      timeMin = frozen.timeMin;
      timeMax = frozen.timeMax;
    }
    syncToken = null;
    pageToken = undefined;
  }

  for (;;) {
    if (deadlineExceeded(params.startedAt, params.budgetMs)) {
      return {
        done: false,
        partial: {
          generation: params.generation,
          calendarIndex: params.calendarIndex,
          googleCalendarId,
          pageToken,
          mode,
          timeMin,
          timeMax,
        },
      };
    }

    await assertSyncAllowed(admin, params.connectionId, params.generation);

    let query: EventsListQuery;
    if (mode === "incremental" && syncToken) {
      query = { type: "incremental", syncToken };
    } else {
      query = { type: "full", timeMin: timeMin!, timeMax: timeMax! };
    }

    try {
      const page = await listEventsPage({
        accessToken: params.accessToken,
        calendarId: googleCalendarId,
        query,
        pageToken,
      });

      for (const item of page.items) {
        const parsed = parseGoogleEvent(item);
        seen.add(parsed.googleEventId);
        await writeParsedEvent(admin, {
          companyId: params.companyId,
          connectionId: params.connectionId,
          googleCalendarId,
          generation: params.generation,
          parsed,
        });
      }

      pageToken = page.nextPageToken;
      if (page.nextSyncToken) finalSyncToken = page.nextSyncToken;
      if (!pageToken) break;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "SYNC_TOKEN_EXPIRED") {
        mode = "full";
        syncToken = null;
        pageToken = undefined;
        const frozen = frozenImportWindow();
        timeMin = frozen.timeMin;
        timeMax = frozen.timeMax;
        const { error } = await admin
          .from("google_calendar_selected_calendars")
          .update({
            sync_token: null,
            sync_token_invalidated_at: new Date().toISOString(),
          })
          .eq("id", params.cal.id)
          .eq("connection_id", params.connectionId);
        assertDbOk(error, "INVALIDATE_SYNC_TOKEN");
        continue;
      }
      throw e;
    }
  }

  if (mode === "full") {
    await reconcileFullSync(admin, {
      companyId: params.companyId,
      connectionId: params.connectionId,
      googleCalendarId,
      seenEventIds: seen,
      generation: params.generation,
    });
  }

  return {
    done: true,
    finalSyncToken: finalSyncToken ?? (mode === "incremental" ? syncToken ?? undefined : undefined),
    anchorAt: mode === "full" ? frozenImportWindow().anchorAt : undefined,
  };
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
  options?: { deadlineMs?: number; resumeOnly?: boolean }
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
    let startIndex = progress?.calendarIndex ?? 0;

    for (let i = startIndex; i < calendars.length; i++) {
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
        const partial = { ...result.partial, calendarIndex: i };
        await persistProgress(admin, connectionId, generation, partial);
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

      startIndex = i + 1;
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
    const transient = e instanceof GoogleApiError ? isTransientGoogleError(e) : false;
    const retryAt = new Date(Date.now() + computeRetryDelayMs(msg)).toISOString();
    const { error: errUpd } = await admin
      .from("google_calendar_connections")
      .update({
        status: transient ? "error" : "error",
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
