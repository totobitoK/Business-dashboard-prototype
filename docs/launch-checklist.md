# Launch checklist

This checklist is for turning on a connector in a real environment. Do not commit client secrets, token encryption keys, or OAuth tokens. Keep sandbox and production credentials in separate variables, and do not copy a sandbox realm's data into a production deployment.

QuickBooks collections, profit and loss, and Google Sheets are not part of the QuickBooks slice. Square collections are a separate read-only connector and stay separate from QuickBooks receivables.

Customer connect stays closed. QuickBooks and Square remain `in_development` with public teaser `hidden`, so the public catalog does not list them during private build or at launch. Do not set `QUICKBOOKS_CONNECTOR_VERIFIED`, `QUICKBOOKS_INTEGRATION_ENABLED`, `SQUARE_CONNECTOR_VERIFIED`, `SQUARE_INTEGRATION_ENABLED`, or `NEXT_PUBLIC_CONNECTOR_PUBLIC_PHASE=launch` for sandbox QA.

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
- `QUICKBOOKS_REPORTING_TIMEZONE` only when this deployment should override the company time zone. Companies default to Eastern (`America/New_York`). A new company with an address uses that address instead.

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
   - `QUICKBOOKS_REPORTING_TIMEZONE` only to override the company time zone. The default is Eastern. A new company with an address uses that address.
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

## Square — sandbox QA

Register this redirect URL on the Square application's **sandbox** credentials, exactly:

`http://localhost:3000/api/integrations/square/callback`

Square allows `http://localhost` for sandbox OAuth. The redirect URL is the one saved on the application, not a parameter on the authorize request. Open the sandbox seller dashboard in another tab before starting Connect, because the sandbox authorization page does not accept a direct production-style sign-in.

Set these server variables in `.env.local` only. Leave the customer flags unset.

- `SQUARE_ENVIRONMENT=sandbox`
- `SQUARE_SANDBOX_QA=true`
- `SQUARE_SANDBOX_CLIENT_ID` (the sandbox application id)
- `SQUARE_SANDBOX_CLIENT_SECRET`
- `SQUARE_SANDBOX_TOKEN_ENCRYPTION_KEY` (at least 32 characters, unique to sandbox)
- `SQUARE_OAUTH_REDIRECT_URI=http://localhost:3000/api/integrations/square/callback`
- `SQUARE_OAUTH_STATE_SECRET` (optional; otherwise the sandbox encryption key signs OAuth state)

`SQUARE_SANDBOX_QA=true` opens Connect on `/dashboard/settings` for a company owner on this sandbox process. It does nothing when `SQUARE_ENVIRONMENT` is `production`, and it does not mark the connector verified. Do not set `SQUARE_SANDBOX_QA` on a customer deployment.

The authorize request asks only for `MERCHANT_PROFILE_READ` and `PAYMENTS_READ`. After the owner connects, they choose the locations to include. Sync then reads completed payments and completed refunds for those locations. Totals use the company time zone, keep each currency separate, and are taken before processing fees.

Do not put the sandbox application id, secret, or encryption key on a production deployment.

## Square — production

1. Complete Square's production OAuth review. Production credentials are a different pair from sandbox credentials.
2. Use a production host and a registered `https` redirect URI.
3. On the production deployment, set:
   - `SQUARE_ENVIRONMENT=production`
   - `SQUARE_PRODUCTION_CLIENT_ID`
   - `SQUARE_PRODUCTION_CLIENT_SECRET`
   - `SQUARE_PRODUCTION_TOKEN_ENCRYPTION_KEY` (a different key from sandbox)
   - `SQUARE_OAUTH_REDIRECT_URI` for that production host
4. Do not set `SQUARE_SANDBOX_QA`, `SQUARE_SANDBOX_CLIENT_ID`, or `SQUARE_SANDBOX_CLIENT_SECRET` on that deployment. This server reads credentials only for `SQUARE_ENVIRONMENT`.
5. Prefer a separate database from sandbox. A seller connected in one environment is hidden when the deployment environment does not match.
6. Apply the same migration, then set `SQUARE_INTEGRATION_ENABLED=true` and `SQUARE_CONNECTOR_VERIFIED=true` only after the production keys, redirect URI, and a live-seller check are confirmed. Leave the public catalog status unchanged until that check is accepted.
7. Connect one live seller as its owner, select locations, and reconcile payments and refunds the same way as sandbox.
8. This app does not take payments, issue refunds, or read inventory.

## Recorded on 2026-11-06 — Square sandbox reconciliation

Audited the connected sandbox seller for Acme Comfort HVAC. Merchant `MLKEVTWSVWP70`, business name `test account`, status ACTIVE, currency USD. The only Square location is `LZ8ASRV2DQV15`, name `test account`, status ACTIVE, currency USD, and it is the selected location. Company reporting timezone `America/New_York`. Reporting date `2026-11-06`. Square-Version `2026-09-16`. Square was queried for both the app's 366-day import window and `2020-01-01` through the audit time.

`SQUARE_CONNECTOR_VERIFIED` and `SQUARE_INTEGRATION_ENABLED` stay unset. A successful sync of an empty seller is not verification that payments and refunds reconcile.

### Live sandbox passes

- RetrieveMerchant and ListLocations match the stored seller and the one selected location.
- ListPayments and ListRefunds for that location each returned one page and ended the cursor. The comparison included every status. Square returned no payments and no refunds. The database also has no Square transactions, so there are no ids, amounts, timestamps, locations, or currencies to disagree on.
- Two application syncs both finished. The stored row count stayed 0, so the second sync did not create duplicates. `last_successful_sync_at` moved from `2026-11-06T16:45:48.723541Z` to `2026-11-06T16:45:51.900362Z`, and only after each successful import.
- Signed-in dashboard, same location, reporting date, Eastern timezone, and currency: expected completed payments 0, completed refunds 0, and no net because there is no currency to total. The page says "No completed payments or refunds on Nov 6, 2026" and "No completed payments or refunds in the last sync." It does not show a $0.00 total. The section says these figures are not QuickBooks receivables and not QuickBooks collections. Last successful sync on the page is 11/6/2026, 11:45:51 AM.
- A sync timestamp older than a day still shows that zero-activity sentence and adds "The last successful sync is more than a day old."
- Clearing the timestamp shows "No successful sync yet. Payments and refunds are unavailable." and hides the zero-activity sentence.
- Setting status to `error` while keeping the 11:45:51 AM timestamp shows "The last sync did not finish successfully" together with that same zero-activity sentence. The connection was then restored to `connected` with the error code cleared.
- A real refresh returned a new access token for the same merchant. The new token was stored, a locations read with it succeeded, and the following sync stayed connected. The seller was not disconnected.
- A commit that fails after staging a payment writes nothing and does not move `last_successful_sync_at`.
- `member-b@beta.dev` receives `FORBIDDEN` from the Square status read, sees no transactions for this company, and cannot read token secrets.
- The signed-in dashboard HTML does not contain the application id, application secret, or an access token. The dev-server logs do not either.

### Fixture-only passes

This sandbox seller has no payments, no refunds, and no second location. The connector does not create payments or refunds, so these cases were not available as sandbox activity.

- Import fixtures: pagination follows the cursor; a repeated payment id keeps one row; a `PENDING` payment and a `PENDING` refund are dropped; a completed payment at an unselected location is dropped; a completed partial refund of $2.50 against a $10.00 payment is kept; `2026-11-07T04:30:00Z` is `2026-11-06` in `America/New_York` and `2026-11-07T05:30:00Z` is `2026-11-07`.
- Presentation fixtures: the $10.00 USD payment and the $2.50 same-day refund net to $7.50; CAD $5.00 stays in its own total; a $1.00 refund dated the previous day stays in the list and is not subtracted from the reporting-date total.
- Database fixtures: another company cannot read the rows; an inactive location cannot be selected; one batch containing the same payment twice does not double the total; a later sync removes refunds that are no longer present; OAuth state is single-use; a failed atomic commit rolls back the new payment and leaves the prior totals and timestamp in place.

### Bug fixed during this audit

Imports previously upserted transactions before the successful-sync timestamp moved. A failure after the first page could change the visible totals. The import now commits the rows and the timestamp in one database transaction (`20261106173000_square_atomic_commit`). The live failed commit and the database fixture both left the previous result unchanged.

### Not demonstrated on this seller

- Field-by-field comparison of a real payment or refund id, amount, status, timestamp, location, and currency. Square returned none.
- A partial refund, a refund on a different day from its payment, a non-completed payment or refund, and activity at an unselected location. A multi-page Square response was also not returned; the live lists were one empty page each, and cursor following is covered by the import fixture.

### Live non-empty sync — not run

Checked again on 2026-11-06 for a $10.00 completed payment and a $2.50 completed partial refund at location `LZ8ASRV2DQV15`. This is separate from the fixture that expects $10.00 collected, $2.50 refunded, and $7.50 net.

Not run. The token RavenView stored for merchant `MLKEVTWSVWP70` has only `MERCHANT_PROFILE_READ` and `PAYMENTS_READ`. CreatePayment and RefundPayment were not sent with that token. This environment has no separate sandbox access token. Square's Sandbox Square Dashboard can show a payment and cannot issue a refund, so the two transactions were not created. The fixture totals are not a live pass.

## Still later

- QuickBooks collections workflow
- Profit and loss
- Google Sheets
- Square payment processing, refund actions, and inventory
