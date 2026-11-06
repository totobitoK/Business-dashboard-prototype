import type { SupabaseClient } from "@supabase/supabase-js";
import { SYNC_LOCK_TTL_SECONDS } from "./config";
import { assertDbOk } from "./db-write";
import type { OpenInvoiceDraft } from "./invoice-import";
import { invoiceWritePayload } from "./invoice-import";

export async function acquireSyncLease(
  admin: SupabaseClient,
  companyId: string,
  workerId: string
): Promise<boolean> {
  const { data, error } = await admin.rpc("quickbooks_acquire_sync_lease", {
    p_company_id: companyId,
    p_worker_id: workerId,
    p_ttl_seconds: SYNC_LOCK_TTL_SECONDS,
  });
  assertDbOk(error, "ACQUIRE_LEASE");
  return data === true;
}

export async function releaseSyncLease(
  admin: SupabaseClient,
  companyId: string,
  workerId: string
): Promise<void> {
  const { error } = await admin.rpc("quickbooks_release_sync_lease", {
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
    refreshTokenExpiresAt: string | null;
  }
): Promise<boolean> {
  const { data, error } = await admin.rpc("quickbooks_persist_tokens", {
    p_connection_id: params.connectionId,
    p_company_id: params.companyId,
    p_expected_generation: params.expectedGeneration,
    p_refresh_token_enc: params.refreshTokenEnc,
    p_access_token_enc: params.accessTokenEnc,
    p_access_token_expires_at: params.accessTokenExpiresAt,
    p_refresh_token_expires_at: params.refreshTokenExpiresAt,
  });
  assertDbOk(error, "PERSIST_TOKENS");
  return data === true;
}

export async function markSyncing(
  admin: SupabaseClient,
  params: {
    connectionId: string;
    companyId: string;
    expectedGeneration: number;
    workerId: string;
  }
): Promise<boolean> {
  const { data, error } = await admin.rpc("quickbooks_mark_syncing", {
    p_connection_id: params.connectionId,
    p_company_id: params.companyId,
    p_expected_generation: params.expectedGeneration,
    p_worker_id: params.workerId,
  });
  assertDbOk(error, "MARK_SYNCING");
  return data === true;
}

export async function upsertOpenInvoices(
  admin: SupabaseClient,
  params: {
    connectionId: string;
    companyId: string;
    expectedGeneration: number;
    workerId: string;
    syncRunId: string;
    invoices: OpenInvoiceDraft[];
  }
): Promise<boolean> {
  const { data, error } = await admin.rpc("quickbooks_upsert_open_invoices", {
    p_connection_id: params.connectionId,
    p_company_id: params.companyId,
    p_expected_generation: params.expectedGeneration,
    p_worker_id: params.workerId,
    p_sync_run_id: params.syncRunId,
    p_invoices: params.invoices.map(invoiceWritePayload),
  });
  assertDbOk(error, "UPSERT_INVOICES");
  return data === true;
}

export async function finalizeOpenInvoices(
  admin: SupabaseClient,
  params: {
    connectionId: string;
    companyId: string;
    expectedGeneration: number;
    workerId: string;
    syncRunId: string;
    reportingDate: string;
    reportingTimezone: string;
    reportingTimezoneSource: string;
    companyName: string | null;
  }
): Promise<number> {
  const { data, error } = await admin.rpc("quickbooks_finalize_open_invoices", {
    p_connection_id: params.connectionId,
    p_company_id: params.companyId,
    p_expected_generation: params.expectedGeneration,
    p_worker_id: params.workerId,
    p_sync_run_id: params.syncRunId,
    p_reporting_date: params.reportingDate,
    p_reporting_timezone: params.reportingTimezone,
    p_reporting_timezone_source: params.reportingTimezoneSource,
    p_company_name: params.companyName,
  });
  assertDbOk(error, "FINALIZE_INVOICES");
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
    reconnect?: boolean;
  }
): Promise<void> {
  const fn = params.reconnect ? "quickbooks_mark_reconnect_required" : "quickbooks_mark_error";
  const { error } = await admin.rpc(fn, {
    p_connection_id: params.connectionId,
    p_company_id: params.companyId,
    p_expected_generation: params.expectedGeneration,
    p_worker_id: params.workerId,
    p_error_code: params.errorCode,
  });
  assertDbOk(error, "MARK_SYNC_ERROR");
}
