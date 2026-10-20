import type { SupabaseClient } from "@supabase/supabase-js";
import { SYNC_RUN_TIME_BUDGET_MS } from "./config";
import { getValidAccessToken, markReconnectRequired } from "./access-token";
import { assertDbOk, abortUnlessSyncGuardApplied } from "./db-write";
import { acquireSyncLease, releaseSyncLease } from "./sync-lease";
import { parseProgress, type SyncProgress } from "./sync-progress";
import { syncOneCalendar, type CalendarRow } from "./sync-one-calendar";
import {
  rpcCheckpointCalendar,
  rpcMarkIdleNoCalendars,
  rpcMarkSyncComplete,
  rpcMarkSyncError,
  rpcMarkSyncing,
  rpcPersistProgress,
} from "./sync-rpc";

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

function computeRetryDelayMs(lastCode: string | null | undefined): number {
  const base = 15 * 60 * 1000;
  if (!lastCode) return base;
  if (lastCode.includes("429") || lastCode.includes("TRANSIENT")) return base;
  return base * 2;
}

export async function syncCompanyGoogleCalendar(
  admin: SupabaseClient,
  companyId: string,
  options: { deadlineMs?: number; workerId: string }
): Promise<SyncCompanyResult> {
  const workerId = options.workerId;
  const conn = await loadConnectionForSync(admin, companyId);
  if (!conn || conn.disconnected_at || conn.status === "disconnected") {
    return { ok: false, reason: "NOT_CONNECTED" };
  }

  const connectionId = conn.id as string;
  const generation = Number(conn.sync_generation ?? 0);
  const budgetMs = options.deadlineMs ?? SYNC_RUN_TIME_BUDGET_MS;
  const startedAt = Date.now();
  const syncingStartedAt = (conn.syncing_started_at as string | null) ?? new Date().toISOString();

  abortUnlessSyncGuardApplied(
    await rpcMarkSyncing(admin, {
      connectionId,
      companyId,
      expectedGeneration: generation,
      workerId,
      syncingStartedAt,
    }),
    "MARK_SYNCING"
  );

  try {
    const accessToken = await getValidAccessToken(admin, connectionId, companyId, generation, workerId);

    const { data: calendars, error: calErr } = await admin
      .from("google_calendar_selected_calendars")
      .select("id, google_calendar_id, sync_token, import_window_anchor_at")
      .eq("connection_id", connectionId)
      .eq("selected", true)
      .order("google_calendar_id");
    assertDbOk(calErr, "LIST_CALENDARS");

    if (!calendars?.length) {
      abortUnlessSyncGuardApplied(
        await rpcMarkIdleNoCalendars(admin, {
          connectionId,
          companyId,
          expectedGeneration: generation,
          workerId,
        }),
        "IDLE_NO_CALENDARS"
      );
      return { ok: true };
    }

    let progress = parseProgress(conn.sync_cursor, generation);
    const startIndex = progress?.calendarIndex ?? 0;
    const lastSyncedAt = new Date().toISOString();

    for (let i = startIndex; i < calendars.length; i++) {
      if (deadlineExceeded(startedAt, budgetMs)) {
        if (progress) {
          abortUnlessSyncGuardApplied(
            await rpcPersistProgress(admin, {
              connectionId,
              companyId,
              expectedGeneration: generation,
              workerId,
              progress,
            }),
            "PERSIST_PROGRESS"
          );
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
        workerId,
        cal,
        calendarIndex: i,
        progress: calProgress,
        startedAt,
        budgetMs,
      });

      if (!result.done) {
        abortUnlessSyncGuardApplied(
          await rpcPersistProgress(admin, {
            connectionId,
            companyId,
            expectedGeneration: generation,
            workerId,
            progress: result.partial,
          }),
          "PERSIST_PROGRESS"
        );
        return { ok: true, partial: true, reason: "TIME_BUDGET" };
      }

      if (result.finalSyncToken || result.anchorAt) {
        abortUnlessSyncGuardApplied(
          await rpcCheckpointCalendar(admin, {
            connectionId,
            companyId,
            expectedGeneration: generation,
            workerId,
            calendarRowId: cal.id,
            syncToken: result.finalSyncToken ?? null,
            importWindowAnchorAt: result.anchorAt ?? null,
            lastSyncedAt,
          }),
          "CHECKPOINT_CALENDAR"
        );
      }

      progress = null;
    }

    abortUnlessSyncGuardApplied(
      await rpcMarkSyncComplete(admin, {
        connectionId,
        companyId,
        expectedGeneration: generation,
        workerId,
      }),
      "SYNC_COMPLETE"
    );

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "RECONNECT_REQUIRED" || msg.includes("TOKEN_REFRESH_PERMANENT")) {
      await markReconnectRequired(admin, connectionId, companyId, msg, generation, workerId);
      return { ok: false, reason: "RECONNECT_REQUIRED" };
    }
    if (msg.startsWith("SYNC_ABORTED")) {
      return { ok: false, reason: "SYNC_ABORTED" };
    }
    const retryAt = new Date(Date.now() + computeRetryDelayMs(msg)).toISOString();
    await rpcMarkSyncError(admin, {
      connectionId,
      companyId,
      expectedGeneration: generation,
      workerId,
      errorCode: msg.slice(0, 120),
      nextSyncAttemptAt: retryAt,
    });
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
