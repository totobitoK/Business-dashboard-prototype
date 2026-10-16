import Link from "next/link";
import { listAllProjectsForAdmin } from "@/lib/db/projects.server";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { liveAdminRoutes } from "@/lib/routes";

export default async function LiveAdminClientsPage() {
  const projects = await listAllProjectsForAdmin();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client projects"
        description="Live projects from Supabase. Open a project to edit contact details, draft scope, and publish for customer review."
      />

      <div className="overflow-hidden rounded-lg border border-purple-100 bg-white shadow-soft">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-purple-50 bg-purple-50/40 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Setup</th>
              <th className="px-4 py-3">Monthly</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} className="border-b border-purple-50 last:border-0">
                <td className="px-4 py-3 font-medium">
                  <Link
                    href={liveAdminRoutes.project(p.id)}
                    className="text-purple hover:underline"
                  >
                    {p.company_name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink-muted">
                  {p.contact_name}
                  <span className="block text-xs">{p.email}</span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-4 py-3">${Number(p.setup_fee).toLocaleString()}</td>
                <td className="px-4 py-3">${Number(p.monthly_fee).toLocaleString()}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={liveAdminRoutes.project(p.id)}
                    className="text-sm font-medium text-purple hover:underline"
                  >
                    Manage scope
                  </Link>
                </td>
              </tr>
            ))}
            {projects.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-muted">
                  No projects yet. Run the development seed script to create sample companies.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
