-- Harden app_private.upsert_online_setup_payment: strict provider id reuse + revoke helper EXECUTE.

CREATE OR REPLACE FUNCTION app_private.online_provider_ledger_matches(
  p_existing_project_id uuid,
  p_existing_company_id uuid,
  p_existing_amount numeric,
  p_existing_date date,
  p_existing_type public.payment_type,
  p_project_id uuid,
  p_company_id uuid,
  p_amount numeric,
  p_payment_date date
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT
    p_existing_project_id = p_project_id
    AND p_existing_company_id = p_company_id
    AND p_existing_amount::numeric(12, 2) = p_amount::numeric(12, 2)
    AND p_existing_date = p_payment_date
    AND p_existing_type = 'setup'::public.payment_type;
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
  v_payment_id uuid;
  v_provider text;
  v_external text;
  v_existing_id uuid;
  v_existing_project_id uuid;
  v_existing_company_id uuid;
  v_existing_amount numeric(12, 2);
  v_existing_date date;
  v_existing_type public.payment_type;
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

  SELECT
    pp.id,
    pp.project_id,
    pp.company_id,
    pp.amount,
    pp.payment_date,
    pp.type
  INTO
    v_existing_id,
    v_existing_project_id,
    v_existing_company_id,
    v_existing_amount,
    v_existing_date,
    v_existing_type
  FROM public.project_payments pp
  WHERE pp.provider_name = v_provider
    AND pp.external_transaction_id = v_external
  FOR UPDATE;

  IF FOUND THEN
    IF NOT app_private.online_provider_ledger_matches(
      v_existing_project_id,
      v_existing_company_id,
      v_existing_amount,
      v_existing_date,
      v_existing_type,
      p_project_id,
      v_company_id,
      p_amount,
      p_payment_date
    ) THEN
      RAISE EXCEPTION 'PROVIDER_TRANSACTION_CONFLICT';
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'payment_id', v_existing_id,
      'idempotent_replay', true,
      'setup_balance', app_private.setup_payment_summary(p_project_id)
    );
  END IF;

  BEGIN
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
  EXCEPTION
    WHEN unique_violation THEN
      SELECT
        pp.id,
        pp.project_id,
        pp.company_id,
        pp.amount,
        pp.payment_date,
        pp.type
      INTO
        v_existing_id,
        v_existing_project_id,
        v_existing_company_id,
        v_existing_amount,
        v_existing_date,
        v_existing_type
      FROM public.project_payments pp
      WHERE pp.provider_name = v_provider
        AND pp.external_transaction_id = v_external
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE;
      END IF;

      IF NOT app_private.online_provider_ledger_matches(
        v_existing_project_id,
        v_existing_company_id,
        v_existing_amount,
        v_existing_date,
        v_existing_type,
        p_project_id,
        v_company_id,
        p_amount,
        p_payment_date
      ) THEN
        RAISE EXCEPTION 'PROVIDER_TRANSACTION_CONFLICT';
      END IF;

      RETURN jsonb_build_object(
        'ok', true,
        'payment_id', v_existing_id,
        'idempotent_replay', true,
        'setup_balance', app_private.setup_payment_summary(p_project_id)
      );
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'payment_id', v_payment_id,
    'idempotent_replay', false,
    'setup_balance', app_private.setup_payment_summary(p_project_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION app_private.insert_setup_payment_row(
  uuid, uuid, date, numeric, public.payment_record_source,
  text, text, text, text, uuid, text, uuid
) FROM PUBLIC;

REVOKE ALL ON FUNCTION app_private.insert_setup_payment_row(
  uuid, uuid, date, numeric, public.payment_record_source,
  text, text, text, text, uuid, text, uuid
) FROM anon, authenticated;

REVOKE ALL ON FUNCTION app_private.upsert_online_setup_payment(
  uuid, numeric, date, text, text, text, text
) FROM PUBLIC;

REVOKE ALL ON FUNCTION app_private.upsert_online_setup_payment(
  uuid, numeric, date, text, text, text, text
) FROM anon, authenticated;

-- Disposable M2 test entry point (not a public Stripe webhook).
CREATE OR REPLACE FUNCTION public.admin_milestone2_test_upsert_online_setup_payment(
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
BEGIN
  IF NOT app_private.is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  PERFORM app_private.milestone2_test_project_guard(p_project_id);

  RETURN app_private.upsert_online_setup_payment(
    p_project_id,
    p_amount,
    p_payment_date,
    p_provider_name,
    p_external_transaction_id,
    p_payment_method,
    p_method_reference
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_milestone2_test_upsert_online_setup_payment(
  uuid, numeric, date, text, text, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_milestone2_test_upsert_online_setup_payment(
  uuid, numeric, date, text, text, text, text
) TO authenticated;
