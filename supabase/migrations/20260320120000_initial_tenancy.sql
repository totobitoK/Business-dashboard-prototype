-- RavenView milestone 1: tenancy, projects, RLS (customers read-only on projects)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;

CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TYPE public.company_membership_role AS ENUM ('owner', 'member');

CREATE TABLE public.company_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role public.company_membership_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);

CREATE INDEX company_memberships_user_company_idx
  ON public.company_memberships (user_id, company_id);

CREATE TABLE public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION app_private.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins pa
    WHERE pa.user_id = (SELECT auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION app_private.is_company_member(p_company_id uuid)
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
  );
$$;

CREATE OR REPLACE FUNCTION app_private.user_company_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT cm.company_id
  FROM public.company_memberships cm
  WHERE cm.user_id = (SELECT auth.uid());
$$;

REVOKE ALL ON FUNCTION app_private.is_platform_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.is_company_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.user_company_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.is_company_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.user_company_ids() TO authenticated;

CREATE TYPE public.client_project_status AS ENUM ('pending', 'active', 'archived');
CREATE TYPE public.onboarding_path AS ENUM ('full', 'payment-only');

CREATE TABLE public.client_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  company_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL DEFAULT '',
  website text,
  status public.client_project_status NOT NULL DEFAULT 'pending',
  setup_fee numeric(12, 2) NOT NULL DEFAULT 0,
  monthly_fee numeric(12, 2) NOT NULL DEFAULT 0,
  onboarding_path public.onboarding_path NOT NULL DEFAULT 'full',
  target_launch_date date,
  dashboard_scope text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_projects_id_company_unique UNIQUE (id, company_id)
);

CREATE INDEX client_projects_company_id_idx ON public.client_projects (company_id);
CREATE INDEX client_projects_status_idx ON public.client_projects (status);

CREATE TABLE public.project_intake (
  project_id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  draft jsonb NOT NULL DEFAULT '{}'::jsonb,
  submission jsonb,
  form_status text NOT NULL DEFAULT 'not-started',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_intake_project_company_fkey
    FOREIGN KEY (project_id, company_id)
    REFERENCES public.client_projects (id, company_id) ON DELETE CASCADE
);

CREATE TABLE public.dashboard_preferences (
  project_id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dashboard_preferences_project_company_fkey
    FOREIGN KEY (project_id, company_id)
    REFERENCES public.client_projects (id, company_id) ON DELETE CASCADE
);

CREATE TYPE public.payment_type AS ENUM ('setup', 'subscription', 'refund');
CREATE TYPE public.payment_record_source AS ENUM ('offline', 'online', 'demo');

CREATE TABLE public.project_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  company_id uuid NOT NULL,
  payment_date date NOT NULL,
  amount numeric(12, 2) NOT NULL,
  type public.payment_type NOT NULL,
  note text,
  record_source public.payment_record_source NOT NULL DEFAULT 'offline',
  method_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_payments_project_company_fkey
    FOREIGN KEY (project_id, company_id)
    REFERENCES public.client_projects (id, company_id) ON DELETE CASCADE
);

CREATE INDEX project_payments_project_idx ON public.project_payments (project_id, company_id);

CREATE TABLE public.scope_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  company_id uuid NOT NULL,
  revision integer NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  setup_fee numeric(12, 2) NOT NULL,
  monthly_fee numeric(12, 2) NOT NULL,
  accepted_sources_in text[] NOT NULL DEFAULT '{}',
  accepted_screens text[] NOT NULL DEFAULT '{}',
  agreed_scope_summary text,
  dashboard_scope text,
  CONSTRAINT scope_revisions_project_company_fkey
    FOREIGN KEY (project_id, company_id)
    REFERENCES public.client_projects (id, company_id) ON DELETE CASCADE,
  UNIQUE (project_id, revision)
);

CREATE TABLE public.scope_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  company_id uuid NOT NULL,
  revision integer NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  acceptance_source text NOT NULL DEFAULT 'customer',
  CONSTRAINT scope_acceptances_project_company_fkey
    FOREIGN KEY (project_id, company_id)
    REFERENCES public.client_projects (id, company_id) ON DELETE CASCADE
);

CREATE TABLE public.preview_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  company_id uuid NOT NULL,
  revision integer NOT NULL,
  feedback text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT preview_reviews_project_company_fkey
    FOREIGN KEY (project_id, company_id)
    REFERENCES public.client_projects (id, company_id) ON DELETE CASCADE
);

CREATE TABLE public.admin_project_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  company_id uuid NOT NULL,
  author_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_project_notes_project_company_fkey
    FOREIGN KEY (project_id, company_id)
    REFERENCES public.client_projects (id, company_id) ON DELETE CASCADE
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_intake ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scope_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scope_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preview_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_project_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY companies_select_member_or_admin ON public.companies
  FOR SELECT TO authenticated
  USING (
    app_private.is_platform_admin()
    OR app_private.is_company_member(id)
  );

CREATE POLICY companies_write_admin ON public.companies
  FOR ALL TO authenticated
  USING (app_private.is_platform_admin())
  WITH CHECK (app_private.is_platform_admin());

CREATE POLICY profiles_select_own_or_admin ON public.profiles
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR app_private.is_platform_admin());

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY memberships_select_own_or_admin ON public.company_memberships
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR app_private.is_platform_admin()
  );

CREATE POLICY memberships_write_admin ON public.company_memberships
  FOR INSERT TO authenticated
  WITH CHECK (app_private.is_platform_admin());

CREATE POLICY memberships_update_admin ON public.company_memberships
  FOR UPDATE TO authenticated
  USING (app_private.is_platform_admin())
  WITH CHECK (app_private.is_platform_admin());

CREATE POLICY memberships_delete_admin ON public.company_memberships
  FOR DELETE TO authenticated
  USING (app_private.is_platform_admin());

CREATE POLICY platform_admins_select_admin ON public.platform_admins
  FOR SELECT TO authenticated
  USING (app_private.is_platform_admin());

CREATE POLICY platform_admins_write_admin ON public.platform_admins
  FOR INSERT TO authenticated
  WITH CHECK (app_private.is_platform_admin());

CREATE POLICY platform_admins_delete_admin ON public.platform_admins
  FOR DELETE TO authenticated
  USING (app_private.is_platform_admin());

CREATE POLICY client_projects_select_member_or_admin ON public.client_projects
  FOR SELECT TO authenticated
  USING (
    app_private.is_platform_admin()
    OR app_private.is_company_member(company_id)
  );

CREATE POLICY client_projects_insert_admin ON public.client_projects
  FOR INSERT TO authenticated
  WITH CHECK (app_private.is_platform_admin());

CREATE POLICY client_projects_update_admin ON public.client_projects
  FOR UPDATE TO authenticated
  USING (app_private.is_platform_admin())
  WITH CHECK (app_private.is_platform_admin());

CREATE POLICY client_projects_delete_admin ON public.client_projects
  FOR DELETE TO authenticated
  USING (app_private.is_platform_admin());

CREATE POLICY project_intake_select ON public.project_intake
  FOR SELECT TO authenticated
  USING (
    app_private.is_platform_admin()
    OR app_private.is_company_member(company_id)
  );

CREATE POLICY project_intake_write_admin ON public.project_intake
  FOR ALL TO authenticated
  USING (app_private.is_platform_admin())
  WITH CHECK (app_private.is_platform_admin());

CREATE POLICY dashboard_preferences_select ON public.dashboard_preferences
  FOR SELECT TO authenticated
  USING (
    app_private.is_platform_admin()
    OR app_private.is_company_member(company_id)
  );

CREATE POLICY dashboard_preferences_write_admin ON public.dashboard_preferences
  FOR ALL TO authenticated
  USING (app_private.is_platform_admin())
  WITH CHECK (app_private.is_platform_admin());

CREATE POLICY project_payments_select ON public.project_payments
  FOR SELECT TO authenticated
  USING (
    app_private.is_platform_admin()
    OR app_private.is_company_member(company_id)
  );

CREATE POLICY project_payments_insert_admin ON public.project_payments
  FOR INSERT TO authenticated
  WITH CHECK (app_private.is_platform_admin());

CREATE POLICY project_payments_update_admin ON public.project_payments
  FOR UPDATE TO authenticated
  USING (app_private.is_platform_admin())
  WITH CHECK (app_private.is_platform_admin());

CREATE POLICY project_payments_delete_admin ON public.project_payments
  FOR DELETE TO authenticated
  USING (app_private.is_platform_admin());

CREATE POLICY scope_revisions_select ON public.scope_revisions
  FOR SELECT TO authenticated
  USING (
    app_private.is_platform_admin()
    OR app_private.is_company_member(company_id)
  );

CREATE POLICY scope_revisions_write_admin ON public.scope_revisions
  FOR ALL TO authenticated
  USING (app_private.is_platform_admin())
  WITH CHECK (app_private.is_platform_admin());

CREATE POLICY scope_acceptances_select ON public.scope_acceptances
  FOR SELECT TO authenticated
  USING (
    app_private.is_platform_admin()
    OR app_private.is_company_member(company_id)
  );

CREATE POLICY scope_acceptances_write_admin ON public.scope_acceptances
  FOR ALL TO authenticated
  USING (app_private.is_platform_admin())
  WITH CHECK (app_private.is_platform_admin());

CREATE POLICY preview_reviews_select ON public.preview_reviews
  FOR SELECT TO authenticated
  USING (
    app_private.is_platform_admin()
    OR app_private.is_company_member(company_id)
  );

CREATE POLICY preview_reviews_write_admin ON public.preview_reviews
  FOR ALL TO authenticated
  USING (app_private.is_platform_admin())
  WITH CHECK (app_private.is_platform_admin());

CREATE POLICY admin_project_notes_admin ON public.admin_project_notes
  FOR ALL TO authenticated
  USING (app_private.is_platform_admin())
  WITH CHECK (app_private.is_platform_admin());

REVOKE ALL ON public.client_projects FROM authenticated, anon;
GRANT SELECT ON public.client_projects TO authenticated;

REVOKE ALL ON public.company_memberships FROM authenticated, anon;
GRANT SELECT ON public.company_memberships TO authenticated;

REVOKE ALL ON public.platform_admins FROM authenticated, anon;
GRANT SELECT ON public.platform_admins TO authenticated;

REVOKE ALL ON public.project_payments FROM authenticated, anon;
GRANT SELECT ON public.project_payments TO authenticated;

REVOKE ALL ON public.admin_project_notes FROM authenticated, anon;

GRANT SELECT ON public.companies TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.project_intake TO authenticated;
GRANT SELECT ON public.dashboard_preferences TO authenticated;
GRANT SELECT ON public.scope_revisions TO authenticated;
GRANT SELECT ON public.scope_acceptances TO authenticated;
GRANT SELECT ON public.preview_reviews TO authenticated;

-- Milestone 1: authenticated users are read-only on tenant data (writes via service_role bootstrap / future admin APIs).
