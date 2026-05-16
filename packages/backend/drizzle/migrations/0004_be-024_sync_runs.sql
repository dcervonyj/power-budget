CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"connection_id" uuid NOT NULL,
	"account_id" uuid,
	"status" varchar(20) DEFAULT 'running' NOT NULL,
	"last_successful_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_connection_id_bank_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "bank_connections"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_account_id_bank_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "bank_accounts"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "sync_runs_connection_idx" ON "sync_runs" ("connection_id");
--> statement-breakpoint
CREATE INDEX "sync_runs_status_idx" ON "sync_runs" ("status");
