# Power Budget — Status

> Updated: 2026-10-29. Baseline: `master` @ `46294e7`. Repo: [dcervonyj/power-budget](https://github.com/dcervonyj/power-budget).
> Task list and real per-task status: [`docs/mvp/BACKLOG.md`](docs/mvp/BACKLOG.md) (§0 reality check, §7 v1.1 plan).
> Interactive plan (Russian): https://claude.ai/artifact/FzFRqju9yeb3b72LANBawa
> Bank-feed design: [`docs/mvp/plan-banking.md`](docs/mvp/plan-banking.md).

## TL;DR

The product moved from pre-alpha scaffold to a working, deployed, restyled web app plus mobile screens: the API (Render, Frankfurt) and the web (Cloudflare Pages) are live and answer 200. The 21 Oct security holes are fixed. What is still missing is the real bank feed: Enable Banking, Wise and PKO are blocked on credentials and samples, so transactions come from manual entry and the existing connectors only. This page replaced the old "Waves Done" claims; it is a snapshot, not a test report.

## What works

- Deployed: API `GET /health` returns 200 (Render Starter, HOST-001); web at https://power-budget.pages.dev returns 200 (Cloudflare Pages, git-connected to `master`, INF-011).
- Backend fixes from the audit (merged): auth with TOTP and second-factor limits (CLN-004, CLN-031, CLN-032), RLS tenancy (CLN-005), request validation and money as strings (CLN-002), plans, categories and preferences API (CLN-011), FX rates (CLN-013), dashboard actuals in core (CLN-012), household invite (CLN-006), notifications and period close (CLN-009), keyset and server-side transaction filters (CLN-008r, CLN-024, CLN-048, CLN-050), household export and GDPR purge (CLN-022, CLN-076), crons only in the worker (CLN-010).
- Real integration harness, HTTP e2e and bank sync pipeline specs in CI (CLN-003, CLN-017, CLN-055).
- Web on the D7 glass kit: auth, onboarding, app shell, overview on real plan data, transactions list/detail/manual add, plans, categories, household, bank screens, settings, audit log (DSN-010 to DSN-028); a11y audit (DSN-050, CLN-072).
- Mobile: Expo SDK 58, auth-driven navigation and secure token storage, glass kit, Overview, Transactions, Add expense, To sort, plans, Settings (CLN-015, CLN-030, DSN-030 to DSN-046).
- Bank v2 foundation: `BankConnector` v2 port and schema (BNK-002, BNK-003, SYNC-001), batched ingest and watermark fixes (CLN-054, CLN-037, CLN-038).
- AI categorisation, local part only: transaction normalisation (AI-001), merchant memory rules (AI-003), planned item match hints (AI-004).
- Polish, Ukrainian and Russian translations (UI-I18N).
- Done 28 Oct: CLN-079 (#323), CLN-081 (#324), CLN-083 (#325), CLN-082 (#326), CLN-080 (#327, mobile `Input` error read as the field's accessibility hint).

## What does not work / gaps

- No live bank feed: Enable Banking (SPK-001, SYNC-005), Wise (SPK-002) and PKO email parsing (SPK-003) are not done; real descriptors for AI-001 waived until samples arrive.
- LLM categorisation (AI-005 onwards) not started: no Claude API key.
- No custom domain, so no Resend sender domain and no PKO inbound email (HOST-003, SPK-004).
- Mobile has no device check (UI-016 needs a phone; it now also covers the VoiceOver/TalkBack check of the `Input` error from CLN-080).
- Unsupported-currency bank rows are stored as `ignored` with a visible count (D7, acceptance criterion of SYNC-006 and BNK-006).
- Not verified here: end-to-end browser walkthrough of every journey after the restyle. Test counts have changed since the 443 figure; run CI for current numbers.

## Security

Fixed on master: forgeable JWT secret (API refuses to boot without 32+ bytes), Google OAuth stub removed, household IDORs, Wise consent hijack, signed bounce webhook, Swagger and CORS gated (CLN-001); RLS enforced (CLN-005, CLN-051); request validation (CLN-002); Redis-backed throttling and second-factor attempt limits (CLN-031). Dependabot alerts addressed in CLN-028 and CLN-077 (react-router 7, fast-xml-parser 5, esbuild 0.25). Left open: zod 3.25.76 via @expo/cli (the vulnerable v4 code is unused), node-forge and deepmerge (dev tooling, no patched version); reasons in PR #317. The "keep Render suspended" advice is obsolete: the service is live.

## Where we are

| Series                                                           | State                                                                                                                                                                               |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CLN-001 to CLN-020 audit fixes, CLN-021 to CLN-077 follow-ups    | Done, except CLN-044, CLN-063, CLN-068, CLN-085 (in progress), CLN-073 (queued after CLN-044), CLN-070 (only when a DSN mobile ticket needs the stores) and CLN-086 (spike running) |
| D7 Glass DSN-010 to DSN-050 (web and mobile)                     | Done, except DSN-047 and DSN-048; DSN-051 last                                                                                                                                      |
| CLN-074 a-k style audit (no casts, ratchet lint, nullish review) | Done                                                                                                                                                                                |
| CLN-077 Dependabot alerts, CLN-028 dependency batch              | Done                                                                                                                                                                                |
| CLN-079 to CLN-083 (28 Oct)                                      | Done                                                                                                                                                                                |
| BNK-002, BNK-003, SYNC-001 (bank v2 foundation)                  | Done                                                                                                                                                                                |
| AI-001, AI-003, AI-004                                           | Done; AI-005+ blocked                                                                                                                                                               |
| SYNC-005 live sync, SPK-001/002/003, HOST-003                    | Blocked on PO                                                                                                                                                                       |

## Blocked on PO

Domain (HOST-003, Resend domain, SPK-004, PKO inbound email); Enable Banking account (SPK-001, then M1 and SYNC-005); Wise token (SPK-002); PKO email samples (SPK-003); Claude API key (AI-005+); a phone for UI-016; 32 open questions on the PO guide; CLN-015 C14; the choice of a free monitoring service (D11, research running).

## PO decisions of 29 Oct

Recorded in [`docs/handoff/audit-2610/SUMMARY.md`](docs/handoff/audit-2610/SUMMARY.md) §4. D1 and D10: the web create form gets a Personal/Household selector (any member) and weekly and custom periods (CLN-044, in progress). D2: shared-app stays as the client SDK; scaffolding deleted now (CLN-068, in progress), stores move later (CLN-070). D3: the `*UseCase` suffix stays; the naming rule in CLAUDE.md, AGENTS.md and copilot-instructions is amended. D4: DSN money format in core (CLN-063, in progress). D5, D6, D13 (earlier): `booked` inside SYNC-001; export not enqueued until the GDPR processor ships (#287); CLN-039 and CLN-054 after SYNC-001. D7: unsupported-currency rows stored as `ignored` with a visible count. D8: every new user goes through onboarding, saved to the profile (CLN-073, queued after CLN-044). D9: register keeps 409 behind a throttle (CLN-085, in progress). D11: monitoring accepted, free service not chosen yet. D12: add ts-auto-mock and keep the `createMock<T>` rule (CLN-086, spike running). The AI-003 review follow-ups F6 and F7 are dropped.

## Task counts

Not derived here. `docs/mvp/BACKLOG.md` §0 still shows the 21 Oct counts (29 Done of 122) and is stale; see §7 and each task's `Status` line.
