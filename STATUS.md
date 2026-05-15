# Power Budget — Build Status Report

> Generated: 2026-05-15  
> Branch: `master` @ `338d9bc`  
> Repo: [dcervonyj/power-budget](https://github.com/dcervonyj/power-budget)

---

## TL;DR

Seven waves of parallel work are merged. The entire **backend domain layer** (5 bounded contexts) and all **core pure-logic** functions are complete. The **frontend scaffolding** (web + mobile + shared-app) is in place. Infrastructure (CI, Drizzle, BullMQ, docker-compose) is wired. **Nothing real is wired end-to-end yet** — the next wave connects domain → application (use cases) → infrastructure (adapters) → HTTP.

---

## What is Done

### Wave 1–3 — Foundation (✅ Complete)

| What                            | Details                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| GitHub repo + branch protection | `master` protected, PR required, secret scanning on                                  |
| pnpm + Turborepo monorepo       | `pnpm-workspace.yaml`, `turbo.json` with `lint / typecheck / test / build` pipelines |
| ESLint + Prettier               | Root config + per-package rules; `no-restricted-imports` for `@power-budget/core`    |
| Docker-compose                  | Postgres 16, Redis 7, Mailpit — `pnpm dev:db:up/down/reset`                          |
| Dependabot                      | Weekly npm bumps, monthly Actions bumps — **all 15 bump PRs merged/closed** ✅       |
| Design tokens                   | CSS variables + RN style tokens (`packages/core/src/domain/`)                        |

### Wave 4 — Package Scaffolds (✅ Complete, PRs #10–19)

| Package                    | PR  | Notes                                                                         |
| -------------------------- | --- | ----------------------------------------------------------------------------- |
| `@power-budget/core`       | #15 | Pure TypeScript, zero runtime deps, ESM+CJS via tsup                          |
| `@power-budget/backend`    | #11 | NestJS, 4-layer folder split (domain/application/infrastructure/presentation) |
| `@power-budget/web`        | #18 | React + Vite, thin UI wrapper                                                 |
| `@power-budget/mobile`     | #19 | React Native + Expo, thin UI wrapper                                          |
| `@power-budget/shared-app` | #12 | Platform-agnostic app logic (MobX ReactiveViews, use cases, API adapters)     |
| GitHub Actions CI          | #10 | `pnpm turbo run lint typecheck test` on every PR                              |

### Wave 5 — Core Types + Routing + MobX (✅ Complete, PRs #30–37)

| Task                            | PR  | What it delivers                                                               |
| ------------------------------- | --- | ------------------------------------------------------------------------------ |
| BE-003 Core branded IDs + Money | #15 | `UserId`, `HouseholdId`, `Money` (bigint minor units), `DateRange`, `IsoDate`  |
| BE-004 Core entity types        | #34 | `User`, `Plan`, `Transaction`, `BankConnection`, `Category`, etc. — types only |
| BE-010 Locale-aware formatters  | #39 | `formatMoney`, `formatDate`, `formatNumber` — Intl-only, 4 locales             |
| INF-008 Drizzle ORM tooling     | #37 | `pnpm db:generate/migrate/reset/studio`, migration scaffolding                 |
| WEB-002 Routing                 | #32 | React Router 6 + protected-route wrapper                                       |
| WEB-003 MobX + ReactiveView     | #36 | `ApiClient`, `AppProviders`, token store                                       |
| MOB-002 React Navigation        | #35 | Native stack + bottom tabs                                                     |
| QA-001 Vitest setup             | #33 | Unit test config for backend + web + CI coverage                               |
| QA-004 Detox ADR                | #31 | ADR-001: defer mobile E2E to v2                                                |

### Wave 6 — Drizzle Schema + Core Pure Logic (✅ Complete, PRs #38–43)

| Task                                      | PR  | What it delivers                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BE-005 Drizzle schema                     | #38 | All **22 MVP tables**: users, households, household_users, bank_connections, bank_accounts, transactions, transaction_mappings, transfers, plans, planned_items, planned_item_versions, categories, category_privacy, fx_rates, sessions, totp_secrets, household_invites, sync_runs, notifications_outbox, audit_log, leftover_snapshots, bank_catalog_cache |
| BE-006 `computePlanActuals`               | #40 | Core dashboard computation — income/expense lines, unplanned totals, bottom-line net                                                                                                                                                                                                                                                                          |
| BE-007 `computeLeftover` + `convertMoney` | #41 | Leftover per item (0-floored); EUR-pivot FX conversion                                                                                                                                                                                                                                                                                                        |
| BE-008 `aggregateByCategoryWithPrivacy`   | #42 | Privacy-aware category aggregation across household members                                                                                                                                                                                                                                                                                                   |
| BE-009 `applyMappingSuggestion`           | #43 | Merchant/description heuristic with Cyrillic support                                                                                                                                                                                                                                                                                                          |

### Wave 7 — Backend Domain Layer (✅ Complete, PRs #44–50)

The entire **backend domain layer** is now in `packages/backend/src/domain/`. Zero NestJS imports, zero I/O — pure TypeScript interfaces and domain services.

#### BE-011 — Auth domain ([PR #45](https://github.com/dcervonyj/power-budget/pull/45))

**Files**: `packages/backend/src/domain/auth/`

- **Entities**: `User`, `NewUser`, `Household`, `HouseholdMembership`, `Session`, `TotpSecret`, `HouseholdInvite`, `RequestContext`
- **Ports**: `UserRepo`, `HouseholdRepo`, `PasswordHashing`, `TotpVerifier`, `OAuthProviderPort`, `RefreshTokenStore`, `TotpSecretRepo`, `HouseholdInviteRepo`
- **Domain service**: `HouseholdInvariants` — enforces MVP single-household constraint + invite expiry/usage checks
- **Tests**: 6 passing (all invariant branches)

#### BE-016 — Bank domain ([PR #48](https://github.com/dcervonyj/power-budget/pull/48))

**Files**: `packages/backend/src/domain/bank/`

- **Entities**: `BankConnection`, `BankAccount`, `RawBankAccount`, `RawTransaction`, `SyncRun`, `BankCatalogEntry`
- **Ports**: `BankConnectorPort` _(the most important seam — GoCardless and Wise hide behind this)_, `BankConnectionRepo`, `SyncRunRepo`, `BankConnectorRegistry`
- **Domain service**: `ConsentExpiryPolicy` — 7-day / 1-day / expired reminder schedule (injected clock)
- **Tests**: 9 passing (all reminder boundary branches)

#### BE-020 — Transactions domain ([PR #47](https://github.com/dcervonyj/power-budget/pull/47))

**Files**: `packages/backend/src/domain/transactions/`

- **Entities**: `Transaction`, `NewTransaction`, `NewManualTransaction`, `TransactionMapping`, `Transfer`, `IngestHashInput`, `Page<T>`
- **Ports**: `TransactionRepo`, `MappingRepo`, `TransferRepo`
- **Domain service**: `IdempotentIngest` — SHA-256 hash fallback (account + date + amount + normalised description) when bank omits `externalId`; Cyrillic normalisation supported
- **Tests**: 9 passing

#### BE-023 — BullMQ infrastructure ([PR #44](https://github.com/dcervonyj/power-budget/pull/44))

**Files**: `packages/backend/src/infrastructure/queue/`, `packages/backend/src/worker/`

- **6 queues**: `bank-sync`, `notification-dispatch`, `outbox-relay`, `period-close`, `ecb-fx`, `refresh-plan-actuals`
- **Retry**: custom exponential backoff: 30s → 2m → 10m → 1h → 6h (5 attempts, then dead-letter)
- **WorkerModule**: NestJS `createApplicationContext` (no HTTP server) — entrypoint `worker.main.ts`
- **QueueModule**: `BullModule.forRootAsync` wired via `ConfigService` / `REDIS_URL`
- **Tests**: 8 passing (all backoff boundary branches)

#### BE-025 — Plans domain ([PR #46](https://github.com/dcervonyj/power-budget/pull/46))

**Files**: `packages/backend/src/domain/plans/`

- **Entities**: `Plan`, `NewPlan`, `PlannedItem`, `NewPlannedItem`, `PlannedItemPatch`, `PlannedItemVersion`, `LeftoverSnapshot`
- **Ports**: `PlanRepo`, `PlannedItemRepo`, `PlannedItemVersionRepo`, `PlanActualsReader`
- **Domain service**: `PlanCloning` — next-period computation for weekly/monthly/custom periods; MVP invariant: ≤1 active plan per `(type, periodKind)` except `custom`
- **Tests**: 9 passing (all period kinds, override, duplicate invariant)

#### BE-027 — Categories domain ([PR #49](https://github.com/dcervonyj/power-budget/pull/49))

**Files**: `packages/backend/src/domain/categories/`

- **Entities**: `Category`, `NewCategory`, `CategoryPatch`, `CategoryPrivacy`
- **Ports**: `CategoryRepo`, `CategoryPrivacyRepo`
- **11 seed categories** with stable `seed_key`, icon, hex color, and names in **en / uk / ru / pl**:
  - Income (3): Salary, Freelance, Other income
  - Expense (8): Housing, Food & Groceries, Transport, Health, Entertainment, Subscriptions, Education, Other
- **Seed script**: `drizzle/seed/0001_seed_categories.ts` — idempotent (`SELECT` before `INSERT`)
- **`pnpm db:seed`** script added to `packages/backend/package.json`
- **Tests**: 5 passing (seed data integrity — count, unique keys, all 4 locales, split, icon/color format)

#### QA-002 — Integration test harness ([PR #50](https://github.com/dcervonyj/power-budget/pull/50))

**Files**: `packages/backend/src/test/integration/`

- **testcontainers** — Postgres 16.4-alpine + Redis 7.4-alpine, started once per suite
- **Drizzle migrations** applied on container start (includes the schema from BE-005)
- **`withRollbackTransaction`** — per-test isolation without truncating tables
- **Fixtures**: `insertTestUser`, `insertTestHousehold`
- **Smoke tests**: user insert, household insert, tenant isolation (user A ≠ user B's household)
- **`pnpm test:integration`** script; separate `tsconfig.integration.json`; excluded from unit test runs

---

## Test Coverage Summary

| Package                          | Spec files | `it()` assertions |
| -------------------------------- | ---------- | ----------------- |
| `@power-budget/core`             | 10         | ~116              |
| `packages/backend` (domain)      | 5          | ~37               |
| `packages/backend` (infra/queue) | 1          | 8                 |
| `packages/backend` (integration) | 1          | 3 smoke tests     |
| **Total**                        | **17**     | **~164**          |

---

## Dependabot Bump PRs (✅ All Resolved)

All 15 Dependabot bump PRs have been processed. The root CI failure was `pnpm/action-setup@v4` detecting a conflict between the explicit `version: 9` in the workflow and `"packageManager": "pnpm@9.15.4"` in `package.json` — fixed by removing `version: 9` from both workflow files.

**Merged (13):** #4, #14, #16, #20, #21, #22, #23, #24, #25, #26, #27, #28, #29

**Closed (2):** #13 and #17 — would have conflicted with the already-merged group PR #14 that covers the same NestJS v11 upgrades.

**Significant upgrades landed:**

| Upgrade                                                               | From | To   |
| --------------------------------------------------------------------- | ---- | ---- |
| NestJS (`@nestjs/core`, `@nestjs/common`, `@nestjs/platform-fastify`) | v10  | v11  |
| Fastify                                                               | v4   | v5   |
| Vite                                                                  | v5   | v6   |
| esbuild                                                               | 0.18 | 0.28 |
| ajv                                                                   | 6    | 8    |
| glob                                                                  | 7    | 10   |
| picomatch                                                             | 2    | 4    |
| `send` (security)                                                     | 0.18 | 0.19 |
| `@xmldom/xmldom` (security)                                           | 0.7  | 0.9  |

---

## What is NOT Done

### Skipped (by decision, not blocker)

| ID              | Why skipped                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------- |
| INF-009/010/011 | Require external accounts (Fly.io, Neon, Upstash, Cloudflare) — provision when ready to deploy |
| INF-013         | Staging env — depends on INF-009/010/011                                                       |
| I18N-004        | Translations uk/ru/pl — content work requiring native review                                   |
| MOB-003/004     | Blocked on BE-038 (OpenAPI) — mobile MobX wiring deferred                                      |

### Wave 8 — Next to implement

These are all **unblocked by completed Wave 7 work** and can be parallelised:

| ID           | Title                                                         | Effort | What it needs                                            |
| ------------ | ------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| **BE-012**   | Auth use cases — register / login / magic link / OAuth / TOTP | L (4d) | Uses BE-011 ports + BE-013 adapters                      |
| **BE-026**   | Plans use cases + REST + audit trail                          | L (5d) | Uses BE-025 + BE-020 ports                               |
| **BE-028**   | FX domain — ECB ingest + `FxRateProvider`                     | L (3d) | Pure; feeds convertMoney                                 |
| **BE-037**   | ESLint `no-repo-without-scope` custom rule                    | S (1d) | Enforces `HouseholdScope` on every repo method           |
| **I18N-005** | Localised email templates                                     | S      | Needs BE-029 (notifications) — can be stubbed            |
| **I18N-006** | Locale-aware formatters across UI                             | S      | Uses BE-010 formatters already done                      |
| **I18N-007** | Localised seed categories                                     | S      | Uses BE-027 SEED_CATEGORIES (already has 4-locale names) |

### Wave 9 — After Wave 8

| ID      | Title                                                               | Blocked by     |
| ------- | ------------------------------------------------------------------- | -------------- |
| BE-013  | Auth infrastructure adapters (Argon2, Redis sessions, Google OAuth) | BE-012         |
| BE-014  | Household domain + invite flow                                      | BE-011, BE-012 |
| BE-021  | Transactions use cases — ingest, manual, map, transfer, bulk        | BE-020, BE-023 |
| SEC-001 | KMS / envelope encryption (consent tokens)                          | BE-016         |
| SEC-006 | Auth rate limiting                                                  | BE-013         |

### Wave 10 — After Wave 9

| ID     | Title                                                    |
| ------ | -------------------------------------------------------- |
| BE-015 | Auth presentation — REST controllers + JWT guards + DTOs |
| BE-022 | Transactions infrastructure + REST                       |
| BE-035 | Audit log API + `AuditLogger` port                       |

### Wave 11–16 — Future

Full bank-sync adapters (GoCardless/Wise), dashboard endpoints, all web/mobile UI screens (auth, plans, transactions, bank connections, dashboard, settings, onboarding), E2E tests, perf gates, deployment.

---

## Architecture Snapshot

```
packages/
├── core/                       ✅ Complete
│   ├── src/domain/             — Branded IDs, Money, all entity types
│   └── src/logic/              — computePlanActuals, computeLeftover,
│                                 convertMoney, aggregateByCategoryWithPrivacy,
│                                 applyMappingSuggestion, formatMoney/Date/Number
│
├── backend/                    ✅ Domain complete; use cases & adapters pending
│   ├── src/domain/
│   │   ├── auth/               — User, Household, Session + 8 ports + HouseholdInvariants
│   │   ├── bank/               — BankConnection, BankConnectorPort + ConsentExpiryPolicy
│   │   ├── transactions/       — Transaction, Mapping, Transfer + IdempotentIngest
│   │   ├── plans/              — Plan, PlannedItem + PlanCloning
│   │   └── categories/         — Category + 11 seed categories (en/uk/ru/pl)
│   ├── src/infrastructure/
│   │   └── queue/              — BullMQ: 6 queues + exponential backoff
│   ├── src/application/        — EMPTY — use cases not yet implemented
│   ├── src/presentation/       — EMPTY — REST controllers not yet implemented
│   ├── src/worker/             — WorkerModule bootstrap
│   ├── src/test/integration/   — testcontainers harness + fixtures
│   └── drizzle/
│       ├── schema.ts           — 22 MVP tables (full schema)
│       ├── migrations/         — 0000 initial + 0001 categories kind column
│       └── seed/               — idempotent category seed script
│
├── shared-app/                 ✅ Scaffold complete; feature modules empty
│   └── src/
│       ├── auth / bank / categories / currency /
│       │   dashboard / notifications / plans / transactions/
│       ├── contract/           — AppRoute discriminated union, NavigationPort
│       └── infrastructure/     — ApiClient stub, storage adapters
│
├── web/                        ✅ Scaffold complete; no feature screens yet
│   └── src/
│       ├── domain/             — re-exports from @power-budget/core
│       ├── application/        — MobX stores (auth token store wired)
│       ├── infrastructure/     — ApiClient, AppProviders
│       └── presentation/       — protected route wrapper; no screens
│
└── mobile/                     ✅ Scaffold complete; no feature screens yet
    └── src/
        ├── domain/ application/ infrastructure/ presentation/
        └── (React Navigation stack + bottom tabs wired)
```

---

## Key Technical Decisions Made

| Decision        | What was decided                                                                    |
| --------------- | ----------------------------------------------------------------------------------- |
| Frontend state  | **MobX** (`mobx-state-tree`-free) + `ReactiveView` pattern — same in web and mobile |
| Code sharing    | `shared-app` package holds all application logic; web/mobile are thin UI wrappers   |
| Backend ORM     | **Drizzle** (schema-first SQL, no magic runtime)                                    |
| Queue           | **BullMQ** over Redis; dedicated `WorkerModule` process                             |
| Money           | `bigint` minor units everywhere; no floats                                          |
| IDs             | Branded `string & { __brand }` types, UUIDv7                                        |
| Auth            | Argon2id passwords, TOTP, Google OAuth, magic links — all behind port interfaces    |
| Bank connectors | GoCardless (PKO BP) + Wise — both behind `BankConnectorPort`                        |
| Mobile E2E      | Deferred to v2 (ADR-001); Playwright for web E2E                                    |
| Locales         | en / uk / ru / pl with ICU MessageFormat (react-intl)                               |

---

## Critical Path to First Usable Feature

The minimum path to an end-to-end "user registers, creates a plan, adds items" flow:

```
BE-012 Auth use cases
  → BE-013 Auth infra adapters
    → BE-014 Household domain
      → BE-015 Auth REST controllers
        → WEB-005 Auth screens
          → First login ✓

BE-026 Plans use cases
  → BE-027 ✅ (done) Categories
    → WEB-008 Plans list + editor
      → First plan ✓
```

Estimated waves to first usable feature: **3 more waves** (Waves 8–10), covering ~8–10 parallel tasks.
