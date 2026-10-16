-- Milestone 4A hardening: sync generation, leases, OAuth consume, all-day dates, scheduling.

ALTER TABLE public.google_calendar_connections
  ADD COLUMN IF NOT EXISTS sync_generation bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_sync_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS syncing_started_at timestamptz;

ALTER TABLE public.google_calendar_selected_calendars
  ADD COLUMN IF NOT EXISTS import_window_anchor_at timestamptz;

ALTER TABLE public.google_calendar_events
  ADD COLUMN IF NOT EXISTS all_day_start date,
  ADD COLUMN IF NOT EXISTS all_day_end date;

CREATE OR REPLACE FUNCTION app_private.google_calendar_acquire_sync_lease(
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
  INSERT INTO public.google_calendar_sync_locks (company_id, locked_until, locked_by, updated_at)
  VALUES (p_company_id, v_until, p_worker_id, now())
  ON CONFLICT (company_id) DO UPDATE
    SET locked_until = EXCLUDED.locked_until,
        locked_by = EXCLUDED.locked_by,
        updated_at = EXCLUDED.updated_at
    WHERE public.google_calendar_sync_locks.locked_until IS NULL
       OR public.google_calendar_sync_locks.locked_until <= now()
  RETURNING locked_by INTO v_holder;

  RETURN v_holder = p_worker_id;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.google_calendar_release_sync_lease(
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
  UPDATE public.google_calendar_sync_locks
  SET locked_until = NULL,
      locked_by = NULL,
      updated_at = now()
  WHERE company_id = p_company_id
    AND locked_by = p_worker_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.google_calendar_consume_oauth_state(
  p_state_hash text
)
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
  UPDATE public.google_calendar_oauth_states s
  SET consumed_at = now()
  WHERE s.state_hash = p_state_hash
    AND s.consumed_at IS NULL
    AND s.expires_at > now()
  RETURNING s.user_id, s.company_id, s.purpose;
END;
$$;

REVOKE ALL ON FUNCTION app_private.google_calendar_acquire_sync_lease(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.google_calendar_release_sync_lease(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.google_calendar_consume_oauth_state(text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.google_calendar_acquire_sync_lease(
  p_company_id uuid,
  p_worker_id text,
  p_ttl_seconds integer DEFAULT 300
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.google_calendar_acquire_sync_lease(p_company_id, p_worker_id, p_ttl_seconds);
$$;

CREATE OR REPLACE FUNCTION public.google_calendar_release_sync_lease(
  p_company_id uuid,
  p_worker_id text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.google_calendar_release_sync_lease(p_company_id, p_worker_id);
$$;

CREATE OR REPLACE FUNCTION public.google_calendar_consume_oauth_state(p_state_hash text)
RETURNS TABLE (user_id uuid, company_id uuid, purpose text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT * FROM app_private.google_calendar_consume_oauth_state(p_state_hash);
$$;

REVOKE ALL ON FUNCTION public.google_calendar_acquire_sync_lease(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.google_calendar_release_sync_lease(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.google_calendar_consume_oauth_state(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.google_calendar_acquire_sync_lease(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.google_calendar_release_sync_lease(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.google_calendar_consume_oauth_state(text) TO service_role;

CREATE OR REPLACE FUNCTION public.member_list_google_calendar_appointments(
  p_company_id uuid,
  p_from timestamptz DEFAULT (now() - interval '30 days'),
  p_to timestamptz DEFAULT (now() + interval '180 days')
)
RETURNS SETOF public.google_calendar_events
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT app_private.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  RETURN QUERY
  SELECT e.*
  FROM public.google_calendar_events e
  INNER JOIN public.google_calendar_selected_calendars sc
    ON sc.connection_id = e.connection_id
    AND sc.google_calendar_id = e.google_calendar_id
    AND sc.selected = true
  INNER JOIN public.google_calendar_connections c ON c.id = e.connection_id
  WHERE e.company_id = p_company_id
    AND c.status IN (
      'connected'::public.google_calendar_connection_status,
      'syncing'::public.google_calendar_connection_status,
      'error'::public.google_calendar_connection_status
    )
    AND e.status <> 'cancelled'
    AND (
      (
        e.all_day = false
        AND e.starts_at IS NOT NULL
        AND e.starts_at >= p_from
        AND e.starts_at < p_to
      )
      OR (
        e.all_day = true
        AND e.all_day_start IS NOT NULL
        AND e.all_day_start >= p_from::date
        AND e.all_day_start <= p_to::date
      )
    )
  ORDER BY
    CASE WHEN e.all_day THEN e.all_day_start::timestamptz ELSE e.starts_at END ASC NULLS LAST;
END;
$$;
