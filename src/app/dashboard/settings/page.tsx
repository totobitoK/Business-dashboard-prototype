import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { LiveGoogleCalendarPanel } from "@/components/google-calendar/LiveGoogleCalendarPanel";
import type { GoogleCalendarStatus } from "@/components/google-calendar/LiveGoogleCalendarPanel";
import { LiveQuickBooksPanel } from "@/components/quickbooks/LiveQuickBooksPanel";
import { LiveSquarePanel, type SquareLocationChoice } from "@/components/square/LiveSquarePanel";
import { getGoogleCalendarMembershipRole } from "@/lib/actions/google-calendar";
import { getQuickBooksMembershipRole } from "@/lib/actions/quickbooks";
import { getSquareMembershipRole } from "@/lib/actions/square";
import { listMemberCompanies } from "@/lib/db/projects.server";
import { isGoogleCalendarIntegrationConfigured } from "@/lib/google-calendar/config";
import { isQuickBooksConnectAllowed } from "@/lib/quickbooks/config";
import { isSquareConnectAllowed } from "@/lib/square/config";
import type { SquareStatusPayload } from "@/lib/square/collections-presentation";
import type { QuickBooksStatusPayload } from "@/lib/quickbooks/receivables-presentation";
import { createClient } from "@/lib/supabase/server";

export default async function LiveDashboardSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string; quickbooks?: string; square?: string }>;
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

  const [role, quickBooksRole, squareRole] = await Promise.all([
    getGoogleCalendarMembershipRole(companyId),
    getQuickBooksMembershipRole(companyId),
    getSquareMembershipRole(companyId),
  ]);
  const isOwner = role === "owner";
  const quickBooksOwner = quickBooksRole === "owner";
  const squareOwner = squareRole === "owner";

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

  const { data: quickBooksRaw, error: quickBooksError } = await supabase.rpc(
    "member_get_quickbooks_status",
    { p_company_id: companyId }
  );
  const quickBooksStatus = (quickBooksError ? null : quickBooksRaw) as QuickBooksStatusPayload | null;

  const [{ data: squareRaw, error: squareError }, { data: squareLocations }] = await Promise.all([
    supabase.rpc("member_get_square_status", { p_company_id: companyId }),
    supabase.rpc("member_list_square_locations", { p_company_id: companyId }),
  ]);
  const squareStatus = (squareError ? null : squareRaw) as SquareStatusPayload | null;

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
      <LiveQuickBooksPanel
        companyId={companyId}
        isOwner={quickBooksOwner}
        connectAllowed={isQuickBooksConnectAllowed()}
        status={
          quickBooksStatus ?? {
            connected: false,
            status: "disconnected",
          }
        }
        flashCode={sp.quickbooks ?? null}
      />
      {quickBooksError ? (
        <p className="text-sm text-ink-muted">
          QuickBooks status could not be loaded. Apply the latest database migration, then refresh.
        </p>
      ) : null}
      <LiveSquarePanel
        companyId={companyId}
        isOwner={squareOwner}
        connectAllowed={isSquareConnectAllowed()}
        status={
          squareStatus ?? {
            connected: false,
            status: "disconnected",
          }
        }
        locations={(squareError ? [] : (squareLocations ?? [])) as SquareLocationChoice[]}
        flashCode={sp.square ?? null}
      />
      {squareError ? (
        <p className="text-sm text-ink-muted">
          Square status could not be loaded. Apply the latest database migration, then refresh.
        </p>
      ) : null}
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
