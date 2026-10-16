"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin, requireProjectAccess } from "@/lib/auth/authorization";
import { liveAdminRoutes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

function mapPaymentRpcError(message: string): string {
  if (message.includes("FORBIDDEN")) return "You do not have permission for this action.";
  if (message.includes("NOT_FOUND")) return "Project or payment not found.";
  if (message.includes("INVALID_AMOUNT")) return "Enter a valid payment amount.";
  if (message.includes("INVALID_DATE")) return "Enter a valid payment date.";
  if (message.includes("METHOD_REQUIRED")) return "Payment method is required.";
  if (message.includes("IDEMPOTENCY_KEY_REQUIRED")) {
    return "Payment could not be recorded safely; refresh and try again.";
  }
  if (message.includes("IDEMPOTENCY_KEY_PAYLOAD_MISMATCH")) {
    return "This payment retry conflicted with a different amount or date. Start a new payment.";
  }
  if (message.includes("NOT_SETUP_PAYMENT")) {
    return "Only setup payments can be voided from this screen.";
  }
  if (message.includes("VOID_REASON_REQUIRED")) return "A void reason is required.";
  if (message.includes("ALREADY_VOIDED")) return "This payment was already voided.";
  if (message.includes("ACTIVATION_BLOCKED")) {
    return message.replace(/^ACTIVATION_BLOCKED:\s*/i, "");
  }
  if (message.includes("ACTIVATION_BLOCKED")) return message;
  return message;
}

export async function adminRecordSetupPaymentAction(input: {
  projectId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  methodReference?: string;
  idempotencyKey: string;
}): Promise<
  | { ok: true; paymentId: string; idempotentReplay: boolean }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  await requirePlatformAdmin(supabase);

  if (!input.idempotencyKey.trim()) {
    return { ok: false, error: "Payment could not be recorded safely; refresh and try again." };
  }

  const { data, error } = await supabase.rpc("admin_record_setup_payment", {
    p_project_id: input.projectId,
    p_amount: input.amount,
    p_payment_date: input.paymentDate,
    p_payment_method: input.paymentMethod,
    p_method_reference: input.methodReference ?? null,
    p_idempotency_key: input.idempotencyKey.trim(),
  });

  if (error) {
    return { ok: false, error: mapPaymentRpcError(error.message) };
  }

  const row = data as {
    payment_id: string;
    idempotent_replay?: boolean;
  };

  revalidatePath(liveAdminRoutes.project(input.projectId));
  revalidatePath(`/onboarding/${input.projectId}`);

  return {
    ok: true,
    paymentId: row.payment_id,
    idempotentReplay: row.idempotent_replay === true,
  };
}

export async function adminVoidSetupPaymentAction(input: {
  paymentId: string;
  projectId: string;
  voidReason: string;
  replacement?: {
    amount: number;
    paymentDate: string;
    paymentMethod: string;
    methodReference?: string;
    idempotencyKey: string;
  };
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  await requirePlatformAdmin(supabase);

  const rep = input.replacement;
  const { error } = await supabase.rpc("admin_void_setup_payment", {
    p_payment_id: input.paymentId,
    p_void_reason: input.voidReason,
    p_replacement_amount: rep?.amount ?? null,
    p_replacement_date: rep?.paymentDate ?? null,
    p_replacement_method: rep?.paymentMethod ?? null,
    p_replacement_reference: rep?.methodReference ?? null,
    p_replacement_idempotency_key: rep?.idempotencyKey?.trim() ?? null,
  });

  if (error) {
    return { ok: false, error: mapPaymentRpcError(error.message) };
  }

  revalidatePath(liveAdminRoutes.project(input.projectId));
  revalidatePath(`/onboarding/${input.projectId}`);
  return { ok: true };
}

export async function adminActivateProjectAction(
  projectId: string
): Promise<
  | { ok: true; alreadyActive: boolean }
  | { ok: false; error: string; blockedReasons?: string[] }
> {
  const supabase = await createClient();
  await requirePlatformAdmin(supabase);

  const { data, error } = await supabase.rpc("admin_activate_project", {
    p_project_id: projectId,
  });

  if (error) {
    const msg = error.message;
    if (msg.includes("ACTIVATION_BLOCKED")) {
      const reasons = msg.replace(/^ACTIVATION_BLOCKED:\s*/i, "").split(/\s+(?=[A-Z])/).filter(Boolean);
      return {
        ok: false,
        error: mapPaymentRpcError(msg),
        blockedReasons: reasons.length ? reasons : [mapPaymentRpcError(msg)],
      };
    }
    return { ok: false, error: mapPaymentRpcError(msg) };
  }

  revalidatePath(liveAdminRoutes.project(projectId));
  revalidatePath(`/onboarding/${projectId}`);
  revalidatePath("/dashboard");

  return {
    ok: true,
    alreadyActive: (data as { already_active?: boolean }).already_active === true,
  };
}

export async function adminGetActivationEligibilityAction(projectId: string): Promise<
  | {
      ok: true;
      canActivate: boolean;
      blockedReasons: string[];
      alreadyActive: boolean;
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  await requirePlatformAdmin(supabase);

  const { data, error } = await supabase.rpc("admin_get_activation_eligibility", {
    p_project_id: projectId,
  });

  if (error) {
    return { ok: false, error: mapPaymentRpcError(error.message) };
  }

  const row = data as {
    can_activate: boolean;
    blocked_reasons: string[];
    already_active: boolean;
  };

  return {
    ok: true,
    canActivate: row.can_activate,
    blockedReasons: row.blocked_reasons ?? [],
    alreadyActive: row.already_active,
  };
}

export async function memberGetSetupPaymentSummaryAction(projectId: string) {
  const supabase = await createClient();
  await requireProjectAccess(supabase, projectId);

  const { data, error } = await supabase.rpc("member_get_setup_payment_summary", {
    p_project_id: projectId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function adminGetSetupPaymentSummaryAction(projectId: string) {
  const supabase = await createClient();
  await requirePlatformAdmin(supabase);

  const { data, error } = await supabase.rpc("admin_get_setup_payment_summary", {
    p_project_id: projectId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
