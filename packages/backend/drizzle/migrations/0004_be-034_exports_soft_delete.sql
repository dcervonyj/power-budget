ALTER TABLE "households" ADD COLUMN "deleted_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "delete_scheduled_at" timestamp with time zone;
--> statement-breakpoint
CREATE TABLE "household_exports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"download_url" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "household_exports" ADD CONSTRAINT "household_exports_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "household_exports" ADD CONSTRAINT "household_exports_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "household_exports_household_idx" ON "household_exports" ("household_id");
--> statement-breakpoint
CREATE INDEX "household_exports_status_idx" ON "household_exports" ("status");
