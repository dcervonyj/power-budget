CREATE TABLE "merchant_rules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"owner_user_id" uuid,
	"match_kind" varchar(30) NOT NULL,
	"pattern" varchar(255) NOT NULL,
	"category_id" uuid NOT NULL,
	"plan_kind_pref" varchar(20),
	"always_ask" boolean DEFAULT false NOT NULL,
	"hits" integer DEFAULT 0 NOT NULL,
	"last_hit_at" timestamp with time zone,
	"created_from_tx" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merchant_rules_match_kind_check" CHECK (match_kind IN ('merchant', 'counterparty_iban_hash', 'descriptor_regex')),
	CONSTRAINT "merchant_rules_plan_kind_pref_check" CHECK (plan_kind_pref IS NULL OR plan_kind_pref IN ('personal', 'household')),
	CONSTRAINT "merchant_rules_hits_check" CHECK (hits >= 0)
);
--> statement-breakpoint
ALTER TABLE "merchant_rules" ADD CONSTRAINT "merchant_rules_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_rules" ADD CONSTRAINT "merchant_rules_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_rules" ADD CONSTRAINT "merchant_rules_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_rules" ADD CONSTRAINT "merchant_rules_created_from_tx_transactions_id_fk" FOREIGN KEY ("created_from_tx") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_rules" ADD CONSTRAINT "merchant_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_rules_key_unique" ON "merchant_rules" USING btree ("household_id","owner_user_id","match_kind","pattern");--> statement-breakpoint
CREATE INDEX "merchant_rules_household_idx" ON "merchant_rules" USING btree ("household_id");--> statement-breakpoint
-- AI-003: household RLS on merchant_rules (same policy as migration 0008, with the CLN-051
-- InitPlan form). The app role gets its grants from the default privileges set by
-- drizzle/roles.mjs (re-run `db:roles` on a live database).
ALTER TABLE "merchant_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "merchant_rules" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON "merchant_rules"
  USING ((SELECT app_rls_bypass()) OR household_id = (SELECT app_current_household_id()))
  WITH CHECK (
    (SELECT app_rls_bypass())
    OR (
      household_id = (SELECT app_current_household_id())
      -- Foreign keys ignore RLS: the owner and the author must be members, the category must
      -- be a seed category or the household's own, and the source transaction must belong to
      -- the same household.
      AND (
        merchant_rules.owner_user_id IS NULL
        OR EXISTS (
          SELECT 1 FROM household_users hu
          WHERE hu.household_id = merchant_rules.household_id AND hu.user_id = merchant_rules.owner_user_id
        )
      )
      AND EXISTS (
        SELECT 1 FROM household_users hu
        WHERE hu.household_id = merchant_rules.household_id AND hu.user_id = merchant_rules.created_by
      )
      AND EXISTS (
        SELECT 1 FROM categories c
        WHERE c.id = merchant_rules.category_id
          AND (c.household_id IS NULL OR c.household_id = merchant_rules.household_id)
      )
      AND (
        merchant_rules.created_from_tx IS NULL
        OR EXISTS (
          SELECT 1 FROM transactions t
          WHERE t.id = merchant_rules.created_from_tx AND t.household_id = merchant_rules.household_id
        )
      )
    )
  );
