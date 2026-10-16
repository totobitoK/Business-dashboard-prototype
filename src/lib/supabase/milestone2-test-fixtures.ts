import type { SupabaseClient } from "@supabase/supabase-js";

export async function createMilestone2TestProject(
  admin: SupabaseClient,
  companyId: string,
  label: string
): Promise<string> {
  const { data, error } = await admin.rpc("admin_create_milestone2_test_project", {
    p_company_id: companyId,
    p_label: label,
  });
  if (error) {
    throw new Error(`admin_create_milestone2_test_project: ${error.message}`);
  }
  if (typeof data !== "string") {
    throw new Error(`admin_create_milestone2_test_project: invalid id ${JSON.stringify(data)}`);
  }
  const { data: row, error: rowErr } = await admin
    .from("client_projects")
    .select("email")
    .eq("id", data)
    .single();
  if (rowErr || !row?.email?.startsWith("m2-") || !row.email.endsWith("@test.local")) {
    throw new Error(
      `admin_create_milestone2_test_project: expected m2 test row, got ${row?.email ?? rowErr?.message}`
    );
  }
  return data;
}

export async function deleteMilestone2TestProject(
  admin: SupabaseClient,
  projectId: string
): Promise<void> {
  const { error } = await admin.rpc("admin_delete_milestone2_test_project", {
    p_project_id: projectId,
  });
  if (error) {
    throw new Error(`admin_delete_milestone2_test_project: ${error.message}`);
  }
}

export async function readCompanyIdBySlug(
  admin: SupabaseClient,
  slug: string
): Promise<string> {
  const { data, error } = await admin.from("companies").select("id").eq("slug", slug).single();
  if (error || !data?.id) {
    throw new Error(`Could not resolve company id for slug ${slug}.`);
  }
  return data.id as string;
}

export async function setMilestone2TestScopeFlags(
  admin: SupabaseClient,
  projectId: string,
  pending: boolean,
  reviewRequired: boolean
): Promise<void> {
  const { error } = await admin.rpc("admin_milestone2_test_set_scope_flags", {
    p_project_id: projectId,
    p_pending_material_publish: pending,
    p_material_review_required: reviewRequired,
  });
  if (error) {
    throw new Error(`admin_milestone2_test_set_scope_flags: ${error.message}`);
  }
}

export async function setMilestone2TestAdminScopeDraft(
  admin: SupabaseClient,
  projectId: string,
  scopeDraft: Record<string, unknown>
): Promise<void> {
  const { error } = await admin.rpc("admin_milestone2_test_set_admin_scope_draft", {
    p_project_id: projectId,
    p_scope_draft: scopeDraft,
  });
  if (error) {
    throw new Error(`admin_milestone2_test_set_admin_scope_draft: ${error.message}`);
  }
}
