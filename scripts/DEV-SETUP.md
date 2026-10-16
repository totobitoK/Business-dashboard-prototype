# Live Supabase development setup

## 1. Environment

Copy `.env.example` to `.env.local` and set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (server only — never commit)

`npm run seed:dev` and `npm test` load `.env.local` automatically (see [`src/lib/load-env-local.ts`](../src/lib/load-env-local.ts)).

## 2. Auth settings (Supabase dashboard)

- **Disable public sign-ups** (Auth → Providers → Email).
- Add redirect URLs for password reset:
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/auth/update-password`

## 3. Seed development tenants

```bash
npm run seed:dev
```

Random per-user passwords are written to **`.dev-seed-credentials.json`** (gitignored, mode 600). They are not printed to the console.

| Email | Role |
|-------|------|
| `admin@ravenview.dev` | Platform admin → `/admin/clients` |
| `member-a@acme.dev` | Acme company member → `/dashboard` |
| `member-b@beta.dev` | Beta company member → `/dashboard` |

## 4. Database tests

**Tenant isolation (run before enabling live writes):**

```bash
npm run test:isolation
```

Fails with an explicit error if env or `.dev-seed-credentials.json` is missing (does not treat skipped checks as pass).

**Milestone 2 RPC writes (intake, scope publish/accept):**

```bash
npm run test:milestone2
```

`npm test` skips both isolation and milestone2 suites unless their `RUN_*` env vars are set.

Tests use **publishable key + signInWithPassword** only (no service role).

## 5. Scope-card filesystem exports

- **Demo** exports → `clients/demo/` via `/api/demo/scope-card` (development only).
- **Live** exports → `clients/` via `/api/scope-card` (platform admin, development only).

## 6. Routes

| URL | Mode |
|-----|------|
| `/demo/admin`, `/demo/dashboard`, `/demo/onboarding` | Browser localStorage demo |
| `/admin`, `/dashboard`, `/onboarding/[projectId]` | Live Supabase (auth required) |
| `/admin/clients/[projectId]` | Platform admin scope draft + publish |
| `/login` | Email/password sign-in |
