-- CLN-051 (audit PERF-10): evaluate the RLS session settings once per statement, and give
-- transaction_mappings its own household_id.
--
-- 1. The policies on transactions and transaction_mappings called app_rls_bypass() and
--    app_current_household_id() for every row. Wrapped in (SELECT ...) they become InitPlans,
--    evaluated once per statement. The functions are STABLE and read transaction-local
--    settings, so the result is the same for every row of a statement.
-- 2. The transaction_mappings policy ran an EXISTS lookup on transactions for every mapping
--    row read. The mapping now stores its transaction's household_id (backfilled below) and the
--    policy compares that column. The composite foreign key (transaction_id, household_id) ->
--    transactions (id, household_id) keeps it equal to the transaction's household for every
--    writer, RLS bypass included (foreign keys ignore RLS), so the policy keeps the semantics of
--    the 0008 policy: a mapping is visible only to its transaction's household, and a write
--    needs the transaction and the planned item to be in the caller's household.
--
-- ALTER POLICY keeps each policy's name, command (ALL) and roles (PUBLIC); only the
-- expressions change.
--
-- Rollback (drizzle-kit has no down migrations; run by hand, then delete the journal row):
--   ALTER POLICY tenant_isolation ON transactions / transaction_mappings with the 0017 / 0008
--   expressions; ALTER TABLE transaction_mappings DROP CONSTRAINT
--   transaction_mappings_transaction_household_fk; DROP INDEX transactions_id_household_unique;
--   ALTER TABLE transaction_mappings DROP COLUMN household_id.
ALTER TABLE "transaction_mappings" ADD COLUMN "household_id" uuid;--> statement-breakpoint
-- Backfill from the mapped transaction. FORCE RLS binds the migrator too (runbook
-- db-roles-and-migrations.md), so bypass it for this transaction only.
SELECT set_config('app.rls_bypass', 'on', true);--> statement-breakpoint
UPDATE "transaction_mappings" SET "household_id" = t."household_id"
FROM "transactions" t
WHERE t."id" = "transaction_mappings"."transaction_id";--> statement-breakpoint
SELECT set_config('app.rls_bypass', '', true);--> statement-breakpoint
-- Every mapping has a transaction (transaction_id is the primary key and a foreign key), so
-- no row is left NULL; if one were, this fails and the migration rolls back.
ALTER TABLE "transaction_mappings" ALTER COLUMN "household_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_id_household_unique" ON "transactions" USING btree ("id","household_id");--> statement-breakpoint
ALTER TABLE "transaction_mappings" ADD CONSTRAINT "transaction_mappings_transaction_household_fk" FOREIGN KEY ("transaction_id","household_id") REFERENCES "public"."transactions"("id","household_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Same expressions as migration 0017, with the session settings read once per statement.
ALTER POLICY tenant_isolation ON "transactions"
  USING ((SELECT app_rls_bypass()) OR household_id = (SELECT app_current_household_id()))
  WITH CHECK (
    (SELECT app_rls_bypass())
    OR (
      household_id = (SELECT app_current_household_id())
      AND EXISTS (
        SELECT 1 FROM bank_accounts a
        WHERE a.id = transactions.account_id AND a.household_id = transactions.household_id
      )
      AND (
        transactions.suggested_planned_item_id IS NULL
        OR EXISTS (
          SELECT 1 FROM planned_items p
          WHERE p.id = transactions.suggested_planned_item_id
            AND p.household_id = transactions.household_id
        )
      )
      AND (
        transactions.suggested_category_id IS NULL
        OR EXISTS (
          SELECT 1 FROM categories c
          WHERE c.id = transactions.suggested_category_id
            AND (c.household_id IS NULL OR c.household_id = transactions.household_id)
        )
      )
    )
  );--> statement-breakpoint
-- Migration 0008 read the tenant from the mapped transaction; the column now carries it. A
-- write still needs the transaction and the planned item in the caller's household.
ALTER POLICY tenant_isolation ON "transaction_mappings"
  USING ((SELECT app_rls_bypass()) OR household_id = (SELECT app_current_household_id()))
  WITH CHECK (
    (SELECT app_rls_bypass())
    OR (
      household_id = (SELECT app_current_household_id())
      AND EXISTS (
        SELECT 1 FROM transactions t
        WHERE t.id = transaction_mappings.transaction_id
          AND t.household_id = transaction_mappings.household_id
      )
      AND EXISTS (
        SELECT 1 FROM planned_items p
        WHERE p.id = transaction_mappings.planned_item_id
          AND p.household_id = transaction_mappings.household_id
      )
    )
  );
