import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isGoogleCalendarIntegrationConfigured } from "@/lib/google-calendar/config";
import {
  releaseSyncLock,
  syncCompanyGoogleCalendar,
  tryAcquireSyncLock,
} from "@/lib/google-calendar/sync-company";

export const maxDuration = 60;

const MAX_COMPANIES_PER_RUN = 5;

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
  const { data: connections, error } = await admin
    .from("google_calendar_connections")
    .select("company_id, status")
    .is("disconnected_at", null)
    .in("status", ["connected", "error"])
    .order("last_sync_at", { ascending: true, nullsFirst: true })
    .limit(MAX_COMPANIES_PER_RUN);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: { companyId: string; result: string }[] = [];
  for (const row of connections ?? []) {
    const companyId = row.company_id as string;
    const workerId = `cron-${Date.now()}-${companyId.slice(0, 8)}`;
    const acquired = await tryAcquireSyncLock(admin, companyId, workerId);
    if (!acquired) {
      results.push({ companyId, result: "locked" });
      continue;
    }
    try {
      const { data: hasSelected } = await admin
        .from("google_calendar_selected_calendars")
        .select("id")
        .eq("company_id", companyId)
        .eq("selected", true)
        .limit(1);
      if (!hasSelected?.length) {
        results.push({ companyId, result: "no_calendars_selected" });
        continue;
      }
      const sync = await syncCompanyGoogleCalendar(admin, companyId);
      results.push({ companyId, result: sync.ok ? "synced" : sync.reason });
    } finally {
      await releaseSyncLock(admin, companyId);
    }
  }

  return NextResponse.json({ ok: true, results });
}
