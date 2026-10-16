import type { SupabaseClient } from "@supabase/supabase-js";
import {
  STALE_SYNCING_RECOVERY_MS,
  SYNC_CRON_MAX_COMPANIES_PER_RUN,
} from "./config";
import { assertDbOk } from "./db-write";

export type CronSyncCandidate = {
  company_id: string;
  connection_id: string;
  status: string;
};

export async function recoverStaleSyncingConnections(admin: SupabaseClient): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_SYNCING_RECOVERY_MS).toISOString();
  const { data, error } = await admin
    .from("google_calendar_connections")
    .update({
      status: "connected",
      syncing_started_at: null,
      last_sync_error_code: "STALE_SYNCING_RECOVERED",
      updated_at: new Date().toISOString(),
    })
    .eq("status", "syncing")
    .lt("syncing_started_at", cutoff)
    .select("company_id");
  assertDbOk(error, "RECOVER_STALE");
  return data?.length ?? 0;
}

export async function listCronSyncCandidates(
  admin: SupabaseClient,
  limit = SYNC_CRON_MAX_COMPANIES_PER_RUN
): Promise<CronSyncCandidate[]> {
  const now = new Date().toISOString();

  const { data: connections, error } = await admin
    .from("google_calendar_connections")
    .select("id, company_id, status, last_sync_at, next_sync_attempt_at, syncing_started_at")
    .is("disconnected_at", null)
    .in("status", ["connected", "error", "syncing"])
    .or(`next_sync_attempt_at.is.null,next_sync_attempt_at.lte.${now}`)
    .order("last_sync_at", { ascending: true, nullsFirst: true })
    .limit(limit * 4);

  assertDbOk(error, "CRON_LIST");

  const eligible: CronSyncCandidate[] = [];
  for (const row of connections ?? []) {
    if (eligible.length >= limit) break;
    const companyId = row.company_id as string;
    const connectionId = row.id as string;

    const { data: selected, error: selErr } = await admin
      .from("google_calendar_selected_calendars")
      .select("id")
      .eq("connection_id", connectionId)
      .eq("selected", true)
      .limit(1);
    assertDbOk(selErr, "CRON_SELECTED");
    if (!selected?.length) continue;

    if (row.status === "syncing" && row.syncing_started_at) {
      const started = new Date(row.syncing_started_at as string).getTime();
      if (Date.now() - started < STALE_SYNCING_RECOVERY_MS) {
        continue;
      }
    }

    eligible.push({
      company_id: companyId,
      connection_id: connectionId,
      status: row.status as string,
    });
  }

  return eligible;
}
