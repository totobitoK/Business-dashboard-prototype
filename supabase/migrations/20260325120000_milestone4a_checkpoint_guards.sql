-- Milestone 4A: generation + lease guarded checkpoints and worker status writes.

CREATE OR REPLACE FUNCTION app_private.google_calendar_sync_worker_eligible(
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
  SELECT
    app_private.google_calendar_sync_eligible(p_connection_id, p_expected_generation)
    AND EXISTS (
      SELECT 1
      FROM public.google_calendar_connections c
      WHERE c.id = p_connection_id
        AND c.company_id = p_company_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.google_calendar_sync_locks l
      WHERE l.company_id = p_company_id
        AND l.locked_by = p_worker_id
        AND l.locked_until IS NOT NULL
        AND l.locked_until > now()
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
  p_is_cancelled boolean DEFAULT false,
  p_worker_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_worker_id IS NOT NULL THEN
    IF NOT app_private.google_calendar_sync_worker_eligible(
      p_connection_id, p_company_id, p_expected_generation, p_worker_id
    ) THEN
      RETURN false;
    END IF;
  ELSIF NOT app_private.google_calendar_sync_eligible(p_connection_id, p_expected_generation) THEN
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
  p_seen_event_ids text[],
  p_worker_id text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted integer;
BEGIN
  IF p_worker_id IS NOT NULL THEN
    IF NOT app_private.google_calendar_sync_worker_eligible(
      p_connection_id, p_company_id, p_expected_generation, p_worker_id
    ) THEN
      RETURN -1;
    END IF;
  ELSIF NOT app_private.google_calendar_sync_eligible(p_connection_id, p_expected_generation) THEN
    RETURN -1;
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
  p_access_token_expires_at timestamptz,
  p_worker_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_worker_id IS NOT NULL THEN
    IF NOT app_private.google_calendar_sync_worker_eligible(
      p_connection_id, p_company_id, p_expected_generation, p_worker_id
    ) THEN
      RETURN false;
    END IF;
  ELSIF NOT app_private.google_calendar_sync_eligible(p_connection_id, p_expected_generation) THEN
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

CREATE OR REPLACE FUNCTION app_private.google_calendar_sync_persist_progress(
  p_connection_id uuid,
  p_company_id uuid,
  p_expected_generation bigint,
  p_worker_id text,
  p_sync_cursor jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rows integer;
BEGIN
  IF NOT app_private.google_calendar_sync_worker_eligible(
    p_connection_id, p_company_id, p_expected_generation, p_worker_id
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.google_calendar_connections
  SET sync_cursor = p_sync_cursor,
      updated_at = now()
  WHERE id = p_connection_id
    AND company_id = p_company_id
    AND sync_generation = p_expected_generation;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.google_calendar_sync_mark_syncing(
  p_connection_id uuid,
  p_company_id uuid,
  p_expected_generation bigint,
  p_worker_id text,
  p_syncing_started_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rows integer;
BEGIN
  IF NOT app_private.google_calendar_sync_worker_eligible(
    p_connection_id, p_company_id, p_expected_generation, p_worker_id
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.google_calendar_connections
  SET status = 'syncing'::public.google_calendar_connection_status,
      syncing_started_at = COALESCE(syncing_started_at, p_syncing_started_at),
      updated_at = now()
  WHERE id = p_connection_id
    AND company_id = p_company_id
    AND sync_generation = p_expected_generation;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.google_calendar_sync_mark_complete(
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
  IF NOT app_private.google_calendar_sync_worker_eligible(
    p_connection_id, p_company_id, p_expected_generation, p_worker_id
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.google_calendar_connections
  SET status = 'connected'::public.google_calendar_connection_status,
      last_sync_at = now(),
      last_sync_error_code = NULL,
      next_sync_attempt_at = NULL,
      syncing_started_at = NULL,
      sync_cursor = '{}'::jsonb,
      updated_at = now()
  WHERE id = p_connection_id
    AND company_id = p_company_id
    AND sync_generation = p_expected_generation;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.google_calendar_sync_mark_idle_no_calendars(
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
  IF NOT app_private.google_calendar_sync_worker_eligible(
    p_connection_id, p_company_id, p_expected_generation, p_worker_id
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.google_calendar_connections
  SET status = 'connected'::public.google_calendar_connection_status,
      syncing_started_at = NULL,
      sync_cursor = '{}'::jsonb,
      updated_at = now()
  WHERE id = p_connection_id
    AND company_id = p_company_id
    AND sync_generation = p_expected_generation;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.google_calendar_sync_mark_error(
  p_connection_id uuid,
  p_company_id uuid,
  p_expected_generation bigint,
  p_worker_id text,
  p_error_code text,
  p_next_sync_attempt_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rows integer;
BEGIN
  IF NOT app_private.google_calendar_sync_worker_eligible(
    p_connection_id, p_company_id, p_expected_generation, p_worker_id
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.google_calendar_connections
  SET status = 'error'::public.google_calendar_connection_status,
      last_sync_error_code = left(p_error_code, 120),
      next_sync_attempt_at = p_next_sync_attempt_at,
      syncing_started_at = NULL,
      updated_at = now()
  WHERE id = p_connection_id
    AND company_id = p_company_id
    AND sync_generation = p_expected_generation;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.google_calendar_sync_mark_reconnect_required(
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
  IF NOT app_private.google_calendar_sync_worker_eligible(
    p_connection_id, p_company_id, p_expected_generation, p_worker_id
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.google_calendar_connections
  SET status = 'reconnect_required'::public.google_calendar_connection_status,
      last_sync_error_code = left(p_error_code, 120),
      syncing_started_at = NULL,
      updated_at = now()
  WHERE id = p_connection_id
    AND company_id = p_company_id
    AND sync_generation = p_expected_generation;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.google_calendar_sync_checkpoint_calendar(
  p_connection_id uuid,
  p_company_id uuid,
  p_expected_generation bigint,
  p_worker_id text,
  p_calendar_row_id uuid,
  p_sync_token text,
  p_import_window_anchor_at timestamptz,
  p_last_synced_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rows integer;
BEGIN
  IF NOT app_private.google_calendar_sync_worker_eligible(
    p_connection_id, p_company_id, p_expected_generation, p_worker_id
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.google_calendar_selected_calendars sc
  SET sync_token = COALESCE(p_sync_token, sc.sync_token),
      import_window_anchor_at = COALESCE(p_import_window_anchor_at, sc.import_window_anchor_at),
      last_synced_at = COALESCE(p_last_synced_at, now()),
      updated_at = now()
  WHERE sc.id = p_calendar_row_id
    AND sc.connection_id = p_connection_id
    AND sc.company_id = p_company_id
    AND sc.selected = true;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.google_calendar_sync_invalidate_calendar_token(
  p_connection_id uuid,
  p_company_id uuid,
  p_expected_generation bigint,
  p_worker_id text,
  p_calendar_row_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rows integer;
BEGIN
  IF NOT app_private.google_calendar_sync_worker_eligible(
    p_connection_id, p_company_id, p_expected_generation, p_worker_id
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.google_calendar_selected_calendars sc
  SET sync_token = NULL,
      sync_token_invalidated_at = now(),
      updated_at = now()
  WHERE sc.id = p_calendar_row_id
    AND sc.connection_id = p_connection_id
    AND sc.company_id = p_company_id
    AND sc.selected = true;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$;

-- Public wrappers (service_role only)

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
  p_is_cancelled boolean DEFAULT false,
  p_worker_id text DEFAULT NULL
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
    p_is_cancelled,
    p_worker_id
  );
$$;

CREATE OR REPLACE FUNCTION public.google_calendar_sync_reconcile_calendar(
  p_connection_id uuid,
  p_company_id uuid,
  p_expected_generation bigint,
  p_google_calendar_id text,
  p_seen_event_ids text[],
  p_worker_id text DEFAULT NULL
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
    p_seen_event_ids,
    p_worker_id
  );
$$;

CREATE OR REPLACE FUNCTION public.google_calendar_sync_persist_tokens(
  p_connection_id uuid,
  p_company_id uuid,
  p_expected_generation bigint,
  p_refresh_token_enc text,
  p_access_token_enc text,
  p_access_token_expires_at timestamptz,
  p_worker_id text DEFAULT NULL
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
    p_access_token_expires_at,
    p_worker_id
  );
$$;

CREATE OR REPLACE FUNCTION public.google_calendar_sync_persist_progress(
  p_connection_id uuid,
  p_company_id uuid,
  p_expected_generation bigint,
  p_worker_id text,
  p_sync_cursor jsonb
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.google_calendar_sync_persist_progress(
    p_connection_id,
    p_company_id,
    p_expected_generation,
    p_worker_id,
    p_sync_cursor
  );
$$;

CREATE OR REPLACE FUNCTION public.google_calendar_sync_mark_syncing(
  p_connection_id uuid,
  p_company_id uuid,
  p_expected_generation bigint,
  p_worker_id text,
  p_syncing_started_at timestamptz
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.google_calendar_sync_mark_syncing(
    p_connection_id,
    p_company_id,
    p_expected_generation,
    p_worker_id,
    p_syncing_started_at
  );
$$;

CREATE OR REPLACE FUNCTION public.google_calendar_sync_mark_complete(
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
  SELECT app_private.google_calendar_sync_mark_complete(
    p_connection_id,
    p_company_id,
    p_expected_generation,
    p_worker_id
  );
$$;

CREATE OR REPLACE FUNCTION public.google_calendar_sync_mark_idle_no_calendars(
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
  SELECT app_private.google_calendar_sync_mark_idle_no_calendars(
    p_connection_id,
    p_company_id,
    p_expected_generation,
    p_worker_id
  );
$$;

CREATE OR REPLACE FUNCTION public.google_calendar_sync_mark_error(
  p_connection_id uuid,
  p_company_id uuid,
  p_expected_generation bigint,
  p_worker_id text,
  p_error_code text,
  p_next_sync_attempt_at timestamptz
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.google_calendar_sync_mark_error(
    p_connection_id,
    p_company_id,
    p_expected_generation,
    p_worker_id,
    p_error_code,
    p_next_sync_attempt_at
  );
$$;

CREATE OR REPLACE FUNCTION public.google_calendar_sync_mark_reconnect_required(
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
  SELECT app_private.google_calendar_sync_mark_reconnect_required(
    p_connection_id,
    p_company_id,
    p_expected_generation,
    p_worker_id,
    p_error_code
  );
$$;

CREATE OR REPLACE FUNCTION public.google_calendar_sync_checkpoint_calendar(
  p_connection_id uuid,
  p_company_id uuid,
  p_expected_generation bigint,
  p_worker_id text,
  p_calendar_row_id uuid,
  p_sync_token text,
  p_import_window_anchor_at timestamptz,
  p_last_synced_at timestamptz
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.google_calendar_sync_checkpoint_calendar(
    p_connection_id,
    p_company_id,
    p_expected_generation,
    p_worker_id,
    p_calendar_row_id,
    p_sync_token,
    p_import_window_anchor_at,
    p_last_synced_at
  );
$$;

CREATE OR REPLACE FUNCTION public.google_calendar_sync_invalidate_calendar_token(
  p_connection_id uuid,
  p_company_id uuid,
  p_expected_generation bigint,
  p_worker_id text,
  p_calendar_row_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.google_calendar_sync_invalidate_calendar_token(
    p_connection_id,
    p_company_id,
    p_expected_generation,
    p_worker_id,
    p_calendar_row_id
  );
$$;

REVOKE ALL ON FUNCTION public.google_calendar_sync_persist_progress(uuid, uuid, bigint, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.google_calendar_sync_mark_syncing(uuid, uuid, bigint, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.google_calendar_sync_mark_complete(uuid, uuid, bigint, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.google_calendar_sync_mark_idle_no_calendars(uuid, uuid, bigint, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.google_calendar_sync_mark_error(uuid, uuid, bigint, text, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.google_calendar_sync_mark_reconnect_required(uuid, uuid, bigint, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.google_calendar_sync_checkpoint_calendar(
  uuid, uuid, bigint, text, uuid, text, timestamptz, timestamptz
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.google_calendar_sync_invalidate_calendar_token(uuid, uuid, bigint, text, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.google_calendar_sync_persist_progress(uuid, uuid, bigint, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.google_calendar_sync_mark_syncing(uuid, uuid, bigint, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.google_calendar_sync_mark_complete(uuid, uuid, bigint, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.google_calendar_sync_mark_idle_no_calendars(uuid, uuid, bigint, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.google_calendar_sync_mark_error(uuid, uuid, bigint, text, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.google_calendar_sync_mark_reconnect_required(uuid, uuid, bigint, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.google_calendar_sync_checkpoint_calendar(
  uuid, uuid, bigint, text, uuid, text, timestamptz, timestamptz
) TO service_role;
GRANT EXECUTE ON FUNCTION public.google_calendar_sync_invalidate_calendar_token(uuid, uuid, bigint, text, uuid) TO service_role;
