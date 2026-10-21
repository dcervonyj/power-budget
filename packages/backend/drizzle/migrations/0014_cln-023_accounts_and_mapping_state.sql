-- CLN-023: transaction list read model and accounts API.
-- bank_accounts: an owner (accounts are private to the owning user, PRODUCT 4.9) and a kind;
-- manual (cash) accounts have no connection. transactions.status: pending | posted | cancelled.
-- transaction_mappings.source: who decided the mapping (manual | rule | ai).
ALTER TABLE "bank_accounts" ALTER COLUMN "connection_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bank_accounts" ALTER COLUMN "external_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD COLUMN "kind" varchar(20) DEFAULT 'bank' NOT NULL;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD COLUMN "owner_user_id" uuid;--> statement-breakpoint
-- Backfill the owner from the connection. FORCE RLS binds the migrator too (runbook
-- db-roles-and-migrations.md), so bypass it for this transaction only.
SELECT set_config('app.rls_bypass', 'on', true);--> statement-breakpoint
UPDATE "bank_accounts" SET "owner_user_id" = bc."user_id"
FROM "bank_connections" bc
WHERE bc."id" = "bank_accounts"."connection_id";--> statement-breakpoint
SELECT set_config('app.rls_bypass', '', true);--> statement-breakpoint
ALTER TABLE "bank_accounts" ALTER COLUMN "owner_user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "transaction_mappings" ADD COLUMN "source" varchar(20) DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "status" varchar(20) DEFAULT 'posted' NOT NULL;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bank_accounts_household_owner_idx" ON "bank_accounts" USING btree ("household_id","owner_user_id");--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_kind_check" CHECK ((kind = 'bank' AND connection_id IS NOT NULL AND external_id IS NOT NULL) OR (kind = 'manual' AND connection_id IS NULL));--> statement-breakpoint
ALTER TABLE "transaction_mappings" ADD CONSTRAINT "transaction_mappings_source_check" CHECK (source IN ('manual', 'rule', 'ai'));--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_status_check" CHECK (status IN ('pending', 'posted', 'cancelled'));