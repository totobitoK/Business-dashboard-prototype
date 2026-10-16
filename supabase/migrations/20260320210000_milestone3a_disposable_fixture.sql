-- Isolated M3A DB-test projects (not M2 test fixtures, not shared seed rows).

CREATE OR REPLACE FUNCTION public.admin_create_m3a_disposable_project(
  p_company_id uuid,
  p_label text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_suffix text;
BEGIN
  IF NOT app_private.is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  v_suffix := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  INSERT INTO public.client_projects (
    company_id, company_name, contact_name, email, phone, status,
    setup_fee, monthly_fee, dashboard_scope
  ) VALUES (
    p_company_id,
    'M3A Fixture ' || left(COALESCE(NULLIF(trim(p_label), ''), 'test'), 40) || ' ' || v_suffix,
    'Fixture Contact',
    'm3a-fixture-' || v_suffix || '@fixture.local',
    '555-0198',
    'pending',
    1000,
    100,
    'M3A non-test disposable fixture'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_m3a_disposable_project(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT app_private.is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.client_projects cp
    WHERE cp.id = p_project_id
      AND cp.email LIKE 'm3a-fixture-%@fixture.local'
  ) THEN
    IF EXISTS (SELECT 1 FROM public.client_projects WHERE id = p_project_id) THEN
      RAISE EXCEPTION 'FORBIDDEN';
    END IF;
    RETURN jsonb_build_object('ok', true, 'already_deleted', true);
  END IF;

  DELETE FROM public.client_projects WHERE id = p_project_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_m3a_disposable_project(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delete_m3a_disposable_project(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_m3a_disposable_project(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_m3a_disposable_project(uuid) TO authenticated;
