-- Milestone 4A: Google Calendar connection (one per company), events, sync checkpoints.

CREATE TYPE public.google_calendar_connection_status AS ENUM (
  'disconnected',
  'connected',
  'reconnect_required',
  'syncing',
  'error'
);

CREATE TABLE public.google_calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies (id) ON DELETE CASCADE,
  google_sub text,
  google_email text,
  status public.google_calendar_connection_status NOT NULL DEFAULT 'disconnected',
  connected_at timestamptz,
  disconnected_at timestamptz,
  last_sync_at timestamptz,
  last_sync_error_code text,
  sync_cursor jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.google_calendar_connection_secrets (
  connection_id uuid PRIMARY KEY REFERENCES public.google_calendar_connections (id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  refresh_token_enc text NOT NULL,
  access_token_enc text,
  access_token_expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.google_calendar_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_hash text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('connect', 'replace')),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX google_calendar_oauth_states_expires_idx
  ON public.google_calendar_oauth_states (expires_at)
  WHERE consumed_at IS NULL;

CREATE TABLE public.google_calendar_selected_calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.google_calendar_connections (id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  google_calendar_id text NOT NULL,
  summary text NOT NULL,
  selected boolean NOT NULL DEFAULT false,
  sync_token text,
  sync_token_invalidated_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, google_calendar_id)
);

CREATE TABLE public.google_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.google_calendar_connections (id) ON DELETE CASCADE,
  google_calendar_id text NOT NULL,
  google_event_id text NOT NULL,
  title text NOT NULL DEFAULT '',
  starts_at timestamptz,
  ends_at timestamptz,
  all_day boolean NOT NULL DEFAULT false,
  timezone text,
  status text NOT NULL DEFAULT 'confirmed',
  google_updated_at timestamptz,
  imported_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, google_calendar_id, google_event_id)
);

CREATE INDEX google_calendar_events_company_starts_idx
  ON public.google_calendar_events (company_id, starts_at);

CREATE TABLE public.google_calendar_sync_locks (
  company_id uuid PRIMARY KEY REFERENCES public.companies (id) ON DELETE CASCADE,
  locked_until timestamptz,
  locked_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION app_private.is_company_owner(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    WHERE cm.company_id = p_company_id
      AND cm.user_id = (SELECT auth.uid())
      AND cm.role = 'owner'::public.company_membership_role
  );
$$;

REVOKE ALL ON FUNCTION app_private.is_company_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.is_company_owner(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.member_get_google_calendar_status(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_conn public.google_calendar_connections;
  v_selected integer;
BEGIN
  IF NOT app_private.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT * INTO v_conn
  FROM public.google_calendar_connections
  WHERE company_id = p_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'connected', false,
      'status', 'disconnected',
      'google_email', NULL,
      'last_sync_at', NULL,
      'selected_calendar_count', 0
    );
  END IF;

  SELECT count(*)::integer INTO v_selected
  FROM public.google_calendar_selected_calendars sc
  WHERE sc.connection_id = v_conn.id AND sc.selected = true;

  RETURN jsonb_build_object(
    'connected', v_conn.status IN (
      'connected'::public.google_calendar_connection_status,
      'syncing'::public.google_calendar_connection_status,
      'error'::public.google_calendar_connection_status,
      'reconnect_required'::public.google_calendar_connection_status
    ),
    'status', v_conn.status,
    'google_email', v_conn.google_email,
    'last_sync_at', v_conn.last_sync_at,
    'last_sync_error_code', v_conn.last_sync_error_code,
    'selected_calendar_count', v_selected
  );
END;
$$;

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
      (e.all_day = false AND e.starts_at >= p_from AND e.starts_at < p_to)
      OR (e.all_day = true AND e.starts_at::date >= p_from::date AND e.starts_at::date <= p_to::date)
    )
  ORDER BY e.starts_at ASC NULLS LAST;
END;
$$;

ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_calendar_connection_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_calendar_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_calendar_selected_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_calendar_sync_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY google_calendar_connections_member_select ON public.google_calendar_connections
  FOR SELECT TO authenticated
  USING (app_private.is_company_member(company_id));

CREATE POLICY google_calendar_selected_member_select ON public.google_calendar_selected_calendars
  FOR SELECT TO authenticated
  USING (app_private.is_company_member(company_id));

CREATE POLICY google_calendar_events_member_select ON public.google_calendar_events
  FOR SELECT TO authenticated
  USING (app_private.is_company_member(company_id));

REVOKE ALL ON public.google_calendar_connection_secrets FROM authenticated, anon;
REVOKE ALL ON public.google_calendar_oauth_states FROM authenticated, anon;
REVOKE ALL ON public.google_calendar_sync_locks FROM authenticated, anon;

GRANT SELECT ON public.google_calendar_connections TO authenticated;
GRANT SELECT ON public.google_calendar_selected_calendars TO authenticated;
GRANT SELECT ON public.google_calendar_events TO authenticated;

REVOKE ALL ON FUNCTION public.member_get_google_calendar_status(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.member_list_google_calendar_appointments(uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.member_get_google_calendar_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.member_list_google_calendar_appointments(uuid, timestamptz, timestamptz) TO authenticated;
