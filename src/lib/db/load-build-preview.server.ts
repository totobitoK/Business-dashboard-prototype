import type { SupabaseClient } from "@supabase/supabase-js";
import type { LiveProjectBundle } from "@/lib/db/live-types";

export async function loadBuildPreviewData(
  supabase: SupabaseClient,
  projectId: string,
  currentReadyPreviewId: string | null | undefined,
  includeHistory: boolean
): Promise<Pick<
  LiveProjectBundle,
  | "buildProgress"
  | "readyPreview"
  | "readyPreviewFeedback"
  | "readyPreviewApproval"
  | "previewHistory"
>> {
  const [buildRes, historyRes] = await Promise.all([
    supabase.from("project_build_progress").select("*").eq("project_id", projectId).maybeSingle(),
    includeHistory
      ? supabase
          .from("preview_revisions")
          .select("*")
          .eq("project_id", projectId)
          .order("preview_revision", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (buildRes.error) throw new Error(buildRes.error.message);
  if (historyRes.error) throw new Error(historyRes.error.message);

  let readyPreview = null as LiveProjectBundle["readyPreview"];
  let readyPreviewFeedback = null as LiveProjectBundle["readyPreviewFeedback"];
  let readyPreviewApproval = null as LiveProjectBundle["readyPreviewApproval"];

  if (currentReadyPreviewId) {
    const [prevRes, fbRes, apRes] = await Promise.all([
      supabase.from("preview_revisions").select("*").eq("id", currentReadyPreviewId).maybeSingle(),
      supabase
        .from("preview_revision_feedback")
        .select("id, preview_revision_id, project_id, feedback, created_at, submitted_by")
        .eq("preview_revision_id", currentReadyPreviewId)
        .maybeSingle(),
      supabase
        .from("preview_revision_approvals")
        .select("id, preview_revision_id, project_id, approved_at, approved_by")
        .eq("preview_revision_id", currentReadyPreviewId)
        .maybeSingle(),
    ]);
    if (prevRes.error) throw new Error(prevRes.error.message);
    if (fbRes.error) throw new Error(fbRes.error.message);
    if (apRes.error) throw new Error(apRes.error.message);
    readyPreview = prevRes.data as LiveProjectBundle["readyPreview"];
    readyPreviewFeedback = fbRes.data as LiveProjectBundle["readyPreviewFeedback"];
    readyPreviewApproval = apRes.data as LiveProjectBundle["readyPreviewApproval"];
  }

  return {
    buildProgress: buildRes.data as LiveProjectBundle["buildProgress"],
    readyPreview,
    readyPreviewFeedback,
    readyPreviewApproval,
    previewHistory: includeHistory
      ? ((historyRes.data ?? []) as LiveProjectBundle["previewHistory"])
      : undefined,
  };
}
