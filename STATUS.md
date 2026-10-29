# Power Budget — Status

> Updated: 2026-10-30. Baseline: `master` @ `9539cdd`. Repo: [dcervonyj/power-budget](https://github.com/dcervonyj/power-budget).
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
- Monitoring (D11, HOST-004 partly done, 30 Oct): Sentry in the EU for backend, web and mobile (DSNs set on Render, Cloudflare Pages and in `eas.json`), Better Stack free uptime monitors on `/health` and the web with email alerts; see [`docs/runbooks/monitoring.md`](docs/runbooks/monitoring.md).
- Done 29 Oct: CLN-084 (#328), CLN-085 (#329), CLN-068 (#330), CLN-044 (#331), CLN-063 (#332), CLN-086 (#333, #336–#342), CLN-073 (#334), CLN-087 (#335), CLN-088 (#343), DSN-051 (#344).
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

| Series                                                           | State                                                                              |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| CLN-001 to CLN-020 audit fixes, CLN-021 to CLN-077 follow-ups    | Done, except CLN-070 (deferred under D2)                                           |
| D7 Glass DSN-010 to DSN-050 (web and mobile)                     | Done, except DSN-047 and DSN-048 (phone checks) |
| CLN-074 a-k style audit (no casts, ratchet lint, nullish review) | Done                                                                               |
| CLN-077 Dependabot alerts, CLN-028 dependency batch              | Done                                                                               |
| CLN-079 to CLN-083 (28 Oct)                                      | Done                                                                               |
| BNK-002, BNK-003, SYNC-001 (bank v2 foundation)                  | Done                                                                               |
| AI-001, AI-003, AI-004                                           | Done; AI-005+ blocked                                                              |
| SYNC-005 live sync, SPK-001/002/003, HOST-003                    | Blocked on PO                                                                      |

## Blocked on PO

Domain (HOST-003, Resend domain, SPK-004); Enable Banking account (SPK-001); Wise token (SPK-002); PKO email samples (SPK-003); Claude API key (AI-005+); phone for UI-016 and DSN-047/048 checks; SPK-005 history export and 150 labels; CLN-015 C14; 9 fact questions on the PO guide that only the PO can answer (plan-02 partner and Enable Banking, plan-05 Wise tokens, plan-06 Gmail and phones, plan-07 PKO products for SPK-001/002/003; plan-16 hours a week; voice-01 to voice-04). The other PO guide questions got their recommended defaults on 30 Oct.

## PO decisions of 29 Oct

Recorded in [`docs/handoff/audit-2610/SUMMARY.md`](docs/handoff/audit-2610/SUMMARY.md) §4. D1 and D10: plan type selector and weekly/custom periods done (CLN-044). D2: shared-app scaffolding removed (CLN-068); CLN-070 deferred. D3: `*UseCase` suffix stays. D4: money format in core (CLN-063). D5, D6 and D13: `booked` in SYNC-001; export waits for the GDPR processor; CLN-039 and CLN-054 follow SYNC-001. D7: unsupported currencies stored as `ignored` with a visible count. D8: onboarding for every new user (CLN-073). D9: register keeps 409 behind a throttle (CLN-085). D11: Sentry free Developer plan in the EU, with backend, web and mobile projects, plus Better Stack free uptime monitors for `/health` and the web. Set up on 30 Oct (HOST-004 partly done). D12: golevelup `createMock` selected; all specs converted (CLN-086). AI-003 follow-ups F6 and F7 dropped.

## Task counts

The v1.0 catalogue counts in `docs/mvp/BACKLOG.md` §0 are derived from its status lines as of 29 Oct; see §7 for the v1.1 plan.
