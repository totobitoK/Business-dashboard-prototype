import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isGoogleCalendarIntegrationConfigured, SYNC_RUN_TIME_BUDGET_MS } from "@/lib/google-calendar/config";
import { syncCompanyGoogleCalendar, releaseSyncLock } from "@/lib/google-calendar/sync-company";
import { acquireSyncLease } from "@/lib/google-calendar/sync-lease";
import {
  listCronSyncCandidates,
  recoverStaleSyncingConnections,
} from "@/lib/google-calendar/sync-cron-scheduler";

export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isGoogleCalendarIntegrationConfigured()) {
    return NextResponse.json({ ok: true, skipped: "not_configured" });
  }

  const admin = createServiceClient();
  const recovered = await recoverStaleSyncingConnections(admin);
  const candidates = await listCronSyncCandidates(admin);

  const results: { companyId: string; result: string }[] = [];
  const runStarted = Date.now();

  for (const row of candidates) {
    if (Date.now() - runStarted >= SYNC_RUN_TIME_BUDGET_MS - 2000) {
      results.push({ companyId: row.company_id, result: "cron_time_budget" });
      break;
    }

    const companyId = row.company_id;
    const workerId = `cron-${Date.now()}-${companyId.slice(0, 8)}`;
    const acquired = await acquireSyncLease(admin, companyId, workerId);
    if (!acquired) {
      results.push({ companyId, result: "locked" });
      continue;
    }
    try {
      const sync = await syncCompanyGoogleCalendar(admin, companyId, {
        deadlineMs: Math.min(SYNC_RUN_TIME_BUDGET_MS, 45_000),
      });
      if (sync.ok && sync.partial) {
        results.push({ companyId, result: sync.reason ?? "partial" });
      } else {
        results.push({ companyId, result: sync.ok ? "synced" : sync.reason });
      }
    } finally {
      await releaseSyncLock(admin, companyId, workerId);
    }
  }

  return NextResponse.json({ ok: true, recovered, results });
}
