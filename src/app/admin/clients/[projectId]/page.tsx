import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveProjectScopeEditor } from "@/components/admin/LiveProjectScopeEditor";
import { PageHeader } from "@/components/PageHeader";
import { adminRoutes } from "@/lib/routes";
import { loadProjectBundleForAdmin } from "@/lib/db/project-detail.server";

export default async function LiveAdminProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  let bundle;
  try {
    bundle = await loadProjectBundleForAdmin(projectId);
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (message === "NOT_FOUND" || message === "FORBIDDEN") notFound();
    throw e;
  }

  const p = bundle.project;

  return (
    <div className="space-y-6">
      <PageHeader
        title={p.company_name}
        description={`Contact ${p.contact_name} · ${p.email}`}
      />
      <Link href={adminRoutes.clients} className="text-sm font-medium text-purple hover:underline">
        ← All clients
      </Link>
      <LiveProjectScopeEditor project={p} adminScopeDraft={bundle.adminScopeDraft} />
    </div>
  );
}
