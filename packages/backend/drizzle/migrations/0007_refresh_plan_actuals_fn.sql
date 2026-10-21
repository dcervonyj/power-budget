-- CLN-018: the app role has no table ownership, but REFRESH MATERIALIZED VIEW
-- requires it. Expose the refresh as a SECURITY DEFINER function owned by the
-- migrator/owner role so the least-privilege app role can still trigger it.
CREATE OR REPLACE FUNCTION refresh_plan_actuals() RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY v_plan_actuals;
END;
$$;
