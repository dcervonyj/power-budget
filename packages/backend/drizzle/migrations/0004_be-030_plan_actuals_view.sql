CREATE MATERIALIZED VIEW IF NOT EXISTS v_plan_actuals AS
SELECT
  pi.id          AS planned_item_id,
  pi.plan_id,
  pi.household_id,
  pi.category_id,
  pi.direction,
  pi.amount_minor AS planned_amount_minor,
  pi.currency,
  COALESCE(SUM(tm.amount_minor), 0) AS actual_amount_minor,
  COUNT(tm.transaction_id)::int       AS transaction_count
FROM planned_items pi
LEFT JOIN transaction_mappings tm ON tm.planned_item_id = pi.id
GROUP BY
  pi.id,
  pi.plan_id,
  pi.household_id,
  pi.category_id,
  pi.direction,
  pi.amount_minor,
  pi.currency;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS v_plan_actuals_planned_item_idx ON v_plan_actuals (planned_item_id);
