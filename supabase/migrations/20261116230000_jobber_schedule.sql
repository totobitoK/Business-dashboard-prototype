-- Jobber visit schedule. Owner connects the account. Members can read visits.
-- Tokens stay in jobber_connection_secrets and are not granted to the API roles.
-- This migration is not applied to a live project until a Jobber test account exists.

CREATE TYPE public.jobber_connection_status AS ENUM (
  'disconnected',
  'connected',
  'reconnect_required',
  'syncing',
  'error'
);

CREATE TABLE public.jobber_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies (id) ON DELETE CASCADE,
  jobber_account_id text,
  status public.jobber_connection_status NOT NULL DEFAULT 'disconnected',
  connected_at timestamptz,
  disconnected_at timestamptz,
  last_sync_at timestamptz,
  last_sync_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.jobber_connection_secrets (
  connection_id uuid PRIMARY KEY REFERENCES public.jobber_connections (id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  refresh_token_enc text NOT NULL,
  access_token_enc text,
  access_token_expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.jobber_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_hash text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('connect', 'replace')),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX jobber_oauth_states_expires_idx
  ON public.jobber_oauth_states (expires_at)
  WHERE consumed_at IS NULL;

CREATE TABLE public.jobber_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.jobber_connections (id) ON DELETE CASCADE,
  jobber_account_id text NOT NULL,
  jobber_visit_id text NOT NULL,
  title text NOT NULL DEFAULT '',
  day date,
  starts_at timestamptz,
  ends_at timestamptz,
  anytime boolean NOT NULL DEFAULT false,
  completed boolean NOT NULL DEFAULT false,
  assignees text[] NOT NULL DEFAULT '{}',
  client_name text,
  web_uri text,
  imported_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, jobber_account_id, jobber_visit_id)
);

CREATE INDEX jobber_visits_company_day_idx
  ON public.jobber_visits (company_id, day);

CREATE TABLE public.jobber_sync_locks (
  company_id uuid PRIMARY KEY REFERENCES public.companies (id) ON DELETE CASCADE,
  locked_until timestamptz,
  locked_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.jobber_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobber_connection_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobber_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobber_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobber_sync_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY jobber_connections_member_select ON public.jobber_connections
  FOR SELECT TO authenticated
  USING (app_private.is_company_member(company_id));

CREATE POLICY jobber_visits_member_select ON public.jobber_visits
  FOR SELECT TO authenticated
  USING (app_private.is_company_member(company_id));

REVOKE ALL ON public.jobber_connection_secrets FROM authenticated, anon;
REVOKE ALL ON public.jobber_oauth_states FROM authenticated, anon;
REVOKE ALL ON public.jobber_sync_locks FROM authenticated, anon;

GRANT SELECT ON public.jobber_connections TO authenticated;
GRANT SELECT ON public.jobber_visits TO authenticated;
