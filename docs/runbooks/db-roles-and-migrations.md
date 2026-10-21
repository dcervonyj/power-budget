# Database roles and migrations (CLN-018)

## Roles

| Role                                      | Env var                  | Can                                                                                                                          | Used by                                                                     |
| ----------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| owner / migrator (`power_budget` locally) | `MIGRATION_DATABASE_URL` | Owns every table, runs DDL, owns the drizzle bookkeeping schema                                                              | `pnpm db:migrate`, `pnpm db:roles`, `drizzle-kit`, container boot migration |
| app (`power_budget_app` locally)          | `DATABASE_URL`           | `SELECT/INSERT/UPDATE/DELETE` on `public`, sequences. No ownership, no DDL, no `TRUNCATE`, no access to the `drizzle` schema | The running API and worker                                                  |

`DATABASE_URL` is what the backend reads at runtime. `drizzle/migrate.mjs` and `drizzle.config.ts` use `MIGRATION_DATABASE_URL` and fall back to `DATABASE_URL`, so a single-role setup keeps working until the roles are split.

The app role is not the table owner, so it is subject to row level security once CLN-005 enables `FORCE`/policies. The owner bypasses RLS unless `FORCE` is set; never hand the owner URL to the running app.

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

## `0003_rls_policies.sql` (CLN-005 hand-off)

The file is deliberately outside the journal (it was written as "prod only, apply manually"), so a normal `db:migrate` never applies it, and the live DB does not have it.

Known defects CLN-005 must fix before applying it:

- `transaction_mappings` has no `household_id` column, so the whole file fails with `42703` (asserted in the integration test). Add the column or derive the policy through `transactions`.
- It sets no `FORCE ROW LEVEL SECURITY`.

How CLN-005 should apply it:

1. Fix the file, then add it as a normal journal entry via `drizzle-kit generate --custom --name=rls_policies` (copy the SQL in; the new idx gets a `when` later than every applied entry, so it runs exactly once on the live DB). Do not reuse the `0003` tag: the journal already has other `0003`-era positions applied.
2. Migrate as the owner role; run the app as `power_budget_app` so policies bind it, and set `app.household_id` / `app.user_id` per transaction with `set_config`.
3. Remove the "unjournaled SQL" exception for `0003_rls_policies` in `__tests__/migrations-hygiene.spec.ts` and the matching assertion in the integration test.
