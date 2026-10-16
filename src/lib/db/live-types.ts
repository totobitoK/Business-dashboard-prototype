export type LiveClientProjectStatus = "pending" | "active" | "archived";

export interface LiveClientProject {
  id: string;
  company_id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  website: string | null;
  status: LiveClientProjectStatus;
  setup_fee: number;
  monthly_fee: number;
  onboarding_path: "full" | "payment-only";
  target_launch_date: string | null;
  dashboard_scope: string | null;
  published_revision: number;
  scope_pending_material_publish: boolean;
  scope_material_published_generation?: number;
  scope_material_review_required?: boolean;
  preview_feedback_unresolved?: boolean;
  current_ready_preview_id?: string | null;
  payment_only_prep_confirmed?: boolean;
  activated_at?: string | null;
  activated_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LiveProjectPayment {
  id: string;
  project_id: string;
  payment_date: string;
  amount: number;
  type: string;
  note: string | null;
  record_source: string;
  payment_method: string | null;
  method_reference: string | null;
  provider_name: string | null;
  external_transaction_id: string | null;
  voided_at: string | null;
  void_reason: string | null;
  replaces_payment_id: string | null;
  created_at: string;
}

export interface LiveProjectBuildProgress {
  project_id: string;
  company_id: string;
  discovery_completed_at: string | null;
  guided_setup_completed_at: string | null;
  building_active: boolean;
  customer_progress_note: string | null;
  outstanding_customer_requests: string[];
  next_update_message: string | null;
  updated_at: string;
}

export interface LivePreviewRevision {
  id: string;
  project_id: string;
  company_id: string;
  preview_revision: number;
  scope_revision_id: string;
  scope_revision: number;
  demo_workspace_id: string | null;
  status: "draft" | "ready" | "withdrawn";
  ready_at: string | null;
  created_at: string;
}

export interface LivePreviewRevisionFeedback {
  id: string;
  preview_revision_id: string;
  project_id: string;
  feedback: string;
  created_at: string;
  submitted_by: string | null;
}

export interface LivePreviewRevisionApproval {
  id: string;
  preview_revision_id: string;
  project_id: string;
  approved_at: string;
  approved_by: string | null;
}

export interface LiveAdminScopeDraft {
  project_id: string;
  company_id: string;
  scope_draft: Record<string, unknown>;
  material_generation: number;
  updated_at: string;
}

export interface LiveProjectIntake {
  project_id: string;
  company_id: string;
  draft: Record<string, unknown>;
  submission: Record<string, unknown> | null;
  form_status: string;
  current_step: string;
  draft_version: number;
  submitted_at: string | null;
  updated_at: string;
}

export interface LiveScopeRevision {
  id: string;
  project_id: string;
  company_id: string;
  revision: number;
  published_at: string;
  setup_fee: number;
  monthly_fee: number;
  accepted_sources_in: string[];
  accepted_screens: string[];
  agreed_scope_summary: string | null;
  dashboard_scope: string | null;
}

export interface LiveScopeAcceptance {
  id: string;
  project_id: string;
  revision: number;
  accepted_at: string;
  acceptance_source: string;
  scope_revision_id: string | null;
  accepted_by: string | null;
}

export interface LiveScopeChangeRequest {
  id: string;
  project_id: string;
  revision: number;
  note: string;
  created_at: string;
}

export interface LiveCompany {
  id: string;
  name: string;
  slug: string;
}

export interface LiveProjectBundle {
  project: LiveClientProject;
  intake: LiveProjectIntake | null;
  publishedScope: LiveScopeRevision | null;
  scopeAcceptance: LiveScopeAcceptance | null;
  scopeChangeRequest: LiveScopeChangeRequest | null;
  adminScopeDraft?: LiveAdminScopeDraft | null;
  buildProgress?: LiveProjectBuildProgress | null;
  readyPreview?: LivePreviewRevision | null;
  readyPreviewFeedback?: LivePreviewRevisionFeedback | null;
  readyPreviewApproval?: LivePreviewRevisionApproval | null;
  previewHistory?: LivePreviewRevision[];
  payments?: LiveProjectPayment[];
  setupPaymentSummary?: import("@/lib/setup-payment-summary").SetupPaymentObligation;
  adminSetupPaymentSummary?: import("@/lib/setup-payment-summary").AdminSetupPaymentSummary;
}
