import type { SupabaseClient } from "@supabase/supabase-js";
import { listEventsPage, type EventsListQuery } from "./google-api";
import { parseGoogleEvent } from "./parse-event";
import { frozenImportWindow, shouldRollImportWindow } from "./sync-window";
import { assertDbOk } from "./db-write";
import { rpcApplySyncEvent, rpcReconcileCalendar } from "./sync-rpc";
import type { SyncProgress } from "./sync-progress";

export type CalendarRow = {
  id: string;
  google_calendar_id: string;
  sync_token: string | null;
  import_window_anchor_at: string | null;
};

export type SyncOneCalendarResult =
  | { done: true; finalSyncToken?: string; anchorAt?: string }
  | { done: false; partial: SyncProgress };

export function isResumingSameCalendar(
  progress: SyncProgress | null,
  googleCalendarId: string
): boolean {
  return progress?.googleCalendarId === googleCalendarId;
}

export async function syncOneCalendar(
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
    listPage?: typeof listEventsPage;
  }
): Promise<SyncOneCalendarResult> {
  const listPage = params.listPage ?? listEventsPage;
  const googleCalendarId = params.cal.google_calendar_id;
  const resuming = isResumingSameCalendar(params.progress, googleCalendarId);

  let mode: "incremental" | "full" = resuming ? params.progress!.mode : "incremental";
  let pageToken = resuming ? params.progress!.pageToken : undefined;
  let syncToken = params.cal.sync_token;
  let timeMin = resuming ? params.progress!.timeMin : undefined;
  let timeMax = resuming ? params.progress!.timeMax : undefined;
  let finalSyncToken: string | undefined;
  const seen = new Set<string>(resuming ? params.progress!.seenEventIds ?? [] : []);

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
    if (!resuming || params.progress!.mode !== "full") {
      pageToken = undefined;
      seen.clear();
    }
  }

  const deadlineExceeded = () => Date.now() - params.startedAt >= params.budgetMs;

  const savePartial = (): SyncOneCalendarResult => ({
    done: false,
    partial: {
      generation: params.generation,
      calendarIndex: params.calendarIndex,
      googleCalendarId,
      pageToken,
      mode,
      timeMin,
      timeMax,
      seenEventIds: [...seen],
    },
  });

  for (;;) {
    if (deadlineExceeded()) {
      return savePartial();
    }

    let query: EventsListQuery;
    if (mode === "incremental" && syncToken) {
      query = { type: "incremental", syncToken };
    } else {
      query = { type: "full", timeMin: timeMin!, timeMax: timeMax! };
    }

    try {
      const page = await listPage({
        accessToken: params.accessToken,
        calendarId: googleCalendarId,
        query,
        pageToken,
      });

      for (const item of page.items) {
        const parsed = parseGoogleEvent(item);
        seen.add(parsed.googleEventId);
        const applied = await rpcApplySyncEvent(admin, {
          connectionId: params.connectionId,
          companyId: params.companyId,
          expectedGeneration: params.generation,
          googleCalendarId,
          parsed,
        });
        if (!applied) {
          throw new Error("SYNC_ABORTED");
        }
      }

      pageToken = page.nextPageToken;
      if (page.nextSyncToken) finalSyncToken = page.nextSyncToken;
      if (deadlineExceeded()) {
        return savePartial();
      }
      if (!pageToken) break;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "SYNC_TOKEN_EXPIRED") {
        mode = "full";
        syncToken = null;
        pageToken = undefined;
        seen.clear();
        const frozen = frozenImportWindow();
        timeMin = frozen.timeMin;
        timeMax = frozen.timeMax;
        const { error: invErr } = await admin
          .from("google_calendar_selected_calendars")
          .update({
            sync_token: null,
            sync_token_invalidated_at: new Date().toISOString(),
          })
          .eq("id", params.cal.id)
          .eq("connection_id", params.connectionId);
        assertDbOk(invErr, "INVALIDATE_SYNC_TOKEN");
        continue;
      }
      throw e;
    }
  }

  if (mode === "full") {
    await rpcReconcileCalendar(admin, {
      connectionId: params.connectionId,
      companyId: params.companyId,
      expectedGeneration: params.generation,
      googleCalendarId,
      seenEventIds: [...seen],
    });
  }

  return {
    done: true,
    finalSyncToken: finalSyncToken ?? (mode === "incremental" ? syncToken ?? undefined : undefined),
    anchorAt: mode === "full" ? frozenImportWindow().anchorAt : undefined,
  };
}
