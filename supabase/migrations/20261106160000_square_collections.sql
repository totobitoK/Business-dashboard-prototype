-- Square: one seller per company, encrypted tokens, selected locations,
-- and completed payments and refunds. This milestone only reads Square.
-- Sandbox and production rows stay on square_environment and sync only
-- with that environment's credentials.

CREATE TYPE public.square_connection_status AS ENUM (
  'disconnected',
  'connected',
  'reconnect_required',
  'syncing',
  'error'
);

CREATE TYPE public.square_environment AS ENUM (
  'sandbox',
  'production'
);

CREATE TYPE public.square_transaction_kind AS ENUM (
  'payment',
  'refund'
);

CREATE TABLE public.square_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies (id) ON DELETE CASCADE,
  square_environment public.square_environment NOT NULL,
  merchant_id text,
  merchant_name text,
  status public.square_connection_status NOT NULL DEFAULT 'disconnected',
  reporting_timezone text NOT NULL DEFAULT 'America/New_York',
  reporting_timezone_source text NOT NULL DEFAULT 'configured',
  reporting_date date,
  locations_confirmed_at timestamptz,
  connected_at timestamptz,
  disconnected_at timestamptz,
  last_successful_sync_at timestamptz,
  last_sync_error_code text,
  sync_generation bigint NOT NULL DEFAULT 0,
  syncing_started_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT square_connections_merchant_format CHECK (
    merchant_id IS NULL OR merchant_id ~ '^[A-Za-z0-9]{1,64}$'
  ),
  CONSTRAINT square_connections_timezone_source CHECK (
    reporting_timezone_source IN ('configured')
  ),
  CONSTRAINT square_connections_timezone_nonempty CHECK (length(btrim(reporting_timezone)) > 0)
);

CREATE TABLE public.square_connection_secrets (
  connection_id uuid PRIMARY KEY REFERENCES public.square_connections (id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  refresh_token_enc text NOT NULL,
  access_token_enc text NOT NULL,
  access_token_expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.square_oauth_states (
  state_hash text PRIMARY KEY,
  user_id uuid NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  purpose text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT square_oauth_states_purpose CHECK (purpose IN ('connect', 'replace'))
);

CREATE INDEX square_oauth_states_unconsumed_expires_idx
  ON public.square_oauth_states (expires_at)
  WHERE consumed_at IS NULL;

CREATE TABLE public.square_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.square_connections (id) ON DELETE CASCADE,
  square_location_id text NOT NULL,
  name text,
  status text,
  currency text,
  selected boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT square_locations_company_location_key UNIQUE (company_id, square_location_id),
  CONSTRAINT square_locations_id_format CHECK (square_location_id ~ '^[A-Za-z0-9]{1,64}$'),
  CONSTRAINT square_locations_currency_format CHECK (
    currency IS NULL OR currency ~ '^[A-Z]{3}$'
  )
);

CREATE INDEX square_locations_connection_idx
  ON public.square_locations (connection_id);

CREATE TABLE public.square_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.square_connections (id) ON DELETE CASCADE,
  square_environment public.square_environment NOT NULL,
  merchant_id text NOT NULL,
  kind public.square_transaction_kind NOT NULL,
  square_id text NOT NULL,
  location_id text NOT NULL,
  location_name text,
  created_at timestamptz NOT NULL,
  reporting_date date NOT NULL,
  currency text NOT NULL,
  amount_minor bigint NOT NULL,
  source_type text,
  sync_run_id uuid NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT square_transactions_company_kind_id_key UNIQUE (company_id, kind, square_id),
  CONSTRAINT square_transactions_id_format CHECK (square_id ~ '^[A-Za-z0-9_-]{1,192}$'),
  CONSTRAINT square_transactions_location_format CHECK (location_id ~ '^[A-Za-z0-9]{1,64}$'),
  CONSTRAINT square_transactions_currency_format CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT square_transactions_amount_positive CHECK (amount_minor > 0)
);

CREATE INDEX square_transactions_company_reporting_idx
  ON public.square_transactions (company_id, reporting_date, currency);

CREATE INDEX square_transactions_company_created_idx
  ON public.square_transactions (company_id, created_at DESC);

CREATE INDEX square_transactions_company_sync_run_idx
  ON public.square_transactions (company_id, sync_run_id);

CREATE TABLE public.square_sync_locks (
  company_id uuid PRIMARY KEY REFERENCES public.companies (id) ON DELETE CASCADE,
  locked_until timestamptz,
  locked_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION app_private.square_consume_oauth_state(p_state_hash text)
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
  UPDATE public.square_oauth_states s
  SET consumed_at = now()
  WHERE s.state_hash = p_state_hash
    AND s.consumed_at IS NULL
    AND s.expires_at > now()
  RETURNING s.user_id, s.company_id, s.purpose;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.square_acquire_sync_lease(
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
  INSERT INTO public.square_sync_locks (company_id, locked_until, locked_by, updated_at)
  VALUES (p_company_id, v_until, p_worker_id, now())
  ON CONFLICT (company_id) DO UPDATE
    SET locked_until = EXCLUDED.locked_until,
        locked_by = EXCLUDED.locked_by,
        updated_at = EXCLUDED.updated_at
    WHERE public.square_sync_locks.locked_until IS NULL
       OR public.square_sync_locks.locked_until <= now()
  RETURNING locked_by INTO v_holder;

  RETURN COALESCE(v_holder = p_worker_id, false);
END;
$$;

CREATE OR REPLACE FUNCTION app_private.square_release_sync_lease(
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
  UPDATE public.square_sync_locks
  SET locked_until = NULL,
      locked_by = NULL,
      updated_at = now()
  WHERE company_id = p_company_id
    AND locked_by = p_worker_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.square_sync_guard(
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
    FROM public.square_connections c
    INNER JOIN public.square_sync_locks l ON l.company_id = c.company_id
    WHERE c.id = p_connection_id
      AND c.company_id = p_company_id
      AND c.sync_generation = p_expected_generation
      AND c.disconnected_at IS NULL
      AND c.status <> 'disconnected'::public.square_connection_status
      AND l.locked_by = p_worker_id
      AND l.locked_until > now()
  );
$$;

CREATE OR REPLACE FUNCTION app_private.square_persist_tokens(
  p_connection_id uuid,
  p_company_id uuid,
  p_expected_generation bigint,
  p_refresh_token_enc text,
  p_access_token_enc text,
  p_access_token_expires_at timestamptz
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
  FROM public.square_connections c
  WHERE c.id = p_connection_id
    AND c.company_id = p_company_id
    AND c.sync_generation = p_expected_generation
    AND c.disconnected_at IS NULL
    AND c.status <> 'disconnected'::public.square_connection_status;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO public.square_connection_secrets (
    connection_id,
    company_id,
    refresh_token_enc,
    access_token_enc,
    access_token_expires_at,
    updated_at
  )
  VALUES (
    p_connection_id,
    v_company_id,
    p_refresh_token_enc,
    p_access_token_enc,
    p_access_token_expires_at,
    now()
  )
  ON CONFLICT (connection_id) DO UPDATE
  SET refresh_token_enc = EXCLUDED.refresh_token_enc,
      access_token_enc = EXCLUDED.access_token_enc,
      access_token_expires_at = EXCLUDED.access_token_expires_at,
      company_id = EXCLUDED.company_id,
      updated_at = EXCLUDED.updated_at;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.square_mark_syncing(
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
  IF NOT app_private.square_sync_guard(
    p_connection_id, p_company_id, p_expected_generation, p_worker_id
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.square_connections
  SET status = 'syncing'::public.square_connection_status,
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

CREATE OR REPLACE FUNCTION app_private.square_replace_locations(
  p_connection_id uuid,
  p_company_id uuid,
  p_locations jsonb
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
  FROM public.square_connections c
  WHERE c.id = p_connection_id
    AND c.company_id = p_company_id
    AND c.disconnected_at IS NULL
    AND c.status <> 'disconnected'::public.square_connection_status;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO public.square_locations (
    company_id,
    connection_id,
    square_location_id,
    name,
    status,
    currency,
    selected,
    updated_at
  )
  SELECT
    v_company_id,
    p_connection_id,
    item->>'square_location_id',
    NULLIF(item->>'name', ''),
    NULLIF(item->>'status', ''),
    NULLIF(item->>'currency', ''),
    false,
    now()
  FROM (
    SELECT DISTINCT ON (item->>'square_location_id')
      item
    FROM jsonb_array_elements(COALESCE(p_locations, '[]'::jsonb)) WITH ORDINALITY AS src(item, ord)
    WHERE COALESCE(item->>'square_location_id', '') ~ '^[A-Za-z0-9]{1,64}$'
      AND (
        NULLIF(item->>'currency', '') IS NULL
        OR item->>'currency' ~ '^[A-Z]{3}$'
      )
    ORDER BY item->>'square_location_id', ord DESC
  ) AS deduped(item)
  ON CONFLICT ON CONSTRAINT square_locations_company_location_key
  DO UPDATE SET
    connection_id = EXCLUDED.connection_id,
    name = EXCLUDED.name,
    status = EXCLUDED.status,
    currency = EXCLUDED.currency,
    updated_at = EXCLUDED.updated_at
  WHERE public.square_locations.company_id = EXCLUDED.company_id;

  DELETE FROM public.square_locations existing
  WHERE existing.company_id = v_company_id
    AND existing.connection_id = p_connection_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(p_locations, '[]'::jsonb)) AS item
      WHERE item->>'square_location_id' = existing.square_location_id
    );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.square_save_location_selection(
  p_connection_id uuid,
  p_company_id uuid,
  p_location_ids text[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_selected integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.square_connections c
    WHERE c.id = p_connection_id
      AND c.company_id = p_company_id
      AND c.disconnected_at IS NULL
      AND c.status <> 'disconnected'::public.square_connection_status
  ) THEN
    RETURN -1;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.square_sync_locks l
    WHERE l.company_id = p_company_id
      AND l.locked_until IS NOT NULL
      AND l.locked_until > now()
  ) THEN
    RETURN -1;
  END IF;

  UPDATE public.square_locations
  SET selected = (
        status = 'ACTIVE'
        AND square_location_id = ANY(COALESCE(p_location_ids, ARRAY[]::text[]))
      ),
      updated_at = now()
  WHERE company_id = p_company_id
    AND connection_id = p_connection_id;

  UPDATE public.square_connections
  SET locations_confirmed_at = now(),
      updated_at = now()
  WHERE id = p_connection_id
    AND company_id = p_company_id;

  SELECT count(*)::integer INTO v_selected
  FROM public.square_locations
  WHERE company_id = p_company_id
    AND connection_id = p_connection_id
    AND selected;

  IF v_selected = 0 THEN
    DELETE FROM public.square_transactions
    WHERE company_id = p_company_id
      AND connection_id = p_connection_id;
  END IF;

  RETURN v_selected;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.square_upsert_transactions(
  p_connection_id uuid,
  p_company_id uuid,
  p_expected_generation bigint,
  p_worker_id text,
  p_sync_run_id uuid,
  p_transactions jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_env public.square_environment;
  v_merchant text;
BEGIN
  IF NOT app_private.square_sync_guard(
    p_connection_id, p_company_id, p_expected_generation, p_worker_id
  ) THEN
    RETURN false;
  END IF;

  SELECT c.square_environment, c.merchant_id
  INTO v_env, v_merchant
  FROM public.square_connections c
  WHERE c.id = p_connection_id
    AND c.company_id = p_company_id;

  IF v_merchant IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.square_transactions (
    company_id,
    connection_id,
    square_environment,
    merchant_id,
    kind,
    square_id,
    location_id,
    location_name,
    created_at,
    reporting_date,
    currency,
    amount_minor,
    source_type,
    sync_run_id,
    imported_at
  )
  SELECT
    p_company_id,
    p_connection_id,
    v_env,
    v_merchant,
    (item->>'kind')::public.square_transaction_kind,
    item->>'square_id',
    item->>'location_id',
    NULLIF(item->>'location_name', ''),
    (item->>'created_at')::timestamptz,
    (item->>'reporting_date')::date,
    item->>'currency',
    (item->>'amount_minor')::bigint,
    NULLIF(item->>'source_type', ''),
    p_sync_run_id,
    now()
  FROM (
    SELECT DISTINCT ON (item->>'kind', item->>'square_id')
      item
    FROM jsonb_array_elements(COALESCE(p_transactions, '[]'::jsonb)) WITH ORDINALITY AS src(item, ord)
    WHERE item->>'kind' IN ('payment', 'refund')
      AND COALESCE(item->>'square_id', '') ~ '^[A-Za-z0-9_-]{1,192}$'
      AND COALESCE(item->>'location_id', '') ~ '^[A-Za-z0-9]{1,64}$'
      AND COALESCE(item->>'currency', '') ~ '^[A-Z]{3}$'
      AND (item->>'amount_minor') ~ '^[0-9]+$'
      AND (item->>'amount_minor')::bigint > 0
      AND (item->>'reporting_date') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      AND NULLIF(item->>'created_at', '') IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.square_locations loc
        WHERE loc.company_id = p_company_id
          AND loc.connection_id = p_connection_id
          AND loc.square_location_id = item->>'location_id'
          AND loc.selected
      )
    ORDER BY item->>'kind', item->>'square_id', ord DESC
  ) AS deduped(item)
  ON CONFLICT ON CONSTRAINT square_transactions_company_kind_id_key
  DO UPDATE SET
    connection_id = EXCLUDED.connection_id,
    square_environment = EXCLUDED.square_environment,
    merchant_id = EXCLUDED.merchant_id,
    location_id = EXCLUDED.location_id,
    location_name = EXCLUDED.location_name,
    created_at = EXCLUDED.created_at,
    reporting_date = EXCLUDED.reporting_date,
    currency = EXCLUDED.currency,
    amount_minor = EXCLUDED.amount_minor,
    source_type = EXCLUDED.source_type,
    sync_run_id = EXCLUDED.sync_run_id,
    imported_at = EXCLUDED.imported_at
  WHERE public.square_transactions.company_id = EXCLUDED.company_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.square_finalize_transactions(
  p_connection_id uuid,
  p_company_id uuid,
  p_expected_generation bigint,
  p_worker_id text,
  p_sync_run_id uuid,
  p_reporting_date date,
  p_reporting_timezone text,
  p_merchant_name text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted integer;
BEGIN
  IF NOT app_private.square_sync_guard(
    p_connection_id, p_company_id, p_expected_generation, p_worker_id
  ) THEN
    RETURN -1;
  END IF;

  IF p_reporting_date IS NULL OR length(btrim(COALESCE(p_reporting_timezone, ''))) = 0 THEN
    RETURN -1;
  END IF;

  DELETE FROM public.square_transactions
  WHERE company_id = p_company_id
    AND connection_id = p_connection_id
    AND sync_run_id IS DISTINCT FROM p_sync_run_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  UPDATE public.square_connections
  SET status = 'connected'::public.square_connection_status,
      reporting_date = p_reporting_date,
      reporting_timezone = p_reporting_timezone,
      reporting_timezone_source = 'configured',
      merchant_name = COALESCE(NULLIF(p_merchant_name, ''), merchant_name),
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

CREATE OR REPLACE FUNCTION app_private.square_mark_error(
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
  IF NOT app_private.square_sync_guard(
    p_connection_id, p_company_id, p_expected_generation, p_worker_id
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.square_connections
  SET status = 'error'::public.square_connection_status,
      last_sync_error_code = left(COALESCE(p_error_code, 'SYNC_FAILED'), 80),
      syncing_started_at = NULL,
      updated_at = now()
  WHERE id = p_connection_id
    AND company_id = p_company_id
    AND sync_generation = p_expected_generation;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.square_mark_reconnect_required(
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
  IF NOT app_private.square_sync_guard(
    p_connection_id, p_company_id, p_expected_generation, p_worker_id
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.square_connections
  SET status = 'reconnect_required'::public.square_connection_status,
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

CREATE OR REPLACE FUNCTION app_private.square_reset_import_for_replace(
  p_connection_id uuid,
  p_company_id uuid
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_generation bigint;
BEGIN
  DELETE FROM public.square_transactions
  WHERE connection_id = p_connection_id
    AND company_id = p_company_id;
  DELETE FROM public.square_locations
  WHERE connection_id = p_connection_id
    AND company_id = p_company_id;
  DELETE FROM public.square_connection_secrets
  WHERE connection_id = p_connection_id
    AND company_id = p_company_id;

  UPDATE public.square_connections
  SET sync_generation = sync_generation + 1,
      locations_confirmed_at = NULL,
      reporting_date = NULL,
      last_successful_sync_at = NULL,
      last_sync_error_code = NULL,
      merchant_name = NULL,
      updated_at = now()
  WHERE id = p_connection_id
    AND company_id = p_company_id
  RETURNING sync_generation INTO v_generation;

  RETURN COALESCE(v_generation, -1);
END;
$$;

CREATE OR REPLACE FUNCTION app_private.square_disconnect_company(
  p_connection_id uuid,
  p_company_id uuid
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rows bigint;
BEGIN
  DELETE FROM public.square_transactions
  WHERE connection_id = p_connection_id AND company_id = p_company_id;
  DELETE FROM public.square_locations
  WHERE connection_id = p_connection_id AND company_id = p_company_id;
  DELETE FROM public.square_connection_secrets
  WHERE connection_id = p_connection_id AND company_id = p_company_id;
  DELETE FROM public.square_oauth_states
  WHERE company_id = p_company_id AND consumed_at IS NULL;

  UPDATE public.square_connections
  SET status = 'disconnected'::public.square_connection_status,
      disconnected_at = now(),
      merchant_id = NULL,
      merchant_name = NULL,
      reporting_date = NULL,
      locations_confirmed_at = NULL,
      last_successful_sync_at = NULL,
      last_sync_error_code = NULL,
      syncing_started_at = NULL,
      sync_generation = sync_generation + 1,
      updated_at = now()
  WHERE id = p_connection_id
    AND company_id = p_company_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

CREATE OR REPLACE FUNCTION public.square_consume_oauth_state(p_state_hash text)
RETURNS TABLE (user_id uuid, company_id uuid, purpose text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT * FROM app_private.square_consume_oauth_state(p_state_hash);
$$;

CREATE OR REPLACE FUNCTION public.square_acquire_sync_lease(
  p_company_id uuid,
  p_worker_id text,
  p_ttl_seconds integer DEFAULT 300
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.square_acquire_sync_lease(p_company_id, p_worker_id, p_ttl_seconds);
$$;

CREATE OR REPLACE FUNCTION public.square_release_sync_lease(
  p_company_id uuid,
  p_worker_id text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.square_release_sync_lease(p_company_id, p_worker_id);
$$;

CREATE OR REPLACE FUNCTION public.square_persist_tokens(
  p_connection_id uuid,
  p_company_id uuid,
  p_expected_generation bigint,
  p_refresh_token_enc text,
  p_access_token_enc text,
  p_access_token_expires_at timestamptz
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.square_persist_tokens(
    p_connection_id,
    p_company_id,
    p_expected_generation,
    p_refresh_token_enc,
    p_access_token_enc,
    p_access_token_expires_at
  );
$$;

CREATE OR REPLACE FUNCTION public.square_mark_syncing(
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
  SELECT app_private.square_mark_syncing(
    p_connection_id, p_company_id, p_expected_generation, p_worker_id
  );
$$;

CREATE OR REPLACE FUNCTION public.square_replace_locations(
  p_connection_id uuid,
  p_company_id uuid,
  p_locations jsonb
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.square_replace_locations(p_connection_id, p_company_id, p_locations);
$$;

CREATE OR REPLACE FUNCTION public.square_save_location_selection(
  p_connection_id uuid,
  p_company_id uuid,
  p_location_ids text[]
)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.square_save_location_selection(
    p_connection_id, p_company_id, p_location_ids
  );
$$;

CREATE OR REPLACE FUNCTION public.square_upsert_transactions(
  p_connection_id uuid,
  p_company_id uuid,
  p_expected_generation bigint,
  p_worker_id text,
  p_sync_run_id uuid,
  p_transactions jsonb
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.square_upsert_transactions(
    p_connection_id,
    p_company_id,
    p_expected_generation,
    p_worker_id,
    p_sync_run_id,
    p_transactions
  );
$$;

CREATE OR REPLACE FUNCTION public.square_finalize_transactions(
  p_connection_id uuid,
  p_company_id uuid,
  p_expected_generation bigint,
  p_worker_id text,
  p_sync_run_id uuid,
  p_reporting_date date,
  p_reporting_timezone text,
  p_merchant_name text
)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.square_finalize_transactions(
    p_connection_id,
    p_company_id,
    p_expected_generation,
    p_worker_id,
    p_sync_run_id,
    p_reporting_date,
    p_reporting_timezone,
    p_merchant_name
  );
$$;

CREATE OR REPLACE FUNCTION public.square_mark_error(
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
  SELECT app_private.square_mark_error(
    p_connection_id, p_company_id, p_expected_generation, p_worker_id, p_error_code
  );
$$;

CREATE OR REPLACE FUNCTION public.square_mark_reconnect_required(
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
  SELECT app_private.square_mark_reconnect_required(
    p_connection_id, p_company_id, p_expected_generation, p_worker_id, p_error_code
  );
$$;

CREATE OR REPLACE FUNCTION public.square_reset_import_for_replace(
  p_connection_id uuid,
  p_company_id uuid
)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.square_reset_import_for_replace(p_connection_id, p_company_id);
$$;

CREATE OR REPLACE FUNCTION public.square_disconnect_company(
  p_connection_id uuid,
  p_company_id uuid
)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.square_disconnect_company(p_connection_id, p_company_id);
$$;

CREATE OR REPLACE FUNCTION public.member_get_square_status(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_conn public.square_connections;
  v_selected integer;
  v_totals jsonb;
BEGIN
  IF NOT app_private.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT * INTO v_conn
  FROM public.square_connections
  WHERE company_id = p_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'connected', false,
      'status', 'disconnected',
      'square_environment', NULL,
      'merchant_id', NULL,
      'merchant_name', NULL,
      'reporting_date', NULL,
      'reporting_timezone', NULL,
      'last_successful_sync_at', NULL,
      'last_sync_error_code', NULL,
      'syncing_started_at', NULL,
      'locations_confirmed', false,
      'selected_location_count', 0,
      'currency_totals', NULL
    );
  END IF;

  IF v_conn.disconnected_at IS NOT NULL
     OR v_conn.status = 'disconnected'::public.square_connection_status THEN
    RETURN jsonb_build_object(
      'connected', false,
      'status', 'disconnected',
      'square_environment', v_conn.square_environment,
      'merchant_id', NULL,
      'merchant_name', NULL,
      'reporting_date', NULL,
      'reporting_timezone', NULL,
      'last_successful_sync_at', NULL,
      'last_sync_error_code', NULL,
      'syncing_started_at', NULL,
      'locations_confirmed', false,
      'selected_location_count', 0,
      'currency_totals', NULL
    );
  END IF;

  SELECT count(*)::integer INTO v_selected
  FROM public.square_locations
  WHERE company_id = p_company_id
    AND connection_id = v_conn.id
    AND selected;

  IF v_conn.last_successful_sync_at IS NULL
     OR v_conn.reporting_date IS NULL
     OR v_selected = 0 THEN
    v_totals := NULL;
  ELSE
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'currency', totals.currency,
          'payments_minor', totals.payments_minor,
          'refunds_minor', totals.refunds_minor
        )
        ORDER BY totals.currency
      ),
      '[]'::jsonb
    )
    INTO v_totals
    FROM (
      SELECT
        t.currency,
        COALESCE(sum(t.amount_minor) FILTER (WHERE t.kind = 'payment'::public.square_transaction_kind), 0) AS payments_minor,
        COALESCE(sum(t.amount_minor) FILTER (WHERE t.kind = 'refund'::public.square_transaction_kind), 0) AS refunds_minor
      FROM public.square_transactions t
      WHERE t.company_id = p_company_id
        AND t.connection_id = v_conn.id
        AND t.square_environment = v_conn.square_environment
        AND t.merchant_id = v_conn.merchant_id
        AND t.reporting_date = v_conn.reporting_date
      GROUP BY t.currency
    ) AS totals;
  END IF;

  RETURN jsonb_build_object(
    'connected', true,
    'status', v_conn.status,
    'square_environment', v_conn.square_environment,
    'merchant_id', v_conn.merchant_id,
    'merchant_name', v_conn.merchant_name,
    'reporting_date', v_conn.reporting_date,
    'reporting_timezone', v_conn.reporting_timezone,
    'last_successful_sync_at', v_conn.last_successful_sync_at,
    'last_sync_error_code', v_conn.last_sync_error_code,
    'syncing_started_at', v_conn.syncing_started_at,
    'locations_confirmed', v_conn.locations_confirmed_at IS NOT NULL,
    'selected_location_count', v_selected,
    'currency_totals', v_totals
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.member_list_square_transactions(
  p_company_id uuid,
  p_limit integer DEFAULT 40
)
RETURNS TABLE (
  id uuid,
  kind text,
  square_id text,
  location_name text,
  created_at timestamptz,
  reporting_date date,
  currency text,
  amount_minor bigint,
  source_type text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 40), 1), 40);
  v_connection_id uuid;
  v_env public.square_environment;
  v_merchant text;
BEGIN
  IF NOT app_private.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT c.id, c.square_environment, c.merchant_id
  INTO v_connection_id, v_env, v_merchant
  FROM public.square_connections c
  WHERE c.company_id = p_company_id
    AND c.disconnected_at IS NULL
    AND c.status IN (
      'connected'::public.square_connection_status,
      'syncing'::public.square_connection_status,
      'error'::public.square_connection_status,
      'reconnect_required'::public.square_connection_status
    )
    AND c.last_successful_sync_at IS NOT NULL;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.kind::text,
    t.square_id,
    t.location_name,
    t.created_at,
    t.reporting_date,
    t.currency,
    t.amount_minor,
    t.source_type
  FROM public.square_transactions t
  WHERE t.company_id = p_company_id
    AND t.connection_id = v_connection_id
    AND t.square_environment = v_env
    AND t.merchant_id = v_merchant
  ORDER BY t.created_at DESC, t.square_id ASC
  LIMIT v_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.member_list_square_locations(p_company_id uuid)
RETURNS TABLE (
  square_location_id text,
  name text,
  status text,
  currency text,
  selected boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_connection_id uuid;
BEGIN
  IF NOT app_private.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT c.id INTO v_connection_id
  FROM public.square_connections c
  WHERE c.company_id = p_company_id
    AND c.disconnected_at IS NULL
    AND c.status <> 'disconnected'::public.square_connection_status;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT l.square_location_id, l.name, l.status, l.currency, l.selected
  FROM public.square_locations l
  WHERE l.company_id = p_company_id
    AND l.connection_id = v_connection_id
  ORDER BY l.name ASC NULLS LAST, l.square_location_id ASC;
END;
$$;

REVOKE ALL ON FUNCTION app_private.square_consume_oauth_state(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.square_acquire_sync_lease(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.square_release_sync_lease(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.square_sync_guard(uuid, uuid, bigint, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.square_persist_tokens(uuid, uuid, bigint, text, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.square_mark_syncing(uuid, uuid, bigint, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.square_replace_locations(uuid, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.square_save_location_selection(uuid, uuid, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.square_upsert_transactions(uuid, uuid, bigint, text, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.square_finalize_transactions(uuid, uuid, bigint, text, uuid, date, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.square_mark_error(uuid, uuid, bigint, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.square_mark_reconnect_required(uuid, uuid, bigint, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.square_reset_import_for_replace(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.square_disconnect_company(uuid, uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.square_consume_oauth_state(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.square_acquire_sync_lease(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.square_release_sync_lease(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.square_persist_tokens(uuid, uuid, bigint, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.square_mark_syncing(uuid, uuid, bigint, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.square_replace_locations(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.square_save_location_selection(uuid, uuid, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.square_upsert_transactions(uuid, uuid, bigint, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.square_finalize_transactions(uuid, uuid, bigint, text, uuid, date, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.square_mark_error(uuid, uuid, bigint, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.square_mark_reconnect_required(uuid, uuid, bigint, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.square_reset_import_for_replace(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.square_disconnect_company(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.member_get_square_status(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.member_list_square_transactions(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.member_list_square_locations(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.square_consume_oauth_state(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.square_acquire_sync_lease(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.square_release_sync_lease(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.square_persist_tokens(uuid, uuid, bigint, text, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.square_mark_syncing(uuid, uuid, bigint, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.square_replace_locations(uuid, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.square_save_location_selection(uuid, uuid, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.square_upsert_transactions(uuid, uuid, bigint, text, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.square_finalize_transactions(uuid, uuid, bigint, text, uuid, date, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.square_mark_error(uuid, uuid, bigint, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.square_mark_reconnect_required(uuid, uuid, bigint, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.square_reset_import_for_replace(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.square_disconnect_company(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.member_get_square_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.member_list_square_transactions(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.member_list_square_locations(uuid) TO authenticated;

ALTER TABLE public.square_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.square_connection_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.square_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.square_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.square_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.square_sync_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY square_connections_member_select ON public.square_connections
  FOR SELECT TO authenticated
  USING (app_private.is_company_member(company_id));

CREATE POLICY square_locations_member_select ON public.square_locations
  FOR SELECT TO authenticated
  USING (app_private.is_company_member(company_id));

CREATE POLICY square_transactions_member_select ON public.square_transactions
  FOR SELECT TO authenticated
  USING (app_private.is_company_member(company_id));

REVOKE ALL ON TABLE public.square_connections FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.square_locations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.square_transactions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.square_connection_secrets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.square_oauth_states FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.square_sync_locks FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.square_connections TO authenticated;
GRANT SELECT ON TABLE public.square_locations TO authenticated;
GRANT SELECT ON TABLE public.square_transactions TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.square_connections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.square_connection_secrets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.square_oauth_states TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.square_locations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.square_transactions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.square_sync_locks TO service_role;
