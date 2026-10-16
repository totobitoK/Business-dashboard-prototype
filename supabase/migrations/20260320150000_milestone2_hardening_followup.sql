-- Milestone 2 follow-up: intake first-save locking, scope publish-state repair

-- ---------------------------------------------------------------------------
-- Normalized scope material comparison
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_private.normalize_scope_fee(p jsonb, p_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p ? p_key AND NULLIF(trim(p->>p_key), '') IS NOT NULL THEN
      trim(to_char((p->>p_key)::numeric, 'FM999999990.00'))
    ELSE ''
  END;
$$;

CREATE OR REPLACE FUNCTION app_private.normalize_scope_string_array(p jsonb, p_key text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_agg(val ORDER BY val)
      FROM jsonb_array_elements_text(COALESCE(p->p_key, '[]'::jsonb)) AS t(val)
    ),
    '[]'::jsonb
  );
$$;

CREATE OR REPLACE FUNCTION app_private.scope_material_slice(p jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'setup_fee', app_private.normalize_scope_fee(COALESCE(p, '{}'::jsonb), 'setup_fee'),
    'monthly_fee', app_private.normalize_scope_fee(COALESCE(p, '{}'::jsonb), 'monthly_fee'),
    'agreed_scope_summary', COALESCE(NULLIF(trim(COALESCE(p, '{}'::jsonb)->>'agreed_scope_summary'), ''), ''),
    'dashboard_scope', COALESCE(NULLIF(trim(COALESCE(p, '{}'::jsonb)->>'dashboard_scope'), ''), ''),
    'accepted_sources_in', app_private.normalize_scope_string_array(COALESCE(p, '{}'::jsonb), 'accepted_sources_in'),
    'accepted_screens', app_private.normalize_scope_string_array(COALESCE(p, '{}'::jsonb), 'accepted_screens')
  );
$$;

CREATE OR REPLACE FUNCTION app_private.scope_material_from_revision(
  p_setup numeric,
  p_monthly numeric,
  p_summary text,
  p_scope text,
  p_sources text[],
  p_screens text[]
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT app_private.scope_material_slice(
    jsonb_build_object(
      'setup_fee', p_setup,
      'monthly_fee', p_monthly,
      'agreed_scope_summary', COALESCE(p_summary, ''),
      'dashboard_scope', COALESCE(p_scope, ''),
      'accepted_sources_in', to_jsonb(COALESCE(p_sources, '{}'::text[])),
      'accepted_screens', to_jsonb(COALESCE(p_screens, '{}'::text[]))
    )
  );
$$;

CREATE OR REPLACE FUNCTION app_private.scope_draft_material_ambiguous(
  p_draft jsonb,
  p_published_slice jsonb
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT
    app_private.scope_material_slice(COALESCE(p_draft, '{}'::jsonb))
      = app_private.scope_material_slice('{}'::jsonb)
    AND p_published_slice <> app_private.scope_material_slice('{}'::jsonb)
    AND NOT (
      (COALESCE(p_draft, '{}'::jsonb) ? 'setup_fee')
      OR (COALESCE(p_draft, '{}'::jsonb) ? 'monthly_fee')
      OR NULLIF(trim(COALESCE(p_draft, '{}'::jsonb)->>'agreed_scope_summary'), '') IS NOT NULL
      OR NULLIF(trim(COALESCE(p_draft, '{}'::jsonb)->>'dashboard_scope'), '') IS NOT NULL
      OR jsonb_array_length(COALESCE(p_draft->'accepted_sources_in', '[]'::jsonb)) > 0
      OR jsonb_array_length(COALESCE(p_draft->'accepted_screens', '[]'::jsonb)) > 0
    );
$$;

ALTER TABLE public.client_projects
  ADD COLUMN IF NOT EXISTS scope_material_review_required boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION app_private.repair_project_scope_publish_state(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_published integer;
  v_draft jsonb;
  v_material_gen integer;
  v_pub_setup numeric(12,2);
  v_pub_monthly numeric(12,2);
  v_pub_summary text;
  v_pub_scope text;
  v_pub_sources text[];
  v_pub_screens text[];
  v_published_slice jsonb;
  v_draft_slice jsonb;
  v_ambiguous boolean;
  v_material_differs boolean;
BEGIN
  SELECT cp.published_revision
  INTO v_published
  FROM public.client_projects cp
  WHERE cp.id = p_project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT d.scope_draft, d.material_generation
  INTO v_draft, v_material_gen
  FROM public.admin_project_scope_drafts d
  WHERE d.project_id = p_project_id;

  IF NOT FOUND THEN
    v_draft := '{}'::jsonb;
    v_material_gen := 0;
  END IF;

  IF v_published IS NULL OR v_published <= 0 THEN
    UPDATE public.client_projects SET
      scope_material_published_generation = 0,
      scope_pending_material_publish = false,
      scope_material_review_required = false,
      updated_at = now()
    WHERE id = p_project_id;
    RETURN;
  END IF;

  SELECT
    sr.setup_fee,
    sr.monthly_fee,
    sr.agreed_scope_summary,
    sr.dashboard_scope,
    sr.accepted_sources_in,
    sr.accepted_screens
  INTO
    v_pub_setup,
    v_pub_monthly,
    v_pub_summary,
    v_pub_scope,
    v_pub_sources,
    v_pub_screens
  FROM public.scope_revisions sr
  WHERE sr.project_id = p_project_id
    AND sr.revision = v_published
  LIMIT 1;

  IF NOT FOUND THEN
    UPDATE public.client_projects SET
      scope_pending_material_publish = true,
      scope_material_review_required = true,
      updated_at = now()
    WHERE id = p_project_id;
    RETURN;
  END IF;

  v_published_slice := app_private.scope_material_from_revision(
    v_pub_setup, v_pub_monthly, v_pub_summary, v_pub_scope, v_pub_sources, v_pub_screens
  );
  v_draft_slice := app_private.scope_material_slice(v_draft);
  v_ambiguous := app_private.scope_draft_material_ambiguous(v_draft, v_published_slice);
  v_material_differs := v_draft_slice IS DISTINCT FROM v_published_slice;

  UPDATE public.client_projects SET
    scope_pending_material_publish = CASE
      WHEN v_ambiguous THEN true
      WHEN v_material_differs THEN true
      ELSE false
    END,
    scope_material_published_generation = CASE
      WHEN v_ambiguous THEN scope_material_published_generation
      WHEN v_material_differs THEN scope_material_published_generation
      ELSE COALESCE(v_material_gen, 0)
    END,
    scope_material_review_required = v_ambiguous,
    updated_at = now()
  WHERE id = p_project_id;
END;
$$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.client_projects LOOP
    PERFORM app_private.repair_project_scope_publish_state(r.id);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Intake: atomic first save (expected version 0 when no row exists)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.customer_save_intake_draft(
  p_project_id uuid,
  p_expected_version integer,
  p_current_step text,
  p_draft jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id uuid;
  v_current_version integer;
  v_new_version integer;
  v_status text;
  v_inserted integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_private.require_project_member(p_project_id)) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  PERFORM app_private.validate_intake_draft(p_draft, p_current_step);

  SELECT company_id INTO v_company_id
  FROM public.client_projects
  WHERE id = p_project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  SELECT draft_version, form_status
  INTO v_current_version, v_status
  FROM public.project_intake
  WHERE project_id = p_project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    IF p_expected_version <> 0 THEN
      RAISE EXCEPTION 'VERSION_CONFLICT';
    END IF;

    INSERT INTO public.project_intake (
      project_id, company_id, draft, form_status, current_step, draft_version
    ) VALUES (
      p_project_id, v_company_id, p_draft, 'in-progress', p_current_step, 1
    );
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted = 0 THEN
      RAISE EXCEPTION 'VERSION_CONFLICT';
    END IF;

    PERFORM app_private.apply_intake_contact_from_json(p_project_id, p_draft);
    RETURN jsonb_build_object('ok', true, 'draft_version', 1);
  END IF;

  IF v_status = 'submitted' THEN
    RAISE EXCEPTION 'INTAKE_SUBMITTED';
  END IF;

  IF p_expected_version <> v_current_version THEN
    RAISE EXCEPTION 'VERSION_CONFLICT';
  END IF;

  UPDATE public.project_intake SET
    draft = p_draft,
    current_step = p_current_step,
    form_status = 'in-progress',
    draft_version = draft_version + 1,
    updated_at = now()
  WHERE project_id = p_project_id
    AND draft_version = p_expected_version
    AND form_status <> 'submitted';

  IF NOT FOUND THEN
    IF EXISTS (
      SELECT 1 FROM public.project_intake
      WHERE project_id = p_project_id AND form_status = 'submitted'
    ) THEN
      RAISE EXCEPTION 'INTAKE_SUBMITTED';
    END IF;
    RAISE EXCEPTION 'VERSION_CONFLICT';
  END IF;

  PERFORM app_private.apply_intake_contact_from_json(p_project_id, p_draft);

  SELECT draft_version INTO v_new_version
  FROM public.project_intake
  WHERE project_id = p_project_id;

  RETURN jsonb_build_object('ok', true, 'draft_version', v_new_version);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'VERSION_CONFLICT';
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_submit_intake(
  p_project_id uuid,
  p_expected_version integer,
  p_submission jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id uuid;
  v_current_version integer;
  v_status text;
  v_inserted integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_private.require_project_member(p_project_id)) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  PERFORM app_private.validate_intake_submission(p_submission);

  SELECT company_id INTO v_company_id
  FROM public.client_projects
  WHERE id = p_project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  SELECT draft_version, form_status
  INTO v_current_version, v_status
  FROM public.project_intake
  WHERE project_id = p_project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    IF p_expected_version <> 0 THEN
      RAISE EXCEPTION 'VERSION_CONFLICT';
    END IF;

    INSERT INTO public.project_intake (
      project_id, company_id, draft, submission, form_status, submitted_at, draft_version
    ) VALUES (
      p_project_id, v_company_id, '{}'::jsonb, p_submission, 'submitted', now(), 1
    );
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted = 0 THEN
      RAISE EXCEPTION 'VERSION_CONFLICT';
    END IF;

    PERFORM app_private.apply_intake_contact_from_json(p_project_id, p_submission);
    RETURN jsonb_build_object('ok', true, 'draft_version', 1);
  END IF;

  IF v_status = 'submitted' THEN
    RAISE EXCEPTION 'INTAKE_SUBMITTED';
  END IF;

  IF p_expected_version <> v_current_version THEN
    RAISE EXCEPTION 'VERSION_CONFLICT';
  END IF;

  UPDATE public.project_intake SET
    submission = p_submission,
    draft = '{}'::jsonb,
    form_status = 'submitted',
    submitted_at = now(),
    draft_version = draft_version + 1,
    updated_at = now()
  WHERE project_id = p_project_id
    AND draft_version = p_expected_version
    AND form_status <> 'submitted';

  IF NOT FOUND THEN
    IF EXISTS (
      SELECT 1 FROM public.project_intake
      WHERE project_id = p_project_id AND form_status = 'submitted'
    ) THEN
      RAISE EXCEPTION 'INTAKE_SUBMITTED';
    END IF;
    RAISE EXCEPTION 'VERSION_CONFLICT';
  END IF;

  PERFORM app_private.apply_intake_contact_from_json(p_project_id, p_submission);

  SELECT draft_version INTO v_current_version
  FROM public.project_intake
  WHERE project_id = p_project_id;

  RETURN jsonb_build_object('ok', true, 'draft_version', v_current_version);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'VERSION_CONFLICT';
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_accept_scope(
  p_project_id uuid,
  p_revision integer,
  p_scope_revision_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id uuid;
  v_published integer;
  v_pending boolean;
  v_review_required boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_private.require_project_member(p_project_id)) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT
    company_id,
    published_revision,
    scope_pending_material_publish,
    scope_material_review_required
  INTO v_company_id, v_published, v_pending, v_review_required
  FROM public.client_projects
  WHERE id = p_project_id
  FOR UPDATE;

  IF v_published IS NULL OR v_published <> p_revision THEN
    RAISE EXCEPTION 'STALE_REVISION';
  END IF;

  IF v_review_required THEN
    RAISE EXCEPTION 'SCOPE_REVIEW_REQUIRED';
  END IF;

  IF v_pending THEN
    RAISE EXCEPTION 'UNPUBLISHED_MATERIAL';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.scope_revisions sr
    WHERE sr.id = p_scope_revision_id
      AND sr.project_id = p_project_id
      AND sr.revision = p_revision
  ) THEN
    RAISE EXCEPTION 'INVALID_SCOPE_REVISION';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.scope_acceptances
    WHERE project_id = p_project_id AND revision = p_revision
  ) THEN
    RAISE EXCEPTION 'ALREADY_ACCEPTED';
  END IF;

  INSERT INTO public.scope_acceptances (
    project_id, company_id, revision, acceptance_source, scope_revision_id, accepted_by
  ) VALUES (
    p_project_id, v_company_id, p_revision, 'customer', p_scope_revision_id, (SELECT auth.uid())
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_repair_scope_publish_state(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT app_private.is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  PERFORM app_private.repair_project_scope_publish_state(p_project_id);
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_repair_scope_publish_state(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_repair_scope_publish_state(uuid) TO authenticated;

-- Admin-only milestone 2 test fixtures (isolated projects, no service role in CI)

CREATE OR REPLACE FUNCTION app_private.milestone2_test_project_guard(p_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT app_private.is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.client_projects cp
    WHERE cp.id = p_project_id
      AND (cp.email LIKE 'm2-%@test.local' OR cp.company_name LIKE 'M2 %')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_milestone2_test_project(
  p_company_id uuid,
  p_label text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_suffix text;
BEGIN
  IF NOT app_private.is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  v_suffix := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  INSERT INTO public.client_projects (
    company_id, company_name, contact_name, email, phone, status,
    setup_fee, monthly_fee, dashboard_scope
  ) VALUES (
    p_company_id,
    'M2 ' || left(COALESCE(NULLIF(trim(p_label), ''), 'test'), 40) || ' ' || v_suffix,
    'M2 Test',
    'm2-' || v_suffix || '@test.local',
    '555-0199',
    'pending',
    1000,
    100,
    'Milestone 2 test project'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_milestone2_test_project(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT app_private.is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.client_projects cp
    WHERE cp.id = p_project_id
      AND (cp.email LIKE 'm2-%@test.local' OR cp.company_name LIKE 'M2 %')
  ) THEN
    IF EXISTS (SELECT 1 FROM public.client_projects WHERE id = p_project_id) THEN
      RAISE EXCEPTION 'FORBIDDEN';
    END IF;
    RETURN jsonb_build_object('ok', true, 'already_deleted', true);
  END IF;
  DELETE FROM public.client_projects WHERE id = p_project_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_milestone2_test_set_scope_flags(
  p_project_id uuid,
  p_pending_material_publish boolean,
  p_material_review_required boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM app_private.milestone2_test_project_guard(p_project_id);
  UPDATE public.client_projects SET
    scope_pending_material_publish = p_pending_material_publish,
    scope_material_review_required = p_material_review_required,
    updated_at = now()
  WHERE id = p_project_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_milestone2_test_set_admin_scope_draft(
  p_project_id uuid,
  p_scope_draft jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  PERFORM app_private.milestone2_test_project_guard(p_project_id);
  SELECT company_id INTO v_company_id FROM public.client_projects WHERE id = p_project_id;
  INSERT INTO public.admin_project_scope_drafts (project_id, company_id, scope_draft, material_generation)
  VALUES (p_project_id, v_company_id, COALESCE(p_scope_draft, '{}'::jsonb), 0)
  ON CONFLICT (project_id) DO UPDATE SET
    scope_draft = COALESCE(p_scope_draft, '{}'::jsonb),
    updated_at = now();
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_milestone2_test_project(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delete_milestone2_test_project(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_milestone2_test_set_scope_flags(uuid, boolean, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_milestone2_test_set_admin_scope_draft(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_milestone2_test_project(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_milestone2_test_project(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_milestone2_test_set_scope_flags(uuid, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_milestone2_test_set_admin_scope_draft(uuid, jsonb) TO authenticated;
