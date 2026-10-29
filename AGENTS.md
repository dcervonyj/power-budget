# Power Budget — Agent Instructions

> **Sync rule:** This file is one of three identical agent-instruction files in this repo:
> `AGENTS.md` (OpenAI Codex), `CLAUDE.md` (Anthropic Claude CLI), `.github/copilot-instructions.md` (GitHub Copilot).
> **If you modify any one of them, apply the same change to all three.**

## Project status

The monorepo scaffold is complete, but the product is a **pre-alpha scaffold**: the 21 Oct 2026 audit found that most user journeys do not work end to end and that the deployed API has security holes being fixed in CLN-001. Real task status is in `docs/mvp/BACKLOG.md` §0; the current plan is §7 (v1.1); short status is `STATUS.md`. Conventions documented here are authoritative from `docs/mvp/ARCHITECTURE.md`; code must be written to match them.

## Commands

```bash
pnpm install                          # install all workspace dependencies
pnpm build                            # turbo run build (all packages)
pnpm dev                              # turbo run dev: builds deps once, then watches (see docs/local-setup.md)
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

# OpenAPI spec
pnpm -F @power-budget/backend generate:openapi   # regenerate packages/backend/openapi.json
```

Turborepo respects `dependsOn` topology: `core` builds before `backend`, `web`, `mobile`.
The CI runs a drift check (`git diff --exit-code packages/backend/openapi.json`) after regenerating
with `prettier --write`; always regenerate and commit the spec when adding or changing endpoints.

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
- **application/** — MobX stores / `ReactiveView` view-models and use cases (MobX, not Redux/RTK; no Redux packages). `@power-budget/shared-app` is meant to hold this layer but is empty scaffolding today (CLN-016); web stores live in `packages/web` for now
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
export interface TransactionRepository { ... }
export interface BankConnector { ... }
export interface FxRateProvider { ... }

// Adapter (implementation in infrastructure layer)
export class DrizzleTransactionRepository implements TransactionRepository { ... }
export class GoCardlessBankConnector implements BankConnector { ... }
export class EcbFxRateProvider implements FxRateProvider { ... }
```

Use case classes are named `<VerbNoun>UseCase` (`RegisterUserUseCase`, `LoginWithPasswordUseCase`, `MapTransactionUseCase`, `GetPlanDashboardUseCase`); the file name equals the class name. The suffix is the convention (PO decision D3, 29 Oct 2026: keep `*UseCase`; do not drop it and do not rename existing classes).

Never name a class, function, variable, parameter, type or property `*Helper` / `*Helpers`; name it by what it does. Interfaces carry no `I` prefix.

Lint-enforced style (errors, `eslint.ratchet.js`): `curly` (always braces), a blank line before `return`, `@typescript-eslint/switch-exhaustiveness-check` (list every union member as a `case`; a `default` alone does not count; for a closed union end with `default: return assertNever(x)`), `@typescript-eslint/member-ordering` (fields, constructor, public, protected, private methods), the `*Helper` / `I`-prefix naming ban, and no `lodash` import (use `lodash-es`). A package opts in with `"eslintRatchet": true` in its package.json once it is green; every package is expected to opt in.

Tests build typed mocks with `createMock<T>(overrides)` from `@golevelup/ts-vitest` (backend, web) or `@golevelup/ts-jest` (mobile); no `as` casts, no `any()` matchers or `expect.anything()`, assert exact values. Auto-stubbed members return mocks, so stub every value the code under test reads.

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
Money.add(a, b); // throws if currencies differ
Money.multiply(m, 2n); // bigint multiplier
Money.compare(a, b); // -1 | 0 | 1
```

FX conversion always uses a `FxRateTable` snapshot passed in explicitly — never fetched inside pure functions.

## Multi-tenancy via `HouseholdScope`

Every repo method that reads or writes household data takes `HouseholdScope = { householdId: HouseholdId }` and includes `household_id` in its WHERE clause (writes too: no update or delete by id alone; ids from the request, such as a transfer counterpart, a bulk-map id or a manual-transaction account, are checked against the scope). The ESLint rule `no-repo-without-scope` (`packages/backend/eslint-local-rules.cjs`) enforces it for `repo.method()` and `this.repo.method()` calls; identity repositories are exempted in `eslint.config.js`.

Postgres RLS (migration `0008_rls_tenancy`, FORCE) is the second layer: the app connects as a non-owner role, and `ScopedPool` sets `app.household_id` / `app.user_id` / `app.rls_bypass` on each pooled connection (`set_config(..., false)`, sent only when the connection's last scope differs) from the `DbScope` of the request (`DbScopeInterceptor`) or the worker (system scope). See `docs/runbooks/db-roles-and-migrations.md`.

## TypeScript strictness

`tsconfig.base.json` enforces: `strict: true`, `noUncheckedIndexedAccess: true`. No `experimentalDecorators`. NestJS providers are explicitly wired — no decorator-only autowiring of fields.

Formatting (`.prettierrc`): `singleQuote`, `trailingComma: "all"`, `printWidth: 100`, `semi: true`, `arrowParens: "always"`.

Use `lodash-es` only, never `lodash`.

## Key domain concepts (product language)

| Term                | Meaning                                                                        |
| ------------------- | ------------------------------------------------------------------------------ |
| **Household**       | Tenant boundary; all data is household-scoped                                  |
| **Plan**            | A budget for a period (`personal` or `household`, `weekly`/`monthly`/`custom`) |
| **PlannedItem**     | One line in a plan: category + direction (income/expense) + amount             |
| **Mapping**         | Link from a transaction to exactly one planned item                            |
| **Unplanned**       | Transaction with no mapping; surfaced separately on the dashboard              |
| **Transfer**        | Transaction marked as moving money between own accounts; excluded from totals  |
| **LeftoverEntry**   | Derived (never stored): unspent planned expense at period end                  |
| **PlanActualsView** | The shape returned by `GET /plans/:id/dashboard` — the core UI data            |

## Core pure functions (in `@power-budget/core`)

These are the heart of the product; every other layer delegates to them:

- `computePlanActuals(plan, plannedItems, transactions, mappings, transfers, fxTable): PlanActualsView`
- `computeLeftover(plan, plannedItems, transactions, mappings): LeftoverEntry[]`
- `convertMoney(money, targetCurrency, rates): Money`
- `aggregateByCategoryWithPrivacy(transactions, mappings, categories, viewerUserId, privacyMap): CategoryAggregate[]`

## Bank sync architecture

- **GoCardless** (PSD2 AISP) for PKO BP; **Wise Personal API** for Wise.
- Both are behind `BankConnector` — the rest of the system never sees provider differences.
- Sync runs via BullMQ (`sync-connection` job, cron every 4 h + on-demand).
- Transaction idempotency key: `(account_id, external_id)` UNIQUE. When `external_id` is absent, hash `(account, date, amount, normalised_description)`.

## Notifications (outbox pattern)

Notification events are written to `notifications_outbox` in the **same DB transaction** as the triggering domain change. A BullMQ `notification-dispatch` worker picks them up. This guarantees at-least-once delivery. Deduplication: `(userId, kind, dedupeKey)` UNIQUE index.

## Backend bootstrap order (`packages/backend/src/main.ts`)

The backend bootstrap function follows this strict order — do not reorder:

1. **`Sentry.init()`** — must run before anything else so all errors are captured
2. **`NestFactory.create()`** — creates the Fastify adapter app
3. **`SwaggerModule.setup('docs', ...)`** — sets up OpenAPI UI (skipped when `NODE_ENV=production`)
4. **`app.register(helmet, ...)`** — registers HTTP security headers
5. **`app.useGlobalFilters(new SentryExceptionFilter())`** — captures 5xx errors to Sentry
6. **`app.listen(port, '0.0.0.0')`** — starts listening

## OpenAPI / Swagger conventions

- `/docs` is served in development and staging only (`NODE_ENV !== 'production'`). The deployed service runs with `NODE_ENV=staging`, so `/docs` is currently public (closed in CLN-001).
- Every controller must be decorated with `@ApiTags(...)`, `@ApiOperation(...)`, `@ApiResponse(...)`.
- Controllers with `@UseGuards(JwtAuthGuard)` must have `@ApiBearerAuth()` at class level.
- Every DTO must have `@ApiProperty()` / `@ApiPropertyOptional()` — use explicit `type:` fields since tsx/swc don't emit decorator metadata.
- After adding or modifying endpoints, regenerate and commit: `pnpm -F @power-budget/backend generate:openapi && pnpm exec prettier --write packages/backend/openapi.json && git add packages/backend/openapi.json`

## TOTP step-up enforcement

Sensitive endpoints can require a recent TOTP verification via:

```ts
@UseGuards(JwtAuthGuard, TotpStepUpGuard)
@RequireRecentTotp()          // default 5 min window
```

`TotpStepUpGuard` checks `RedisTotpStepUpStore` keyed `totp-stepup:{userId}` (TTL 300 s); without an enabled TOTP it answers 403 `requires_totp_enrollment`, otherwise 403 `requires_totp`. Every accepted code (`POST /auth/totp/verify`, or a login with `totp`) goes through `TotpAuthenticator`, which decrypts the secret via the `Encryption` port, rejects reused codes and stamps the step-up. First enrolment (`POST /auth/totp/enable`) needs no step-up; replacing an enabled TOTP does. Password and magic-link login share `LoginPolicy`: once TOTP is enabled both need a code, and a user gets 5 codes per 15 min across both paths and all IPs (Redis `attempts:totp-failures:{userId}`, reset on success), then 429 `too_many_requests` with `Retry-After`; a magic link is burned after 3 wrong codes. Credential endpoints use `ThrottlerGuard` (per IP and per account, Redis storage; see `presentation/auth/throttling.ts`).

## Audit log PII redaction

Audit writers inject `REDACTING_AUDIT_LOGGER` (AuditLogger) or `AUDIT_LOG_PORT` (plans AuditLogPort) from `AuditModule`, never `DrizzleAuditEventRepository` (that is for the read endpoint). The `RedactingAuditLogger`:

- Masks IBANs (in any string, and any value under `iban` / `accountNumber`) to `***<last 4>`
- Replaces amounts under amount keys (`amount`, `amountMinor`, `balanceMinor`, any `*Minor`) whose absolute value is above `AUDIT_REDACTION_THRESHOLD_MINOR` with `{ redacted: true }` (default 1,000,000 minor units = 10,000 PLN); other numbers are kept
- Converts bigint values to strings so the metadata always fits `jsonb`

`audit_log` is append-only for the app role (REVOKE in `db:roles`, no UPDATE/DELETE RLS policy).

## Internationalisation

Four locales: `en`, `uk`, `ru`, `pl`. ICU MessageFormat for all strings (uk/ru/pl require multi-form plurals). Frontend uses `react-intl`. ESLint rule `react-intl/no-literal-string` bans inline strings in components. Adding a locale is a content-only change (add a JSON bundle; no code changes).

## Local infrastructure (docker-compose)

| Service                | Image                   | Port                   |
| ---------------------- | ----------------------- | ---------------------- |
| Postgres 16            | `postgres:16.4-alpine`  | 5432                   |
| Redis 7                | `redis:7.4-alpine`      | 6379                   |
| Mailpit (SMTP catcher) | `axllent/mailpit:v1.20` | 1025 (SMTP), 8025 (UI) |

Dev credentials: user/password/db all `power_budget`. Copy `.env.example` → `.env` on first setup.

## Key documentation

- `docs/mvp/ARCHITECTURE.md` — authoritative technical spec (wins on "how to build")
- `docs/mvp/PRODUCT.md` — product requirements (wins on "what behaviour")
- `docs/mvp/BACKLOG.md` — task list with IDs; §0 has the real status of the v1.0 tasks, §7 is the v1.1 plan (`CLN-*`, `HOST-*`, `BNK-*`, `SYNC-*`, `AI-*`, `UI-*` ...)
- `docs/mvp/plan-banking.md` — design reference for the bank-feed tasks (Enable Banking, Wise, PKO email, AI categorisation)
- `docs/mvp/plans/<ID>.md` — detailed implementation plan per backlog task
