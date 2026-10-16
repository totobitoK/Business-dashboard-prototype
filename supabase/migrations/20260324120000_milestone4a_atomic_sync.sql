-- Milestone 4A: atomic sync generation, guarded writes, transactional disconnect.

CREATE OR REPLACE FUNCTION app_private.google_calendar_sync_generation_bump(p_connection_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_gen bigint;
BEGIN
  UPDATE public.google_calendar_connections
  SET sync_generation = sync_generation + 1,
      sync_cursor = '{}'::jsonb,
      syncing_started_at = NULL,
      updated_at = now()
  WHERE id = p_connection_id
  RETURNING sync_generation INTO v_gen;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;
  RETURN v_gen;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.google_calendar_sync_eligible(
  p_connection_id uuid,
  p_expected_generation bigint
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.google_calendar_connections c
    WHERE c.id = p_connection_id
      AND c.sync_generation = p_expected_generation
      AND c.disconnected_at IS NULL
      AND c.status <> 'disconnected'::public.google_calendar_connection_status
  );
$$;

CREATE OR REPLACE FUNCTION app_private.google_calendar_sync_apply_event(
  p_connection_id uuid,
  p_company_id uuid,
  p_expected_generation bigint,
  p_google_calendar_id text,
  p_google_event_id text,
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_all_day boolean,
  p_all_day_start date,
  p_all_day_end date,
  p_timezone text,
  p_status text,
  p_google_updated_at timestamptz,
  p_is_cancelled boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT app_private.google_calendar_sync_eligible(p_connection_id, p_expected_generation) THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.google_calendar_selected_calendars sc
    WHERE sc.connection_id = p_connection_id
      AND sc.google_calendar_id = p_google_calendar_id
      AND sc.selected = true
  ) THEN
    RETURN false;
  END IF;

  IF p_is_cancelled OR p_status = 'cancelled' THEN
    DELETE FROM public.google_calendar_events e
    WHERE e.company_id = p_company_id
      AND e.google_calendar_id = p_google_calendar_id
      AND e.google_event_id = p_google_event_id;
    RETURN true;
  END IF;

  INSERT INTO public.google_calendar_events (
    company_id,
    connection_id,
    google_calendar_id,
    google_event_id,
    title,
    starts_at,
    ends_at,
    all_day,
    all_day_start,
    all_day_end,
    timezone,
    status,
    google_updated_at,
    imported_at
  )
  VALUES (
    p_company_id,
    p_connection_id,
    p_google_calendar_id,
    p_google_event_id,
    COALESCE(p_title, ''),
    p_starts_at,
    p_ends_at,
    COALESCE(p_all_day, false),
    p_all_day_start,
    p_all_day_end,
    p_timezone,
    COALESCE(p_status, 'confirmed'),
    p_google_updated_at,
    now()
  )
  ON CONFLICT (company_id, google_calendar_id, google_event_id)
  DO UPDATE SET
    title = EXCLUDED.title,
    starts_at = EXCLUDED.starts_at,
    ends_at = EXCLUDED.ends_at,
    all_day = EXCLUDED.all_day,
    all_day_start = EXCLUDED.all_day_start,
    all_day_end = EXCLUDED.all_day_end,
    timezone = EXCLUDED.timezone,
    status = EXCLUDED.status,
    google_updated_at = EXCLUDED.google_updated_at,
    imported_at = EXCLUDED.imported_at,
    connection_id = EXCLUDED.connection_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.google_calendar_sync_reconcile_calendar(
  p_connection_id uuid,
  p_company_id uuid,
  p_expected_generation bigint,
  p_google_calendar_id text,
  p_seen_event_ids text[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted integer;
BEGIN
  IF NOT app_private.google_calendar_sync_eligible(p_connection_id, p_expected_generation) THEN
    RETURN 0;
  END IF;

  DELETE FROM public.google_calendar_events e
  WHERE e.company_id = p_company_id
    AND e.google_calendar_id = p_google_calendar_id
    AND NOT (e.google_event_id = ANY (COALESCE(p_seen_event_ids, ARRAY[]::text[])));

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.google_calendar_sync_persist_tokens(
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
BEGIN
  IF NOT app_private.google_calendar_sync_eligible(p_connection_id, p_expected_generation) THEN
    RETURN false;
  END IF;

  INSERT INTO public.google_calendar_connection_secrets (
    connection_id,
    company_id,
    refresh_token_enc,
    access_token_enc,
    access_token_expires_at,
    updated_at
  )
  VALUES (
    p_connection_id,
    p_company_id,
    p_refresh_token_enc,
    p_access_token_enc,
    p_access_token_expires_at,
    now()
  )
  ON CONFLICT (connection_id)
  DO UPDATE SET
    refresh_token_enc = EXCLUDED.refresh_token_enc,
    access_token_enc = EXCLUDED.access_token_enc,
    access_token_expires_at = EXCLUDED.access_token_expires_at,
    updated_at = EXCLUDED.updated_at;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.google_calendar_purge_import_data(
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
  UPDATE public.google_calendar_connections
  SET sync_generation = sync_generation + 1,
      sync_cursor = '{}'::jsonb,
      syncing_started_at = NULL,
      updated_at = now()
  WHERE id = p_connection_id
    AND company_id = p_company_id
    AND disconnected_at IS NULL
  RETURNING sync_generation INTO v_gen;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  DELETE FROM public.google_calendar_events WHERE company_id = p_company_id;
  DELETE FROM public.google_calendar_selected_calendars WHERE company_id = p_company_id;
  DELETE FROM public.google_calendar_connection_secrets WHERE connection_id = p_connection_id;

  RETURN v_gen;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.google_calendar_disconnect_company(
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
  v_now timestamptz := now();
BEGIN
  UPDATE public.google_calendar_connections
  SET sync_generation = sync_generation + 1,
      sync_cursor = '{}'::jsonb,
      syncing_started_at = NULL,
      status = 'disconnected'::public.google_calendar_connection_status,
      disconnected_at = v_now,
      google_sub = NULL,
      google_email = NULL,
      last_sync_error_code = NULL,
      next_sync_attempt_at = NULL,
      updated_at = v_now
  WHERE id = p_connection_id
    AND company_id = p_company_id
  RETURNING sync_generation INTO v_gen;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  DELETE FROM public.google_calendar_events WHERE company_id = p_company_id;
  DELETE FROM public.google_calendar_selected_calendars WHERE company_id = p_company_id;
  DELETE FROM public.google_calendar_connection_secrets WHERE connection_id = p_connection_id;

  RETURN v_gen;
END;
$$;

CREATE OR REPLACE FUNCTION public.google_calendar_sync_generation_bump(p_connection_id uuid)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.google_calendar_sync_generation_bump(p_connection_id);
$$;

CREATE OR REPLACE FUNCTION public.google_calendar_sync_apply_event(
  p_connection_id uuid,
  p_company_id uuid,
  p_expected_generation bigint,
  p_google_calendar_id text,
  p_google_event_id text,
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_all_day boolean,
  p_all_day_start date,
  p_all_day_end date,
  p_timezone text,
  p_status text,
  p_google_updated_at timestamptz,
  p_is_cancelled boolean DEFAULT false
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.google_calendar_sync_apply_event(
    p_connection_id,
    p_company_id,
    p_expected_generation,
    p_google_calendar_id,
    p_google_event_id,
    p_title,
    p_starts_at,
    p_ends_at,
    p_all_day,
    p_all_day_start,
    p_all_day_end,
    p_timezone,
    p_status,
    p_google_updated_at,
    p_is_cancelled
  );
$$;

CREATE OR REPLACE FUNCTION public.google_calendar_sync_reconcile_calendar(
  p_connection_id uuid,
  p_company_id uuid,
  p_expected_generation bigint,
  p_google_calendar_id text,
  p_seen_event_ids text[]
)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.google_calendar_sync_reconcile_calendar(
    p_connection_id,
    p_company_id,
    p_expected_generation,
    p_google_calendar_id,
    p_seen_event_ids
  );
$$;

CREATE OR REPLACE FUNCTION public.google_calendar_sync_persist_tokens(
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
  SELECT app_private.google_calendar_sync_persist_tokens(
    p_connection_id,
    p_company_id,
    p_expected_generation,
    p_refresh_token_enc,
    p_access_token_enc,
    p_access_token_expires_at
  );
$$;

CREATE OR REPLACE FUNCTION public.google_calendar_purge_import_data(
  p_connection_id uuid,
  p_company_id uuid
)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.google_calendar_purge_import_data(p_connection_id, p_company_id);
$$;

CREATE OR REPLACE FUNCTION public.google_calendar_disconnect_company(
  p_connection_id uuid,
  p_company_id uuid
)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.google_calendar_disconnect_company(p_connection_id, p_company_id);
$$;

REVOKE ALL ON FUNCTION public.google_calendar_sync_generation_bump(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.google_calendar_sync_apply_event(
  uuid, uuid, bigint, text, text, text, timestamptz, timestamptz, boolean, date, date, text, text, timestamptz, boolean
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.google_calendar_sync_reconcile_calendar(
  uuid, uuid, bigint, text, text[]
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.google_calendar_sync_persist_tokens(
  uuid, uuid, bigint, text, text, timestamptz
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.google_calendar_purge_import_data(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.google_calendar_disconnect_company(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.google_calendar_sync_generation_bump(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.google_calendar_sync_apply_event(
  uuid, uuid, bigint, text, text, text, timestamptz, timestamptz, boolean, date, date, text, text, timestamptz, boolean
) TO service_role;
GRANT EXECUTE ON FUNCTION public.google_calendar_sync_reconcile_calendar(
  uuid, uuid, bigint, text, text[]
) TO service_role;
GRANT EXECUTE ON FUNCTION public.google_calendar_sync_persist_tokens(
  uuid, uuid, bigint, text, text, timestamptz
) TO service_role;
GRANT EXECUTE ON FUNCTION public.google_calendar_purge_import_data(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.google_calendar_disconnect_company(uuid, uuid) TO service_role;
