import { LiveGoogleCalendarPanel } from "@/components/google-calendar/LiveGoogleCalendarPanel";
import type { GoogleCalendarStatus } from "@/components/google-calendar/LiveGoogleCalendarPanel";
import { getGoogleCalendarMembershipRole } from "@/lib/actions/google-calendar";
import { isGoogleCalendarIntegrationConfigured } from "@/lib/google-calendar/config";
import { createClient } from "@/lib/supabase/server";

export async function LiveOnboardingGoogleCalendarSection({
  companyId,
  flashCode,
}: {
  companyId: string;
  flashCode?: string | null;
}) {
  const supabase = await createClient();
  const role = await getGoogleCalendarMembershipRole(companyId);
  const { data: statusRaw } = await supabase.rpc("member_get_google_calendar_status", {
    p_company_id: companyId,
  });
  const status = (statusRaw ?? {
    connected: false,
    status: "disconnected",
    google_email: null,
    last_sync_at: null,
    selected_calendar_count: 0,
  }) as GoogleCalendarStatus;
  const { data: calendars } = await supabase
    .from("google_calendar_selected_calendars")
    .select("id, google_calendar_id, summary, selected")
    .eq("company_id", companyId)
    .order("summary");

  return (
    <LiveGoogleCalendarPanel
      companyId={companyId}
      isOwner={role === "owner"}
      integrationConfigured={isGoogleCalendarIntegrationConfigured()}
      status={status}
      calendars={(calendars ?? []) as {
        id: string;
        google_calendar_id: string;
        summary: string;
        selected: boolean;
      }[]}
      flashCode={flashCode}
    />
  );
}
