/** Columns safe for customer / member SELECT on client_projects (no admin draft fields). */
export const CLIENT_PROJECT_MEMBER_COLUMNS =
  "id, company_id, company_name, contact_name, email, phone, website, status, setup_fee, monthly_fee, onboarding_path, target_launch_date, dashboard_scope, published_revision, scope_pending_material_publish, created_at, updated_at";

export const CLIENT_PROJECT_ADMIN_COLUMNS =
  `${CLIENT_PROJECT_MEMBER_COLUMNS}, scope_material_published_generation, scope_material_review_required, preview_feedback_unresolved, current_ready_preview_id`;

export const CLIENT_PROJECT_MEMBER_COLUMNS_WITH_PREVIEW =
  `${CLIENT_PROJECT_MEMBER_COLUMNS}, preview_feedback_unresolved, current_ready_preview_id`;
