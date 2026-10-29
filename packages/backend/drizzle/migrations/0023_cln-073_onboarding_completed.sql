ALTER TABLE "users" ADD COLUMN "onboarding_completed_at" timestamp with time zone;
--> statement-breakpoint
-- Users that exist before onboarding became mandatory (CLN-073) count as completed.
UPDATE "users" SET "onboarding_completed_at" = "created_at";
