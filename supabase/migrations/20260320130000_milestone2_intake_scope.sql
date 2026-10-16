-- Milestone 2: intake versioning, scope drafts, change requests, RPC writes

ALTER TABLE public.project_intake
  ADD COLUMN IF NOT EXISTS current_step text NOT NULL DEFAULT '1',
  ADD COLUMN IF NOT EXISTS draft_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

ALTER TABLE public.client_projects
  ADD COLUMN IF NOT EXISTS scope_admin_draft jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS published_revision integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scope_draft_revision integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.scope_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  company_id uuid NOT NULL,
  revision integer NOT NULL,
  note text NOT NULL,
  requested_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scope_change_requests_project_company_fkey
    FOREIGN KEY (project_id, company_id)
    REFERENCES public.client_projects (id, company_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS scope_change_requests_project_idx
  ON public.scope_change_requests (project_id, company_id);

ALTER TABLE public.scope_acceptances
  ADD COLUMN IF NOT EXISTS scope_revision_id uuid,
  ADD COLUMN IF NOT EXISTS accepted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scope_acceptances_scope_revision_fkey'
  ) THEN
    ALTER TABLE public.scope_acceptances
      ADD CONSTRAINT scope_acceptances_scope_revision_fkey
      FOREIGN KEY (scope_revision_id) REFERENCES public.scope_revisions (id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS scope_acceptances_project_revision_uidx
  ON public.scope_acceptances (project_id, revision);

ALTER TABLE public.scope_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scope_change_requests_select ON public.scope_change_requests;
CREATE POLICY scope_change_requests_select ON public.scope_change_requests
  FOR SELECT TO authenticated
  USING (
    app_private.is_platform_admin()
    OR app_private.is_company_member(company_id)
  );

-- Writes via RPC only (no INSERT grant to authenticated)

REVOKE INSERT, UPDATE, DELETE ON public.scope_change_requests FROM authenticated, anon;
GRANT SELECT ON public.scope_change_requests TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC helpers (security definer)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_private.require_project_member(p_project_id uuid)
RETURNS TABLE (project_id uuid, company_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF app_private.is_platform_admin() THEN
    RETURN QUERY
    SELECT cp.id, cp.company_id FROM public.client_projects cp WHERE cp.id = p_project_id;
    RETURN;
  END IF;
  RETURN QUERY
  SELECT cp.id, cp.company_id
  FROM public.client_projects cp
  INNER JOIN public.company_memberships cm ON cm.company_id = cp.company_id
  WHERE cp.id = p_project_id AND cm.user_id = (SELECT auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION app_private.apply_intake_contact_from_json(p_project_id uuid, p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.client_projects SET
    company_name = COALESCE(NULLIF(trim(p_payload->>'company'), ''), company_name),
    contact_name = COALESCE(NULLIF(trim(p_payload->>'contactName'), ''), contact_name),
    email = COALESCE(NULLIF(trim(p_payload->>'email'), ''), email),
    phone = COALESCE(NULLIF(trim(p_payload->>'phone'), ''), phone),
    website = NULLIF(trim(p_payload->>'website'), ''),
    updated_at = now()
  WHERE id = p_project_id;
END;
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
BEGIN
  IF NOT app_private.is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  UPDATE public.client_projects SET
    company_name = COALESCE(NULLIF(trim(p_contact->>'company_name'), ''), company_name),
    contact_name = COALESCE(NULLIF(trim(p_contact->>'contact_name'), ''), contact_name),
    email = COALESCE(NULLIF(trim(p_contact->>'email'), ''), email),
    phone = COALESCE(NULLIF(trim(p_contact->>'phone'), ''), phone),
    website = NULLIF(trim(p_contact->>'website'), ''),
    scope_admin_draft = p_scope_draft,
    scope_draft_revision = scope_draft_revision + 1,
    updated_at = now()
  WHERE id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

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

  SELECT company_id, scope_admin_draft, setup_fee, monthly_fee, dashboard_scope
  INTO v_company_id, v_draft, v_setup, v_monthly, v_scope
  FROM public.client_projects WHERE id = p_project_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

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
    scope_draft_revision = v_next_revision,
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
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_private.require_project_member(p_project_id)) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT company_id, published_revision INTO v_company_id, v_published
  FROM public.client_projects WHERE id = p_project_id;

  IF v_published IS NULL OR v_published <> p_revision THEN
    RAISE EXCEPTION 'STALE_REVISION';
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

CREATE OR REPLACE FUNCTION public.customer_request_scope_changes(
  p_project_id uuid,
  p_revision integer,
  p_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id uuid;
  v_published integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_private.require_project_member(p_project_id)) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT company_id, published_revision INTO v_company_id, v_published
  FROM public.client_projects WHERE id = p_project_id;

  IF v_published <> p_revision THEN
    RAISE EXCEPTION 'STALE_REVISION';
  END IF;

  IF trim(p_note) = '' THEN
    RAISE EXCEPTION 'NOTE_REQUIRED';
  END IF;

  INSERT INTO public.scope_change_requests (project_id, company_id, revision, note, requested_by)
  VALUES (p_project_id, v_company_id, p_revision, trim(p_note), (SELECT auth.uid()));

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.customer_save_intake_draft(uuid, integer, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.customer_submit_intake(uuid, integer, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_save_scope_draft(uuid, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_publish_scope(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.customer_accept_scope(uuid, integer, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.customer_request_scope_changes(uuid, integer, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.customer_save_intake_draft(uuid, integer, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_submit_intake(uuid, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_scope_draft(uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_publish_scope(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_accept_scope(uuid, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.customer_request_scope_changes(uuid, integer, text) TO authenticated;
