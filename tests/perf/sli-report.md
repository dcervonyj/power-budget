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

## GET /transactions gate (CLN-060)

`dashboard.k6.js` also gates `GET /transactions` (first page of 50, and `unmappedOnly`) when it
runs with `K6_EMAIL` / `K6_PASSWORD`: the user from `pnpm -F @power-budget/backend db:seed:k6`
(5,000 transactions with the SYNC-001 v2 columns, 70% mapped, 2 years of dates). CI always runs it.

Threshold: p95 < 150 ms (`K6_TRANSACTIONS_P95_MS` overrides), p99 < 800 ms. Measured locally
(docker Postgres 16 / Redis 7, backend from `scripts/e2e-backend.sh`, k6 1.3.0, 5 VUs, 20 s,
3 runs): first page p95 13.3-15.0 ms, `unmappedOnly` p95 15.7-17.6 ms, dashboard p95 14.8-15.5 ms.
150 ms is about 9x the local figure: room for a shared 2-vCPU runner running the API, the worker
and Postgres next to k6, tight enough to catch a plan regression on 5,000 rows (PERF-01/PERF-03
scale with history). Tighten once the CI history (artifact `k6-results`) has ~10 runs.

Each CI run appends its p95 values to `perf-history/history.jsonl` (restored from the Actions
cache, saved again, and uploaded as the `k6-history` artifact); the job summary shows the last 10.
