import type { SupabaseClient } from "@supabase/supabase-js";
import { assertDbOk } from "./db-write";
import type { ParsedCalendarEvent } from "./parse-event";

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
  });
  assertDbOk(error, "RPC_RECONCILE");
  return Number(data ?? 0);
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
  }
): Promise<boolean> {
  const { data, error } = await admin.rpc("google_calendar_sync_persist_tokens", {
    p_connection_id: params.connectionId,
    p_company_id: params.companyId,
    p_expected_generation: params.expectedGeneration,
    p_refresh_token_enc: params.refreshTokenEnc,
    p_access_token_enc: params.accessTokenEnc,
    p_access_token_expires_at: params.accessTokenExpiresAt,
  });
  assertDbOk(error, "RPC_PERSIST_TOKENS");
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
