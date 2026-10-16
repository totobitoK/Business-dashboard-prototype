-- Milestone 3A: live build progress + revision-aware preview review

CREATE TABLE public.project_build_progress (
  project_id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  discovery_completed_at timestamptz,
  guided_setup_completed_at timestamptz,
  building_active boolean NOT NULL DEFAULT false,
  customer_progress_note text,
  outstanding_customer_requests text[] NOT NULL DEFAULT '{}',
  next_update_message text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_build_progress_project_company_fkey
    FOREIGN KEY (project_id, company_id)
    REFERENCES public.client_projects (id, company_id) ON DELETE CASCADE
);

CREATE TABLE public.preview_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  company_id uuid NOT NULL,
  preview_revision integer NOT NULL,
  scope_revision_id uuid NOT NULL,
  scope_revision integer NOT NULL,
  demo_workspace_id text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'withdrawn')),
  ready_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT preview_revisions_project_company_fkey
    FOREIGN KEY (project_id, company_id)
    REFERENCES public.client_projects (id, company_id) ON DELETE CASCADE,
  CONSTRAINT preview_revisions_scope_revision_fkey
    FOREIGN KEY (scope_revision_id)
    REFERENCES public.scope_revisions (id) ON DELETE RESTRICT,
  UNIQUE (project_id, preview_revision)
);

CREATE INDEX preview_revisions_project_status_idx
  ON public.preview_revisions (project_id, status);

CREATE TABLE public.preview_revision_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preview_revision_id uuid NOT NULL REFERENCES public.preview_revisions (id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  company_id uuid NOT NULL,
  feedback text NOT NULL,
  submitted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT preview_revision_feedback_project_company_fkey
    FOREIGN KEY (project_id, company_id)
    REFERENCES public.client_projects (id, company_id) ON DELETE CASCADE,
  UNIQUE (preview_revision_id)
);

CREATE TABLE public.preview_revision_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preview_revision_id uuid NOT NULL REFERENCES public.preview_revisions (id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  company_id uuid NOT NULL,
  approved_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT preview_revision_approvals_project_company_fkey
    FOREIGN KEY (project_id, company_id)
    REFERENCES public.client_projects (id, company_id) ON DELETE CASCADE,
  UNIQUE (preview_revision_id)
);

ALTER TABLE public.client_projects
  ADD COLUMN IF NOT EXISTS preview_feedback_unresolved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_ready_preview_id uuid REFERENCES public.preview_revisions (id) ON DELETE SET NULL;

ALTER TABLE public.project_build_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preview_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preview_revision_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preview_revision_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_build_progress_select ON public.project_build_progress
  FOR SELECT TO authenticated
  USING (
    app_private.is_platform_admin()
    OR app_private.is_company_member(company_id)
  );

CREATE POLICY preview_revisions_select ON public.preview_revisions
  FOR SELECT TO authenticated
  USING (
    app_private.is_platform_admin()
    OR app_private.is_company_member(company_id)
  );

CREATE POLICY preview_revision_feedback_select ON public.preview_revision_feedback
  FOR SELECT TO authenticated
  USING (
    app_private.is_platform_admin()
    OR app_private.is_company_member(company_id)
  );

CREATE POLICY preview_revision_approvals_select ON public.preview_revision_approvals
  FOR SELECT TO authenticated
  USING (
    app_private.is_platform_admin()
    OR app_private.is_company_member(company_id)
  );

REVOKE INSERT, UPDATE, DELETE ON public.project_build_progress FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.preview_revisions FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.preview_revision_feedback FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.preview_revision_approvals FROM authenticated, anon;

GRANT SELECT ON public.project_build_progress TO authenticated;
GRANT SELECT ON public.preview_revisions TO authenticated;
GRANT SELECT ON public.preview_revision_feedback TO authenticated;
GRANT SELECT ON public.preview_revision_approvals TO authenticated;

CREATE OR REPLACE FUNCTION app_private.ensure_build_progress_row(p_project_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  SELECT company_id INTO v_company_id FROM public.client_projects WHERE id = p_project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;
  INSERT INTO public.project_build_progress (project_id, company_id)
  VALUES (p_project_id, v_company_id)
  ON CONFLICT (project_id) DO NOTHING;
  RETURN v_company_id;
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

  UPDATE public.client_projects SET
    current_ready_preview_id = NULL,
    preview_feedback_unresolved = true,
    updated_at = now()
  WHERE id = p_project_id
    AND current_ready_preview_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.preview_revisions pr
      WHERE pr.id = current_ready_preview_id
        AND pr.scope_revision_id IS DISTINCT FROM p_new_scope_revision_id
    );

  UPDATE public.client_projects cp SET
    current_ready_preview_id = NULL,
    preview_feedback_unresolved = true
  WHERE cp.id = p_project_id
    AND cp.current_ready_preview_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.preview_revisions pr
      WHERE pr.id = cp.current_ready_preview_id AND pr.status = 'ready'
    );
END;
$$;

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
BEGIN
  IF NOT app_private.is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  v_company_id := app_private.ensure_build_progress_row(p_project_id);

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
  v_ws text;
BEGIN
  IF NOT app_private.is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  v_ws := NULLIF(trim(p_demo_workspace_id), '');
  IF v_ws IS NULL THEN
    RAISE EXCEPTION 'PREVIEW_NOT_CONFIGURED';
  END IF;

  SELECT company_id, published_revision
  INTO v_company_id, v_published
  FROM public.client_projects
  WHERE id = p_project_id
  FOR UPDATE;

  IF NOT FOUND OR v_published IS NULL OR v_published <= 0 THEN
    RAISE EXCEPTION 'SCOPE_NOT_PUBLISHED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.scope_acceptances sa
    WHERE sa.project_id = p_project_id AND sa.revision = v_published
  ) THEN
    RAISE EXCEPTION 'SCOPE_NOT_ACCEPTED';
  END IF;

  SELECT sr.id INTO v_scope_revision_id
  FROM public.scope_revisions sr
  WHERE sr.project_id = p_project_id AND sr.revision = v_published
  LIMIT 1;

  IF v_scope_revision_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_SCOPE_REVISION';
  END IF;

  PERFORM app_private.ensure_build_progress_row(p_project_id);

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
    v_ws, 'ready', now()
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

  UPDATE public.preview_revisions SET status = 'withdrawn'
  WHERE project_id = p_project_id AND status = 'ready';

  UPDATE public.client_projects SET
    current_ready_preview_id = NULL,
    preview_feedback_unresolved = true,
    updated_at = now()
  WHERE id = p_project_id;

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

  IF v_demo_workspace_id IS NULL OR trim(v_demo_workspace_id) = '' THEN
    RAISE EXCEPTION 'PREVIEW_NOT_CONFIGURED';
  END IF;

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

-- Hook scope publish: invalidate previews tied to prior scope revisions
DROP FUNCTION IF EXISTS public.admin_publish_scope(uuid, boolean);

CREATE OR REPLACE FUNCTION public.admin_publish_scope(
  p_project_id uuid,
  p_confirm_scope_review boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id uuid;
  v_draft jsonb;
  v_material_gen integer;
  v_setup numeric(12,2);
  v_monthly numeric(12,2);
  v_sources text[];
  v_screens text[];
  v_summary text;
  v_scope text;
  v_next_revision integer;
  v_revision_id uuid;
  v_review_required boolean;
  v_published integer;
  v_pub_setup numeric(12,2);
  v_pub_monthly numeric(12,2);
  v_pub_summary text;
  v_pub_scope text;
  v_pub_sources text[];
  v_pub_screens text[];
  v_published_slice jsonb;
BEGIN
  IF NOT app_private.is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT
    company_id,
    published_revision,
    scope_material_review_required
  INTO v_company_id, v_published, v_review_required
  FROM public.client_projects
  WHERE id = p_project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  IF v_review_required AND NOT COALESCE(p_confirm_scope_review, false) THEN
    RAISE EXCEPTION 'SCOPE_REVIEW_CONFIRMATION_REQUIRED';
  END IF;

  SELECT scope_draft, material_generation INTO v_draft, v_material_gen
  FROM public.admin_project_scope_drafts
  WHERE project_id = p_project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    v_draft := '{}'::jsonb;
    v_material_gen := 0;
  END IF;

  IF v_review_required AND COALESCE(p_confirm_scope_review, false) THEN
    IF v_published IS NULL OR v_published <= 0 THEN
      RAISE EXCEPTION 'SCOPE_REVIEW_AMBIGUOUS';
    END IF;

    SELECT
      sr.setup_fee, sr.monthly_fee, sr.agreed_scope_summary, sr.dashboard_scope,
      sr.accepted_sources_in, sr.accepted_screens
    INTO
      v_pub_setup, v_pub_monthly, v_pub_summary, v_pub_scope, v_pub_sources, v_pub_screens
    FROM public.scope_revisions sr
    WHERE sr.project_id = p_project_id AND sr.revision = v_published
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'SCOPE_REVIEW_AMBIGUOUS';
    END IF;

    v_published_slice := app_private.scope_material_from_revision(
      v_pub_setup, v_pub_monthly, v_pub_summary, v_pub_scope, v_pub_sources, v_pub_screens
    );

    IF app_private.scope_draft_material_ambiguous(v_draft, v_published_slice) THEN
      RAISE EXCEPTION 'SCOPE_REVIEW_AMBIGUOUS';
    END IF;
  END IF;

  SELECT setup_fee, monthly_fee, dashboard_scope
  INTO v_setup, v_monthly, v_scope
  FROM public.client_projects
  WHERE id = p_project_id;

  v_setup := COALESCE((v_draft->>'setup_fee')::numeric, v_setup);
  v_monthly := COALESCE((v_draft->>'monthly_fee')::numeric, v_monthly);
  v_summary := NULLIF(v_draft->>'agreed_scope_summary', '');
  v_scope := COALESCE(NULLIF(v_draft->>'dashboard_scope', ''), v_scope);
  v_sources := COALESCE(
    ARRAY(SELECT jsonb_array_elements_text(v_draft->'accepted_sources_in')),
    '{}'::text[]
  );
  v_screens := COALESCE(
    ARRAY(SELECT jsonb_array_elements_text(v_draft->'accepted_screens')),
    '{}'::text[]
  );

  SELECT COALESCE(MAX(revision), 0) + 1 INTO v_next_revision
  FROM public.scope_revisions
  WHERE project_id = p_project_id;

  INSERT INTO public.scope_revisions (
    project_id, company_id, revision, setup_fee, monthly_fee,
    accepted_sources_in, accepted_screens, agreed_scope_summary, dashboard_scope
  ) VALUES (
    p_project_id, v_company_id, v_next_revision, v_setup, v_monthly,
    v_sources, v_screens, v_summary, v_scope
  ) RETURNING id INTO v_revision_id;

  UPDATE public.client_projects SET
    setup_fee = v_setup,
    monthly_fee = v_monthly,
    dashboard_scope = v_scope,
    published_revision = v_next_revision,
    scope_material_published_generation = v_material_gen,
    scope_pending_material_publish = false,
    scope_material_review_required = false,
    updated_at = now()
  WHERE id = p_project_id;

  PERFORM app_private.invalidate_preview_eligibility_on_scope_change(p_project_id, v_revision_id);

  RETURN jsonb_build_object(
    'ok', true,
    'revision', v_next_revision,
    'scope_revision_id', v_revision_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_build_progress(
  uuid, boolean, boolean, boolean, text, text[], text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_publish_preview_ready(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_reopen_build(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.customer_submit_preview_feedback(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.customer_approve_preview(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_publish_scope(uuid, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_update_build_progress(
  uuid, boolean, boolean, boolean, text, text[], text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_publish_preview_ready(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reopen_build(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_submit_preview_feedback(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_approve_preview(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_publish_scope(uuid, boolean) TO authenticated;
