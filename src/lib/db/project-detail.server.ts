import { requireProjectAccess, requirePlatformAdmin } from "@/lib/auth/authorization";
import type { LiveProjectBundle } from "@/lib/db/live-types";
import { createClient } from "@/lib/supabase/server";

export async function loadProjectBundle(projectId: string): Promise<LiveProjectBundle> {
  const supabase = await createClient();
  await requireProjectAccess(supabase, projectId);

  const { data: project, error: projectError } = await supabase
    .from("client_projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    throw new Error("NOT_FOUND");
  }

  const publishedRevision = (project.published_revision as number) ?? 0;

  const [intakeRes, scopeRes, acceptanceRes, changeRes] = await Promise.all([
    supabase.from("project_intake").select("*").eq("project_id", projectId).maybeSingle(),
    publishedRevision > 0
      ? supabase
          .from("scope_revisions")
          .select("*")
          .eq("project_id", projectId)
          .eq("revision", publishedRevision)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    publishedRevision > 0
      ? supabase
          .from("scope_acceptances")
          .select("*")
          .eq("project_id", projectId)
          .eq("revision", publishedRevision)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    publishedRevision > 0
      ? supabase
          .from("scope_change_requests")
          .select("id, project_id, revision, note, created_at")
          .eq("project_id", projectId)
          .eq("revision", publishedRevision)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (intakeRes.error) throw new Error(intakeRes.error.message);
  if (scopeRes.error) throw new Error(scopeRes.error.message);
  if (acceptanceRes.error) throw new Error(acceptanceRes.error.message);
  if (changeRes.error) throw new Error(changeRes.error.message);

  return {
    project: project as LiveProjectBundle["project"],
    intake: intakeRes.data as LiveProjectBundle["intake"],
    publishedScope: scopeRes.data as LiveProjectBundle["publishedScope"],
    scopeAcceptance: acceptanceRes.data as LiveProjectBundle["scopeAcceptance"],
    scopeChangeRequest: changeRes.data as LiveProjectBundle["scopeChangeRequest"],
  };
}

export async function loadProjectBundleForAdmin(
  projectId: string
): Promise<LiveProjectBundle> {
  const supabase = await createClient();
  await requirePlatformAdmin(supabase);
  return loadProjectBundle(projectId);
}
