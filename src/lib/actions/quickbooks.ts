"use server";

import { revalidatePath } from "next/cache";
import { requireCompanyMember, requireCompanyOwner } from "@/lib/auth/authorization";
import { getQuickBooksCredentials, isQuickBooksConnectAllowed } from "@/lib/quickbooks/config";
import { loadConnectionByCompany, loadSecrets } from "@/lib/quickbooks/connection-store";
import { revokeRefreshToken } from "@/lib/quickbooks/intuit-oauth";
import { syncCompanyQuickBooks } from "@/lib/quickbooks/sync-company";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export type QuickBooksActionResult = { ok: true } | { ok: false; error: string };

function revalidate() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
}

export async function syncQuickBooksAction(companyId: string): Promise<QuickBooksActionResult> {
  if (!isQuickBooksConnectAllowed()) {
    return { ok: false, error: "QuickBooks Online is not configured for this environment." };
  }
  const supabase = await createClient();
  await requireCompanyOwner(supabase, companyId);
  const admin = createServiceClient();
  const result = await syncCompanyQuickBooks(admin, companyId);
  revalidate();
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

export async function disconnectQuickBooksAction(companyId: string): Promise<QuickBooksActionResult> {
  const supabase = await createClient();
  await requireCompanyOwner(supabase, companyId);
  const admin = createServiceClient();
  const connection = await loadConnectionByCompany(admin, companyId);
  if (!connection) return { ok: true };

  const credentials = getQuickBooksCredentials();
  if (credentials && connection.environment === credentials.environment) {
    const secrets = await loadSecrets(admin, connection.id).catch(() => null);
    if (secrets?.refreshToken) {
      await revokeRefreshToken({
        refreshToken: secrets.refreshToken,
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
      }).catch(() => undefined);
    }
  }

  const { error } = await admin.rpc("quickbooks_disconnect_company", {
    p_connection_id: connection.id,
    p_company_id: companyId,
  });
  if (error) return { ok: false, error: "QuickBooks could not be disconnected." };
  revalidate();
  return { ok: true };
}

export async function getQuickBooksMembershipRole(
  companyId: string
): Promise<"owner" | "member" | "none"> {
  const supabase = await createClient();
  try {
    await requireCompanyMember(supabase, companyId);
  } catch {
    return "none";
  }
  try {
    await requireCompanyOwner(supabase, companyId);
    return "owner";
  } catch {
    return "member";
  }
}
