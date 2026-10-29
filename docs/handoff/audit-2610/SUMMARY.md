# Audit 26 Oct 2026: SUMMARY (power-budget)

Sources: be-bugs, fe-bugs, perf, style and arch (snapshot master 47311a7). Delta checked against origin/master: #224, #219, #228, #229, and #222 (merged as b7a13aa, migration 0016). SYNC-001 has started and owns migration 0017 (transactions v2 columns, live_signals, `DrizzleTransactionRepository`). Audits were not re-run; only files the later PRs touched were re-checked.

## 0. Delta check

None of the 86 findings is fixed by #219, #222, #224, #228 or #229. Every item below is **still holds**.

| Item                                             | Touched by                                             | Result                                                                                                                                         |
| ------------------------------------------------ | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| BE-BUGS-03 watermark                             | #222 (`BankSyncProcessor`, `DrizzleSyncRunRepository`) | Still holds: `start()` still runs before `getDefaultSince()`. #222 only adds trigger/attended/fetched.                                         |
| BE-BUGS-04 / PERF-04 backoff                     | #222 (`BullMQBankSyncQueue`)                           | Still holds: `retry-config.ts` untouched, no `backoffStrategy`.                                                                                |
| BE-BUGS-08 refresh after disconnect              | #222 (`RefreshConnectionUseCase`)                      | Still holds: diff only adds `trigger`/`attended`.                                                                                              |
| BE-BUGS-10 identical rows                        | #219 (core `normalise-transaction`)                    | Still holds in the backend (`idempotent-ingest.ts` untouched). Core `normaliseText` handles diacritics, but switching keys re-ingests history. |
| ARCH-04 two models                               | #219                                                   | Still holds.                                                                                                                                   |
| FE-BUGS-08 / ARCH-01 / STYLE-12 mobile dashboard | #229 (mobile tabs now reachable)                       | Still holds and is now live: `DashboardScreen.tsx` untouched, so the first tab crashes after login.                                            |
| FE-BUGS-13                                       | #229 (mobile adapter only)                             | Still holds (web adapter).                                                                                                                     |
| FE-BUGS-01, FE-BUGS-03                           | #229 (mobile only)                                     | Still hold.                                                                                                                                    |
| PERF-03, 11, 12, 17                              | #224 (0015, audit_log FKs only)                        | Still hold.                                                                                                                                    |
| ARCH-10, PERF-08/26, ARCH-02, FE-BUGS-16         | #229                                                   | Still hold.                                                                                                                                    |

Migrations: master is at 0016, SYNC-001 holds 0017, so audit migrations start at **0018**. Next free ticket id is **CLN-031**.

## 1. Counts

| Area      | Critical | High  | Medium | Low    | Total  |
| --------- | -------- | ----- | ------ | ------ | ------ |
| BE-BUGS   | 0        | 4     | 8      | 5      | 17     |
| FE-BUGS   | 0        | 2     | 6      | 8      | 16     |
| PERF      | 0        | 1     | 8      | 18     | 27     |
| STYLE     | 0        | 0     | 6      | 7      | 13     |
| ARCH      | 0        | 1     | 7      | 5      | 13     |
| **Total** | **0**    | **8** | **35** | **43** | **86** |

After dedup, the 86 findings fold into 59 items and 44 tickets.

## 2. Deduplicated priority list

Columns:

- **M1**: BLOCKS means fix before bank work builds on it. BEFORE means it should land before M1 tickets build on it. Before M2 means before the Wise/PKO webhooks. no means independent.
- **S1** (SYNC-001): **C** = touches the transactions repository, transaction queries or the `transactions`/`transfers` schema, so it conflicts with SYNC-001.
- Effort is S/M/L.

### A. Security

| #   | IDs     | Problem                                                                                                                         | Location                                                                                                        | Fix                                                         | Eff | M1     | S1             | Ticket |
| --- | ------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | --- | ------ | -------------- | ------ |
| 1   | BE-01   | Starting a TOTP replacement turns 2FA off; login then needs no code                                                             | `TotpAuthenticator.ts:48-60`, `DrizzleTotpSecretRepository.ts:28-46`                                            | Pending-secret column, swap on first valid code             | M   | no     | migration 0018 | 032    |
| 2   | BE-02   | Magic-link TOTP is brute-forceable (per-account throttle skipped)                                                               | `throttling.ts:44-58`, `ConsumeMagicLinkUseCase.ts`, `AuthController.ts:95-110`                                 | Per-user failure counter and lockout, burn the link         | S   | no     |                | 031    |
| 3   | FE-01   | Sign-out leaves MobX stores and `pb_*` keys, so the next user in the tab sees the previous user's plans, including private ones | `SignOut.ts`, `DashboardStore`, `SettingsStore`, `HouseholdStore`, `BankConnectionStore`, `AppProviders.tsx:78` | `resetSession()` per store, clear `pb_*`                    | M   | no     |                | 034    |
| 4   | BE-12   | Register has no throttle (argon2 DoS, email probe), is non-atomic, and a 23505 gives 500                                        | `AuthController.ts:51-64`, `RegisterUserUseCase.ts:38-81`                                                       | `ThrottlerGuard`, one transaction, map 23505 to 409         | S   | no     |                | 033    |
| 5   | BE-17   | Public uncached bank catalogue burns provider quota and sleeps in the handler                                                   | `BankController.ts`, `GoCardlessBankConnector.ts:349-356`                                                       | JWT, 24 h cache, typed rate-limit error                     | S   | BEFORE |                | 033    |
| 6   | BE-08   | Disconnect keeps the encrypted consent; refresh then syncs with it                                                              | `RefreshConnectionUseCase.ts:24-39`, `DrizzleBankConnectionRepository.ts:104-109`, `BankSyncProcessor.ts:37-40` | Null consent, 409 unless active, processor skips non-active | S   | BLOCKS |                | 038    |
| 7   | PERF-04 | Failed jobs kept forever in 25 MB `noeviction` Redis; when full, refresh tokens, throttler and TOTP step-up writes fail         | `retry-config.ts:17-24`                                                                                         | `removeOnFail: {age, count}`                                | S   | BLOCKS |                | 037    |

### B. Data correctness and leaks

| #   | IDs             | Problem                                                                                                                | Location                                                                                        | Fix                                                                          | Eff | M1     | S1                | Ticket         |
| --- | --------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --- | ------ | ----------------- | -------------- |
| 8   | BE-03           | Sync watermark is always 90 days, burning provider quota                                                               | `BankSyncProcessor.ts:42-43`, `DrizzleSyncRunRepository.ts:40-48`                               | Read `since` before `start()`, last `success` run, overlap                   | S   | BLOCKS |                   | 037            |
| 9   | BE-04 / PERF-04 | `backoff: custom` unregistered: no backoff, jobs stuck active, dedup blocks manual refresh                             | `retry-config.ts:17-24`                                                                         | Register strategy or use `exponential`; test                                 | S   | BLOCKS |                   | 037            |
| 10  | BE-09           | Abandoned consent leaves an `active` connection and blocks reconnect forever                                           | `DrizzleBankConnectionRepository.ts:30,55-74`, `InitiateBankConnectionUseCase.ts:38-45`         | `pending` status until consent completes                                     | S   | BLOCKS |                   | 038            |
| 11  | BE-07           | One unsupported-currency row makes the household dashboard return 500                                                  | `IngestBankTransactionsUseCase.ts:82`, `row-values.ts:21-27`, `DrizzlePlanActivityReader.ts:96` | Validate at ingest, store as `ignored`, readers must not throw               | S   | BLOCKS | **C**             | 039            |
| 12  | BE-10           | Identical same-day purchases collapse; Polish letters stripped; check-then-insert race                                 | `idempotent-ingest.ts:12-38`, `DrizzleTransactionRepository.ts:65-84`                           | Ordinal for repeats, `onConflictDoNothing`                                   | S   | BLOCKS | **C**             | 039            |
| 13  | BE-05           | Transfer checks only look at `tx_a`: a mapped counterpart's spend vanishes; B-leg mappable; unmark on B-leg is a no-op | `MarkAsTransferUseCase.ts`, `MapTransactionUseCase.ts`, `DrizzleTransferRepository.ts:73-91`    | Match both legs, reject mapped/duplicate legs, transaction with `FOR UPDATE` | S   | no     | adjacent          | 040            |
| 14  | BE-13           | Transfer conflicts return 500                                                                                          | `DrizzleTransferRepository.ts:47-55`, `domain-error-mapping.ts`                                 | Pre-check, map 23505 to 409                                                  | S   | no     | adjacent          | 040            |
| 15  | BE-06           | Monthly plan from day 29-31 ends on the wrong day                                                                      | `plan-cloning.ts:10-47`                                                                         | Clamp to month end, keep anchor day                                          | S   | no     |                   | 041            |
| 16  | BE-11 + PERF-15 | One failing member stops the weekly digest; digest is N+1                                                              | `RunWeeklyDigestUseCase.ts:35-55`, `PlanActualsWeeklyDigestSummaryReader.ts`                    | try/catch per member, compute once per household                             | S   | no     |                   | 042            |
| 17  | BE-16           | Missed period-close run is never caught up                                                                             | `PeriodCloseUseCase.ts:30-33`, `PeriodCloseProcessor.ts`, `DrizzlePlanRepository.ts:100-106`    | Job day in payload, select `period_end &lt;= day`                            | S   | no     |                   | 042            |
| 18  | BE-14, BE-15    | Forged unplanned cursor gives 500; a note cannot be cleared                                                            | `DrizzleUnplannedTransactionReader.ts:18-74`, `TransactionsController.ts:216`                   | Reuse `decodeTransactionCursor`; pass `notes` through                        | S   | no     | **C** (BE-14)     | 043            |
| 19  | STYLE-01        | Web `MoneyView` converts FX in floats                                                                                  | `web/.../MoneyView.tsx:34-137`                                                                  | Core `convertMoney`                                                          | M   | no     |                   | 064            |
| 20  | ARCH-04         | Two domain models (29 duplicated names, `posted` vs `booked`)                                                          | core vs backend `domain/*/entities.ts`                                                          | Delete unused core duplicates now; unify `Transaction` inside SYNC-001/005   | S+M | BEFORE | **C**             | 068, then SYNC |
| 21  | ARCH-08         | No bank-sync integration test                                                                                          | `test/integration/`                                                                             | `bank-sync.integration.spec.ts` with `InMemoryBankConnector`                 | M   | BLOCKS | **C** (v2 schema) | 055            |

### C. User-visible breakage

| #   | IDs                        | Problem                                                                                                                      | Location                                                                                                                     | Fix                                                      | Eff | M1     | S1    | Ticket |
| --- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | --- | ------ | ----- | ------ |
| 22  | FE-08 + ARCH-01 + STYLE-12 | Mobile dashboard crashes on first data (local type vs contract; money as `number`). Live since #229                          | `mobile/.../DashboardScreen.tsx:21-142`, `MoneyText.tsx`                                                                     | Contract type, core `parseMinorUnits`/`formatMoney`      | S   | no     |       | 036    |
| 23  | FE-02                      | Web cannot create household, weekly or custom plans                                                                          | `PlansListScreen.tsx:54-80`, `PlanEditorScreen.tsx`                                                                          | Create-plan form                                         | M   | no     |       | 044    |
| 24  | FE-03                      | Cross-tab refresh race; a refresh 5xx ends the session in both tabs                                                          | `ApiClient.ts:112,133-152`, `LocalStorageTokenStore.ts`                                                                      | End session only on 400/401, re-read the store           | S   | no     |       | 035    |
| 25  | FE-07                      | After a deploy a stale tab replaces the whole app with "An error occurred."                                                  | `App.tsx`, `public/_redirects`, `main.tsx`                                                                                   | `/assets/*` 404, `vite:preloadError` reload              | S   | no     |       | 045    |
| 26  | FE-04 + PERF-07 + FE-14    | Category filter is a no-op; Source conflates providers; client filters auto-walk about 200 pages; OpenAPI lacks query params | `TransactionListQuery.ts`, `TransactionFilterBar.tsx`, `openapi.json`                                                        | Server-side filters, `@ApiQuery`                         | M   | BEFORE | **C** | 050    |
| 27  | FE-06                      | 42 message ids in no locale; no plurals; `&lt;html lang&gt;` fixed                                                           | `ExtractedMessageFilter.mjs`, `messageIdCoverage.spec.ts`, `index.html`                                                      | Extract adds keys, coverage for all 4 locales            | S   | no     |       | 046    |
| 28  | FE-05, 09, 10, 12          | Silent failures (add item, inline edit, transfer/ignore, delete household, register, audit log)                              | `PlanEditorScreen.tsx`, `TransactionDetailModal.tsx`, `SettingsStore.ts:162-182`, `RegisterScreen.tsx`, `AuditLogScreen.tsx` | Field errors, API error codes, load more                 | S-M | no     |       | 047    |
| 29  | FE-13 + STYLE-10           | Web `Navigator` maps 6 of 13 routes to non-existing paths                                                                    | `ReactRouterNavigationAdapter.ts:14-57`, `AppProviders.tsx:78-80`                                                            | Derive from route table, `replace: true`, `state.from`   | S   | no     |       | 035    |
| 30  | FE-15, 16                  | Onboarding unreachable; mobile dates in UTC, labels English                                                                  | `OnboardingStore.ts`, `OnboardingWizard.tsx`, `mobile/.../PlanEditorScreen.tsx:48-56`                                        | Route to onboarding, `PATCH /users/me`, `toLocalIsoDate` | S   | no     |       | 073    |
| 31  | FE-11                      | Dialog focus, form error roles, UUID row labels                                                                              | `Modal.tsx`, `Drawer.tsx`, `LoginScreen.tsx`, `TransactionListScreen.tsx:408-414`                                            | Focus trap, `useId`, roles                               | S   | no     |       | 072    |

### D. Performance (measured)

| #   | IDs                 | Problem                                                                        | Measured                                           | Fix                                                         | Eff | M1        | S1                                 | Ticket    |
| --- | ------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------- | ----------------------------------------------------------- | --- | --------- | ---------------------------------- | --------- |
| 32  | PERF-01             | `GET /transactions` joins 7 tables for every owned row before `LIMIT`          | 54,868 to 1,135 buffers (48x); 47-112 ms to 7.5 ms | CTE picks 51 ids first, row-value cursor                    | M   | BEFORE    | **C** (`list`)                     | 048       |
| 33  | PERF-03             | Dashboard transfer query seq-scans all tenants' `transfers`                    | 439 to 15 buffers; 7.8 to 2.3 ms                   | `transfers(household_id)` index                             | S   | no        | **C** (activity reader, migration) | 049       |
| 34  | PERF-12             | `GET /audit` sorts all household rows                                          | 121 buffers/page at 5k rows                        | Index `(household_id, id)`                                  | S   | no        | migration                          | 049       |
| 35  | PERF-11             | 4 duplicate indexes plus a prefix index on `transactions`                      | `_idx` twins 0 scans vs 108k; 22 MB                | Drop them                                                   | S   | no        | **C**                              | 049       |
| 36  | PERF-10             | RLS evaluates a SubPlan and functions per row                                  | 52-72 to 30-38 ms; period mappings 2-4x            | InitPlan, `household_id` on `transaction_mappings`          | M   | no        | **C**                              | 051       |
| 37  | PERF-02             | ScopedPool costs 3 round trips per statement                                   | 0.68-2.28 vs 0.29-0.46 ms (2.2-5x)                 | Scope per connection, no BEGIN/COMMIT for single statements | M   | no        |                                    | 052       |
| 38  | PERF-06             | 30 s poll sends 6 requests and polls hidden tabs                               | 6 requests to 1                                    | Poll dashboard only, pause when hidden                      | S   | no        |                                    | 053       |
| 39  | PERF-24, 25         | No reference-data cache; whole list re-renders per checkbox                    | request counts                                     | Catalogue store, row `observer`                             | M   | no        |                                    | 053 / 074 |
| 40  | PERF-13             | Bank ingest N+1: 900 statements for 300 rows                                   | statement counts                                   | Batch `INSERT ... ON CONFLICT DO NOTHING RETURNING`         | M   | BEFORE    | **C**                              | 054       |
| 41  | PERF-09, 23         | Eager Sentry tracing; two MobX copies                                          | entry 590 to 373 kB raw (188 to 118 kB gz)         | Lazy Sentry, mobx peer                                      | S   | no        |                                    | 058       |
| 42  | PERF-08, 26         | Android bundle 4.75 MB; unused native libs; 18 fonts                           | 4.75 to 2.96 MB (-38%); fonts -1.19 MB             | Tree shaking (device check), per-weight fonts               | S-M | no        |                                    | 059       |
| 43  | PERF-05, 16, 17, 18 | mjml loaded at boot; orphan export queue; 18 Redis connections; no compression | RSS 203 to 166 MB; JSON 35 to 6.3 kB               | Lazy mjml, stop enqueueing, share connection, compress      | M   | no        |                                    | 056       |
| 44  | PERF-14             | Dispatch transaction held across the Resend call                               | trace                                              | Short claim transaction, timeout                            | M   | before M2 |                                    | 057       |
| 45  | PERF-19..22         | k6 gate has no history; CI outliers; stale Turbo cache                         | outliers up to 11 min; 12-22 s                     | Seed history, cache, key by sha                             | S   | no        |                                    | 060       |
| 46  | PERF-27             | axios and ICU parser in the entry chunk                                        | about 27-70 kB (estimated)                         | Fetch client, precompiled messages                          | M   | no        |                                    | 074       |

### E. Architecture and style

| #   | IDs                            | Problem                                                               | Fix                                               | Eff | M1                | Ticket   |
| --- | ------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------- | --- | ----------------- | -------- |
| 47  | ARCH-05                        | Layer rules linted only in core                                       | Per-layer `no-restricted-imports` plus allow-list | S   | BEFORE            | 061      |
| 48  | ARCH-10                        | Config sprawl; backend template cannot boot                           | Typed `AppConfig`, one template                   | S-M | BEFORE            | 065      |
| 49  | ARCH-06                        | No Clock/IdGenerator ports                                            | Ports and adapters                                | M   | BEFORE            | 066      |
| 50  | ARCH-07                        | Two money formatters that disagree                                    | `formatMoneyParts` in core                        | S   | no                | 063      |
| 51  | ARCH-11, 12                    | Two outbox ports; presentation depends on concrete verifiers          | One outbox port, verifier port                    | S+S | before M2         | 067      |
| 52  | ARCH-02 (1), 13, 04 (deletion) | 29 `export {}` stubs, dead barrels, unused core entities              | Delete, fix ARCHITECTURE §3/§4                    | S   | no                | 068      |
| 53  | ARCH-03, 02 (2)                | Web stores use `AppProviders` singletons; logic duplicated web/mobile | Inject, then move to shared-app                   | M+M | before DSN wave 4 | 069, 070 |
| 54  | ARCH-09                        | `pnpm dev` starts only Vite                                           | `dev` scripts, `^build`                           | S   | no                | 071      |
| 55  | STYLE-08, 09, 06               | 97 braceless `if`, 118 returns, 36 switches; no rule enforced         | ESLint rules plus autofix                         | S   | no                | 062      |
| 56  | STYLE-02                       | Code uses `*UseCase`, CLAUDE.md forbids it                            | Amend the doc (D3)                                | S   | no                | 062      |
| 57  | STYLE-03, 05                   | 153 prod `as`, 237 plain-string ids                                   | Branded Drizzle columns, missing brands           | L   | no (**C**)        | 074      |
| 58  | STYLE-04, 11                   | 419 test `as`, weak assertions                                        | Builders, lint ratchet                            | L   | no                | 074      |
| 59  | STYLE-07, 13                   | 100 nested arrows; `??` review                                        | Extract, per-site review                          | M   | no                | 074      |

## 3. Proposed tickets (CLN-031 to CLN-074)

Tiers: **opus** = security, auth, tenancy; **sonnet** = bounded fixes; **cheap** = mechanical autofix. #222 is merged, so "after #222" is satisfied.

### SYNC-001 conflicts and migration order

Migrations, one open at a time (a shared `_journal.json` conflicts):

| Order | Number           | Ticket   | Note                                                                                  |
| ----- | ---------------- | -------- | ------------------------------------------------------------------------------------- |
| 1     | 0017             | SYNC-001 | not an audit ticket                                                                   |
| 2     | 0018             | CLN-032  | no transaction tables, serial only because of the journal                             |
| 3     | 0019             | CLN-049  | **C**: rebase on SYNC-001 and re-check its `transactions` indexes before dropping any |
| 4     | 0020             | CLN-051  | **C**: policies on `transactions` and `transaction_mappings`                          |
| 5     | 0021 (if needed) | CLN-038  | only if `pending` needs a CHECK/enum change                                           |

Conflicts with SYNC-001 and recommendation:

| Ticket       | Items                      | Conflict                                                                                | Recommendation                                                                                                                                                               |
| ------------ | -------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CLN-039      | BE-07, 10                  | `IngestBankTransactionsUseCase`, `DrizzleTransactionRepository` upsert, `row-values.ts` | **Fold into SYNC-001** (it rewrites the same upsert and key); else after. Keep old keys for ordinal 0; do not switch to core `normaliseText` without a key-version migration |
| CLN-054      | PERF-13                    | Same files                                                                              | Fold into SYNC-001 with CLN-039, or after it; never in parallel                                                                                                              |
| CLN-048      | PERF-01                    | `list` selects the v2 columns                                                           | **After SYNC-001**; measure on the v2 schema                                                                                                                                 |
| CLN-050      | FE-04, PERF-07, FE-14      | `list` query, DTO, `openapi.json`                                                       | **After SYNC-001 and CLN-048**; use SYNC-001's provider column                                                                                                               |
| CLN-049      | PERF-03, 11, 12            | `transactions` indexes, transfer query, 0019                                            | **After SYNC-001**; the independent `transfers` and `audit_log` indexes may be split out and shipped right after 0017                                                        |
| CLN-051      | PERF-10                    | `transactions`/`transaction_mappings` policies                                          | After SYNC-001 and CLN-048                                                                                                                                                   |
| CLN-043      | BE-14                      | Unplanned reader reads `transactions`                                                   | After SYNC-001 (rebase risk only); BE-15 has no conflict                                                                                                                     |
| CLN-040      | BE-05, 13                  | Transfer and mapping repos, not the transaction repo                                    | Adjacent; parallel if SYNC-001 does not touch transfers, else after. Confirm with the SYNC-001 owner                                                                         |
| CLN-055      | ARCH-08                    | Asserts `transactions` rows                                                             | After SYNC-001, or as its characterisation test                                                                                                                              |
| CLN-060      | PERF-19                    | k6 seed uses `transactions` columns                                                     | After SYNC-001                                                                                                                                                               |
| CLN-068, 074 | ARCH-04 deletion, STYLE-03 | Core entity deletion; Drizzle repo casts                                                | Confirm SYNC-001 uses none of the deleted entities; Drizzle repos after SYNC-001                                                                                             |

No conflict, startable now: 031, 033, 034, 035, 036, 037, 041, 042, 045, 046, 052, 056, 058, 059, 061, 063, 065, 066; then 038, 044, 047, 053.

### Security, auth, tenancy (opus)

| Ticket  | Title                                         | Items  | AC                                                                                                                                                                 | Deps / conflicts                                                           | Eff | Model |
| ------- | --------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | --- | ----- |
| CLN-031 | Per-user 2FA lockout                          | 2      | Failed second-factor attempts counted per user (about 5 per 15 min, then 429); link burned after N wrong codes; test: 25 wrong codes from 2 IPs lock out           | `TotpAuthenticator`, `LoginPolicy`; before CLN-032                         | S   | opus  |
| CLN-032 | Keep 2FA active while replacing TOTP          | 1      | Pending secret column (**0018**); `isEnabled` reads the active secret; swap on first valid code; test: abandoned replace still demands a code                      | **Serial after SYNC-001**; after CLN-031                                   | M   | opus  |
| CLN-033 | Harden registration and catalogue             | 4, 5   | Throttled register; one transaction; 23505 to 409; catalogue needs JWT, cached 24 h, HTTP-date `Retry-After`, no sleep in handler                                  | `GoCardlessBankConnector` shared with BNK work                             | S-M | opus  |
| CLN-034 | Reset client state on sign-out                | 3      | `resetSession()` on 6 stores plus `pb_*`, called from `SignOut` and `onUnauthenticated`; unit test A then B in one tab; browser check                              | Before CLN-035, 053, 069                                                   | M   | opus  |
| CLN-035 | Safe token refresh and session-end navigation | 24, 29 | End session only on 400/401; re-read store; adapter paths from the route table; `state.from` kept; tests for 503 and two-tab race                                  | `shared-app/ApiClient.ts` (rerun mobile tests); after CLN-034              | S   | opus  |
| CLN-038 | Bank connection lifecycle                     | 6, 10  | Disconnect nulls consent; refresh 409 unless `active` with consent; `pending` until `CompleteBankConsent`; scheduler selects active with consent; integration test | With CLN-037 (same bank files); migration, if any, **0021 after SYNC-001** | S-M | opus  |
| CLN-051 | RLS evaluated once per statement              | 36     | `(SELECT ...)` policies; `transaction_mappings.household_id` backfilled; tenancy specs green; EXPLAIN before/after                                                 | **0020, after SYNC-001 and CLN-049**                                       | M   | opus  |
| CLN-052 | ScopedPool round trips                        | 37     | Scope set once per checkout; no BEGIN/COMMIT for single statements; test a pooled connection never serves another scope                                            | `ScopedPool.ts`; run all integration specs                                 | M   | opus  |

### Bank pipeline

| Ticket  | Title                                    | Items   | AC                                                                                                                                                                                    | Deps / conflicts                                                                    | Eff | Model  |
| ------- | ---------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --- | ------ |
| CLN-037 | Watermark, backoff, failed-job retention | 7, 8, 9 | `since` before `start()` from the last `success` run minus overlap; backoff registered (failing job lands in `delayed`); `removeOnFail` age/count; tests on real sync_runs and BullMQ | `BankSyncProcessor`, `DrizzleSyncRunRepository`; no migration; no SYNC-001 conflict | S-M | sonnet |
| CLN-039 | Ingest: currency and identical rows      | 11, 12  | Unsupported currency stored `ignored`, dashboard stays 200; repeat rows get an ordinal (ordinal 1+ only changes the key); `onConflictDoNothing`                                       | **Fold into SYNC-001 or after**                                                     | S-M | sonnet |
| CLN-054 | Batch bank ingest                        | 40      | One `INSERT ... ON CONFLICT DO NOTHING RETURNING` per account batch; dead `findById`/`patch` removed; test counts statements                                                          | **Fold into SYNC-001 or after**; after CLN-039                                      | M   | sonnet |
| CLN-055 | Bank-sync integration test               | 21      | testcontainers spec: processor, ingest, `transactions` with `InMemoryBankConnector`; asserts dedupe, idempotent re-run, sync_runs row                                                 | After SYNC-001; before BNK-005/006, SYNC-004/006                                    | M   | sonnet |
| CLN-040 | Transfer integrity                       | 13, 14  | Mark/unmark/map check both legs; mapped or already-leg counterpart gives 409; one transaction with `FOR UPDATE`; REPRO cases as tests                                                 | Adjacent to SYNC-001                                                                | S-M | sonnet |

### Backend correctness (sonnet)

| Ticket  | Title                              | Items      | AC                                                                                                                                                                                                                   | Deps / conflicts                                  | Eff |
| ------- | ---------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | --- |
| CLN-041 | Month-end period clamp             | 15         | Day 29-31 clamps to month end and keeps the anchor; tests incl. leap year                                                                                                                                            | `plan-cloning.ts`                                 | S   |
| CLN-042 | Cron robustness                    | 16, 17     | Failing member skipped and counted; each plan and the FX table computed once; period close takes the job day and heals gaps                                                                                          | `RunWeeklyDigestUseCase`, `PeriodCloseUseCase`    | S-M |
| CLN-043 | Small API fixes                    | 18         | Forged cursor gives 400; `notes: null` clears; tests                                                                                                                                                                 | BE-14 after SYNC-001                              | S   |
| CLN-048 | `GET /transactions` two-step query | 32         | Inner id selection with LIMIT then joins; row-value cursor; same output; under 2k buffers/page on the 1M-row fixture                                                                                                 | After SYNC-001; before CLN-050/051                | M   |
| CLN-049 | Index migration                    | 33, 34, 35 | **0019**: `transfers(household_id)`, `audit_log(household_id, id)`; drop 4 duplicate `_idx` and `transactions_household_date_idx` once the serving index is confirmed                                                | **Serial after SYNC-001**                         | S   |
| CLN-050 | Server-side filters, typed queries | 26         | `categoryId`/`currency`/`source` filters; `@ApiQuery` on 5 endpoints; regenerated `api-types`; web sends them, auto-walk removed                                                                                     | After SYNC-001 and CLN-048; contract regeneration | M   |
| CLN-056 | Backend free-tier footprint        | 43         | Lazy mjml; worker imported only if `START_WORKER=true`; export queue not enqueued until a processor exists (D6); shared Redis connection, larger `drainDelay`; compression decided after checking `content-encoding` | `main.ts`, `queue.module.ts`                      | M   |
| CLN-057 | Short dispatch transaction         | 44         | Claim, send, mark as separate short steps; recipient via claim tx; Resend timeout; test 5 concurrent jobs use at most 5 connections                                                                                  | Before CLN-067                                    | M   |

### Web and mobile (sonnet)

| Ticket  | Title                                 | Items  | AC                                                                                                                                             | Deps / conflicts                              | Eff |
| ------- | ------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | --- |
| CLN-036 | Mobile dashboard uses the contract    | 22     | `PlanDashboardResponseDto`; core money parse/format; render test with a real fixture; lint rule against local types in `apiClient.get&lt;&gt;` | **Urgent**; before DSN-040                    | S   |
| CLN-044 | Create-plan form                      | 23     | Name, type, period, dates, base currency from profile; household plan creatable; 409 own message                                               | D1/D10; serial with CLN-047                   | M   |
| CLN-045 | Recover from stale chunks             | 25     | `/assets/*` 404; one reload on `vite:preloadError`; translated boundary with Reload                                                            | `_redirects`, `main.tsx`                      | S   |
| CLN-046 | i18n coverage tooling                 | 27     | Extract adds ids plus a "needs translation" list; coverage requires 4 locales; 42 ids added; ICU plurals; `&lt;html lang&gt;` follows locale   | Many UI files                                 | S-M |
| CLN-047 | Remove silent failures                | 28     | Field errors; API error in detail modal; scheduled date after delete household; register hint and 400/429; audit load more and separate error  | Serial with CLN-044                           | M   |
| CLN-053 | Poll and reference-data cache         | 38, 39 | One request per poll, pause when hidden, keep paged unplanned; plan/categories/items loaded once per plan; modals reuse the catalogue          | `PlanDashboardStore` (DSN-020); after CLN-034 | M   |
| CLN-058 | Web entry bundle                      | 41     | Sentry via dynamic import only with a DSN; one MobX copy; entry under 530 kB raw                                                               | `main.tsx`, `shared-app/package.json`         | S   |
| CLN-059 | Mobile bundle                         | 42     | Tree shaking verified on a device; `useReducedMotion` replaced; Skia/blur removed; per-weight fonts; Android under 3.2 MB raw                  | Needs a device build                          | S-M |
| CLN-072 | Dialog and form a11y                  | 31     | Focus trap/restore, unique ids, `role="alert"`, `aria-describedby`, `aria-busy`, row labels from date/description/amount                       | DSN conflicts                                 | S   |
| CLN-073 | Onboarding entry, mobile dates/labels | 30     | New users routed to onboarding; saved via `PATCH /users/me`; mobile `toLocalIsoDate` and translated labels                                     | D8                                            | S   |

### CI and tooling

| Ticket  | Title                               | Items  | AC                                                                                                                                                                                            | Deps / conflicts                             | Eff | Model                                |
| ------- | ----------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | --- | ------------------------------------ |
| CLN-060 | CI speed and perf gate with history | 45     | k6 seeds thousands of transactions and gates `GET /transactions` p95; Playwright cache; Turbo key by sha; one backend test run                                                                | `ci.yml`; after SYNC-001                     | S-M | sonnet                               |
| CLN-061 | Layer lint                          | 47     | Per-layer `no-restricted-imports`; 13 known violations on a temporary allow-list                                                                                                              | Before CLN-062                               | S   | sonnet                               |
| CLN-062 | Lint ratchet and naming doc         | 55, 56 | `curly`, padding-before-return, `switch-exhaustiveness-check`, `member-ordering`, naming, lodash ban as errors; autofix applied (split per package if over 400 lines); doc amended in 3 files | After CLN-061; merge when the queue is short | S   | cheap (autofix), sonnet for switches |
| CLN-071 | `pnpm dev` pipeline                 | 54     | `dev` scripts; `dev` depends on `^build`; one resolution strategy documented                                                                                                                  | `turbo.json`                                 | S   | sonnet                               |

### Architecture seams (sonnet)

| Ticket  | Title                                     | Items     | AC                                                                                                                                                                              | Deps / conflicts                                    | Eff |
| ------- | ----------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | --- |
| CLN-063 | One money formatter in core               | 50        | `formatMoneyParts` in core; `formatMoney` built on it; shared-app depends on core; golden tests PLN/EUR/USD (D4)                                                                | Before DSN-013/015                                  | S   |
| CLN-064 | Exact FX in `MoneyView`                   | 19        | `convertMoney` on bigint minor units; test above 2^53; no float path                                                                                                            | After CLN-063                                       | S-M |
| CLN-065 | Typed AppConfig, one env template         | 48        | One validated config for API and worker; one `.env.example`; backend boots from it; GoCardless keys flagged                                                                     | Before BNK-001                                      | S-M |
| CLN-066 | Clock and IdGenerator ports               | 49        | Ports and adapters; notifications use v7 ids; notifications and bank use cases migrated                                                                                         | Many use cases; before SYNC-002                     | M   |
| CLN-067 | One outbox port, webhook verifier port    | 51        | One `NotificationOutbox` port and adapter; guards depend on a `WebhookSignatureVerifier` port                                                                                   | After CLN-066, 057; before WISE-001/PKOE            | S-M |
| CLN-068 | shared-app scaffolding and dead code      | 52        | 29 stubs, 2 adapter stubs, unused MobX helpers, `contract/events` deleted; backend barrels, unused core export and 7 unused core entities deleted; ARCHITECTURE §3/§4 corrected | D2; confirm SYNC-001 does not use the core entities | S   |
| CLN-069 | Inject web stores                         | 53        | Constructor injection; singletons in `composition.ts`; 14 `vi.mock(AppProviders)` removed                                                                                       | After CLN-034; before CLN-070                       | M   |
| CLN-070 | Move stores to shared-app                 | 53        | `PlanDashboardStore`, mappers, `TransactionListQuery`, `BulkTransactionActions`, `PlannedItemHistory`, `SignOut` in shared-app; mobile uses them                                | D2; after CLN-069; before DSN-020/040; 2 PRs        | M-L |
| CLN-074 | Style long tail (deferred, per directory) | 46, 57-59 | Each PR clears one violation class in one directory and adds its lint ratchet; no behaviour change                                                                              | After CLN-062; Drizzle repos after SYNC-001         | L   |

Not ticketed: the `Transaction` unification and `posted`/`booked` (inside SYNC-001/005, D5); DSN-051 dead components. Unlisted models are sonnet.

### Serial order

1. Migrations: 0017 SYNC-001, 0018 CLN-032, 0019 CLN-049, 0020 CLN-051, 0021 CLN-038 if needed.
2. Transactions repo: SYNC-001 (with CLN-039/054 folded in, or after), then CLN-048, then CLN-050.
3. `eslint.config.js`: CLN-061, then CLN-062.
4. Web stores: CLN-034, 053, 069, 070 (DSN-020 owns `PlanDashboardStore`).
5. `ApiClient`: CLN-035 alone.
6. Mobile `DashboardScreen.tsx`: CLN-036 before DSN-040.

### M1 gate

Before M1 builds on the pipeline:

- CLN-037, CLN-038 and CLN-039.
- CLN-055, after SYNC-001.
- CLN-065 and CLN-066 before BNK-001 / SYNC-002.
- CLN-054 and CLN-048 before heavy ingest volume.
- CLN-067 before M2.

Everything else is independent of M1.

## 4. Decisions for the owner

1. **D1.** Should the web app create household plans? Recommended: yes, with a Personal/Household type selector; any member may create a household plan. **Decision (PO, 29 Oct 2026): accepted.** CLN-044, in progress.
2. **D2.** CLN-016 shared-app: keep or drop? Recommended: keep it as the client SDK, delete the empty scaffolding now (CLN-068), and move stores only when a DSN mobile ticket needs them (CLN-070). **Decision (PO, 29 Oct 2026): accepted.** Delete the scaffolding now (CLN-068, in progress); move stores (CLN-070) only when a DSN mobile ticket needs them.
3. **D3.** Use-case naming, `*UseCase` or none? Recommended: keep the suffix and amend CLAUDE.md, AGENTS.md and copilot-instructions; renaming 73 classes buys nothing. **Decision (PO, 29 Oct 2026): accepted.** The `*UseCase` suffix stays; the naming rule in CLAUDE.md, AGENTS.md and copilot-instructions is amended.
4. **D4.** Which money format? Recommended: the DSN one (narrow symbol, true minus U+2212, locale grouping), implemented once in core. **Decision (PO, 29 Oct 2026): accepted.** DSN money format in core (CLN-063, in progress).
5. **D5.** Transaction status `posted` or `booked`? Recommended: `booked` (matches core and plan-banking §1.10), decided inside SYNC-001. **Decision (PO, earlier): `booked`, inside SYNC-001.**
6. **D6.** Household export: build the processor now or stop enqueueing? Recommended: stop enqueueing until the GDPR export ticket ships the processor. **Decision (PO, earlier): export is not enqueued until the GDPR processor ships (#287).**
7. **D7.** Unsupported-currency bank rows: reject, ignore or support? Recommended: store as `ignored` with a visible count until FX supports more currencies. **Decision (PO, 29 Oct 2026): accepted.** Added as an acceptance criterion to SYNC-006 and BNK-006.
8. **D8.** Route every new user through onboarding and persist to the profile? Recommended: yes. **Decision (PO, 29 Oct 2026): accepted.** CLN-073, queued after CLN-044.
9. **D9.** Register 409 reveals which emails exist: neutralise or accept? Recommended: accept with a throttle; the magic-link request already hides existence. **Decision (PO, 29 Oct 2026): accepted.** Register keeps 409 behind a throttle (CLN-085, in progress).
10. **D10.** Weekly and custom periods in the web create form? Recommended: yes, the API supports them. **Decision (PO, 29 Oct 2026): accepted.** Part of CLN-044.
11. **D11.** Is production monitoring expected? The deployed web bundle has no Sentry DSN. Recommended: set it in the Pages build before launch. **Decision (PO, 29 Oct 2026): accepted.** Sentry free Developer plan, EU data region, with backend, web and mobile projects; Better Stack free uptime monitors for `/health` and the web. The PO is creating accounts; HOST-004 follows.
12. **D12.** Test style: **Decision (PO, 29 Oct 2026): golevelup `createMock`**, using `@golevelup/ts-vitest` and `@golevelup/ts-jest`, not ts-auto-mock. All specs converted; CLN-086 is done.
13. **D13.** Fold CLN-039/054 into SYNC-001 or run them after? Recommended: fold CLN-039 in (same upsert and key); run CLN-054 right after unless SYNC-001 already rewrites the batch path; everything else touching the transactions repo runs after SYNC-001 merges. **Decision (PO, earlier): CLN-039 and CLN-054 run after SYNC-001.**

## 5. Not checked (union)

- **Live and runtime:**
  - No login or account, so FE-01, 03, 05 and 09 are code trace plus local repro.
  - Not measured: real Neon/Render latency, production `pg_stat_statements`, real payload bytes, Render edge compression.
  - Not observed: throttler behind the proxy chain (`TRUST_PROXY`), Sentry PII scrubbing.
- **Mobile:** no device or simulator run. The dashboard crash is derived from the schema and code, and bundle sizes come from `expo export`. APK size was not checked.
- **Bank scope:**
  - Enable Banking, Wise and PKO connectors (not built), Wise `completeConsent`, and GoCardless beyond generic logic.
  - Bank connect screens (`MOCK_BANKS`, missing consent callback; BNK-005, WEB-010, WEB-011).
  - No app shell or navigation (UI-009); mobile Google OAuth (CLN-015).
- **Core and data:**
  - Core maths beyond how callers use it.
  - `pnpm db:check` was not run.
  - The access JWT keeps `householdId` for 15 minutes after invite accept or household deletion (possible, unverified, in no report table).
- **Content and tooling:**
  - Not checked: i18n translation quality, UI style and theme regressions, React Profiler timings (PERF-25 is from code), per-site judgement of `??` and `| null`, and the 223 unused exported types.
  - Full lint, typecheck and test reruns were skipped; style counts come from an AST scanner.
  - Write-path lock contention and the invite/auth queries were not checked.
- **Environment:** container-level startup and RSS (measured on macOS arm64), Docker build time, and Render Key Value limits (commonly cited figures used).
- **This synthesis:**
  - Only files touched by #219, #222, #224, #228 and #229 were re-checked; #222 was compared as a branch diff before it merged.
  - SYNC-001's real file list was not inspected; the S1 column follows the coordinator's description.
  - `docs/mvp/plan-banking.md` was not re-read; the M1 column follows the audits' own statements.
  - The Redis exhaustion figure (about 5,400 kept failures fill 25 MB) is the perf audit's estimate.
