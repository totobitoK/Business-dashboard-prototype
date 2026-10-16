import Link from "next/link";
import { listMemberCompanies, listProjectsForMember } from "@/lib/db/projects.server";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import { liveClientRoutes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export default async function LiveCustomerDashboardPage() {
  const supabase = await createClient();
  const [companies, projects] = await Promise.all([
    listMemberCompanies(),
    listProjectsForMember(),
  ]);

  const companyName = companies[0]?.name ?? "Your company";

  const summaries = await Promise.all(
    projects.map(async (p) => {
      const { data } = await supabase.rpc("member_get_setup_payment_summary", {
        p_project_id: p.id,
      });
      return { projectId: p.id, summary: data };
    })
  );
  const summaryById = new Map(summaries.map((s) => [s.projectId, s.summary]));

  return (
    <div className="space-y-6">
      <PageHeader
        title={companyName}
        description="Your RavenView project hub. Finish onboarding until activation; live operational data is not connected yet."
      />

      <div className="space-y-4">
        {projects.map((p) => {
          const summary = summaryById.get(p.id) as
            | {
                setup_fee: number;
                received: number;
                remaining: number;
                overpayment: number;
                fully_paid: boolean;
              }
            | undefined;
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
                <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50/40 px-4 py-3 text-sm text-ink">
                  <p className="font-semibold">Dashboard activated — awaiting live data</p>
                  <p className="mt-1 text-ink-muted">
                    Your project is active. RavenView has not connected production data sources
                    yet; figures here are not live operational metrics.
                  </p>
                </div>
              ) : (
                <p className="mt-4 text-sm text-ink-muted">
                  Complete onboarding (intake, scope, preview approval, and setup payment). RavenView
                  will activate your dashboard when eligibility is met.
                </p>
              )}

              {summary ? (
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-ink-muted">Setup fee</dt>
                    <dd className="font-medium">
                      <CurrencyAmount amount={Number(summary.setup_fee)} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Recorded payments</dt>
                    <dd className="font-medium">
                      <CurrencyAmount amount={Number(summary.received)} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">
                      {Number(summary.overpayment) > 0 ? "Overpayment" : "Remaining"}
                    </dt>
                    <dd className="font-medium">
                      <CurrencyAmount
                        amount={
                          Number(summary.overpayment) > 0
                            ? Number(summary.overpayment)
                            : Number(summary.remaining)
                        }
                      />
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
