-- Every company uses Eastern time until a new company is created from an address.
-- America/New_York is EST in winter and EDT in summer.

ALTER TABLE public.companies
  ADD COLUMN timezone text NOT NULL DEFAULT 'America/New_York',
  ADD COLUMN timezone_source text NOT NULL DEFAULT 'eastern_default';

ALTER TABLE public.companies
  ADD CONSTRAINT companies_timezone_nonempty CHECK (length(btrim(timezone)) > 0),
  ADD CONSTRAINT companies_timezone_source CHECK (timezone_source IN ('eastern_default', 'address'));

ALTER TABLE public.quickbooks_connections
  ALTER COLUMN reporting_timezone SET DEFAULT 'America/New_York',
  ALTER COLUMN reporting_timezone_source SET DEFAULT 'configured';

UPDATE public.quickbooks_connections
SET
  reporting_timezone = 'America/New_York',
  reporting_timezone_source = 'configured',
  updated_at = now()
WHERE reporting_timezone_source = 'utc_default'
   OR reporting_timezone = 'UTC';
