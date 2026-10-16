-- Milestone 3B: offline setup payments and explicit project activation

ALTER TABLE public.client_projects
  ADD COLUMN IF NOT EXISTS payment_only_prep_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS activated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.project_payments
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS void_reason text,
  ADD COLUMN IF NOT EXISTS replaces_payment_id uuid REFERENCES public.project_payments (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS project_payments_idempotency_uidx
  ON public.project_payments (project_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS project_payments_voided_idx
  ON public.project_payments (project_id, voided_at);

-- ---------------------------------------------------------------------------
-- Setup payment totals (valid = setup type, not voided)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_private.effective_setup_fee(p_project_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_published integer;
  v_fee numeric(12, 2);
  v_scope_fee numeric(12, 2);
  v_draft jsonb;
BEGIN
  SELECT published_revision, setup_fee
  INTO v_published, v_fee
  FROM public.client_projects
  WHERE id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  IF v_published IS NOT NULL AND v_published > 0 THEN
    SELECT sr.setup_fee INTO v_scope_fee
    FROM public.scope_revisions sr
    WHERE sr.project_id = p_project_id AND sr.revision = v_published
    LIMIT 1;
    IF v_scope_fee IS NOT NULL THEN
      RETURN v_scope_fee;
    END IF;
  END IF;

  SELECT d.scope_draft INTO v_draft
  FROM public.admin_project_scope_drafts d
  WHERE d.project_id = p_project_id
  LIMIT 1;

  IF v_draft ? 'setup_fee' AND NULLIF(v_draft->>'setup_fee', '') IS NOT NULL THEN
    RETURN (v_draft->>'setup_fee')::numeric(12, 2);
  END IF;

  RETURN COALESCE(v_fee, 0);
END;
$$;

CREATE OR REPLACE FUNCTION app_private.setup_payments_received(p_project_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    SUM(pp.amount)::numeric(12, 2),
    0::numeric(12, 2)
  )
  FROM public.project_payments pp
  WHERE pp.project_id = p_project_id
    AND pp.type = 'setup'::public.payment_type
    AND pp.voided_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION app_private.setup_payment_summary(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_fee numeric(12, 2);
  v_paid numeric(12, 2);
  v_remaining numeric(12, 2);
  v_over numeric(12, 2);
BEGIN
  v_fee := app_private.effective_setup_fee(p_project_id);
  v_paid := app_private.setup_payments_received(p_project_id);
  v_remaining := GREATEST(v_fee - v_paid, 0);
  v_over := GREATEST(v_paid - v_fee, 0);
  RETURN jsonb_build_object(
    'setup_fee', v_fee,
    'received', v_paid,
    'remaining', v_remaining,
    'overpayment', v_over,
    'fully_paid', (v_fee <= 0 OR v_paid >= v_fee)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Activation eligibility (Postgres source of truth for live activate)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_private.collect_activation_blockers(p_project_id uuid)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_blockers text[] := ARRAY[]::text[];
  v_onboarding public.onboarding_path;
  v_intake_submitted timestamptz;
  v_prep boolean;
  v_summary jsonb;
  v_ready uuid;
  v_feedback_unresolved boolean;
  v_published integer;
BEGIN
  SELECT cp.onboarding_path, cp.payment_only_prep_confirmed,
         cp.current_ready_preview_id, cp.preview_feedback_unresolved, cp.published_revision
  INTO v_onboarding, v_prep, v_ready, v_feedback_unresolved, v_published
  FROM public.client_projects cp
  WHERE cp.id = p_project_id;

  IF NOT FOUND THEN
    RETURN ARRAY['Project not found.'];
  END IF;

  SELECT pi.submitted_at INTO v_intake_submitted
  FROM public.project_intake pi
  WHERE pi.project_id = p_project_id;

  IF v_onboarding = 'full'::public.onboarding_path AND v_intake_submitted IS NULL THEN
    v_blockers := array_append(v_blockers, 'Intake form not submitted.');
  END IF;

  IF v_onboarding = 'payment-only'::public.onboarding_path AND NOT COALESCE(v_prep, false) THEN
    v_blockers := array_append(v_blockers, 'Payment-only preparation not confirmed in admin.');
  END IF;

  BEGIN
    PERFORM app_private.assert_scope_eligible_for_preview(p_project_id);
  EXCEPTION
    WHEN OTHERS THEN
      v_blockers := array_append(v_blockers, SQLERRM);
  END;

  BEGIN
    PERFORM app_private.assert_build_prerequisites_for_preview(p_project_id);
  EXCEPTION
    WHEN OTHERS THEN
      v_blockers := array_append(v_blockers, SQLERRM);
  END;

  IF v_ready IS NULL THEN
    v_blockers := array_append(v_blockers, 'No ready preview published for current scope.');
  ELSIF v_feedback_unresolved THEN
    v_blockers := array_append(v_blockers, 'Unresolved preview change request.');
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.preview_revisions pr
      WHERE pr.id = v_ready
        AND pr.project_id = p_project_id
        AND pr.status = 'ready'
        AND pr.scope_revision = v_published
        AND app_private.is_valid_demo_workspace_id(pr.demo_workspace_id)
    ) THEN
      v_blockers := array_append(v_blockers, 'Current preview is not eligible.');
    ELSIF NOT EXISTS (
      SELECT 1 FROM public.preview_revision_approvals pa
      WHERE pa.preview_revision_id = v_ready
    ) THEN
      v_blockers := array_append(v_blockers, 'Preview not approved for current revision.');
    ELSIF EXISTS (
      SELECT 1 FROM public.preview_revision_feedback pf
      WHERE pf.preview_revision_id = v_ready
    ) THEN
      v_blockers := array_append(v_blockers, 'Unresolved preview feedback on current revision.');
    END IF;
  END IF;

  v_summary := app_private.setup_payment_summary(p_project_id);
  IF NOT (v_summary->>'fully_paid')::boolean THEN
    v_blockers := array_append(
      v_blockers,
      'Required setup payment not fully received.'
    );
  END IF;

  RETURN v_blockers;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_activation_eligibility(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status public.client_project_status;
  v_activated_at timestamptz;
  v_blockers text[];
BEGIN
  IF NOT app_private.is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT status, activated_at
  INTO v_status, v_activated_at
  FROM public.client_projects
  WHERE id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  IF v_status = 'active'::public.client_project_status AND v_activated_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'can_activate', true,
      'blocked_reasons', '[]'::jsonb,
      'already_active', true,
      'setup_balance', app_private.setup_payment_summary(p_project_id)
    );
  END IF;

  IF v_status NOT IN ('pending'::public.client_project_status, 'archived'::public.client_project_status) THEN
    RETURN jsonb_build_object(
      'can_activate', false,
      'blocked_reasons', jsonb_build_array('Client must be pending or archived to activate.'),
      'already_active', false,
      'setup_balance', app_private.setup_payment_summary(p_project_id)
    );
  END IF;

  v_blockers := app_private.collect_activation_blockers(p_project_id);

  RETURN jsonb_build_object(
    'can_activate', (COALESCE(array_length(v_blockers, 1), 0) = 0),
    'blocked_reasons', to_jsonb(v_blockers),
    'already_active', false,
    'setup_balance', app_private.setup_payment_summary(p_project_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_activate_project(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status public.client_project_status;
  v_activated_at timestamptz;
  v_activated_by uuid;
  v_blockers text[];
BEGIN
  IF NOT app_private.is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT status, activated_at, activated_by
  INTO v_status, v_activated_at, v_activated_by
  FROM public.client_projects
  WHERE id = p_project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  IF v_status = 'active'::public.client_project_status AND v_activated_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_active', true,
      'activated_at', v_activated_at,
      'activated_by', v_activated_by
    );
  END IF;

  IF v_status NOT IN ('pending'::public.client_project_status, 'archived'::public.client_project_status) THEN
    RAISE EXCEPTION 'INVALID_STATUS';
  END IF;

  v_blockers := app_private.collect_activation_blockers(p_project_id);
  IF COALESCE(array_length(v_blockers, 1), 0) > 0 THEN
    RAISE EXCEPTION 'ACTIVATION_BLOCKED: %', array_to_string(v_blockers, ' ');
  END IF;

  UPDATE public.client_projects SET
    status = 'active'::public.client_project_status,
    activated_at = COALESCE(activated_at, now()),
    activated_by = COALESCE(activated_by, (SELECT auth.uid())),
    updated_at = now()
  WHERE id = p_project_id
  RETURNING activated_at, activated_by INTO v_activated_at, v_activated_by;

  RETURN jsonb_build_object(
    'ok', true,
    'already_active', false,
    'activated_at', v_activated_at,
    'activated_by', v_activated_by
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_payment_only_prep(
  p_project_id uuid,
  p_confirmed boolean
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
    payment_only_prep_confirmed = COALESCE(p_confirmed, false),
    updated_at = now()
  WHERE id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- Setup payment record / void+replace
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_record_setup_payment(
  p_project_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_payment_method text,
  p_method_reference text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id uuid;
  v_status public.client_project_status;
  v_existing uuid;
  v_payment_id uuid;
  v_method text;
  v_key text;
BEGIN
  IF NOT app_private.is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  IF p_payment_date IS NULL THEN
    RAISE EXCEPTION 'INVALID_DATE';
  END IF;

  v_method := NULLIF(trim(COALESCE(p_payment_method, '')), '');
  IF v_method IS NULL THEN
    RAISE EXCEPTION 'METHOD_REQUIRED';
  END IF;

  v_key := NULLIF(trim(COALESCE(p_idempotency_key, '')), '');

  SELECT company_id, status
  INTO v_company_id, v_status
  FROM public.client_projects
  WHERE id = p_project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  IF v_key IS NOT NULL THEN
    SELECT id INTO v_existing
    FROM public.project_payments
    WHERE project_id = p_project_id AND idempotency_key = v_key
    LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok', true,
        'payment_id', v_existing,
        'idempotent_replay', true,
        'setup_balance', app_private.setup_payment_summary(p_project_id)
      );
    END IF;
  END IF;

  INSERT INTO public.project_payments (
    project_id, company_id, payment_date, amount, type, record_source,
    payment_method, method_reference, recorded_by, idempotency_key
  ) VALUES (
    p_project_id, v_company_id, p_payment_date, p_amount, 'setup'::public.payment_type,
    'offline'::public.payment_record_source,
    v_method, NULLIF(trim(COALESCE(p_method_reference, '')), ''),
    (SELECT auth.uid()), v_key
  )
  RETURNING id INTO v_payment_id;

  RETURN jsonb_build_object(
    'ok', true,
    'payment_id', v_payment_id,
    'idempotent_replay', false,
    'setup_balance', app_private.setup_payment_summary(p_project_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_void_setup_payment(
  p_payment_id uuid,
  p_void_reason text,
  p_replacement_amount numeric DEFAULT NULL,
  p_replacement_date date DEFAULT NULL,
  p_replacement_method text DEFAULT NULL,
  p_replacement_reference text DEFAULT NULL,
  p_replacement_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_project_id uuid;
  v_company_id uuid;
  v_voided_at timestamptz;
  v_replacement_id uuid;
  v_reason text;
BEGIN
  IF NOT app_private.is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  v_reason := NULLIF(trim(COALESCE(p_void_reason, '')), '');
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'VOID_REASON_REQUIRED';
  END IF;

  SELECT pp.project_id, pp.company_id, pp.voided_at
  INTO v_project_id, v_company_id, v_voided_at
  FROM public.project_payments pp
  WHERE pp.id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  PERFORM 1 FROM public.client_projects WHERE id = v_project_id FOR UPDATE;

  IF v_voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'ALREADY_VOIDED';
  END IF;

  UPDATE public.project_payments SET
    voided_at = now(),
    voided_by = (SELECT auth.uid()),
    void_reason = v_reason
  WHERE id = p_payment_id;

  IF p_replacement_amount IS NOT NULL THEN
    IF p_replacement_amount <= 0 THEN
      RAISE EXCEPTION 'INVALID_AMOUNT';
    END IF;
    IF p_replacement_date IS NULL THEN
      RAISE EXCEPTION 'INVALID_DATE';
    END IF;
    IF NULLIF(trim(COALESCE(p_replacement_method, '')), '') IS NULL THEN
      RAISE EXCEPTION 'METHOD_REQUIRED';
    END IF;

    INSERT INTO public.project_payments (
      project_id, company_id, payment_date, amount, type, record_source,
      payment_method, method_reference, recorded_by, idempotency_key, replaces_payment_id
    ) VALUES (
      v_project_id, v_company_id, p_replacement_date, p_replacement_amount,
      'setup'::public.payment_type, 'offline'::public.payment_record_source,
      trim(p_replacement_method), NULLIF(trim(COALESCE(p_replacement_reference, '')), ''),
      (SELECT auth.uid()),
      NULLIF(trim(COALESCE(p_replacement_idempotency_key, '')), ''),
      p_payment_id
    )
    RETURNING id INTO v_replacement_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'voided_payment_id', p_payment_id,
    'replacement_payment_id', v_replacement_id,
    'setup_balance', app_private.setup_payment_summary(v_project_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.member_get_setup_payment_summary(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_private.require_project_member(p_project_id)) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  RETURN app_private.setup_payment_summary(p_project_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_activation_eligibility(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_activate_project(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_payment_only_prep(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_record_setup_payment(uuid, numeric, date, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_void_setup_payment(uuid, text, numeric, date, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.member_get_setup_payment_summary(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_get_activation_eligibility(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_activate_project(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_payment_only_prep(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_setup_payment(uuid, numeric, date, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_void_setup_payment(uuid, text, numeric, date, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.member_get_setup_payment_summary(uuid) TO authenticated;
