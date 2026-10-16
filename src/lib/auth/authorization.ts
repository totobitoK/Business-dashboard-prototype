import type { SupabaseClient, User } from "@supabase/supabase-js";

export type AuthContext = {
  user: User;
  isPlatformAdmin: boolean;
  companyIds: string[];
};

export async function getAuthContext(
  supabase: SupabaseClient
): Promise<AuthContext | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  const [{ data: adminRow }, { data: memberships }] = await Promise.all([
    supabase.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle(),
    supabase.from("company_memberships").select("company_id").eq("user_id", user.id),
  ]);

  return {
    user,
    isPlatformAdmin: Boolean(adminRow),
    companyIds: (memberships ?? []).map((m) => m.company_id as string),
  };
}

export async function requireAuthContext(
  supabase: SupabaseClient
): Promise<AuthContext> {
  const ctx = await getAuthContext(supabase);
  if (!ctx) {
    throw new Error("UNAUTHORIZED");
  }
  return ctx;
}

export async function requirePlatformAdmin(
  supabase: SupabaseClient
): Promise<AuthContext> {
  const ctx = await requireAuthContext(supabase);
  if (!ctx.isPlatformAdmin) {
    throw new Error("FORBIDDEN");
  }
  return ctx;
}

export async function requireCompanyMember(
  supabase: SupabaseClient,
  companyId: string
): Promise<AuthContext> {
  const ctx = await requireAuthContext(supabase);
  if (ctx.isPlatformAdmin || ctx.companyIds.includes(companyId)) {
    return ctx;
  }
  throw new Error("FORBIDDEN");
}

export async function requireProjectAccess(
  supabase: SupabaseClient,
  projectId: string
): Promise<{ ctx: AuthContext; project: { id: string; company_id: string } }> {
  const ctx = await requireAuthContext(supabase);
  const { data: project, error } = await supabase
    .from("client_projects")
    .select("id, company_id")
    .eq("id", projectId)
    .maybeSingle();

  if (error || !project) {
    throw new Error("NOT_FOUND");
  }

  if (
    !ctx.isPlatformAdmin &&
    !ctx.companyIds.includes(project.company_id as string)
  ) {
    throw new Error("FORBIDDEN");
  }

  return { ctx, project: project as { id: string; company_id: string } };
}
