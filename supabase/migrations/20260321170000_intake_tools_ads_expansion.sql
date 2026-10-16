-- Allow Google Ads and Meta Ads in intake tool selections.

CREATE OR REPLACE FUNCTION app_private.validate_intake_tool(p_tool text)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  IF p_tool NOT IN (
    'google-sheets', 'excel-csv', 'quickbooks', 'hubspot',
    'stripe', 'square', 'google-calendar', 'google-ads', 'meta-ads', 'other'
  ) THEN
    RAISE EXCEPTION 'INTAKE_VALIDATION:Invalid tool selection';
  END IF;
END;
$$;
