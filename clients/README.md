# Scope card exports

This folder holds **scope-card JSON files** — the agent contract for each accepted client.

## Who reads and writes

- **RavenView (the app) is the writer.** Files are created or updated when an admin accepts a scope card from the client book.
- **Agents read only.** Downstream automation should treat these files as the source of truth for accepted scope, not browser localStorage or client onboarding drafts.

## Rules

- A file is written automatically when a client submits onboarding (requirements received). It is updated whenever export-relevant CRM fields change (fees, status, admin-confirmed sources/screens, payments, etc.). `card_version` bumps only when meaningful content changes.
- An admin must still **accept the scope card** to confirm scope and pricing in the CRM before payment — that is separate from the export.
- Draft onboarding data stays in the app and is **not** exported.
- `sources_in` and `screens` are admin-confirmed lists. Requested tools and free-text scope from client forms are never copied automatically.
- `setup_status: paid` is set only when the app’s existing payment rule confirms setup is paid (`setupPaidAmount >= setupFee`).
- `card_version` starts at `1` and increments only when an accepted export’s meaningful content changes.
- Do not store secrets, API keys, OAuth tokens, or customer layout settings in these files.

## Sample

`northline-supply.json` is a **fake demo card** (`status: demo`) for agent development. Live exports use the client’s internal id (e.g. `client-3.json`) and map CRM status to `onboarding`, `active`, or `paused`.
