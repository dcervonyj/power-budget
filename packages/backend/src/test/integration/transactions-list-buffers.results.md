# CLN-048: `GET /transactions` buffers per page on the 1M-row audit fixture

Fixture: `docs/handoff/audit-2610/perf-sql/perf-seed.sql` shape, 200 households x 5,000 transactions = 1,000,000 rows,
3,333 own rows for the measured user. Shared buffers (hit + read) from `EXPLAIN (ANALYZE, BUFFERS)`, warm, run as the
least-privilege app role under RLS, page size 50 (`LIMIT 51`). Postgres 16.4 (testcontainers).

Before = master `list()` (09f9eff), after = this branch, both on the same seeded database in one run. Each seed uses
random transaction ids, so the mapped/unmapped/transfer mix near the top of the list differs per seed. In both seeds
every page of the new query matched master's output item for item (JSON of each item).

| page                                | seed 1 before | seed 1 after | seed 2 before | seed 2 after | committed spec, `PERF_1M=1` |
| ----------------------------------- | ------------- | ------------ | ------------- | ------------ | --------------------------- |
| first page                          | 54,957        | 1,192        | 55,533        | 1,193        | 1,191                       |
| unmappedOnly                        | 26,972        | 1,556        | 26,985        | 1,148        | 1,484                       |
| mapped                              | 49,641        | 1,664        | 50,474        | 1,682        | 1,655                       |
| transfers only                      | 54,957        | 1,263        | 55,533        | 1,235        | 1,235                       |
| no transfers                        | 54,731        | 994          | 55,337        | 980          | 1,008                       |
| deep page (cursor at own row 2,500) | 13,569        | 934          | 13,945        | 983          | 983                         |

Budget: under 2,000 buffers per page (audit SUMMARY, CLN-048). Most of the unmapped/mapped cost is the RLS subplan
that each `transaction_mappings` probe runs (a `transactions` lookup); CLN-051 removes it.

Reproduce the "after" column:

```bash
cd packages/backend
PERF_1M=1 npx vitest run --config src/test/integration/vitest.integration.config.ts transactions-list-buffers --testTimeout 600000
```

The run prints `CLN048 <case> buffers=<n>` per case and fails if any page reads 2,000 buffers or more. Without
`PERF_1M` the spec seeds 2 households (10,000 rows) for CI; on master all 6 cases fail there (7,535-34,781 buffers).
