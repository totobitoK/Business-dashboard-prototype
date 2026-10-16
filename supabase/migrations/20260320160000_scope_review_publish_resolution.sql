-- Resolve scope review only via explicit admin publish confirmation

DROP FUNCTION IF EXISTS public.admin_publish_scope(uuid);

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

  RETURN jsonb_build_object(
    'ok', true,
    'revision', v_next_revision,
    'scope_revision_id', v_revision_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_publish_scope(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_publish_scope(uuid, boolean) TO authenticated;
