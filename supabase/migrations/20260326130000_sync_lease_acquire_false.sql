-- ON CONFLICT DO UPDATE with failing WHERE leaves v_holder NULL; NULL = text is NULL, not false.

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

  RETURN COALESCE(v_holder = p_worker_id, false);
END;
$$;

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
