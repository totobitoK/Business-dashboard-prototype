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
  created_at: string;
  updated_at: string;
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
}
