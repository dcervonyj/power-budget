# Power Budget — MVP Build Backlog (v1.0)

> Concrete, ordered task list to ship the Power Budget MVP. **Sources of truth:** `PRODUCT.md` (what to build) and `ARCHITECTURE.md` (how to build). This document never overrides them — if it disagrees with either, the source doc wins and this file is the bug.
>
> **How to read this doc:**
>
> 1. §1 Overview gives the shape (counts, effort, critical path, brutal honesty).
> 2. §2 Conventions defines task IDs, effort scale, and dependency semantics.
> 3. §3 Wave / Parallelization schema is the execution plan — read this before picking tasks.
> 4. §4 is the task catalogue, grouped by area; cross-referenced via `Blocked by` / `Blocks`.
> 5. §5 Critical Path walks the longest dependency chain.
> 6. §6 Open Questions lists things that must be decided before Day 1.

---

## §1 — Overview

### Task counts

| Area                  | Count   |
| --------------------- | ------- |
| Infra & DevOps        | 14      |
| Backend               | 38      |
| Web                   | 22      |
| Mobile (RN)           | 14      |
| Design                | 8       |
| i18n / Content        | 7       |
| QA                    | 9       |
| Security / Cross-cut. | 9       |
| **TOTAL**             | **121** |

### Effort totals (person-days, midpoint of band)

- Infra & DevOps: ~25 d
- Backend: ~108 d
- Web: ~52 d
- Mobile: ~35 d
- Design: ~13 d
- i18n / Content: ~16 d
- QA: ~22 d
- Security / Cross-cutting: ~22 d
- **Total: ~293 person-days** for a single senior dev going solo end-to-end.

### Critical-path length (calendar)

With one senior dev driving and **2–3 parallel work-streams** wherever the dependency graph allows (e.g. design + i18n + infra running while backend builds the domain layer), the realistic calendar critical path is **~11–13 calendar weeks part-time**, matching the ARCHITECTURE §11 sprint plan. Strict serial execution by one dev with zero parallelism would land ~24 weeks part-time. The 10-week target in ARCHITECTURE.md is achievable only with disciplined parallel wave scheduling and ruthless cutting.

### Brutal honesty — three bullets

- **Will likely slip:** Mobile parity (sprint 9 in ARCHITECTURE.md) is the most underestimated work. Expo + secure storage + biometric + OAuth deep-linking + 2FA on iOS is at least 2 weeks of real friction even after the web flows exist. Allocate slack here.
- **Riskiest tasks:** `BE-018` GoCardless adapter (PKO sandbox availability and 90-day consent quirks are unproven), `BE-024` sync-job idempotency (one bug here corrupts the ledger), and `BE-032` materialised-view performance under 500 ms (no real production data until late — may force a refactor in sprint 7).
- **Cut if out of time:** weekly digest email (`BE-029`), audit-log drawer UI (`WEB-019`), bulk-action UI (`WEB-014`), heuristic mapping suggestions (`BE-021`), household privacy drill-in (`WEB-021`). All are PRD §4 items but the app is usable without them for the two-user MVP.

---

## §2 — Conventions

### Task ID format

- `<AREA>-NNN` zero-padded, sequential within area. Areas:
  - `INF-` Infra & DevOps
  - `BE-` Backend
  - `WEB-` Frontend Web
  - `MOB-` Mobile (React Native)
  - `DES-` Design / UI assets
  - `I18N-` Internationalisation & Content
  - `QA-` Quality Assurance
  - `SEC-` Security / Cross-cutting

### Effort scale

| Band | Range     | Use when…                                                        |
| ---- | --------- | ---------------------------------------------------------------- |
| XS   | ≤ 0.5 day | Trivial: one config file, one CI tweak.                          |
| S    | 0.5–1 day | A small, self-contained change with no design ambiguity.         |
| M    | 1–3 days  | One domain concept or one screen including tests.                |
| L    | 3–5 days  | Spans multiple files / layers but still single-feature.          |
| XL   | 5–10 days | A full domain (entities + ports + adapters + endpoints + tests). |

Anything bigger than XL **must be split** before scheduling.

### Dependency semantics

- A task with no `blockedBy` is a **wave-1 task** and is startable on day 1.
- `blockedBy` lists _only_ tasks producing an artifact (interface, file, schema row, fixture) that this task _consumes_. Soft preference / sequencing is not a blocker.
- Acceptance criteria are bullets, not prose. A task is "done" when all bullets pass review.

### Done definition

For every task:

1. Code merged to `main` behind passing CI (lint + typecheck + tests).
2. Acceptance-criteria bullets reviewed in the PR.
3. Where the task introduces a port/contract: the port + at least one adapter + a unit test live in the same PR.

---

## §3 — Wave / Parallelization Schema

The waves below are the execution plan. A task lands in **Wave N** iff every task in its `blockedBy` list lives in Waves 1..N-1.

Waves are not sprints; they are dependency tiers. Several waves may be in flight concurrently as long as a single contributor isn't double-booked.

### Wave 1 — Day-1 startable (no blockers)

| ID      | Title                                           | Area   | Effort |
| ------- | ----------------------------------------------- | ------ | ------ |
| INF-001 | Create GitHub repository + branch protection    | Infra  | XS     |
| DES-001 | Design tokens — CSS variables + RN style tokens | Design | M      |

Only two pure wave-1 starters exist because nearly every other task depends on the monorepo skeleton (INF-002). The design-token task can run fully parallel to all of infra.

### Wave 2 — depends on Wave 1

| ID      | Title                              | Area   |
| ------- | ---------------------------------- | ------ |
| INF-002 | Scaffold pnpm + Turborepo monorepo | Infra  |
| INF-007 | Dependabot + secret scanning       | Infra  |
| DES-002 | Component library scaffold         | Design |

### Wave 3 — depends on Waves 1+2 (the "explosion" wave — many parallel starters)

| ID      | Title                                            | Area    |
| ------- | ------------------------------------------------ | ------- |
| INF-003 | ESLint + Prettier + per-package rules            | Infra   |
| INF-004 | Docker-compose for local Postgres + Redis + SMTP | Infra   |
| BE-002  | Scaffold `@power-budget/core` package            | Backend |
| DES-003 | Bank-connect flow visuals                        | Design  |
| DES-004 | Transaction list + detail visuals                | Design  |
| DES-005 | Dashboard visuals                                | Design  |
| DES-006 | Categories + privacy visuals                     | Design  |
| DES-007 | Empty / loading / error illustration kit         | Design  |
| DES-008 | Light / Dark Theme Switching — toggle + persist  | Design  |

### Wave 4 — depends on Waves 1–3

| ID      | Title                                          | Area    | Status |
| ------- | ---------------------------------------------- | ------- | ------ |
| INF-005 | GitHub Actions CI                              | Infra   | ✅ Done (PR #10) |
| INF-015 | Scaffold `packages/shared-app` + Metro spike   | Infra   | ✅ Done (PR #12) |
| BE-001  | Scaffold `packages/backend` (NestJS)           | Backend | ✅ Done (PR #11) |
| BE-003  | Core domain types — IDs + value objects        | Backend | ✅ Done (PR #15) |
| WEB-001 | Scaffold `packages/web` (thin UI wrapper)      | Web     | ✅ Done (PR #18) |
| MOB-001 | Scaffold `packages/mobile` (thin UI wrapper)   | Mobile  | ✅ Done (PR #19) |

### Wave 5

| ID       | Title                                    | Area    | Status |
| -------- | ---------------------------------------- | ------- | ------ |
| INF-006  | GH Actions build + preview deploy        | Infra   | ✅ Done (PR #30) |
| INF-008  | Drizzle ORM tooling                      | Infra   | ✅ Done (PR #37) |
| INF-012  | Observability stack                      | Infra   | — |
| BE-004   | Core entity types (Plan, Transaction, …) | Backend | ✅ Done (PR #34) |
| BE-010   | Core locale-aware formatters             | Backend | ✅ Done (PR #39) |
| WEB-002  | Routing + protected-route wrapper        | Web     | ✅ Done (PR #32) |
| WEB-003  | MobX + ReactiveView wiring               | Web     | ✅ Done (PR #36) |
| MOB-002  | React Navigation                         | Mobile  | ✅ Done (PR #35) |
| MOB-003  | MobX + ReactiveView wiring (mobile)      | Mobile  | — (blocked by BE-038) |
| MOB-013  | Notification routing layer (placeholder) | Mobile  | — |
| I18N-001 | String-extraction infrastructure         | i18n    | — |
| QA-001   | Vitest unit-test setup                   | QA      | ✅ Done (PR #33) |
| QA-004   | Detox-defer ADR                          | QA      | ✅ Done (PR #31) |

### Wave 6

| ID       | Title                                   | Area    | Status |
| -------- | --------------------------------------- | ------- | ------ |
| INF-009  | Deployment topology — Fly.io            | Infra   | ⏸ Deferred (needs external account) |
| BE-005   | Drizzle schema — every MVP table        | Backend | ✅ Done (PR #38) |
| BE-006   | Core `computePlanActuals`               | Backend | ✅ Done (PR #40) |
| BE-007   | Core `computeLeftover` + `convertMoney` | Backend | ✅ Done (PR #41) |
| BE-008   | Core `aggregateByCategoryWithPrivacy`   | Backend | ✅ Done (PR #42) |
| BE-009   | Core `applyMappingSuggestion`           | Backend | ✅ Done (PR #43) |
| BE-010   | Core locale-aware formatters            | Backend | ✅ Done (PR #39) |
| MOB-004  | Secure storage for tokens               | Mobile  | ⏸ Blocked (needs BE-038 / MOB-003) |
| I18N-002 | `react-intl` provider + lint rule       | i18n    | ⏸ Deferred to Wave 7 |
| I18N-003 | Resource bundles — `en.json` baseline   | i18n    | ⏸ Deferred to Wave 7 |

### Wave 7

| ID       | Title                                         | Area    |
| -------- | --------------------------------------------- | ------- |
| INF-010  | Managed PG (Neon) + Redis (Upstash)           | Infra   |
| INF-011  | Web hosting — Cloudflare Pages                | Infra   |
| BE-011   | Auth domain — entities + ports                | Backend |
| BE-016   | BankConnection domain + `BankConnectorPort`   | Backend |
| BE-020   | Transactions domain — entities + ports        | Backend |
| BE-023   | BullMQ infrastructure                         | Backend |
| BE-025   | Plans domain — entities + ports               | Backend |
| BE-027   | Categories domain + privacy + seed migration  | Backend |
| I18N-004 | Translations — uk/ru/pl (LLM + native review) | i18n    |
| QA-002   | Integration test harness                      | QA      |

### Wave 8

| ID       | Title                             | Area    |
| -------- | --------------------------------- | ------- |
| INF-013  | Staging environment + DNS + TLS   | Infra   |
| BE-012   | Auth use cases                    | Backend |
| BE-026   | Plans use cases + REST + audit    | Backend |
| BE-028   | FX — ECB ingest                   | Backend |
| BE-037   | ESLint `no-repo-without-scope`    | Backend |
| I18N-005 | Localised email templates         | i18n    |
| I18N-006 | Locale-aware formatters across UI | i18n    |
| I18N-007 | Localised seed categories         | i18n    |

### Wave 9

| ID      | Title                          | Area     |
| ------- | ------------------------------ | -------- |
| BE-013  | Auth infrastructure adapters   | Backend  |
| BE-014  | Household domain + invite flow | Backend  |
| BE-021  | Transactions use cases         | Backend  |
| SEC-001 | KMS / envelope encryption      | Security |
| SEC-006 | Auth rate limiting             | Security |

### Wave 10

| ID      | Title                                         | Area     |
| ------- | --------------------------------------------- | -------- |
| BE-015  | Auth presentation — REST controllers + guards | Backend  |
| BE-022  | Transactions infrastructure + REST            | Backend  |
| BE-035  | Audit log API + `AuditLogger` port            | Backend  |
| SEC-002 | Key rotation runbook                          | Security |

### Wave 11

| ID      | Title                           | Area     |
| ------- | ------------------------------- | -------- |
| BE-017  | BankConnection use cases + REST | Backend  |
| BE-038  | OpenAPI / Swagger docs          | Backend  |
| INF-014 | Sentry error tracking           | Infra    |
| SEC-003 | TOTP step-up enforcement        | Security |
| SEC-004 | Web security headers            | Security |
| SEC-008 | PII redaction in audit          | Security |

### Wave 12

| ID      | Title                             | Area     |
| ------- | --------------------------------- | -------- |
| BE-018  | GoCardless adapter                | Backend  |
| BE-019  | Wise adapter                      | Backend  |
| BE-036  | RLS policies + tenancy spec       | Backend  |
| WEB-004 | Typed API client from OpenAPI     | Web      |
| MOB-005 | Auth screens (mobile)             | Mobile   |
| MOB-009 | Locale resolution + i18n (mobile) | Mobile   |
| SEC-007 | 2FA-at-bank-connect gate          | Security |

### Wave 13

| ID      | Title                                        | Area    |
| ------- | -------------------------------------------- | ------- |
| BE-024  | Bank-sync scheduler + processor              | Backend |
| BE-030  | Dashboard query endpoint + materialised view | Backend |
| BE-034  | Data export + household deletion             | Backend |
| WEB-005 | Auth screens                                 | Web     |
| WEB-008 | Plans list + plan editor                     | Web     |
| WEB-015 | Categories management                        | Web     |
| WEB-016 | Currency switcher + MoneyView                | Web     |
| WEB-017 | Locale switcher + i18n provider              | Web     |
| WEB-020 | Manual transaction entry                     | Web     |
| MOB-006 | TOTP enrolment + iOS 2FA                     | Mobile  |
| MOB-007 | Deep linking — magic-link + OAuth            | Mobile  |
| MOB-008 | Biometric unlock                             | Mobile  |
| MOB-012 | Plans list + planned-item editor             | Mobile  |
| QA-005  | Tenancy spec — every endpoint                | QA      |

### Wave 14

| ID      | Title                                               | Area     |
| ------- | --------------------------------------------------- | -------- |
| BE-029  | Notifications — outbox + channel + templates + cron | Backend  |
| BE-031  | Dashboard household + unplanned endpoints           | Backend  |
| WEB-006 | TOTP enrolment screen                               | Web      |
| WEB-009 | Planned-item history drawer                         | Web      |
| WEB-011 | OAuth bridge (Google + bank consent)                | Web      |
| WEB-012 | Transactions list + detail                          | Web      |
| WEB-019 | Audit-log drawer wired into plan items              | Web      |
| MOB-010 | Dashboard (mobile)                                  | Mobile   |
| MOB-011 | Transactions list + detail (mobile)                 | Mobile   |
| SEC-005 | GDPR — privacy policy + data deletion runbook       | Security |

### Wave 15

| ID      | Title                                    | Area     |
| ------- | ---------------------------------------- | -------- |
| BE-032  | Dashboard perf — k6 budget gate          | Backend  |
| BE-033  | Outbox relay worker + period close       | Backend  |
| WEB-007 | Onboarding wizard                        | Web      |
| WEB-010 | Bank connections (web)                   | Web      |
| WEB-013 | Dashboard screen                         | Web      |
| WEB-018 | Settings screen (5 tabs)                 | Web      |
| WEB-021 | Household drill-in (privacy-aware)       | Web      |
| WEB-022 | Loading / empty / error states           | Web      |
| MOB-014 | TestFlight pipeline + App Store metadata | Mobile   |
| QA-003  | Playwright E2E setup                     | QA       |
| QA-007  | Notification E2E test                    | QA       |
| QA-008  | k6 dashboard perf SLI                    | QA       |
| SEC-009 | Pen-test checklist                       | Security |

### Wave 16 — final gate

| ID      | Title                                           | Area |
| ------- | ----------------------------------------------- | ---- |
| WEB-014 | Bulk action bar + mapping modal                 | Web  |
| QA-006  | Visual regression — 4 locales × key screens     | QA   |
| QA-009  | Manual test plan + partner-onboarding rehearsal | QA   |

### Parallelism summary

- **Highest parallelism** is in **Waves 5–8**, where backend ports + frontend scaffolds + design components + i18n setup all run concurrently because the shared `@power-budget/core` types unblock each work stream independently.
- **Web and Mobile** can run fully parallel to each other from Wave 4 onward because both depend on `@power-budget/core` + OpenAPI, not on each other.
- **Bottleneck waves** are 12–13: the bank-connector adapters and dashboard query gate everything visible to the user. Plan agents must focus here.

### Top 8 Wave-1 / early-Wave-2 candidates (spawn plan agents next)

These are the highest-priority startable tasks. Strictly only `INF-001` and `DES-001` are pure wave-1 with **zero** blockers, but the next six become startable within hours of `INF-002` landing and should be queued immediately:

1. **INF-001** — Create GitHub repository + branch protection _(true wave 1, no blockers)_
2. **DES-001** — Design tokens — CSS variables + RN style tokens _(true wave 1, no blockers)_
3. **INF-002** — Scaffold pnpm + Turborepo monorepo _(needs INF-001 only; unlocks every package)_
4. **BE-002** — Scaffold `@power-budget/core` package _(unlocks every other package)_
5. **BE-003** — Core domain types — branded IDs + value objects _(spine of every domain task)_
6. **DES-002** — Component library scaffold — Button, Input, Modal _(unlocks every UI screen)_
7. **INF-004** — Docker-compose for local Postgres + Redis + Mailpit _(unlocks every DB/queue task)_
8. **INF-007** — Dependabot + secret scanning _(cheap, parallel, sets the security baseline)_

These eight together unblock ~70% of the rest of the backlog within the first two waves.

---

## §4 — Tasks

### §4.1 Infra & DevOps (`INF-`)

#### INF-001: Create GitHub repository + branch protection

- **Area**: Infra
- **Effort**: XS (~0.5d)
- **Status**: ✅ Done
- **Description**: Stand up the `power-budget` GitHub repo, set default branch to `main`, configure branch protection (require PR + green CI). No code yet — just the container. Reference ARCHITECTURE.md §10 (CI: GitHub Actions).
- **Blocked by**: none
- **Blocks**: INF-002, INF-003, INF-007
- **Acceptance criteria**:
  - Private repo exists at `github.com/<owner>/power-budget`.
  - `main` is protected; direct pushes blocked.
  - PR template + CODEOWNERS placeholder committed.

#### INF-002: Scaffold pnpm + Turborepo monorepo

- **Area**: Infra
- **Effort**: S (~1d)
- **Status**: ✅ Done — [PR #1](https://github.com/dcervonyj/power-budget/pull/1)
- **Description**: Initialise the monorepo per ARCHITECTURE.md §4 — `pnpm-workspace.yaml`, `turbo.json` with `lint`, `typecheck`, `test`, `build` pipelines, root `package.json`, root `tsconfig.base.json`. Empty `packages/` directory layout.
- **Blocked by**: INF-001
- **Blocks**: INF-003, INF-004, BE-001, WEB-001, MOB-001, SHARED scaffolds
- **Acceptance criteria**:
  - `pnpm install` succeeds on a clean clone.
  - `pnpm turbo run lint typecheck test` runs (no-op acceptable) with caching enabled.
  - `tsconfig.base.json` enforces `strict: true`, `noUncheckedIndexedAccess: true`, no `experimentalDecorators`.
  - `.editorconfig`, `.prettierrc`, `.gitignore` committed.

#### INF-003: Configure root ESLint + Prettier + per-package rules

- **Area**: Infra
- **Effort**: S (~1d)
- **Status**: ✅ Done
- **Description**: Root ESLint config with TS support, `no-restricted-imports` rule scaffold (used by `@power-budget/core` to ban Node/React/I/O imports per ARCHITECTURE.md §4), Prettier, lint-staged + husky pre-commit hook. Add `react-intl/no-literal-string` placeholder (enabled later in I18N-002).
- **Blocked by**: INF-002
- **Blocks**: BE-001, WEB-001, MOB-001
- **Acceptance criteria**:
  - `pnpm lint` runs against every package.
  - Pre-commit runs lint+typecheck on changed files only.
  - A test fixture importing `axios` from `@power-budget/core` fails lint.

#### INF-004: Docker-compose for local Postgres + Redis + mailcatcher

- **Area**: Infra
- **Effort**: S (~1d)
- **Status**: ✅ Done
- **Description**: `docker-compose.yml` at repo root spinning up Postgres 16, Redis 7, and a SMTP catcher (Mailpit). Wired with named volumes. Includes a `.env.example` and `pnpm dev:db` script. Per ARCHITECTURE.md §4 and §10.
- **Blocked by**: INF-002
- **Blocks**: INF-008, BE-005, BE-019, BE-029
- **Acceptance criteria**:
  - `docker compose up` starts all three services healthy.
  - Postgres exposes a non-default port; URL templated in `.env.example`.
  - Mailpit UI reachable at `http://localhost:8025`.

#### INF-005: GitHub Actions CI — lint + typecheck + tests

- **Area**: Infra
- **Effort**: S (~1d)
- **Description**: `.github/workflows/ci.yml` runs `pnpm install` (with cache), then `pnpm turbo run lint typecheck test` on PRs and pushes. Matrix only by Node version (single 20.x for now). Turborepo remote cache via GitHub-hosted cache.
- **Blocked by**: INF-002, INF-003
- **Blocks**: INF-006, INF-013, every dev task (soft)
- **Acceptance criteria**:
  - PR CI completes < 5 min for the empty repo.
  - Failing lint or test blocks merge.
  - Turborepo cache hits visible in logs.

#### INF-006: GitHub Actions build + preview deploy workflow

- **Area**: Infra
- **Effort**: S (~1d)
- **Description**: Second workflow `build.yml` runs on `push: main`, executes `pnpm turbo run build`, and deploys per the target picked in INF-009. For now this task wires the workflow skeleton; concrete deploy steps are added by INF-009 / INF-010 / INF-011.
- **Blocked by**: INF-005
- **Blocks**: INF-009, INF-010, INF-011
- **Acceptance criteria**:
  - Workflow runs on `main` only.
  - Build artefacts are uploaded as workflow outputs.
  - A `staging` GitHub environment is configured with required reviewers.

#### INF-007: Dependabot + secret scanning

- **Area**: Infra
- **Effort**: XS (~0.5d)
- **Status**: ✅ Done — [PR #2](https://github.com/dcervonyj/power-budget/pull/2)
- **Description**: Enable GitHub Dependabot for npm (weekly), GitHub Actions (monthly). Enable secret scanning + push-protection. Per SEC plan in ARCHITECTURE.md §6.
- **Blocked by**: INF-001
- **Blocks**: SEC-009
- **Acceptance criteria**:
  - `.github/dependabot.yml` committed.
  - Secret scanning visible as enabled in repo settings.

#### INF-015: Scaffold `packages/shared-app` + validate Metro resolver

- **Area**: Infra
- **Effort**: S (~1d)
- **Description**: Create `packages/shared-app` (`@power-budget/shared-app`) — the new package that holds all platform-agnostic frontend application logic (MobX ReactiveViews, use cases, selectors, API adapters, context factories, `NavigationPort` interface, `AppRoute` typed route union). This is the first step before any feature code is written on either web or mobile. The task has two deliverables: (1) the package scaffold with the full folder tree for all 8 feature modules (empty barrels, same structure as `@power-budget/core` for domain modules), `package.json` with `mobx`, `axios`, `react` as dependencies, and a `tsup` dual-build config; (2) a Metro resolver validation: add `@power-budget/shared-app` as a dependency of `packages/mobile`, run `expo export --platform ios` (or a Metro bundle dry-run), and confirm no symlink resolution errors. Per ARCHITECTURE.md §4 (`shared-app` description).
- **Blocked by**: INF-002, INF-003, BE-002
- **Blocks**: WEB-001, MOB-001, WEB-003, MOB-003, WEB-004
- **Acceptance criteria**:
  - `packages/shared-app/` exists with the full folder tree: 8 feature directories each containing `application/`, `api/`, `config/`, `ui/connect/`, plus top-level `infrastructure/` and `contract/`.
  - `pnpm -F @power-budget/shared-app build` emits dual ESM+CJS+`.d.ts`.
  - `pnpm -F @power-budget/shared-app typecheck` passes.
  - `import { createAuthContext } from '@power-budget/shared-app'` resolves in a throwaway file under `packages/web/src/`.
  - Metro resolves `@power-budget/shared-app` in a dry-run Expo bundle without `Unable to resolve module` errors.
  - `NavigationPort` interface is committed in `src/infrastructure/navigation/NavigationPort.ts`.
  - `AppRoute` discriminated union is stubbed in `src/contract/routes.ts`.

#### INF-008: Drizzle ORM tooling & migration scaffolding

- **Area**: Infra
- **Effort**: M (~2d)
- **Description**: Install Drizzle + `drizzle-kit` in `packages/backend`, scaffold `drizzle/` folder per ARCHITECTURE.md §4. Add `pnpm db:generate` (schema-diff → migration SQL), `pnpm db:migrate`, `pnpm db:reset` scripts. Configure connection URL via env. Produce one empty migration to prove the chain works.
- **Blocked by**: INF-004, BE-001
- **Blocks**: BE-003 and every Drizzle repo task
- **Acceptance criteria**:
  - `pnpm db:migrate` runs cleanly against compose Postgres.
  - Generated SQL is committed under `drizzle/migrations/`.
  - Drizzle config bans `prisma`-style implicit runtime; SQL files are the source of truth.

#### INF-009: Deployment topology — Fly.io API + worker

- **Area**: Infra
- **Effort**: M (~2d)
- **Description**: Provision Fly.io org + apps `power-budget-api` and `power-budget-worker` per ARCHITECTURE.md §10 Option A. Two `fly.toml` files sharing the same Docker image, different `CMD`. `min_machines_running=1` on API. Secrets injected via `fly secrets set` only.
- **Blocked by**: INF-006
- **Blocks**: INF-010, INF-011, INF-013, SEC-002
- **Acceptance criteria**:
  - Both Fly apps deploy a hello-world image successfully.
  - API has TLS via Fly's auto-cert.
  - Worker has no public HTTP listener.

#### INF-010: Managed Postgres (Neon) + managed Redis (Upstash)

- **Area**: Infra
- **Effort**: S (~1d)
- **Description**: Create Neon project (free tier with branching for PR previews) and Upstash Redis (free tier). Wire connection URLs as Fly secrets. Per ARCHITECTURE.md §10 Option A.
- **Blocked by**: INF-009
- **Blocks**: INF-013, every prod migration & sync task
- **Acceptance criteria**:
  - API in Fly can `SELECT 1` against Neon.
  - Worker in Fly can `PING` Upstash Redis.
  - Neon branching enabled; one branch created from `main` per PR.

#### INF-011: Web hosting — Cloudflare Pages

- **Area**: Infra
- **Effort**: S (~1d)
- **Description**: Cloudflare Pages project bound to the repo, building `packages/web`. SPA fallback to `index.html`. Custom domain (placeholder) + automatic HTTPS. Per ARCHITECTURE.md §10.
- **Blocked by**: INF-006, WEB-001
- **Blocks**: INF-013
- **Acceptance criteria**:
  - Pushing to `main` deploys web to a Pages URL.
  - SPA routes refresh cleanly (no 404 on direct deep-link).
  - Preview deployments fire on every PR.

#### INF-012: Observability stack — pino + Prometheus + OpenTelemetry

- **Area**: Infra
- **Effort**: M (~3d)
- **Description**: Wire pino structured JSON logging with `requestId`, `userId`, `householdId` context per ARCHITECTURE.md §6. Expose `/metrics` Prometheus endpoint. OpenTelemetry SDK auto-instruments NestJS, HTTP clients, Postgres, Redis. Sampler at 10% prod / 100% staging. Ship logs to Grafana Cloud (or stub adapter if account not ready).
- **Blocked by**: BE-001
- **Blocks**: INF-014, QA-008
- **Acceptance criteria**:
  - Every log line carries the three IDs.
  - `/metrics` returns at least one custom counter (e.g. `http_requests_total`).
  - Trace appears in Grafana Cloud (or stub log) for a sample request.

#### INF-013: Staging environment + custom domain + TLS

- **Area**: Infra
- **Effort**: S (~1d)
- **Description**: Provision staging Fly apps + a staging Neon branch + a `staging.<domain>` DNS record fronted by Cloudflare. HSTS preload, strict CSP per ARCHITECTURE.md §6 (Security headers). Web staging on Cloudflare Pages preview alias.
- **Blocked by**: INF-009, INF-010, INF-011
- **Blocks**: QA-009, every E2E test against staging
- **Acceptance criteria**:
  - `https://staging.<domain>` reaches the staging API/web.
  - HSTS header present; CSP blocks an inline script in a smoke test.
  - Staging DB seeded from a fixture script.

#### INF-014: Error tracking — Sentry (backend + web + mobile)

- **Area**: Infra
- **Effort**: S (~1d)
- **Description**: Add Sentry SDK to NestJS, React (Vite), and React Native. Single org, three projects. Release tagging via CI. Source maps uploaded for web on build.
- **Blocked by**: INF-012, WEB-001, MOB-001
- **Blocks**: none (cross-cutting)
- **Acceptance criteria**:
  - A thrown error in each app surfaces in Sentry with stack trace.
  - PII scrubbing rule enabled (no `email`, `householdId` in events).

---

### §4.2 Backend (`BE-`)

#### BE-001: Scaffold `packages/backend` (NestJS skeleton)

- **Area**: Backend
- **Effort**: S (~1d)
- **Description**: Create the NestJS app under `packages/backend` with the four-layer folder split per ARCHITECTURE.md §4 (`domain/`, `application/`, `infrastructure/`, `presentation/`, `worker/`). Add `main.ts` (HTTP) and `worker.main.ts` (worker bootstrap, no HTTP) per §9. No business modules yet — just the skeleton and a health module.
- **Blocked by**: INF-002, INF-003
- **Blocks**: BE-002, BE-003, INF-008, INF-012, INF-014
- **Acceptance criteria**:
  - `pnpm --filter backend start:dev` boots the API on configurable port.
  - `pnpm --filter backend start:worker` boots the worker with no HTTP server.
  - Folder layout enforced via lint rule (no presentation → domain imports).

#### BE-002: Scaffold `@power-budget/core` package

- **Area**: Backend
- **Effort**: S (~1d)
- **Status**: ✅ Done
- **Description**: Create `packages/core` per ARCHITECTURE.md §4 — `package.json` with empty `dependencies: {}`, `tsconfig.json`, `src/{domain,logic,ids}.ts` empty stubs, ESLint `no-restricted-imports` rule banning React, NestJS, Drizzle, axios, Node fs/crypto. Compile via `tsc` to ESM.
- **Blocked by**: INF-002, INF-003
- **Blocks**: BE-003 and every package that imports core
- **Acceptance criteria**:
  - `pnpm --filter @power-budget/core build` emits ESM `dist/`.
  - Adding `import 'react'` inside `src/` fails lint.
  - Package is referenced as `workspace:*` by backend/web/mobile.

#### BE-003: Core domain types — branded IDs + value objects

- **Area**: Backend
- **Effort**: M (~2d)
- **Description**: Implement the branded ID types (`UserId`, `HouseholdId`, `AccountId`, `TransactionId`, `PlanId`, `PlannedItemId`, `CategoryId`, `BankConnectionId`) per ARCHITECTURE.md §4. Implement `Money` value object (bigint minor units + ISO 4217), `DateRange`, `LocaleCode`. Pure, no I/O.
- **Blocked by**: BE-002
- **Blocks**: BE-004, BE-006, every domain task
- **Acceptance criteria**:
  - `UserId` is `string & { readonly __brand: 'UserId' }`; not assignable to `HouseholdId`.
  - `Money` arithmetic is integer-only (unit-tested for `1234n` PLN + `1n` PLN = `1235n` PLN; rejects cross-currency add).
  - 100% line coverage on `Money` ops.

#### BE-004: Core domain entity types — Plan, PlannedItem, Transaction, etc.

- **Area**: Backend
- **Effort**: M (~2d)
- **Description**: Define every entity type listed in ARCHITECTURE.md §4 "Domain types" — `User`, `Household`, `HouseholdMember`, `Account`, `BankConnection`, `Transaction`, `Mapping`, `Transfer`, `Plan`, `PlannedItem`, `PlannedItemVersion`, `Category`, `CategoryPrivacy`, `FxRate`, `Locale`, `LeftoverEntry`, `AuditEvent`, `NotificationKind`. Types only — no behaviour.
- **Blocked by**: BE-003
- **Blocks**: BE-005, BE-006, every domain task
- **Acceptance criteria**:
  - Every entity uses branded IDs (no raw `string`).
  - Discriminated unions for `Plan.type`, `PlannedItem.direction`, `Transaction.source`, `CategoryPrivacy.level`.
  - File-per-entity under `core/src/domain/`.

#### BE-005: Drizzle schema — every MVP table

- **Area**: Backend
- **Effort**: L (~4d)
- **Description**: Implement the full schema in `packages/backend/drizzle/schema.ts` exactly as ARCHITECTURE.md §8 specifies — every table, every column, every index, every UNIQUE, every FK. UUIDv7 PKs, `BIGINT` for minor units, `TIMESTAMPTZ` for times. Includes the `audit_log` and `notifications_outbox` tables.
- **Blocked by**: INF-008, BE-004
- **Blocks**: BE-006, BE-008, BE-011, BE-014, BE-016, BE-018, every Drizzle repo
- **Acceptance criteria**:
  - `pnpm db:generate` produces a single migration that creates all tables cleanly.
  - All UNIQUE constraints from §8 present.
  - Schema types are inferred via `drizzle-zod` or `InferModel` and re-exported.

#### BE-006: Core pure-logic — `computePlanActuals`

- **Area**: Backend
- **Effort**: L (~3d)
- **Description**: Implement `computePlanActuals(plan, plannedItems, transactions, mappings, transfers, fxTable): PlanActualsView` in `core/src/logic/` per ARCHITECTURE.md §5.9. Pure function; transfers + `ignored` excluded; returns income lines, expense lines (planned/actual/progress band), unplanned totals, leftover, bottom-line net.
- **Blocked by**: BE-004
- **Blocks**: BE-030, BE-031, WEB-013
- **Acceptance criteria**:
  - Unit tests cover: empty plan, fully-mapped plan, partially-mapped plan, over-budget item, ignored transactions, transfers excluded, cross-currency items converted via `FxRateTable`.
  - Function takes a `clock` parameter — no `Date.now()` calls inside.
  - 100% branch coverage.

#### BE-007: Core pure-logic — `computeLeftover` + `convertMoney`

- **Area**: Backend
- **Effort**: M (~2d)
- **Description**: Implement `computeLeftover` (per-item + total; over-budget items contribute 0 per PRD §4.8) and `convertMoney(money, target, FxRateTable)` per ARCHITECTURE.md §5.6 / §5.9. Pure functions in `core/src/logic/`.
- **Blocked by**: BE-003, BE-004
- **Blocks**: BE-030, BE-031
- **Acceptance criteria**:
  - `computeLeftover`: over-budget item returns 0 leftover, not negative.
  - `convertMoney`: integer-only math via bigint; cross-rate via EUR pivot covered; rejects unknown currency.
  - Unit tests for all branches.

#### BE-008: Core pure-logic — `aggregateByCategoryWithPrivacy`

- **Area**: Backend
- **Effort**: M (~2d)
- **Description**: Implement `aggregateByCategoryWithPrivacy(transactions, mappings, categories, viewerUserId, privacyMap): CategoryAggregate[]` per ARCHITECTURE.md §5.5. The **single place** privacy rules are encoded — `total_only`, `total_with_counts`, `full_detail` (full_detail never leaks account id).
- **Blocked by**: BE-004
- **Blocks**: BE-026, BE-031
- **Acceptance criteria**:
  - Three privacy levels each unit-tested for: own user view vs. partner view.
  - `full_detail` rows do not contain `accountId`.
  - Property-test: privacy demotion (`full → total`) reduces information monotonically.

#### BE-009: Core pure-logic — `applyMappingSuggestion`

- **Area**: Backend
- **Effort**: S (~1d)
- **Description**: Heuristic mapping suggestion: given a new transaction's merchant + description and the user's prior mappings, return the most-recently used `PlannedItemId` for matching merchant (or `null`). Pure. Per ARCHITECTURE.md §5.3.
- **Blocked by**: BE-004
- **Blocks**: BE-021
- **Acceptance criteria**:
  - Returns the last-used plannedItemId for an exact merchant match.
  - Falls back to substring match on normalised description.
  - Returns `null` when no prior history.
  - Unit-tested with a synthetic history table.

#### BE-010: Core pure-logic — locale-aware formatters

- **Area**: Backend
- **Effort**: S (~1d)
- **Description**: Implement `formatMoney(money, locale)`, `formatDate(date, locale)`, `formatNumber(n, locale)` per ARCHITECTURE.md §5.8 using `Intl.NumberFormat` / `Intl.DateTimeFormat`. `1 234,56 zł` for `pl`, etc.
- **Blocked by**: BE-003
- **Blocks**: WEB-016, MOB-009, I18N-006
- **Acceptance criteria**:
  - Snapshot tests for `en`, `uk`, `ru`, `pl` cover currency, date, number, and plural-sensitive samples.
  - No locale data shipped manually (rely on platform `Intl`).

#### BE-011: Auth domain — entities + ports

- **Area**: Backend
- **Effort**: M (~2d)
- **Description**: Per ARCHITECTURE.md §5.1 — define `User`, `Session`, `TotpSecret`, `HouseholdInvite` domain entities in `backend/src/domain/auth/`. Define ports: `UserRepo`, `PasswordHashing`, `TotpVerifier`, `OAuthProviderPort`, `RefreshTokenStore`, `HouseholdRepo`. No implementations.
- **Blocked by**: BE-004, BE-005
- **Blocks**: BE-012, BE-013
- **Acceptance criteria**:
  - Interface signatures match ARCHITECTURE.md §5.1 exactly.
  - No NestJS / I/O imports in domain layer.
  - Unit tests for any pure domain services (e.g. `HouseholdInvariants`).

#### BE-012: Auth use cases — register / login / magic link / OAuth / TOTP

- **Area**: Backend
- **Effort**: L (~4d)
- **Description**: Implement application-layer use cases per ARCHITECTURE.md §5.1: `RegisterUser`, `LoginWithPassword` (with TOTP step-up if bank connected), `RequestMagicLink`, `ConsumeMagicLink`, `LoginWithGoogle`, `EnableTotp`, `VerifyTotp`, `RefreshToken`, `Logout`, `GetCurrentUser`, `UpdateLocalePreference`. Depend only on ports.
- **Blocked by**: BE-011
- **Blocks**: BE-013, BE-015, SEC-007
- **Acceptance criteria**:
  - Each use case has a unit test with mocked ports.
  - `LoginWithPassword` enforces TOTP only if user has any active bank connection (matches PRD §4.1 + open question §5.1.2).
  - Argon2id hashing through `PasswordHashing` port.

#### BE-013: Auth infrastructure adapters

- **Area**: Backend
- **Effort**: M (~3d)
- **Description**: Implement `DrizzleUserRepo`, `DrizzleHouseholdRepo`, `Argon2PasswordHashing`, `OtplibTotpVerifier`, `GoogleOauthClient`, `JwtAccessTokenIssuer`, `RedisRefreshTokenStore` per ARCHITECTURE.md §5.1. Wire into Nest DI module.
- **Blocked by**: BE-012, BE-005
- **Blocks**: BE-015, SEC-001
- **Acceptance criteria**:
  - Integration test exercises a full register + login + refresh cycle against compose Postgres.
  - JWT access TTL = 15 min; refresh = 30 d (configurable).
  - Refresh tokens stored hashed in Redis.

#### BE-014: Household domain + invite flow

- **Area**: Backend
- **Effort**: M (~2d)
- **Description**: Implement `CreateHousehold`, `InviteToHousehold`, `AcceptInvite` use cases + adapters per ARCHITECTURE.md §5.1. M:N `household_users` table from day 1 (app-level invariant: 1 household per user in MVP).
- **Blocked by**: BE-012, BE-005
- **Blocks**: BE-015, every household-scoped repo
- **Acceptance criteria**:
  - Invite token is single-use, 7-day TTL, bound to email.
  - Accept-invite refuses tokens whose user already has a household.
  - Integration test covers full invite → accept flow.

#### BE-015: Auth presentation — REST controllers + DTOs + guards

- **Area**: Backend
- **Effort**: M (~2d)
- **Description**: NestJS controllers for every Auth endpoint listed in ARCHITECTURE.md §7. JWT auth guard reading `Authorization: Bearer`. DTOs validated via `class-validator`. `RequestContext` middleware populates `(userId, householdId, locale)`.
- **Blocked by**: BE-013, BE-014
- **Blocks**: WEB-005, BE-017, every bearer-protected endpoint
- **Acceptance criteria**:
  - All 14 auth endpoints from §7 routable and documented in OpenAPI.
  - Guard rejects missing / expired / malformed tokens.
  - `RequestContext` injected into every authenticated controller.

#### BE-016: BankConnection domain — entities + `BankConnectorPort`

- **Area**: Backend
- **Effort**: M (~2d)
- **Description**: Define `BankConnection`, `BankAccount`, `Consent`, `SyncRun`, `RawTransaction` types and the `BankConnectorPort` interface exactly per ARCHITECTURE.md §5.2. Domain service `ConsentExpiryPolicy` (7d / 1d / on-expiry).
- **Blocked by**: BE-004, BE-005
- **Blocks**: BE-017, BE-018, BE-019
- **Acceptance criteria**:
  - Interface matches §5.2 snippet exactly (TypeScript declaration).
  - `ConsentExpiryPolicy` unit-tested across 7d/1d/expired/active boundaries.
  - No vendor imports in domain layer.

#### BE-017: BankConnection use cases + REST controllers

- **Area**: Backend
- **Effort**: L (~4d)
- **Description**: Implement `InitiateBankConnection`, `CompleteBankConsent`, `ListUserConnections`, `RefreshConnection`, `DisconnectBank`, `ReconnectBank` use cases + REST endpoints from ARCHITECTURE.md §5.2 / §7. Bank catalogue endpoint reads from `BankConnectorRegistry`.
- **Blocked by**: BE-015, BE-016
- **Blocks**: BE-018, BE-019, WEB-010
- **Acceptance criteria**:
  - All 8 bank-connection endpoints from §7 work end-to-end with a stub connector.
  - `DisconnectBank` preserves transactions + accounts per PRD §4.2.
  - Integration test using a fake `BankConnectorPort` adapter.

#### BE-018: GoCardless adapter (`GoCardlessBankConnector`)

- **Area**: Backend
- **Effort**: XL (~7d)
- **Description**: Implement `GoCardlessBankConnector implements BankConnectorPort` per ARCHITECTURE.md §5.2. PSD2 consent flow for PKO BP (`BPKOPLPW`), 90-day expiry, sandbox bank for tests. Consent token encrypted via `Encryption` port. Includes account listing + transaction fetch + reconnect URL.
- **Blocked by**: BE-017, SEC-001
- **Blocks**: BE-024, QA-006
- **Acceptance criteria**:
  - Sandbox connect → complete → list-accounts → fetch-transactions full loop works.
  - Consent token is encrypted at rest (verified by DB inspection).
  - Rate-limit handling for 429 with `Retry-After`.
  - Idempotent: re-running `fetchTransactions(since)` produces no duplicates.

#### BE-019: Wise Personal API adapter (`WiseBankConnector`)

- **Area**: Backend
- **Effort**: L (~4d)
- **Description**: Implement `WiseBankConnector implements BankConnectorPort` per ARCHITECTURE.md §5.2. User pastes a Wise API token during connect (no OAuth). Encrypted at rest. Polling only; no webhooks in MVP.
- **Blocked by**: BE-017, SEC-001
- **Blocks**: BE-024
- **Acceptance criteria**:
  - Connect flow stores token via `Encryption`.
  - Lists balances across currencies as separate `BankAccount`s.
  - Transactions converted to `RawTransaction` (occurred_on, amount, currency, merchant, externalId).

#### BE-020: Transactions domain — entities + ports

- **Area**: Backend
- **Effort**: M (~2d)
- **Description**: Per ARCHITECTURE.md §5.3 — define `Transaction`, `TransactionMapping`, `Transfer`, `IngestBatch` types; ports `TransactionRepo`, `MappingRepo`, `TransferRepo`; domain services `IdempotentIngest`, `MappingSuggestion`.
- **Blocked by**: BE-004, BE-005
- **Blocks**: BE-021, BE-022, BE-024
- **Acceptance criteria**:
  - Interfaces match §5.3 snippets exactly.
  - `IdempotentIngest`: external_id present uses `(account_id, external_id)`; missing falls back to hash of `(account, date, amount, normalised_description)` per §5.3.1.

#### BE-021: Transactions use cases — ingest, manual, map, transfer, bulk

- **Area**: Backend
- **Effort**: XL (~6d)
- **Description**: Implement every use case from ARCHITECTURE.md §5.3: `IngestBankTransactions`, `CreateManualTransaction`, `UpdateTransactionNotes`, `MapTransaction`, `UnmapTransaction`, `MarkAsTransfer`, `LinkTransferCounterpart`, `IgnoreTransaction`, `BulkMap`, `BulkMarkAsTransfer`, `ListTransactions` (with cursor pagination + filters from PRD §4.3).
- **Blocked by**: BE-020, BE-005
- **Blocks**: BE-022, BE-024, BE-030, WEB-012
- **Acceptance criteria**:
  - All 10 use cases unit-tested with mocked repos.
  - `MapTransaction` writes `audit_log` and triggers `v_plan_actuals` refresh event.
  - `IngestBankTransactions` is idempotent on re-run with identical input.

#### BE-022: Transactions infrastructure + REST

- **Area**: Backend
- **Effort**: L (~4d)
- **Description**: `DrizzleTransactionRepo`, `DrizzleMappingRepo`, `DrizzleTransferRepo` plus REST controllers for the 7 transaction endpoints in ARCHITECTURE.md §7.
- **Blocked by**: BE-021
- **Blocks**: BE-024, WEB-012
- **Acceptance criteria**:
  - Cursor pagination works for 5 000-row fixture in < 100 ms.
  - All filters from PRD §4.3 supported via query string.
  - `transactions.spec.ts` tenancy test passes (household A can't read household B txns).

#### BE-023: BullMQ infrastructure — queues + worker bootstrap

- **Area**: Backend
- **Effort**: M (~2d)
- **Description**: Wire BullMQ per ARCHITECTURE.md §9 — queues `bank-sync`, `notification-dispatch`, `outbox-relay`, `period-close`, `ecb-fx`, `refresh-plan-actuals`. Per-connection concurrency 1 via `jobId = connectionId`. Per-provider rate-limiter group. Exponential backoff config (30s, 2m, 10m, 1h, 6h).
- **Blocked by**: BE-001, INF-010
- **Blocks**: BE-024, BE-029, BE-030, BE-033
- **Acceptance criteria**:
  - Worker bootstrap registers consumers for each queue.
  - Producing two jobs with the same `connectionId` serialises them.
  - Dead-letter after 5 failed attempts goes to a `dlq` queue.

#### BE-024: Bank-sync scheduler + processor

- **Area**: Backend
- **Effort**: L (~4d)
- **Description**: `@nestjs/schedule` enqueues `sync-connection` every 4 h per active connection plus on-demand. Worker processor calls `BankConnectorPort.fetchTransactions(since)`, calls `IngestBankTransactions`, writes `audit_log`, enqueues reconnect-reminder if `expiresAt < now + 7d`. Per ARCHITECTURE.md §9.
- **Blocked by**: BE-018, BE-019, BE-021, BE-023
- **Blocks**: QA-006, BE-029
- **Acceptance criteria**:
  - Scheduled job fires every 4 h in staging; manually-triggered `POST /bank-connections/:id/refresh` also enqueues.
  - `lastSuccessfulAt` written to `sync_runs`.
  - On 429 from provider, retry honours `Retry-After`.

#### BE-025: Plans domain — entities + ports

- **Area**: Backend
- **Effort**: M (~2d)
- **Description**: Per ARCHITECTURE.md §5.4 — `Plan`, `PlannedItem`, `PlannedItemVersion` entities; ports `PlanRepo`, `PlannedItemRepo`, `PlannedItemVersionRepo`, `PlanActualsReader`. Domain service `PlanCloning`. Invariant: ≤1 active plan per `(type, periodKind)` per user/household, except `custom`.
- **Blocked by**: BE-004, BE-005
- **Blocks**: BE-026, BE-030
- **Acceptance criteria**:
  - Interfaces match §5.4 exactly.
  - `PlanCloning` unit-tested for weekly/monthly/custom.
  - Invariant unit-tested.

#### BE-026: Plans use cases + REST + audit trail

- **Area**: Backend
- **Effort**: L (~5d)
- **Description**: Implement every plan use case from ARCHITECTURE.md §5.4 / §7: `CreatePlan`, `UpdatePlan`, `ClonePlanFromPrevious`, `ArchivePlan`, `ListActivePlans`, `GetPlanDashboard`, `AddPlannedItem`, `UpdatePlannedItem` (writes versioned row), `RemovePlannedItem`, `GetPlannedItemHistory`, `ClosePeriodSnapshot`. REST endpoints for all 10. Version-roll-up rule: consecutive same-user edits within 60 s coalesce in the UI but not in storage (per §5.4.2).
- **Blocked by**: BE-025
- **Blocks**: BE-030, BE-031, WEB-008, WEB-009
- **Acceptance criteria**:
  - All 10 endpoints from §7 work end-to-end with auth.
  - `UpdatePlannedItem` appends to `planned_item_versions` atomically.
  - `ClonePlanFromPrevious` defaults to next contiguous period; user-overridable.

#### BE-027: Categories domain + privacy + seed migration

- **Area**: Backend
- **Effort**: L (~3d)
- **Description**: Per ARCHITECTURE.md §5.5 — `Category` + `CategoryPrivacy` entities, ports, use cases (`ListCategories`, `CreateCategory`, `RenameCategory`, `ArchiveCategory`, `SetCategoryPrivacy`, `GetHouseholdCategoryAggregate`). Seed migration installs the 11 default categories from PRD §4.9 with `seed_key` and localised names for `en/uk/ru/pl`.
- **Blocked by**: BE-005, BE-008
- **Blocks**: BE-026 (categories used by planned items), BE-031, WEB-015
- **Acceptance criteria**:
  - Seed migration inserts 11 categories with `seed_key` set.
  - Privacy demotion invalidates `categoryAggregate` cache tag.
  - All 6 endpoints from §7 covered by integration tests.

#### BE-028: FX domain — ECB ingest + `FxRateProvider`

- **Area**: Backend
- **Effort**: L (~3d)
- **Description**: Per ARCHITECTURE.md §5.6 — `EcbFxRateProvider implements FxRateProvider`, `DrizzleFxRateRepo`, `IngestEcbDailyRates` use case, `GetFxRate` endpoint, `UpdateCurrencyPreferences`. Cron `0 16 * * 1-5` CET. Frankfurter fallback for UAH/RUB per §5.6.2. Carry-forward up to 7 d for missing dates.
- **Blocked by**: BE-005, BE-007, BE-023
- **Blocks**: BE-030, WEB-016, MOB-009
- **Acceptance criteria**:
  - Daily cron pulls ECB XML and upserts `fx_rates`.
  - Cross-rates derived against EUR pivot match within 0.0001.
  - `rate_on_date` UNIQUE per `(base, quote, rate_on_date)`.
  - Frankfurter fallback fires only when ECB pair is missing.

#### BE-029: Notifications — outbox, channel, templates, scheduler

- **Area**: Backend
- **Effort**: XL (~7d)
- **Description**: Per ARCHITECTURE.md §5.7 — `notifications_outbox` + `EnqueueNotification` (atomic with producing tx), `DispatchNotification` worker, `ResendEmailChannel`, `MjmlTemplateRenderer`, `OverBudgetDetector`, `RunWeeklyDigest` (Mon 08:00 local), `RunReconnectReminders` (daily — 7d/1d/expiry). MJML templates for each kind in all four locales. Dedupe key uniqueness per `(userId, kind, dedupeKey)`. Resend bounce-webhook handler.
- **Blocked by**: BE-023, BE-024, BE-026, I18N-005
- **Blocks**: QA-007
- **Acceptance criteria**:
  - All 3 notification kinds fire end-to-end against Mailpit in dev.
  - Emails arrive in recipient's preferred locale (PRD §4.10).
  - Re-dispatch is idempotent on outbox `id`.
  - Bounce webhook flips `emailBouncing` and suppresses retries.

#### BE-030: Dashboard query endpoint + materialised view

- **Area**: Backend
- **Effort**: L (~5d)
- **Description**: Per ARCHITECTURE.md §5.9 — `v_plan_actuals` materialised view (created by migration), `DrizzlePlanActualsReader`, `RecomputePlanActuals` worker job (debounced 250 ms). `GET /plans/:id/dashboard` endpoint. Falls back to pure `computePlanActuals` for cold paths.
- **Blocked by**: BE-006, BE-021, BE-026, BE-028
- **Blocks**: BE-031, WEB-013, QA-008
- **Acceptance criteria**:
  - `GET /plans/:id/dashboard` returns the canonical `PlanActualsView` shape.
  - Mat-view refreshed on every mapping change within 1 s.
  - Result is deterministic vs. `computePlanActuals` (parity test).

#### BE-031: Dashboard household + unplanned endpoints

- **Area**: Backend
- **Effort**: M (~2d)
- **Description**: `GET /plans/:id/dashboard/unplanned?direction=` (paginated unplanned tx list per PRD §4.11 "tap to list") and `GET /households/:id/dashboard?planId=` (household roll-up honouring per-category privacy via `aggregateByCategoryWithPrivacy`).
- **Blocked by**: BE-030, BE-027, BE-008
- **Blocks**: WEB-013, WEB-021
- **Acceptance criteria**:
  - Household endpoint respects all three privacy levels.
  - `accountId` never present in `full_detail` responses (regression test).

#### BE-032: Dashboard performance — k6 budget gate

- **Area**: Backend
- **Effort**: M (~2d)
- **Description**: Seed staging DB with a 12-month / 5 000-row fixture per ARCHITECTURE.md §10.1. Run k6 load test against `GET /plans/:id/dashboard` and assert p95 < 500 ms (PRD §6 perf NFR). CI gate fails the build above the budget. Per ARCHITECTURE.md §11 sprint 7 / §12 risk.
- **Blocked by**: BE-030, INF-013
- **Blocks**: none (final gate)
- **Acceptance criteria**:
  - k6 script committed under `tests/perf/`.
  - CI workflow runs against staging on PRs labelled `perf`.
  - Build fails when p95 > 500 ms.

#### BE-033: Outbox-relay worker + period-close job

- **Area**: Backend
- **Effort**: M (~2d)
- **Description**: Worker consumer that drains `notifications_outbox` (claim-pending + dispatch + mark-sent). Separate `period-close` cron at 00:30 UTC writes `leftover_snapshots`. Per ARCHITECTURE.md §5.4 / §9.
- **Blocked by**: BE-023, BE-029
- **Blocks**: QA-007
- **Acceptance criteria**:
  - Outbox events sent to channel exactly once on happy path; at-least-once with idempotent consumer on retry.
  - Period-close runs nightly, idempotent on `(plan_id, period_end)`.

#### BE-034: Data export + household deletion

- **Area**: Backend
- **Effort**: L (~3d)
- **Description**: Per ARCHITECTURE.md §6 — `ExportHouseholdData` use case (async via job; writes signed-URL JSON to S3-compatible storage with 24 h TTL). `DeleteHousehold` schedules 30-day soft hold then hard delete + anonymise audit refs.
- **Blocked by**: BE-022, BE-026, BE-027
- **Blocks**: QA-005, SEC-005
- **Acceptance criteria**:
  - Export JSON contains every row the household owns except encrypted blobs.
  - Signed URL TTL = 24 h.
  - Soft-hold prevents user login but data is recoverable until day 30.

#### BE-035: Audit log API + `AuditLogger` port

- **Area**: Backend
- **Effort**: M (~2d)
- **Description**: Per ARCHITECTURE.md §6 — `AuditLogger` port; `DrizzleAuditEventRepo` (INSERT-only). DB role `audit_admin` for redaction. `GET /audit-log?subjectType=&subjectId=&from=&to=` endpoint, household-scoped, paginated.
- **Blocked by**: BE-005, BE-015
- **Blocks**: WEB-019, SEC-004
- **Acceptance criteria**:
  - Every state-changing use case writes one `AuditEvent` (verified via integration test sweep).
  - App role lacks `UPDATE`/`DELETE` on `audit_log`.

#### BE-036: Row-Level Security policies + tenancy spec

- **Area**: Backend
- **Effort**: M (~2d)
- **Description**: Per ARCHITECTURE.md §6 — Postgres RLS policy on every tenant table (`USING household_id = current_setting('app.household_id')::uuid`). App workers `SET LOCAL` per request. Tenancy integration test asserts every REST endpoint refuses cross-tenant reads/writes. RLS enabled in CI + prod; off in dev.
- **Blocked by**: BE-015, BE-022, BE-026, BE-027, BE-034
- **Blocks**: SEC-004, QA-009
- **Acceptance criteria**:
  - `tenancy.spec.ts` covers every authenticated endpoint listed in §7.
  - RLS policies fail an unauthorised query at the DB layer even if app filter is bypassed.

#### BE-037: ESLint rule — `no-repo-without-scope`

- **Area**: Backend
- **Effort**: S (~1d)
- **Description**: Custom ESLint rule (or `eslint-plugin-local-rules`) that flags any repo-port method call missing the `HouseholdScope` argument. Per ARCHITECTURE.md §6 (Multi-tenancy).
- **Blocked by**: BE-020, BE-026, BE-027
- **Blocks**: none (defence-in-depth)
- **Acceptance criteria**:
  - Lint rule fails CI when a repo method is called without scope.
  - Rule has a fixture-based unit test.

#### BE-038: OpenAPI / Swagger documentation

- **Area**: Backend
- **Effort**: S (~1d)
- **Description**: NestJS Swagger module emits OpenAPI 3.1 at `/docs` (staging only). Every controller annotated with response shapes from `@power-budget/core` types. Used by web/mobile to validate API client types.
- **Blocked by**: BE-015, BE-017, BE-022, BE-026, BE-027, BE-028
- **Blocks**: WEB-004, MOB-003
- **Acceptance criteria**:
  - `/docs` reachable in staging.
  - Generated `openapi.json` committed in CI artefact.
  - Type drift between core types and DTOs surfaces as a CI failure.

---

### §4.3 Frontend Web (`WEB-`)

#### WEB-001: Scaffold `packages/web` (Vite + React + TS)

- **Area**: Web
- **Effort**: S (~1d)
- **Description**: Bootstrap Vite + React 18 + TypeScript app as a **thin UI wrapper** per ARCHITECTURE.md §4. Add `vite.config.ts`, env handling, SPA HTML shell, React Router 6 skeleton, and `@web/*` path alias. The package contains only `ui/content/` components and platform-specific adapters (`LocalStorageTokenStore`, `ReactRouterNavigationAdapter`). Application logic lives in `@power-budget/shared-app` (INF-015). Re-exports `@power-budget/core` domain types from `src/domain/`.
- **Blocked by**: INF-002, INF-003, BE-002, INF-015
- **Blocks**: WEB-002, WEB-003, INF-011, INF-014
- **Acceptance criteria**:
  - `pnpm --filter web dev` boots on a local port.
  - `vite build` produces a static bundle.
  - `import { createAuthContext } from '@power-budget/shared-app'` resolves successfully.
  - No use-case or ReactiveView code in `packages/web/src/` (belongs in `shared-app`).

#### WEB-002: Routing + protected-route wrapper

- **Area**: Web
- **Effort**: S (~1d)
- **Description**: React Router 6 with route definitions for every screen in ARCHITECTURE.md §5.x presentation layers. `<RequireAuth>` wrapper redirects to login if no access token. `<RequireTotp>` redirects to TOTP step-up when required.
- **Blocked by**: WEB-001
- **Blocks**: WEB-005, WEB-006, every screen task
- **Acceptance criteria**:
  - Unauthenticated visit to `/dashboard` lands at `/login`.
  - Deep link is preserved across the redirect.
  - Route boundaries lazy-load chunked screens.

#### WEB-003: MobX + ReactiveView wiring

- **Area**: Web
- **Effort**: XS (~0.5d)
- **Description**: Wire `@power-budget/shared-app`'s `MobXReactiveView`, `connect()` HOC, and `ApiClient` into `packages/web`. This task adds only the web-specific wiring: `LocalStorageTokenStore`, `ReactRouterNavigationAdapter`, and the top-level React context providers (`<Auth>`, `<Dashboard>`, etc.) that compose the shared context factories from `shared-app`. Per ARCHITECTURE.md §3 and §4. Most of the MobX plumbing ships in INF-015.
- **Blocked by**: WEB-001, INF-015
- **Blocks**: WEB-004, every feature context task
- **Acceptance criteria**:
  - All `shared-app` context factories are wired to platform-specific adapters (token store, navigation) and provided at the app root.
  - `ApiClient` handles 401 → refresh → retry; second 401 dispatches logout via the `AuthView`.
  - Tokens persisted to `localStorage` via `LocalStorageTokenStore implements SecureTokenStore`.
  - No Redux / RTK packages in `package.json`.

#### WEB-004: Typed API client generated from OpenAPI

- **Area**: Web
- **Effort**: S (~1d)
- **Description**: Use `openapi-typescript` to generate request/response types from `openapi.json` (produced by BE-038). The generated types and `Http*Repo` adapters in `shared-app/src/*/api/` import from them. Build step fails when the OpenAPI spec and adapter types drift. The `pnpm codegen` script runs from `packages/shared-app`.
- **Blocked by**: WEB-003, BE-038
- **Blocks**: WEB-005, WEB-008, WEB-010, WEB-012, WEB-013
- **Acceptance criteria**:
  - `pnpm --filter @power-budget/shared-app codegen` regenerates types from the spec.
  - Type mismatch between an endpoint and its consuming adapter is a TS error.
  - No hand-written DTO types duplicating the OpenAPI contract.

#### WEB-005: Auth screens — Login, Signup, Magic-link, OAuth callback

- **Area**: Web
- **Effort**: L (~3d)
- **Description**: Build the four entry screens listed in ARCHITECTURE.md §5.1 — `LoginScreen` (email/pw + TOTP field if required), `RegisterScreen`, `MagicLinkScreen` (request + consume), `OAuthCallbackScreen` (handles Google redirect). All strings via `react-intl`.
- **Blocked by**: WEB-002, WEB-004, BE-015, DES-001, I18N-002
- **Blocks**: WEB-006, WEB-007
- **Acceptance criteria**:
  - All four flows end at an authenticated session.
  - Form validation uses shared core error types.
  - Visual matches Design tokens; no hardcoded strings.

#### WEB-006: TOTP enrolment screen

- **Area**: Web
- **Effort**: M (~2d)
- **Description**: Per ARCHITECTURE.md §5.1 — `TotpEnrollmentScreen` displays a QR code (otpauth URI from `POST /auth/totp/enable`), accepts the first verification code, and surfaces recovery codes. Required by the bank-connect flow.
- **Blocked by**: WEB-005
- **Blocks**: WEB-010
- **Acceptance criteria**:
  - QR encodes the URI returned by the backend.
  - User must scan + verify before completion.
  - Recovery codes shown exactly once with a print/copy affordance.

#### WEB-007: Onboarding flow (4–5 step wizard)

- **Area**: Web
- **Effort**: M (~2d)
- **Description**: Per PRD §4.1 onboarding: confirm language → base currency → interesting currencies → connect first bank (optional) → create first plan (optional). State held in an `OnboardingReactiveView`; skippable steps.
- **Blocked by**: WEB-005, WEB-016, BE-028
- **Blocks**: none
- **Acceptance criteria**:
  - Auto-detected language pre-filled from browser.
  - Skipped steps land at dashboard with placeholder state.

#### WEB-008: Plans list + plan editor screens

- **Area**: Web
- **Effort**: L (~4d)
- **Description**: Per ARCHITECTURE.md §5.4 — `PlansList`, `PlanEditor` (add/edit planned items, period picker, baseCurrency selector), `ClonePlanModal`, `CustomPeriodPicker`. Versioned-edit submit writes to backend; UI roll-up of consecutive same-user edits within 60 s.
- **Blocked by**: WEB-004, BE-026, DES-002
- **Blocks**: WEB-013, WEB-019
- **Acceptance criteria**:
  - All plan CRUD reachable end-to-end.
  - Custom period picker enforces start ≤ end.
  - Planned items inline-editable with optimistic updates.

#### WEB-009: Planned-item history drawer

- **Area**: Web
- **Effort**: S (~1d)
- **Description**: Lazy-loads `GET /plans/:id/items/:itemId/history` per ARCHITECTURE.md §5.4. Shown as a side drawer with timestamp, user, before/after. Per PRD §4.5 versioning + audit-trail requirement.
- **Blocked by**: WEB-008
- **Blocks**: none
- **Acceptance criteria**:
  - Drawer opens from a history icon next to each planned item.
  - Consecutive same-user edits within 60 s are rolled up in the UI.

#### WEB-010: Bank connections — list, add, reconnect banner

- **Area**: Web
- **Effort**: L (~3d)
- **Description**: Per ARCHITECTURE.md §5.2 — `BankConnectionsList`, `AddBankFlow` (pick provider → bank → history depth → consent redirect → review accounts), global `ReconnectBanner` (`expiresAt < now + 7d`), `SyncStatusChip`. Handles OAuth-style redirect-back from GoCardless.
- **Blocked by**: WEB-004, WEB-006, BE-017, DES-003
- **Blocks**: WEB-013
- **Acceptance criteria**:
  - Full PKO sandbox connect flow succeeds end-to-end.
  - Reconnect banner appears in the 7-day window and links to `POST /bank-connections/:id/reconnect`.
  - Sync status reads `lastSuccessfulAt` and renders "Last synced X min ago".

#### WEB-011: OAuth bridge — Google + bank consent redirects

- **Area**: Web
- **Effort**: S (~1d)
- **Description**: Two dedicated routes — `/auth/oauth/google/callback` and `/bank/consent/callback` — that parse query-string state + token / code and POST to the appropriate backend endpoint. Per ARCHITECTURE.md §5.1 / §5.2.
- **Blocked by**: WEB-005, WEB-010
- **Blocks**: none
- **Acceptance criteria**:
  - Both callbacks succeed with sandbox / staging provider.
  - State parameter validated against a session-stored nonce.

#### WEB-012: Transactions list + detail modal + filters

- **Area**: Web
- **Effort**: L (~4d)
- **Description**: Per ARCHITECTURE.md §5.3 — `TransactionsList` with cursor-paginated infinite scroll, filters from PRD §4.3 (date range, category, mapped/unmapped/transfer, currency, source, text search). `TransactionDetail` modal with mapping picker (suggestions float to top), transfer-mark, ignore, edit-notes.
- **Blocked by**: WEB-004, BE-022, BE-021, DES-004
- **Blocks**: WEB-013, WEB-014
- **Acceptance criteria**:
  - 5 000-row fixture renders smoothly with no layout shift.
  - All filters compose; URL reflects state.
  - Optimistic mapping updates roll back on server error.

#### WEB-013: Dashboard screen (the home)

- **Area**: Web
- **Effort**: L (~4d)
- **Description**: Per ARCHITECTURE.md §5.9 + PRD §4.11 — `Dashboard` screen consumes `GET /plans/:id/dashboard`. Components: `PlanHeader`, `IncomeSection`, `ExpenseSection` (progress bars red/amber/green), `UnplannedSection`, `LeftoverBucket`, `BottomLine` with `MoneyView` switcher. Tab strip across active plans (personal monthly default, custom on tabs).
- **Blocked by**: WEB-004, WEB-008, WEB-010, WEB-012, BE-030, BE-031, DES-005
- **Blocks**: WEB-014, WEB-019
- **Acceptance criteria**:
  - All PRD §4.11 widgets visible.
  - Polls every 30 s when in foreground (per ARCHITECTURE §5.9 OQ4).
  - Switching currency in `BottomLine` does not hit the network.

#### WEB-014: Bulk action bar + mapping modal

- **Area**: Web
- **Effort**: M (~2d)
- **Description**: Per ARCHITECTURE.md §5.3 — multi-select on transactions list with a sticky `BulkActionBar` ("Map all", "Mark as Transfer", "Ignore"). Mapping modal lists active plans → planned items; heuristic suggestion floats to top.
- **Blocked by**: WEB-012, WEB-013
- **Blocks**: none
- **Acceptance criteria**:
  - Bulk-map dispatches a single `POST /transactions/bulk`.
  - Selection clears on completion.
  - Suggestion item is visually distinct.

#### WEB-015: Categories management screen

- **Area**: Web
- **Effort**: M (~2d)
- **Description**: Per ARCHITECTURE.md §5.5 — `CategoriesScreen` list with rename / archive / privacy toggle per row. Category picker modal reused from transactions/plans.
- **Blocked by**: WEB-004, BE-027, DES-006
- **Blocks**: WEB-021
- **Acceptance criteria**:
  - Privacy toggle change reflects immediately via cache invalidation.
  - Archive hides from new-item pickers but keeps history visible.

#### WEB-016: Currency switcher + `MoneyView` component

- **Area**: Web
- **Effort**: S (~1d)
- **Description**: Per ARCHITECTURE.md §5.6 — `MoneyView` renders original currency + cycles through user's interesting currencies on tap. Reads from `fxApi` cache; conversion entirely client-side. Tooltip shows source + date.
- **Blocked by**: WEB-004, BE-010, BE-028
- **Blocks**: WEB-007, WEB-013
- **Acceptance criteria**:
  - Tap cycles through `[original, base, ...interesting]`.
  - Rate source + date visible in tooltip.
  - Falls back to "rate unavailable" when no rate within 7-day carry-forward.

#### WEB-017: Locale switcher + i18n provider wiring

- **Area**: Web
- **Effort**: S (~1d)
- **Description**: Wire `react-intl` `IntlProvider` from `locale` slice; `LocaleSwitcher` in Settings. Persists to `localStorage` + best-effort `PATCH /me`. Switches instantly with no reload per PRD §4.12.
- **Blocked by**: WEB-001, I18N-002, BE-015
- **Blocks**: WEB-005, WEB-007, WEB-018, every screen with strings
- **Acceptance criteria**:
  - Switching locale updates UI in ≤ 100 ms.
  - Persisted across reload.

#### WEB-018: Settings screen (5 tabs)

- **Area**: Web
- **Effort**: M (~3d)
- **Description**: Settings shell with tabs: Profile, Locale, Currency preferences, Notifications (digest + thresholds), Data & Privacy (export, delete). Reuses controls from WEB-016, WEB-017. Per PRD §4.10 / §4.4 / §4.1.
- **Blocked by**: WEB-017, WEB-016, BE-029, BE-034
- **Blocks**: none
- **Acceptance criteria**:
  - All 5 tabs implemented.
  - Notification thresholds expose 50–100% sliders.
  - Data export action returns a signed URL within 60 s end-to-end.

#### WEB-019: Audit-log drawer wired into plan items

- **Area**: Web
- **Effort**: S (~1d)
- **Description**: Per ARCHITECTURE.md §5.10 — `AuditLogDrawer` consumes `GET /audit-log?subjectType=planned_item&subjectId=…`. Reused with `WEB-009` history drawer.
- **Blocked by**: WEB-013, BE-035
- **Blocks**: none
- **Acceptance criteria**:
  - Drawer lists every audit event for the subject with actor + timestamp.

#### WEB-020: Manual transaction entry form

- **Area**: Web
- **Effort**: S (~1d)
- **Description**: Per PRD §4.3 — `ManualTransactionForm` for cash/IOUs. Source flag set to `manual`. Reused inside Transactions screen and onboarding/empty states.
- **Blocked by**: WEB-012, BE-021
- **Blocks**: none
- **Acceptance criteria**:
  - Form fields: account, occurred_on, amount + currency, description, notes.
  - Submits via `POST /transactions`.

#### WEB-021: Household drill-in view (privacy-aware)

- **Area**: Web
- **Effort**: M (~2d)
- **Description**: Per ARCHITECTURE.md §5.5 — `HouseholdCategoryDrillIn` renders the partner's spend in a category at the partner-chosen privacy level (total / total+counts / full). Reuses `GET /categories/:id/aggregate`.
- **Blocked by**: WEB-015, WEB-013, BE-031
- **Blocks**: none
- **Acceptance criteria**:
  - Three privacy views visually distinct.
  - No `accountId` leaks at any level.

#### WEB-022: Loading / empty / error states + skeletons

- **Area**: Web
- **Effort**: M (~2d)
- **Description**: Apply consistent skeleton loaders, empty illustrations, and error banners (from DES-007) across every screen. Includes bank-sync-failure banner per PRD reliability NFR.
- **Blocked by**: WEB-013, WEB-012, WEB-008, DES-007
- **Blocks**: none
- **Acceptance criteria**:
  - Every list/section has a skeleton during initial fetch.
  - Network error displays a retry banner; the rest of the app remains usable.

---

### §4.4 Mobile — React Native + Expo (`MOB-`)

#### MOB-001: Scaffold `packages/mobile` (Expo + RN + TS)

- **Area**: Mobile
- **Effort**: M (~2d)
- **Description**: Bootstrap React Native + Expo as a **thin UI wrapper** per ARCHITECTURE.md §4. Add `app.json`, Metro config with `watchFolders` for the workspace symlinks (validated in INF-015). The package contains only `ui/content/` RN components and platform-specific adapters (`ExpoSecureStoreTokenStore`, `ReactNavigationAdapter`). Application logic lives in `@power-budget/shared-app` (INF-015).
- **Blocked by**: INF-002, INF-003, BE-002, INF-015
- **Blocks**: MOB-002, MOB-003, INF-014
- **Acceptance criteria**:
  - `pnpm --filter mobile start` opens Metro for iOS simulator.
  - `eas build --platform ios --profile development` succeeds.
  - Metro resolves `@power-budget/shared-app` without crashing.
  - No use-case or ReactiveView code in `packages/mobile/src/`.

#### MOB-002: React Navigation stack + tabs

- **Area**: Mobile
- **Effort**: S (~1d)
- **Description**: React Navigation native stack + bottom tabs for Dashboard / Transactions / Plans / Settings. Auth stack separate. Per ARCHITECTURE.md §5.x mobile presentation layers.
- **Blocked by**: MOB-001
- **Blocks**: MOB-005, MOB-006, MOB-007, MOB-008
- **Acceptance criteria**:
  - Tab + stack navigation works on iOS simulator.
  - Protected-route guard mirrors web behaviour.

#### MOB-003: MobX + ReactiveView wiring (mobile)

- **Area**: Mobile
- **Effort**: XS (~0.5d)
- **Description**: Wire `@power-budget/shared-app` into `packages/mobile`. Add `ExpoSecureStoreTokenStore`, `ReactNavigationAdapter`, and the top-level React Native providers wrapping the shared context factories. Validate Metro resolver for `@power-budget/shared-app` in the Expo bundle (INF-015 proves the Metro config — this task wires it for mobile's feature scope).
- **Blocked by**: MOB-001, BE-038, INF-015
- **Blocks**: every API-consuming screen
- **Acceptance criteria**:
  - `MobXReactiveView` boots in the Expo RN runtime (no DOM dependency).
  - `connect()` wraps an RN component with `observer()`; tapping a button that calls a use case causes only the connected fields to re-render.
  - Auth interceptor handles 401 refresh-and-retry on the mobile network stack.
  - No Redux / RTK packages in `package.json`.

#### MOB-004: Secure storage for tokens — `expo-secure-store`

- **Area**: Mobile
- **Effort**: S (~1d)
- **Description**: `SecureTokenStore` adapter wrapping `expo-secure-store` per ARCHITECTURE.md §5.1. Access + refresh tokens persisted to the iOS Keychain; never written to AsyncStorage.
- **Blocked by**: MOB-003
- **Blocks**: MOB-005
- **Acceptance criteria**:
  - Tokens survive an app cold start.
  - Tokens cleared on logout.
  - No tokens visible via `AsyncStorage` inspection.

#### MOB-005: Auth screens — Login, Signup, Magic-link, OAuth

- **Area**: Mobile
- **Effort**: M (~3d)
- **Description**: RN versions of WEB-005 — `LoginScreen` (incl. TOTP step-up), `RegisterScreen`, `MagicLinkScreen`, OAuth via in-app browser + deep-link callback.
- **Blocked by**: MOB-002, MOB-004, BE-015, DES-002, I18N-002
- **Blocks**: MOB-006, MOB-007
- **Acceptance criteria**:
  - Full auth loop succeeds on iOS simulator and a real device.
  - All four flows produce a usable session.

#### MOB-006: TOTP enrolment + 2FA on iOS

- **Area**: Mobile
- **Effort**: M (~2d)
- **Description**: Per ARCHITECTURE.md §5.1 — iOS-specific TOTP enrolment screen with QR code (`otpauth://`) deep-linkable to Authenticator / 1Password. Recovery codes flow.
- **Blocked by**: MOB-005
- **Blocks**: none
- **Acceptance criteria**:
  - QR opens directly in any TOTP app via `otpauth://` deep-link.
  - Recovery codes shareable once.

#### MOB-007: Deep linking — magic-link + OAuth callback

- **Area**: Mobile
- **Effort**: M (~2d)
- **Description**: Configure iOS Universal Links for `https://<domain>/auth/magic-link` and the OAuth callback `https://<domain>/auth/oauth/google/callback`. Per PRD §4.1.
- **Blocked by**: MOB-005, INF-013
- **Blocks**: none
- **Acceptance criteria**:
  - Tapping a magic-link email on iOS opens the app and consumes the token.
  - Google OAuth round-trip returns to the app via Universal Link.

#### MOB-008: Biometric unlock (Face ID / Touch ID)

- **Area**: Mobile
- **Effort**: S (~1d)
- **Description**: `expo-local-authentication` gates app open after backgrounding > N minutes. Tokens stay in keychain; biometric only unlocks the app shell.
- **Blocked by**: MOB-004
- **Blocks**: none
- **Acceptance criteria**:
  - First open after install offers opt-in.
  - Face ID prompts after 5-min background; falls back to passcode.

#### MOB-009: Locale resolution + i18n provider

- **Area**: Mobile
- **Effort**: S (~1d)
- **Description**: Per ARCHITECTURE.md §5.8 — `expo-localization` for device locale; `LocaleResolver` picks effective locale; `react-intl` provider wired; same bundles as web shipped in Expo asset graph.
- **Blocked by**: MOB-001, I18N-002, BE-010, BE-028
- **Blocks**: MOB-005, MOB-010, MOB-011, MOB-012
- **Acceptance criteria**:
  - First open uses device locale.
  - Setting "Polish" persists across reload.
  - Currency / date / number formatting via shared formatters from `core`.

#### MOB-010: Dashboard screen (mobile parity)

- **Area**: Mobile
- **Effort**: L (~3d)
- **Description**: RN port of WEB-013 — same data shape, mobile-tuned layout (stacked sections, tappable lines, swipe-down to refresh). Per ARCHITECTURE.md §5.9 presentation layer.
- **Blocked by**: MOB-002, MOB-009, BE-030, BE-031, DES-005
- **Blocks**: MOB-013
- **Acceptance criteria**:
  - All PRD §4.11 widgets present.
  - Pull-to-refresh invalidates the `PlanActuals` tag.

#### MOB-011: Transactions list + detail + mapping modal

- **Area**: Mobile
- **Effort**: L (~3d)
- **Description**: RN port of WEB-012 — virtualised list, filter sheet, transaction detail full-screen modal with mapping picker. Per ARCHITECTURE.md §5.3.
- **Blocked by**: MOB-009, BE-022, DES-004
- **Blocks**: MOB-013
- **Acceptance criteria**:
  - 5 000-row fixture scrolls at 60 fps on iPhone 12+ class device.
  - Mapping change is optimistic with rollback.

#### MOB-012: Plans list + planned-item editor (mobile parity)

- **Area**: Mobile
- **Effort**: M (~3d)
- **Description**: RN port of WEB-008 — list, editor, custom period picker. Versioning UX matches web.
- **Blocked by**: MOB-009, BE-026, DES-002
- **Blocks**: none
- **Acceptance criteria**:
  - All plan CRUD reachable on iOS.

#### MOB-013: Notification routing layer (push placeholder)

- **Area**: Mobile
- **Effort**: S (~1d)
- **Description**: Per ARCHITECTURE.md §5.7 — wire a `NotificationChannel` shape on the client side so v2 can plug in `expo-notifications` without rewriting business logic. MVP: register no-op receiver; emails remain the sole channel.
- **Blocked by**: MOB-001
- **Blocks**: none (v2-readiness)
- **Acceptance criteria**:
  - Architecture stub committed; documented in code comment that v2 enables `expo-notifications`.

#### MOB-014: TestFlight pipeline + App Store metadata

- **Area**: Mobile
- **Effort**: M (~2d)
- **Description**: EAS Submit configuration for App Store Connect. App Store metadata: name, descriptions in all 4 locales, screenshots, privacy nutrition labels. Internal TestFlight track for the two users. Per ARCHITECTURE.md §10 mobile deployment.
- **Blocked by**: MOB-010, MOB-011, MOB-012, DES-001
- **Blocks**: QA-009
- **Acceptance criteria**:
  - TestFlight build available to the two MVP users.
  - Privacy labels declare "Financial Info — App Functionality" usage.

---

### §4.5 Design (`DES-`)

#### DES-001: Design tokens — CSS variables + RN style tokens

- **Area**: Design
- **Effort**: M (~2d)
- **Status**: ✅ Done — [PR #3](https://github.com/dcervonyj/power-budget/pull/3)
- **Description**: Extract design tokens (colours, spacing scale, type ramp, radii, shadows, breakpoints) from `docs/mvp/design-arctic/` into CSS custom properties for web and a parallel TS object for RN. Single source via a `tokens.ts` file generated to both formats. **Arctic Blue palette** (option 22, approved) is the authoritative source.
- **Blocked by**: none
- **Blocks**: WEB-005, MOB-005, every styled component
- **Acceptance criteria**:
  - `tokens.ts` / `themes.ts` is the canonical source; web CSS and RN objects are generated from it.
  - Both **dark and light** themes fully implemented in MVP — no stubs.
  - Token names align between web CSS variables (`--pb-…`) and RN camelCase object.

#### DES-002: Component library scaffold — Button, Input, Select, Modal

- **Area**: Design
- **Effort**: M (~3d)
- **Description**: Build the base 6–8 components used by every screen (Button, Input, Select, Toggle, Modal, Drawer, ProgressBar). Same API surface on web + RN; styled with tokens.
- **Blocked by**: DES-001
- **Blocks**: WEB-005, WEB-008, MOB-005, MOB-012
- **Acceptance criteria**:
  - Storybook (web) demonstrates each component in all states.
  - RN equivalents exposed via parallel `<Button />` etc.

#### DES-003: Bank-connect flow visuals

- **Area**: Design
- **Effort**: S (~1d)
- **Description**: Visuals for the bank-picker, history-window picker, consent-redirect spinner, success state. Per PRD §4.2.
- **Blocked by**: DES-002
- **Blocks**: WEB-010, MOB-005 (reuse)
- **Acceptance criteria**:
  - Empty / loading / error variants documented.

#### DES-004: Transaction list + detail visuals

- **Area**: Design
- **Effort**: S (~1d)
- **Description**: Visuals for the list row (date, merchant, amount, mapped badge, source icon), filter sheet, detail modal, mapping picker.
- **Blocked by**: DES-002
- **Blocks**: WEB-012, MOB-011
- **Acceptance criteria**:
  - List row supports unmapped/mapped/transfer/ignored variants.

#### DES-005: Dashboard visuals — sections, progress bars, leftover

- **Area**: Design
- **Effort**: M (~2d)
- **Description**: Visuals for the home screen: plan header, income/expense sections, red/amber/green progress bars, unplanned section, leftover bucket card, bottom-line panel. Per PRD §4.11.
- **Blocked by**: DES-002
- **Blocks**: WEB-013, MOB-010
- **Acceptance criteria**:
  - Over-budget red state visible at a glance.
  - Currency switcher affordance is discoverable.

#### DES-006: Categories + privacy visuals

- **Area**: Design
- **Effort**: S (~1d)
- **Description**: Icon set for pre-seeded categories + privacy-level toggles (total / total+counts / full). Per PRD §4.9.
- **Blocked by**: DES-002
- **Blocks**: WEB-015, WEB-021
- **Acceptance criteria**:
  - 11 default-category icons delivered as SVG.
  - Three privacy-level visuals differ at a glance.

#### DES-007: Empty / loading / error illustration kit

- **Area**: Design
- **Effort**: S (~1d)
- **Description**: SVG illustrations for empty states (no plan yet, no transactions yet), network error, sync failure banner. Per PRD reliability NFR.
- **Blocked by**: DES-001
- **Blocks**: WEB-022, MOB-010, MOB-011
- **Acceptance criteria**:
  - One illustration per state; all in single SVG file with tokenised colours.

#### DES-008: Light / Dark Theme Switching — toggle, persistence, no-FOUC

- **Area**: Design
- **Effort**: S (~1d)
- **Description**: Wire the runtime light/dark theme toggle into the web and mobile apps. Web: `data-theme` attribute on `<html>`, `localStorage` persistence, no-FOUC inline script in `index.html`, `ThemeProvider` React context, `useTheme()` hook, `ThemeToggle` button. Mobile: `ThemeProvider` context swaps `RnTheme` object from `DES-001`, `AsyncStorage` persistence, `Appearance` system-preference fallback. Detailed plan: `docs/mvp/plans/DES-008-theme-switching.md`.
- **Blocked by**: DES-001, DES-002
- **Blocks**: WEB-005 (layout shell needs toggle), MOB-005 (mobile shell needs ThemeProvider)
- **Acceptance criteria**:
  - No FOUC on web reload with saved preference.
  - Theme persists across reloads (web) and app backgrounding (mobile).
  - System `prefers-color-scheme` is honoured on first load (no saved pref).
  - `ThemeToggle` accessible in sidebar footer (web) and Settings screen (mobile).

---

### §4.6 i18n / Content (`I18N-`)

#### I18N-001: String-extraction infrastructure + ICU pipeline

- **Area**: i18n
- **Effort**: M (~2d)
- **Description**: Set up `react-intl` extract → ICU JSON pipeline. Resource bundles under `packages/web/public/locales/<code>.json` and `packages/mobile/assets/locales/<code>.json` per ARCHITECTURE.md §4 / §5.8. Build-time bundle duplication to backend for email rendering (§5.8 OQ2).
- **Blocked by**: WEB-001, MOB-001
- **Blocks**: I18N-002, I18N-003
- **Acceptance criteria**:
  - `pnpm i18n:extract` produces a fresh `en.json` from `<FormattedMessage>` calls.
  - Backend has access to identical bundles at runtime.

#### I18N-002: `react-intl` provider + ESLint `no-literal-string` rule

- **Area**: i18n
- **Effort**: S (~1d)
- **Description**: Wire `react-intl` `IntlProvider` on web + mobile per ARCHITECTURE.md §5.8. Enable `formatjs/no-literal-string-in-jsx` or `react-intl/no-literal-string` ESLint rule. CI fails on any inline string in JSX.
- **Blocked by**: I18N-001
- **Blocks**: WEB-005, WEB-017, MOB-005, MOB-009
- **Acceptance criteria**:
  - Adding `<span>Hello</span>` to a presentation component fails lint.
  - Rule is scoped to `presentation/` only.

#### I18N-003: Resource bundles — `en.json` baseline + plural placeholders

- **Area**: i18n
- **Effort**: M (~2d)
- **Description**: Author the baseline `en.json` with every key needed by initial screens. Use ICU MessageFormat for plurals on all count-sensitive strings (transactions, days remaining, etc.) — required for `uk/ru/pl` per PRD §4.12.
- **Blocked by**: I18N-001
- **Blocks**: I18N-004, every screen task
- **Acceptance criteria**:
  - 100+ keys present at baseline.
  - All plural-sensitive strings use `{count, plural, …}` form.
  - CI key-parity check passes against all four locales.

#### I18N-004: Translations — `uk`, `ru`, `pl` (LLM draft + native review)

- **Area**: i18n
- **Effort**: L (~4d)
- **Description**: Per PRD §6 / ARCHITECTURE §5.8 OQ1 — LLM-assisted first-pass translation of `en.json` into `uk.json`, `ru.json`, `pl.json`; then native-speaker review for each. Plural forms validated. Currency abbreviations + symbol position match locale.
- **Blocked by**: I18N-003
- **Blocks**: I18N-007, QA-006
- **Acceptance criteria**:
  - All three locales pass key-parity CI.
  - Each language signed off by a named reviewer.
  - Plural-sensitive strings render correctly for 1 / 2-4 / 5+ samples.

#### I18N-005: Localised email templates (MJML × 4 locales × 3 kinds)

- **Area**: i18n
- **Effort**: M (~3d)
- **Description**: MJML templates for `bank_reconnect_due`, `over_budget_80/100`, `weekly_digest` in en/uk/ru/pl. ICU variables for interpolation per ARCHITECTURE.md §5.7.
- **Blocked by**: I18N-003, I18N-004
- **Blocks**: BE-029
- **Acceptance criteria**:
  - 12 template files (3 × 4) rendered at build time.
  - Visual review in Mailpit for all 12.

#### I18N-006: Locale-aware date/number/currency formatters

- **Area**: i18n
- **Effort**: S (~1d)
- **Description**: Adopt `BE-010` outputs across web + mobile presentation. Verifies `1 234,56 zł` in `pl`, `1,234.56` in `en`, etc. per PRD §4.12.
- **Blocked by**: BE-010, I18N-002
- **Blocks**: WEB-013, WEB-016, MOB-010
- **Acceptance criteria**:
  - Visual snapshot tests across all four locales pass.

#### I18N-007: Localised seed-category names + plan templates

- **Area**: i18n
- **Effort**: S (~1d)
- **Description**: The 11 seeded categories from PRD §4.9 (Groceries, Rent, …) localised in all four languages. Plan-template names ("Monthly plan – {month}", "Vacation") localised too.
- **Blocked by**: I18N-004, BE-027
- **Blocks**: none
- **Acceptance criteria**:
  - DB seed inserts localised names against the `seed_key`.
  - Read endpoint returns the viewer-locale name without renaming the row.

---

### §4.7 QA (`QA-`)

#### QA-001: Vitest unit-test setup (backend + core + web)

- **Area**: QA
- **Effort**: S (~1d)
- **Description**: Vitest for `@power-budget/core`, `packages/backend`, `packages/web`. Coverage reports merged via Codecov / lcov. CI gate at 80% line coverage for `core` and `backend/application`.
- **Blocked by**: BE-002, BE-001, WEB-001
- **Blocks**: every unit-test bullet downstream
- **Acceptance criteria**:
  - `pnpm test` runs across all packages.
  - Coverage report uploaded as CI artefact.

#### QA-002: Integration test harness (backend)

- **Area**: QA
- **Effort**: M (~2d)
- **Description**: Spin up Postgres + Redis via `testcontainers` (or compose); Drizzle migrations applied per test suite; per-test transaction rollback. Test fixtures for households, users, accounts, transactions.
- **Blocked by**: BE-005, INF-008
- **Blocks**: QA-005, QA-009, every backend integration test
- **Acceptance criteria**:
  - `pnpm test:integration` boots containers + runs suites end-to-end in CI.
  - Suite completes in < 5 min.

#### QA-003: Playwright E2E setup (web)

- **Area**: QA
- **Effort**: M (~2d)
- **Description**: Playwright project under `tests/e2e/`. Runs against staging or a local stack. Auth fixture creates a household with two users. Per ARCHITECTURE.md §11 sprint 10.
- **Blocked by**: WEB-013, INF-013
- **Blocks**: QA-006
- **Acceptance criteria**:
  - One smoke test (login + dashboard load) passes in CI nightly.

#### QA-004: Detox decision — defer mobile E2E to v2 (documented)

- **Area**: QA
- **Effort**: XS (~0.5d)
- **Description**: Decision task: mobile E2E via Detox costs ≥ 1 week of setup for two users at MVP. Document the decision to defer and rely on manual TestFlight QA + shared unit + RN-component tests instead.
- **Blocked by**: MOB-001
- **Blocks**: none
- **Acceptance criteria**:
  - ADR committed under `docs/mvp/adr/`.

#### QA-005: Tenancy spec — every endpoint cross-tenant test

- **Area**: QA
- **Effort**: M (~2d)
- **Description**: Per ARCHITECTURE.md §6 — `tenancy.spec.ts` for every authenticated endpoint listed in §7. Household A's token cannot read or write household B's data; expected status 404 (not 403, to avoid leaking existence).
- **Blocked by**: QA-002, BE-036
- **Blocks**: none (mandatory gate)
- **Acceptance criteria**:
  - Suite covers ≥ 95% of REST endpoints (excluding `/healthz`, `/readyz`, `/locales`).
  - Adding a new endpoint without a tenancy test fails a custom CI check.

#### QA-006: Visual regression — 4 locales × key screens

- **Area**: QA
- **Effort**: M (~2d)
- **Description**: Playwright + `playwright-visual-regression` (or Chromatic) captures key screens (login, dashboard, transactions, plan editor, settings) in all four locales. Per PRD §9 risk (text expansion in uk/ru/pl).
- **Blocked by**: QA-003, I18N-004
- **Blocks**: none
- **Acceptance criteria**:
  - 5 screens × 4 locales = 20 baseline snapshots committed.
  - PR fails on > 1% pixel diff.

#### QA-007: Notification end-to-end test

- **Area**: QA
- **Effort**: S (~1d)
- **Description**: Integration test triggers each of the 3 notification kinds + asserts an email lands in Mailpit (dev) / inbox-mock in CI. Per ARCHITECTURE §5.7.
- **Blocked by**: BE-029, BE-033, QA-002
- **Blocks**: none
- **Acceptance criteria**:
  - All 3 kinds tested in all 4 locales (12 cases).

#### QA-008: k6 dashboard perf SLI test

- **Area**: QA
- **Effort**: S (~1d)
- **Description**: k6 script asserts p95 < 500 ms for `GET /plans/:id/dashboard` against the 5 000-row fixture per PRD §6 / ARCHITECTURE §11 sprint 7.
- **Blocked by**: BE-032, INF-012
- **Blocks**: none
- **Acceptance criteria**:
  - k6 script committed; runs in CI on `perf` label.

#### QA-009: Manual test pass plan + partner-onboarding rehearsal

- **Area**: QA
- **Effort**: M (~2d)
- **Description**: Step-by-step plan covering every PRD §5 user story + every PRD §11 verification item. Includes a rehearsal script for partner onboarding (account creation, bank-connect, first plan). Per ARCHITECTURE.md §11 sprint 10.
- **Blocked by**: INF-013, MOB-014, WEB-013
- **Blocks**: none (release gate)
- **Acceptance criteria**:
  - Test plan covers all 16 stories from PRD §5.
  - Rehearsal runbook committed under `docs/mvp/runbooks/`.

---

### §4.8 Security & Cross-cutting (`SEC-`)

#### SEC-001: KMS / envelope encryption for tokens (`Encryption` port)

- **Area**: Security
- **Effort**: L (~3d)
- **Description**: Per ARCHITECTURE.md §6 — `Encryption` port with `AwsKmsEncryption` adapter (prod) + `EnvKekEncryption` adapter (dev/test). Per-user DEK wrapped by master KEK. AES-256-GCM. `EncryptedString` branded type from `core`.
- **Blocked by**: BE-013, INF-009
- **Blocks**: BE-018, BE-019, SEC-002, SEC-003
- **Acceptance criteria**:
  - `encrypt`/`decrypt` round-trip works under both adapters.
  - Ciphertext header carries `(kid, alg, iv)`.
  - DB inspection of bank consent token shows opaque base64.

#### SEC-002: Key rotation runbook + `RotateUserDek` job

- **Area**: Security
- **Effort**: M (~2d)
- **Description**: Background job re-encrypts a user's columns with a new DEK. Runbook documents master KEK rotation via KMS native operations. Per ARCHITECTURE.md §6.
- **Blocked by**: SEC-001, BE-023
- **Blocks**: none
- **Acceptance criteria**:
  - Job runs idempotently per user.
  - Runbook covers master + per-user rotation.

#### SEC-003: TOTP step-up enforcement for sensitive actions

- **Area**: Security
- **Effort**: S (~1d)
- **Description**: Per ARCHITECTURE.md §6 — bank connect/disconnect, Wise token reveal, change email, data export require TOTP re-verification within the last 5 min. Middleware enforces.
- **Blocked by**: BE-015, SEC-001
- **Blocks**: BE-018, BE-019, BE-034
- **Acceptance criteria**:
  - Middleware decorator `@RequireRecentTotp(5min)` returns 403 with `requires_totp` code when stale.
  - Web/mobile prompts inline for the code.

#### SEC-004: Web security headers — CSP, HSTS, CSRF

- **Area**: Security
- **Effort**: S (~1d)
- **Description**: Strict CSP (no inline scripts), HSTS with preload, `Referrer-Policy: same-origin`, `Permissions-Policy: ()`, SameSite=Lax cookies, CSRF token on cookie-auth state-changing routes (none in MVP — verify). Per ARCHITECTURE.md §6.
- **Blocked by**: BE-015, WEB-001, INF-013
- **Blocks**: none (defence-in-depth)
- **Acceptance criteria**:
  - Mozilla Observatory score ≥ A-.
  - Inline-script smoke test blocked by CSP.

#### SEC-005: GDPR — privacy policy, DPA text, data-deletion runbook

- **Area**: Security
- **Effort**: M (~2d)
- **Description**: Author privacy policy + DPA placeholder + data-deletion runbook covering soft-hold (30 d) and hard-delete + anonymisation per ARCHITECTURE.md §6.
- **Blocked by**: BE-034
- **Blocks**: QA-009
- **Acceptance criteria**:
  - Documents committed under `docs/mvp/legal/`.
  - Runbook covers triggering deletion from both UI and admin path.

#### SEC-006: Rate limiting on auth endpoints

- **Area**: Security
- **Effort**: S (~1d)
- **Description**: NestJS `ThrottlerModule` on `/auth/login`, `/auth/magic-link/request`, `/auth/totp/verify` — sliding window per IP + per email. Defends against credential stuffing.
- **Blocked by**: BE-015
- **Blocks**: none
- **Acceptance criteria**:
  - 5 failed attempts / 15 min returns 429.
  - Successful login resets the counter.

#### SEC-007: 2FA-at-bank-connect enforcement gate

- **Area**: Security
- **Effort**: S (~1d)
- **Description**: `POST /bank-connections/initiate` refuses if user has no enrolled TOTP. Web/mobile flow routes to enrolment first. Per PRD §4.1 "TOTP mandatory once a bank is connected".
- **Blocked by**: BE-012, BE-017
- **Blocks**: WEB-010, MOB-005
- **Acceptance criteria**:
  - Endpoint returns 403 `requires_totp_enrollment` with redirect hint.

#### SEC-008: PII redaction in audit log payloads

- **Area**: Security
- **Effort**: S (~1d)
- **Description**: Per ARCHITECTURE.md §5.10 OQ2 — redact bank account numbers and Money amounts above a configured threshold from `before`/`after` JSONB to prevent leakage in exports.
- **Blocked by**: BE-035
- **Blocks**: BE-034
- **Acceptance criteria**:
  - Account numbers replaced with last-4 in audit rows.
  - Amounts above threshold replaced with `redacted: true` marker.

#### SEC-009: Pen-test checklist (self-run pre-launch)

- **Area**: Security
- **Effort**: S (~1d)
- **Description**: Self-run OWASP Top-10 checklist: SQLi (Drizzle parameterisation), XSS (CSP + escaping), broken auth (rate limit + TOTP), IDOR (tenancy spec), SSRF (no user-supplied URLs in fetch), CSRF (bearer tokens). Document findings.
- **Blocked by**: QA-005, SEC-004, SEC-006
- **Blocks**: none (release gate)
- **Acceptance criteria**:
  - Checklist committed with one bullet per item + verdict.
  - Any FAIL escalated to a ticket before launch.

---

## §5 — Critical Path

The longest dependency chain — the one that ultimately gates launch — is the **dashboard + bank-sync chain**, because the headline user story ("see planned vs. actual updated automatically") needs every link to be in place.

```
INF-001  →  INF-002  →  BE-002  →  BE-003  →  BE-004  →  BE-005  →  BE-016  →  BE-017  →  BE-018  →  BE-024
                                                       ↘                                              ↘
                                                        BE-006/BE-007  →  BE-026  →  BE-030  →  BE-031  →  WEB-013  →  QA-009
```

### Walk-through

1. **INF-001 → INF-002** (1.5 d): nothing real can start until the monorepo exists.
2. **BE-002 → BE-003 → BE-004 → BE-005** (~6 d): the schema and core types are the spine. Once these land, ~20 tasks become startable in parallel.
3. **BE-016 → BE-017 → BE-018** (~13 d): the GoCardless adapter is the longest single chain segment. PKO sandbox is the unknown.
4. **BE-024** (~4 d): the sync processor — once wired, real PKO data flows through the pipeline for the first time.
5. **BE-006/BE-007 → BE-026 → BE-030 → BE-031** (~14 d): the dashboard's data path. Materialised view is the perf-sensitive piece.
6. **WEB-013 → QA-009** (~6 d): the dashboard UI + the launch-gate manual test.

### Parallelism breakdown points

- **Wave 12–13 (~weeks 7–8)**: parallelism collapses to ~2 streams (bank-adapter + dashboard query). Most of the team's time concentrates here. A delay in `BE-018` (GoCardless) pushes everything downstream day-for-day.
- **Wave 14 (~week 9)**: the notification cron (`BE-029`) is the second-longest tail and runs on its own track but cannot truly finalise until the over-budget detector hits real data via `BE-030`.

### Gating tasks

The 1–2 tasks that gate everything else:

- **BE-018 (GoCardless adapter)** — without this, nothing about "real bank data" is testable. Highest schedule risk in the whole backlog.
- **BE-030 (Dashboard query + materialised view)** — the perf budget can force a refactor late. De-risk by writing the k6 test (`QA-008`) on a synthetic fixture before BE-018 finishes.

### Estimated calendar length

With strict serial walk of the critical path: **~50 working days (~10–11 calendar weeks part-time)**. Matches the ARCHITECTURE.md §11 sprint plan. Realistic with slippage: 12–13 weeks.

---

## §6 — Open Questions / Decisions Needed Before Day 1

These are items still ambiguous after reading PRODUCT.md + ARCHITECTURE.md. Each has a one-line recommended default so work can start.

| #   | Question                                                                                       | Recommended default                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Domain name for production + staging?                                                          | Use a placeholder (`powerbudget.app` / `staging.powerbudget.app`); buy before INF-013.                                                     |
| 2   | Cloud account ownership — single personal AWS for KMS or one per environment?                  | Single personal AWS account in MVP; split at v3 (SaaS) — KMS is cheap and well-scoped.                                                     |
| 3   | Email sender: Resend vs. SES from day 1?                                                       | Resend (faster onboarding, free MVP tier). Adapter port hides the choice — swap to SES for cost at v3.                                     |
| 4   | Mobile target: iOS 15+ or iOS 16+?                                                             | iOS 16+ (covers ~95% of personal devices in 2026; simplifies API surface).                                                                 |
| 5   | Will the GoCardless production licence be available before sprint 4?                           | Apply for it on day 1 (free); fall back to sandbox-only until approval lands.                                                              |
| 6   | Translation reviewers — paid contractors or volunteer native speakers in your network?         | Volunteers for MVP (the four MVP users include native speakers); paid pipeline for v3.                                                     |
| 7   | Do we want CI on every PR or just main + nightly?                                              | Every PR for fast feedback. Cache aggressively via Turborepo.                                                                              |
| 8   | Is the partner an end-user or also a tester? (affects QA-009 cadence)                          | End-user only; do not block on her feedback for QA cycles — weekly check-ins per PRD §9.                                                   |
| 9   | What's the legal entity for the privacy policy / DPA?                                          | Personal data controller in MVP (private deployment). Stand up a legal entity at v3 SaaS.                                                  |
| 10  | Repo public or private for MVP?                                                                | Private. Bank-adjacent code stays out of public eye.                                                                                       |
| 11  | Backup strategy for Neon — rely on platform PITR or schedule logical dumps too?                | Platform PITR only for MVP (Neon's 7-day point-in-time recovery is sufficient at this scale).                                              |
| 12  | Where is the "design prototype" (`docs/mvp/design/`) referenced in DES-001? Is it in the repo? | Assume it's a Figma URL — fetch tokens manually; if no prototype exists yet, DES-001 becomes "author tokens from scratch" (≈ same effort). |

---
