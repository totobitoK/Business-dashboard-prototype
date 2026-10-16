"use server";

import { revalidatePath } from "next/cache";
import { requireCompanyMember, requireCompanyOwner } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isGoogleCalendarIntegrationConfigured } from "@/lib/google-calendar/config";
import { getValidAccessToken } from "@/lib/google-calendar/access-token";
import { disconnectGoogleCalendar, purgeGoogleCalendarImportData } from "@/lib/google-calendar/disconnect";
import { loadConnectionByCompany } from "@/lib/google-calendar/connection-store";
import { bumpConnectionSyncGeneration } from "@/lib/google-calendar/connection-generation";
import { acquireSyncLease, releaseSyncLease } from "@/lib/google-calendar/sync-lease";
import { syncCompanyGoogleCalendar } from "@/lib/google-calendar/sync-company";
import { upsertCalendarListPreservingSelection } from "@/lib/google-calendar/calendar-list";

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
  await upsertCalendarListPreservingSelection(admin, {
    connectionId: conn.id,
    companyId,
    accessToken,
  });

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

  let selectionChanged = false;
  for (const cal of allCals ?? []) {
    const nextSelected = selectedSet.has(cal.google_calendar_id as string);
    if (cal.selected === nextSelected) continue;
    selectionChanged = true;
    const { error: updErr } = await admin
      .from("google_calendar_selected_calendars")
      .update({
        selected: nextSelected,
        sync_token: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cal.id);
    if (updErr) return { ok: false, error: updErr.message };
    if (!nextSelected) {
      const { error: delErr } = await admin
        .from("google_calendar_events")
        .delete()
        .eq("company_id", companyId)
        .eq("google_calendar_id", cal.google_calendar_id);
      if (delErr) return { ok: false, error: delErr.message };
    }
  }

  if (selectionChanged) {
    await bumpConnectionSyncGeneration(admin, conn.id);
  }

  const workerId = `manual-${Date.now()}`;
  if (await acquireSyncLease(admin, companyId, workerId)) {
    try {
      await syncCompanyGoogleCalendar(admin, companyId);
    } finally {
      await releaseSyncLease(admin, companyId, workerId);
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
