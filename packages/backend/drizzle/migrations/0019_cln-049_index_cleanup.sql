-- CLN-049 (audit PERF-03, PERF-11, PERF-12): index the dashboard transfer query and the
-- audit log keyset page, and drop duplicate indexes. Each dropped index has an identical
-- unique twin (sessions, invites, transfers) or is the prefix of transactions_household_date_id_idx.
DROP INDEX "household_invites_token_idx";--> statement-breakpoint
DROP INDEX "sessions_token_hash_idx";--> statement-breakpoint
DROP INDEX "transactions_household_date_idx";--> statement-breakpoint
DROP INDEX "transfers_tx_a_idx";--> statement-breakpoint
DROP INDEX "transfers_tx_b_idx";--> statement-breakpoint
CREATE INDEX "audit_log_household_id_idx" ON "audit_log" USING btree ("household_id","id");--> statement-breakpoint
CREATE INDEX "transfers_household_idx" ON "transfers" USING btree ("household_id");