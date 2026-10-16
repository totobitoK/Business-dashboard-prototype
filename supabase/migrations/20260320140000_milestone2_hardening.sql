-- Milestone 2 hardening: admin-only scope drafts, acceptance gates, intake validation

CREATE TABLE IF NOT EXISTS public.admin_project_scope_drafts (
  project_id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  scope_draft jsonb NOT NULL DEFAULT '{}'::jsonb,
  material_generation integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_project_scope_drafts_project_company_fkey
    FOREIGN KEY (project_id, company_id)
    REFERENCES public.client_projects (id, company_id) ON DELETE CASCADE
);

ALTER TABLE public.admin_project_scope_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_project_scope_drafts_admin ON public.admin_project_scope_drafts;
CREATE POLICY admin_project_scope_drafts_admin ON public.admin_project_scope_drafts
  FOR ALL TO authenticated
  USING (app_private.is_platform_admin())
  WITH CHECK (app_private.is_platform_admin());

REVOKE ALL ON public.admin_project_scope_drafts FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_project_scope_drafts TO authenticated;

ALTER TABLE public.client_projects
  ADD COLUMN IF NOT EXISTS scope_material_published_generation integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scope_pending_material_publish boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'client_projects' AND column_name = 'scope_admin_draft'
  ) THEN
    INSERT INTO public.admin_project_scope_drafts (project_id, company_id, scope_draft, material_generation)
    SELECT
      cp.id,
      cp.company_id,
      COALESCE(cp.scope_admin_draft, '{}'::jsonb),
      GREATEST(COALESCE(cp.scope_draft_revision, 0), 0)
    FROM public.client_projects cp
    ON CONFLICT (project_id) DO UPDATE SET
      scope_draft = EXCLUDED.scope_draft,
      material_generation = GREATEST(admin_project_scope_drafts.material_generation, EXCLUDED.material_generation);

    UPDATE public.client_projects cp SET
      scope_material_published_generation = CASE
        WHEN cp.published_revision > 0 THEN GREATEST(cp.published_revision, COALESCE(cp.scope_draft_revision, cp.published_revision))
        ELSE 0
      END,
      scope_pending_material_publish = (
        GREATEST(COALESCE(cp.scope_draft_revision, 0), 0)
        > CASE
            WHEN cp.published_revision > 0 THEN GREATEST(cp.published_revision, COALESCE(cp.scope_draft_revision, cp.published_revision))
            ELSE 0
          END
      );

    ALTER TABLE public.client_projects DROP COLUMN scope_admin_draft;
    ALTER TABLE public.client_projects DROP COLUMN scope_draft_revision;
  END IF;
END $$;

INSERT INTO public.admin_project_scope_drafts (project_id, company_id, scope_draft, material_generation)
SELECT cp.id, cp.company_id, '{}'::jsonb, 0
FROM public.client_projects cp
WHERE NOT EXISTS (
  SELECT 1 FROM public.admin_project_scope_drafts d WHERE d.project_id = cp.id
);

-- ---------------------------------------------------------------------------
-- Intake validation (trusted write boundary)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_private.intake_answers_json(p_payload jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN jsonb_typeof(p_payload->'answers') = 'object' THEN p_payload->'answers'
    ELSE p_payload
  END;
$$;

CREATE OR REPLACE FUNCTION app_private.intake_text(p jsonb, p_key text, p_max integer)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v text;
BEGIN
  IF jsonb_typeof(p->p_key) IS NOT NULL AND jsonb_typeof(p->p_key) <> 'string' THEN
    RAISE EXCEPTION 'INTAKE_VALIDATION:Invalid field type for %', p_key;
  END IF;
  v := NULLIF(trim(p->>p_key), '');
  IF v IS NOT NULL AND char_length(v) > p_max THEN
    RAISE EXCEPTION 'INTAKE_VALIDATION:% is too long', p_key;
  END IF;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.validate_intake_step(p_step text)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  IF p_step IS NULL OR p_step NOT IN ('1', '2', '3', 'review') THEN
    RAISE EXCEPTION 'INTAKE_VALIDATION:Invalid intake step';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.validate_intake_tool(p_tool text)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  IF p_tool NOT IN (
    'google-sheets', 'excel-csv', 'quickbooks', 'hubspot',
    'stripe', 'square', 'google-calendar', 'other'
  ) THEN
    RAISE EXCEPTION 'INTAKE_VALIDATION:Invalid tool selection';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.validate_intake_draft(
  p_draft jsonb,
  p_current_step text
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_answers jsonb;
  v_tools jsonb;
  v_tool text;
BEGIN
  IF p_draft IS NULL OR jsonb_typeof(p_draft) <> 'object' THEN
    RAISE EXCEPTION 'INTAKE_VALIDATION:Draft must be a JSON object';
  END IF;
  IF octet_length(p_draft::text) > 102400 THEN
    RAISE EXCEPTION 'INTAKE_VALIDATION:Draft payload is too large';
  END IF;
  PERFORM app_private.validate_intake_step(p_current_step);
  v_answers := app_private.intake_answers_json(p_draft);

  PERFORM app_private.intake_text(v_answers, 'company', 200);
  PERFORM app_private.intake_text(v_answers, 'contactName', 200);
  PERFORM app_private.intake_text(v_answers, 'email', 320);
  PERFORM app_private.intake_text(v_answers, 'phone', 80);
  PERFORM app_private.intake_text(v_answers, 'website', 500);
  PERFORM app_private.intake_text(v_answers, 'businessDescription', 8000);
  PERFORM app_private.intake_text(v_answers, 'dashboardGoals', 8000);
  PERFORM app_private.intake_text(v_answers, 'reportingPainPoints', 8000);
  PERFORM app_private.intake_text(v_answers, 'dashboardUsers', 500);
  PERFORM app_private.intake_text(v_answers, 'otherToolExplanation', 2000);
  PERFORM app_private.intake_text(v_answers, 'toolsNotes', 4000);

  IF v_answers ? 'email' AND app_private.intake_text(v_answers, 'email', 320) IS NOT NULL THEN
    IF app_private.intake_text(v_answers, 'email', 320) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
      RAISE EXCEPTION 'INTAKE_VALIDATION:Enter a valid email address';
    END IF;
  END IF;

  IF v_answers ? 'selectedTools' THEN
    IF jsonb_typeof(v_answers->'selectedTools') <> 'array' THEN
      RAISE EXCEPTION 'INTAKE_VALIDATION:selectedTools must be an array';
    END IF;
    FOR v_tool IN SELECT jsonb_array_elements_text(v_answers->'selectedTools') LOOP
      PERFORM app_private.validate_intake_tool(v_tool);
    END LOOP;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.validate_intake_submission(p_submission jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_answers jsonb;
  v_tools jsonb;
  v_tool text;
  v_has_other boolean := false;
BEGIN
  IF p_submission IS NULL OR jsonb_typeof(p_submission) <> 'object' THEN
    RAISE EXCEPTION 'INTAKE_VALIDATION:Submission must be a JSON object';
  END IF;
  IF octet_length(p_submission::text) > 102400 THEN
    RAISE EXCEPTION 'INTAKE_VALIDATION:Submission payload is too large';
  END IF;
  v_answers := app_private.intake_answers_json(p_submission);

  IF app_private.intake_text(v_answers, 'company', 200) IS NULL THEN
    RAISE EXCEPTION 'INTAKE_VALIDATION:Company name is required';
  END IF;
  IF app_private.intake_text(v_answers, 'contactName', 200) IS NULL THEN
    RAISE EXCEPTION 'INTAKE_VALIDATION:Contact name is required';
  END IF;
  IF app_private.intake_text(v_answers, 'email', 320) IS NULL THEN
    RAISE EXCEPTION 'INTAKE_VALIDATION:Email is required';
  END IF;
  IF app_private.intake_text(v_answers, 'email', 320) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'INTAKE_VALIDATION:Enter a valid email address';
  END IF;
  IF app_private.intake_text(v_answers, 'businessDescription', 8000) IS NULL THEN
    RAISE EXCEPTION 'INTAKE_VALIDATION:Business description is required';
  END IF;
  IF app_private.intake_text(v_answers, 'dashboardGoals', 8000) IS NULL THEN
    RAISE EXCEPTION 'INTAKE_VALIDATION:Dashboard goals are required';
  END IF;

  IF NOT (v_answers ? 'selectedTools') OR jsonb_typeof(v_answers->'selectedTools') <> 'array' THEN
    RAISE EXCEPTION 'INTAKE_VALIDATION:Select at least one tool';
  END IF;
  v_tools := v_answers->'selectedTools';
  IF jsonb_array_length(v_tools) < 1 THEN
    RAISE EXCEPTION 'INTAKE_VALIDATION:Select at least one tool';
  END IF;
  FOR v_tool IN SELECT jsonb_array_elements_text(v_tools) LOOP
    PERFORM app_private.validate_intake_tool(v_tool);
    IF v_tool = 'other' THEN v_has_other := true; END IF;
  END LOOP;
  IF v_has_other AND app_private.intake_text(v_answers, 'otherToolExplanation', 2000) IS NULL THEN
    RAISE EXCEPTION 'INTAKE_VALIDATION:Please describe the other tool';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.scope_material_slice(p jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'setup_fee', COALESCE(p->>'setup_fee', ''),
    'monthly_fee', COALESCE(p->>'monthly_fee', ''),
    'agreed_scope_summary', COALESCE(p->>'agreed_scope_summary', ''),
    'dashboard_scope', COALESCE(p->>'dashboard_scope', ''),
    'accepted_sources_in', COALESCE(p->'accepted_sources_in', '[]'::jsonb),
    'accepted_screens', COALESCE(p->'accepted_screens', '[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION app_private.scope_material_changed(p_old jsonb, p_new jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT app_private.scope_material_slice(COALESCE(p_old, '{}'::jsonb))
    IS DISTINCT FROM app_private.scope_material_slice(COALESCE(p_new, '{}'::jsonb));
$$;

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
  v_new_version integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_private.require_project_member(p_project_id)) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  PERFORM app_private.validate_intake_draft(p_draft, p_current_step);

  SELECT company_id INTO v_company_id FROM public.client_projects WHERE id = p_project_id;

  IF EXISTS (
    SELECT 1 FROM public.project_intake
    WHERE project_id = p_project_id AND form_status = 'submitted'
  ) THEN
    RAISE EXCEPTION 'INTAKE_SUBMITTED';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.project_intake WHERE project_id = p_project_id) THEN
    IF p_expected_version <> 1 THEN
      RAISE EXCEPTION 'VERSION_CONFLICT';
    END IF;
    INSERT INTO public.project_intake (project_id, company_id, draft, form_status, current_step, draft_version)
    VALUES (p_project_id, v_company_id, p_draft, 'in-progress', p_current_step, 1);
  ELSE
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
      IF EXISTS (SELECT 1 FROM public.project_intake WHERE project_id = p_project_id AND form_status = 'submitted') THEN
        RAISE EXCEPTION 'INTAKE_SUBMITTED';
      END IF;
      RAISE EXCEPTION 'VERSION_CONFLICT';
    END IF;
  END IF;

  PERFORM app_private.apply_intake_contact_from_json(p_project_id, p_draft);

  SELECT draft_version INTO v_new_version FROM public.project_intake WHERE project_id = p_project_id;
  RETURN jsonb_build_object('ok', true, 'draft_version', v_new_version);
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
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_private.require_project_member(p_project_id)) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  PERFORM app_private.validate_intake_submission(p_submission);

  SELECT company_id INTO v_company_id FROM public.client_projects WHERE id = p_project_id;

  IF NOT EXISTS (SELECT 1 FROM public.project_intake WHERE project_id = p_project_id) THEN
    IF p_expected_version <> 1 THEN
      RAISE EXCEPTION 'VERSION_CONFLICT';
    END IF;
    INSERT INTO public.project_intake (
      project_id, company_id, draft, submission, form_status, submitted_at, draft_version
    ) VALUES (
      p_project_id, v_company_id, '{}'::jsonb, p_submission, 'submitted', now(), 1
    );
  ELSE
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
      IF EXISTS (SELECT 1 FROM public.project_intake WHERE project_id = p_project_id AND form_status = 'submitted') THEN
        RAISE EXCEPTION 'INTAKE_SUBMITTED';
      END IF;
      RAISE EXCEPTION 'VERSION_CONFLICT';
    END IF;
  END IF;

  PERFORM app_private.apply_intake_contact_from_json(p_project_id, p_submission);

  RETURN jsonb_build_object('ok', true);
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

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_publish_scope(p_project_id uuid)
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
BEGIN
  IF NOT app_private.is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT company_id INTO v_company_id
  FROM public.client_projects WHERE id = p_project_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  SELECT scope_draft, material_generation INTO v_draft, v_material_gen
  FROM public.admin_project_scope_drafts
  WHERE project_id = p_project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    v_draft := '{}'::jsonb;
    v_material_gen := 0;
  END IF;

  SELECT setup_fee, monthly_fee, dashboard_scope
  INTO v_setup, v_monthly, v_scope
  FROM public.client_projects WHERE id = p_project_id;

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
  FROM public.scope_revisions WHERE project_id = p_project_id;

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
    updated_at = now()
  WHERE id = p_project_id;

  RETURN jsonb_build_object('ok', true, 'revision', v_next_revision, 'scope_revision_id', v_revision_id);
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
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_private.require_project_member(p_project_id)) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT company_id, published_revision, scope_pending_material_publish
  INTO v_company_id, v_published, v_pending
  FROM public.client_projects WHERE id = p_project_id FOR UPDATE;

  IF v_published IS NULL OR v_published <> p_revision THEN
    RAISE EXCEPTION 'STALE_REVISION';
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
