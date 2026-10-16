# Live Supabase development setup

## 1. Environment

Copy `.env.example` to `.env.local` and set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (server only — never commit)

## 2. Auth settings (Supabase dashboard)

- **Disable public sign-ups** (Auth → Providers → Email).
- Add redirect URLs for password reset:
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/auth/update-password`

## 3. Seed development tenants

```bash
node scripts/seed-dev-users.mjs
```

Random per-user passwords are written to **`.dev-seed-credentials.json`** (gitignored, mode 600). They are not printed to the console.

| Email | Role |
|-------|------|
| `admin@ravenview.dev` | Platform admin → `/admin/clients` |
| `member-a@acme.dev` | Acme company member → `/dashboard` |
| `member-b@beta.dev` | Beta company member → `/dashboard` |

## 4. Isolation tests

With `.env.local` loaded:

```bash
RUN_SUPABASE_ISOLATION_TESTS=1 npm test -- src/lib/supabase/tenant-isolation.test.ts
```

Tests use **publishable key + signInWithPassword** only (no service role).

## 5. Routes

| URL | Mode |
|-----|------|
| `/demo/admin`, `/demo/dashboard`, `/demo/onboarding` | Browser localStorage demo |
| `/admin`, `/dashboard` | Live Supabase (milestone 1 read-only) |
| `/login` | Email/password sign-in |
