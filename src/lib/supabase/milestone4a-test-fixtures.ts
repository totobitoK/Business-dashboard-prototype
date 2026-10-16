import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DisposableM4aCompany = {
  companyId: string;
  slug: string;
  ownerUserId: string;
};

export async function createDisposableM4aCompany(
  admin: SupabaseClient,
  ownerUserId: string
): Promise<DisposableM4aCompany> {
  const slug = `m4a-${crypto.randomUUID().slice(0, 8)}`;
  const { data: company, error } = await admin
    .from("companies")
    .insert({ name: `M4A ${slug}`, slug })
    .select("id")
    .single();
  if (error || !company?.id) {
    throw new Error(`createDisposableM4aCompany: ${error?.message ?? "no id"}`);
  }
  const { error: memErr } = await admin.from("company_memberships").insert({
    company_id: company.id,
    user_id: ownerUserId,
    role: "owner",
  });
  if (memErr) throw new Error(`createDisposableM4aCompany membership: ${memErr.message}`);
  return { companyId: company.id as string, slug, ownerUserId };
}

export async function deleteDisposableM4aCompany(
  admin: SupabaseClient,
  companyId: string
): Promise<void> {
  await admin.from("google_calendar_events").delete().eq("company_id", companyId);
  await admin.from("google_calendar_selected_calendars").delete().eq("company_id", companyId);
  await admin.from("google_calendar_connection_secrets").delete().eq("company_id", companyId);
  await admin.from("google_calendar_connections").delete().eq("company_id", companyId);
  await admin.from("google_calendar_sync_locks").delete().eq("company_id", companyId);
  await admin.from("company_memberships").delete().eq("company_id", companyId);
  await admin.from("companies").delete().eq("id", companyId);
}
