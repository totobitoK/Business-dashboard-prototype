import { listMemberCompanies, listProjectsForMember } from "@/lib/db/projects.server";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";

export default async function LiveCustomerDashboardPage() {
  const [companies, projects] = await Promise.all([
    listMemberCompanies(),
    listProjectsForMember(),
  ]);

  const companyName = companies[0]?.name ?? "Your company";

  return (
    <div className="space-y-6">
      <PageHeader
        title={companyName}
        description="Live project summary for your organization. Editing project fees, status, or membership is not available to customer accounts."
      />

      <div className="space-y-4">
        {projects.map((p) => (
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
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-ink-muted">Setup fee</dt>
                <dd className="font-medium">${Number(p.setup_fee).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Monthly fee</dt>
                <dd className="font-medium">${Number(p.monthly_fee).toLocaleString()}</dd>
              </div>
              {p.dashboard_scope ? (
                <div className="sm:col-span-2">
                  <dt className="text-ink-muted">Dashboard scope</dt>
                  <dd className="mt-1 whitespace-pre-wrap">{p.dashboard_scope}</dd>
                </div>
              ) : null}
            </dl>
          </article>
        ))}
        {projects.length === 0 ? (
          <p className="text-sm text-ink-muted">No projects are linked to your company yet.</p>
        ) : null}
      </div>
    </div>
  );
}
