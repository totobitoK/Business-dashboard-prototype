-- A failed import must not change the last successful totals.
-- Upsert and finalize run in one transaction, and a failure rolls both back.

CREATE OR REPLACE FUNCTION app_private.square_commit_import(
  p_connection_id uuid,
  p_company_id uuid,
  p_expected_generation bigint,
  p_worker_id text,
  p_sync_run_id uuid,
  p_transactions jsonb,
  p_reporting_date date,
  p_reporting_timezone text,
  p_merchant_name text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted integer;
BEGIN
  IF NOT app_private.square_upsert_transactions(
    p_connection_id,
    p_company_id,
    p_expected_generation,
    p_worker_id,
    p_sync_run_id,
    p_transactions
  ) THEN
    RAISE EXCEPTION 'SYNC_ABORTED';
  END IF;

  v_deleted := app_private.square_finalize_transactions(
    p_connection_id,
    p_company_id,
    p_expected_generation,
    p_worker_id,
    p_sync_run_id,
    p_reporting_date,
    p_reporting_timezone,
    p_merchant_name
  );
  IF v_deleted < 0 THEN
    RAISE EXCEPTION 'SYNC_ABORTED';
  END IF;
  RETURN v_deleted;
END;
$$;

CREATE OR REPLACE FUNCTION public.square_commit_import(
  p_connection_id uuid,
  p_company_id uuid,
  p_expected_generation bigint,
  p_worker_id text,
  p_sync_run_id uuid,
  p_transactions jsonb,
  p_reporting_date date,
  p_reporting_timezone text,
  p_merchant_name text
)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.square_commit_import(
    p_connection_id,
    p_company_id,
    p_expected_generation,
    p_worker_id,
    p_sync_run_id,
    p_transactions,
    p_reporting_date,
    p_reporting_timezone,
    p_merchant_name
  );
$$;

REVOKE ALL ON FUNCTION app_private.square_commit_import(uuid, uuid, bigint, text, uuid, jsonb, date, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.square_commit_import(uuid, uuid, bigint, text, uuid, jsonb, date, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.square_commit_import(uuid, uuid, bigint, text, uuid, jsonb, date, text, text) TO service_role;
