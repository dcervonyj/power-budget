ALTER TABLE "users" ADD COLUMN "base_currency" char(3);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "timezone" varchar(64) DEFAULT 'UTC' NOT NULL;