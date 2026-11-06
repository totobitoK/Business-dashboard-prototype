import type { SupabaseClient } from "@supabase/supabase-js";
import { assertDbOk } from "./db-write";

export async function acquireSyncLease(
  admin: SupabaseClient,
  companyId: string,
  workerId: string,
  ttlSeconds: number
): Promise<boolean> {
  const { data, error } = await admin.rpc("square_acquire_sync_lease", {
    p_company_id: companyId,
    p_worker_id: workerId,
    p_ttl_seconds: ttlSeconds,
  });
  assertDbOk(error, "ACQUIRE_LEASE");
  return data === true;
}

export async function releaseSyncLease(admin: SupabaseClient, companyId: string, workerId: string): Promise<void> {
  const { error } = await admin.rpc("square_release_sync_lease", {
    p_company_id: companyId,
    p_worker_id: workerId,
  });
  assertDbOk(error, "RELEASE_LEASE");
}

export async function persistTokens(
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
  const { data, error } = await admin.rpc("square_persist_tokens", {
    p_connection_id: params.connectionId,
    p_company_id: params.companyId,
    p_expected_generation: params.expectedGeneration,
    p_refresh_token_enc: params.refreshTokenEnc,
    p_access_token_enc: params.accessTokenEnc,
    p_access_token_expires_at: params.accessTokenExpiresAt,
  });
  assertDbOk(error, "PERSIST_TOKENS");
  return data === true;
}

export async function markSyncing(
  admin: SupabaseClient,
  params: { connectionId: string; companyId: string; expectedGeneration: number; workerId: string }
): Promise<boolean> {
  const { data, error } = await admin.rpc("square_mark_syncing", {
    p_connection_id: params.connectionId,
    p_company_id: params.companyId,
    p_expected_generation: params.expectedGeneration,
    p_worker_id: params.workerId,
  });
  assertDbOk(error, "MARK_SYNCING");
  return data === true;
}

export async function replaceLocations(
  admin: SupabaseClient,
  params: { connectionId: string; companyId: string; locations: unknown[] }
): Promise<boolean> {
  const { data, error } = await admin.rpc("square_replace_locations", {
    p_connection_id: params.connectionId,
    p_company_id: params.companyId,
    p_locations: params.locations,
  });
  assertDbOk(error, "REPLACE_LOCATIONS");
  return data === true;
}

export async function upsertTransactions(
  admin: SupabaseClient,
  params: {
    connectionId: string;
    companyId: string;
    expectedGeneration: number;
    workerId: string;
    syncRunId: string;
    transactions: unknown[];
  }
): Promise<boolean> {
  const { data, error } = await admin.rpc("square_upsert_transactions", {
    p_connection_id: params.connectionId,
    p_company_id: params.companyId,
    p_expected_generation: params.expectedGeneration,
    p_worker_id: params.workerId,
    p_sync_run_id: params.syncRunId,
    p_transactions: params.transactions,
  });
  assertDbOk(error, "UPSERT_TRANSACTIONS");
  return data === true;
}

export async function commitImport(
  admin: SupabaseClient,
  params: {
    connectionId: string;
    companyId: string;
    expectedGeneration: number;
    workerId: string;
    syncRunId: string;
    transactions: unknown[];
    reportingDate: string;
    reportingTimezone: string;
    merchantName: string | null;
  }
): Promise<number> {
  const { data, error } = await admin.rpc("square_commit_import", {
    p_connection_id: params.connectionId,
    p_company_id: params.companyId,
    p_expected_generation: params.expectedGeneration,
    p_worker_id: params.workerId,
    p_sync_run_id: params.syncRunId,
    p_transactions: params.transactions,
    p_reporting_date: params.reportingDate,
    p_reporting_timezone: params.reportingTimezone,
    p_merchant_name: params.merchantName,
  });
  assertDbOk(error, "COMMIT_IMPORT");
  return Number(data);
}

export async function finalizeTransactions(
  admin: SupabaseClient,
  params: {
    connectionId: string;
    companyId: string;
    expectedGeneration: number;
    workerId: string;
    syncRunId: string;
    reportingDate: string;
    reportingTimezone: string;
    merchantName: string | null;
  }
): Promise<number> {
  const { data, error } = await admin.rpc("square_finalize_transactions", {
    p_connection_id: params.connectionId,
    p_company_id: params.companyId,
    p_expected_generation: params.expectedGeneration,
    p_worker_id: params.workerId,
    p_sync_run_id: params.syncRunId,
    p_reporting_date: params.reportingDate,
    p_reporting_timezone: params.reportingTimezone,
    p_merchant_name: params.merchantName,
  });
  assertDbOk(error, "FINALIZE_TRANSACTIONS");
  return Number(data);
}

export async function markSyncError(
  admin: SupabaseClient,
  params: {
    connectionId: string;
    companyId: string;
    expectedGeneration: number;
    workerId: string;
    errorCode: string;
    reconnect: boolean;
  }
): Promise<void> {
  const fn = params.reconnect ? "square_mark_reconnect_required" : "square_mark_error";
  const { error } = await admin.rpc(fn, {
    p_connection_id: params.connectionId,
    p_company_id: params.companyId,
    p_expected_generation: params.expectedGeneration,
    p_worker_id: params.workerId,
    p_error_code: params.errorCode,
  });
  assertDbOk(error, "MARK_ERROR");
}
