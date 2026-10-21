-- CLN-005: row level security on the tenant data tables (replaces the never-applied,
-- unjournaled 0003_rls_policies.sql).
--
-- The app sets three transaction-local settings with set_config(name, value, true)
-- at the start of every transaction (src/infrastructure/database/ScopedPool.ts):
--   app.household_id  the caller's household ('' when none)
--   app.user_id       the caller's user ('' when none)
--   app.rls_bypass    'on' only for cross-tenant system code (worker jobs, pre-auth lookups)
-- A statement without these settings sees no tenant rows and cannot write any.
--
-- FORCE makes the policies apply to the table owner too. Superusers and roles with
-- BYPASSRLS are never subject to RLS.
--
-- Identity, membership and outbox tables (users, sessions, auth_methods, totp_secrets,
-- magic_link_tokens, households, household_users, household_invites,
-- notifications_outbox) are read before a household is known (login, magic link,
-- invite accept, outbox relay) and stay scoped in the repositories only.

CREATE OR REPLACE FUNCTION app_current_household_id() RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('app.household_id', true), '')::uuid $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_rls_bypass() RETURNS boolean
LANGUAGE sql STABLE
AS $$ SELECT coalesce(current_setting('app.rls_bypass', true), '') = 'on' $$;
--> statement-breakpoint

-- Tables with a NOT NULL household_id.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'transactions',
    'transfers',
    'bank_connections',
    'bank_accounts',
    'plans',
    'planned_items',
    'planned_item_versions',
    'category_privacy',
    'leftover_snapshots',
    'household_exports'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I '
      'USING (app_rls_bypass() OR household_id = app_current_household_id()) '
      'WITH CHECK (app_rls_bypass() OR household_id = app_current_household_id())',
      t
    );
  END LOOP;
END
$$;
--> statement-breakpoint

-- Categories: NULL household_id rows are the shared seed catalogue, readable by every
-- household, writable only by system code.
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE categories FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON categories
  USING (app_rls_bypass() OR household_id IS NULL OR household_id = app_current_household_id())
  WITH CHECK (app_rls_bypass() OR household_id = app_current_household_id());
--> statement-breakpoint

-- transaction_mappings has no household_id (the 0003 defect): derive the tenant from the
-- mapped transaction, and require the planned item to be in the same household.
ALTER TABLE transaction_mappings ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE transaction_mappings FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON transaction_mappings
  USING (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.id = transaction_mappings.transaction_id
        AND t.household_id = app_current_household_id()
    )
  )
  WITH CHECK (
    app_rls_bypass()
    OR (
      EXISTS (
        SELECT 1 FROM transactions t
        WHERE t.id = transaction_mappings.transaction_id
          AND t.household_id = app_current_household_id()
      )
      AND EXISTS (
        SELECT 1 FROM planned_items p
        WHERE p.id = transaction_mappings.planned_item_id
          AND p.household_id = app_current_household_id()
      )
    )
  );
--> statement-breakpoint

-- sync_runs has no household_id: derive it from the bank connection.
ALTER TABLE sync_runs ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE sync_runs FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON sync_runs
  USING (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM bank_connections c
      WHERE c.id = sync_runs.connection_id
        AND c.household_id = app_current_household_id()
    )
  )
  WITH CHECK (
    app_rls_bypass()
    OR EXISTS (
      SELECT 1 FROM bank_connections c
      WHERE c.id = sync_runs.connection_id
        AND c.household_id = app_current_household_id()
    )
  );
--> statement-breakpoint

-- audit_log is append-only: SELECT and INSERT policies only, so UPDATE and DELETE match no
-- row for any role subject to RLS. The app role also loses the UPDATE/DELETE grants
-- (drizzle/roles.mjs).
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_read ON audit_log FOR SELECT
  USING (app_rls_bypass() OR household_id = app_current_household_id());
--> statement-breakpoint
CREATE POLICY tenant_append ON audit_log FOR INSERT
  WITH CHECK (app_rls_bypass() OR household_id = app_current_household_id());
--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM PUBLIC;
--> statement-breakpoint

-- The plan-actuals refresh reads every household (the view is filtered by the readers).
-- It runs as the owner, which FORCE now subjects to RLS, so it turns the bypass on for the
-- refresh and restores the caller's value afterwards. (ALTER FUNCTION ... SET of a custom
-- setting needs superuser, which the Neon owner is not.)
CREATE OR REPLACE FUNCTION refresh_plan_actuals() RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  previous text := coalesce(current_setting('app.rls_bypass', true), '');
BEGIN
  PERFORM set_config('app.rls_bypass', 'on', true);
  REFRESH MATERIALIZED VIEW CONCURRENTLY v_plan_actuals;
  PERFORM set_config('app.rls_bypass', previous, true);
END;
$$;
