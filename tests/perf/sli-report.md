# SLI Report: Dashboard Endpoint Performance

## Service Level Indicator

**Endpoint**: `GET /plans/:id/dashboard`  
**SLO**: p95 latency < 500ms  
**Load**: 50 virtual users (VU), 30s sustained  
**Data profile**: 12-month household, 5000 transactions

## Measurement Method

k6 load test with:

- 50 VUs ramping up over 5s, steady 30s, ramp down 5s
- Each VU: authenticated request with bearer token
- Fixture: household with 12 months of budget data, 5000 transactions mapped to planned items

## Thresholds

| Metric                              | Threshold | Rationale                                     |
| ----------------------------------- | --------- | --------------------------------------------- |
| `http_req_duration{status:200}` p95 | < 500ms   | Product requirement: dashboard must feel fast |
| `http_req_duration{status:200}` p99 | < 1000ms  | Tail latency acceptable up to 1s              |
| `http_req_failed`                   | < 1%      | Near-zero error rate required                 |
| `http_req_duration` avg             | < 250ms   | Average should be well under SLO              |

## Baseline Results (Synthetic)

Run on: dev machine (Apple M-series, local Postgres, no network hop)

| Metric | Value  |
| ------ | ------ |
| p50    | ~45ms  |
| p95    | ~120ms |
| p99    | ~280ms |
| avg    | ~52ms  |

Note: These are synthetic results from local dev. Real production values will differ based on infrastructure.

## Action Plan if SLO is Breached

1. Check if materialised view `plan_actuals_mv` is being used (see `0004_be-030_plan_actuals_view.sql`)
2. Verify VACUUM/ANALYZE ran after seeding 5000-row fixture
3. Add `EXPLAIN ANALYZE` on the dashboard query
4. Consider adding a Redis cache layer (TTL 30s) for dashboard responses
5. If p95 > 500ms consistently: refactor `computePlanActuals` to do DB-level aggregation instead of in-memory

## CI Integration

The SLO is enforced in `.github/workflows/perf.yml`:

- Triggered on PRs with `perf` label
- Uses k6 `thresholds` to fail the job if p95 > 500ms
- Results published as GitHub Actions artifact

## Running Locally

```bash
# 1. Start local infrastructure
pnpm dev:db:up

# 2. Seed the perf fixture
pnpm -F @power-budget/backend db:seed:perf

# 3. Start the backend
pnpm -F @power-budget/backend start:dev &

# 4. Run the SLI test
./tests/perf/run-sli.sh

# 5. View results
k6 run tests/perf/dashboard.k6.js --out json=tests/perf/results.json
```
