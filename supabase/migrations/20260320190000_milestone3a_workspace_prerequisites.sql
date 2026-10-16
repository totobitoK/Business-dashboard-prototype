-- Milestone 3A: definite workspace validation, prerequisite invalidation, approval recheck

CREATE OR REPLACE FUNCTION app_private.is_valid_demo_workspace_id(p_id text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    NULLIF(trim(p_id), '') IN ('ws-alpine-hvac', 'ws-meridian-retail'),
    false
  );
$$;

CREATE OR REPLACE FUNCTION app_private.require_valid_demo_workspace_id(p_id text)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  IF NOT app_private.is_valid_demo_workspace_id(p_id) THEN
    RAISE EXCEPTION 'INVALID_DEMO_WORKSPACE';
  END IF;
END;
$$;

-- Withdraw ready previews with invalid workspace mappings; preserve historical reviews/approvals.
UPDATE public.preview_revisions pr
SET status = 'withdrawn'
WHERE pr.status = 'ready'
  AND NOT app_private.is_valid_demo_workspace_id(pr.demo_workspace_id);

UPDATE public.client_projects cp
SET
  current_ready_preview_id = NULL,
  preview_feedback_unresolved = true,
  updated_at = now()
WHERE cp.current_ready_preview_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.preview_revisions pr
    WHERE pr.id = cp.current_ready_preview_id
      AND pr.status = 'ready'
      AND app_private.is_valid_demo_workspace_id(pr.demo_workspace_id)
  );

CREATE OR REPLACE FUNCTION public.admin_update_build_progress(
  p_project_id uuid,
  p_discovery_complete boolean DEFAULT NULL,
  p_guided_setup_complete boolean DEFAULT NULL,
  p_building_active boolean DEFAULT NULL,
  p_customer_progress_note text DEFAULT NULL,
  p_outstanding_customer_requests text[] DEFAULT NULL,
  p_next_update_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id uuid;
  v_old_discovery timestamptz;
  v_old_guided timestamptz;
  v_invalidate boolean := false;
BEGIN
  IF NOT app_private.is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  PERFORM 1 FROM public.client_projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  v_company_id := app_private.ensure_build_progress_row(p_project_id);

  SELECT bp.discovery_completed_at, bp.guided_setup_completed_at
  INTO v_old_discovery, v_old_guided
  FROM public.project_build_progress bp
  WHERE bp.project_id = p_project_id
  FOR UPDATE;

  IF p_discovery_complete IS FALSE AND v_old_discovery IS NOT NULL THEN
    v_invalidate := true;
  END IF;

  IF p_guided_setup_complete IS FALSE AND v_old_guided IS NOT NULL THEN
    v_invalidate := true;
  END IF;

  UPDATE public.project_build_progress SET
    discovery_completed_at = CASE
      WHEN p_discovery_complete IS TRUE AND discovery_completed_at IS NULL THEN now()
      WHEN p_discovery_complete IS FALSE THEN NULL
      ELSE discovery_completed_at
    END,
    guided_setup_completed_at = CASE
      WHEN p_guided_setup_complete IS TRUE AND guided_setup_completed_at IS NULL THEN now()
      WHEN p_guided_setup_complete IS FALSE THEN NULL
      ELSE guided_setup_completed_at
    END,
    building_active = COALESCE(p_building_active, building_active),
    customer_progress_note = COALESCE(p_customer_progress_note, customer_progress_note),
    outstanding_customer_requests = COALESCE(p_outstanding_customer_requests, outstanding_customer_requests),
    next_update_message = COALESCE(p_next_update_message, next_update_message),
    updated_at = now()
  WHERE project_id = p_project_id;

  IF v_invalidate THEN
    PERFORM app_private.invalidate_preview_eligibility(p_project_id);
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reopen_build(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT app_private.is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  PERFORM 1 FROM public.client_projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  PERFORM app_private.ensure_build_progress_row(p_project_id);

  PERFORM app_private.invalidate_preview_eligibility(p_project_id);

  UPDATE public.project_build_progress SET
    building_active = true,
    updated_at = now()
  WHERE project_id = p_project_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_approve_preview(
  p_project_id uuid,
  p_preview_revision_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id uuid;
  v_ready uuid;
  v_published integer;
  v_feedback_unresolved boolean;
  v_status text;
  v_scope_revision integer;
  v_demo_workspace_id text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_private.require_project_member(p_project_id)) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT company_id, current_ready_preview_id, published_revision, preview_feedback_unresolved
  INTO v_company_id, v_ready, v_published, v_feedback_unresolved
  FROM public.client_projects
  WHERE id = p_project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  PERFORM app_private.assert_scope_eligible_for_preview(p_project_id);
  PERFORM app_private.assert_build_prerequisites_for_preview(p_project_id);

  IF v_ready IS NULL OR v_ready <> p_preview_revision_id THEN
    RAISE EXCEPTION 'STALE_PREVIEW';
  END IF;

  IF v_feedback_unresolved THEN
    RAISE EXCEPTION 'UNRESOLVED_FEEDBACK';
  END IF;

  SELECT pr.status, pr.scope_revision, pr.demo_workspace_id
  INTO v_status, v_scope_revision, v_demo_workspace_id
  FROM public.preview_revisions pr
  WHERE pr.id = p_preview_revision_id AND pr.project_id = p_project_id;

  IF NOT FOUND OR v_status <> 'ready' THEN
    RAISE EXCEPTION 'PREVIEW_NOT_READY';
  END IF;

  PERFORM app_private.require_valid_demo_workspace_id(v_demo_workspace_id);

  IF v_scope_revision IS DISTINCT FROM v_published THEN
    RAISE EXCEPTION 'STALE_SCOPE';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.preview_revision_feedback WHERE preview_revision_id = p_preview_revision_id
  ) THEN
    RAISE EXCEPTION 'UNRESOLVED_FEEDBACK';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.preview_revision_approvals WHERE preview_revision_id = p_preview_revision_id
  ) THEN
    RAISE EXCEPTION 'ALREADY_APPROVED';
  END IF;

  INSERT INTO public.preview_revision_approvals (
    preview_revision_id, project_id, company_id, approved_by
  ) VALUES (
    p_preview_revision_id, p_project_id, v_company_id, (SELECT auth.uid())
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Platform-admin-only: simulate legacy invalid workspace on a preview row (DB tests).
CREATE OR REPLACE FUNCTION public.admin_milestone3a_test_set_preview_workspace(
  p_preview_revision_id uuid,
  p_demo_workspace_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT app_private.is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  UPDATE public.preview_revisions
  SET demo_workspace_id = p_demo_workspace_id
  WHERE id = p_preview_revision_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_milestone3a_test_set_preview_workspace(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_milestone3a_test_set_preview_workspace(uuid, text) TO authenticated;
