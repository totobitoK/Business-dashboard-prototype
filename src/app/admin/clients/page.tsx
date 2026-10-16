import { listAllProjectsForAdmin } from "@/lib/db/projects.server";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";

export default async function LiveAdminClientsPage() {
  const projects = await listAllProjectsForAdmin();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client projects"
        description="Live data from Supabase. This milestone is view-only — manage drawer actions are not enabled here."
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
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} className="border-b border-purple-50 last:border-0">
                <td className="px-4 py-3 font-medium">{p.company_name}</td>
                <td className="px-4 py-3 text-ink-muted">
                  {p.contact_name}
                  <span className="block text-xs">{p.email}</span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-4 py-3">${Number(p.setup_fee).toLocaleString()}</td>
                <td className="px-4 py-3">${Number(p.monthly_fee).toLocaleString()}</td>
              </tr>
            ))}
            {projects.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-muted">
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
