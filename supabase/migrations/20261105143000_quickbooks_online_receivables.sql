-- QuickBooks Online: one connection per company, encrypted tokens, open invoices.
-- Accounting API calls are read-only. Sandbox and production rows are distinguished
-- by intuit_environment and must be synced only with that environment's credentials.

CREATE TYPE public.quickbooks_connection_status AS ENUM (
  'disconnected',
  'connected',
  'reconnect_required',
  'syncing',
  'error'
);

CREATE TYPE public.quickbooks_intuit_environment AS ENUM (
  'sandbox',
  'production'
);

CREATE TABLE public.quickbooks_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies (id) ON DELETE CASCADE,
  intuit_environment public.quickbooks_intuit_environment NOT NULL,
  realm_id text,
  company_name text,
  status public.quickbooks_connection_status NOT NULL DEFAULT 'disconnected',
  reporting_timezone text NOT NULL DEFAULT 'UTC',
  reporting_timezone_source text NOT NULL DEFAULT 'utc_default',
  reporting_date date,
  connected_at timestamptz,
  disconnected_at timestamptz,
  last_successful_sync_at timestamptz,
  last_sync_error_code text,
  sync_generation bigint NOT NULL DEFAULT 0,
  syncing_started_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quickbooks_connections_realm_format CHECK (
    realm_id IS NULL OR realm_id ~ '^[0-9]{1,20}$'
  ),
  CONSTRAINT quickbooks_connections_timezone_source CHECK (
    reporting_timezone_source IN ('quickbooks', 'configured', 'utc_default')
  )
);

CREATE TABLE public.quickbooks_connection_secrets (
  connection_id uuid PRIMARY KEY REFERENCES public.quickbooks_connections (id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  refresh_token_enc text NOT NULL,
  access_token_enc text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX quickbooks_connection_secrets_company_idx
  ON public.quickbooks_connection_secrets (company_id);

CREATE TABLE public.quickbooks_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_hash text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('connect', 'replace')),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX quickbooks_oauth_states_company_idx
  ON public.quickbooks_oauth_states (company_id);

CREATE INDEX quickbooks_oauth_states_user_idx
  ON public.quickbooks_oauth_states (user_id);

CREATE INDEX quickbooks_oauth_states_expires_idx
  ON public.quickbooks_oauth_states (expires_at)
  WHERE consumed_at IS NULL;

CREATE TABLE public.quickbooks_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.quickbooks_connections (id) ON DELETE CASCADE,
  intuit_environment public.quickbooks_intuit_environment NOT NULL,
  realm_id text NOT NULL,
  qbo_invoice_id text NOT NULL,
  doc_number text,
  customer_name text,
  txn_date date,
  due_date date,
  total_amount numeric(12, 2),
  remaining_balance numeric(12, 2) NOT NULL,
  sync_run_id uuid NOT NULL,
  qbo_updated_at timestamptz,
  imported_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quickbooks_invoices_company_qbo_id_key UNIQUE (company_id, qbo_invoice_id),
  CONSTRAINT quickbooks_invoices_remaining_positive CHECK (remaining_balance > 0),
  CONSTRAINT quickbooks_invoices_realm_format CHECK (realm_id ~ '^[0-9]{1,20}$')
);

CREATE INDEX quickbooks_invoices_connection_idx
  ON public.quickbooks_invoices (connection_id);

CREATE INDEX quickbooks_invoices_company_due_idx
  ON public.quickbooks_invoices (company_id, due_date);

CREATE INDEX quickbooks_invoices_company_sync_run_idx
  ON public.quickbooks_invoices (company_id, sync_run_id);

CREATE TABLE public.quickbooks_sync_locks (
  company_id uuid PRIMARY KEY REFERENCES public.companies (id) ON DELETE CASCADE,
  locked_until timestamptz,
  locked_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION app_private.quickbooks_consume_oauth_state(p_state_hash text)
RETURNS TABLE (
  user_id uuid,
  company_id uuid,
  purpose text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.quickbooks_oauth_states s
  SET consumed_at = now()
  WHERE s.state_hash = p_state_hash
    AND s.consumed_at IS NULL
    AND s.expires_at > now()
  RETURNING s.user_id, s.company_id, s.purpose;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.quickbooks_acquire_sync_lease(
  p_company_id uuid,
  p_worker_id text,
  p_ttl_seconds integer DEFAULT 300
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_until timestamptz := now() + make_interval(secs => p_ttl_seconds);
  v_holder text;
BEGIN
  INSERT INTO public.quickbooks_sync_locks (company_id, locked_until, locked_by, updated_at)
  VALUES (p_company_id, v_until, p_worker_id, now())
  ON CONFLICT (company_id) DO UPDATE
    SET locked_until = EXCLUDED.locked_until,
        locked_by = EXCLUDED.locked_by,
        updated_at = EXCLUDED.updated_at
    WHERE public.quickbooks_sync_locks.locked_until IS NULL
       OR public.quickbooks_sync_locks.locked_until <= now()
  RETURNING locked_by INTO v_holder;

  RETURN COALESCE(v_holder = p_worker_id, false);
END;
$$;

CREATE OR REPLACE FUNCTION app_private.quickbooks_release_sync_lease(
  p_company_id uuid,
  p_worker_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rows integer;
BEGIN
  UPDATE public.quickbooks_sync_locks
  SET locked_until = NULL,
      locked_by = NULL,
      updated_at = now()
  WHERE company_id = p_company_id
    AND locked_by = p_worker_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.quickbooks_sync_guard(
  p_connection_id uuid,
  p_company_id uuid,
  p_expected_generation bigint,
  p_worker_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.quickbooks_connections c
    INNER JOIN public.quickbooks_sync_locks l ON l.company_id = c.company_id
    WHERE c.id = p_connection_id
      AND c.company_id = p_company_id
      AND c.sync_generation = p_expected_generation
      AND c.disconnected_at IS NULL
      AND c.status <> 'disconnected'::public.quickbooks_connection_status
      AND l.locked_by = p_worker_id
      AND l.locked_until > now()
  );
$$;

CREATE OR REPLACE FUNCTION app_private.quickbooks_persist_tokens(
  p_connection_id uuid,
  p_company_id uuid,
  p_expected_generation bigint,
  p_refresh_token_enc text,
  p_access_token_enc text,
  p_access_token_expires_at timestamptz,
  p_refresh_token_expires_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  SELECT c.company_id INTO v_company_id
  FROM public.quickbooks_connections c
  WHERE c.id = p_connection_id
    AND c.company_id = p_company_id
    AND c.sync_generation = p_expected_generation
    AND c.disconnected_at IS NULL
    AND c.status <> 'disconnected'::public.quickbooks_connection_status;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO public.quickbooks_connection_secrets (
    connection_id,
    company_id,
    refresh_token_enc,
    access_token_enc,
    access_token_expires_at,
    refresh_token_expires_at,
    updated_at
  )
  VALUES (
    p_connection_id,
    v_company_id,
    p_refresh_token_enc,
    p_access_token_enc,
    p_access_token_expires_at,
    p_refresh_token_expires_at,
    now()
  )
  ON CONFLICT (connection_id) DO UPDATE
  SET refresh_token_enc = EXCLUDED.refresh_token_enc,
      access_token_enc = EXCLUDED.access_token_enc,
      access_token_expires_at = EXCLUDED.access_token_expires_at,
      refresh_token_expires_at = EXCLUDED.refresh_token_expires_at,
      company_id = EXCLUDED.company_id,
      updated_at = EXCLUDED.updated_at;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.quickbooks_mark_syncing(
  p_connection_id uuid,
  p_company_id uuid,
  p_expected_generation bigint,
  p_worker_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rows integer;
BEGIN
  IF NOT app_private.quickbooks_sync_guard(
    p_connection_id, p_company_id, p_expected_generation, p_worker_id
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.quickbooks_connections
  SET status = 'syncing'::public.quickbooks_connection_status,
      syncing_started_at = now(),
      last_sync_error_code = NULL,
      updated_at = now()
  WHERE id = p_connection_id
    AND company_id = p_company_id
    AND sync_generation = p_expected_generation;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.quickbooks_upsert_open_invoices(
  p_connection_id uuid,
  p_company_id uuid,
  p_expected_generation bigint,
  p_worker_id text,
  p_sync_run_id uuid,
  p_invoices jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_env public.quickbooks_intuit_environment;
  v_realm text;
BEGIN
  IF NOT app_private.quickbooks_sync_guard(
    p_connection_id, p_company_id, p_expected_generation, p_worker_id
  ) THEN
    RETURN false;
  END IF;

  SELECT c.intuit_environment, c.realm_id
  INTO v_env, v_realm
  FROM public.quickbooks_connections c
  WHERE c.id = p_connection_id
    AND c.company_id = p_company_id;

  IF v_realm IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.quickbooks_invoices (
    company_id,
    connection_id,
    intuit_environment,
    realm_id,
    qbo_invoice_id,
    doc_number,
    customer_name,
    txn_date,
    due_date,
    total_amount,
    remaining_balance,
    sync_run_id,
    qbo_updated_at,
    imported_at
  )
  SELECT
    p_company_id,
    p_connection_id,
    v_env,
    v_realm,
    item->>'qbo_invoice_id',
    NULLIF(item->>'doc_number', ''),
    NULLIF(item->>'customer_name', ''),
    NULLIF(item->>'txn_date', '')::date,
    NULLIF(item->>'due_date', '')::date,
    NULLIF(item->>'total_amount', '')::numeric,
    (item->>'remaining_balance')::numeric,
    p_sync_run_id,
    NULLIF(item->>'qbo_updated_at', '')::timestamptz,
    now()
  FROM jsonb_array_elements(COALESCE(p_invoices, '[]'::jsonb)) AS item
  WHERE COALESCE(item->>'voided', 'false') <> 'true'
    AND NULLIF(item->>'qbo_invoice_id', '') IS NOT NULL
    AND (item->>'remaining_balance')::numeric > 0
  ON CONFLICT ON CONSTRAINT quickbooks_invoices_company_qbo_id_key
  DO UPDATE SET
    connection_id = EXCLUDED.connection_id,
    intuit_environment = EXCLUDED.intuit_environment,
    realm_id = EXCLUDED.realm_id,
    doc_number = EXCLUDED.doc_number,
    customer_name = EXCLUDED.customer_name,
    txn_date = EXCLUDED.txn_date,
    due_date = EXCLUDED.due_date,
    total_amount = EXCLUDED.total_amount,
    remaining_balance = EXCLUDED.remaining_balance,
    sync_run_id = EXCLUDED.sync_run_id,
    qbo_updated_at = EXCLUDED.qbo_updated_at,
    imported_at = EXCLUDED.imported_at
  WHERE public.quickbooks_invoices.company_id = EXCLUDED.company_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.quickbooks_finalize_open_invoices(
  p_connection_id uuid,
  p_company_id uuid,
  p_expected_generation bigint,
  p_worker_id text,
  p_sync_run_id uuid,
  p_reporting_date date,
  p_reporting_timezone text,
  p_reporting_timezone_source text,
  p_company_name text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted integer;
BEGIN
  IF NOT app_private.quickbooks_sync_guard(
    p_connection_id, p_company_id, p_expected_generation, p_worker_id
  ) THEN
    RETURN -1;
  END IF;

  IF p_reporting_timezone_source NOT IN ('quickbooks', 'configured', 'utc_default') THEN
    RETURN -1;
  END IF;

  DELETE FROM public.quickbooks_invoices i
  WHERE i.company_id = p_company_id
    AND i.connection_id = p_connection_id
    AND i.sync_run_id <> p_sync_run_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  UPDATE public.quickbooks_connections
  SET status = 'connected'::public.quickbooks_connection_status,
      reporting_date = p_reporting_date,
      reporting_timezone = p_reporting_timezone,
      reporting_timezone_source = p_reporting_timezone_source,
      company_name = COALESCE(p_company_name, company_name),
      last_successful_sync_at = now(),
      last_sync_error_code = NULL,
      syncing_started_at = NULL,
      updated_at = now()
  WHERE id = p_connection_id
    AND company_id = p_company_id
    AND sync_generation = p_expected_generation;

  RETURN v_deleted;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.quickbooks_mark_error(
  p_connection_id uuid,
  p_company_id uuid,
  p_expected_generation bigint,
  p_worker_id text,
  p_error_code text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rows integer;
BEGIN
  IF NOT app_private.quickbooks_sync_guard(
    p_connection_id, p_company_id, p_expected_generation, p_worker_id
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.quickbooks_connections
  SET status = 'error'::public.quickbooks_connection_status,
      last_sync_error_code = left(p_error_code, 80),
      syncing_started_at = NULL,
      updated_at = now()
  WHERE id = p_connection_id
    AND company_id = p_company_id
    AND sync_generation = p_expected_generation;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.quickbooks_mark_reconnect_required(
  p_connection_id uuid,
  p_company_id uuid,
  p_expected_generation bigint,
  p_worker_id text,
  p_error_code text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rows integer;
BEGIN
  IF NOT app_private.quickbooks_sync_guard(
    p_connection_id, p_company_id, p_expected_generation, p_worker_id
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.quickbooks_connections
  SET status = 'reconnect_required'::public.quickbooks_connection_status,
      last_sync_error_code = left(COALESCE(p_error_code, 'RECONNECT_REQUIRED'), 80),
      syncing_started_at = NULL,
      updated_at = now()
  WHERE id = p_connection_id
    AND company_id = p_company_id
    AND sync_generation = p_expected_generation;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.quickbooks_reset_import_for_replace(
  p_connection_id uuid,
  p_company_id uuid
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_gen bigint;
BEGIN
  UPDATE public.quickbooks_connections
  SET sync_generation = sync_generation + 1,
      syncing_started_at = NULL,
      reporting_date = NULL,
      last_successful_sync_at = NULL,
      last_sync_error_code = NULL,
      updated_at = now()
  WHERE id = p_connection_id
    AND company_id = p_company_id
  RETURNING sync_generation INTO v_gen;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  DELETE FROM public.quickbooks_invoices WHERE company_id = p_company_id;
  DELETE FROM public.quickbooks_connection_secrets WHERE connection_id = p_connection_id;
  RETURN v_gen;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.quickbooks_disconnect_company(
  p_connection_id uuid,
  p_company_id uuid
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_gen bigint;
BEGIN
  UPDATE public.quickbooks_connections
  SET sync_generation = sync_generation + 1,
      status = 'disconnected'::public.quickbooks_connection_status,
      disconnected_at = now(),
      syncing_started_at = NULL,
      reporting_date = NULL,
      last_successful_sync_at = NULL,
      last_sync_error_code = NULL,
      updated_at = now()
  WHERE id = p_connection_id
    AND company_id = p_company_id
  RETURNING sync_generation INTO v_gen;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  DELETE FROM public.quickbooks_invoices WHERE company_id = p_company_id;
  DELETE FROM public.quickbooks_connection_secrets WHERE connection_id = p_connection_id;
  RETURN v_gen;
END;
$$;

CREATE OR REPLACE FUNCTION public.member_get_quickbooks_status(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_conn public.quickbooks_connections;
  v_open numeric(12, 2);
  v_overdue numeric(12, 2);
  v_count integer;
BEGIN
  IF NOT app_private.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT * INTO v_conn
  FROM public.quickbooks_connections
  WHERE company_id = p_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'connected', false,
      'status', 'disconnected',
      'intuit_environment', NULL,
      'realm_id', NULL,
      'company_name', NULL,
      'reporting_date', NULL,
      'reporting_timezone', NULL,
      'reporting_timezone_source', NULL,
      'last_successful_sync_at', NULL,
      'last_sync_error_code', NULL,
      'syncing_started_at', NULL,
      'open_balance', NULL,
      'overdue_balance', NULL,
      'invoice_count', 0
    );
  END IF;

  IF v_conn.disconnected_at IS NOT NULL OR v_conn.status = 'disconnected'::public.quickbooks_connection_status THEN
    RETURN jsonb_build_object(
      'connected', false,
      'status', 'disconnected',
      'intuit_environment', v_conn.intuit_environment,
      'realm_id', v_conn.realm_id,
      'company_name', v_conn.company_name,
      'reporting_date', NULL,
      'reporting_timezone', NULL,
      'reporting_timezone_source', NULL,
      'last_successful_sync_at', NULL,
      'last_sync_error_code', NULL,
      'syncing_started_at', NULL,
      'open_balance', NULL,
      'overdue_balance', NULL,
      'invoice_count', 0
    );
  END IF;

  IF v_conn.last_successful_sync_at IS NULL THEN
    v_open := NULL;
    v_overdue := NULL;
    v_count := 0;
  ELSE
    SELECT
      COALESCE(sum(i.remaining_balance), 0),
      CASE
        WHEN v_conn.reporting_date IS NULL THEN NULL
        ELSE COALESCE(sum(i.remaining_balance) FILTER (
          WHERE i.due_date IS NOT NULL AND i.due_date < v_conn.reporting_date
        ), 0)
      END,
      count(*)::integer
    INTO v_open, v_overdue, v_count
    FROM public.quickbooks_invoices i
    WHERE i.company_id = p_company_id
      AND i.connection_id = v_conn.id
      AND i.realm_id = v_conn.realm_id
      AND i.intuit_environment = v_conn.intuit_environment;
  END IF;

  RETURN jsonb_build_object(
    'connected', true,
    'status', v_conn.status,
    'intuit_environment', v_conn.intuit_environment,
    'realm_id', v_conn.realm_id,
    'company_name', v_conn.company_name,
    'reporting_date', v_conn.reporting_date,
    'reporting_timezone', v_conn.reporting_timezone,
    'reporting_timezone_source', v_conn.reporting_timezone_source,
    'last_successful_sync_at', v_conn.last_successful_sync_at,
    'last_sync_error_code', v_conn.last_sync_error_code,
    'syncing_started_at', v_conn.syncing_started_at,
    'open_balance', v_open,
    'overdue_balance', v_overdue,
    'invoice_count', v_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.member_list_quickbooks_invoices(
  p_company_id uuid,
  p_limit integer DEFAULT 200
)
RETURNS TABLE (
  id uuid,
  doc_number text,
  customer_name text,
  txn_date date,
  due_date date,
  remaining_balance numeric,
  overdue boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 200), 1), 200);
  v_reporting date;
  v_connection_id uuid;
  v_realm text;
  v_env public.quickbooks_intuit_environment;
BEGIN
  IF NOT app_private.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT c.reporting_date, c.id, c.realm_id, c.intuit_environment
  INTO v_reporting, v_connection_id, v_realm, v_env
  FROM public.quickbooks_connections c
  WHERE c.company_id = p_company_id
    AND c.disconnected_at IS NULL
    AND c.status IN (
      'connected'::public.quickbooks_connection_status,
      'syncing'::public.quickbooks_connection_status,
      'error'::public.quickbooks_connection_status,
      'reconnect_required'::public.quickbooks_connection_status
    )
    AND c.last_successful_sync_at IS NOT NULL;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    i.id,
    i.doc_number,
    i.customer_name,
    i.txn_date,
    i.due_date,
    i.remaining_balance,
    (i.due_date IS NOT NULL AND v_reporting IS NOT NULL AND i.due_date < v_reporting) AS overdue
  FROM public.quickbooks_invoices i
  WHERE i.company_id = p_company_id
    AND i.connection_id = v_connection_id
    AND i.realm_id = v_realm
    AND i.intuit_environment = v_env
  ORDER BY i.due_date ASC NULLS LAST, i.doc_number ASC NULLS LAST
  LIMIT v_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.quickbooks_consume_oauth_state(p_state_hash text)
RETURNS TABLE (user_id uuid, company_id uuid, purpose text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT * FROM app_private.quickbooks_consume_oauth_state(p_state_hash);
$$;

CREATE OR REPLACE FUNCTION public.quickbooks_acquire_sync_lease(
  p_company_id uuid,
  p_worker_id text,
  p_ttl_seconds integer DEFAULT 300
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.quickbooks_acquire_sync_lease(p_company_id, p_worker_id, p_ttl_seconds);
$$;

CREATE OR REPLACE FUNCTION public.quickbooks_release_sync_lease(
  p_company_id uuid,
  p_worker_id text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.quickbooks_release_sync_lease(p_company_id, p_worker_id);
$$;

CREATE OR REPLACE FUNCTION public.quickbooks_persist_tokens(
  p_connection_id uuid,
  p_company_id uuid,
  p_expected_generation bigint,
  p_refresh_token_enc text,
  p_access_token_enc text,
  p_access_token_expires_at timestamptz,
  p_refresh_token_expires_at timestamptz
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.quickbooks_persist_tokens(
    p_connection_id,
    p_company_id,
    p_expected_generation,
    p_refresh_token_enc,
    p_access_token_enc,
    p_access_token_expires_at,
    p_refresh_token_expires_at
  );
$$;

CREATE OR REPLACE FUNCTION public.quickbooks_mark_syncing(
  p_connection_id uuid,
  p_company_id uuid,
  p_expected_generation bigint,
  p_worker_id text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.quickbooks_mark_syncing(
    p_connection_id, p_company_id, p_expected_generation, p_worker_id
  );
$$;

CREATE OR REPLACE FUNCTION public.quickbooks_upsert_open_invoices(
  p_connection_id uuid,
  p_company_id uuid,
  p_expected_generation bigint,
  p_worker_id text,
  p_sync_run_id uuid,
  p_invoices jsonb
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.quickbooks_upsert_open_invoices(
    p_connection_id,
    p_company_id,
    p_expected_generation,
    p_worker_id,
    p_sync_run_id,
    p_invoices
  );
$$;

CREATE OR REPLACE FUNCTION public.quickbooks_finalize_open_invoices(
  p_connection_id uuid,
  p_company_id uuid,
  p_expected_generation bigint,
  p_worker_id text,
  p_sync_run_id uuid,
  p_reporting_date date,
  p_reporting_timezone text,
  p_reporting_timezone_source text,
  p_company_name text
)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.quickbooks_finalize_open_invoices(
    p_connection_id,
    p_company_id,
    p_expected_generation,
    p_worker_id,
    p_sync_run_id,
    p_reporting_date,
    p_reporting_timezone,
    p_reporting_timezone_source,
    p_company_name
  );
$$;

CREATE OR REPLACE FUNCTION public.quickbooks_mark_error(
  p_connection_id uuid,
  p_company_id uuid,
  p_expected_generation bigint,
  p_worker_id text,
  p_error_code text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.quickbooks_mark_error(
    p_connection_id, p_company_id, p_expected_generation, p_worker_id, p_error_code
  );
$$;

CREATE OR REPLACE FUNCTION public.quickbooks_mark_reconnect_required(
  p_connection_id uuid,
  p_company_id uuid,
  p_expected_generation bigint,
  p_worker_id text,
  p_error_code text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.quickbooks_mark_reconnect_required(
    p_connection_id, p_company_id, p_expected_generation, p_worker_id, p_error_code
  );
$$;

CREATE OR REPLACE FUNCTION public.quickbooks_reset_import_for_replace(
  p_connection_id uuid,
  p_company_id uuid
)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.quickbooks_reset_import_for_replace(p_connection_id, p_company_id);
$$;

CREATE OR REPLACE FUNCTION public.quickbooks_disconnect_company(
  p_connection_id uuid,
  p_company_id uuid
)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.quickbooks_disconnect_company(p_connection_id, p_company_id);
$$;

REVOKE ALL ON FUNCTION app_private.quickbooks_consume_oauth_state(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.quickbooks_acquire_sync_lease(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.quickbooks_release_sync_lease(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.quickbooks_sync_guard(uuid, uuid, bigint, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.quickbooks_persist_tokens(uuid, uuid, bigint, text, text, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.quickbooks_mark_syncing(uuid, uuid, bigint, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.quickbooks_upsert_open_invoices(uuid, uuid, bigint, text, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.quickbooks_finalize_open_invoices(uuid, uuid, bigint, text, uuid, date, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.quickbooks_mark_error(uuid, uuid, bigint, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.quickbooks_mark_reconnect_required(uuid, uuid, bigint, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.quickbooks_reset_import_for_replace(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.quickbooks_disconnect_company(uuid, uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.quickbooks_consume_oauth_state(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.quickbooks_acquire_sync_lease(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.quickbooks_release_sync_lease(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.quickbooks_persist_tokens(uuid, uuid, bigint, text, text, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.quickbooks_mark_syncing(uuid, uuid, bigint, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.quickbooks_upsert_open_invoices(uuid, uuid, bigint, text, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.quickbooks_finalize_open_invoices(uuid, uuid, bigint, text, uuid, date, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.quickbooks_mark_error(uuid, uuid, bigint, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.quickbooks_mark_reconnect_required(uuid, uuid, bigint, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.quickbooks_reset_import_for_replace(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.quickbooks_disconnect_company(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.member_get_quickbooks_status(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.member_list_quickbooks_invoices(uuid, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.quickbooks_consume_oauth_state(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.quickbooks_acquire_sync_lease(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.quickbooks_release_sync_lease(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.quickbooks_persist_tokens(uuid, uuid, bigint, text, text, timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.quickbooks_mark_syncing(uuid, uuid, bigint, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.quickbooks_upsert_open_invoices(uuid, uuid, bigint, text, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.quickbooks_finalize_open_invoices(uuid, uuid, bigint, text, uuid, date, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.quickbooks_mark_error(uuid, uuid, bigint, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.quickbooks_mark_reconnect_required(uuid, uuid, bigint, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.quickbooks_reset_import_for_replace(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.quickbooks_disconnect_company(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.member_get_quickbooks_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.member_list_quickbooks_invoices(uuid, integer) TO authenticated;

ALTER TABLE public.quickbooks_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quickbooks_connection_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quickbooks_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quickbooks_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quickbooks_sync_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY quickbooks_connections_member_select ON public.quickbooks_connections
  FOR SELECT TO authenticated
  USING (app_private.is_company_member(company_id));

CREATE POLICY quickbooks_invoices_member_select ON public.quickbooks_invoices
  FOR SELECT TO authenticated
  USING (app_private.is_company_member(company_id));

REVOKE ALL ON TABLE public.quickbooks_connections FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.quickbooks_invoices FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.quickbooks_connection_secrets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.quickbooks_oauth_states FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.quickbooks_sync_locks FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.quickbooks_connections TO authenticated;
GRANT SELECT ON TABLE public.quickbooks_invoices TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quickbooks_connections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quickbooks_connection_secrets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quickbooks_oauth_states TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quickbooks_invoices TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quickbooks_sync_locks TO service_role;
