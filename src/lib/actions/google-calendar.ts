"use server";

import { revalidatePath } from "next/cache";
import { requireCompanyMember, requireCompanyOwner } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isGoogleCalendarIntegrationConfigured } from "@/lib/google-calendar/config";
import { getValidAccessToken } from "@/lib/google-calendar/access-token";
import { listCalendars } from "@/lib/google-calendar/google-api";
import { disconnectGoogleCalendar, purgeGoogleCalendarImportData } from "@/lib/google-calendar/disconnect";
import { loadConnectionByCompany } from "@/lib/google-calendar/connection-store";
import {
  releaseSyncLock,
  syncCompanyGoogleCalendar,
  tryAcquireSyncLock,
} from "@/lib/google-calendar/sync-company";

export type GoogleCalendarActionResult =
  | { ok: true }
  | { ok: false; error: string };

function integrationDisabled(): GoogleCalendarActionResult {
  return { ok: false, error: "Google Calendar is not configured for this environment." };
}

export async function refreshGoogleCalendarListAction(
  companyId: string
): Promise<GoogleCalendarActionResult> {
  if (!isGoogleCalendarIntegrationConfigured()) return integrationDisabled();
  const supabase = await createClient();
  await requireCompanyOwner(supabase, companyId);
  const admin = createServiceClient();
  const conn = await loadConnectionByCompany(admin, companyId);
  if (!conn || conn.status === "disconnected" || conn.disconnected_at) {
    return { ok: false, error: "No active Google Calendar connection." };
  }

  const accessToken = await getValidAccessToken(admin, conn.id, companyId);
  const calendars = await listCalendars(accessToken);
  const rows = calendars.map((c) => ({
    connection_id: conn.id,
    company_id: companyId,
    google_calendar_id: c.id,
    summary: c.summary || c.id,
    updated_at: new Date().toISOString(),
  }));
  if (rows.length > 0) {
    const { error } = await admin
      .from("google_calendar_selected_calendars")
      .upsert(rows, { onConflict: "connection_id,google_calendar_id" });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function saveGoogleCalendarSelectionAction(
  companyId: string,
  selectedCalendarIds: string[]
): Promise<GoogleCalendarActionResult> {
  if (!isGoogleCalendarIntegrationConfigured()) return integrationDisabled();
  const supabase = await createClient();
  await requireCompanyOwner(supabase, companyId);
  const admin = createServiceClient();
  const conn = await loadConnectionByCompany(admin, companyId);
  if (!conn || conn.disconnected_at) {
    return { ok: false, error: "Connect Google Calendar first." };
  }

  const selectedSet = new Set(selectedCalendarIds);
  const { data: allCals, error: listErr } = await admin
    .from("google_calendar_selected_calendars")
    .select("id, google_calendar_id, selected")
    .eq("connection_id", conn.id);
  if (listErr) return { ok: false, error: listErr.message };

  for (const cal of allCals ?? []) {
    const nextSelected = selectedSet.has(cal.google_calendar_id as string);
    if (cal.selected === nextSelected) continue;
    await admin
      .from("google_calendar_selected_calendars")
      .update({
        selected: nextSelected,
        sync_token: nextSelected ? null : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cal.id);
    if (!nextSelected) {
      await admin
        .from("google_calendar_events")
        .delete()
        .eq("company_id", companyId)
        .eq("google_calendar_id", cal.google_calendar_id);
    }
  }

  const workerId = `manual-${Date.now()}`;
  if (await tryAcquireSyncLock(admin, companyId, workerId)) {
    try {
      await syncCompanyGoogleCalendar(admin, companyId);
    } finally {
      await releaseSyncLock(admin, companyId);
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function disconnectGoogleCalendarAction(
  companyId: string
): Promise<GoogleCalendarActionResult> {
  if (!isGoogleCalendarIntegrationConfigured()) return integrationDisabled();
  const supabase = await createClient();
  await requireCompanyOwner(supabase, companyId);
  const admin = createServiceClient();
  const conn = await loadConnectionByCompany(admin, companyId);
  if (!conn) return { ok: true };

  await disconnectGoogleCalendar(admin, companyId, conn.id);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function clearGoogleCalendarForReplaceAction(
  companyId: string
): Promise<GoogleCalendarActionResult> {
  if (!isGoogleCalendarIntegrationConfigured()) return integrationDisabled();
  const supabase = await createClient();
  await requireCompanyOwner(supabase, companyId);
  const admin = createServiceClient();
  const conn = await loadConnectionByCompany(admin, companyId);
  if (!conn) return { ok: true };
  await purgeGoogleCalendarImportData(admin, companyId, conn.id);
  return { ok: true };
}

export async function getGoogleCalendarMembershipRole(
  companyId: string
): Promise<"owner" | "member" | "none"> {
  const supabase = await createClient();
  try {
    await requireCompanyMember(supabase, companyId);
  } catch {
    return "none";
  }
  try {
    await requireCompanyOwner(supabase, companyId);
    return "owner";
  } catch {
    return "member";
  }
}
