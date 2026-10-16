import { requireProjectAccess, requirePlatformAdmin } from "@/lib/auth/authorization";
import {
  CLIENT_PROJECT_ADMIN_COLUMNS,
  CLIENT_PROJECT_MEMBER_COLUMNS,
} from "@/lib/db/project-columns";
import type { LiveProjectBundle } from "@/lib/db/live-types";
import { createClient } from "@/lib/supabase/server";

async function loadRelatedScopeData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  publishedRevision: number
) {
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
    intake: intakeRes.data as LiveProjectBundle["intake"],
    publishedScope: scopeRes.data as LiveProjectBundle["publishedScope"],
    scopeAcceptance: acceptanceRes.data as LiveProjectBundle["scopeAcceptance"],
    scopeChangeRequest: changeRes.data as LiveProjectBundle["scopeChangeRequest"],
  };
}

export async function loadProjectBundle(projectId: string): Promise<LiveProjectBundle> {
  const supabase = await createClient();
  await requireProjectAccess(supabase, projectId);

  const { data: project, error: projectError } = await supabase
    .from("client_projects")
    .select(CLIENT_PROJECT_MEMBER_COLUMNS)
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    throw new Error("NOT_FOUND");
  }

  const publishedRevision = (project.published_revision as number) ?? 0;
  const related = await loadRelatedScopeData(supabase, projectId, publishedRevision);

  return {
    project: project as LiveProjectBundle["project"],
    ...related,
  };
}

export async function loadProjectBundleForAdmin(
  projectId: string
): Promise<LiveProjectBundle> {
  const supabase = await createClient();
  await requirePlatformAdmin(supabase);

  const { data: project, error: projectError } = await supabase
    .from("client_projects")
    .select(CLIENT_PROJECT_ADMIN_COLUMNS)
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    throw new Error("NOT_FOUND");
  }

  const publishedRevision = (project.published_revision as number) ?? 0;
  const [related, adminDraftRes] = await Promise.all([
    loadRelatedScopeData(supabase, projectId, publishedRevision),
    supabase
      .from("admin_project_scope_drafts")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle(),
  ]);

  if (adminDraftRes.error) throw new Error(adminDraftRes.error.message);

  return {
    project: project as LiveProjectBundle["project"],
    ...related,
    adminScopeDraft: adminDraftRes.data as LiveProjectBundle["adminScopeDraft"],
  };
}
