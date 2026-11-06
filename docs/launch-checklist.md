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

Audited the connected sandbox seller for Acme Comfort HVAC before the payment and refund recorded in the live non-empty section. Merchant `MLKEVTWSVWP70`, business name `test account`, status ACTIVE, currency USD. The only Square location is `LZ8ASRV2DQV15`, name `test account`, status ACTIVE, currency USD, and it is the selected location. Company reporting timezone `America/New_York`. Reporting date `2026-11-06`. Square-Version `2026-09-16`. Square was queried for both the app's 366-day import window and `2020-01-01` through the audit time.

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

These cases were not the sandbox transactions below. The connector does not create payments or refunds.

- Import fixtures: pagination follows the cursor; a repeated payment id keeps one row; a `PENDING` payment and a `PENDING` refund are dropped; a completed payment at an unselected location is dropped; a completed partial refund of $2.50 against a $10.00 payment is kept; `2026-11-07T04:30:00Z` is `2026-11-06` in `America/New_York` and `2026-11-07T05:30:00Z` is `2026-11-07`.
- Presentation fixtures: the $10.00 USD payment and the $2.50 same-day refund net to $7.50; CAD $5.00 stays in its own total; a $1.00 refund dated the previous day stays in the list and is not subtracted from the reporting-date total.
- Database fixtures: another company cannot read the rows; an inactive location cannot be selected; one batch containing the same payment twice does not double the total; a later sync removes refunds that are no longer present; OAuth state is single-use; a failed atomic commit rolls back the new payment and leaves the prior totals and timestamp in place.

### Bug fixed during this audit

Imports previously upserted transactions before the successful-sync timestamp moved. A failure after the first page could change the visible totals. The import now commits the rows and the timestamp in one database transaction (`20261106173000_square_atomic_commit`). The live failed commit and the database fixture both left the previous result unchanged.

### Live non-empty sync — 2026-11-06 17:29 UTC

Separate from the empty-seller pass above and from the fixture that uses a $10.00 payment and a $2.50 refund. RavenView stayed read-only. `SQUARE_CONNECTOR_VERIFIED` and `SQUARE_INTEGRATION_ENABLED` stay unset.

Square ListPayments, ListRefunds, GetPayment, and GetRefund for location `LZ8ASRV2DQV15` each returned one page and ended the cursor. The only completed payment and the only refund are:

| Field | Square payment | Imported payment | Square refund | Imported refund |
|---|---|---|---|---|
| ID | `Aphst7ABFAITBno5UX1kFNe0VSKZY` | same | `Aphst7ABFAITBno5UX1kFNe0VSKZY_HYYq2ibmtMvWh6ko8fYsHf2anj6o0wuH4xW1kG7W5u` | same |
| Linked payment ID | | | `Aphst7ABFAITBno5UX1kFNe0VSKZY` | not stored; the Square value equals the imported payment ID |
| Status | `COMPLETED` | kept by the completed-only import | `COMPLETED` | kept by the completed-only import |
| Amount | `10` USD (`amount_money`, `total_money`, and `approved_money`) | `10` USD | `2` USD; payment `refunded_money` is also `2` USD | `2` USD |
| Location | `LZ8ASRV2DQV15` | same | `LZ8ASRV2DQV15` | same |
| Created | `2026-11-06T17:11:34.258Z` | same instant | `2026-11-06T17:24:22.580Z` | same instant |
| Eastern reporting date | `2026-11-06` | `2026-11-06` | `2026-11-06` | `2026-11-06` |

Both transactions are on reporting date `2026-11-06`, timezone `America/New_York`. Square's amounts are minor units, so 10 USD is $0.10 and 2 USD is $0.02. The signed-in dashboard shows Payments received **$0.10**, Refunds **$0.02**, and Net collected **$0.08**, with both rows under Recent activity on Nov 6, 2026 at location `test account`. A $10.00 / $2.00 / $8.00 reading would require Square amounts 1000 and 200. These source records are 10 and 2, and RavenView matches them. No importer change.

The second sync at `2026-11-06T17:29:27.127977Z` left the same two rows and the same amounts. `last_successful_sync_at` moved from `2026-11-06T17:29:22.321465Z` only after that second successful import. The dashboard HTML contained no application id, application secret, or access token.

### Live recheck — 2026-11-06 17:35 UTC

Square now has a second completed pair at the same location. Both pairs are on Eastern date `2026-11-06`. Two syncs imported each record once.

| Square record | Linked payment | Status | Amount | Location | Created | Eastern date | Imported |
|---|---|---|---|---|---|---|---|
| Payment `0X5VavvDCuxig1aXOniioTVIK3FZY` | | `COMPLETED` | `1000` USD ($10.00) | `LZ8ASRV2DQV15` | `2026-11-06T17:33:19.536Z` | `2026-11-06` | `1000` USD, same instant and date |
| Refund `0X5VavvDCuxig1aXOniioTVIK3FZY_qD5WkrhI8JbyVmergzSjt9fTNQa1WJQ831Q326dXHsH` | that payment | `COMPLETED` | `250` USD ($2.50) | `LZ8ASRV2DQV15` | `2026-11-06T17:34:20.760Z` | `2026-11-06` | `250` USD, same instant and date |
| Earlier payment and refund | the $0.10 payment | `COMPLETED` | `10` and `2` USD | `LZ8ASRV2DQV15` | unchanged | `2026-11-06` | unchanged |

Same-day USD total from Square is payments `1010`, refunds `252`, net `758`. The signed-in dashboard shows Payments received **$10.10**, Refunds **$2.52**, and Net collected **$7.58**. Recent activity lists $10.00, -$2.50, $0.10, and -$0.02, each on Nov 6, 2026. The new refund is $2.50, not $2.00. Last successful sync on the page is 11/6/2026, 12:35:39 PM. The page HTML contained no application id, application secret, or access token.

### Confirmed amounts — read-only, 2026-11-06 17:37 UTC

Read again with no new Square transactions and no RavenView sync. ListPayments and ListRefunds for `LZ8ASRV2DQV15` each returned one page and ended. These four records are the only ones on the seller, and they are the two pairs created today. `SQUARE_CONNECTOR_VERIFIED` and `SQUARE_INTEGRATION_ENABLED` stay unset.

| Payment ID | Linked refund ID | Square `amount_money` | RavenView dollars |
|---|---|---|---|
| `Aphst7ABFAITBno5UX1kFNe0VSKZY` | `Aphst7ABFAITBno5UX1kFNe0VSKZY_HYYq2ibmtMvWh6ko8fYsHf2anj6o0wuH4xW1kG7W5u` | payment `10` USD; refund `2` USD | $0.10 and $0.02 |
| `0X5VavvDCuxig1aXOniioTVIK3FZY` | `0X5VavvDCuxig1aXOniioTVIK3FZY_qD5WkrhI8JbyVmergzSjt9fTNQa1WJQ831Q326dXHsH` | payment `1000` USD; refund `250` USD | $10.00 and $2.50 |

Square's amount is the smallest currency unit. For USD, `1000` is $10.00 and `250` is $2.50, not $1,000.00 and $250.00. The first pair adds `10` and `2` minor units, which are $0.10 and $0.02. All four are completed USD activity on `2026-11-06` Eastern at the selected location, so the dashboard total is $10.10 collected, $2.52 refunded, and $7.58 net.

### Fixture-only

Not demonstrated with this seller's Square records:

- A refund on a different Eastern day from its payment.
- A non-completed payment or refund.
- Activity at an unselected location.
- A Square response with more than one page. These lists were one page each; cursor following remains a fixture.

## Still later

- QuickBooks collections workflow
- Profit and loss
- Google Sheets
- Square payment processing, refund actions, and inventory
