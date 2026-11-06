-- Receipt of a signed PDF uploaded by a RavenView admin.
-- This does not verify a signature, change project status, or accept scope.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'signed-agreements',
  'signed-agreements',
  false,
  20971520,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE public.signed_agreements (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.client_projects (id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  original_filename text NOT NULL,
  byte_size bigint NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES auth.users (id),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  is_current boolean NOT NULL DEFAULT true,
  superseded_at timestamptz,
  CONSTRAINT signed_agreements_path_shape CHECK (
    storage_path = (project_id::text || '/' || id::text || '.pdf')
  ),
  CONSTRAINT signed_agreements_filename_shape CHECK (
    length(btrim(original_filename)) BETWEEN 1 AND 180
    AND original_filename = btrim(original_filename)
    AND position('/' IN original_filename) = 0
    AND strpos(original_filename, chr(92)) = 0
    AND right(lower(original_filename), 4) = '.pdf'
  ),
  CONSTRAINT signed_agreements_size CHECK (byte_size > 0 AND byte_size <= 20971520),
  CONSTRAINT signed_agreements_current_state CHECK (
    (is_current AND superseded_at IS NULL)
    OR (NOT is_current AND superseded_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX signed_agreements_one_current_idx
  ON public.signed_agreements (project_id)
  WHERE is_current;

CREATE INDEX signed_agreements_project_uploaded_idx
  ON public.signed_agreements (project_id, uploaded_at DESC);

ALTER TABLE public.signed_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY signed_agreements_admin_select ON public.signed_agreements
  FOR SELECT TO authenticated
  USING ((SELECT app_private.is_platform_admin()));

REVOKE ALL ON TABLE public.signed_agreements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.signed_agreements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.signed_agreements TO service_role;

CREATE OR REPLACE FUNCTION public.admin_record_signed_agreement(
  p_project_id uuid,
  p_agreement_id uuid,
  p_original_filename text,
  p_byte_size bigint
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id uuid;
  v_path text;
BEGIN
  IF NOT app_private.is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF p_project_id IS NULL OR p_agreement_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_AGREEMENT';
  END IF;

  IF p_byte_size IS NULL OR p_byte_size < 1 OR p_byte_size > 20971520 THEN
    RAISE EXCEPTION 'INVALID_PDF';
  END IF;

  IF p_original_filename IS NULL
     OR length(btrim(p_original_filename)) < 1
     OR length(btrim(p_original_filename)) > 180
     OR p_original_filename <> btrim(p_original_filename)
     OR position('/' IN p_original_filename) > 0
     OR strpos(p_original_filename, chr(92)) > 0
     OR right(lower(p_original_filename), 4) <> '.pdf' THEN
    RAISE EXCEPTION 'INVALID_FILENAME';
  END IF;

  SELECT p.company_id
  INTO v_company_id
  FROM public.client_projects p
  WHERE p.id = p_project_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  v_path := p_project_id::text || '/' || p_agreement_id::text || '.pdf';

  UPDATE public.signed_agreements
  SET is_current = false,
      superseded_at = now()
  WHERE project_id = p_project_id
    AND is_current;

  INSERT INTO public.signed_agreements (
    id,
    company_id,
    project_id,
    storage_path,
    original_filename,
    byte_size,
    uploaded_by
  )
  VALUES (
    p_agreement_id,
    v_company_id,
    p_project_id,
    v_path,
    p_original_filename,
    p_byte_size,
    (SELECT auth.uid())
  );

  RETURN p_agreement_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_record_signed_agreement(uuid, uuid, text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_signed_agreement(uuid, uuid, text, bigint) TO authenticated;
