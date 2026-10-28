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

## CLN-050: server-side `categoryId`, `currency` and `source` filters

Same spec, CI size (2 households, 10,000 rows, 3,333 own rows), as the app role under RLS:

| page                                 | buffers     |
| ------------------------------------ | ----------- |
| `categoryId`                         | 1,602-1,671 |
| `categoryId` + `currency` + `mapped` | 1,773       |
| `currency=EUR`                       | 590-604     |
| `source=bank_sync`                   | 576-590     |
| `currency=USD` (no own row)          | 231         |

Before, currency and source were filtered on the client, so a rare currency paged through the whole history (about 200
`GET /transactions` calls at 10k rows, audit PERF-07); the USD case is now one query of 231 buffers. The category filter
reads the category's mappings once (a hashed subplan, written `NOT (id NOT IN (...))`: a plain `IN` became a semi-join
that cost 2.7k-12k buffers). About 900 of its buffers are the `transaction_mappings` RLS subplan per mapping row, which
CLN-051 removes.

## CLN-051: RLS settings read once per statement, `transaction_mappings.household_id`

Same spec, as the app role under RLS. Before = master (fd9ef1e), after = this branch, `EXPLAIN (ANALYZE, BUFFERS)` of
the captured page query, warm.

| page                                 | 1M before | 1M after | CI size before | CI size after |
| ------------------------------------ | --------- | -------- | -------------- | ------------- |
| first page                           | 1,109     | 1,021    | 548            | 447           |
| unmappedOnly                         | 1,284     | 1,000    | 871            | 349           |
| mapped                               | 1,691     | 1,262    | 1,198          | 612           |
| transfers only                       | 1,207     | 1,021    | 565            | 469           |
| no transfers                         | 910       | 816      | 644            | 450           |
| `categoryId`                         | 2,806     | 1,441    | 1,648          | 615           |
| `currency=EUR`                       | 1,082     | 992      | 583            | 444           |
| `source=bank_sync`                   | 1,109     | 1,021    | 548            | 447           |
| `categoryId` + `currency` + `mapped` | 2,610     | 1,245    | 1,750          | 762           |
| `currency=USD` (no own row)          | 313       | 313      | 231            | 231           |
| deep page                            | 900       | 893      | 460            | 282           |

Before, every `transaction_mappings` row read ran the policy's `transactions` lookup (`Filter: (... OR (SubPlan n))`
over `transactions_pkey`, 14 such SubPlans across the 11 plans) and every `transactions` / `transaction_mappings` row
re-evaluated `current_setting(...)`. After, the policy filter is `($0 OR (household_id = $1))` with `$0`/`$1` from
one-time InitPlans, and no RLS SubPlan is left. On master the 1M `categoryId` pages were over the 2,000 budget.
