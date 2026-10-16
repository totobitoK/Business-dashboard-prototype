import {
  requireAuthContext,
  requirePlatformAdmin,
  requireProjectAccess,
} from "@/lib/auth/authorization";
import {
  CLIENT_PROJECT_ADMIN_COLUMNS,
  CLIENT_PROJECT_MEMBER_COLUMNS,
} from "@/lib/db/project-columns";
import type { LiveClientProject, LiveCompany } from "@/lib/db/live-types";
import { createClient } from "@/lib/supabase/server";

export async function listAllProjectsForAdmin(): Promise<LiveClientProject[]> {
  const supabase = await createClient();
  await requirePlatformAdmin(supabase);

  const { data, error } = await supabase
    .from("client_projects")
    .select(CLIENT_PROJECT_ADMIN_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as LiveClientProject[];
}

export async function listProjectsForMember(): Promise<LiveClientProject[]> {
  const supabase = await createClient();
  const ctx = await requireAuthContext(supabase);

  if (ctx.companyIds.length === 0) return [];

  const { data, error } = await supabase
    .from("client_projects")
    .select(CLIENT_PROJECT_MEMBER_COLUMNS)
    .in("company_id", ctx.companyIds)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as LiveClientProject[];
}

export async function getProjectByIdForUser(
  projectId: string
): Promise<LiveClientProject> {
  const supabase = await createClient();
  await requireProjectAccess(supabase, projectId);

  const { data, error } = await supabase
    .from("client_projects")
    .select(CLIENT_PROJECT_MEMBER_COLUMNS)
    .eq("id", projectId)
    .single();

  if (error || !data) throw new Error("NOT_FOUND");
  return data as LiveClientProject;
}

export async function listMemberCompanies(): Promise<LiveCompany[]> {
  const supabase = await createClient();
  const ctx = await requireAuthContext(supabase);

  if (ctx.companyIds.length === 0 && !ctx.isPlatformAdmin) return [];

  let query = supabase.from("companies").select("id, name, slug").order("name");
  if (!ctx.isPlatformAdmin) {
    query = query.in("id", ctx.companyIds);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as LiveCompany[];
}
