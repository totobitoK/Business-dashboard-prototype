import type { SupabaseClient } from "@supabase/supabase-js";
import { SYNC_LOCK_TTL_MS } from "./config";

const TTL_SECONDS = Math.ceil(SYNC_LOCK_TTL_MS / 1000);

export async function acquireSyncLease(
  admin: SupabaseClient,
  companyId: string,
  workerId: string
): Promise<boolean> {
  const { data, error } = await admin.rpc("google_calendar_acquire_sync_lease", {
    p_company_id: companyId,
    p_worker_id: workerId,
    p_ttl_seconds: TTL_SECONDS,
  });
  if (error) {
    throw new Error(`LEASE_ACQUIRE_FAILED:${error.message}`);
  }
  return data === true;
}

export async function releaseSyncLease(
  admin: SupabaseClient,
  companyId: string,
  workerId: string
): Promise<void> {
  await admin.rpc("google_calendar_release_sync_lease", {
    p_company_id: companyId,
    p_worker_id: workerId,
  });
}
