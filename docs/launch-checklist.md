# Launch checklist

This checklist is for turning on a connector in a real environment. Do not commit client secrets, token encryption keys, or OAuth tokens. Keep sandbox and production credentials in separate variables, and do not copy a sandbox realm's data into a production deployment.

Collections, profit and loss, and Google Sheets are not part of this QuickBooks slice.

Customer connect stays closed. QuickBooks remains `in_development` with public teaser `hidden`, so the public catalog does not list it during private build or at launch. Do not set `QUICKBOOKS_CONNECTOR_VERIFIED`, `QUICKBOOKS_INTEGRATION_ENABLED`, or `NEXT_PUBLIC_CONNECTOR_PUBLIC_PHASE=launch` for sandbox QA.

## QuickBooks Online — sandbox QA

Register this redirect URL on the Intuit app's **development** keys, exactly:

`http://localhost:3000/api/integrations/quickbooks/callback`

Development keys authorize sandbox companies only. Intuit allows `http://localhost` on those keys. The connect route sends that same URI, so `QUICKBOOKS_OAUTH_REDIRECT_URI` must be the string above when you use this local app. A different host, port, or path will not match.

Set these server variables in `.env.local` only. Leave the customer flags unset.

- `QUICKBOOKS_ENVIRONMENT=sandbox`
- `QUICKBOOKS_SANDBOX_QA=true`
- `QUICKBOOKS_SANDBOX_CLIENT_ID`
- `QUICKBOOKS_SANDBOX_CLIENT_SECRET`
- `QUICKBOOKS_SANDBOX_TOKEN_ENCRYPTION_KEY` (at least 32 characters, unique to sandbox)
- `QUICKBOOKS_OAUTH_REDIRECT_URI=http://localhost:3000/api/integrations/quickbooks/callback`
- `QUICKBOOKS_OAUTH_STATE_SECRET` (optional; otherwise the sandbox encryption key signs OAuth state)
- `QUICKBOOKS_REPORTING_TIMEZONE` set to the sandbox company's time zone (for example `America/Chicago`) when QuickBooks does not return one

`QUICKBOOKS_SANDBOX_QA=true` opens Connect on `/dashboard/settings` for a company owner on this sandbox process. It does nothing when `QUICKBOOKS_ENVIRONMENT` is `production`, and it does not mark the connector verified. Do not set `QUICKBOOKS_SANDBOX_QA` on a customer deployment.

After the migration is applied, sign in as a company owner and connect one sandbox company. The owner who starts the connection must be the one who finishes it. Then confirm:

- OAuth returns to the redirect URL and a later sync can refresh the access token.
- Receivables shows an open balance, an overdue balance, the invoice list, and the last successful sync.
- Open balance equals the sum of invoice `Balance` values still greater than zero, compared on the reporting date shown in the app.
- A partially paid invoice contributes its remaining balance, not the original total.
- Fully paid and voided invoices are absent. Paying or voiding an imported invoice in the sandbox removes it on the next sync.
- An invoice is overdue only when its due date is before that reporting date. A missing due date is not overdue.

Do not put the sandbox client id, secret, or encryption key on a production deployment.

## QuickBooks Online — production

1. Complete Intuit's production access review for the app. Production keys are a different pair from development keys and authorize live companies only.
2. Use a production host and a registered `https` redirect URI. Intuit does not accept localhost or IP addresses for production redirect URIs.
3. On the production deployment, set:
   - `QUICKBOOKS_ENVIRONMENT=production`
   - `QUICKBOOKS_PRODUCTION_CLIENT_ID`
   - `QUICKBOOKS_PRODUCTION_CLIENT_SECRET`
   - `QUICKBOOKS_PRODUCTION_TOKEN_ENCRYPTION_KEY` (a different key from sandbox)
   - `QUICKBOOKS_OAUTH_REDIRECT_URI` for that production host
   - `QUICKBOOKS_REPORTING_TIMEZONE` when the live company time zone is not returned by QuickBooks
4. Do not set `QUICKBOOKS_SANDBOX_QA`, `QUICKBOOKS_SANDBOX_CLIENT_ID`, or `QUICKBOOKS_SANDBOX_CLIENT_SECRET` on that deployment. This server reads credentials only for `QUICKBOOKS_ENVIRONMENT`.
5. Prefer a separate database from sandbox so a sandbox realm cannot be read by the production app. A connection made in one environment is hidden when the deployment environment does not match.
6. Apply the same migration, then set `QUICKBOOKS_INTEGRATION_ENABLED=true` and `QUICKBOOKS_CONNECTOR_VERIFIED=true` only after the production keys, redirect URI, and a live-company check are confirmed. Leave the public catalog status unchanged until that check is accepted.
7. Connect one live company as its owner and reconcile open and overdue balances the same way as sandbox.
8. This app requests the Accounting scope and only sends GET requests to the Accounting API. It does not create or edit invoices.

## Recorded on 2026-11-05

Passed:

- The repo migration `supabase/migrations/20261105143000_quickbooks_online_receivables.sql` matches the dev Supabase project: the same tables, checks, indexes, member-select policies, and 25 function bodies. Write RPCs are executable by `service_role` only. Member read RPCs are executable by `authenticated` only. `anon` cannot execute them.
- Tenant isolation on that database: another company cannot read invoices or secrets; a partial remaining balance is kept; voided and fully paid invoices are dropped; overdue follows the stored reporting date; a missing due date is not overdue; OAuth state is single-use.
- Unit tests for callback checks, mocked token refresh and `invalid_grant`, sandbox and production ciphertext separation, invoice pagination, and receivables labels.
- Lint and the production build.
- Signed-in dashboard and settings, with no QuickBooks credentials configured: Receivables hides balances and says they are not revenue and not money collected. Settings shows QuickBooks as not connected. `GET /api/integrations/quickbooks/connect` returns 503.

Not passed, because `QUICKBOOKS_SANDBOX_CLIENT_ID`, `QUICKBOOKS_SANDBOX_CLIENT_SECRET`, and `QUICKBOOKS_SANDBOX_TOKEN_ENCRYPTION_KEY` are not configured:

- OAuth against Intuit.
- A live token refresh against Intuit.
- Invoice sync from a sandbox company.
- Open and overdue totals compared with QuickBooks on the same reporting date, including a partially paid invoice.
- Paying or voiding an imported sandbox invoice and confirming the next sync removes it.

`QUICKBOOKS_CONNECTOR_VERIFIED` remains unset. Customer connect stays closed.

## Still later

- Collections workflow
- Profit and loss
- Google Sheets
