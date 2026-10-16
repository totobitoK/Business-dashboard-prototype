-- Milestone 3A corrections: preview eligibility, workspace validation, material-draft invalidation

CREATE OR REPLACE FUNCTION app_private.is_valid_demo_workspace_id(p_id text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT NULLIF(trim(p_id), '') IN ('ws-alpine-hvac', 'ws-meridian-retail');
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

CREATE OR REPLACE FUNCTION app_private.invalidate_preview_eligibility(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.preview_revisions SET status = 'withdrawn'
  WHERE project_id = p_project_id AND status = 'ready';

  UPDATE public.client_projects SET
    current_ready_preview_id = NULL,
    preview_feedback_unresolved = true,
    updated_at = now()
  WHERE id = p_project_id;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.assert_scope_eligible_for_preview(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_published integer;
  v_pending boolean;
  v_review boolean;
BEGIN
  SELECT published_revision, scope_pending_material_publish, scope_material_review_required
  INTO v_published, v_pending, v_review
  FROM public.client_projects
  WHERE id = p_project_id;

  IF v_published IS NULL OR v_published <= 0 THEN
    RAISE EXCEPTION 'SCOPE_NOT_PUBLISHED';
  END IF;

  IF v_pending THEN
    RAISE EXCEPTION 'UNPUBLISHED_MATERIAL';
  END IF;

  IF v_review THEN
    RAISE EXCEPTION 'SCOPE_REVIEW_REQUIRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.scope_acceptances sa
    WHERE sa.project_id = p_project_id AND sa.revision = v_published
  ) THEN
    RAISE EXCEPTION 'SCOPE_NOT_ACCEPTED';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.assert_build_prerequisites_for_preview(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM app_private.ensure_build_progress_row(p_project_id);

  IF NOT EXISTS (
    SELECT 1 FROM public.project_build_progress bp
    WHERE bp.project_id = p_project_id
      AND bp.discovery_completed_at IS NOT NULL
      AND bp.guided_setup_completed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'BUILD_PREREQUISITES_INCOMPLETE';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_save_scope_draft(
  p_project_id uuid,
  p_contact jsonb,
  p_scope_draft jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id uuid;
  v_old jsonb;
  v_material_changed boolean;
BEGIN
  IF NOT app_private.is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT company_id INTO v_company_id FROM public.client_projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  INSERT INTO public.admin_project_scope_drafts (project_id, company_id, scope_draft, material_generation)
  VALUES (p_project_id, v_company_id, '{}'::jsonb, 0)
  ON CONFLICT (project_id) DO NOTHING;

  SELECT scope_draft INTO v_old
  FROM public.admin_project_scope_drafts
  WHERE project_id = p_project_id
  FOR UPDATE;

  v_material_changed := app_private.scope_material_changed(v_old, p_scope_draft);

  UPDATE public.admin_project_scope_drafts SET
    scope_draft = p_scope_draft,
    material_generation = CASE
      WHEN v_material_changed THEN material_generation + 1
      ELSE material_generation
    END,
    updated_at = now()
  WHERE project_id = p_project_id;

  UPDATE public.client_projects SET
    company_name = COALESCE(NULLIF(trim(p_contact->>'company_name'), ''), company_name),
    contact_name = COALESCE(NULLIF(trim(p_contact->>'contact_name'), ''), contact_name),
    email = COALESCE(NULLIF(trim(p_contact->>'email'), ''), email),
    phone = COALESCE(NULLIF(trim(p_contact->>'phone'), ''), phone),
    website = NULLIF(trim(p_contact->>'website'), ''),
    scope_pending_material_publish = CASE
      WHEN v_material_changed THEN true
      ELSE scope_pending_material_publish
    END,
    updated_at = now()
  WHERE id = p_project_id;

  IF v_material_changed THEN
    PERFORM app_private.invalidate_preview_eligibility(p_project_id);
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_publish_preview_ready(
  p_project_id uuid,
  p_demo_workspace_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id uuid;
  v_published integer;
  v_scope_revision_id uuid;
  v_next_preview integer;
  v_preview_id uuid;
BEGIN
  IF NOT app_private.is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  PERFORM app_private.require_valid_demo_workspace_id(p_demo_workspace_id);

  SELECT company_id, published_revision
  INTO v_company_id, v_published
  FROM public.client_projects
  WHERE id = p_project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  PERFORM app_private.assert_scope_eligible_for_preview(p_project_id);
  PERFORM app_private.assert_build_prerequisites_for_preview(p_project_id);

  SELECT sr.id INTO v_scope_revision_id
  FROM public.scope_revisions sr
  WHERE sr.project_id = p_project_id AND sr.revision = v_published
  LIMIT 1;

  IF v_scope_revision_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_SCOPE_REVISION';
  END IF;

  UPDATE public.preview_revisions SET status = 'withdrawn'
  WHERE project_id = p_project_id AND status = 'ready';

  SELECT COALESCE(MAX(preview_revision), 0) + 1 INTO v_next_preview
  FROM public.preview_revisions
  WHERE project_id = p_project_id;

  INSERT INTO public.preview_revisions (
    project_id, company_id, preview_revision, scope_revision_id, scope_revision,
    demo_workspace_id, status, ready_at
  ) VALUES (
    p_project_id, v_company_id, v_next_preview, v_scope_revision_id, v_published,
    trim(p_demo_workspace_id), 'ready', now()
  ) RETURNING id INTO v_preview_id;

  UPDATE public.project_build_progress SET
    building_active = true,
    updated_at = now()
  WHERE project_id = p_project_id;

  UPDATE public.client_projects SET
    current_ready_preview_id = v_preview_id,
    preview_feedback_unresolved = false,
    updated_at = now()
  WHERE id = p_project_id;

  RETURN jsonb_build_object(
    'ok', true,
    'preview_revision_id', v_preview_id,
    'preview_revision', v_next_preview
  );
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

  PERFORM app_private.ensure_build_progress_row(p_project_id);

  PERFORM app_private.invalidate_preview_eligibility(p_project_id);

  UPDATE public.project_build_progress SET
    building_active = true,
    updated_at = now()
  WHERE project_id = p_project_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_submit_preview_feedback(
  p_project_id uuid,
  p_preview_revision_id uuid,
  p_feedback text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id uuid;
  v_trimmed text;
  v_ready uuid;
  v_status text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_private.require_project_member(p_project_id)) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  v_trimmed := trim(COALESCE(p_feedback, ''));
  IF length(v_trimmed) = 0 THEN
    RAISE EXCEPTION 'NOTE_REQUIRED';
  END IF;
  IF length(v_trimmed) > 4000 THEN
    RAISE EXCEPTION 'NOTE_TOO_LONG';
  END IF;

  SELECT company_id, current_ready_preview_id
  INTO v_company_id, v_ready
  FROM public.client_projects
  WHERE id = p_project_id
  FOR UPDATE;

  PERFORM app_private.assert_scope_eligible_for_preview(p_project_id);

  IF v_ready IS NULL OR v_ready <> p_preview_revision_id THEN
    RAISE EXCEPTION 'STALE_PREVIEW';
  END IF;

  SELECT status INTO v_status
  FROM public.preview_revisions
  WHERE id = p_preview_revision_id AND project_id = p_project_id;

  IF v_status IS DISTINCT FROM 'ready' THEN
    RAISE EXCEPTION 'PREVIEW_NOT_READY';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.preview_revision_feedback WHERE preview_revision_id = p_preview_revision_id
  ) THEN
    RAISE EXCEPTION 'ALREADY_SUBMITTED';
  END IF;

  INSERT INTO public.preview_revision_feedback (
    preview_revision_id, project_id, company_id, feedback, submitted_by
  ) VALUES (
    p_preview_revision_id, p_project_id, v_company_id, v_trimmed, (SELECT auth.uid())
  );

  UPDATE public.client_projects SET
    preview_feedback_unresolved = true,
    updated_at = now()
  WHERE id = p_project_id;

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

  PERFORM app_private.assert_scope_eligible_for_preview(p_project_id);

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

CREATE OR REPLACE FUNCTION app_private.invalidate_preview_eligibility_on_scope_change(
  p_project_id uuid,
  p_new_scope_revision_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.preview_revisions pr SET
    status = 'withdrawn'
  WHERE pr.project_id = p_project_id
    AND pr.status = 'ready'
    AND pr.scope_revision_id IS DISTINCT FROM p_new_scope_revision_id;

  UPDATE public.client_projects cp SET
    current_ready_preview_id = NULL,
    preview_feedback_unresolved = true,
    updated_at = now()
  WHERE cp.id = p_project_id
    AND (
      cp.current_ready_preview_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.preview_revisions pr
        WHERE pr.id = cp.current_ready_preview_id
          AND (pr.status <> 'ready' OR pr.scope_revision_id IS DISTINCT FROM p_new_scope_revision_id)
      )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_save_scope_draft(uuid, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_save_scope_draft(uuid, jsonb, jsonb) TO authenticated;
