# Milestone 4A — migration notes

## Reproducible source of truth

Apply migrations in filename order from this directory:

1. `20260322120000_milestone4a_google_calendar.sql`
2. `20260323140000_milestone4a_hardening.sql`
3. `20260324120000_milestone4a_atomic_sync.sql`
4. `20260325120000_milestone4a_checkpoint_guards.sql`
5. `20260326120000_service_role_table_grants.sql`
6. `20260326130000_sync_lease_acquire_false.sql`

Fresh environments should use `supabase db push` / linked CLI or run the full SQL files above. Do **not** reset production or dev databases to reconcile history.

## Development Supabase split history (`brmyjumobqnjifxclsnl`)

The atomic sync migration (`20260324120000_milestone4a_atomic_sync.sql`) was applied to dev in **three** MCP chunks when a single apply failed mid-flight:

| Remote migration name | Repo equivalent |
|----------------------|-----------------|
| `milestone4a_atomic_sync_part1` | Lines 1–137 (generation bump, eligible, apply_event) |
| `milestone4a_atomic_sync_part2` | Lines 139–285 (reconcile, persist_tokens, purge, disconnect) |
| `milestone4a_atomic_sync_part3` | Lines 287–431 (public wrappers, REVOKE/GRANT) |

Function bodies on dev should match the single repo file after all three parts (and `20260325120000_milestone4a_checkpoint_guards.sql`) are applied. The remote `supabase_migrations.schema_migrations` table will list the part names; that is expected and does not require re-applying part1–3 if functions already exist.

## Verifying dev matches repo

Compare function presence (not migration row names):

```sql
SELECT proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND proname LIKE 'google_calendar_%'
ORDER BY proname;
```

After checkpoint guards, expect at minimum: `google_calendar_sync_apply_event`, `google_calendar_sync_checkpoint_calendar`, `google_calendar_sync_persist_progress`, `google_calendar_sync_mark_complete`, `google_calendar_sync_reconcile_calendar` (returns `-1` when generation/lease guard rejects).

### Checkpoint guards split on dev (optional)

If `20260325120000_milestone4a_checkpoint_guards.sql` is applied via MCP in chunks, dev may list `20260325120000_milestone4a_checkpoint_guards_part1` … `part3b` instead of a single row. Function bodies should still match the one repo file; do not re-apply if functions already exist.
