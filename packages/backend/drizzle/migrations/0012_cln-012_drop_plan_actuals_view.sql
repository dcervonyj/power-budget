-- CLN-012 (audit H22): the dashboard is computed by core computePlanActuals with an
-- FX table, so the never-refreshed materialised view (which ignored transfers,
-- `ignored`, the plan period and currencies) and its refresh function go.
DROP FUNCTION IF EXISTS refresh_plan_actuals();
--> statement-breakpoint
DROP MATERIALIZED VIEW IF EXISTS v_plan_actuals;
