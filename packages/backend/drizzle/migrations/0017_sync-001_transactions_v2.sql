-- SYNC-001: transactions v2 (plan-banking.md §1.7, §1.10) and the live_signals inbox.
-- transactions.status moves from pending | posted | cancelled (CLN-023) to the bank v2 row
-- lifecycle live | pending | booked | cancelled | expired | manual; direction is generated
-- from the sign of the amount.
CREATE TABLE "live_signals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"source" varchar(20) NOT NULL,
	"dedupe_key" varchar(255) NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload_enc" text NOT NULL,
	"parsed" jsonb,
	"parser_version" varchar(50),
	"state" varchar(20) DEFAULT 'received' NOT NULL,
	"transaction_id" uuid,
	"error" text,
	CONSTRAINT "live_signals_source_check" CHECK (source IN ('wise_webhook', 'pko_email', 'iko_push')),
	CONSTRAINT "live_signals_state_check" CHECK (state IN ('received', 'parsed', 'unparsed', 'applied', 'ignored'))
);
--> statement-breakpoint
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_status_check";--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "status" SET DEFAULT 'booked';--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "booking_date" date;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "value_date" date;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "transaction_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "direction" varchar(10) GENERATED ALWAYS AS (CASE WHEN amount_minor < 0 THEN 'debit' ELSE 'credit' END) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "counterparty_name" varchar(255);--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "counterparty_iban_hash" varchar(128);--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "remittance" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "mcc" varchar(10);--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "bank_tx_code" varchar(100);--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "entry_reference" varchar(255);--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "fingerprint" varchar(128);--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "source_kind" varchar(20);--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "original_amount_minor" bigint;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "original_currency" char(3);--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "reconciliation" jsonb;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "suggested_planned_item_id" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "suggested_category_id" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "suggestion_confidence" numeric(4, 3);--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "suggestion_source" varchar(20);--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "auto_mapped" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Backfill existing rows: bank rows are booked (CLN-023 called it posted; pending and
-- cancelled stay), manual rows are manual. FORCE RLS binds the migrator too (runbook
-- db-roles-and-migrations.md), so bypass it for this transaction only.
SELECT set_config('app.rls_bypass', 'on', true);--> statement-breakpoint
UPDATE "transactions" SET
  "status" = CASE
    WHEN "source" = 'manual' THEN 'manual'
    WHEN "status" = 'posted' THEN 'booked'
    ELSE "status"
  END,
  "source_kind" = CASE WHEN "source" = 'manual' THEN 'manual' ELSE NULL END;--> statement-breakpoint
SELECT set_config('app.rls_bypass', '', true);--> statement-breakpoint
ALTER TABLE "live_signals" ADD CONSTRAINT "live_signals_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_signals" ADD CONSTRAINT "live_signals_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_signals" ADD CONSTRAINT "live_signals_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "live_signals_dedupe_key_unique" ON "live_signals" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "live_signals_household_received_idx" ON "live_signals" USING btree ("household_id","received_at");--> statement-breakpoint
CREATE INDEX "live_signals_state_received_idx" ON "live_signals" USING btree ("state","received_at");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_suggested_planned_item_id_planned_items_id_fk" FOREIGN KEY ("suggested_planned_item_id") REFERENCES "public"."planned_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_suggested_category_id_categories_id_fk" FOREIGN KEY ("suggested_category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transactions_account_status_date_idx" ON "transactions" USING btree ("account_id","status","occurred_on");--> statement-breakpoint
CREATE INDEX "transactions_account_fingerprint_idx" ON "transactions" USING btree ("account_id","fingerprint");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_direction_check" CHECK (direction IN ('credit', 'debit'));--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_source_kind_check" CHECK (source_kind IN ('enable_banking', 'wise_webhook', 'pko_email', 'iko_push', 'manual'));--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_suggestion_source_check" CHECK (suggestion_source IN ('transfer_rule', 'planned_hint', 'merchant_rule', 'llm'));--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_suggestion_confidence_check" CHECK (suggestion_confidence BETWEEN 0 AND 1);--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_original_amount_check" CHECK ((original_amount_minor IS NULL) = (original_currency IS NULL));--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_status_check" CHECK (status IN ('live', 'pending', 'booked', 'cancelled', 'expired', 'manual'));--> statement-breakpoint
-- SYNC-001: household RLS on live_signals (same policy as migration 0008). The app role gets
-- its grants from the default privileges set by drizzle/roles.mjs.
ALTER TABLE "live_signals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "live_signals" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON "live_signals"
  USING (app_rls_bypass() OR household_id = app_current_household_id())
  WITH CHECK (
    app_rls_bypass()
    OR (
      household_id = app_current_household_id()
      -- Foreign keys ignore RLS: the owner must be a member and the transaction must belong
      -- to the same household.
      AND EXISTS (
        SELECT 1 FROM household_users hu
        WHERE hu.household_id = live_signals.household_id AND hu.user_id = live_signals.owner_user_id
      )
      AND (
        live_signals.transaction_id IS NULL
        OR EXISTS (
          SELECT 1 FROM transactions t
          WHERE t.id = live_signals.transaction_id AND t.household_id = live_signals.household_id
        )
      )
    )
  );--> statement-breakpoint
-- transactions now reference planned items and categories (the suggestion): the referenced
-- rows, and the account, must belong to the same household (BNK-003 review, ledger policy).
DROP POLICY tenant_isolation ON "transactions";--> statement-breakpoint
CREATE POLICY tenant_isolation ON "transactions"
  USING (app_rls_bypass() OR household_id = app_current_household_id())
  WITH CHECK (
    app_rls_bypass()
    OR (
      household_id = app_current_household_id()
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
  );
