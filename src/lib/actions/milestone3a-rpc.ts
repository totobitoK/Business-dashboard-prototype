"use server";

import { requirePlatformAdmin, requireProjectAccess } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/actions/milestone2-rpc";

function mapPreviewRpcError(message: string): string {
  if (message.includes("FORBIDDEN")) return "You do not have access to this project.";
  if (message.includes("NOT_FOUND")) return "Project not found.";
  if (message.includes("NOTE_REQUIRED")) return "Please describe the changes you need before submitting.";
  if (message.includes("NOTE_TOO_LONG")) return "Feedback is too long. Please shorten your message.";
  if (message.includes("STALE_PREVIEW")) {
    return "This preview revision is no longer current. Refresh and review the latest preview.";
  }
  if (message.includes("PREVIEW_NOT_READY")) {
    return "This preview is not available for review yet.";
  }
  if (message.includes("PREVIEW_NOT_CONFIGURED")) {
    return "Dashboard preview is not configured for this project yet.";
  }
  if (message.includes("UNRESOLVED_FEEDBACK")) {
    return "Submit changes or wait for RavenView to publish a revised preview before approving.";
  }
  if (message.includes("STALE_SCOPE")) {
    return "Scope was updated. Wait for a preview aligned with the latest scope.";
  }
  if (message.includes("ALREADY_APPROVED")) return "You already approved this preview revision.";
  if (message.includes("ALREADY_SUBMITTED")) {
    return "Feedback was already submitted for this preview revision.";
  }
  if (message.includes("SCOPE_NOT_PUBLISHED")) {
    return "Publish scope before marking a preview ready.";
  }
  if (message.includes("SCOPE_NOT_ACCEPTED")) {
    return "Customer must accept scope before preview review.";
  }
  return message;
}

export async function adminUpdateBuildProgressAction(
  projectId: string,
  input: {
    discoveryComplete?: boolean;
    guidedSetupComplete?: boolean;
    buildingActive?: boolean;
    customerProgressNote?: string;
    outstandingCustomerRequests?: string[];
    nextUpdateMessage?: string;
  }
): Promise<ActionResult> {
  const supabase = await createClient();
  await requirePlatformAdmin(supabase);

  const { error } = await supabase.rpc("admin_update_build_progress", {
    p_project_id: projectId,
    p_discovery_complete: input.discoveryComplete ?? null,
    p_guided_setup_complete: input.guidedSetupComplete ?? null,
    p_building_active: input.buildingActive ?? null,
    p_customer_progress_note: input.customerProgressNote ?? null,
    p_outstanding_customer_requests: input.outstandingCustomerRequests ?? null,
    p_next_update_message: input.nextUpdateMessage ?? null,
  });

  if (error) return { ok: false, error: mapPreviewRpcError(error.message) };
  revalidatePath(`/admin/clients/${projectId}`);
  revalidatePath(`/onboarding/${projectId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function adminPublishPreviewReadyAction(
  projectId: string,
  demoWorkspaceId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  await requirePlatformAdmin(supabase);

  const { error } = await supabase.rpc("admin_publish_preview_ready", {
    p_project_id: projectId,
    p_demo_workspace_id: demoWorkspaceId,
  });

  if (error) return { ok: false, error: mapPreviewRpcError(error.message) };
  revalidatePath(`/admin/clients/${projectId}`);
  revalidatePath(`/onboarding/${projectId}`);
  revalidatePath(`/onboarding/${projectId}/preview`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function adminReopenBuildAction(projectId: string): Promise<ActionResult> {
  const supabase = await createClient();
  await requirePlatformAdmin(supabase);

  const { error } = await supabase.rpc("admin_reopen_build", { p_project_id: projectId });
  if (error) return { ok: false, error: mapPreviewRpcError(error.message) };
  revalidatePath(`/admin/clients/${projectId}`);
  revalidatePath(`/onboarding/${projectId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function customerSubmitPreviewFeedbackAction(
  projectId: string,
  previewRevisionId: string,
  feedback: string
): Promise<ActionResult> {
  const supabase = await createClient();
  await requireProjectAccess(supabase, projectId);

  const { error } = await supabase.rpc("customer_submit_preview_feedback", {
    p_project_id: projectId,
    p_preview_revision_id: previewRevisionId,
    p_feedback: feedback,
  });

  if (error) return { ok: false, error: mapPreviewRpcError(error.message) };
  revalidatePath(`/onboarding/${projectId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function customerApprovePreviewAction(
  projectId: string,
  previewRevisionId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  await requireProjectAccess(supabase, projectId);

  const { error } = await supabase.rpc("customer_approve_preview", {
    p_project_id: projectId,
    p_preview_revision_id: previewRevisionId,
  });

  if (error) return { ok: false, error: mapPreviewRpcError(error.message) };
  revalidatePath(`/onboarding/${projectId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
