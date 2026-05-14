CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid,
	"actor_user_id" uuid,
	"action" varchar(100) NOT NULL,
	"subject_type" varchar(100) NOT NULL,
	"subject_id" uuid NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"context" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_methods" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" varchar(20) NOT NULL,
	"provider_subject" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"iban" varchar(34),
	"currency" char(3) NOT NULL,
	"balance_minor" bigint DEFAULT 0 NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_connections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(30) NOT NULL,
	"bank_id" varchar(100) NOT NULL,
	"external_consent_ref" varchar(255),
	"encrypted_consent" text,
	"expires_at" timestamp with time zone,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"disconnected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid,
	"seed_key" varchar(100),
	"name" varchar(100) NOT NULL,
	"icon" varchar(100) DEFAULT 'tag' NOT NULL,
	"color" varchar(20) DEFAULT '#6B7280' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category_privacy" (
	"category_id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"level" varchar(30) DEFAULT 'full_detail' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "currencies" (
	"code" char(3) PRIMARY KEY NOT NULL,
	"exponent" integer DEFAULT 2 NOT NULL,
	"symbol" varchar(10) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fx_rates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"base" char(3) NOT NULL,
	"quote" char(3) NOT NULL,
	"rate_on_date" date NOT NULL,
	"rate" numeric(24, 10) NOT NULL,
	"source" varchar(20) DEFAULT 'ecb' NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_invites" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"email" varchar(320) NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_users" (
	"household_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(20) DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "household_users_household_id_user_id_pk" PRIMARY KEY("household_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "households" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"base_currency" char(3) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leftover_snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"plan_id" uuid,
	"period_end" date NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications_outbox" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid,
	"recipient_user_id" uuid NOT NULL,
	"kind" varchar(50) NOT NULL,
	"dedupe_key" varchar(255) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planned_item_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"planned_item_id" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"before" jsonb,
	"after" jsonb NOT NULL,
	"changed_by" uuid NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "planned_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"plan_id" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"direction" varchar(10) NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"owner_user_id" uuid,
	"name" varchar(255) NOT NULL,
	"type" varchar(20) NOT NULL,
	"period_kind" varchar(20) NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"base_currency" char(3) NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"refresh_token_hash" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "totp_secrets" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"encrypted_secret" text NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_mappings" (
	"transaction_id" uuid PRIMARY KEY NOT NULL,
	"planned_item_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"mapped_by" uuid NOT NULL,
	"mapped_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"external_id" varchar(255),
	"occurred_on" date NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"merchant" varchar(255),
	"source" varchar(20) DEFAULT 'bank_sync' NOT NULL,
	"ignored" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"tx_a_id" uuid NOT NULL,
	"tx_b_id" uuid,
	"marked_by" uuid NOT NULL,
	"marked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"display_name" varchar(255) DEFAULT '' NOT NULL,
	"locale_preference" varchar(10),
	"default_locale" varchar(10) DEFAULT 'en' NOT NULL,
	"password_hash" text,
	"email_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_methods" ADD CONSTRAINT "auth_methods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_connection_id_bank_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."bank_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_connections" ADD CONSTRAINT "bank_connections_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_connections" ADD CONSTRAINT "bank_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_privacy" ADD CONSTRAINT "category_privacy_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_privacy" ADD CONSTRAINT "category_privacy_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_privacy" ADD CONSTRAINT "category_privacy_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_invites" ADD CONSTRAINT "household_invites_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_users" ADD CONSTRAINT "household_users_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_users" ADD CONSTRAINT "household_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leftover_snapshots" ADD CONSTRAINT "leftover_snapshots_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leftover_snapshots" ADD CONSTRAINT "leftover_snapshots_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications_outbox" ADD CONSTRAINT "notifications_outbox_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications_outbox" ADD CONSTRAINT "notifications_outbox_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_item_versions" ADD CONSTRAINT "planned_item_versions_planned_item_id_planned_items_id_fk" FOREIGN KEY ("planned_item_id") REFERENCES "public"."planned_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_item_versions" ADD CONSTRAINT "planned_item_versions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_item_versions" ADD CONSTRAINT "planned_item_versions_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_items" ADD CONSTRAINT "planned_items_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_items" ADD CONSTRAINT "planned_items_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "totp_secrets" ADD CONSTRAINT "totp_secrets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_mappings" ADD CONSTRAINT "transaction_mappings_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_mappings" ADD CONSTRAINT "transaction_mappings_mapped_by_users_id_fk" FOREIGN KEY ("mapped_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_bank_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_tx_a_id_transactions_id_fk" FOREIGN KEY ("tx_a_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_tx_b_id_transactions_id_fk" FOREIGN KEY ("tx_b_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_marked_by_users_id_fk" FOREIGN KEY ("marked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_household_at_idx" ON "audit_log" USING btree ("household_id","at");--> statement-breakpoint
CREATE INDEX "audit_log_subject_idx" ON "audit_log" USING btree ("subject_type","subject_id","at");--> statement-breakpoint
CREATE INDEX "auth_methods_user_idx" ON "auth_methods" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_methods_google_unique" ON "auth_methods" USING btree ("kind","provider_subject") WHERE kind = 'google';--> statement-breakpoint
CREATE INDEX "bank_accounts_connection_idx" ON "bank_accounts" USING btree ("connection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_accounts_external_unique" ON "bank_accounts" USING btree ("connection_id","external_id");--> statement-breakpoint
CREATE INDEX "bank_connections_household_idx" ON "bank_connections" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "bank_connections_user_status_idx" ON "bank_connections" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_connections_consent_ref_unique" ON "bank_connections" USING btree ("user_id","external_consent_ref");--> statement-breakpoint
CREATE INDEX "categories_household_idx" ON "categories" USING btree ("household_id");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_name_active_unique" ON "categories" USING btree ("household_id","name") WHERE archived_at IS NULL;--> statement-breakpoint
CREATE INDEX "fx_rates_date_idx" ON "fx_rates" USING btree ("rate_on_date","base","quote");--> statement-breakpoint
CREATE UNIQUE INDEX "fx_rates_base_quote_date_unique" ON "fx_rates" USING btree ("base","quote","rate_on_date");--> statement-breakpoint
CREATE INDEX "household_invites_token_idx" ON "household_invites" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "household_invites_token_unique" ON "household_invites" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "household_users_user_idx" ON "household_users" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "leftover_snapshots_household_period_idx" ON "leftover_snapshots" USING btree ("household_id","period_end");--> statement-breakpoint
CREATE UNIQUE INDEX "leftover_snapshots_unique" ON "leftover_snapshots" USING btree ("household_id","plan_id","period_end");--> statement-breakpoint
CREATE INDEX "notifications_outbox_dispatch_idx" ON "notifications_outbox" USING btree ("sent_at","created_at");--> statement-breakpoint
CREATE INDEX "notifications_outbox_recipient_idx" ON "notifications_outbox" USING btree ("recipient_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_outbox_dedupe_unique" ON "notifications_outbox" USING btree ("recipient_user_id","kind","dedupe_key");--> statement-breakpoint
CREATE INDEX "planned_item_versions_item_changed_idx" ON "planned_item_versions" USING btree ("planned_item_id","changed_at");--> statement-breakpoint
CREATE INDEX "planned_items_plan_idx" ON "planned_items" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "planned_items_category_idx" ON "planned_items" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "plans_household_period_idx" ON "plans" USING btree ("household_id","period_start","period_end");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_token_hash_idx" ON "sessions" USING btree ("refresh_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("refresh_token_hash");--> statement-breakpoint
CREATE INDEX "mappings_planned_item_idx" ON "transaction_mappings" USING btree ("planned_item_id");--> statement-breakpoint
CREATE INDEX "transactions_household_date_idx" ON "transactions" USING btree ("household_id","occurred_on");--> statement-breakpoint
CREATE INDEX "transactions_account_date_idx" ON "transactions" USING btree ("account_id","occurred_on");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_external_unique" ON "transactions" USING btree ("account_id","external_id") WHERE external_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "transfers_tx_a_idx" ON "transfers" USING btree ("tx_a_id");--> statement-breakpoint
CREATE INDEX "transfers_tx_b_idx" ON "transfers" USING btree ("tx_b_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transfers_tx_a_unique" ON "transfers" USING btree ("tx_a_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transfers_tx_b_unique" ON "transfers" USING btree ("tx_b_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));