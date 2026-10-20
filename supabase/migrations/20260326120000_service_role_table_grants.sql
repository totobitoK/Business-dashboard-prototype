-- Server bootstrap, seed script, and service-client integration tests use SUPABASE_SECRET_KEY
-- (service_role). RLS is bypassed, but Postgres still requires table-level DML grants.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_memberships TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_admins TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_projects TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_calendar_connections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_calendar_connection_secrets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_calendar_selected_calendars TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_calendar_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_calendar_oauth_states TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_calendar_sync_locks TO service_role;
