# Power Budget — Status

> Updated: 2026-10-21. Baseline: `master` @ `fdb7b19`. Repo: [dcervonyj/power-budget](https://github.com/dcervonyj/power-budget).
> Task list and real per-task status: [`docs/mvp/BACKLOG.md`](docs/mvp/BACKLOG.md) (§0 reality check, §7 v1.1 plan).
> Interactive plan (Russian): https://claude.ai/artifact/FzFRqju9yeb3b72LANBawa
> Bank-feed design: [`docs/mvp/plan-banking.md`](docs/mvp/plan-banking.md).

## TL;DR

The code is green but the product does not work. Lint, typecheck, 443 unit tests, the build and CI pass, yet almost no user journey works end to end. Treat the repo as a **pre-alpha scaffold**, not a finished MVP. The earlier "Waves 1-16 Done" claim was wrong; the old status report has been replaced by this page.

## What works

- Monorepo, CI, build, lint and typecheck; `@power-budget/core` pure logic and domain types (with known gaps in FX and privacy); Drizzle schema; adapter skeletons; design tokens.
- `GET /health` on the deployed API (Render).

## What does not work

- Web login bounces back to the login page; mobile never reaches an app screen.
- Plans and categories have no backend endpoints; dashboard, transactions and accounts return 500 (`bigint` in JSON).
- TOTP enrolment deadlocks; the household invite cannot form a household; the bank connect flow has route and contract mismatches; FX is not wired; period close always fails silently.
- Integration tests cannot load and are not in CI; many unit tests mock the code under test.
- The web app is not deployed.

## Security (the live API is exposed)

The deployed API has exploitable holes: forgeable JWT secret, a public Google OAuth stub that issues tokens, two household IDORs, a Wise consent hijack, RLS not applied, no request validation and no rate limiting. **Until CLN-001 is merged the Render service should stay suspended (NEW-001).**

## Where we are

| Item | State |
| --- | --- |
| CLN-021 close PR #121 | Done (PR #121 closed) |
| CLN-001 security hot-fix | In progress |
| CLN-020 docs truth reset | In progress (this PR) |
| NEW-001 suspend Render | Pending (owner action) |

## Plan (v1.1, about 6-8 developer-weeks for the web journeys)

P0 emergency stop, P1 foundation, M0 spikes and hosting (always-on EU VPS, Enable Banking, Wise, PKO emails), P2 working web journeys, M1 both banks to dashboard, M2 live signals, M3 AI categorisation, M4 hardening; UI polish, mobile and options run beside the chain. Details, dependencies and acceptance criteria: BACKLOG §7.

## Real status of the 122 v1.0 tasks

28 Done, 39 Partial, 33 Stub, 17 Broken, 5 Not started (BACKLOG §0, with the task that finishes each).
