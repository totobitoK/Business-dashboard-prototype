import Link from "next/link";
import { LiveAppointmentsSection } from "@/components/google-calendar/LiveAppointmentsSection";
import type { GoogleCalendarStatus } from "@/components/google-calendar/LiveGoogleCalendarPanel";
import { listMemberCompanies, listProjectsForMember } from "@/lib/db/projects.server";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import { liveClientRoutes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { parseSetupPaymentObligation } from "@/lib/setup-payment-summary";

export default async function LiveCustomerDashboardPage() {
  const supabase = await createClient();
  const [companies, projects] = await Promise.all([
    listMemberCompanies(),
    listProjectsForMember(),
  ]);

  const companyName = companies[0]?.name ?? "Your company";
  const companyId = companies[0]?.id;

  let calendarStatus: GoogleCalendarStatus | null = null;
  let appointments: {
    id: string;
    title: string;
    google_calendar_id: string;
    starts_at: string | null;
    ends_at: string | null;
    all_day: boolean;
    timezone: string | null;
    imported_at: string;
  }[] = [];
  const calendarNames: Record<string, string> = {};

  if (companyId) {
    const { data: statusRaw } = await supabase.rpc("member_get_google_calendar_status", {
      p_company_id: companyId,
    });
    calendarStatus = (statusRaw ?? null) as GoogleCalendarStatus | null;

    const [{ data: appts }, { data: cals }] = await Promise.all([
      supabase.rpc("member_list_google_calendar_appointments", { p_company_id: companyId }),
      supabase
        .from("google_calendar_selected_calendars")
        .select("google_calendar_id, summary")
        .eq("company_id", companyId)
        .eq("selected", true),
    ]);
    appointments = (appts ?? []) as typeof appointments;
    for (const c of cals ?? []) {
      calendarNames[c.google_calendar_id as string] = c.summary as string;
    }
  }

  const summaries = await Promise.all(
    projects.map(async (p) => {
      const { data, error } = await supabase.rpc("member_get_setup_payment_summary", {
        p_project_id: p.id,
      });
      return {
        projectId: p.id,
        summary: parseSetupPaymentObligation(data),
        error: error?.message ?? null,
      };
    })
  );
  const summaryById = new Map(summaries.map((s) => [s.projectId, s]));

  return (
    <div className="space-y-6">
      <PageHeader
        title={companyName}
        description="Your RavenView project hub — onboarding, setup payments, activation, and live Google Calendar appointments."
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link href="/dashboard/settings" className="font-semibold text-purple hover:underline">
          Connections & settings
        </Link>
      </div>

      <LiveAppointmentsSection
        status={calendarStatus}
        appointments={appointments}
        calendarNames={calendarNames}
      />

      <div className="space-y-4">
        {projects.map((p) => {
          const entry = summaryById.get(p.id);
          const summary = entry?.summary;
          const summaryError = entry?.error;
          const isActive = p.status === "active";

          return (
            <article
              key={p.id}
              className="rounded-lg border border-purple-100 bg-white p-5 shadow-soft"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-ink">{p.company_name}</h2>
                  <p className="text-sm text-ink-muted">
                    {p.contact_name} · {p.email}
                  </p>
                </div>
                <StatusBadge status={p.status} />
              </div>

              {isActive ? (
                <div className="mt-4 rounded-lg border border-purple-100 bg-purple-50/30 px-4 py-3 text-sm text-ink">
                  <p className="font-semibold">Dashboard activated</p>
                  <p className="mt-1 text-ink-muted">
                    Setup payment milestones are complete. Connect Google Calendar in settings to
                    see live appointments; other operational metrics will appear as RavenView
                    enables them.
                  </p>
                </div>
              ) : (
                <p className="mt-4 text-sm text-ink-muted">
                  Complete onboarding (intake, scope, preview approval, and setup payment). RavenView
                  will activate your dashboard when eligibility is met.
                </p>
              )}

              {summaryError ? (
                <p className="mt-4 text-sm text-red-800">
                  Setup payment summary could not be loaded. Please refresh or contact RavenView
                  support if this persists.
                </p>
              ) : summary ? (
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-ink-muted">Setup fee</dt>
                    <dd className="font-medium">
                      {summary.fee_confirmed && summary.setup_fee !== null ? (
                        <CurrencyAmount amount={summary.setup_fee} />
                      ) : (
                        <span className="text-ink-muted">Awaiting confirmation</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Recorded payments</dt>
                    <dd className="font-medium">
                      <CurrencyAmount amount={summary.received} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">
                      {summary.fee_confirmed &&
                      summary.overpayment !== null &&
                      summary.overpayment > 0
                        ? "Overpayment"
                        : "Remaining"}
                    </dt>
                    <dd className="font-medium">
                      {summary.fee_confirmed ? (
                        <CurrencyAmount
                          amount={
                            summary.overpayment !== null && summary.overpayment > 0
                              ? summary.overpayment
                              : (summary.remaining ?? 0)
                          }
                        />
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </dd>
                  </div>
                </dl>
              ) : null}

              <Link
                href={liveClientRoutes.onboarding(p.id)}
                className="mt-4 inline-block text-sm font-semibold text-purple hover:underline"
              >
                {isActive ? "View onboarding history →" : "Continue onboarding →"}
              </Link>
            </article>
          );
        })}
        {projects.length === 0 ? (
          <p className="text-sm text-ink-muted">No projects are linked to your company yet.</p>
        ) : null}
      </div>
    </div>
  );
}
