"use server";

import { requirePlatformAdmin, requireProjectAccess } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import type { ClientOnboardingAnswers, ClientOnboardingDraft } from "@/lib/types";
import { toFullAnswers } from "@/lib/onboarding-form";
import { revalidatePath } from "next/cache";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type SaveDraftResult =
  | { ok: true; draftVersion: number }
  | { ok: false; error: string };

function mapRpcError(message: string): string {
  if (message.includes("VERSION_CONFLICT")) {
    return "This draft is out of date. Refresh the page and try again.";
  }
  if (message.includes("INTAKE_SUBMITTED")) {
    return "Intake was already submitted and cannot be edited.";
  }
  if (message.includes("STALE_REVISION")) {
    return "Scope was updated. Refresh and review the latest revision.";
  }
  if (message.includes("FORBIDDEN")) return "You do not have access to this project.";
  if (message.includes("NOT_FOUND")) return "Project not found.";
  if (message.includes("ALREADY_ACCEPTED")) return "This scope revision was already accepted.";
  if (message.includes("INVALID_SCOPE_REVISION")) {
    return "Scope revision does not match the published snapshot.";
  }
  if (message.includes("NOTE_REQUIRED")) return "Please describe the changes you need.";
  if (message.includes("UNPUBLISHED_MATERIAL")) {
    return "Scope is being updated. Wait for RavenView to publish the latest revision before accepting.";
  }
  if (message.includes("SCOPE_REVIEW_REQUIRED")) {
    return "Scope needs an admin review before it can be accepted. Contact RavenView for help.";
  }
  if (message.includes("INTAKE_VALIDATION") || message.includes("VALIDATION_ERROR")) {
    const detail = message.split(":").slice(1).join(":").trim();
    return detail || "Please complete all required intake fields.";
  }
  return message;
}

function intakePayloadFromDraft(draft: ClientOnboardingDraft): Record<string, unknown> {
  return {
    ...draft.answers,
    currentStep: draft.currentStep,
    updatedAt: draft.updatedAt,
    answers: draft.answers,
  };
}

export async function saveIntakeDraftAction(
  projectId: string,
  expectedVersion: number,
  draft: ClientOnboardingDraft
): Promise<SaveDraftResult> {
  const supabase = await createClient();
  await requireProjectAccess(supabase, projectId);

  const step = draft.currentStep === "review" ? "review" : String(draft.currentStep);
  const { data, error } = await supabase.rpc("customer_save_intake_draft", {
    p_project_id: projectId,
    p_expected_version: expectedVersion,
    p_current_step: step,
    p_draft: intakePayloadFromDraft(draft),
  });

  if (error) {
    return { ok: false, error: mapRpcError(error.message) };
  }

  const draftVersion = (data as { draft_version?: number })?.draft_version ?? expectedVersion + 1;
  revalidatePath(`/onboarding/${projectId}`);
  revalidatePath("/dashboard");
  return { ok: true, draftVersion };
}

export async function submitIntakeAction(
  projectId: string,
  expectedVersion: number,
  answers: ClientOnboardingAnswers
): Promise<ActionResult> {
  const supabase = await createClient();
  await requireProjectAccess(supabase, projectId);

  const submission = {
    ...toFullAnswers(answers),
    submittedAt: new Date().toISOString(),
  };

  const { error } = await supabase.rpc("customer_submit_intake", {
    p_project_id: projectId,
    p_expected_version: expectedVersion,
    p_submission: submission,
  });

  if (error) {
    return { ok: false, error: mapRpcError(error.message) };
  }

  revalidatePath(`/onboarding/${projectId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export type AdminScopeDraftInput = {
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  website: string;
  setup_fee: number;
  monthly_fee: number;
  agreed_scope_summary: string;
  dashboard_scope: string;
  accepted_sources_in: string[];
  accepted_screens: string[];
};

export async function adminSaveScopeDraftAction(
  projectId: string,
  contact: Pick<
    AdminScopeDraftInput,
    "company_name" | "contact_name" | "email" | "phone" | "website"
  >,
  scopeDraft: Omit<
    AdminScopeDraftInput,
    "company_name" | "contact_name" | "email" | "phone" | "website"
  >
): Promise<ActionResult> {
  const supabase = await createClient();
  await requirePlatformAdmin(supabase);

  const { error } = await supabase.rpc("admin_save_scope_draft", {
    p_project_id: projectId,
    p_contact: contact,
    p_scope_draft: scopeDraft,
  });

  if (error) {
    return { ok: false, error: mapRpcError(error.message) };
  }

  revalidatePath(`/admin/clients/${projectId}`);
  revalidatePath(`/onboarding/${projectId}`);
  return { ok: true };
}

export async function adminPublishScopeAction(projectId: string): Promise<ActionResult> {
  const supabase = await createClient();
  await requirePlatformAdmin(supabase);

  const { error } = await supabase.rpc("admin_publish_scope", {
    p_project_id: projectId,
  });

  if (error) {
    return { ok: false, error: mapRpcError(error.message) };
  }

  revalidatePath(`/admin/clients/${projectId}`);
  revalidatePath(`/onboarding/${projectId}`);
  return { ok: true };
}

export async function customerAcceptScopeAction(
  projectId: string,
  revision: number,
  scopeRevisionId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  await requireProjectAccess(supabase, projectId);

  const { error } = await supabase.rpc("customer_accept_scope", {
    p_project_id: projectId,
    p_revision: revision,
    p_scope_revision_id: scopeRevisionId,
  });

  if (error) {
    return { ok: false, error: mapRpcError(error.message) };
  }

  revalidatePath(`/onboarding/${projectId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function customerRequestScopeChangesAction(
  projectId: string,
  revision: number,
  note: string
): Promise<ActionResult> {
  const supabase = await createClient();
  await requireProjectAccess(supabase, projectId);

  const { error } = await supabase.rpc("customer_request_scope_changes", {
    p_project_id: projectId,
    p_revision: revision,
    p_note: note,
  });

  if (error) {
    return { ok: false, error: mapRpcError(error.message) };
  }

  revalidatePath(`/onboarding/${projectId}`);
  return { ok: true };
}
