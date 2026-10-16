-- Restrict milestone 3A test workspace RPC to dedicated M2 test projects only.

CREATE OR REPLACE FUNCTION public.admin_milestone3a_test_set_preview_workspace(
  p_preview_revision_id uuid,
  p_demo_workspace_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_project_id uuid;
BEGIN
  IF NOT app_private.is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT pr.project_id INTO v_project_id
  FROM public.preview_revisions pr
  WHERE pr.id = p_preview_revision_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  PERFORM app_private.milestone2_test_project_guard(v_project_id);

  UPDATE public.preview_revisions
  SET demo_workspace_id = p_demo_workspace_id
  WHERE id = p_preview_revision_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;
