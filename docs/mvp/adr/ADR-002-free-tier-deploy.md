# ADR-002: Free-tier test deployment topology (Render instead of Fly.io)

- **Status**: Accepted
- **Date**: 2026-06-10
- **Relates to**: INF-009, INF-010, INF-011, ARCHITECTURE.md §10 Option A

## Context

ARCHITECTURE.md §10 Option A specifies Fly.io with two apps (`power-budget-api`,
`power-budget-worker`) sharing one Docker image. Since that was written, Fly.io removed
its free tier (trial credits only). The MVP is a test deployment for two users; the
constraint is **$0/month**, not availability or latency.

## Decision

| Concern        | Choice                                  | Notes                                                           |
| -------------- | --------------------------------------- | --------------------------------------------------------------- |
| API + worker   | Render free web service (Docker)        | Sleeps after 15 min idle; cold start ~30–60 s — acceptable      |
| Worker process | **Embedded in the API process**         | `START_WORKER=true` boots `WorkerModule` inside `main.ts`       |
| Postgres       | Neon free tier                          | Unchanged from INF-010                                          |
| Redis          | Upstash free tier (500k commands/month) | BullMQ polling must be tuned down (see below)                   |
| Web            | Cloudflare Pages                        | Unchanged from INF-011                                          |
| Email          | Resend free tier                        | `resend` SDK already a backend dependency                       |
| Mobile         | Expo Go + EAS free builds (Android APK) | iOS standalone deferred until an Apple Developer account exists |

### Why an embedded worker

Render background workers are paid. Running `WorkerModule` as a second NestJS
application context inside the API process keeps one free service instead of two.
The standalone entrypoint (`dist/src/worker.main.js`) remains the production topology;
the embedded mode is opt-in via `START_WORKER` and changes no queue semantics
(same Redis, same BullMQ consumers).

### Upstash command-quota caveat

BullMQ polls Redis continuously and can exhaust the 500k commands/month free quota.
Mitigations for the test deployment:

- run only the queues that are exercised (worker concurrency stays at defaults);
- the API service sleeps when idle, which also stops the embedded worker's polling;
- if the quota is still exceeded, raise BullMQ `drainDelay` or disable
  `START_WORKER` and trigger jobs manually.

### Migrations

The container entrypoint runs `node drizzle/migrate.mjs` before starting the API.
`migrate.ts` was converted to plain ESM JavaScript (`migrate.mjs`) so the production
image does not need `tsx` (a devDependency).

## Consequences

- `fly.toml` files are never created; INF-009/INF-010/INF-013 acceptance criteria are
  re-interpreted against Render (deploy succeeds, TLS via `onrender.com` cert,
  worker has no extra public listener because it shares the API process).
- Cold starts make the first request after idle slow; fine for a test version,
  unacceptable for v3 SaaS — revisit this ADR before any paid launch.
- `render.yaml` (repo root) is the source of truth for service configuration;
  secrets are set only in the Render dashboard (`sync: false`).
- CI (`build.yml`) triggers deploys through the `RENDER_DEPLOY_HOOK_URL` secret and
  is a no-op until the secret is configured.
