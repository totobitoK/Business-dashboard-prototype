import type { SupabaseClient } from "@supabase/supabase-js";

/** Matches rows created by admin_create_m3a_disposable_project only. */
export const M3A_DISPOSABLE_PROJECT_EMAIL =
  /^m3a-fixture-[a-f0-9]{8}@fixture\.local$/;

export async function createM3aNonTestDisposableProject(
  admin: SupabaseClient,
  companyId: string,
  label: string
): Promise<string> {
  const { data, error } = await admin.rpc("admin_create_m3a_disposable_project", {
    p_company_id: companyId,
    p_label: label,
  });
  if (error) {
    throw new Error(`admin_create_m3a_disposable_project: ${error.message}`);
  }
  if (typeof data !== "string") {
    throw new Error(
      `admin_create_m3a_disposable_project: invalid id ${JSON.stringify(data)}`
    );
  }
  const { data: row, error: rowErr } = await admin
    .from("client_projects")
    .select("email")
    .eq("id", data)
    .single();
  if (rowErr || !row?.email || !M3A_DISPOSABLE_PROJECT_EMAIL.test(row.email)) {
    throw new Error(
      `admin_create_m3a_disposable_project: unexpected row ${row?.email ?? rowErr?.message}`
    );
  }
  return data;
}

export async function deleteM3aNonTestDisposableProject(
  admin: SupabaseClient,
  projectId: string
): Promise<void> {
  const { error } = await admin.rpc("admin_delete_m3a_disposable_project", {
    p_project_id: projectId,
  });
  if (error) {
    throw new Error(`admin_delete_m3a_disposable_project: ${error.message}`);
  }
}

/** Shared acme seed rows (alex@acme.dev) — must stay unchanged across DB tests. */
export async function fingerprintAcmeSharedSeedProjects(
  admin: SupabaseClient,
  companyId: string
): Promise<string> {
  const { data, error } = await admin
    .from("client_projects")
    .select("id, email, company_name, updated_at, status")
    .eq("company_id", companyId)
    .eq("email", "alex@acme.dev")
    .order("id", { ascending: true });
  if (error) {
    throw new Error(`fingerprintAcmeSharedSeedProjects: ${error.message}`);
  }
  return JSON.stringify(data ?? []);
}
