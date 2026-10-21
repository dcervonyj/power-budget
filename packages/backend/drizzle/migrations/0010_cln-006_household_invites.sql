-- CLN-006 (audit H7): household invite journey. Invites record inviter, accepter and
-- revocation; the outbox can address an email without an account (invitee not registered).
ALTER TABLE "notifications_outbox" ALTER COLUMN "recipient_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "household_invites" ADD COLUMN "invited_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "household_invites" ADD COLUMN "accepted_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "household_invites" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications_outbox" ADD COLUMN "recipient_email" varchar(320);--> statement-breakpoint
ALTER TABLE "notifications_outbox" ADD COLUMN "recipient_locale" varchar(10);--> statement-breakpoint
ALTER TABLE "household_invites" ADD CONSTRAINT "household_invites_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_invites" ADD CONSTRAINT "household_invites_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- CLN-006: before the one-open-invite-per-household index, revoke every open invite but
-- the newest of its household (invites were never emailed before this release).
UPDATE "household_invites" SET "revoked_at" = now()
WHERE "accepted_at" IS NULL
  AND "id" NOT IN (
    SELECT DISTINCT ON ("household_id") "id" FROM "household_invites"
    WHERE "accepted_at" IS NULL
    ORDER BY "household_id", "created_at" DESC
  );--> statement-breakpoint
CREATE UNIQUE INDEX "household_invites_one_open_unique" ON "household_invites" USING btree ("household_id") WHERE accepted_at IS NULL AND revoked_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_outbox_address_dedupe_unique" ON "notifications_outbox" USING btree ("recipient_email","kind","dedupe_key") WHERE recipient_user_id IS NULL;--> statement-breakpoint
ALTER TABLE "notifications_outbox" ADD CONSTRAINT "notifications_outbox_recipient_check" CHECK (recipient_user_id IS NOT NULL OR recipient_email IS NOT NULL);