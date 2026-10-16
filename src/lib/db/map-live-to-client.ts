import type {
  LiveProjectBundle,
  LiveScopeRevision,
} from "@/lib/db/live-types";
import type {
  Client,
  ClientOnboardingAnswers,
  ClientOnboardingDraft,
  ClientOnboardingSubmission,
  OnboardingFormStatus,
  PublishedScopeSnapshot,
} from "@/lib/types";

function asOnboardingFormStatus(status: string): OnboardingFormStatus {
  if (status === "submitted") return "submitted";
  if (status === "in-progress") return "in-progress";
  return "not-started";
}

function parseDraft(raw: Record<string, unknown>, currentStep: string): ClientOnboardingDraft | undefined {
  const answers = (raw.answers ?? raw) as Partial<ClientOnboardingAnswers>;
  const stepRaw = raw.currentStep ?? currentStep;
  const step =
    stepRaw === "review" || stepRaw === "1" || stepRaw === "2" || stepRaw === "3"
      ? stepRaw
      : currentStep === "review"
        ? "review"
        : (Number(currentStep) as 1 | 2 | 3) || 1;

  if (Object.keys(raw).length === 0 && !currentStep) return undefined;

  return {
    currentStep: step === "review" ? "review" : (Number(step) as 1 | 2 | 3) || 1,
    answers,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
  };
}

function parseSubmission(raw: Record<string, unknown> | null): ClientOnboardingSubmission | undefined {
  if (!raw || Object.keys(raw).length === 0) return undefined;
  return raw as unknown as ClientOnboardingSubmission;
}

function scopeRevisionToSnapshot(rev: LiveScopeRevision): PublishedScopeSnapshot {
  return {
    revision: rev.revision,
    publishedAt: rev.published_at,
    setupFee: Number(rev.setup_fee),
    monthlyFee: Number(rev.monthly_fee),
    acceptedSourcesIn: rev.accepted_sources_in ?? [],
    acceptedScreens: rev.accepted_screens ?? [],
    agreedScopeSummary: rev.agreed_scope_summary ?? undefined,
    dashboardScope: rev.dashboard_scope ?? undefined,
    revisionRowId: rev.id,
  };
}

/** Map live DB rows to the demo `Client` shape for shared onboarding UI. */
export function mapLiveProjectBundleToClient(bundle: LiveProjectBundle): Client {
  const p = bundle.project;
  const intake = bundle.intake;
  const published = bundle.publishedScope;
  const acceptance = bundle.scopeAcceptance;
  const changeReq = bundle.scopeChangeRequest;

  const draft = intake
    ? parseDraft(intake.draft ?? {}, intake.current_step)
    : undefined;
  const submission = intake ? parseSubmission(intake.submission) : undefined;
  const formStatus = intake
    ? asOnboardingFormStatus(intake.form_status)
    : submission
      ? "submitted"
      : "not-started";

  const publishedSnapshot = published ? scopeRevisionToSnapshot(published) : undefined;

  const completedSteps =
    formStatus === "submitted" ? (["requirements-submitted"] as const) : [];

  return {
    id: p.id,
    company: p.company_name,
    contactName: p.contact_name,
    email: p.email,
    phone: p.phone,
    website: p.website ?? undefined,
    dashboardScope: p.dashboard_scope ?? undefined,
    status: p.status,
    setupFee: Number(p.setup_fee),
    monthlyFee: Number(p.monthly_fee),
    onboardingPath: p.onboarding_path,
    completedSteps: [...completedSteps],
    setupPaidAmount: 0,
    subscriptionActive: false,
    payments: [],
    notes: [],
    files: [],
    createdAt: p.created_at,
    onboardingFormStatus: formStatus,
    onboardingDraft: draft,
    onboardingSubmission: submission,
    scopeRevision:
      p.published_revision > 0 && p.scope_pending_material_publish
        ? p.published_revision + 1
        : p.published_revision,
    publishedScopeRevision:
      p.published_revision > 0 ? p.published_revision : undefined,
    scopePublishedAt: published?.published_at,
    publishedScopeSnapshot: publishedSnapshot,
    scopeCustomerAcceptedAt:
      acceptance?.acceptance_source === "customer" ? acceptance.accepted_at : undefined,
    scopeCustomerAcceptedRevision:
      acceptance?.acceptance_source === "customer" ? acceptance.revision : undefined,
    scopeCustomerAcceptanceSource:
      acceptance?.acceptance_source === "customer" ? "customer" : undefined,
    scopeChangeRequestAt: changeReq?.created_at,
    scopeChangeRequestNote: changeReq?.note,
    acceptedSourcesIn: published?.accepted_sources_in ?? [],
    acceptedScreens: published?.accepted_screens ?? [],
    agreedScopeSummary: published?.agreed_scope_summary ?? undefined,
  };
}

export function intakeDraftVersion(bundle: LiveProjectBundle): number {
  return bundle.intake?.draft_version ?? 1;
}

export function publishedScopeRevisionRowId(bundle: LiveProjectBundle): string | undefined {
  return bundle.publishedScope?.id;
}
