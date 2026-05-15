-- ============================================================
-- RLS Policies — PRODUCTION ONLY, apply manually.
-- DO NOT add to Drizzle meta journal; do NOT run via db:migrate.
-- Dev/test rely on application-level HouseholdScope filtering.
-- RLS is defence-in-depth for production environments.
-- ============================================================

-- Household-scoped tables --

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY household_isolation ON transactions
  USING (household_id = current_setting('app.household_id', true)::uuid);

ALTER TABLE transaction_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY household_isolation ON transaction_mappings
  USING (household_id = current_setting('app.household_id', true)::uuid);

ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY household_isolation ON transfers
  USING (household_id = current_setting('app.household_id', true)::uuid);

ALTER TABLE bank_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY household_isolation ON bank_connections
  USING (household_id = current_setting('app.household_id', true)::uuid);

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY household_isolation ON bank_accounts
  USING (household_id = current_setting('app.household_id', true)::uuid);

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY household_isolation ON plans
  USING (household_id = current_setting('app.household_id', true)::uuid);

ALTER TABLE planned_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY household_isolation ON planned_items
  USING (household_id = current_setting('app.household_id', true)::uuid);

ALTER TABLE planned_item_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY household_isolation ON planned_item_versions
  USING (household_id = current_setting('app.household_id', true)::uuid);

ALTER TABLE leftover_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY household_isolation ON leftover_snapshots
  USING (household_id = current_setting('app.household_id', true)::uuid);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY household_isolation ON categories
  USING (household_id = current_setting('app.household_id', true)::uuid);

ALTER TABLE category_privacy ENABLE ROW LEVEL SECURITY;
CREATE POLICY household_isolation ON category_privacy
  USING (household_id = current_setting('app.household_id', true)::uuid);

ALTER TABLE household_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY household_isolation ON household_invites
  USING (household_id = current_setting('app.household_id', true)::uuid);

ALTER TABLE household_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY household_isolation ON household_users
  USING (household_id = current_setting('app.household_id', true)::uuid);

ALTER TABLE notifications_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY household_isolation ON notifications_outbox
  USING (household_id = current_setting('app.household_id', true)::uuid);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY household_isolation ON audit_log
  USING (household_id = current_setting('app.household_id', true)::uuid);

-- User-scoped tables (no household_id) --

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_isolation ON users
  USING (id = current_setting('app.user_id', true)::uuid);

ALTER TABLE totp_secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_isolation ON totp_secrets
  USING (user_id = current_setting('app.user_id', true)::uuid);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_isolation ON sessions
  USING (user_id = current_setting('app.user_id', true)::uuid);

ALTER TABLE magic_link_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_isolation ON magic_link_tokens
  USING (user_id = current_setting('app.user_id', true)::uuid);
