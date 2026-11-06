"use server";

import { revalidatePath } from "next/cache";
import { requireCompanyMember, requireCompanyOwner } from "@/lib/auth/authorization";
import { getSquareCredentials, isSquareConnectAllowed } from "@/lib/square/config";
import { loadConnectionByCompany, loadSecrets } from "@/lib/square/connection-store";
import { revokeAccessToken } from "@/lib/square/square-api";
import { syncCompanySquare } from "@/lib/square/sync-company";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export type SquareActionResult = { ok: true } | { ok: false; error: string };

const LOCATION_ID = /^[A-Za-z0-9]{1,64}$/;

function revalidate() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
}

export async function syncSquareAction(companyId: string, locationIds: string[]): Promise<SquareActionResult> {
  if (!isSquareConnectAllowed()) {
    return { ok: false, error: "Square is not configured for this environment." };
  }
  const supabase = await createClient();
  await requireCompanyOwner(supabase, companyId);
  const admin = createServiceClient();
  const connection = await loadConnectionByCompany(admin, companyId);
  if (!connection || connection.disconnectedAt || connection.status === "disconnected") {
    return { ok: false, error: "Square is not connected." };
  }
  const ids = [...new Set(locationIds.filter((id) => LOCATION_ID.test(id)))];
  if (ids.length === 0) {
    return { ok: false, error: "Choose at least one active Square location." };
  }
  const { data, error } = await admin.rpc("square_save_location_selection", {
    p_connection_id: connection.id,
    p_company_id: companyId,
    p_location_ids: ids,
  });
  if (error || typeof data !== "number" || data < 0) {
    return { ok: false, error: "Locations could not be saved. Try again after the current sync finishes." };
  }
  if (data === 0) {
    return { ok: false, error: "Choose at least one active Square location." };
  }
  const synced = await syncCompanySquare(admin, companyId);
  revalidate();
  if (!synced.ok) return { ok: false, error: synced.error };
  return { ok: true };
}

export async function disconnectSquareAction(companyId: string): Promise<SquareActionResult> {
  const supabase = await createClient();
  await requireCompanyOwner(supabase, companyId);
  const admin = createServiceClient();
  const connection = await loadConnectionByCompany(admin, companyId);
  if (!connection) return { ok: true };

  const credentials = getSquareCredentials();
  if (credentials && connection.environment === credentials.environment) {
    const secrets = await loadSecrets(admin, connection.id).catch(() => null);
    if (secrets?.accessToken) {
      await revokeAccessToken({
        environment: connection.environment,
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        accessToken: secrets.accessToken,
      }).catch(() => undefined);
    }
  }

  const { error } = await admin.rpc("square_disconnect_company", {
    p_connection_id: connection.id,
    p_company_id: companyId,
  });
  if (error) return { ok: false, error: "Square could not be disconnected." };
  revalidate();
  return { ok: true };
}

export async function getSquareMembershipRole(companyId: string): Promise<"owner" | "member" | "none"> {
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
