# Database roles and migrations (CLN-018)

## Roles

| Role                                      | Env var                  | Can                                                                                                                          | Used by                                                                     |
| ----------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| owner / migrator (`power_budget` locally) | `MIGRATION_DATABASE_URL` | Owns every table, runs DDL, owns the drizzle bookkeeping schema                                                              | `pnpm db:migrate`, `pnpm db:roles`, `drizzle-kit`, container boot migration |
| app (`power_budget_app` locally)          | `DATABASE_URL`           | `SELECT/INSERT/UPDATE/DELETE` on `public`, sequences. No ownership, no DDL, no `TRUNCATE`, no access to the `drizzle` schema | The running API and worker                                                  |

`DATABASE_URL` is what the backend reads at runtime. `drizzle/migrate.mjs` and `drizzle.config.ts` use `MIGRATION_DATABASE_URL` and fall back to `DATABASE_URL`, so a single-role setup keeps working until the roles are split.

The app role is not the table owner and has no `BYPASSRLS`, so the row level security policies (migration `0008_rls_tenancy`, see below) bind it. `FORCE` makes them bind the owner too; never hand the owner URL to the running app.

`REFRESH MATERIALIZED VIEW` needs ownership, so migration `0007_refresh_plan_actuals_fn` adds a `SECURITY DEFINER` function `refresh_plan_actuals()`; the plan-actuals processor calls it.

### Local (docker compose)

`docker/postgres/init/01-app-role.sh` creates the app role on first start of an empty volume (`APP_DB_USER` / `APP_DB_PASSWORD`, defaults `power_budget_app`). Copy `.env.example` to `.env`, then `pnpm dev:db:up` and `pnpm --filter @power-budget/backend db:migrate`.

An existing volume does not re-run init scripts: either `pnpm dev:db:reset`, or run `pnpm --filter @power-budget/backend db:roles` with `MIGRATION_DATABASE_URL`, `APP_DB_USER`, `APP_DB_PASSWORD` set.

### Neon / Render (live)

1. Take the current connection string (the role that created the tables) as `MIGRATION_DATABASE_URL`.
2. Run once, and again after any migration that adds tables outside the owner's default privileges:
   `MIGRATION_DATABASE_URL=... APP_DB_USER=power_budget_app APP_DB_PASSWORD=<new secret> pnpm --filter @power-budget/backend db:roles`
   (idempotent; creates or updates the role and re-grants on existing tables).
3. In Render set `MIGRATION_DATABASE_URL` to the owner URL and switch `DATABASE_URL` to the app role URL.
4. Caveat: the Docker image still runs `node drizzle/migrate.mjs && node dist/src/main.js` in one container, so the owner URL is present in the API container env. A real split needs a pre-deploy migration job; until then the app code itself only ever uses `DATABASE_URL`.

## Migrations

- `drizzle/schema.ts`, `drizzle/migrations/meta/_journal.json` and the snapshots must agree. `pnpm --filter @power-budget/backend db:check` (also a CI step) runs `drizzle-kit check` and `drizzle-kit generate`, and fails if a new migration would be produced. Fix drift with `pnpm --filter @power-budget/backend db:generate` and commit the result.
- Journal idx 0 to 6 are applied on the live DB. Never rename their tags or change `when`: the drizzle migrator applies by `when` and skips anything at or below the last applied value. This is why three files still share the `0004_` prefix. `__tests__/migrations-hygiene.spec.ts` freezes them.
- Snapshots `0003` to `0006` were reconstructed in CLN-018 for the four hand-written migrations added in PR #148 (they had none). Their SQL was not touched.
- `src/test/integration/migrations.integration.spec.ts` proves the journal applies from an empty database and from journal idx 2, 5 and 6 without re-running applied migrations.
- Hand-written SQL: use `drizzle-kit generate --custom --name=<slug>` so the snapshot and journal stay consistent.

## Row level security (CLN-005)

Migration `0008_rls_tenancy` (journal idx 8) replaces the never-applied `0003_rls_policies.sql` (deleted). It enables **and forces** RLS on the tenant data tables: `transactions`, `transaction_mappings` (tenant derived from the transaction; the planned item must be in the same household), `transfers`, `bank_connections`, `bank_accounts`, `sync_runs` (via the connection), `plans`, `planned_items`, `planned_item_versions`, `categories` (NULL-household seed rows readable by all), `category_privacy`, `leftover_snapshots`, `household_exports`, `audit_log` (SELECT/INSERT policies only: append-only).

Identity, membership and outbox tables (`users`, `sessions`, `auth_methods`, `totp_secrets`, `magic_link_tokens`, `households`, `household_users`, `household_invites`, `notifications_outbox`) are read before a household is known and are scoped in the repositories only.

Global, non-tenant tables (no RLS, no `household_id`): `currencies` and `fx_rates` (shared ECB/NBP reference data, written by the worker FX cron, read by `GET /fx-rates`). Currency preferences live on `users` and are user-scoped. The notification outbox claim (`SELECT ... FOR UPDATE SKIP LOCKED` in `DrizzleNotificationRepository`) runs in the worker's system scope on a table without RLS, so it works unchanged under the app role. The weekly digest and period-close jobs read tenant tables in the worker's system scope.

How the app binds the policies (`src/infrastructure/database/`):

- `DbScope` (AsyncLocalStorage): `household` (householdId + userId), `user` (no household yet) or `system` (RLS bypass).
- `DbScopeInterceptor` (global `APP_INTERCEPTOR`) runs every HTTP handler in the scope of `req.user` (JWT). Unauthenticated requests have no scope and see no tenant rows.
- `WorkerDbScopeModule` (worker only) makes `system` the fallback: processors and crons work across households.
- `ScopedPool` wraps the pg pool: every statement outside a transaction runs as `BEGIN; set_config('app.household_id' | 'app.user_id' | 'app.rls_bypass', ..., true); <statement>; COMMIT`, and `db.transaction` gets the same settings after its `BEGIN`. Settings are transaction-local, so nothing leaks between pooled requests.
- Pre-auth code that must read a tenant table uses `runInDbScope({ kind: 'system', reason }, ...)` explicitly, filtering by an id it already trusts (only `DrizzleBankConnectionChecker`, at login).
- `refresh_plan_actuals()` turns the bypass on for the refresh only and restores the caller's value.
- Seed scripts set the bypass on their own connections.

FORCE also binds the owner/migrator role. A future migration that backfills tenant rows must `SELECT set_config('app.rls_bypass', 'on', true);` first.

`audit_log`: `db:roles` revokes `UPDATE, DELETE, TRUNCATE` from the app role, and with no UPDATE/DELETE policy those statements match no row for any role subject to RLS.

### Deploy (Neon / Render), once

1. Merge, let the container apply migration 0008 as the owner (`MIGRATION_DATABASE_URL`).
2. Re-run `pnpm --filter @power-budget/backend db:roles` with `MIGRATION_DATABASE_URL`, `APP_DB_USER`, `APP_DB_PASSWORD` (adds the audit_log REVOKE; idempotent).
3. Make sure Render's `DATABASE_URL` is the app role, not the owner. With the owner URL the app still works (FORCE binds it too), but it can run DDL. A superuser or `BYPASSRLS` URL would silently skip every policy.
4. Check: `SELECT relname FROM pg_class WHERE relforcerowsecurity;` lists the 14 tables above.
