import type { SupabaseClient } from "@supabase/supabase-js";
import { assertDbOk } from "./db-write";
import type { ParsedCalendarEvent } from "./parse-event";
import type { SyncProgress } from "./sync-progress";

export async function rpcBumpSyncGeneration(
  admin: SupabaseClient,
  connectionId: string
): Promise<number> {
  const { data, error } = await admin.rpc("google_calendar_sync_generation_bump", {
    p_connection_id: connectionId,
  });
  assertDbOk(error, "RPC_BUMP_GENERATION");
  return Number(data);
}

export async function rpcApplySyncEvent(
  admin: SupabaseClient,
  params: {
    connectionId: string;
    companyId: string;
    expectedGeneration: number;
    workerId: string;
    googleCalendarId: string;
    parsed: ParsedCalendarEvent;
  }
): Promise<boolean> {
  const { parsed } = params;
  const { data, error } = await admin.rpc("google_calendar_sync_apply_event", {
    p_connection_id: params.connectionId,
    p_company_id: params.companyId,
    p_expected_generation: params.expectedGeneration,
    p_google_calendar_id: params.googleCalendarId,
    p_google_event_id: parsed.googleEventId,
    p_title: parsed.title,
    p_starts_at: parsed.startsAt,
    p_ends_at: parsed.endsAt,
    p_all_day: parsed.allDay,
    p_all_day_start: parsed.allDayStart,
    p_all_day_end: parsed.allDayEnd,
    p_timezone: parsed.timezone,
    p_status: parsed.status,
    p_google_updated_at: parsed.googleUpdatedAt,
    p_is_cancelled: parsed.status === "cancelled",
    p_worker_id: params.workerId,
  });
  assertDbOk(error, "RPC_APPLY_EVENT");
  return data === true;
}

export async function rpcReconcileCalendar(
  admin: SupabaseClient,
  params: {
    connectionId: string;
    companyId: string;
    expectedGeneration: number;
    workerId: string;
    googleCalendarId: string;
    seenEventIds: string[];
  }
): Promise<number> {
  const { data, error } = await admin.rpc("google_calendar_sync_reconcile_calendar", {
    p_connection_id: params.connectionId,
    p_company_id: params.companyId,
    p_expected_generation: params.expectedGeneration,
    p_google_calendar_id: params.googleCalendarId,
    p_seen_event_ids: params.seenEventIds,
    p_worker_id: params.workerId,
  });
  assertDbOk(error, "RPC_RECONCILE");
  return Number(data ?? -1);
}

export async function rpcPersistTokens(
  admin: SupabaseClient,
  params: {
    connectionId: string;
    companyId: string;
    expectedGeneration: number;
    refreshTokenEnc: string;
    accessTokenEnc: string;
    accessTokenExpiresAt: string;
    workerId?: string | null;
  }
): Promise<boolean> {
  const { data, error } = await admin.rpc("google_calendar_sync_persist_tokens", {
    p_connection_id: params.connectionId,
    p_company_id: params.companyId,
    p_expected_generation: params.expectedGeneration,
    p_refresh_token_enc: params.refreshTokenEnc,
    p_access_token_enc: params.accessTokenEnc,
    p_access_token_expires_at: params.accessTokenExpiresAt,
    p_worker_id: params.workerId ?? null,
  });
  assertDbOk(error, "RPC_PERSIST_TOKENS");
  return data === true;
}

export async function rpcPersistProgress(
  admin: SupabaseClient,
  params: {
    connectionId: string;
    companyId: string;
    expectedGeneration: number;
    workerId: string;
    progress: SyncProgress;
  }
): Promise<boolean> {
  const { data, error } = await admin.rpc("google_calendar_sync_persist_progress", {
    p_connection_id: params.connectionId,
    p_company_id: params.companyId,
    p_expected_generation: params.expectedGeneration,
    p_worker_id: params.workerId,
    p_sync_cursor: params.progress,
  });
  assertDbOk(error, "RPC_PERSIST_PROGRESS");
  return data === true;
}

export async function rpcMarkSyncing(
  admin: SupabaseClient,
  params: {
    connectionId: string;
    companyId: string;
    expectedGeneration: number;
    workerId: string;
    syncingStartedAt: string;
  }
): Promise<boolean> {
  const { data, error } = await admin.rpc("google_calendar_sync_mark_syncing", {
    p_connection_id: params.connectionId,
    p_company_id: params.companyId,
    p_expected_generation: params.expectedGeneration,
    p_worker_id: params.workerId,
    p_syncing_started_at: params.syncingStartedAt,
  });
  assertDbOk(error, "RPC_MARK_SYNCING");
  return data === true;
}

export async function rpcMarkSyncComplete(
  admin: SupabaseClient,
  params: {
    connectionId: string;
    companyId: string;
    expectedGeneration: number;
    workerId: string;
  }
): Promise<boolean> {
  const { data, error } = await admin.rpc("google_calendar_sync_mark_complete", {
    p_connection_id: params.connectionId,
    p_company_id: params.companyId,
    p_expected_generation: params.expectedGeneration,
    p_worker_id: params.workerId,
  });
  assertDbOk(error, "RPC_MARK_COMPLETE");
  return data === true;
}

export async function rpcMarkIdleNoCalendars(
  admin: SupabaseClient,
  params: {
    connectionId: string;
    companyId: string;
    expectedGeneration: number;
    workerId: string;
  }
): Promise<boolean> {
  const { data, error } = await admin.rpc("google_calendar_sync_mark_idle_no_calendars", {
    p_connection_id: params.connectionId,
    p_company_id: params.companyId,
    p_expected_generation: params.expectedGeneration,
    p_worker_id: params.workerId,
  });
  assertDbOk(error, "RPC_MARK_IDLE");
  return data === true;
}

export async function rpcMarkSyncError(
  admin: SupabaseClient,
  params: {
    connectionId: string;
    companyId: string;
    expectedGeneration: number;
    workerId: string;
    errorCode: string;
    nextSyncAttemptAt: string;
  }
): Promise<boolean> {
  const { data, error } = await admin.rpc("google_calendar_sync_mark_error", {
    p_connection_id: params.connectionId,
    p_company_id: params.companyId,
    p_expected_generation: params.expectedGeneration,
    p_worker_id: params.workerId,
    p_error_code: params.errorCode,
    p_next_sync_attempt_at: params.nextSyncAttemptAt,
  });
  assertDbOk(error, "RPC_MARK_ERROR");
  return data === true;
}

export async function rpcMarkReconnectRequired(
  admin: SupabaseClient,
  params: {
    connectionId: string;
    companyId: string;
    expectedGeneration: number;
    workerId: string;
    errorCode: string;
  }
): Promise<boolean> {
  const { data, error } = await admin.rpc("google_calendar_sync_mark_reconnect_required", {
    p_connection_id: params.connectionId,
    p_company_id: params.companyId,
    p_expected_generation: params.expectedGeneration,
    p_worker_id: params.workerId,
    p_error_code: params.errorCode,
  });
  assertDbOk(error, "RPC_MARK_RECONNECT");
  return data === true;
}

export async function rpcCheckpointCalendar(
  admin: SupabaseClient,
  params: {
    connectionId: string;
    companyId: string;
    expectedGeneration: number;
    workerId: string;
    calendarRowId: string;
    syncToken: string | null;
    importWindowAnchorAt: string | null;
    lastSyncedAt: string;
  }
): Promise<boolean> {
  const { data, error } = await admin.rpc("google_calendar_sync_checkpoint_calendar", {
    p_connection_id: params.connectionId,
    p_company_id: params.companyId,
    p_expected_generation: params.expectedGeneration,
    p_worker_id: params.workerId,
    p_calendar_row_id: params.calendarRowId,
    p_sync_token: params.syncToken,
    p_import_window_anchor_at: params.importWindowAnchorAt,
    p_last_synced_at: params.lastSyncedAt,
  });
  assertDbOk(error, "RPC_CHECKPOINT");
  return data === true;
}

export async function rpcInvalidateCalendarSyncToken(
  admin: SupabaseClient,
  params: {
    connectionId: string;
    companyId: string;
    expectedGeneration: number;
    workerId: string;
    calendarRowId: string;
  }
): Promise<boolean> {
  const { data, error } = await admin.rpc("google_calendar_sync_invalidate_calendar_token", {
    p_connection_id: params.connectionId,
    p_company_id: params.companyId,
    p_expected_generation: params.expectedGeneration,
    p_worker_id: params.workerId,
    p_calendar_row_id: params.calendarRowId,
  });
  assertDbOk(error, "RPC_INVALIDATE_TOKEN");
  return data === true;
}

export async function rpcPurgeImportData(
  admin: SupabaseClient,
  connectionId: string,
  companyId: string
): Promise<number> {
  const { data, error } = await admin.rpc("google_calendar_purge_import_data", {
    p_connection_id: connectionId,
    p_company_id: companyId,
  });
  assertDbOk(error, "RPC_PURGE");
  return Number(data);
}

export async function rpcDisconnectCompany(
  admin: SupabaseClient,
  connectionId: string,
  companyId: string
): Promise<number> {
  const { data, error } = await admin.rpc("google_calendar_disconnect_company", {
    p_connection_id: connectionId,
    p_company_id: companyId,
  });
  assertDbOk(error, "RPC_DISCONNECT");
  return Number(data);
}
