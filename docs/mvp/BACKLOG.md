# Power Budget — MVP Build Backlog (v1.0 catalogue, v1.1 plan)

> **Read this first (21 Oct 2026).** The v1.0 catalogue below is a historical spec. Its old "Wave N Done" claims were wrong; the real status of each task is in **§0** and in each task's `Status` line. What to build next is in **§7 — v1.1 plan (Oct 2026)**. Short status: `STATUS.md`.

> Concrete, ordered task list to ship the Power Budget MVP. **Sources of truth:** `PRODUCT.md` (what to build) and `ARCHITECTURE.md` (how to build). This document never overrides them — if it disagrees with either, the source doc wins and this file is the bug.
>
> **How to read this doc:**
>
> 0. §0 Reality check gives the true status of every v1.0 task; §7 is the current plan.
> 1. §1 Overview gives the shape (counts, effort, critical path, brutal honesty).
> 2. §2 Conventions defines task IDs, effort scale, and dependency semantics.
> 3. §3 Wave / Parallelization schema is the execution plan — read this before picking tasks.
> 4. §4 is the task catalogue, grouped by area; cross-referenced via `Blocked by` / `Blocks`.
> 5. §5 Critical Path walks the longest dependency chain.
> 6. §6 Open Questions lists things that must be decided before Day 1.

---

## §0 — Reality check (21 Oct 2026)

The v1.0 backlog marked Waves 1-16 as Done. An audit of `master` @ `fdb7b19` (`docs/handoff/audit-code.md`, `audit-ui.md`) showed that this is not true: lint, typecheck, 443 unit tests and CI are green, but almost no user journey works end to end, and the deployed API has exploitable security holes. This section records the real state of each v1.0 task. The plan that finishes the work is **§7 — v1.1 plan**.

**Status legend**

- **Done**: works as specified; audited or low-risk.
- **Partial**: some real code, but a gap stops it from working end to end.
- **Stub**: scaffold, title-only screen, dead code or code that is not wired in.
- **Broken**: wired, but fails at runtime or through a contract mismatch.
- **Not started**: no code.

| Status | Count |
| --- | --- |
| Done | 28 |
| Partial | 39 |
| Stub | 33 |
| Broken | 17 |
| Not started | 5 |
| **Total** | **122** |

Tally by the audit (tasks marked Done, in its review scope): about 15% real, about 45% partial, about 40% stub, dead or broken.

| ID | Real status | Reason | Finished by |
| --- | --- | --- | --- |
| INF-001 | Done | repo and branch protection exist | - |
| INF-002 | Done | monorepo installs, builds and lints | - |
| INF-003 | Done | lint passes in 6 packages; dead web/mobile `.eslintrc.cjs` remain (L8) | CLN-020 follow-up |
| INF-004 | Done | docker-compose works | - |
| INF-005 | Partial | CI is green but runs no integration tests, Playwright skips, visual baselines are 1x1 | CLN-003, CLN-017 |
| INF-006 | Done | `build.yml` green and triggers the Render deploy hook | - |
| INF-007 | Done | dependabot and secret scanning on; 20+ PRs await triage | CLN-019 |
| INF-015 | Partial | scaffold exists but every module is `export {}`; Metro resolution fails | CLN-016, CLN-015 |
| INF-008 | Partial | journal has 7 entries; snapshots only for 0000-0002; three files share prefix 0004 | CLN-018 |
| INF-009 | Partial | `render.yaml` is real, but `JWT_SECRET`, `RESEND_API_KEY`, `APP_BASE_URL` and Google env are missing and the free plan sleeps; replaced by ADR-003 | HOST-001, HOST-002, CLN-001 |
| INF-010 | Partial | Neon and Upstash in use via Render env; Redis TLS URL dropped (H13); no PR branching | CLN-010 |
| INF-011 | Not started | `power-budget.pages.dev` does not resolve | CLN-014 |
| INF-012 | Not started | no pino context, no `/metrics`, no OpenTelemetry | SYNC-009 |
| INF-013 | Not started | skipped; superseded by the VPS and domain tasks | HOST-002, HOST-003 |
| INF-014 | Partial | Sentry filter exists but turns domain errors into 500; web and mobile not verified | CLN-002 |
| BE-001 | Done | NestJS skeleton boots | - |
| BE-002 | Done | core package is pure; import ban works | - |
| BE-003 | Done | branded ids and Money are real | - |
| BE-004 | Done | core entity types are real | - |
| BE-005 | Done | Drizzle schema covers the tables | - |
| BE-006 | Partial | real in core, dead in prod: `DrizzlePlanActualsReader` reimplements it with no FX | CLN-012 |
| BE-007 | Partial | float rate x1e6, truncation, broken EUR pivot, no spec | CLN-013 |
| BE-008 | Partial | ignores the viewer, defaults to `full_detail` | CLN-012 |
| BE-009 | Stub | `BankModule` passes `STUB_SUGGESTION` | AI-003 |
| BE-010 | Done | formatters exist; `Number(bigint)` in `format.ts` is minor (L6) | CLN-002 |
| BE-011 | Done | auth domain and ports are real | - |
| BE-012 | Partial | TOTP bypassed on magic-link and Google login | CLN-004 |
| BE-013 | Partial | Google client is a stub with empty email; TOTP secret stored in plaintext | CLN-001, CLN-004 |
| BE-014 | Broken | `inviteUrl` dropped and every register creates a household, so accept always throws; the second person can never join | CLN-006 |
| BE-015 | Partial | no ValidationPipe; domain errors become 500; `requires_totp` code lost | CLN-002 |
| BE-016 | Partial | domain exists; consent expiry never applied; float money | BNK-002, BNK-004 |
| BE-017 | Broken | web calls a route that does not exist; provider enum mismatch (`wise` vs `wise_personal`) | BNK-005 |
| BE-018 | Partial | GoCardless adapter exists with float money and quota burn; being replaced by Enable Banking | BNK-004, BNK-008 |
| BE-019 | Partial | legacy Wise statement adapter, shared `wise-pending` ref (hijack), float money | CLN-001, BNK-004, WISE-005 |
| BE-020 | Done | transactions domain and ports are real | - |
| BE-021 | Partial | hash fallback drops identical same-day purchases; bulk map is a no-op, cross-tenant writes | BNK-002, SYNC-006, CLN-005 |
| BE-022 | Partial | wrong cursor, filters ignored, no validators, `bigint` not serialised | CLN-002, CLN-008r |
| BE-023 | Partial | crons and processors registered twice; Redis TLS dropped; no DLQ | CLN-010, SYNC-003 |
| BE-024 | Partial | runs twice; 'since' always 90 days; no DLQ | SYNC-003 |
| BE-025 | Partial | domain real; no Drizzle PlannedItem repository | CLN-011 |
| BE-026 | Stub | use cases exist but only 2 GET endpoints are wired | CLN-011 |
| BE-027 | Stub | domain and seed only; no repository, use cases or endpoints | CLN-011 |
| BE-028 | Stub | dead code: the worker imports no FX module; no repository, cron or endpoint | CLN-013 |
| BE-029 | Partial | real Resend channel, but only the oldest pending row is sent; no API key; `.mjml` not in `dist` | CLN-009 |
| BE-030 | Broken | materialised view never refreshed; `bigint` response; dashboard IDOR | CLN-012, CLN-002, CLN-001 |
| BE-031 | Broken | household dashboard IDOR; privacy per category not owner | CLN-001, CLN-012 |
| BE-032 | Stub | k6 script is a fake gate | CLN-017 |
| BE-033 | Broken | period close uses v4 uuid where v7 is required and swallows the error; relay has no producer | CLN-009 |
| BE-034 | Stub | export only enqueues; delete only sets a flag; nothing consumes | CLN-022 |
| BE-035 | Partial | only `DisconnectBankUseCase` audits; no REVOKE migration | CLN-005 |
| BE-036 | Stub | RLS migration is excluded from the journal and no GUC is set: RLS is not applied | CLN-005 |
| BE-037 | Stub | lint rule skips `this.repo.x()` calls, never fires | CLN-005 |
| BE-038 | Partial | 91 of 92 `@ApiResponse` have no type | CLN-011 |
| WEB-001 | Done | Vite app builds | - |
| WEB-002 | Broken | `RequireAuth` reads `access_token`, the store writes `pb_access_token`: every login bounces to /login | CLN-014 |
| WEB-003 | Done | MobX stores and ReactiveView are in use | - |
| WEB-004 | Stub | `api-types.ts` is never used; DTOs hand-written | UI-007, CLN-011 |
| WEB-005 | Partial | screens exist; no 2FA step at login; Google callback depends on a stub | CLN-014, CLN-004 |
| WEB-006 | Broken | field names differ from backend; enrolment deadlock and secret rotates on visit | CLN-004 |
| WEB-007 | Partial | wizard exists; needs plans and categories endpoints that do not exist (not run) | CLN-011 |
| WEB-008 | Stub | backend has no `/plans*` endpoints | CLN-011 |
| WEB-009 | Stub | backend has no history endpoint | CLN-011 |
| WEB-010 | Partial | bank list renders raw i18n keys; contract with backend broken | BNK-005, UI-012 |
| WEB-011 | Broken | consent callback route and provider enum do not match the backend | BNK-005 |
| WEB-012 | Broken | amounts show `undefined NaN`; 500 on `bigint` | CLN-002, UI-007, UI-014 |
| WEB-013 | Broken | calls missing `GET /plans`; view shape differs from backend | CLN-011, CLN-012, UI-013 |
| WEB-014 | Broken | sends `{action, ids}` but DTO is `{op, ids, payload}`; spec asserts the wrong body | CLN-014 |
| WEB-015 | Stub | backend has no `/categories*` | CLN-011 |
| WEB-016 | Stub | no `/fx-rates` endpoint | CLN-013 |
| WEB-017 | Partial | dynamic JSON import without `.default` (not run); uk/ru/pl incomplete | CLN-014, UI-012 |
| WEB-018 | Partial | tabs render; saving needs missing `PATCH /users/me` | CLN-011 |
| WEB-019 | Done | audit drawer is real | - |
| WEB-020 | Partial | works but parses money with `Math.round(parseFloat*100)` | CLN-014 |
| WEB-021 | Stub | no household-category endpoints | CLN-012, UI-013 |
| WEB-022 | Partial | states exist on some screens; others crash or show raw keys (not fully checked) | UI-013, UI-012 |
| MOB-001 | Partial | scaffold exists; Expo 51 mixed with expo-* 55 modules, EAS build very likely fails | CLN-015 |
| MOB-002 | Broken | `RootNavigator` returns `false` with a TODO: no app screen is reachable | CLN-015 |
| MOB-003 | Stub | depends on empty shared-app | CLN-016, CLN-015 |
| MOB-004 | Broken | sync getters always return null; base URL hard-coded to localhost | CLN-015 |
| MOB-005 | Broken | cannot be reached past the navigator | CLN-015 |
| MOB-006 | Stub | depends on the TOTP deadlock and mobile navigator | CLN-004, CLN-015 |
| MOB-007 | Stub | Apple association file has `TEAMID` | CLN-015 |
| MOB-008 | Stub | not reachable; not verified on device | CLN-015, UI-016 |
| MOB-009 | Partial | mobile uk/ru/pl bundles are `{}` | UI-012, CLN-015 |
| MOB-010 | Stub | title-only screen | UI-016 |
| MOB-011 | Stub | title-only screen | UI-016 |
| MOB-012 | Stub | title-only screen; plan editor parses money with `parseFloat` | UI-016, CLN-014 |
| MOB-013 | Stub | no notification channel | AI-009 |
| MOB-014 | Stub | `eas.json` has `*_PLACEHOLDER` ids; `eas-build.yml` never ran | CLN-015 |
| DES-001 | Done | tokens exist | - |
| DES-002 | Done | component library scaffold exists | - |
| DES-003 | Done | visual assets exist under docs/design-arctic (the app does not follow them yet) | UI-009 |
| DES-004 | Done | visual assets exist (the app does not follow them yet) | UI-009 |
| DES-005 | Done | visual assets exist (the app does not follow them yet) | UI-013 |
| DES-006 | Done | visual assets exist (the app does not follow them yet) | UI-013 |
| DES-007 | Done | visual assets exist (the app does not follow them yet) | UI-011 |
| DES-008 | Stub | `ThemeContext` hard-codes dark; no toggle | UI-010 |
| I18N-001 | Done | extraction pipeline works | - |
| I18N-002 | Done | react-intl provider and lint rule exist | - |
| I18N-003 | Partial | `en.json` is missing 44 keys used in code | UI-012 |
| I18N-004 | Stub | web uk/ru/pl have 138 of 290 keys, about 92 copied from English; mobile are `{}` | UI-012 |
| I18N-005 | Partial | MJML files exist but no magic-link template and not copied to `dist` | CLN-009 |
| I18N-006 | Partial | core formatters exist; not applied across the UI | UI-012 |
| I18N-007 | Not started | skipped; no v1.1 task, decide under CLN-011 (categories) | CLN-011 |
| QA-001 | Done | Vitest runs; 443 unit tests pass (many mock the code under test) | - |
| QA-002 | Broken | `@testcontainers/postgresql` missing; both suites cannot load; not in CI | CLN-003 |
| QA-003 | Stub | no server in CI so every test skips; selectors do not match the UI | CLN-017 |
| QA-004 | Done | ADR written | - |
| QA-005 | Stub | 38 mock-only tests; the real IDORs are not covered | CLN-005 |
| QA-006 | Stub | 40 identical 1x1 PNG baselines | CLN-017 |
| QA-007 | Stub | uses in-memory doubles and never runs a processor | CLN-009, CLN-017 |
| QA-008 | Stub | k6 has a placeholder token, starts no backend, no failure threshold | CLN-017 |
| QA-009 | Partial | test plan document exists; partner onboarding cannot work (invite broken) | CLN-006 |
| SEC-001 | Partial | AES-GCM with one KEK, no per-user DEK; TOTP secret plaintext | CLN-004 |
| SEC-002 | Stub | `RotateUserDekUseCase` is used only by its spec; runbook still says `fly` | CLN-004 |
| SEC-003 | Broken | enable needs a recent verify and verify needs a secret: enrolment is impossible | CLN-004 |
| SEC-004 | Partial | helmet is set; the headers spec is tautological; no production CSP on web | CLN-014, CLN-017 |
| SEC-005 | Stub | GDPR export and delete do not execute; policy text only | CLN-022 |
| SEC-006 | Not started | no throttler anywhere (the pentest checklist wrongly claimed one) | CLN-004 |
| SEC-007 | Broken | gate requires TOTP, which cannot be enrolled | CLN-004, BNK-005 |
| SEC-008 | Stub | `REDACTING_AUDIT_LOGGER` is never injected | CLN-005 |
| SEC-009 | Partial | checklist corrected in CLN-020; the pentest itself is still to do | CLN-001, CLN-005 |

---

## §1 — Overview (v1.0, historical)

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

> **Merge record only.** These tables show the order in which PRs were merged, not whether the work functions. A merged PR is not a finished task: the real status of every task is in §0 (audit of 21 Oct 2026). The v1.1 plan that finishes the work is §7.

### Wave 1 — Day-1 startable (no blockers)

| ID      | Title                                           | Area   | Effort |
| ------- | ----------------------------------------------- | ------ | ------ |
| INF-001 | Create GitHub repository + branch protection    | Infra  | XS     |
| DES-001 | Design tokens — CSS variables + RN style tokens | Design | M      |

Only two pure wave-1 starters exist because nearly every other task depends on the monorepo skeleton (INF-002). The design-token task can run fully parallel to all of infra.

### Wave 2 — depends on Wave 1

| ID      | Title                              | Area   |
| ------- | ---------------------------------- | ------ | ---------------- |
| INF-002 | Scaffold pnpm + Turborepo monorepo | Infra  |
| INF-007 | Dependabot + secret scanning       | Infra  |
| DES-002 | Component library scaffold         | Design | merged (PR #72) |

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

| ID      | Title                                        | Area    | Merge record           |
| ------- | -------------------------------------------- | ------- | ---------------- |
| INF-005 | GitHub Actions CI                            | Infra   | merged (PR #10) |
| INF-015 | Scaffold `packages/shared-app` + Metro spike | Infra   | merged (PR #12) |
| BE-001  | Scaffold `packages/backend` (NestJS)         | Backend | merged (PR #11) |
| BE-003  | Core domain types — IDs + value objects      | Backend | merged (PR #15) |
| WEB-001 | Scaffold `packages/web` (thin UI wrapper)    | Web     | merged (PR #18) |
| MOB-001 | Scaffold `packages/mobile` (thin UI wrapper) | Mobile  | merged (PR #19) |

### Wave 5

| ID       | Title                                    | Area    | Merge record                  |
| -------- | ---------------------------------------- | ------- | ----------------------- |
| INF-006  | GH Actions build + preview deploy        | Infra   | merged (PR #30)        |
| INF-008  | Drizzle ORM tooling                      | Infra   | merged (PR #37)        |
| INF-012  | Observability stack                      | Infra   | —                       |
| BE-004   | Core entity types (Plan, Transaction, …) | Backend | merged (PR #34)        |
| BE-010   | Core locale-aware formatters             | Backend | merged (PR #39)        |
| WEB-002  | Routing + protected-route wrapper        | Web     | merged (PR #32)        |
| WEB-003  | MobX + ReactiveView wiring               | Web     | merged (PR #36)        |
| MOB-002  | React Navigation                         | Mobile  | merged (PR #35)        |
| MOB-003  | MobX + ReactiveView wiring (mobile)      | Mobile  | — (BE-038 merged) |
| MOB-013  | Notification routing layer (placeholder) | Mobile  | —                       |
| I18N-001 | String-extraction infrastructure         | i18n    | merged (PR #70)        |
| QA-001   | Vitest unit-test setup                   | QA      | merged (PR #33)        |
| QA-004   | Detox-defer ADR                          | QA      | merged (PR #31)        |

### Wave 6

| ID       | Title                                   | Area    | Merge record                           |
| -------- | --------------------------------------- | ------- | -------------------------------- |
| INF-009  | Deployment topology — Render (ADR-002)  | Infra   | merged (repo side) |
| BE-005   | Drizzle schema — every MVP table        | Backend | merged (PR #38)                 |
| BE-006   | Core `computePlanActuals`               | Backend | merged (PR #40)                 |
| BE-007   | Core `computeLeftover` + `convertMoney` | Backend | merged (PR #41)                 |
| BE-008   | Core `aggregateByCategoryWithPrivacy`   | Backend | merged (PR #42)                 |
| BE-009   | Core `applyMappingSuggestion`           | Backend | merged (PR #43)                 |
| BE-010   | Core locale-aware formatters            | Backend | merged (PR #39)                 |
| MOB-004  | Secure storage for tokens               | Mobile  | blocked (needs MOB-003)        |
| I18N-002 | `react-intl` provider + lint rule       | i18n    | merged (PR #78)                 |
| I18N-003 | Resource bundles — `en.json` baseline   | i18n    | deferred to Wave 7             |

### Wave 7

| ID       | Title                                         | Area    | Merge record     | PR                                                       |
| -------- | --------------------------------------------- | ------- | ---------- | -------------------------------------------------------- |
| INF-010  | Managed PG (Neon) + Redis (Upstash)           | Infra   | skipped | —                                                        |
| INF-011  | Web hosting — Cloudflare Pages                | Infra   | skipped | —                                                        |
| BE-011   | Auth domain — entities + ports                | Backend | merged    | [#45](https://github.com/dcervonyj/power-budget/pull/45) |
| BE-016   | BankConnection domain + `BankConnector`       | Backend | merged    | [#48](https://github.com/dcervonyj/power-budget/pull/48) |
| BE-020   | Transactions domain — entities + ports        | Backend | merged    | [#47](https://github.com/dcervonyj/power-budget/pull/47) |
| BE-023   | BullMQ infrastructure                         | Backend | merged    | [#44](https://github.com/dcervonyj/power-budget/pull/44) |
| BE-025   | Plans domain — entities + ports               | Backend | merged    | [#46](https://github.com/dcervonyj/power-budget/pull/46) |
| BE-027   | Categories domain + privacy + seed migration  | Backend | merged    | [#49](https://github.com/dcervonyj/power-budget/pull/49) |
| I18N-004 | Translations — uk/ru/pl (LLM + native review) | i18n    | skipped | —                                                        |
| QA-002   | Integration test harness                      | QA      | merged    | [#50](https://github.com/dcervonyj/power-budget/pull/50) |

### Wave 8

| ID       | Title                             | Area    | Merge record     | PR                                                       |
| -------- | --------------------------------- | ------- | ---------- | -------------------------------------------------------- |
| INF-013  | Staging environment + DNS + TLS   | Infra   | skipped | —                                                        |
| BE-012   | Auth use cases                    | Backend | merged    | [#51](https://github.com/dcervonyj/power-budget/pull/51) |
| BE-026   | Plans use cases + REST + audit    | Backend | merged    | [#54](https://github.com/dcervonyj/power-budget/pull/54) |
| BE-028   | FX — ECB ingest                   | Backend | merged    | [#53](https://github.com/dcervonyj/power-budget/pull/53) |
| BE-037   | ESLint `no-repo-without-scope`    | Backend | merged    | [#52](https://github.com/dcervonyj/power-budget/pull/52) |
| I18N-005 | Localised email templates         | i18n    | skipped | —                                                        |
| I18N-006 | Locale-aware formatters across UI | i18n    | skipped | —                                                        |
| I18N-007 | Localised seed categories         | i18n    | skipped | —                                                        |

### Wave 9

| ID      | Title                          | Area     | Merge record     | PR  |
| ------- | ------------------------------ | -------- | ---------- | --- |
| BE-013  | Auth infrastructure adapters   | Backend  | merged | #58 |
| BE-014  | Household domain + invite flow | Backend  | merged | #56 |
| BE-021  | Transactions use cases         | Backend  | merged | #57 |
| SEC-001 | KMS / envelope encryption      | Security | merged | #55 |
| SEC-006 | Auth rate limiting             | Security | skipped | —   |

### Wave 10

| ID      | Title                                         | Area     | Merge record  | PR                                                       |
| ------- | --------------------------------------------- | -------- | ------- | -------------------------------------------------------- |
| BE-015  | Auth presentation — REST controllers + guards | Backend  | merged | [#59](https://github.com/dcervonyj/power-budget/pull/59) |
| BE-022  | Transactions infrastructure + REST            | Backend  | merged | [#60](https://github.com/dcervonyj/power-budget/pull/60) |
| BE-035  | Audit log API + `AuditLogger` port            | Backend  | merged | [#62](https://github.com/dcervonyj/power-budget/pull/62) |
| SEC-002 | Key rotation runbook                          | Security | merged | [#61](https://github.com/dcervonyj/power-budget/pull/61) |

### Wave 11

| ID      | Title                           | Area     | Merge record           | PR  |
| ------- | ------------------------------- | -------- | ---------------- | --- |
| BE-017  | BankConnection use cases + REST | Backend  | merged (PR #63) | #63 |
| BE-038  | OpenAPI / Swagger docs          | Backend  | merged (PR #68) | #68 |
| INF-014 | Sentry error tracking           | Infra    | merged (PR #64) | #64 |
| SEC-003 | TOTP step-up enforcement        | Security | merged (PR #65) | #65 |
| SEC-004 | Web security headers            | Security | merged (PR #66) | #66 |
| SEC-008 | PII redaction in audit          | Security | merged (PR #67) | #67 |

### Wave 12

| ID      | Title                             | Area     | Merge record |
| ------- | --------------------------------- | -------- | ------ |
| BE-018  | GoCardless adapter                | Backend  | merged (PR #71) |
| BE-019  | Wise adapter                      | Backend  | merged (PR #73) |
| BE-036  | RLS policies + tenancy spec       | Backend  | merged (PR #74) |
| WEB-004 | Typed API client from OpenAPI     | Web      | merged (PR #69) |
| MOB-005 | Auth screens (mobile)             | Mobile   | merged (PR #80) |
| MOB-009 | Locale resolution + i18n (mobile) | Mobile   | merged (PR #79) |
| SEC-007 | 2FA-at-bank-connect gate          | Security | merged (PR #75) |

### Wave 13

| ID      | Title                                        | Area    | PR  |
| ------- | -------------------------------------------- | ------- | --- |
| BE-024  | Bank-sync scheduler + processor              | Backend | #88 |
| BE-030  | Dashboard query endpoint + materialised view | Backend | #87 |
| BE-034  | Data export + household deletion             | Backend | #89 |
| WEB-005 | Auth screens                                 | Web     | #83 |
| WEB-008 | Plans list + plan editor                     | Web     | #81 |
| WEB-015 | Categories management                        | Web     | #82 |
| WEB-016 | Currency switcher + MoneyView                | Web     | #84 |
| WEB-017 | Locale switcher + i18n provider              | Web     | #85 |
| WEB-020 | Manual transaction entry                     | Web     | #86 |
| MOB-006 | TOTP enrolment + iOS 2FA                     | Mobile  | #91 |
| MOB-007 | Deep linking — magic-link + OAuth            | Mobile  | #94 |
| MOB-008 | Biometric unlock                             | Mobile  | #93 |
| MOB-012 | Plans list + planned-item editor             | Mobile  | #92 |
| QA-005  | Tenancy spec — every endpoint                | QA      | #90 |

### Wave 14

| ID      | Title                                               | Area     | PR   |
| ------- | --------------------------------------------------- | -------- | ---- |
| BE-029  | Notifications — outbox + channel + templates + cron | Backend  | #95  |
| BE-031  | Dashboard household + unplanned endpoints           | Backend  | #96  |
| WEB-006 | TOTP enrolment screen                               | Web      | #100 |
| WEB-009 | Planned-item history drawer                         | Web      | #99  |
| WEB-011 | OAuth bridge (Google + bank consent)                | Web      | #97  |
| WEB-012 | Transactions list + detail                          | Web      | #101 |
| WEB-019 | Audit-log drawer wired into plan items              | Web      | #98  |
| MOB-010 | Dashboard (mobile)                                  | Mobile   | #102 |
| MOB-011 | Transactions list + detail (mobile)                 | Mobile   | #103 |
| SEC-005 | GDPR — privacy policy + data deletion runbook       | Security | #104 |

### Wave 15

| ID      | Title                                    | Area     | PR                                                         |
| ------- | ---------------------------------------- | -------- | ---------------------------------------------------------- |
| BE-032  | Dashboard perf — k6 budget gate          | Backend  | [#107](https://github.com/dcervonyj/power-budget/pull/107) |
| BE-033  | Outbox relay worker + period close       | Backend  | [#109](https://github.com/dcervonyj/power-budget/pull/109) |
| WEB-007 | Onboarding wizard                        | Web      | [#105](https://github.com/dcervonyj/power-budget/pull/105) |
| WEB-010 | Bank connections (web)                   | Web      | [#110](https://github.com/dcervonyj/power-budget/pull/110) |
| WEB-013 | Dashboard screen                         | Web      | [#115](https://github.com/dcervonyj/power-budget/pull/115) |
| WEB-018 | Settings screen (5 tabs)                 | Web      | [#111](https://github.com/dcervonyj/power-budget/pull/111) |
| WEB-021 | Household drill-in (privacy-aware)       | Web      | [#116](https://github.com/dcervonyj/power-budget/pull/116) |
| WEB-022 | Loading / empty / error states           | Web      | [#117](https://github.com/dcervonyj/power-budget/pull/117) |
| MOB-014 | TestFlight pipeline + App Store metadata | Mobile   | [#112](https://github.com/dcervonyj/power-budget/pull/112) |
| QA-003  | Playwright E2E setup                     | QA       | [#113](https://github.com/dcervonyj/power-budget/pull/113) |
| QA-007  | Notification E2E test                    | QA       | [#106](https://github.com/dcervonyj/power-budget/pull/106) |
| QA-008  | k6 dashboard perf SLI                    | QA       | [#114](https://github.com/dcervonyj/power-budget/pull/114) |
| SEC-009 | Pen-test checklist                       | Security | [#108](https://github.com/dcervonyj/power-budget/pull/108) |

### Wave 16 — final gate

| ID      | Title                                           | Area | PR                                                         |
| ------- | ----------------------------------------------- | ---- | ---------------------------------------------------------- |
| WEB-014 | Bulk action bar + mapping modal                 | Web  | [#119](https://github.com/dcervonyj/power-budget/pull/119) |
| QA-006  | Visual regression — 4 locales × key screens     | QA   | [#120](https://github.com/dcervonyj/power-budget/pull/120) |
| QA-009  | Manual test plan + partner-onboarding rehearsal | QA   | [#118](https://github.com/dcervonyj/power-budget/pull/118) |

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
- **Status**: Done (audit 21 Oct 2026) — repo and branch protection exist.
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
- **Status**: Done (audit 21 Oct 2026) — monorepo installs, builds and lints.
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
- **Status**: Done (audit 21 Oct 2026) — lint passes in 6 packages; dead web/mobile `.eslintrc.cjs` remain (L8). Finished by: CLN-020 follow-up.
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
- **Status**: Done (audit 21 Oct 2026) — docker-compose works.
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
- **Status**: Partial (audit 21 Oct 2026) — CI is green but runs no integration tests, Playwright skips, visual baselines are 1x1. Finished by: CLN-003, CLN-017.
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
- **Status**: Done (audit 21 Oct 2026) — `build.yml` green and triggers the Render deploy hook.
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
- **Status**: Done (audit 21 Oct 2026) — dependabot and secret scanning on; 20+ PRs await triage. Finished by: CLN-019.
- **Description**: Enable GitHub Dependabot for npm (weekly), GitHub Actions (monthly). Enable secret scanning + push-protection. Per SEC plan in ARCHITECTURE.md §6.
- **Blocked by**: INF-001
- **Blocks**: SEC-009
- **Acceptance criteria**:
  - `.github/dependabot.yml` committed.
  - Secret scanning visible as enabled in repo settings.

#### INF-015: Scaffold `packages/shared-app` + validate Metro resolver

- **Area**: Infra
- **Effort**: S (~1d)
- **Status**: Partial (audit 21 Oct 2026) — scaffold exists but every module is `export {}`; Metro resolution fails. Finished by: CLN-016, CLN-015.
- **Description**: Create `packages/shared-app` (`@power-budget/shared-app`) — the new package that holds all platform-agnostic frontend application logic (MobX ReactiveViews, use cases, selectors, API adapters, context factories, `Navigator` interface, `AppRoute` typed route union). This is the first step before any feature code is written on either web or mobile. The task has two deliverables: (1) the package scaffold with the full folder tree for all 8 feature modules (empty barrels, same structure as `@power-budget/core` for domain modules), `package.json` with `mobx`, `axios`, `react` as dependencies, and a `tsup` dual-build config; (2) a Metro resolver validation: add `@power-budget/shared-app` as a dependency of `packages/mobile`, run `expo export --platform ios` (or a Metro bundle dry-run), and confirm no symlink resolution errors. Per ARCHITECTURE.md §4 (`shared-app` description).
- **Blocked by**: INF-002, INF-003, BE-002
- **Blocks**: WEB-001, MOB-001, WEB-003, MOB-003, WEB-004
- **Acceptance criteria**:
  - `packages/shared-app/` exists with the full folder tree: 8 feature directories each containing `application/`, `api/`, `config/`, `ui/connect/`, plus top-level `infrastructure/` and `contract/`.
  - `pnpm -F @power-budget/shared-app build` emits dual ESM+CJS+`.d.ts`.
  - `pnpm -F @power-budget/shared-app typecheck` passes.
  - `import { createAuthContext } from '@power-budget/shared-app'` resolves in a throwaway file under `packages/web/src/`.
  - Metro resolves `@power-budget/shared-app` in a dry-run Expo bundle without `Unable to resolve module` errors.
  - `Navigator` interface is committed in `src/infrastructure/navigation/Navigator.ts`.
  - `AppRoute` discriminated union is stubbed in `src/contract/routes.ts`.

#### INF-008: Drizzle ORM tooling & migration scaffolding

- **Area**: Infra
- **Effort**: M (~2d)
- **Status**: Partial (audit 21 Oct 2026) — journal has 7 entries; snapshots only for 0000-0002; three files share prefix 0004. Finished by: CLN-018.
- **Description**: Install Drizzle + `drizzle-kit` in `packages/backend`, scaffold `drizzle/` folder per ARCHITECTURE.md §4. Add `pnpm db:generate` (schema-diff → migration SQL), `pnpm db:migrate`, `pnpm db:reset` scripts. Configure connection URL via env. Produce one empty migration to prove the chain works.
- **Blocked by**: INF-004, BE-001
- **Blocks**: BE-003 and every Drizzle repo task
- **Acceptance criteria**:
  - `pnpm db:migrate` runs cleanly against compose Postgres.
  - Generated SQL is committed under `drizzle/migrations/`.
  - Drizzle config bans `prisma`-style implicit runtime; SQL files are the source of truth.

#### INF-009: Deployment topology — Render API + embedded worker (revised by ADR-002)

- **Area**: Infra
- **Effort**: M (~2d)
- **Status**: Partial (audit 21 Oct 2026) — `render.yaml` is real, but `JWT_SECRET`, `RESEND_API_KEY`, `APP_BASE_URL` and Google env are missing and the free plan sleeps; replaced by ADR-003. Finished by: HOST-001, HOST-002, CLN-001.
- **Description**: Fly.io free tier no longer exists; per **ADR-002** the test deployment targets Render's free tier instead. One Docker image (`packages/backend/Dockerfile`), one free web service running API + embedded BullMQ worker (`START_WORKER=true`). Standalone worker topology (`dist/src/worker.main.js`) is preserved for a future paid setup. Secrets are set only in the Render dashboard.
- **Blocked by**: INF-006
- **Blocks**: INF-010, INF-011, INF-013, SEC-002
- **Acceptance criteria** (revised):
  - Render service deploys from the `render.yaml` blueprint successfully.
  - API has TLS via the `onrender.com` certificate.
  - Container runs migrations (`drizzle/migrate.mjs`) before starting the API.

#### INF-010: Managed Postgres (Neon) + managed Redis (Upstash)

- **Area**: Infra
- **Effort**: S (~1d)
- **Status**: Partial (audit 21 Oct 2026) — Neon and Upstash in use via Render env; Redis TLS URL dropped (H13); no PR branching. Finished by: CLN-010.
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
- **Status**: Not started (audit 21 Oct 2026) — `power-budget.pages.dev` does not resolve. Finished by: CLN-014.
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
- **Status**: Not started (audit 21 Oct 2026) — no pino context, no `/metrics`, no OpenTelemetry. Finished by: SYNC-009.
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
- **Status**: Not started (audit 21 Oct 2026) — skipped; superseded by the VPS and domain tasks. Finished by: HOST-002, HOST-003.
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
- **Status**: Partial (audit 21 Oct 2026) — Sentry filter exists but turns domain errors into 500; web and mobile not verified. Finished by: CLN-002.
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
- **Status**: Done (audit 21 Oct 2026) — NestJS skeleton boots.
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
- **Status**: Done (audit 21 Oct 2026) — core package is pure; import ban works.
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
- **Status**: Done (audit 21 Oct 2026) — branded ids and Money are real.
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
- **Status**: Done (audit 21 Oct 2026) — core entity types are real.
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
- **Status**: Done (audit 21 Oct 2026) — Drizzle schema covers the tables.
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
- **Status**: Partial (audit 21 Oct 2026) — real in core, dead in prod: `DrizzlePlanActualsReader` reimplements it with no FX. Finished by: CLN-012.
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
- **Status**: Partial (audit 21 Oct 2026) — float rate x1e6, truncation, broken EUR pivot, no spec. Finished by: CLN-013.
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
- **Status**: Partial (audit 21 Oct 2026) — ignores the viewer, defaults to `full_detail`. Finished by: CLN-012.
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
- **Status**: Stub (audit 21 Oct 2026) — `BankModule` passes `STUB_SUGGESTION`. Finished by: AI-003.
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
- **Status**: Done (audit 21 Oct 2026) — formatters exist; `Number(bigint)` in `format.ts` is minor (L6). Finished by: CLN-002.
- **Description**: Implement `formatMoney(money, locale)`, `formatDate(date, locale)`, `formatNumber(n, locale)` per ARCHITECTURE.md §5.8 using `Intl.NumberFormat` / `Intl.DateTimeFormat`. `1 234,56 zł` for `pl`, etc.
- **Blocked by**: BE-003
- **Blocks**: WEB-016, MOB-009, I18N-006
- **Acceptance criteria**:
  - Snapshot tests for `en`, `uk`, `ru`, `pl` cover currency, date, number, and plural-sensitive samples.
  - No locale data shipped manually (rely on platform `Intl`).

#### BE-011: Auth domain — entities + ports

- **Area**: Backend
- **Effort**: M (~2d)
- **Status**: Done (audit 21 Oct 2026) — auth domain and ports are real.
- **Description**: Per ARCHITECTURE.md §5.1 — define `User`, `Session`, `TotpSecret`, `HouseholdInvite` domain entities in `backend/src/domain/auth/`. Define ports: `UserRepository`, `PasswordHashing`, `TotpVerifier`, `OAuthProvider`, `RefreshTokenStore`, `HouseholdRepository`. No implementations.
- **Blocked by**: BE-004, BE-005
- **Blocks**: BE-012, BE-013
- **Acceptance criteria**:
  - Interface signatures match ARCHITECTURE.md §5.1 exactly.
  - No NestJS / I/O imports in domain layer.
  - Unit tests for any pure domain services (e.g. `HouseholdInvariants`).

#### BE-012: Auth use cases — register / login / magic link / OAuth / TOTP

- **Area**: Backend
- **Effort**: L (~4d)
- **Status**: Partial (audit 21 Oct 2026) — TOTP bypassed on magic-link and Google login. Finished by: CLN-004.
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
- **Status**: Partial (audit 21 Oct 2026) — Google client is a stub with empty email; TOTP secret stored in plaintext. Finished by: CLN-001, CLN-004.
- **Description**: Implement `DrizzleUserRepository`, `DrizzleHouseholdRepository`, `Argon2PasswordHashing`, `OtplibTotpVerifier`, `GoogleOauthClient`, `JwtAccessTokenIssuer`, `RedisRefreshTokenStore` per ARCHITECTURE.md §5.1. Wire into Nest DI module.
- **Blocked by**: BE-012, BE-005
- **Blocks**: BE-015, SEC-001
- **Acceptance criteria**:
  - Integration test exercises a full register + login + refresh cycle against compose Postgres.
  - JWT access TTL = 15 min; refresh = 30 d (configurable).
  - Refresh tokens stored hashed in Redis.

#### BE-014: Household domain + invite flow

- **Area**: Backend
- **Effort**: M (~2d)
- **Status**: Broken (audit 21 Oct 2026) — `inviteUrl` dropped and every register creates a household, so accept always throws; the second person can never join. Finished by: CLN-006.
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
- **Status**: Partial (audit 21 Oct 2026) — no ValidationPipe; domain errors become 500; `requires_totp` code lost. Finished by: CLN-002.
- **Description**: NestJS controllers for every Auth endpoint listed in ARCHITECTURE.md §7. JWT auth guard reading `Authorization: Bearer`. DTOs validated via `class-validator`. `RequestContext` middleware populates `(userId, householdId, locale)`.
- **Blocked by**: BE-013, BE-014
- **Blocks**: WEB-005, BE-017, every bearer-protected endpoint
- **Acceptance criteria**:
  - All 14 auth endpoints from §7 routable and documented in OpenAPI.
  - Guard rejects missing / expired / malformed tokens.
  - `RequestContext` injected into every authenticated controller.

#### BE-016: BankConnection domain — entities + `BankConnector`

- **Area**: Backend
- **Effort**: M (~2d)
- **Status**: Partial (audit 21 Oct 2026) — domain exists; consent expiry never applied; float money. Finished by: BNK-002, BNK-004.
- **Description**: Define `BankConnection`, `BankAccount`, `Consent`, `SyncRun`, `RawTransaction` types and the `BankConnector` interface exactly per ARCHITECTURE.md §5.2. Domain service `ConsentExpiryPolicy` (7d / 1d / on-expiry).
- **Blocked by**: BE-004, BE-005
- **Blocks**: BE-017, BE-018, BE-019
- **Acceptance criteria**:
  - Interface matches §5.2 snippet exactly (TypeScript declaration).
  - `ConsentExpiryPolicy` unit-tested across 7d/1d/expired/active boundaries.
  - No vendor imports in domain layer.

#### BE-017: BankConnection use cases + REST controllers

- **Area**: Backend
- **Effort**: L (~4d)
- **Status**: Broken (audit 21 Oct 2026) — web calls a route that does not exist; provider enum mismatch (`wise` vs `wise_personal`). Finished by: BNK-005.
- **Description**: Implement `InitiateBankConnection`, `CompleteBankConsent`, `ListUserConnections`, `RefreshConnection`, `DisconnectBank`, `ReconnectBank` use cases + REST endpoints from ARCHITECTURE.md §5.2 / §7. Bank catalogue endpoint reads from `BankConnectorRegistry`.
- **Blocked by**: BE-015, BE-016
- **Blocks**: BE-018, BE-019, WEB-010
- **Acceptance criteria**:
  - All 8 bank-connection endpoints from §7 work end-to-end with a stub connector.
  - `DisconnectBank` preserves transactions + accounts per PRD §4.2.
  - Integration test using a fake `BankConnector` adapter.

#### BE-018: GoCardless adapter (`GoCardlessBankConnector`)

- **Area**: Backend
- **Effort**: XL (~7d)
- **Status**: Partial (audit 21 Oct 2026) — GoCardless adapter exists with float money and quota burn; being replaced by Enable Banking. Finished by: BNK-004, BNK-008.
- **Description**: Implement `GoCardlessBankConnector implements BankConnector` per ARCHITECTURE.md §5.2. PSD2 consent flow for PKO BP (`BPKOPLPW`), 90-day expiry, sandbox bank for tests. Consent token encrypted via `Encryption` port. Includes account listing + transaction fetch + reconnect URL.
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
- **Status**: Partial (audit 21 Oct 2026) — legacy Wise statement adapter, shared `wise-pending` ref (hijack), float money. Finished by: CLN-001, BNK-004, WISE-005.
- **Description**: Implement `WiseBankConnector implements BankConnector` per ARCHITECTURE.md §5.2. User pastes a Wise API token during connect (no OAuth). Encrypted at rest. Polling only; no webhooks in MVP.
- **Blocked by**: BE-017, SEC-001
- **Blocks**: BE-024
- **Acceptance criteria**:
  - Connect flow stores token via `Encryption`.
  - Lists balances across currencies as separate `BankAccount`s.
  - Transactions converted to `RawTransaction` (occurred_on, amount, currency, merchant, externalId).

#### BE-020: Transactions domain — entities + ports

- **Area**: Backend
- **Effort**: M (~2d)
- **Status**: Done (audit 21 Oct 2026) — transactions domain and ports are real.
- **Description**: Per ARCHITECTURE.md §5.3 — define `Transaction`, `TransactionMapping`, `Transfer`, `IngestBatch` types; ports `TransactionRepository`, `MappingRepository`, `TransferRepository`; domain services `IdempotentIngest`, `MappingSuggestion`.
- **Blocked by**: BE-004, BE-005
- **Blocks**: BE-021, BE-022, BE-024
- **Acceptance criteria**:
  - Interfaces match §5.3 snippets exactly.
  - `IdempotentIngest`: external_id present uses `(account_id, external_id)`; missing falls back to hash of `(account, date, amount, normalised_description)` per §5.3.1.

#### BE-021: Transactions use cases — ingest, manual, map, transfer, bulk

- **Area**: Backend
- **Effort**: XL (~6d)
- **Status**: Partial (audit 21 Oct 2026) — hash fallback drops identical same-day purchases; bulk map is a no-op, cross-tenant writes. Finished by: BNK-002, SYNC-006, CLN-005.
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
- **Status**: Partial (audit 21 Oct 2026) — wrong cursor, filters ignored, no validators, `bigint` not serialised. Finished by: CLN-002, CLN-008r.
- **Description**: `DrizzleTransactionRepository`, `DrizzleMappingRepository`, `DrizzleTransferRepository` plus REST controllers for the 7 transaction endpoints in ARCHITECTURE.md §7.
- **Blocked by**: BE-021
- **Blocks**: BE-024, WEB-012
- **Acceptance criteria**:
  - Cursor pagination works for 5 000-row fixture in < 100 ms.
  - All filters from PRD §4.3 supported via query string.
  - `transactions.spec.ts` tenancy test passes (household A can't read household B txns).

#### BE-023: BullMQ infrastructure — queues + worker bootstrap

- **Area**: Backend
- **Effort**: M (~2d)
- **Status**: Partial (audit 21 Oct 2026) — crons and processors registered twice; Redis TLS dropped; no DLQ. Finished by: CLN-010, SYNC-003.
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
- **Status**: Partial (audit 21 Oct 2026) — runs twice; 'since' always 90 days; no DLQ. Finished by: SYNC-003.
- **Description**: `@nestjs/schedule` enqueues `sync-connection` every 4 h per active connection plus on-demand. Worker processor calls `BankConnector.fetchTransactions(since)`, calls `IngestBankTransactions`, writes `audit_log`, enqueues reconnect-reminder if `expiresAt < now + 7d`. Per ARCHITECTURE.md §9.
- **Blocked by**: BE-018, BE-019, BE-021, BE-023
- **Blocks**: QA-006, BE-029
- **Acceptance criteria**:
  - Scheduled job fires every 4 h in staging; manually-triggered `POST /bank-connections/:id/refresh` also enqueues.
  - `lastSuccessfulAt` written to `sync_runs`.
  - On 429 from provider, retry honours `Retry-After`.

#### BE-025: Plans domain — entities + ports

- **Area**: Backend
- **Effort**: M (~2d)
- **Status**: Partial (audit 21 Oct 2026) — domain real; no Drizzle PlannedItem repository. Finished by: CLN-011.
- **Description**: Per ARCHITECTURE.md §5.4 — `Plan`, `PlannedItem`, `PlannedItemVersion` entities; ports `PlanRepository`, `PlannedItemRepository`, `PlannedItemVersionRepository`, `PlanActualsReader`. Domain service `PlanCloning`. Invariant: ≤1 active plan per `(type, periodKind)` per user/household, except `custom`.
- **Blocked by**: BE-004, BE-005
- **Blocks**: BE-026, BE-030
- **Acceptance criteria**:
  - Interfaces match §5.4 exactly.
  - `PlanCloning` unit-tested for weekly/monthly/custom.
  - Invariant unit-tested.

#### BE-026: Plans use cases + REST + audit trail

- **Area**: Backend
- **Effort**: L (~5d)
- **Status**: Stub (audit 21 Oct 2026) — use cases exist but only 2 GET endpoints are wired. Finished by: CLN-011.
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
- **Status**: Stub (audit 21 Oct 2026) — domain and seed only; no repository, use cases or endpoints. Finished by: CLN-011.
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
- **Status**: Stub (audit 21 Oct 2026) — dead code: the worker imports no FX module; no repository, cron or endpoint. Finished by: CLN-013.
- **Description**: Per ARCHITECTURE.md §5.6 — `EcbFxRateProvider implements FxRateProvider`, `DrizzleFxRateRepository`, `IngestEcbDailyRates` use case, `GetFxRate` endpoint, `UpdateCurrencyPreferences`. Cron `0 16 * * 1-5` CET. Frankfurter fallback for UAH/RUB per §5.6.2. Carry-forward up to 7 d for missing dates.
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
- **Status**: Partial (audit 21 Oct 2026) — real Resend channel, but only the oldest pending row is sent; no API key; `.mjml` not in `dist`. Finished by: CLN-009.
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
- **Status**: Broken (audit 21 Oct 2026) — materialised view never refreshed; `bigint` response; dashboard IDOR. Finished by: CLN-012, CLN-002, CLN-001.
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
- **Status**: Broken (audit 21 Oct 2026) — household dashboard IDOR; privacy per category not owner. Finished by: CLN-001, CLN-012.
- **Description**: `GET /plans/:id/dashboard/unplanned?direction=` (paginated unplanned tx list per PRD §4.11 "tap to list") and `GET /households/:id/dashboard?planId=` (household roll-up honouring per-category privacy via `aggregateByCategoryWithPrivacy`).
- **Blocked by**: BE-030, BE-027, BE-008
- **Blocks**: WEB-013, WEB-021
- **Acceptance criteria**:
  - Household endpoint respects all three privacy levels.
  - `accountId` never present in `full_detail` responses (regression test).

#### BE-032: Dashboard performance — k6 budget gate

- **Area**: Backend
- **Effort**: M (~2d)
- **Status**: Stub (audit 21 Oct 2026) — k6 script is a fake gate. Finished by: CLN-017.
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
- **Status**: Broken (audit 21 Oct 2026) — period close uses v4 uuid where v7 is required and swallows the error; relay has no producer. Finished by: CLN-009.
- **Description**: Worker consumer that drains `notifications_outbox` (claim-pending + dispatch + mark-sent). Separate `period-close` cron at 00:30 UTC writes `leftover_snapshots`. Per ARCHITECTURE.md §5.4 / §9.
- **Blocked by**: BE-023, BE-029
- **Blocks**: QA-007
- **Acceptance criteria**:
  - Outbox events sent to channel exactly once on happy path; at-least-once with idempotent consumer on retry.
  - Period-close runs nightly, idempotent on `(plan_id, period_end)`.

#### BE-034: Data export + household deletion

- **Area**: Backend
- **Effort**: L (~3d)
- **Status**: Stub (audit 21 Oct 2026) — export only enqueues; delete only sets a flag; nothing consumes. Finished by: CLN-022.
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
- **Status**: Partial (audit 21 Oct 2026) — only `DisconnectBankUseCase` audits; no REVOKE migration. Finished by: CLN-005.
- **Description**: Per ARCHITECTURE.md §6 — `AuditLogger` port; `DrizzleAuditEventRepository` (INSERT-only). DB role `audit_admin` for redaction. `GET /audit-log?subjectType=&subjectId=&from=&to=` endpoint, household-scoped, paginated.
- **Blocked by**: BE-005, BE-015
- **Blocks**: WEB-019, SEC-004
- **Acceptance criteria**:
  - Every state-changing use case writes one `AuditEvent` (verified via integration test sweep).
  - App role lacks `UPDATE`/`DELETE` on `audit_log`.

#### BE-036: Row-Level Security policies + tenancy spec

- **Area**: Backend
- **Effort**: M (~2d)
- **Status**: Stub (audit 21 Oct 2026) — RLS migration is excluded from the journal and no GUC is set: RLS is not applied. Finished by: CLN-005.
- **Description**: Per ARCHITECTURE.md §6 — Postgres RLS policy on every tenant table (`USING household_id = current_setting('app.household_id')::uuid`). App workers `SET LOCAL` per request. Tenancy integration test asserts every REST endpoint refuses cross-tenant reads/writes. RLS enabled in CI + prod; off in dev.
- **Blocked by**: BE-015, BE-022, BE-026, BE-027, BE-034
- **Blocks**: SEC-004, QA-009
- **Acceptance criteria**:
  - `tenancy.spec.ts` covers every authenticated endpoint listed in §7.
  - RLS policies fail an unauthorised query at the DB layer even if app filter is bypassed.

#### BE-037: ESLint rule — `no-repo-without-scope`

- **Area**: Backend
- **Effort**: S (~1d)
- **Status**: Stub (audit 21 Oct 2026) — lint rule skips `this.repo.x()` calls, never fires. Finished by: CLN-005.
- **Description**: Custom ESLint rule (or `eslint-plugin-local-rules`) that flags any repo-port method call missing the `HouseholdScope` argument. Per ARCHITECTURE.md §6 (Multi-tenancy).
- **Blocked by**: BE-020, BE-026, BE-027
- **Blocks**: none (defence-in-depth)
- **Acceptance criteria**:
  - Lint rule fails CI when a repo method is called without scope.
  - Rule has a fixture-based unit test.

#### BE-038: OpenAPI / Swagger documentation

- **Area**: Backend
- **Effort**: S (~1d)
- **Status**: Partial (audit 21 Oct 2026) — 91 of 92 `@ApiResponse` have no type. Finished by: CLN-011.
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
- **Status**: Done (audit 21 Oct 2026) — Vite app builds.
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
- **Status**: Broken (audit 21 Oct 2026) — `RequireAuth` reads `access_token`, the store writes `pb_access_token`: every login bounces to /login. Finished by: CLN-014.
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
- **Status**: Done (audit 21 Oct 2026) — MobX stores and ReactiveView are in use.
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
- **Status**: Stub (audit 21 Oct 2026) — `api-types.ts` is never used; DTOs hand-written. Finished by: UI-007, CLN-011.
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
- **Status**: Partial (audit 21 Oct 2026) — screens exist; no 2FA step at login; Google callback depends on a stub. Finished by: CLN-014, CLN-004.
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
- **Status**: Broken (audit 21 Oct 2026) — field names differ from backend; enrolment deadlock and secret rotates on visit. Finished by: CLN-004.
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
- **Status**: Partial (audit 21 Oct 2026) — wizard exists; needs plans and categories endpoints that do not exist (not run). Finished by: CLN-011.
- **Description**: Per PRD §4.1 onboarding: confirm language → base currency → interesting currencies → connect first bank (optional) → create first plan (optional). State held in an `OnboardingReactiveView`; skippable steps.
- **Blocked by**: WEB-005, WEB-016, BE-028
- **Blocks**: none
- **Acceptance criteria**:
  - Auto-detected language pre-filled from browser.
  - Skipped steps land at dashboard with placeholder state.

#### WEB-008: Plans list + plan editor screens

- **Area**: Web
- **Effort**: L (~4d)
- **Status**: Stub (audit 21 Oct 2026) — backend has no `/plans*` endpoints. Finished by: CLN-011.
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
- **Status**: Stub (audit 21 Oct 2026) — backend has no history endpoint. Finished by: CLN-011.
- **Description**: Lazy-loads `GET /plans/:id/items/:itemId/history` per ARCHITECTURE.md §5.4. Shown as a side drawer with timestamp, user, before/after. Per PRD §4.5 versioning + audit-trail requirement.
- **Blocked by**: WEB-008
- **Blocks**: none
- **Acceptance criteria**:
  - Drawer opens from a history icon next to each planned item.
  - Consecutive same-user edits within 60 s are rolled up in the UI.

#### WEB-010: Bank connections — list, add, reconnect banner

- **Area**: Web
- **Effort**: L (~3d)
- **Status**: Partial (audit 21 Oct 2026) — bank list renders raw i18n keys; contract with backend broken. Finished by: BNK-005, UI-012.
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
- **Status**: Broken (audit 21 Oct 2026) — consent callback route and provider enum do not match the backend. Finished by: BNK-005.
- **Description**: Two dedicated routes — `/auth/oauth/google/callback` and `/bank/consent/callback` — that parse query-string state + token / code and POST to the appropriate backend endpoint. Per ARCHITECTURE.md §5.1 / §5.2.
- **Blocked by**: WEB-005, WEB-010
- **Blocks**: none
- **Acceptance criteria**:
  - Both callbacks succeed with sandbox / staging provider.
  - State parameter validated against a session-stored nonce.

#### WEB-012: Transactions list + detail modal + filters

- **Area**: Web
- **Effort**: L (~4d)
- **Status**: Broken (audit 21 Oct 2026) — amounts show `undefined NaN`; 500 on `bigint`. Finished by: CLN-002, UI-007, UI-014.
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
- **Status**: Broken (audit 21 Oct 2026) — calls missing `GET /plans`; view shape differs from backend. Finished by: CLN-011, CLN-012, UI-013.
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
- **Status**: Broken (audit 21 Oct 2026) — sends `{action, ids}` but DTO is `{op, ids, payload}`; spec asserts the wrong body. Finished by: CLN-014.
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
- **Status**: Stub (audit 21 Oct 2026) — backend has no `/categories*`. Finished by: CLN-011.
- **Description**: Per ARCHITECTURE.md §5.5 — `CategoriesScreen` list with rename / archive / privacy toggle per row. Category picker modal reused from transactions/plans.
- **Blocked by**: WEB-004, BE-027, DES-006
- **Blocks**: WEB-021
- **Acceptance criteria**:
  - Privacy toggle change reflects immediately via cache invalidation.
  - Archive hides from new-item pickers but keeps history visible.

#### WEB-016: Currency switcher + `MoneyView` component

- **Area**: Web
- **Effort**: S (~1d)
- **Status**: Stub (audit 21 Oct 2026) — no `/fx-rates` endpoint. Finished by: CLN-013.
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
- **Status**: Partial (audit 21 Oct 2026) — dynamic JSON import without `.default` (not run); uk/ru/pl incomplete. Finished by: CLN-014, UI-012.
- **Description**: Wire `react-intl` `IntlProvider` from `locale` slice; `LocaleSwitcher` in Settings. Persists to `localStorage` + best-effort `PATCH /me`. Switches instantly with no reload per PRD §4.12.
- **Blocked by**: WEB-001, I18N-002, BE-015
- **Blocks**: WEB-005, WEB-007, WEB-018, every screen with strings
- **Acceptance criteria**:
  - Switching locale updates UI in ≤ 100 ms.
  - Persisted across reload.

#### WEB-018: Settings screen (5 tabs)

- **Area**: Web
- **Effort**: M (~3d)
- **Status**: Partial (audit 21 Oct 2026) — tabs render; saving needs missing `PATCH /users/me`. Finished by: CLN-011.
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
- **Status**: Done (audit 21 Oct 2026) — audit drawer is real.
- **Description**: Per ARCHITECTURE.md §5.10 — `AuditLogDrawer` consumes `GET /audit-log?subjectType=planned_item&subjectId=…`. Reused with `WEB-009` history drawer.
- **Blocked by**: WEB-013, BE-035
- **Blocks**: none
- **Acceptance criteria**:
  - Drawer lists every audit event for the subject with actor + timestamp.

#### WEB-020: Manual transaction entry form

- **Area**: Web
- **Effort**: S (~1d)
- **Status**: Partial (audit 21 Oct 2026) — works but parses money with `Math.round(parseFloat*100)`. Finished by: CLN-014.
- **Description**: Per PRD §4.3 — `ManualTransactionForm` for cash/IOUs. Source flag set to `manual`. Reused inside Transactions screen and onboarding/empty states.
- **Blocked by**: WEB-012, BE-021
- **Blocks**: none
- **Acceptance criteria**:
  - Form fields: account, occurred_on, amount + currency, description, notes.
  - Submits via `POST /transactions`.

#### WEB-021: Household drill-in view (privacy-aware)

- **Area**: Web
- **Effort**: M (~2d)
- **Status**: Stub (audit 21 Oct 2026) — no household-category endpoints. Finished by: CLN-012, UI-013.
- **Description**: Per ARCHITECTURE.md §5.5 — `HouseholdCategoryDrillIn` renders the partner's spend in a category at the partner-chosen privacy level (total / total+counts / full). Reuses `GET /categories/:id/aggregate`.
- **Blocked by**: WEB-015, WEB-013, BE-031
- **Blocks**: none
- **Acceptance criteria**:
  - Three privacy views visually distinct.
  - No `accountId` leaks at any level.

#### WEB-022: Loading / empty / error states + skeletons

- **Area**: Web
- **Effort**: M (~2d)
- **Status**: Partial (audit 21 Oct 2026) — states exist on some screens; others crash or show raw keys (not fully checked). Finished by: UI-013, UI-012.
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
- **Status**: Partial (audit 21 Oct 2026) — scaffold exists; Expo 51 mixed with expo-* 55 modules, EAS build very likely fails. Finished by: CLN-015.
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
- **Status**: Broken (audit 21 Oct 2026) — `RootNavigator` returns `false` with a TODO: no app screen is reachable. Finished by: CLN-015.
- **Description**: React Navigation native stack + bottom tabs for Dashboard / Transactions / Plans / Settings. Auth stack separate. Per ARCHITECTURE.md §5.x mobile presentation layers.
- **Blocked by**: MOB-001
- **Blocks**: MOB-005, MOB-006, MOB-007, MOB-008
- **Acceptance criteria**:
  - Tab + stack navigation works on iOS simulator.
  - Protected-route guard mirrors web behaviour.

#### MOB-003: MobX + ReactiveView wiring (mobile)

- **Area**: Mobile
- **Effort**: XS (~0.5d)
- **Status**: Stub (audit 21 Oct 2026) — depends on empty shared-app. Finished by: CLN-016, CLN-015.
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
- **Status**: Broken (audit 21 Oct 2026) — sync getters always return null; base URL hard-coded to localhost. Finished by: CLN-015.
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
- **Status**: Broken (audit 21 Oct 2026) — cannot be reached past the navigator. Finished by: CLN-015.
- **Description**: RN versions of WEB-005 — `LoginScreen` (incl. TOTP step-up), `RegisterScreen`, `MagicLinkScreen`, OAuth via in-app browser + deep-link callback.
- **Blocked by**: MOB-002, MOB-004, BE-015, DES-002, I18N-002
- **Blocks**: MOB-006, MOB-007
- **Acceptance criteria**:
  - Full auth loop succeeds on iOS simulator and a real device.
  - All four flows produce a usable session.

#### MOB-006: TOTP enrolment + 2FA on iOS

- **Area**: Mobile
- **Effort**: M (~2d)
- **Status**: Stub (audit 21 Oct 2026) — depends on the TOTP deadlock and mobile navigator. Finished by: CLN-004, CLN-015.
- **Description**: Per ARCHITECTURE.md §5.1 — iOS-specific TOTP enrolment screen with QR code (`otpauth://`) deep-linkable to Authenticator / 1Password. Recovery codes flow.
- **Blocked by**: MOB-005
- **Blocks**: none
- **Acceptance criteria**:
  - QR opens directly in any TOTP app via `otpauth://` deep-link.
  - Recovery codes shareable once.

#### MOB-007: Deep linking — magic-link + OAuth callback

- **Area**: Mobile
- **Effort**: M (~2d)
- **Status**: Stub (audit 21 Oct 2026) — Apple association file has `TEAMID`. Finished by: CLN-015.
- **Description**: Configure iOS Universal Links for `https://<domain>/auth/magic-link` and the OAuth callback `https://<domain>/auth/oauth/google/callback`. Per PRD §4.1.
- **Blocked by**: MOB-005, INF-013
- **Blocks**: none
- **Acceptance criteria**:
  - Tapping a magic-link email on iOS opens the app and consumes the token.
  - Google OAuth round-trip returns to the app via Universal Link.

#### MOB-008: Biometric unlock (Face ID / Touch ID)

- **Area**: Mobile
- **Effort**: S (~1d)
- **Status**: Stub (audit 21 Oct 2026) — not reachable; not verified on device. Finished by: CLN-015, UI-016.
- **Description**: `expo-local-authentication` gates app open after backgrounding > N minutes. Tokens stay in keychain; biometric only unlocks the app shell.
- **Blocked by**: MOB-004
- **Blocks**: none
- **Acceptance criteria**:
  - First open after install offers opt-in.
  - Face ID prompts after 5-min background; falls back to passcode.

#### MOB-009: Locale resolution + i18n provider

- **Area**: Mobile
- **Effort**: S (~1d)
- **Status**: Partial (audit 21 Oct 2026) — mobile uk/ru/pl bundles are `{}`. Finished by: UI-012, CLN-015.
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
- **Status**: Stub (audit 21 Oct 2026) — title-only screen. Finished by: UI-016.
- **Description**: RN port of WEB-013 — same data shape, mobile-tuned layout (stacked sections, tappable lines, swipe-down to refresh). Per ARCHITECTURE.md §5.9 presentation layer.
- **Blocked by**: MOB-002, MOB-009, BE-030, BE-031, DES-005
- **Blocks**: MOB-013
- **Acceptance criteria**:
  - All PRD §4.11 widgets present.
  - Pull-to-refresh invalidates the `PlanActuals` tag.

#### MOB-011: Transactions list + detail + mapping modal

- **Area**: Mobile
- **Effort**: L (~3d)
- **Status**: Stub (audit 21 Oct 2026) — title-only screen. Finished by: UI-016.
- **Description**: RN port of WEB-012 — virtualised list, filter sheet, transaction detail full-screen modal with mapping picker. Per ARCHITECTURE.md §5.3.
- **Blocked by**: MOB-009, BE-022, DES-004
- **Blocks**: MOB-013
- **Acceptance criteria**:
  - 5 000-row fixture scrolls at 60 fps on iPhone 12+ class device.
  - Mapping change is optimistic with rollback.

#### MOB-012: Plans list + planned-item editor (mobile parity)

- **Area**: Mobile
- **Effort**: M (~3d)
- **Status**: Stub (audit 21 Oct 2026) — title-only screen; plan editor parses money with `parseFloat`. Finished by: UI-016, CLN-014.
- **Description**: RN port of WEB-008 — list, editor, custom period picker. Versioning UX matches web.
- **Blocked by**: MOB-009, BE-026, DES-002
- **Blocks**: none
- **Acceptance criteria**:
  - All plan CRUD reachable on iOS.

#### MOB-013: Notification routing layer (push placeholder)

- **Area**: Mobile
- **Effort**: S (~1d)
- **Status**: Stub (audit 21 Oct 2026) — no notification channel. Finished by: AI-009.
- **Description**: Per ARCHITECTURE.md §5.7 — wire a `NotificationChannel` shape on the client side so v2 can plug in `expo-notifications` without rewriting business logic. MVP: register no-op receiver; emails remain the sole channel.
- **Blocked by**: MOB-001
- **Blocks**: none (v2-readiness)
- **Acceptance criteria**:
  - Architecture stub committed; documented in code comment that v2 enables `expo-notifications`.

#### MOB-014: TestFlight pipeline + App Store metadata

- **Area**: Mobile
- **Effort**: M (~2d)
- **Status**: Stub (audit 21 Oct 2026) — `eas.json` has `*_PLACEHOLDER` ids; `eas-build.yml` never ran. Finished by: CLN-015.
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
- **Status**: Done (audit 21 Oct 2026) — tokens exist.
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
- **Status**: Done (audit 21 Oct 2026) — component library scaffold exists.
- **Description**: Build the base 6–8 components used by every screen (Button, Input, Select, Toggle, Modal, Drawer, ProgressBar). Same API surface on web + RN; styled with tokens.
- **Blocked by**: DES-001
- **Blocks**: WEB-005, WEB-008, MOB-005, MOB-012
- **Acceptance criteria**:
  - Storybook (web) demonstrates each component in all states.
  - RN equivalents exposed via parallel `<Button />` etc.

#### DES-003: Bank-connect flow visuals

- **Area**: Design
- **Effort**: S (~1d)
- **Status**: Done (audit 21 Oct 2026) — visual assets exist under docs/design-arctic (the app does not follow them yet). Finished by: UI-009.
- **Description**: Visuals for the bank-picker, history-window picker, consent-redirect spinner, success state. Per PRD §4.2.
- **Blocked by**: DES-002
- **Blocks**: WEB-010, MOB-005 (reuse)
- **Acceptance criteria**:
  - Empty / loading / error variants documented.

#### DES-004: Transaction list + detail visuals

- **Area**: Design
- **Effort**: S (~1d)
- **Status**: Done (audit 21 Oct 2026) — visual assets exist (the app does not follow them yet). Finished by: UI-009.
- **Description**: Visuals for the list row (date, merchant, amount, mapped badge, source icon), filter sheet, detail modal, mapping picker.
- **Blocked by**: DES-002
- **Blocks**: WEB-012, MOB-011
- **Acceptance criteria**:
  - List row supports unmapped/mapped/transfer/ignored variants.

#### DES-005: Dashboard visuals — sections, progress bars, leftover

- **Area**: Design
- **Effort**: M (~2d)
- **Status**: Done (audit 21 Oct 2026) — visual assets exist (the app does not follow them yet). Finished by: UI-013.
- **Description**: Visuals for the home screen: plan header, income/expense sections, red/amber/green progress bars, unplanned section, leftover bucket card, bottom-line panel. Per PRD §4.11.
- **Blocked by**: DES-002
- **Blocks**: WEB-013, MOB-010
- **Acceptance criteria**:
  - Over-budget red state visible at a glance.
  - Currency switcher affordance is discoverable.

#### DES-006: Categories + privacy visuals

- **Area**: Design
- **Effort**: S (~1d)
- **Status**: Done (audit 21 Oct 2026) — visual assets exist (the app does not follow them yet). Finished by: UI-013.
- **Description**: Icon set for pre-seeded categories + privacy-level toggles (total / total+counts / full). Per PRD §4.9.
- **Blocked by**: DES-002
- **Blocks**: WEB-015, WEB-021
- **Acceptance criteria**:
  - 11 default-category icons delivered as SVG.
  - Three privacy-level visuals differ at a glance.

#### DES-007: Empty / loading / error illustration kit

- **Area**: Design
- **Effort**: S (~1d)
- **Status**: Done (audit 21 Oct 2026) — visual assets exist (the app does not follow them yet). Finished by: UI-011.
- **Description**: SVG illustrations for empty states (no plan yet, no transactions yet), network error, sync failure banner. Per PRD reliability NFR.
- **Blocked by**: DES-001
- **Blocks**: WEB-022, MOB-010, MOB-011
- **Acceptance criteria**:
  - One illustration per state; all in single SVG file with tokenised colours.

#### DES-008: Light / Dark Theme Switching — toggle, persistence, no-FOUC

- **Area**: Design
- **Effort**: S (~1d)
- **Status**: Stub (audit 21 Oct 2026) — `ThemeContext` hard-codes dark; no toggle. Finished by: UI-010.
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
- **Status**: Done (audit 21 Oct 2026) — extraction pipeline works.
- **Description**: Set up `react-intl` extract → ICU JSON pipeline. Resource bundles under `packages/web/public/locales/<code>.json` and `packages/mobile/assets/locales/<code>.json` per ARCHITECTURE.md §4 / §5.8. Build-time bundle duplication to backend for email rendering (§5.8 OQ2).
- **Blocked by**: WEB-001, MOB-001
- **Blocks**: I18N-002, I18N-003
- **Acceptance criteria**:
  - `pnpm i18n:extract` produces a fresh `en.json` from `<FormattedMessage>` calls.
  - Backend has access to identical bundles at runtime.

#### I18N-002: `react-intl` provider + ESLint `no-literal-string` rule

- **Area**: i18n
- **Effort**: S (~1d)
- **Status**: Done (audit 21 Oct 2026) — react-intl provider and lint rule exist.
- **Description**: Wire `react-intl` `IntlProvider` on web + mobile per ARCHITECTURE.md §5.8. Enable `formatjs/no-literal-string-in-jsx` or `react-intl/no-literal-string` ESLint rule. CI fails on any inline string in JSX.
- **Blocked by**: I18N-001
- **Blocks**: WEB-005, WEB-017, MOB-005, MOB-009
- **Acceptance criteria**:
  - Adding `<span>Hello</span>` to a presentation component fails lint.
  - Rule is scoped to `presentation/` only.

#### I18N-003: Resource bundles — `en.json` baseline + plural placeholders

- **Area**: i18n
- **Effort**: M (~2d)
- **Status**: Partial (audit 21 Oct 2026) — `en.json` is missing 44 keys used in code. Finished by: UI-012.
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
- **Status**: Stub (audit 21 Oct 2026) — web uk/ru/pl have 138 of 290 keys, about 92 copied from English; mobile are `{}`. Finished by: UI-012.
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
- **Status**: Partial (audit 21 Oct 2026) — MJML files exist but no magic-link template and not copied to `dist`. Finished by: CLN-009.
- **Description**: MJML templates for `bank_reconnect_due`, `over_budget_80/100`, `weekly_digest` in en/uk/ru/pl. ICU variables for interpolation per ARCHITECTURE.md §5.7.
- **Blocked by**: I18N-003, I18N-004
- **Blocks**: BE-029
- **Acceptance criteria**:
  - 12 template files (3 × 4) rendered at build time.
  - Visual review in Mailpit for all 12.

#### I18N-006: Locale-aware date/number/currency formatters

- **Area**: i18n
- **Effort**: S (~1d)
- **Status**: Partial (audit 21 Oct 2026) — core formatters exist; not applied across the UI. Finished by: UI-012.
- **Description**: Adopt `BE-010` outputs across web + mobile presentation. Verifies `1 234,56 zł` in `pl`, `1,234.56` in `en`, etc. per PRD §4.12.
- **Blocked by**: BE-010, I18N-002
- **Blocks**: WEB-013, WEB-016, MOB-010
- **Acceptance criteria**:
  - Visual snapshot tests across all four locales pass.

#### I18N-007: Localised seed-category names + plan templates

- **Area**: i18n
- **Effort**: S (~1d)
- **Status**: Not started (audit 21 Oct 2026) — skipped; no v1.1 task, decide under CLN-011 (categories). Finished by: CLN-011.
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
- **Status**: Done (audit 21 Oct 2026) — Vitest runs; 443 unit tests pass (many mock the code under test).
- **Description**: Vitest for `@power-budget/core`, `packages/backend`, `packages/web`. Coverage reports merged via Codecov / lcov. CI gate at 80% line coverage for `core` and `backend/application`.
- **Blocked by**: BE-002, BE-001, WEB-001
- **Blocks**: every unit-test bullet downstream
- **Acceptance criteria**:
  - `pnpm test` runs across all packages.
  - Coverage report uploaded as CI artefact.

#### QA-002: Integration test harness (backend)

- **Area**: QA
- **Effort**: M (~2d)
- **Status**: Broken (audit 21 Oct 2026) — `@testcontainers/postgresql` missing; both suites cannot load; not in CI. Finished by: CLN-003.
- **Description**: Spin up Postgres + Redis via `testcontainers` (or compose); Drizzle migrations applied per test suite; per-test transaction rollback. Test fixtures for households, users, accounts, transactions.
- **Blocked by**: BE-005, INF-008
- **Blocks**: QA-005, QA-009, every backend integration test
- **Acceptance criteria**:
  - `pnpm test:integration` boots containers + runs suites end-to-end in CI.
  - Suite completes in < 5 min.

#### QA-003: Playwright E2E setup (web)

- **Area**: QA
- **Effort**: M (~2d)
- **Status**: Stub (audit 21 Oct 2026) — no server in CI so every test skips; selectors do not match the UI. Finished by: CLN-017.
- **Description**: Playwright project under `tests/e2e/`. Runs against staging or a local stack. Auth fixture creates a household with two users. Per ARCHITECTURE.md §11 sprint 10.
- **Blocked by**: WEB-013, INF-013
- **Blocks**: QA-006
- **Acceptance criteria**:
  - One smoke test (login + dashboard load) passes in CI nightly.

#### QA-004: Detox decision — defer mobile E2E to v2 (documented)

- **Area**: QA
- **Effort**: XS (~0.5d)
- **Status**: Done (audit 21 Oct 2026) — ADR written.
- **Description**: Decision task: mobile E2E via Detox costs ≥ 1 week of setup for two users at MVP. Document the decision to defer and rely on manual TestFlight QA + shared unit + RN-component tests instead.
- **Blocked by**: MOB-001
- **Blocks**: none
- **Acceptance criteria**:
  - ADR committed under `docs/mvp/adr/`.

#### QA-005: Tenancy spec — every endpoint cross-tenant test

- **Area**: QA
- **Effort**: M (~2d)
- **Status**: Stub (audit 21 Oct 2026) — 38 mock-only tests; the real IDORs are not covered. Finished by: CLN-005.
- **Description**: Per ARCHITECTURE.md §6 — `tenancy.spec.ts` for every authenticated endpoint listed in §7. Household A's token cannot read or write household B's data; expected status 404 (not 403, to avoid leaking existence).
- **Blocked by**: QA-002, BE-036
- **Blocks**: none (mandatory gate)
- **Acceptance criteria**:
  - Suite covers ≥ 95% of REST endpoints (excluding `/healthz`, `/readyz`, `/locales`).
  - Adding a new endpoint without a tenancy test fails a custom CI check.

#### QA-006: Visual regression — 4 locales × key screens

- **Area**: QA
- **Effort**: M (~2d)
- **Status**: Stub (audit 21 Oct 2026) — 40 identical 1x1 PNG baselines. Finished by: CLN-017.
- **Description**: Playwright + `playwright-visual-regression` (or Chromatic) captures key screens (login, dashboard, transactions, plan editor, settings) in all four locales. Per PRD §9 risk (text expansion in uk/ru/pl).
- **Blocked by**: QA-003, I18N-004
- **Blocks**: none
- **Acceptance criteria**:
  - 5 screens × 4 locales = 20 baseline snapshots committed.
  - PR fails on > 1% pixel diff.

#### QA-007: Notification end-to-end test

- **Area**: QA
- **Effort**: S (~1d)
- **Status**: Stub (audit 21 Oct 2026) — uses in-memory doubles and never runs a processor. Finished by: CLN-009, CLN-017.
- **Description**: Integration test triggers each of the 3 notification kinds + asserts an email lands in Mailpit (dev) / inbox-mock in CI. Per ARCHITECTURE §5.7.
- **Blocked by**: BE-029, BE-033, QA-002
- **Blocks**: none
- **Acceptance criteria**:
  - All 3 kinds tested in all 4 locales (12 cases).

#### QA-008: k6 dashboard perf SLI test

- **Area**: QA
- **Effort**: S (~1d)
- **Status**: Stub (audit 21 Oct 2026) — k6 has a placeholder token, starts no backend, no failure threshold. Finished by: CLN-017.
- **Description**: k6 script asserts p95 < 500 ms for `GET /plans/:id/dashboard` against the 5 000-row fixture per PRD §6 / ARCHITECTURE §11 sprint 7.
- **Blocked by**: BE-032, INF-012
- **Blocks**: none
- **Acceptance criteria**:
  - k6 script committed; runs in CI on `perf` label.

#### QA-009: Manual test pass plan + partner-onboarding rehearsal

- **Area**: QA
- **Effort**: M (~2d)
- **Status**: Partial (audit 21 Oct 2026) — test plan document exists; partner onboarding cannot work (invite broken). Finished by: CLN-006.
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
- **Status**: Partial (audit 21 Oct 2026) — AES-GCM with one KEK, no per-user DEK; TOTP secret plaintext. Finished by: CLN-004.
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
- **Status**: Stub (audit 21 Oct 2026) — `RotateUserDekUseCase` is used only by its spec; runbook still says `fly`. Finished by: CLN-004.
- **Description**: Background job re-encrypts a user's columns with a new DEK. Runbook documents master KEK rotation via KMS native operations. Per ARCHITECTURE.md §6.
- **Blocked by**: SEC-001, BE-023
- **Blocks**: none
- **Acceptance criteria**:
  - Job runs idempotently per user.
  - Runbook covers master + per-user rotation.

#### SEC-003: TOTP step-up enforcement for sensitive actions

- **Area**: Security
- **Effort**: S (~1d)
- **Status**: Broken (audit 21 Oct 2026) — enable needs a recent verify and verify needs a secret: enrolment is impossible. Finished by: CLN-004.
- **Description**: Per ARCHITECTURE.md §6 — bank connect/disconnect, Wise token reveal, change email, data export require TOTP re-verification within the last 5 min. Middleware enforces.
- **Blocked by**: BE-015, SEC-001
- **Blocks**: BE-018, BE-019, BE-034
- **Acceptance criteria**:
  - Middleware decorator `@RequireRecentTotp(5min)` returns 403 with `requires_totp` code when stale.
  - Web/mobile prompts inline for the code.

#### SEC-004: Web security headers — CSP, HSTS, CSRF

- **Area**: Security
- **Effort**: S (~1d)
- **Status**: Partial (audit 21 Oct 2026) — helmet is set; the headers spec is tautological; no production CSP on web. Finished by: CLN-014, CLN-017.
- **Description**: Strict CSP (no inline scripts), HSTS with preload, `Referrer-Policy: same-origin`, `Permissions-Policy: ()`, SameSite=Lax cookies, CSRF token on cookie-auth state-changing routes (none in MVP — verify). Per ARCHITECTURE.md §6.
- **Blocked by**: BE-015, WEB-001, INF-013
- **Blocks**: none (defence-in-depth)
- **Acceptance criteria**:
  - Mozilla Observatory score ≥ A-.
  - Inline-script smoke test blocked by CSP.

#### SEC-005: GDPR — privacy policy, DPA text, data-deletion runbook

- **Area**: Security
- **Effort**: M (~2d)
- **Status**: Stub (audit 21 Oct 2026) — GDPR export and delete do not execute; policy text only. Finished by: CLN-022.
- **Description**: Author privacy policy + DPA placeholder + data-deletion runbook covering soft-hold (30 d) and hard-delete + anonymisation per ARCHITECTURE.md §6.
- **Blocked by**: BE-034
- **Blocks**: QA-009
- **Acceptance criteria**:
  - Documents committed under `docs/mvp/legal/`.
  - Runbook covers triggering deletion from both UI and admin path.

#### SEC-006: Rate limiting on auth endpoints

- **Area**: Security
- **Effort**: S (~1d)
- **Status**: Not started (audit 21 Oct 2026) — no throttler anywhere (the pentest checklist wrongly claimed one). Finished by: CLN-004.
- **Description**: NestJS `ThrottlerModule` on `/auth/login`, `/auth/magic-link/request`, `/auth/totp/verify` — sliding window per IP + per email. Defends against credential stuffing.
- **Blocked by**: BE-015
- **Blocks**: none
- **Acceptance criteria**:
  - 5 failed attempts / 15 min returns 429.
  - Successful login resets the counter.

#### SEC-007: 2FA-at-bank-connect enforcement gate

- **Area**: Security
- **Effort**: S (~1d)
- **Status**: Broken (audit 21 Oct 2026) — gate requires TOTP, which cannot be enrolled. Finished by: CLN-004, BNK-005.
- **Description**: `POST /bank-connections/initiate` refuses if user has no enrolled TOTP. Web/mobile flow routes to enrolment first. Per PRD §4.1 "TOTP mandatory once a bank is connected".
- **Blocked by**: BE-012, BE-017
- **Blocks**: WEB-010, MOB-005
- **Acceptance criteria**:
  - Endpoint returns 403 `requires_totp_enrollment` with redirect hint.

#### SEC-008: PII redaction in audit log payloads

- **Area**: Security
- **Effort**: S (~1d)
- **Status**: Stub (audit 21 Oct 2026) — `REDACTING_AUDIT_LOGGER` is never injected. Finished by: CLN-005.
- **Description**: Per ARCHITECTURE.md §5.10 OQ2 — redact bank account numbers and Money amounts above a configured threshold from `before`/`after` JSONB to prevent leakage in exports.
- **Blocked by**: BE-035
- **Blocks**: BE-034
- **Acceptance criteria**:
  - Account numbers replaced with last-4 in audit rows.
  - Amounts above threshold replaced with `redacted: true` marker.

#### SEC-009: Pen-test checklist (self-run pre-launch)

- **Area**: Security
- **Effort**: S (~1d)
- **Status**: Partial (audit 21 Oct 2026) — checklist corrected in CLN-020; the pentest itself is still to do. Finished by: CLN-001, CLN-005.
- **Description**: Self-run OWASP Top-10 checklist: SQLi (Drizzle parameterisation), XSS (CSP + escaping), broken auth (rate limit + TOTP), IDOR (tenancy spec), SSRF (no user-supplied URLs in fetch), CSRF (bearer tokens). Document findings.
- **Blocked by**: QA-005, SEC-004, SEC-006
- **Blocks**: none (release gate)
- **Acceptance criteria**:
  - Checklist committed with one bullet per item + verdict.
  - Any FAIL escalated to a ticket before launch.

---

## §5 — Critical Path (v1.0, historical; see §7 for the v1.1 chain)

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

## §6 — Open Questions / Decisions Needed Before Day 1 (v1.0)

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

---

## §7 — v1.1 plan (Oct 2026)

This section replaces the v1.0 execution plan. It comes from the 21 Oct 2026 audits (`docs/handoff/audit-code.md`, `audit-ui.md`) and the bank-feed design `docs/mvp/plan-banking.md`. The published, interactive version of the plan is the artifact linked from `STATUS.md`. The v1.0 catalogue (§4) stays as history; its statuses are corrected in §0.

Conventions: the same task format as §4. `Needs the owner or partner` marks tasks that need a person (accounts, tokens, phone, partner). Effort bands follow §2. Tasks are grouped by phase; the phase order is the intended execution order, and M0, UI, MOB and OPT run beside the main chain.

Total: 78 tasks, about 167.1 person-days (including optional work).

| Phase | Name | Tasks | Days |
| --- | --- | --- | --- |
| P0 | Emergency stop | 3 | 1.85 |
| P1 | Foundation | 7 | 11.5 |
| M0 | Spikes and hosting | 7 | 7 |
| P2 | Working web journeys | 12 | 38 |
| M1 | Both banks to dashboard | 14 | 28 |
| M2 | Live signals | 11 | 19.25 |
| M3 | AI categorisation | 9 | 23 |
| M4 | Hardening | 4 | 7 |
| UI | UI polish | 5 | 11 |
| MOB | Mobile | 3 | 9 |
| OPT | Options | 3 | 11.5 |

### P0 — Emergency stop

Close the live API and patch the holes that let anyone forge tokens.

**Exit criteria**: Render suspended; secret rotated; Google stub gone; IDORs and Wise ref closed; PR #121 closed.

#### NEW-001: Suspend the Render service until CLN-001 is merged

- **Area**: Security
- **Phase**: P0
- **Effort**: XS (~0.1d)
- **Status**: Pending (owner action on Render)
- **Needs the owner or partner**: yes
- **Description**: The deployed API accepts forged JWTs and has public stub OAuth routes. Until the hot-fix lands, take the Render service down (Suspend) or make it private. Needs the owner's Render login.
- **Blocked by**: none
- **Blocks**: CLN-001
- **Acceptance criteria**:
  - The Render service shows Suspended, and `GET /health` on the onrender.com URL no longer returns 200.
  - Resumed only after CLN-001 is merged and the rotated `JWT_SECRET` is set.
- **Source**: audit-code.md / audit-ui.md

#### CLN-001: Security hot-fix pack for the live API

- **Area**: Security
- **Phase**: P0
- **Effort**: M (~1.5d)
- **Status**: In progress
- **Description**: One PR that closes the exploitable holes: (1) fail at boot if `JWT_SECRET` is missing or under 32 bytes, pin HS256, set the env var in Render and rotate it (C1); (2) remove the public Google OAuth stub routes until a real client exists (C2); (3) household delete and household dashboard use `user.householdId`, check the owner role (C3, H1); (4) per-connection Wise consent ref, lookup scoped by `(connectionId, user, household)` (C4); (5) verify the Svix signature on the Resend bounce webhook (H2); (6) gate `/docs` and tighten CORS: no `localhost:5173`, no `credentials:true` (L1, L2).
- **Blocked by**: NEW-001
- **Blocks**: HOST-002
- **Acceptance criteria**:
  - Boot fails without a valid `JWT_SECRET`; a token signed with the old fallback `dev-secret-change-me` is rejected (HTTP-level test).
  - `/auth/oauth/google/*` returns 404; no code path issues tokens for an empty email.
  - A user cannot delete or read another household by path id (HTTP-level test for both IDORs).
  - Two Wise connections never share a ref; a second user's token cannot be written onto another connection.
  - An unsigned bounce webhook returns 401.
  - `GET /docs` is not public on the deployed service; CORS allows only the real web origin.
- **Source**: audit-code.md / audit-ui.md

#### CLN-021: Close PR #121 (domain-first refactor), do not rebase

- **Area**: Repo and docs
- **Phase**: P0
- **Effort**: XS (~0.25d)
- **Status**: Done (PR #121 closed)
- **Description**: PR #121 moves 256 files and fails lint, typecheck and build after a scratch merge. Close it with a comment. If the domain-first layout is still wanted, redo it later as one mechanical `git mv` commit after the journeys work.
- **Blocked by**: none
- **Blocks**: none
- **Acceptance criteria**:
  - PR #121 is closed with a comment linking the audit section.
  - The 'split files over 300 LOC' idea is kept as guidance only.
- **Source**: audit-code.md / audit-ui.md

### P1 — Foundation

A clean checkout can log in and the tests check real behaviour.

**Exit criteria**: Web login works; dashboard and transactions do not return 500; integration tests run in CI; dependabot triaged; backlog matches reality.

#### CLN-002: Request and response hygiene

- **Area**: Backend
- **Phase**: P1
- **Effort**: M (~2.5d)
- **Status**: Planned
- **Description**: Add a global `ValidationPipe({whitelist, forbidNonWhitelisted, transform})`, DTO validators and `ParseUUIDPipe` (C5). Map domain errors to HTTP (401/403/4xx) and keep the error `code`, including `requires_totp` and `requires_totp_enrollment` (H3). Return money as a string of minor units in every response DTO so `bigint` never reaches `JSON.stringify` (C8, L6). Absorbs UI-003, UI-004 (error mapping part).
- **Blocked by**: none
- **Blocks**: CLN-014, CLN-004, CLN-011
- **Acceptance criteria**:
  - `POST /auth/login` with a wrong password returns 401 with a `code`, not 500.
  - `GET /plans/:id/dashboard`, `/transactions` and `/accounts` return 200 with string minor-unit amounts (HTTP-level tests).
  - A raw `limit=abc` or an unknown field is rejected with 400.
  - `SentryExceptionFilter` reports only 5xx.
- **Source**: audit-code.md / audit-ui.md

#### CLN-003: Real integration harness

- **Area**: Tests
- **Phase**: P1
- **Effort**: M (~2d)
- **Status**: Planned
- **Description**: Add `@testcontainers/postgresql` and a Redis container to the backend devDependencies, a CI job that runs `test:integration` (Docker on ubuntu runners), a Fastify `inject` HTTP e2e base class and the `@vitest/coverage-v8` provider (H28).
- **Blocked by**: none
- **Blocks**: CLN-019, CLN-004, CLN-005, CLN-008r, CLN-017
- **Acceptance criteria**:
  - `pnpm -F @power-budget/backend test:integration` loads and runs both suites on a clean checkout.
  - The CI job is required and green on master.
  - Backend coverage is reported.
- **Source**: audit-code.md / audit-ui.md

#### CLN-018: Migration hygiene

- **Area**: Backend
- **Phase**: P1
- **Effort**: XS (~0.5d)
- **Status**: Planned
- **Description**: Regenerate drizzle snapshots for 0004 and 0005 against a clean database without renaming applied tags, so the next `drizzle-kit generate` does not re-emit those tables (M12). Split the migrate role from the app role.
- **Blocked by**: none
- **Blocks**: CLN-005, BNK-003
- **Acceptance criteria**:
  - `drizzle-kit generate` on a clean database produces no diff.
  - The app connects with a role that cannot run DDL; migrations run with a separate role.
- **Source**: audit-code.md / audit-ui.md

#### CLN-019: Dependency alignment

- **Area**: Repo and docs
- **Phase**: P1
- **Effort**: M (~2d)
- **Status**: Planned
- **Description**: Merge the safe dependabot batch (Actions majors, backend patch/minor, axios 1.18, tooling, react-intl, vitest 3.2.6 PR #145), close the RN/react and react-router 7 PRs, align `@nestjs/common` and `@nestjs/testing` to 11 (H27), unify on one vitest major, bump vite to 6.4.4 (audit section 6).
- **Blocked by**: CLN-003
- **Blocks**: none
- **Acceptance criteria**:
  - `pnpm audit` shows no high or critical runtime advisory (axios, fast-uri).
  - All `@nestjs/*` packages are on one major; one vitest major across packages.
  - Dependabot PRs #139-#145, #150-#156 are merged or closed with a reason.
- **Source**: audit-code.md / audit-ui.md

#### CLN-010: Worker topology

- **Area**: Backend
- **Phase**: P1
- **Effort**: M (~1.5d)
- **Status**: Planned
- **Description**: Register crons and processors only in a worker module, never in the API module, so nothing runs twice (C12). Use a `jobId` per connection for dedupe, pass the Redis URL with TLS intact (H13), make the weekly digest timezone-aware and fix its ISO week year and payload (M15). The always-on host question (M16) is closed by HOST-001.
- **Blocked by**: HOST-001
- **Blocks**: CLN-009, CLN-013, SYNC-003, CLN-022
- **Acceptance criteria**:
  - Exactly one cron registration per queue (test enumerates the BullMQ repeatables).
  - `rediss://` URLs connect.
  - The digest runs at 08:00 in the user's timezone.
- **Source**: audit-code.md / audit-ui.md

#### CLN-014: Web client fixes

- **Area**: Web
- **Phase**: P1
- **Effort**: M (~2.5d)
- **Status**: Planned
- **Description**: `RequireAuth` reads the token through `tokenStore` (C13, absorbs UI-001); dev CSP allows the API origin (UI-002); `/auth/*` skips the refresh interceptor so a 401 does not queue behind itself (H24); i18n JSON import uses `.default`; TOTP screen field names match the backend; bulk body is `{op, ids, payload}` (H25); money goes through core `parseMoney` (M19); production CSP via `_headers`, hidden source maps and a logout button (M20); deploy to Cloudflare Pages (INF-011).
- **Blocked by**: CLN-002
- **Blocks**: CLN-004, CLN-017, UI-009, CLN-016, CLN-015
- **Acceptance criteria**:
  - Log in on the deployed web app and land on a protected route (Playwright against a real backend).
  - A bulk action reaches the backend with the right body and the spec asserts it.
  - No `parseFloat(...)*100` remains in web money code.
  - The Pages URL resolves and SPA deep links do not 404.
- **Source**: audit-code.md / audit-ui.md

#### CLN-020: Docs truth reset

- **Area**: Repo and docs
- **Phase**: P1
- **Effort**: XS (~0.5d)
- **Status**: In progress (this PR)
- **Description**: Set BACKLOG statuses to the audit results, rewrite STATUS.md, correct the false PASS lines in the pentest checklist, fix the agent instruction files (MobX, not RTK) and the key-rotation runbook (L8, L9). Copy plan-banking.md into `docs/mvp/`.
- **Blocked by**: none
- **Blocks**: none
- **Acceptance criteria**:
  - Every v1.0 task has a real status and the task that finishes it.
  - No 'Wave N Done' heading remains.
  - CLAUDE.md, AGENTS.md and `.github/copilot-instructions.md` are identical and say MobX.
  - Dead `.eslintrc.cjs` files and `design-tokens/package-lock.json` are listed for deletion in a code PR (out of scope for this docs PR).
- **Source**: audit-code.md / audit-ui.md

### M0 — Spikes and hosting

Mostly owner and partner actions, in parallel with P1 and P2: Enable Banking, Wise, PKO emails, VPS and domain.

**Exit criteria**: EB facts file exists; the VPS answers over HTTPS; the Wise token question is answered; PKO emails arrive.

#### HOST-001: ADR-003 — always-on EU VPS replaces Render free

- **Area**: Hosting
- **Phase**: M0
- **Effort**: XS (~0.5d)
- **Status**: Planned
- **Needs the owner or partner**: yes
- **Description**: Write the ADR (§2): it supersedes ADR-002's runtime choice and keeps Neon and Cloudflare Pages. Update `docs/mvp/ARCHITECTURE.md` §9/§10 and `CLAUDE.md` (all three agent-instruction files must stay in sync).
- **Blocked by**: none
- **Blocks**: CLN-010, HOST-002
- **Acceptance criteria**:
  - ADR merged with a cost table and the rejected alternatives; user sign-off recorded 👤.
- **Source**: plan-banking.md

#### HOST-002: Provision VPS + Docker Compose deploy

- **Area**: Hosting
- **Phase**: M0
- **Effort**: M (~2.5d)
- **Status**: Planned
- **Needs the owner or partner**: yes
- **Description**: The user buys the VPS. Set it up: firewall, non-root deploy user, unattended upgrades. Compose services `api`, `worker`, `redis` (AOF on) and `caddy`. A GitHub Actions job builds the image to GHCR and deploys over SSH (`docker compose pull && up -d`, then migrations). Secrets go in a root-only `.env` with mode 600, including the EB private key PEM. Nightly `pg_dump` of Neon to object storage.
- **Blocked by**: HOST-001, CLN-001
- **Blocks**: HOST-003, SYNC-003, WISE-001, PKOE-002, HOST-004
- **Acceptance criteria**:
  - `https://api.<domain>/health` is green; a deploy from main runs without manual steps.
  - The worker runs as a separate container; `START_WORKER` no longer needed.
  - Restore from backup rehearsed once.
  - `render.yaml` either removed or kept documented as a fallback.
- **Source**: plan-banking.md

#### HOST-003: Domain, Cloudflare DNS, TLS, Email Routing

- **Area**: Hosting
- **Phase**: M0
- **Effort**: XS (~0.5d)
- **Status**: Planned
- **Needs the owner or partner**: yes
- **Description**: The user buys the domain. DNS on Cloudflare; `api.` → VPS (proxied off, or Full-strict TLS); `in.` MX via Email Routing.
- **Blocked by**: HOST-002
- **Blocks**: SPK-004, BNK-005, PKOE-001
- **Acceptance criteria**:
  - The Wise URL rules are met: HTTPS on 443, a domain, a trusted CA, no redirects.
  - EB redirect URL `https://app.<domain>/bank/callback` (or `power-budget.pages.dev`) registered in the EB app 👤.
- **Source**: plan-banking.md

#### SPK-001: Enable Banking restricted-mode end-to-end with real PKO BP + Wise

- **Area**: Spike
- **Phase**: M0
- **Effort**: M (~1.5d)
- **Status**: Planned
- **Needs the owner or partner**: yes
- **Description**: The user registers in the EB Control Panel, creates a Production application with an RSA key (`kid` = app id), and links his own PKO and Wise accounts ("Activate by linking accounts"). The partner links hers. Then a throwaway script (based on `enablebanking-api-samples`) runs `GET /aspsps?country=PL`, `/auth` → `/sessions` → accounts → transactions (`strategy=longest`) → balances, attended and unattended.
- **Blocked by**: none
- **Blocks**: BNK-001, SYNC-002, SYNC-005
- **Acceptance criteria**:
  - Exact ASPSP `name`/`country` recorded for PKO BP ("PKO Bank Polski" per the PL market page ✅) and Wise; `maximum_consent_validity`, `required_psu_headers`, `psu_types`, `auth_methods` written to `docs/research/eb-aspsp-facts.md`.
  - Confirmed: does Wise show one EB account per currency balance? Is `entry_reference` present on booked rows? Is a PDNG or HOLD status visible for an uncleared card payment? History depth with `longest`.
  - Confirmed whether the partner's own linking works from the user's application, and whether a cap on linked accounts exists (email to EB support if unclear; draft in §6).
  - Confirmed whether `GET /sessions/{id}` and balances calls count against the ASPSP daily limit (EB Data Insights, or a test with 5 unattended calls).
- **Source**: plan-banking.md

#### SPK-002: Wise personal token + `balances#update` webhook

- **Area**: Spike
- **Phase**: M0
- **Effort**: S (~1d)
- **Status**: Planned
- **Needs the owner or partner**: yes
- **Description**: Both partners check `wise.com → Settings → API tokens` on their personal profiles. With a temporary Full token, create a `balances#update` subscription to a test HTTPS endpoint (on the VPS from HOST-002, or a temporary tunnel). Make a card payment and capture the payload. Revoke the Full token and check that the subscription still delivers. With a read-only token, call `/v1/profiles`, `/v4/profiles/{id}/balances?types=STANDARD` ⚠ and `/v1/profiles/{id}/activities`.
- **Blocked by**: none
- **Blocks**: WISE-001, WISE-002, WISE-004
- **Acceptance criteria**:
  - Token availability per person recorded (yes, no, or needs a business profile).
  - The real payload is stored as an anonymised fixture; signature verified against the Wise public key.
  - Answer recorded: does the subscription survive revoking the Full token?
  - The activities response for the same payment is stored as a fixture, along with the fields used for matching.
- **Source**: plan-banking.md

#### SPK-003: Collect PKO notification email samples

- **Area**: Spike
- **Phase**: M0
- **Effort**: XS (~0.5d)
- **Status**: Planned
- **Needs the owner or partner**: yes
- **Description**: Each person enables email notifications in iPKO with the minimum transfer threshold. Collect at least 2 samples of each type: card PLN, card FX, incoming transfer, outgoing transfer, BLIK payment, BLIK P2P, hold, ATM.
- **Blocked by**: none
- **Blocks**: PKOE-003
- **Acceptance criteria**:
  - Samples saved as `.eml` and anonymised (names, account numbers, card digits replaced) under `packages/backend/test/fixtures/pko-email/`.
  - Recorded: minimum possible transfer threshold (is 0 possible?), sender address, DKIM `d=`, typical latency after the payment.
- **Source**: plan-banking.md

#### SPK-004: Cloudflare Email Routing + Gmail forwarding + DKIM survival

- **Area**: Spike
- **Phase**: M0
- **Effort**: XS (~0.5d)
- **Status**: Planned
- **Needs the owner or partner**: yes
- **Description**: Set up the domain on Cloudflare, an Email Routing rule to a minimal Worker that logs headers, and a Gmail filter that forwards PKO emails. Verify the forwarding-confirmation relay, the `Authentication-Results` content, and what happens when the Worker throws (does the sender retry?).
- **Blocked by**: HOST-003
- **Blocks**: PKOE-001
- **Acceptance criteria**:
  - A forwarded PKO email reaches the Worker with a verifiable `dkim=pass header.d=pkobp.pl` (or the documented alternative check).
  - Retry behaviour on a Worker exception documented.
- **Source**: plan-banking.md

### P2 — Working web journeys

Auth and 2FA, a two-person household, plans, FX, a correct dashboard, honest tests.

**Exit criteria**: Both people are in one household; plans can be created and edited; the dashboard is correct in PLN and EUR; every journey has an e2e test.

#### CLN-004: Auth and 2FA hardening

- **Area**: Security
- **Phase**: P2
- **Effort**: L (~5d)
- **Status**: Planned
- **Description**: Remove the TOTP enrolment deadlock: first enrolment needs no step-up (C7, absorbs UI-005); add the 2FA step to web login (UI-004); the enrol screen must not rotate the secret on mount; encrypt the TOTP secret with the `Encryption` port (H5); apply one login policy so magic-link and Google login also require TOTP (H6); TOTP replay protection and atomic refresh-token rotation and magic-link consume (M9); `@nestjs/throttler` with Redis keyed per IP and per email plus `trustProxy` (H4, SEC-006); decide SEC-001 envelope/DEK and SEC-002 (descope or build).
- **Blocked by**: CLN-002, CLN-003, CLN-014
- **Blocks**: CLN-006, BNK-005
- **Acceptance criteria**:
  - A new user can enrol TOTP and log in with it end to end (HTTP-level test).
  - The TOTP secret column holds ciphertext.
  - Replaying a used TOTP code and a used magic link both fail.
  - The 11th login attempt in a minute returns 429.
- **Source**: audit-code.md / audit-ui.md

#### CLN-005: Tenancy for real

- **Area**: Security
- **Phase**: P2
- **Effort**: L (~5d)
- **Status**: Planned
- **Description**: App DB role without owner rights, FORCE RLS, per-transaction `set_config`, fix the `transaction_mappings` policy (no `household_id` column), put RLS into the drizzle journal, worker role with BYPASSRLS (C6); scope every repository write and id lookup (H10, L4); fix the `no-repo-without-scope` rule for member calls (H9); inject the redacting audit logger everywhere and REVOKE UPDATE/DELETE on `audit_log` (H8, M17).
- **Blocked by**: CLN-003, CLN-018
- **Blocks**: BNK-003, SYNC-001
- **Acceptance criteria**:
  - A DB-level test as the app role proves household A cannot read or write household B rows.
  - The lint rule fires on a `this.repo.x()` fixture.
  - `audit_log` rows are redacted by key and cannot be updated by the app role.
- **Source**: audit-code.md / audit-ui.md

#### CLN-009: Notifications and jobs

- **Area**: Backend
- **Phase**: P2
- **Effort**: M (~2.5d)
- **Status**: Planned
- **Description**: Dispatch claims the specific notification atomically (C11); retry with backoff and an idempotency key so a crash after send does not double-send (H21); `RESEND_API_KEY` in the environment plus a boot check, `.mjml` assets copied to `dist` (H20); magic-link template and scrub the raw token after send (M10); period close injects `uuidv7`, rethrows so BullMQ retries, sets `period_end` from the plan and counts expense lines only (C10, M14); escape template values (L5); wire or delete the outbox relay.
- **Blocked by**: CLN-010
- **Blocks**: CLN-006, BNK-007
- **Acceptance criteria**:
  - A magic-link email is sent for real in an integration test with a fake provider.
  - Two pending notifications are both sent.
  - Period close writes a leftover snapshot with the plan's `period_end`.
- **Source**: audit-code.md / audit-ui.md

#### CLN-006: Household invite journey

- **Area**: Backend
- **Phase**: P2
- **Effort**: M (~2d)
- **Status**: Planned
- **Needs the owner or partner**: yes
- **Description**: Register, invite email through the outbox, accept, shared household. The invite URL is returned and emailed (H7); accept is allowed when the invitee's own household is empty.
- **Blocked by**: CLN-004, CLN-009
- **Blocks**: none
- **Acceptance criteria**:
  - Two users form one household through the UI and API, covered by an e2e test.
  - The partner can complete the path alone (user acceptance).
- **Source**: audit-code.md / audit-ui.md

#### CLN-011: Missing API surface

- **Area**: Backend
- **Phase**: P2
- **Effort**: L (~5d)
- **Status**: Planned
- **Description**: Backend endpoints that web and mobile already call: plans CRUD, items, history, clone and archive; categories CRUD and aggregate; `PATCH /users/me` and preferences; export status. Typed `@ApiResponse` DTOs (91 of 92 currently have no `type`); controllers go through use cases (M21); scope `listActive` and `archive` by owner (M13); map rows through branded constructors (L7). Absorbs the plans and categories part of UI-006.
- **Blocked by**: CLN-002
- **Blocks**: UI-007, CLN-012
- **Acceptance criteria**:
  - Every path in the web client's API layer exists (contract test).
  - api-types are regenerated and drift-checked in CI.
  - A partner cannot see another member's personal plans.
- **Source**: audit-code.md / audit-ui.md

#### UI-007: Align client DTOs with the backend

- **Area**: Web
- **Phase**: P2
- **Effort**: M (~3d)
- **Status**: Planned
- **Description**: Web, mobile and shared-app use the generated api-types instead of hand-written DTOs (WEB-004); one `Plan` type; dashboard and transaction shapes match the backend (nested `amount`, `{incomeLines, expenseLines, ...}`).
- **Blocked by**: CLN-011
- **Blocks**: UI-013, UI-014, UI-016
- **Acceptance criteria**:
  - No hand-written DTO duplicates a generated type.
  - The transactions list shows real amounts, not `undefined NaN`.
- **Source**: audit-code.md / audit-ui.md

#### CLN-013: FX module for real

- **Area**: Backend
- **Phase**: P2
- **Effort**: L (~3.5d)
- **Status**: Planned
- **Description**: Repository, ECB daily cron, decimal-string rates, `convertMoney` with half-even rounding, inverse lookup and tests (M1), request the historical date and key idempotency by the returned date, add an NBU source for UAH (M18), `GET /fx-rates`, register the module in the worker (H23).
- **Blocked by**: CLN-010
- **Blocks**: CLN-012
- **Acceptance criteria**:
  - The worker consumes `ecb-fx` and a rate row appears for today.
  - `convertMoney` EUR to PLN to UAH has spec coverage, no float rates.
  - `GET /fx-rates` returns rates for the supported currencies.
- **Source**: audit-code.md / audit-ui.md

#### CLN-012: Dashboard correctness

- **Area**: Backend
- **Phase**: P2
- **Effort**: L (~5d)
- **Status**: Planned
- **Description**: One `computePlanActuals` from core with an FX table replaces `DrizzlePlanActualsReader` (H17); drop the materialised view or refresh it on mapping change (H22); privacy per owner, not per category (H18); unplanned list respects privacy and clamps `limit` (H19); signed sums so refunds reduce spend and period filters apply (M2). Absorbs UI-008.
- **Blocked by**: CLN-011, CLN-013
- **Blocks**: UI-013
- **Acceptance criteria**:
  - Dashboard totals are correct in PLN and EUR on a mixed-currency fixture (DB-level test).
  - The partner's private transactions never appear in the other member's view.
  - A refund lowers the category total.
- **Source**: audit-code.md / audit-ui.md

#### UI-013: Real Plan dashboard and Household screens

- **Area**: Web
- **Phase**: P2
- **Effort**: M (~2.5d)
- **Status**: Planned
- **Description**: Replace the two stub screens with the designed ones; show amounts in normal units in the plan editor, not minor units.
- **Blocked by**: UI-007, CLN-012
- **Blocks**: none
- **Acceptance criteria**:
  - Both screens render real data from the backend in Playwright.
  - The editor shows 12.50, not 1250.
- **Source**: audit-code.md / audit-ui.md

#### UI-014: Separate Map and Detail modals

- **Area**: Web
- **Phase**: P2
- **Effort**: XS (~0.5d)
- **Status**: Planned
- **Description**: Transaction detail and mapping are different modals; show the transaction status and the mapped item.
- **Blocked by**: UI-007
- **Blocks**: none
- **Acceptance criteria**:
  - Opening a row shows detail; 'Map' opens the mapping modal.
  - Status and mapped item are visible in the list and detail.
- **Source**: audit-code.md / audit-ui.md

#### CLN-008r: Transactions cursor and search escaping (remainder of CLN-008)

- **Area**: Backend
- **Phase**: P2
- **Effort**: XS (~0.5d)
- **Status**: Planned
- **Description**: Keyset pagination on `(occurredOn, id)` (H16) and escaped `ilike` patterns (L4). The rest of CLN-008 moved to BNK and SYNC tasks.
- **Blocked by**: CLN-003
- **Blocks**: none
- **Acceptance criteria**:
  - Paging through 250 rows returns each row once, in order.
  - A search for `%` matches only a literal percent sign.
- **Source**: audit-code.md / audit-ui.md

#### CLN-017: Test-suite truth

- **Area**: Tests
- **Phase**: P2
- **Effort**: L (~3.5d)
- **Status**: Planned
- **Description**: Delete fake tests (`app.spec`, tautological headers spec, 1x1 visual baselines, mock-only tenancy spec); Playwright against a real backend in CI with a two-user fixture; a web-backend contract test; make the k6 gate real or remove `perf.yml`.
- **Blocked by**: CLN-003, CLN-014
- **Blocks**: none
- **Acceptance criteria**:
  - No test asserts `expect(true).toBe(true)` or a literal object.
  - Playwright runs in CI against docker services and does not skip.
  - The contract test would have failed on C9, C13, C15 and H25.
- **Source**: audit-code.md / audit-ui.md

### M1 — Both banks to dashboard

First real milestone: Enable Banking, sync, freshness. About 30 days of critical path.

**Exit criteria**: PKO BP and Wise connected for both people; at least 90 days of history; 3 sync slots a day plus refresh on open; booked and pending on the dashboard with freshness chips; zero duplicates over 7 days.

#### BNK-002: BankConnector v2 port + core types

- **Area**: Banks
- **Phase**: M1
- **Effort**: M (~2d)
- **Status**: Planned
- **Description**: The §1.10 port changes:
  - `PsuContext`, rich `RawTransaction`, `fetchBalances`, `getConsentStatus`, the typed error classes;
  - `BankProvider = 'enable_banking'` in core;
  - `InMemoryBankConnector` updated to emit booked, pending and cancelled scenarios for tests.
- **Blocked by**: none
- **Blocks**: BNK-004, SYNC-003, SYNC-006
- **Acceptance criteria**:
  - Typecheck green across core, backend, web and mobile; exhaustive switches on `BankTxStatus`.
  - The in-memory connector supports a scripted sequence (pending on day 1, booked with a changed amount on day 3).
- **Source**: plan-banking.md

#### BNK-003: Bank schema migration `0006_bank_v2`

- **Area**: Banks
- **Phase**: M1
- **Effort**: S (~1d)
- **Status**: Planned
- **Description**: The §1.10 columns and tables for connections, accounts, the ledger and sync_runs, plus the Drizzle schema and repositories. Register the migration in the drizzle journal (a past bug, fixed in #148).
- **Blocked by**: CLN-005, CLN-018
- **Blocks**: BNK-004, SYNC-002, BNK-007
- **Acceptance criteria**:
  - The migration runs forward on a copy of the staging DB.
  - The household RLS policy covers the new tables.
  - Repository tests cover the `identification_hash` uniqueness.
- **Source**: plan-banking.md

#### SYNC-001: Transactions schema v2 migration `0007` + repository

- **Area**: Sync
- **Phase**: M1
- **Effort**: M (~2d)
- **Status**: Planned
- **Description**: The §1.10 `transactions` columns and `live_signals` table. `DrizzleTransactionRepository` reads and writes `status`, the suggestion fields and the booked fields. Fix `patch()` dropping `suggestedPlannedItemId`. Add `upgradeInPlace()` and `listProvisional(account, window)`.
- **Blocked by**: CLN-005
- **Blocks**: SYNC-006, SYNC-008, AI-003, AI-004
- **Acceptance criteria**:
  - Existing rows backfilled `status = 'booked'` (bank) or `'manual'`.
  - The tenancy test passes for the new methods.
  - The dashboard/plan-actuals view excludes `cancelled` and `expired` (SQL test).
- **Source**: plan-banking.md

#### BNK-001: Enable Banking API client

- **Area**: Banks
- **Phase**: M1
- **Effort**: M (~2d)
- **Status**: Planned
- **Description**: `EnableBankingClient` in `infrastructure/bank/enable-banking/`:
  - an RS256 JWT signer (`node:crypto`; `kid`, `iss`, `aud`, `iat`, `exp` ≤ 1 h, cached);
  - typed DTOs for `/aspsps`, `/auth`, `/sessions`, `/sessions/{id}`, accounts details/balances/transactions;
  - a `continuation_key` pagination loop;
  - PSU header injection (all-or-none per `required_psu_headers`);
  - mapping of EB `error` codes to domain errors (§1.9).
- **Blocked by**: SPK-001
- **Blocks**: BNK-004
- **Acceptance criteria**:
  - Unit tests against recorded fixtures (from SPK-001, anonymised) for every endpoint and every error code in §1.9.
  - The JWT validates against the EB sandbox app 👤 (sandbox credentials).
  - No secret appears in logs (redaction test).
- **Source**: plan-banking.md

#### BNK-004: `EnableBankingBankConnector`

- **Area**: Banks
- **Phase**: M1
- **Effort**: L (~4d)
- **Status**: Planned
- **Description**: Implements BankConnector v2:
  - catalogue from `/aspsps` (PKO BP + Wise allow-list);
  - `initiateConsent` → `/auth` with `valid_until = now + maximum_consent_validity` (UTC) and `state` = a signed nonce bound to the connection id;
  - `completeConsent` → `/sessions` → encrypted session id + accounts;
  - account mapping by `identification_hash`;
  - transaction mapping: BOOK → booked, PDNG/HOLD → pending, CNCL/RJCT → cancelled, SCHD → ignored, OTHR → other; sign from `credit_debit_indicator`; amounts as decimal strings converted to bigint minor units, with no floats; `exchange_rate.instructed_amount` → `originalAmount`;
  - `disconnect` → `DELETE /sessions/{id}`.
- **Blocked by**: BNK-001, BNK-002, BNK-003
- **Blocks**: BNK-005, SYNC-003, BNK-008, WISE-005, WISE-002, BNK-007
- **Acceptance criteria**:
  - Contract tests on SPK-001 fixtures for PKO and Wise.
  - Money parsing is property-tested (no float path; a currency exponent from the `currencies` table).
  - A sandbox (EB mock ASPSP) connect → complete → fetch loop passes in CI with secrets present; it is skipped otherwise.
- **Source**: plan-banking.md

#### BNK-005: Consent redirect flow (web + mobile)

- **Area**: Banks
- **Phase**: M1
- **Effort**: M (~2d)
- **Status**: Planned
- **Needs the owner or partner**: yes
- **Description**: The bank redirect lands on the SPA route `/bank/callback?code=&state=`. The existing `BankConsentCallbackScreen` calls `POST /bank-connections/complete {code, state}` with the session JWT. The current `GET :id/complete` is replaced; the server validates the state nonce and the caller's ownership. Mobile opens consent in the system browser (`expo-web-browser` auth session); the https callback page hands off to `powerbudget://bank/callback`. The initial import (BNK-006) is triggered with the PSU context of this request.
- **Blocked by**: BNK-004, HOST-003, CLN-004
- **Blocks**: BNK-006
- **Acceptance criteria**:
  - Real PKO and Wise consent completes from web and from mobile 👤.
  - Replay or forged-`state` tests return 400.
  - OpenAPI regenerated; web and mobile API types updated.
- **Source**: plan-banking.md

#### SYNC-002: Fetch budget ledger + `SyncBudgetPolicy`

- **Area**: Sync
- **Phase**: M1
- **Effort**: M (~2d)
- **Status**: Planned
- **Description**: The §1.8 ledger repository and the pure policy (day boundary Europe/Warsaw, 3 unattended units plus 1 reserve, 6 h cooldown on 429, the skip-if-recent rule).
- **Blocked by**: BNK-003, SPK-001
- **Blocks**: SYNC-003
- **Acceptance criteria**:
  - Table-driven tests for the DST days, a 429 at 23:50, attended vs unattended, and the reserve.
  - Units used today exposed in `GET /bank-connections/:id/sync-runs`.
- **Source**: plan-banking.md

#### SYNC-003: SyncOrchestrator + processor v2 (triggers, locking)

- **Area**: Sync
- **Phase**: M1
- **Effort**: L (~3.5d)
- **Status**: Planned
- **Description**:
  - Replace `@Cron('0 */4 * * *')` with the slot schedule (06:30, 13:00, 19:30 Europe/Warsaw).
  - Job types for every trigger in §1.3; `jobId = sync:{connectionId}` (dedupe); per-account fetch → ingest v2 in a single DB transaction; freshness columns; the `sync_runs` extension.
  - PSU context only in the job payload, with a 2-minute TTL.
  - The retry policy from §1.9.
- **Blocked by**: BNK-002, BNK-004, SYNC-002, HOST-002, CLN-010
- **Blocks**: BNK-006, SYNC-004, SYNC-007, SYNC-009
- **Acceptance criteria**:
  - An integration test with the in-memory connector runs 3 scheduled slots and 5 attended refreshes in one day and records exactly 3 unattended units.
  - Two concurrent triggers for the same connection lead to one fetch.
  - An LLM or classifier failure does not fail the sync job.
- **Source**: plan-banking.md

#### SYNC-006: Ingest v2 use case

- **Area**: Sync
- **Phase**: M1
- **Effort**: M (~3d)
- **Status**: Planned
- **Description**: `IngestBankTransactions` v2 (replaces the early return on `created === false`):
  - load provisional rows for the window, run the Reconciler, apply the plan in one DB transaction;
  - write audit `tx.ingested` / `tx.upgraded` / `tx.cancelled`;
  - schedule the plan-actuals refresh;
  - enqueue a categorisation job for new or upgraded rows;
  - a "pending payment disappeared" question when a cancelled row was mapped.
- **Blocked by**: SYNC-001, BNK-002
- **Blocks**: BNK-006, SYNC-008, AI-002, AI-006
- **Acceptance criteria**:
  - A re-run with identical input writes nothing (row count and `updated_at` unchanged).
  - The user mapping survives a pending→booked upgrade (test).
- **Source**: plan-banking.md

#### BNK-006: Initial history import + gap fill

- **Area**: Banks
- **Phase**: M1
- **Effort**: S (~1d)
- **Status**: Planned
- **Description**: The `initial` and `reconsent` triggers in SyncOrchestrator:
  - `initial`: `strategy=longest`, attended, as one job per account;
  - `reconsent`: `date_from = lastBooked − 10 d`.
  - Progress shown on the connections screen.
- **Blocked by**: BNK-005, SYNC-003, SYNC-006
- **Blocks**: none
- **Acceptance criteria**:
  - After connecting, history covering at least 90 days appears.
  - A re-run produces no duplicates (idempotency test on real fixtures).
- **Source**: plan-banking.md

#### SYNC-004: Attended refresh endpoint + client wiring

- **Area**: Sync
- **Phase**: M1
- **Effort**: M (~2d)
- **Status**: Planned
- **Description**:
  - `POST /sync/attended` and `POST /bank-connections/:id/refresh` (attended).
  - Fastify `trustProxy` set to Caddy only; PSU headers built from the real client IP and UA.
  - Owner-only scope; debounce 10 min; manual refresh limited to 1/min.
  - Web: call on app load and on `visibilitychange`. Mobile: call on `AppState` → active, plus pull-to-refresh.
- **Blocked by**: SYNC-003
- **Blocks**: none
- **Acceptance criteria**:
  - A request from the partner's session never refreshes the user's connections (test).
  - IP spoofing via `X-Forwarded-For` from outside the proxy is ignored (test).
  - Ledger rows are marked `attended = true`.
- **Source**: plan-banking.md

#### SYNC-007: Freshness read model + UI

- **Area**: Sync
- **Phase**: M1
- **Effort**: M (~2d)
- **Status**: Planned
- **Description**: `GET /bank-connections` and the dashboard payload gain per-account freshness (§1.4) and a household "data as of" value. Web and mobile get a `SyncStatusChip`, partner wording, and the cooldown and reauth states, with copy in en/uk/ru/pl.
- **Blocked by**: SYNC-003
- **Blocks**: none
- **Acceptance criteria**:
  - The chip renders every state in Storybook/visual tests.
  - The partner view never shows the account name or balance (privacy test).
- **Source**: plan-banking.md

#### BNK-008: Remove GoCardless

- **Area**: Banks
- **Phase**: M1
- **Effort**: S (~1d)
- **Status**: Planned
- **Description**: Delete `GoCardlessBankConnector` and its spec, the env keys (`GOCARDLESS_*` in `render.yaml`, `.env.example`), the registry wiring, the `gocardless` enum value, and the doc references (ARCHITECTURE §5.2/§9, CLAUDE/AGENTS/copilot instructions, BACKLOG BE-018 note). Migrate any `bank_connections.provider = 'gocardless'` rows to `disconnected`.
- **Blocked by**: BNK-004
- **Blocks**: none
- **Acceptance criteria**:
  - `rtk grep -ri gocardless` finds only the changelog/ADR history.
  - CI is green; the OpenAPI catalogue no longer lists GoCardless.
- **Source**: plan-banking.md

#### WISE-005: Retire legacy `WiseBankConnector`

- **Area**: Banks
- **Phase**: M1
- **Effort**: XS (~0.5d)
- **Status**: Planned
- **Description**: Delete the statement-based connector and its spec, and the `wise_personal` provider. Existing `wise_personal` connections are marked `disconnected`, with a notice to reconnect through EB.
- **Blocked by**: BNK-004
- **Blocks**: none
- **Acceptance criteria**:
  - No `/v3/.../statement.json` or `/v2/borderless-accounts` usage left; CI green.
- **Source**: plan-banking.md

### M2 — Live signals

Wise webhook and PKO emails give a provisional row within a minute; the Reconciler merges it with booked.

**Exit criteria**: A Wise payment shows within 1 minute and a PKO payment within 2 as Live; both become booked with no duplicates.

#### SYNC-005: Reconciler (pure, `@power-budget/core`)

- **Area**: Sync
- **Phase**: M2
- **Effort**: L (~3.5d)
- **Status**: Planned
- **Description**: The §1.7 algorithm: scoring, FX tolerance, one-to-one greedy assignment, pending snapshot replacement, expiry. It returns a plan of upgrades, inserts, cancels and expiries; it does no I/O and takes the clock as an argument.
- **Blocked by**: SPK-001
- **Blocks**: none
- **Acceptance criteria**:
  - Property tests (fast-check): idempotent, order-independent, conserves the count of real payments.
  - Fixture tests: a PKO FX card hold of €12.00 shown as 51,96 PLN pending and booked as 52,31 PLN; two identical coffees; a pending row withdrawn; a Wise webhook followed by EB pending then booked.
  - 100% branch coverage on the matching rules.
- **Source**: plan-banking.md

#### SYNC-008: Live signal inbox + processor

- **Area**: Live channels
- **Phase**: M2
- **Effort**: M (~2d)
- **Status**: Planned
- **Description**: The `LiveSignalSource` port; a `live_signals` repository with encrypted payloads (`Encryption` port); a worker that parses, attributes to an account (`wise_balance_id`, `card_hints`), creates a `live` transaction (`occurred_on` = local date of `occurredAt`), and triggers categorisation. Dedupe by `dedupe_key`.
- **Blocked by**: SYNC-001, SYNC-006
- **Blocks**: WISE-001, PKOE-002, SYNC-009, PKOE-006
- **Acceptance criteria**:
  - The same signal delivered 3 times creates one transaction.
  - An unattributed signal produces an owner question, not a silent drop.
- **Source**: plan-banking.md

#### WISE-001: Wise webhook receiver

- **Area**: Live channels
- **Phase**: M2
- **Effort**: M (~2d)
- **Status**: Planned
- **Description**: `POST /webhooks/wise/:secret`:
  - raw-body capture (Fastify content-type parser);
  - RSA-SHA256 verification of `X-Signature-SHA256` against the pinned Wise production public key;
  - `X-Test-Notification` handled;
  - `X-Delivery-Id` stored;
  - insert into `live_signals`, reply 200 within 1 s;
  - IP allow-list as defence in depth (`45.129.54.0/24`, `45.129.55.0/24`, plus the 3 listed hosts ✅ per research).
- **Blocked by**: SYNC-008, HOST-002, SPK-002
- **Blocks**: WISE-003, WISE-004
- **Acceptance criteria**:
  - The fixture from SPK-002 verifies; a tampered body returns 400.
  - p99 handler latency under 200 ms (load test of 50 requests).
  - Out-of-order deliveries are sorted by `occurred_at` and `step_id`.
- **Source**: plan-banking.md

#### WISE-002: Wise token connection + account linking

- **Area**: Live channels
- **Phase**: M2
- **Effort**: M (~1.5d)
- **Status**: Planned
- **Needs the owner or partner**: yes
- **Description**: A connect step "add Wise live updates": the user pastes a **read-only** token, stored encrypted per user. The backend resolves the personal profile id and balance ids and maps them to the EB Wise `bank_accounts` by currency (and IBAN when present) into `wise_balance_id`. Token revocation is detected (a 401 sets the state to revoked and notifies the owner). If the user has no token, Wise runs EB-only with no live channel.
- **Blocked by**: BNK-004, SPK-002
- **Blocks**: WISE-003
- **Acceptance criteria**:
  - Each Wise currency balance maps to exactly one `bank_account`, or the user gets a question.
  - The token is never returned by any API (test).
- **Source**: plan-banking.md

#### WISE-003: Activities enricher

- **Area**: Live channels
- **Phase**: M2
- **Effort**: M (~2d)
- **Status**: Planned
- **Description**: For each `balances#update` signal, fetch activities in `occurred_at ± 5 min` and match by amount, currency and direction. Parse the formatted amount strings and strip the HTML from `title` to get the merchant and title. Update the live row and re-trigger categorisation. Handle the 429 `Retry-After` header.
- **Blocked by**: WISE-001, WISE-002
- **Blocks**: none
- **Acceptance criteria**:
  - The SPK-002 fixtures give the correct merchant.
  - No match means the live row is kept without a merchant and is not retried more than 3 times.
- **Source**: plan-banking.md

#### WISE-004: Subscription bootstrap CLI + runbook

- **Area**: Live channels
- **Phase**: M2
- **Effort**: S (~0.75d)
- **Status**: Planned
- **Needs the owner or partner**: yes
- **Description**: `pnpm -F @power-budget/backend wise:subscribe`, run locally. It takes a temporary Full token from stdin and creates or lists/deletes the `balances#update` subscription per profile with the delivery URL. The Full token is never stored. A runbook covers rotating the secret path and re-subscribing.
- **Blocked by**: SPK-002, WISE-001
- **Blocks**: none
- **Acceptance criteria**:
  - Running it twice is idempotent (no duplicate subscriptions).
  - The runbook is tested by the user on both profiles 👤.
- **Source**: plan-banking.md

#### PKOE-001: Cloudflare Email Worker `pko-mail`

- **Area**: Live channels
- **Phase**: M2
- **Effort**: M (~2d)
- **Status**: Planned
- **Needs the owner or partner**: yes
- **Description**: A new workspace package `packages/edge-mail`, deployed with wrangler, holding the alias-token → user map (secret). It:
  - checks the DKIM/ARC result and drops anything that isn't from PKO;
  - relays Gmail forwarding-verification emails to the owner's address;
  - POSTs base64 MIME with an HMAC-SHA256 to `/ingest/email`;
  - throws on a non-2xx reply (sender retry);
  - BCCs an archive mailbox.
- **Blocked by**: SPK-004, HOST-003
- **Blocks**: PKOE-005
- **Acceptance criteria**:
  - Unit tests with fixture MIME for the accept, reject and relay paths.
  - An end-to-end forwarded real email arrives at the backend 👤.
  - The worker logs contain no amounts or names.
- **Source**: plan-banking.md

#### PKOE-002: Email ingest endpoint

- **Area**: Live channels
- **Phase**: M2
- **Effort**: S (~1d)
- **Status**: Planned
- **Description**: `POST /ingest/email`: verify the HMAC and timestamp (±5 min), dedupe on Message-ID, store the encrypted raw email in `live_signals (source = pko_email)`, enqueue the parse. Raw emails are purged after 30 days.
- **Blocked by**: SYNC-008, HOST-002
- **Blocks**: PKOE-003, PKOE-007
- **Acceptance criteria**:
  - A bad HMAC or stale timestamp returns 401.
  - A duplicate Message-ID returns 200 with no new row.
- **Source**: plan-banking.md

#### PKOE-003: `PkoEmailParser`

- **Area**: Live channels
- **Phase**: M2
- **Effort**: M (~3d)
- **Status**: Planned
- **Description**: Versioned templates from the SPK-003 samples: card PLN, card FX, transfer in, transfer out, BLIK, hold, ATM. Polish number and date parsing, charset handling. Output is a `ParsedSignal` with `cardLast4` / `maskedAccount`. Unknown layouts become `unparsed` plus an alert.
- **Blocked by**: SPK-003, PKOE-002
- **Blocks**: PKOE-004
- **Acceptance criteria**:
  - 100% of the collected samples parse to the expected values (golden tests).
  - A mutated template gives `unparsed`, not a wrong amount (negative tests).
  - Parse failures carry the parser version for replay after a fix.
- **Source**: plan-banking.md

#### PKOE-004: Card and account hints

- **Area**: Live channels
- **Phase**: M2
- **Effort**: S (~1d)
- **Status**: Planned
- **Description**: `card_hints` on `bank_accounts`. The first sighting of an unknown card or masked account raises an owner question, and the answer is stored. The live signal is then attributed and the transaction created.
- **Blocked by**: PKOE-003
- **Blocks**: none
- **Acceptance criteria**:
  - After one answer, later emails for that card attribute automatically.
  - Wrong-account correction re-homes the live row.
- **Source**: plan-banking.md

#### PKOE-005: Gmail filter + forwarding runbook (both users)

- **Area**: Live channels
- **Phase**: M2
- **Effort**: XS (~0.5d)
- **Status**: Planned
- **Needs the owner or partner**: yes
- **Description**: A step-by-step runbook (screenshots) for the iPKO notification settings, the Gmail filter, forwarding verification and alias tokens. Both people set it up.
- **Blocked by**: PKOE-001
- **Blocks**: none
- **Acceptance criteria**:
  - Both mailboxes forward; a test card payment shows as a "Live" row within 2 min 👤.
- **Source**: plan-banking.md

### M3 — AI categorisation

Rules first (transfers, planned items, merchant memory), Claude for the rest.

**Exit criteria**: At least 70% of transactions mapped automatically or in one tap; auto-map precision at least 97% on the eval set; inbox answers train the rules.

#### SPK-005: Offline categorisation feasibility on own history

- **Area**: Spike
- **Phase**: M3
- **Effort**: S (~1d)
- **Status**: Planned
- **Needs the owner or partner**: yes
- **Description**: Export 3–6 months of PKO/Wise history as CSV, label 150 rows with the target planned item or category, and run the rules plus a Haiku and Sonnet prompt prototype in a notebook or script.
- **Blocked by**: none
- **Blocks**: AI-005
- **Acceptance criteria**:
  - Measured: rules-only coverage %, LLM accuracy at the 0.9 and 0.6 thresholds, cost per 100 transactions, and the share of hard cases (Allegro, PayU, BLIK).
- **Source**: plan-banking.md

#### AI-001: Transaction normalisation (core, pure)

- **Area**: AI
- **Phase**: M3
- **Effort**: M (~2d)
- **Status**: Planned
- **Description**: `normaliseTransaction()`:
  - merchant extraction from EB remittance strings, PKO email titles and Wise activity titles;
  - descriptor classes: `payu`, `przelewy24`, `allegro`, `blik_p2p`, `blik_merchant`, `atm`, `card`, `transfer`, `fee`;
  - city and terminal stripping;
  - Polish diacritics folding.
  Replaces the local `normalise()` in `apply-mapping-suggestion.ts`, which today drops Polish letters (`[^a-z0-9Ѐ-ӿ]` removes ą, ę, ł, ż and the others).
- **Blocked by**: none
- **Blocks**: AI-002, AI-003, AI-005
- **Acceptance criteria**:
  - Golden tests on at least 100 anonymised real descriptors (from SPK-001/003).
  - "Żabka" and "ZABKA Z1234 K.1" normalise to the same merchant key.
- **Source**: plan-banking.md

#### AI-002: Internal transfer detection

- **Area**: AI
- **Phase**: M3
- **Effort**: M (~3d)
- **Status**: Planned
- **Description**:
  - Counterparty IBAN in any household account (both partners): mark as a transfer.
  - An opposite-sign same-amount pair across household accounts within ±3 days (FX pairs PKO PLN → Wise EUR via an `exchange_rate` or FX table tolerance of 2%): auto `MarkAsTransfer` with the counterpart, if confidence ≥ 0.95, else suggest.
  - Wise top-up descriptors.
  - Partner transfers flagged `partner_transfer` for the product rule.
- **Blocked by**: AI-001, SYNC-006
- **Blocks**: AI-006
- **Acceptance criteria**:
  - Fixture tests for PKO→own Wise, PKO→partner PKO, BLIK P2P to the partner, and a salary that is not a transfer.
  - Auto-marked transfers are reversible and audited.
- **Source**: plan-banking.md

#### AI-003: Merchant memory rules (learn from corrections)

- **Area**: AI
- **Phase**: M3
- **Effort**: M (~2.5d)
- **Status**: Planned
- **Description**: `merchant_rules`. A user `MapTransaction` or a question answer upserts a rule (merchant key, or counterparty IBAN hash → category + plan-kind preference; or `always_ask`). On ingest, resolve the category to the active planned item for the transaction date and owner. Replaces `STUB_SUGGESTION` and the empty `fetchRecentMappings()`.
- **Blocked by**: AI-001, SYNC-001
- **Blocks**: AI-006
- **Acceptance criteria**:
  - After mapping "Biedronka" once in October, a November Biedronka transaction is suggested into November's Groceries planned item (test spans a plan rollover).
  - Conflicting corrections: the most recent wins and the hit counts update.
- **Source**: plan-banking.md

#### AI-004: Planned-item match hints

- **Area**: AI
- **Phase**: M3
- **Effort**: M (~3d)
- **Status**: Planned
- **Description**: `planned_items.match_hint` (counterparty pattern, expected amount ± tolerance, day-of-month window). Editable in the planned item form on web and mobile. A matcher scores candidates, so rent, salary and subscriptions auto-map with confidence ≥ 0.95 when unique.
- **Blocked by**: SYNC-001
- **Blocks**: AI-006
- **Acceptance criteria**:
  - Hints round-trip through the API; copy in 4 locales.
  - Two planned items both matching gives a suggestion, never an auto-map.
- **Source**: plan-banking.md

#### AI-005: `ClaudeTransactionClassifier` adapter

- **Area**: AI
- **Phase**: M3
- **Effort**: L (~3.5d)
- **Status**: Planned
- **Needs the owner or partner**: yes
- **Description**:
  - `@anthropic-ai/sdk`, `claude-haiku-5-5` at low effort, one escalation to `claude-sonnet-5-5`.
  - Structured output schema (§1.13), a frozen system prompt + household catalogue as the cached prefix, the per-transaction block last.
  - The pseudonymisation and minimisation layer (pure, unit-tested).
  - `classification_runs` cost logging; the monthly USD cap; a kill switch env var; timeouts; typed error handling (429/5xx retry; 400 not retried).
  - Prompt version constant.
- **Blocked by**: AI-001, SPK-005
- **Blocks**: AI-006, AI-007
- **Acceptance criteria**:
  - A snapshot test of the exact outbound payload proves no IBAN, card number, real name or balance is sent.
  - Cache reads are above 0 on the second call (logged `cache_read_input_tokens`).
  - With the cap reached, the pipeline degrades to rules-only (test).
- **Source**: plan-banking.md

#### AI-006: Categorisation pipeline + confidence policy

- **Area**: AI
- **Phase**: M3
- **Effort**: M (~2d)
- **Status**: Planned
- **Description**: The orchestration in §1.13: stage order, thresholds 0.90 / 0.60 (configurable per household), auto-map with an `auto_mapped` flag and undo, suggestions persisted, questions created. Re-run on upgrade only under the rules in §1.13. Never overwrite a user mapping. A BullMQ `categorise` queue.
- **Blocked by**: AI-002, AI-003, AI-004, AI-005, SYNC-006
- **Blocks**: AI-008
- **Acceptance criteria**:
  - An end-to-end test: a live PKO email becomes a provisional row, which is classified and auto-mapped; booked arrives, the row is upgraded, and the mapping is unchanged.
  - Each stage's outcome is recorded (`suggestion_source`).
- **Source**: plan-banking.md

#### AI-007: Eval harness + threshold calibration

- **Area**: AI
- **Phase**: M3
- **Effort**: M (~2d)
- **Status**: Planned
- **Needs the owner or partner**: yes
- **Description**: An offline eval over the labelled set from SPK-005, extended with real app data later. Reports accuracy and coverage per stage, calibration of the thresholds, and Haiku vs Sonnet vs rules-only. Runs on demand (it costs money, so it doesn't run in CI).
- **Blocked by**: AI-005
- **Blocks**: none
- **Acceptance criteria**:
  - The report shows the auto-map precision at the chosen threshold ≥ 97% on the labelled set.
  - Model choice and thresholds recorded in ADR-004 (with the Anthropic data-handling check).
- **Source**: plan-banking.md

#### AI-008: Review inbox + questions UX

- **Area**: AI
- **Phase**: M3
- **Effort**: L (~4d)
- **Status**: Planned
- **Description**:
  - Web and mobile "To review" inbox: questions and suggestions, one-tap options, "remember for next time", bulk confirm.
  - Badge count.
  - A daily email digest through the outbox (`categorise_question`).
  - Answers call MapTransaction / MarkAsTransfer and AI-003 learning.
- **Blocked by**: AI-006
- **Blocks**: AI-009
- **Acceptance criteria**:
  - Answering a question maps the transaction and creates or updates a rule.
  - Strings in 4 locales.
  - The partner never sees questions about the other person's private accounts (privacy test).
- **Source**: plan-banking.md

### M4 — Hardening

Consent lifecycle, alerts, uptime, the GDPR decision.

**Exit criteria**: Must land before day 166 of the first consent (about 5.5 months after M1) so the first reminder fires.

#### BNK-007: Consent lifecycle + reminders + continuity

- **Area**: Banks
- **Phase**: M4
- **Effort**: M (~2.5d)
- **Status**: Planned
- **Description**: The §1.6 state machine:
  - `ConsentExpiryPolicy` with the 14 d stage;
  - a daily `GET /sessions/{id}` status check;
  - error-driven `reauth_required`;
  - outbox reminders to the owner only;
  - `ReconnectBank` creating a new session, re-linking accounts by `identification_hash`, deleting the old session and running the gap fill;
  - the web/mobile `ReconnectBanner` wired to the new states.
- **Blocked by**: BNK-004, BNK-003, CLN-009
- **Blocks**: none
- **Acceptance criteria**:
  - The state transitions are unit-tested.
  - A reminder email is rendered in 4 locales.
  - A reconnect test keeps `bank_accounts.id` and produces no duplicate booked rows.
- **Source**: plan-banking.md

#### SYNC-009: Sync observability + alerts

- **Area**: Sync
- **Phase**: M4
- **Effort**: M (~1.5d)
- **Status**: Planned
- **Description**: Metrics and alerts:
  - no booked sync for an active account in more than 12 h;
  - 429 on two consecutive days;
  - more than 3 unparsed signals a day;
  - live rows expiring;
  - EB 401.
  An admin page or endpoint lists them. Runbook `docs/mvp/runbooks/bank-sync.md`.
- **Blocked by**: SYNC-003, SYNC-008
- **Blocks**: none
- **Acceptance criteria**:
  - Each alert fires in a test with injected state.
  - The runbook covers re-consent, cooldown, a parser update and a webhook re-subscribe.
- **Source**: plan-banking.md

#### HOST-004: Uptime + ops alerting

- **Area**: Hosting
- **Phase**: M4
- **Effort**: S (~1d)
- **Status**: Planned
- **Description**: An external uptime check (a free monitor) on `/health` and on the webhook route. Sentry alerts for the conditions in SYNC-009.
- **Blocked by**: HOST-002
- **Blocks**: none
- **Acceptance criteria**:
  - Downtime longer than 5 min pages the user (email or Telegram).
  - Alert rules documented in `docs/mvp/runbooks/bank-sync.md`.
- **Source**: plan-banking.md

#### CLN-022: GDPR export and purge, or explicit descope

- **Area**: Backend
- **Phase**: M4
- **Effort**: M (~2d)
- **Status**: Planned
- **Needs the owner or partner**: yes
- **Description**: Either build the export and purge processors (BE-034, SEC-005, M11) or state in the privacy docs that a two-person private app does not offer them.
- **Blocked by**: CLN-010
- **Blocks**: none
- **Acceptance criteria**:
  - A decision is recorded; if built, a deleted household is purged after the grace period (integration test).
- **Source**: audit-code.md / audit-ui.md

### UI — UI polish

App shell per design-arctic, theme, responsive layout, translations, accessibility. Does not block the main chain.

**Exit criteria**: Sidebar and navigation as in the mockup; light and dark theme; phone layout without clipping; ru, uk, pl translated.

#### UI-009: App shell

- **Area**: Web
- **Phase**: UI
- **Effort**: L (~4d)
- **Status**: Planned
- **Description**: Sidebar, topbar, navigation, language switcher, global typography and background as in design-arctic. Today the web app has no shell and leaks browser defaults (serif, white background).
- **Blocked by**: CLN-014
- **Blocks**: UI-010, UI-011, UI-017
- **Acceptance criteria**:
  - Every authenticated screen renders inside the shell.
  - Matches the design-arctic mockup for Dashboard at desktop width (screenshot compare by eye).
- **Source**: audit-code.md / audit-ui.md

#### UI-010: Light and dark theme with a toggle

- **Area**: Web
- **Phase**: UI
- **Effort**: M (~1.5d)
- **Status**: Planned
- **Description**: Wire `lightTheme` from design tokens, add the toggle and persist it without a flash on load (DES-008).
- **Blocked by**: UI-009
- **Blocks**: none
- **Acceptance criteria**:
  - Toggle switches themes and survives reload with no FOUC.
  - `ThemeContext` no longer hard-codes dark.
- **Source**: audit-code.md / audit-ui.md

#### UI-011: Responsive pass

- **Area**: Web
- **Phase**: UI
- **Effort**: M (~2d)
- **Status**: Planned
- **Description**: Tables become cards on phones, filters collapse, the bulk bar fits.
- **Blocked by**: UI-009
- **Blocks**: none
- **Acceptance criteria**:
  - No horizontal clipping at 390 px width on Dashboard, Transactions, Plans.
- **Source**: audit-code.md / audit-ui.md

#### UI-012: i18n completion

- **Area**: Web
- **Phase**: UI
- **Effort**: M (~2d)
- **Status**: Planned
- **Description**: Add the 44 missing `en` keys (all `bankConnections.*`, `addBank.*`), translate uk, ru and pl (about 190 keys each, I18N-004), make `<html lang>` dynamic.
- **Blocked by**: none
- **Blocks**: none
- **Acceptance criteria**:
  - `uk`, `ru` and `pl` have every key used in code; no MissingTranslationError in the console.
  - `<html lang>` follows the selected locale.
- **Source**: audit-code.md / audit-ui.md

#### UI-017: Basic accessibility

- **Area**: Web
- **Phase**: UI
- **Effort**: M (~1.5d)
- **Status**: Planned
- **Description**: Run axe, fix contrast, add landmarks and focus handling.
- **Blocked by**: UI-009
- **Blocks**: none
- **Acceptance criteria**:
  - axe reports no critical or serious issue on the main screens.
- **Source**: audit-code.md / audit-ui.md

### MOB — Mobile

After M1: one Expo SDK upgrade, then device verification and the mobile parts of the bank flow.

**Exit criteria**: The app builds through EAS, logs in, shows the dashboard and connects a bank on a phone.

#### CLN-016: shared-app decision

- **Area**: Mobile
- **Phase**: MOB
- **Effort**: M (~2d)
- **Status**: Planned
- **Description**: `shared-app` is empty `export {}` scaffolding. Either move the web stores and API adapters into it for real, or delete it; align react and mobx peers (M22).
- **Blocked by**: CLN-014
- **Blocks**: CLN-015
- **Acceptance criteria**:
  - Decision recorded; no empty barrels remain; one react and one mobx-react-lite version in the workspace.
- **Source**: audit-code.md / audit-ui.md

#### CLN-015: Mobile revival

- **Area**: Mobile
- **Phase**: MOB
- **Effort**: L (~5d)
- **Status**: Planned
- **Description**: One Expo SDK upgrade with `npx expo install --fix` (React 19, react-navigation 7), Metro resolver and babel fixes (absorbs UI-015), SecureStore token cache hydrated at boot, auth-driven `RootNavigator` (C14), API URL from env, real EAS ids (H26). Recommended: freeze mobile until the web journeys work.
- **Blocked by**: CLN-014, CLN-016
- **Blocks**: UI-016, PKOE-006, AI-009
- **Acceptance criteria**:
  - `eas build` succeeds for iOS and Android.
  - The app logs in and reaches the dashboard against the real backend.
- **Source**: audit-code.md / audit-ui.md

#### UI-016: Mobile verification on device

- **Area**: Mobile
- **Phase**: MOB
- **Effort**: M (~2d)
- **Status**: Planned
- **Needs the owner or partner**: yes
- **Description**: Verify mobile screens on a device or simulator, e2e against the backend; also covers the mobile parts of BNK-005, SYNC-004, SYNC-007 and AI-008.
- **Blocked by**: CLN-015, UI-007
- **Blocks**: none
- **Acceptance criteria**:
  - Each mobile screen is verified on a device with a screenshot.
  - Bank connect, attended refresh, freshness chips and the review inbox work on the phone.
- **Source**: audit-code.md / audit-ui.md

### OPT — Options

IKO push (Android only), IMAP fallback, Expo push. Only if the spikes show a need.

**Exit criteria**: n/a

#### PKOE-006: IKO Android notification listener

- **Area**: Live channels
- **Phase**: OPT
- **Effort**: XL (~7d)
- **Status**: Planned
- **Needs the owner or partner**: yes
- **Description**: An Expo dev-build config plugin with a native `NotificationListenerService` that filters the IKO package and POSTs to `/ingest/push` with a device-bound HMAC. Includes a permission onboarding screen. Android only.
- **Blocked by**: SYNC-008, CLN-015
- **Blocks**: none
- **Acceptance criteria**:
  - A transfer of 1 PLN is captured within 10 s on the user's phone 👤.
  - Behaviour on Android 15 documented.
- **Source**: plan-banking.md

#### PKOE-007: IMAP IDLE ingress fallback

- **Area**: Live channels
- **Phase**: OPT
- **Effort**: M (~2d)
- **Status**: Planned
- **Description**: A worker service doing IMAP IDLE on a dedicated mailbox (app password) that feeds the same `/ingest/email` pipeline internally. Use it if Cloudflare forwarding fails SPK-004.
- **Blocked by**: PKOE-002
- **Blocks**: none
- **Acceptance criteria**:
  - It reconnects after a network drop; no duplicates after a reconnect.
- **Source**: plan-banking.md

#### AI-009: Expo push for questions and live payments

- **Area**: AI
- **Phase**: OPT
- **Effort**: M (~2.5d)
- **Status**: Planned
- **Needs the owner or partner**: yes
- **Description**: `expo-notifications`, push token registration, a push channel in the notifications dispatcher, and per-user settings.
- **Blocked by**: AI-008, CLN-015
- **Blocks**: none
- **Acceptance criteria**:
  - A question push arrives on the user's phone and opens the inbox item 👤.
- **Source**: plan-banking.md
