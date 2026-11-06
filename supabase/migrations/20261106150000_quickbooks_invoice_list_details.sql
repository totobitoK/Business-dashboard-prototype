-- Member invoice lists need the QuickBooks id and original total for the
-- read-only receivables row. CREATE OR REPLACE cannot change OUT columns.

DROP FUNCTION public.member_list_quickbooks_invoices(uuid, integer);

CREATE FUNCTION public.member_list_quickbooks_invoices(
  p_company_id uuid,
  p_limit integer DEFAULT 200
)
RETURNS TABLE (
  id uuid,
  qbo_invoice_id text,
  doc_number text,
  customer_name text,
  txn_date date,
  due_date date,
  total_amount numeric,
  remaining_balance numeric,
  overdue boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 200), 1), 200);
  v_reporting date;
  v_connection_id uuid;
  v_realm text;
  v_env public.quickbooks_intuit_environment;
BEGIN
  IF NOT app_private.is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT c.reporting_date, c.id, c.realm_id, c.intuit_environment
  INTO v_reporting, v_connection_id, v_realm, v_env
  FROM public.quickbooks_connections c
  WHERE c.company_id = p_company_id
    AND c.disconnected_at IS NULL
    AND c.status IN (
      'connected'::public.quickbooks_connection_status,
      'syncing'::public.quickbooks_connection_status,
      'error'::public.quickbooks_connection_status,
      'reconnect_required'::public.quickbooks_connection_status
    )
    AND c.last_successful_sync_at IS NOT NULL;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    i.id,
    i.qbo_invoice_id,
    i.doc_number,
    i.customer_name,
    i.txn_date,
    i.due_date,
    i.total_amount,
    i.remaining_balance,
    (i.due_date IS NOT NULL AND v_reporting IS NOT NULL AND i.due_date < v_reporting) AS overdue
  FROM public.quickbooks_invoices i
  WHERE i.company_id = p_company_id
    AND i.connection_id = v_connection_id
    AND i.realm_id = v_realm
    AND i.intuit_environment = v_env
  ORDER BY i.due_date ASC NULLS LAST, i.doc_number ASC NULLS LAST
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.member_list_quickbooks_invoices(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.member_list_quickbooks_invoices(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.member_list_quickbooks_invoices(uuid, integer) TO authenticated;
