import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { LiveGoogleCalendarPanel } from "@/components/google-calendar/LiveGoogleCalendarPanel";
import type { GoogleCalendarStatus } from "@/components/google-calendar/LiveGoogleCalendarPanel";
import { getGoogleCalendarMembershipRole } from "@/lib/actions/google-calendar";
import { listMemberCompanies } from "@/lib/db/projects.server";
import { isGoogleCalendarIntegrationConfigured } from "@/lib/google-calendar/config";
import { createClient } from "@/lib/supabase/server";

export default async function LiveDashboardSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const sp = await searchParams;
  const companies = await listMemberCompanies();
  const companyId = companies[0]?.id;
  const supabase = await createClient();

  if (!companyId) {
    return (
      <div className="space-y-4">
        <PageHeader title="Settings" description="Company workspace preferences and connections." />
        <p className="text-sm text-ink-muted">No company linked to your account.</p>
      </div>
    );
  }

  const role = await getGoogleCalendarMembershipRole(companyId);
  const isOwner = role === "owner";

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
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage live data connections for your company."
      />
      <p className="text-sm">
        <Link href="/dashboard" className="font-semibold text-purple hover:underline">
          ← Back to dashboard
        </Link>
      </p>
      <LiveGoogleCalendarPanel
        companyId={companyId}
        isOwner={isOwner}
        integrationConfigured={isGoogleCalendarIntegrationConfigured()}
        status={status}
        calendars={(calendars ?? []) as {
          id: string;
          google_calendar_id: string;
          summary: string;
          selected: boolean;
        }[]}
        flashCode={sp.google ?? null}
      />
    </div>
  );
}
