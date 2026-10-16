-- Milestone 3B hardening: idempotency payload checks, published-only customer fees,
-- setup-only void locking, provider ledger hooks (no Stripe in this milestone).

ALTER TABLE public.project_payments
  ADD COLUMN IF NOT EXISTS provider_name text,
  ADD COLUMN IF NOT EXISTS external_transaction_id text;

COMMENT ON COLUMN public.project_payments.provider_name IS
  'Payment processor identifier (e.g. stripe). NULL for manual offline admin entries.';
COMMENT ON COLUMN public.project_payments.external_transaction_id IS
  'Provider-unique transaction id (e.g. Stripe PaymentIntent id). NULL for manual offline entries.';

ALTER TABLE public.project_payments
  DROP CONSTRAINT IF EXISTS project_payments_provider_ledger_check;

ALTER TABLE public.project_payments
  ADD CONSTRAINT project_payments_provider_ledger_check
  CHECK (
    (provider_name IS NULL AND external_transaction_id IS NULL)
    OR (
      provider_name IS NOT NULL
      AND external_transaction_id IS NOT NULL
      AND record_source = 'online'::public.payment_record_source
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS project_payments_provider_external_uidx
  ON public.project_payments (provider_name, external_transaction_id)
  WHERE provider_name IS NOT NULL
    AND external_transaction_id IS NOT NULL;

-- Published scope fee only (NULL when scope not yet published).
CREATE OR REPLACE FUNCTION app_private.published_setup_fee(p_project_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_published integer;
  v_scope_fee numeric(12, 2);
BEGIN
  SELECT published_revision INTO v_published
  FROM public.client_projects
  WHERE id = p_project_id;

  IF NOT FOUND OR v_published IS NULL OR v_published <= 0 THEN
    RETURN NULL;
  END IF;

  SELECT sr.setup_fee INTO v_scope_fee
  FROM public.scope_revisions sr
  WHERE sr.project_id = p_project_id AND sr.revision = v_published
  LIMIT 1;

  RETURN v_scope_fee;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.draft_setup_fee_estimate(p_project_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_draft jsonb;
BEGIN
  SELECT d.scope_draft INTO v_draft
  FROM public.admin_project_scope_drafts d
  WHERE d.project_id = p_project_id
  LIMIT 1;

  IF v_draft IS NULL OR NOT (v_draft ? 'setup_fee') THEN
    RETURN NULL;
  END IF;

  IF NULLIF(v_draft->>'setup_fee', '') IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN (v_draft->>'setup_fee')::numeric(12, 2);
END;
$$;

CREATE OR REPLACE FUNCTION app_private.effective_setup_fee(p_project_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.published_setup_fee(p_project_id);
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
  v_confirmed boolean;
BEGIN
  v_fee := app_private.published_setup_fee(p_project_id);
  v_confirmed := v_fee IS NOT NULL;
  v_paid := app_private.setup_payments_received(p_project_id);

  IF NOT v_confirmed THEN
    RETURN jsonb_build_object(
      'fee_confirmed', false,
      'setup_fee', NULL,
      'received', v_paid,
      'remaining', NULL,
      'overpayment', NULL,
      'fully_paid', false
    );
  END IF;

  v_remaining := GREATEST(v_fee - v_paid, 0);
  v_over := GREATEST(v_paid - v_fee, 0);
  RETURN jsonb_build_object(
    'fee_confirmed', true,
    'setup_fee', v_fee,
    'received', v_paid,
    'remaining', v_remaining,
    'overpayment', v_over,
    'fully_paid', (v_fee <= 0 OR v_paid >= v_fee)
  );
END;
$$;

CREATE OR REPLACE FUNCTION app_private.setup_payment_payload_matches(
  p_stored_amount numeric,
  p_stored_date date,
  p_stored_method text,
  p_stored_reference text,
  p_amount numeric,
  p_payment_date date,
  p_payment_method text,
  p_method_reference text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT
    p_stored_amount::numeric(12, 2) = p_amount::numeric(12, 2)
    AND p_stored_date = p_payment_date
    AND COALESCE(NULLIF(trim(p_stored_method), ''), '') = COALESCE(NULLIF(trim(p_payment_method), ''), '')
    AND COALESCE(NULLIF(trim(p_stored_reference), ''), '') = COALESCE(NULLIF(trim(p_method_reference), ''), '');
$$;

CREATE OR REPLACE FUNCTION app_private.insert_setup_payment_row(
  p_project_id uuid,
  p_company_id uuid,
  p_payment_date date,
  p_amount numeric,
  p_record_source public.payment_record_source,
  p_payment_method text,
  p_method_reference text,
  p_provider_name text,
  p_external_transaction_id text,
  p_recorded_by uuid,
  p_idempotency_key text,
  p_replaces_payment_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payment_id uuid;
  v_provider text;
  v_external text;
  v_key text;
BEGIN
  v_provider := NULLIF(lower(trim(COALESCE(p_provider_name, ''))), '');
  v_external := NULLIF(trim(COALESCE(p_external_transaction_id, '')), '');
  v_key := NULLIF(trim(COALESCE(p_idempotency_key, '')), '');

  IF v_key IS NULL THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED';
  END IF;

  IF p_record_source = 'offline'::public.payment_record_source THEN
    IF v_provider IS NOT NULL OR v_external IS NOT NULL THEN
      RAISE EXCEPTION 'OFFLINE_PROVIDER_FIELDS_FORBIDDEN';
    END IF;
    IF NULLIF(trim(COALESCE(p_payment_method, '')), '') IS NULL THEN
      RAISE EXCEPTION 'METHOD_REQUIRED';
    END IF;
  ELSIF p_record_source = 'online'::public.payment_record_source THEN
    IF v_provider IS NULL OR v_external IS NULL THEN
      RAISE EXCEPTION 'PROVIDER_TRANSACTION_REQUIRED';
    END IF;
  END IF;

  INSERT INTO public.project_payments (
    project_id, company_id, payment_date, amount, type, record_source,
    payment_method, method_reference, provider_name, external_transaction_id,
    recorded_by, idempotency_key, replaces_payment_id
  ) VALUES (
    p_project_id, p_company_id, p_payment_date, p_amount, 'setup'::public.payment_type,
    p_record_source,
    NULLIF(trim(COALESCE(p_payment_method, '')), ''),
    NULLIF(trim(COALESCE(p_method_reference, '')), ''),
    v_provider, v_external,
    p_recorded_by, v_key, p_replaces_payment_id
  )
  RETURNING id INTO v_payment_id;

  RETURN v_payment_id;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.upsert_online_setup_payment(
  p_project_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_provider_name text,
  p_external_transaction_id text,
  p_payment_method text DEFAULT NULL,
  p_method_reference text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id uuid;
  v_existing uuid;
  v_payment_id uuid;
  v_provider text;
  v_external text;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT';
  END IF;

  IF p_payment_date IS NULL THEN
    RAISE EXCEPTION 'INVALID_DATE';
  END IF;

  v_provider := NULLIF(lower(trim(COALESCE(p_provider_name, ''))), '');
  v_external := NULLIF(trim(COALESCE(p_external_transaction_id, '')), '');

  IF v_provider IS NULL OR v_external IS NULL THEN
    RAISE EXCEPTION 'PROVIDER_TRANSACTION_REQUIRED';
  END IF;

  SELECT company_id INTO v_company_id
  FROM public.client_projects
  WHERE id = p_project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  SELECT id INTO v_existing
  FROM public.project_payments
  WHERE provider_name = v_provider
    AND external_transaction_id = v_external
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'payment_id', v_existing,
      'idempotent_replay', true,
      'setup_balance', app_private.setup_payment_summary(p_project_id)
    );
  END IF;

  v_payment_id := app_private.insert_setup_payment_row(
    p_project_id, v_company_id, p_payment_date, p_amount,
    'online'::public.payment_record_source,
    COALESCE(NULLIF(trim(COALESCE(p_payment_method, '')), ''), v_provider),
    p_method_reference,
    v_provider, v_external,
    NULL,
    'provider:' || v_provider || ':' || v_external,
    NULL
  );

  RETURN jsonb_build_object(
    'ok', true,
    'payment_id', v_payment_id,
    'idempotent_replay', false,
    'setup_balance', app_private.setup_payment_summary(p_project_id)
  );
END;
$$;

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
  v_existing record;
  v_payment_id uuid;
  v_key text;
  v_ref text;
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

  IF NULLIF(trim(COALESCE(p_payment_method, '')), '') IS NULL THEN
    RAISE EXCEPTION 'METHOD_REQUIRED';
  END IF;

  v_key := NULLIF(trim(COALESCE(p_idempotency_key, '')), '');
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED';
  END IF;

  v_ref := NULLIF(trim(COALESCE(p_method_reference, '')), '');

  SELECT company_id INTO v_company_id
  FROM public.client_projects
  WHERE id = p_project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  SELECT pp.id, pp.amount, pp.payment_date, pp.payment_method, pp.method_reference
  INTO v_existing
  FROM public.project_payments pp
  WHERE pp.project_id = p_project_id AND pp.idempotency_key = v_key
  LIMIT 1;

  IF FOUND THEN
    IF NOT app_private.setup_payment_payload_matches(
      v_existing.amount, v_existing.payment_date, v_existing.payment_method, v_existing.method_reference,
      p_amount, p_payment_date, p_payment_method, v_ref
    ) THEN
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH';
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'payment_id', v_existing.id,
      'idempotent_replay', true,
      'setup_balance', app_private.setup_payment_summary(p_project_id)
    );
  END IF;

  v_payment_id := app_private.insert_setup_payment_row(
    p_project_id, v_company_id, p_payment_date, p_amount,
    'offline'::public.payment_record_source,
    p_payment_method, v_ref,
    NULL, NULL,
    (SELECT auth.uid()), v_key, NULL
  );

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
  v_payment_type public.payment_type;
  v_replacement_id uuid;
  v_reason text;
  v_rep_key text;
BEGIN
  IF NOT app_private.is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  v_reason := NULLIF(trim(COALESCE(p_void_reason, '')), '');
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'VOID_REASON_REQUIRED';
  END IF;

  SELECT pp.project_id INTO v_project_id
  FROM public.project_payments pp
  WHERE pp.id = p_payment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  PERFORM 1 FROM public.client_projects WHERE id = v_project_id FOR UPDATE;

  SELECT pp.project_id, pp.company_id, pp.voided_at, pp.type
  INTO v_project_id, v_company_id, v_voided_at, v_payment_type
  FROM public.project_payments pp
  WHERE pp.id = p_payment_id AND pp.project_id = v_project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  IF v_payment_type <> 'setup'::public.payment_type THEN
    RAISE EXCEPTION 'NOT_SETUP_PAYMENT';
  END IF;

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

    v_rep_key := NULLIF(trim(COALESCE(p_replacement_idempotency_key, '')), '');
    IF v_rep_key IS NULL THEN
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED';
    END IF;

    v_replacement_id := app_private.insert_setup_payment_row(
      v_project_id, v_company_id, p_replacement_date, p_replacement_amount,
      'offline'::public.payment_record_source,
      p_replacement_method, p_replacement_reference,
      NULL, NULL,
      (SELECT auth.uid()), v_rep_key, p_payment_id
    );
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

CREATE OR REPLACE FUNCTION public.admin_get_setup_payment_summary(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_obligation jsonb;
  v_draft numeric(12, 2);
BEGIN
  IF NOT app_private.is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.client_projects WHERE id = p_project_id) THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  v_obligation := app_private.setup_payment_summary(p_project_id);
  v_draft := app_private.draft_setup_fee_estimate(p_project_id);

  RETURN jsonb_build_object(
    'obligation', v_obligation,
    'draft_setup_fee_estimate', v_draft
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_setup_payment_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_setup_payment_summary(uuid) TO authenticated;

-- Disposable fixture helper: non-setup ledger row for void guard tests only.
CREATE OR REPLACE FUNCTION public.admin_milestone2_test_insert_non_setup_payment(
  p_project_id uuid,
  p_type public.payment_type DEFAULT 'subscription'::public.payment_type
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id uuid;
  v_id uuid;
BEGIN
  IF NOT app_private.is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  PERFORM app_private.milestone2_test_project_guard(p_project_id);

  IF p_type = 'setup'::public.payment_type THEN
    RAISE EXCEPTION 'USE_ADMIN_RECORD_SETUP_PAYMENT';
  END IF;

  SELECT company_id INTO v_company_id
  FROM public.client_projects
  WHERE id = p_project_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  INSERT INTO public.project_payments (
    project_id, company_id, payment_date, amount, type, record_source
  ) VALUES (
    p_project_id, v_company_id, CURRENT_DATE, 99.00, p_type, 'offline'::public.payment_record_source
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_milestone2_test_insert_non_setup_payment(uuid, public.payment_type) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_milestone2_test_insert_non_setup_payment(uuid, public.payment_type) TO authenticated;
