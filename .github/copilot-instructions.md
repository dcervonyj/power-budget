# Power Budget — Agent Instructions

## Project status

The monorepo scaffold is complete (INF-002 ✅). Conventions documented here are authoritative from `docs/mvp/ARCHITECTURE.md`; code must be written to match them from day one.

## Commands

```bash
pnpm install                          # install all workspace dependencies
pnpm build                            # turbo run build (all packages)
pnpm dev                              # turbo run dev
pnpm lint                             # turbo run lint
pnpm typecheck                        # turbo run typecheck  (alias: pnpm -r typecheck)
pnpm test                             # turbo run test
pnpm clean                            # turbo run clean

# Single package
pnpm -F @power-budget/core build
pnpm -F @power-budget/core typecheck
pnpm -F @power-budget/core lint

# Single test file (Vitest assumed)
pnpm -F @power-budget/core test -- --testPathPattern=money.spec.ts

# Local infrastructure
pnpm dev:db:up                        # docker compose up --wait (Postgres + Redis + Mailpit)
pnpm dev:db:down
pnpm dev:db:reset                     # nuke + recreate volumes
```

Turborepo respects `dependsOn` topology: `core` builds before `backend`, `web`, `mobile`.

## Monorepo layout

```
power-budget/
├── packages/
│   ├── core/        (@power-budget/core)   — shared pure TypeScript
│   ├── backend/     (@power-budget/backend) — NestJS API + BullMQ worker
│   ├── web/         (@power-budget/web)     — React + Vite
│   └── mobile/      (@power-budget/mobile)  — React Native + Expo
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

Each client package communicates with the backend over HTTP only; `web` and `mobile` may never import from `backend/`.

## Clean architecture layers

Every package (backend, web, mobile) uses the same four-layer split:

```
domain/ → application/ → infrastructure/ → presentation/
```

The dependency arrow is strictly inward. `domain/` and `@power-budget/core` must never import from any outer layer, any framework, or any I/O library.

Backend layer responsibilities:
- **domain/** — entities, value objects, port interfaces, domain services (pure TS, no I/O)
- **application/** — use cases (depend on ports only; one use case per meaningful action)
- **infrastructure/** — Drizzle repos, GoCardless/Wise adapters, Redis, SMTP, ECB adapters
- **presentation/** — NestJS controllers, DTOs, guards

Frontend (web/mobile) layer responsibilities:
- **domain/** — re-exports from `@power-budget/core`
- **application/** — RTK slices + RTK Query endpoints
- **infrastructure/** — API client, localStorage/SecureStore adapters, i18n loader
- **presentation/** — screens, components

## `@power-budget/core` hard rules

This package is consumed by backend, web, and mobile. It **must stay pure**:

- **No imports of**: `react`, `@nestjs/*`, `drizzle-orm`, `axios`, `fs`, `crypto` (Node-specific), DOM types, React Native types
- **No I/O**, no `Date.now()` inside pure functions (pass a clock explicitly), no singletons, no global state
- `dependencies: {}` in `package.json` — enforced by ESLint `no-restricted-imports` + a CI negative-fixture test
- Ships ESM (`.mjs`) + CJS (`.cjs`) + `.d.ts` via `tsup`

## Naming conventions

**No `I` prefix on interfaces.** The interface is the canonical name; the implementation gets a tech prefix:

```ts
// Port (interface in domain layer)
export interface TransactionRepo { ... }
export interface BankConnectorPort { ... }
export interface FxRateProvider { ... }

// Adapter (implementation in infrastructure layer)
export class DrizzleTransactionRepo implements TransactionRepo { ... }
export class GoCardlessBankConnector implements BankConnectorPort { ... }
export class EcbFxRateProvider implements FxRateProvider { ... }
```

Use case classes: `RegisterUser`, `LoginWithPassword`, `MapTransaction`, `GetPlanDashboard` (verb-noun, no "UseCase" suffix).

## Branded ID types

Every entity ID is a branded string — never a plain `string`. IDs use UUIDv7 (time-ordered).

```ts
type Brand<T, B extends string> = T & { readonly __brand: B };
type UserId = Brand<string, 'UserId'>;
type HouseholdId = Brand<string, 'HouseholdId'>;
// etc.
```

Exhaustive switches over discriminated unions are mandatory; TypeScript's `never` check must be satisfied.

## Money arithmetic

`Money` is `{ amountMinor: bigint; currency: CurrencyCode }`. **No floats anywhere.** All amounts stored as minor units (e.g. cents). Cross-currency arithmetic throws `CurrencyMismatchError`.

```ts
Money.add(a, b)        // throws if currencies differ
Money.multiply(m, 2n)  // bigint multiplier
Money.compare(a, b)    // -1 | 0 | 1
```

FX conversion always uses a `FxRateTable` snapshot passed in explicitly — never fetched inside pure functions.

## Multi-tenancy via `HouseholdScope`

Every repo method takes `HouseholdScope = { householdId: HouseholdId }` as a parameter and includes `WHERE household_id = $scope.householdId`. An ESLint rule (`no-repo-without-scope`) enforces this. Postgres RLS is also enabled in prod as defence-in-depth.

## TypeScript strictness

`tsconfig.base.json` enforces: `strict: true`, `noUncheckedIndexedAccess: true`. No `experimentalDecorators`. NestJS providers are explicitly wired — no decorator-only autowiring of fields.

Formatting (`.prettierrc`): `singleQuote`, `trailingComma: "all"`, `printWidth: 100`, `semi: true`, `arrowParens: "always"`.

Use `lodash-es` only, never `lodash`.

## Key domain concepts (product language)

| Term | Meaning |
|---|---|
| **Household** | Tenant boundary; all data is household-scoped |
| **Plan** | A budget for a period (`personal` or `household`, `weekly`/`monthly`/`custom`) |
| **PlannedItem** | One line in a plan: category + direction (income/expense) + amount |
| **Mapping** | Link from a transaction to exactly one planned item |
| **Unplanned** | Transaction with no mapping; surfaced separately on the dashboard |
| **Transfer** | Transaction marked as moving money between own accounts; excluded from totals |
| **LeftoverEntry** | Derived (never stored): unspent planned expense at period end |
| **PlanActualsView** | The shape returned by `GET /plans/:id/dashboard` — the core UI data |

## Core pure functions (in `@power-budget/core`)

These are the heart of the product; every other layer delegates to them:

- `computePlanActuals(plan, plannedItems, transactions, mappings, transfers, fxTable): PlanActualsView`
- `computeLeftover(plan, plannedItems, transactions, mappings): LeftoverEntry[]`
- `convertMoney(money, targetCurrency, rates): Money`
- `aggregateByCategoryWithPrivacy(transactions, mappings, categories, viewerUserId, privacyMap): CategoryAggregate[]`

## Bank sync architecture

- **GoCardless** (PSD2 AISP) for PKO BP; **Wise Personal API** for Wise.
- Both are behind `BankConnectorPort` — the rest of the system never sees provider differences.
- Sync runs via BullMQ (`sync-connection` job, cron every 4 h + on-demand).
- Transaction idempotency key: `(account_id, external_id)` UNIQUE. When `external_id` is absent, hash `(account, date, amount, normalised_description)`.

## Notifications (outbox pattern)

Notification events are written to `notifications_outbox` in the **same DB transaction** as the triggering domain change. A BullMQ `notification-dispatch` worker picks them up. This guarantees at-least-once delivery. Deduplication: `(userId, kind, dedupeKey)` UNIQUE index.

## Internationalisation

Four locales: `en`, `uk`, `ru`, `pl`. ICU MessageFormat for all strings (uk/ru/pl require multi-form plurals). Frontend uses `react-intl`. ESLint rule `react-intl/no-literal-string` bans inline strings in components. Adding a locale is a content-only change (add a JSON bundle; no code changes).

## Local infrastructure (docker-compose)

| Service | Image | Port |
|---|---|---|
| Postgres 16 | `postgres:16.4-alpine` | 5432 |
| Redis 7 | `redis:7.4-alpine` | 6379 |
| Mailpit (SMTP catcher) | `axllent/mailpit:v1.20` | 1025 (SMTP), 8025 (UI) |

Dev credentials: user/password/db all `power_budget`. Copy `.env.example` → `.env` on first setup.

## Key documentation

- `docs/mvp/ARCHITECTURE.md` — authoritative technical spec (wins on "how to build")
- `docs/mvp/PRODUCT.md` — product requirements (wins on "what behaviour")
- `docs/mvp/BACKLOG.md` — ordered task list with IDs (`INF-*`, `BE-*`, `WEB-*`, `MOB-*`, etc.)
- `docs/mvp/plans/<ID>.md` — detailed implementation plan per backlog task
