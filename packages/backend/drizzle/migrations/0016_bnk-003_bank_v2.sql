CREATE TABLE "bank_fetch_ledger" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"call_kind" varchar(20) NOT NULL,
	"attended" boolean DEFAULT false NOT NULL,
	"http_status" integer,
	"error_code" varchar(100),
	"sync_run_id" uuid,
	CONSTRAINT "bank_fetch_ledger_call_kind_check" CHECK (call_kind IN ('transactions', 'balances', 'details'))
);
--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD COLUMN "identification_hash" varchar(128);--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD COLUMN "provider_account_uid" varchar(255);--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD COLUMN "secondary_connection_id" uuid;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD COLUMN "last_booked_sync_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD COLUMN "last_attended_sync_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD COLUMN "last_live_signal_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD COLUMN "balance_as_of" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD COLUMN "balance_type" varchar(20);--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD COLUMN "cooldown_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD COLUMN "wise_balance_id" varchar(100);--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD COLUMN "card_hints" jsonb;--> statement-breakpoint
ALTER TABLE "bank_connections" ADD COLUMN "provider_session_id" varchar(255);--> statement-breakpoint
ALTER TABLE "bank_connections" ADD COLUMN "aspsp_name" varchar(100);--> statement-breakpoint
ALTER TABLE "bank_connections" ADD COLUMN "aspsp_country" char(2);--> statement-breakpoint
ALTER TABLE "bank_connections" ADD COLUMN "psu_type" varchar(20);--> statement-breakpoint
ALTER TABLE "bank_connections" ADD COLUMN "last_status_check_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bank_connections" ADD COLUMN "last_error_code" varchar(100);--> statement-breakpoint
ALTER TABLE "bank_connections" ADD COLUMN "reauth_required_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD COLUMN "trigger" varchar(20) DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD COLUMN "attended" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD COLUMN "fetched" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD COLUMN "inserted" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD COLUMN "upgraded" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD COLUMN "cancelled" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD COLUMN "error_code" varchar(100);--> statement-breakpoint
ALTER TABLE "bank_fetch_ledger" ADD CONSTRAINT "bank_fetch_ledger_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_fetch_ledger" ADD CONSTRAINT "bank_fetch_ledger_account_id_bank_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_fetch_ledger" ADD CONSTRAINT "bank_fetch_ledger_connection_id_bank_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."bank_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_fetch_ledger" ADD CONSTRAINT "bank_fetch_ledger_sync_run_id_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."sync_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bank_fetch_ledger_account_at_idx" ON "bank_fetch_ledger" USING btree ("account_id","at");--> statement-breakpoint
CREATE INDEX "bank_fetch_ledger_household_idx" ON "bank_fetch_ledger" USING btree ("household_id");--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_secondary_connection_id_bank_connections_id_fk" FOREIGN KEY ("secondary_connection_id") REFERENCES "public"."bank_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bank_accounts_identification_hash_unique" ON "bank_accounts" USING btree ("household_id","identification_hash");--> statement-breakpoint
-- BNK-003: household RLS on the new ledger table (same policy as migration 0008). The
-- app role gets its grants from the default privileges set by drizzle/roles.mjs.
ALTER TABLE "bank_fetch_ledger" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bank_fetch_ledger" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON "bank_fetch_ledger"
  USING (app_rls_bypass() OR household_id = app_current_household_id())
  WITH CHECK (
    app_rls_bypass()
    OR (
      household_id = app_current_household_id()
      -- Foreign keys ignore RLS: the referenced rows must belong to the same household.
      AND EXISTS (
        SELECT 1 FROM bank_accounts a
        WHERE a.id = bank_fetch_ledger.account_id AND a.household_id = bank_fetch_ledger.household_id
      )
      AND EXISTS (
        SELECT 1 FROM bank_connections c
        WHERE c.id = bank_fetch_ledger.connection_id AND c.household_id = bank_fetch_ledger.household_id
      )
      AND (
        bank_fetch_ledger.sync_run_id IS NULL
        OR EXISTS (
          SELECT 1 FROM sync_runs r
          JOIN bank_connections rc ON rc.id = r.connection_id
          WHERE r.id = bank_fetch_ledger.sync_run_id AND rc.household_id = bank_fetch_ledger.household_id
        )
      )
    )
  );
