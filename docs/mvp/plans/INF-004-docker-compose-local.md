# INF-004 — Docker-compose for local Postgres + Redis + Mailpit — Implementation Plan

## 1. Task summary

- **Task ID**: INF-004
- **Title**: Docker-compose for local Postgres + Redis + Mailpit
- **Area**: Infra
- **Effort**: S (~1d)

**Context.** Every Power Budget package — backend, worker, web, mobile — depends at runtime on three pieces of stateful infrastructure: a Postgres database for the domain model, a Redis instance for BullMQ queues and refresh-token storage, and an SMTP server for outbound mail. ARCHITECTURE.md §4 explicitly lists `docker-compose.yml` at the repo root as the local equivalent of the production stack ("Postgres + Redis" callout under the monorepo tree). §10 designates Neon (Postgres) + Upstash (Redis) + Resend/SES (SMTP) as the production targets; this task gives developers a free, offline-friendly local mirror so they can run the same code paths without hitting those vendors. The Redis instance is required by the sync-job pipeline described in §9 (BullMQ queues `bank-sync`, `notification-dispatch`, `outbox-relay`, `period-close`, `ecb-fx`) and by `RedisRefreshTokenStore` in §5.1. The SMTP catcher (Mailpit) replaces the production Resend channel from §5.7 so the `ResendEmailChannel` adapter can be exercised end-to-end locally without sending real mail. INF-004 unblocks INF-008 (Drizzle migrations need a live Postgres), BE-005 (schema definition needs a target DB to migrate against), BE-019 (Wise adapter integration tests need Redis), and BE-029 (notifications-outbox worker needs Redis + SMTP). It is part of Sprint 1's Foundation deliverable per §11.

## 2. Scope

**In scope**

- A single `docker-compose.yml` at the repo root spinning up three services:
  - **Postgres 16** (pinned) with a named volume (`pb_pg_data`) so data persists across `docker compose down` (without `-v`).
  - **Redis 7** (pinned, `redis:7-alpine`) with append-only persistence on a named volume (`pb_redis_data`).
  - **Mailpit** (`axllent/mailpit:v1.20`) as the SMTP catch-all + web UI, no volume needed (in-memory store is fine for dev).
- Healthchecks on all three services so `docker compose up --wait` exits 0 only once they are ready (used by INF-005 CI smoke and by local devs).
- Convenient ports, overridable via `.env`:
  - `POSTGRES_PORT` (default `5432`)
  - `REDIS_PORT` (default `6379`)
  - `MAILPIT_SMTP_PORT` (default `1025`)
  - `MAILPIT_UI_PORT` (default `8025`)
- Postgres credentials standardised: user `power_budget`, password `power_budget`, db `power_budget` (dev-only, never used in any other environment).
- A single private bridge network `pb_local` so services can talk by hostname while still being reachable on `localhost` from the host.
- A `.env.example` at the repo root documenting every variable referenced by the compose file plus the env-var contract downstream tasks (INF-008, BE-001, BE-005, BE-019, BE-029) will read.
- `package.json` root-level scripts to start/stop/reset/log: `dev:db:up`, `dev:db:down`, `dev:db:reset`, `dev:db:logs` — invokable via `pnpm` once INF-002 has scaffolded the monorepo (this task only adds the scripts to the existing root `package.json` produced by INF-002).
- `scripts/db-reset.sh` helper that runs `docker compose down -v && docker compose up -d --wait` for a clean slate; idempotent and safe to re-run.
- `docs/local-setup.md` quickstart: prerequisites, first-time setup, common commands, troubleshooting, and the env-var contract.

**Out of scope**

- Production deployment to Fly.io + Neon + Upstash — that is INF-009 / INF-010.
- CI services. GitHub Actions in INF-005 will use its own `services:` block (Postgres + Redis as job-scoped containers); the same compose file is not reused there because Actions handles container lifecycle differently.
- Containerising the backend / worker — separate task (the Dockerfile that produces the prod image is created alongside INF-009).
- Drizzle migrations, schema, and seed data — INF-008 + BE-005. This task only commits to the `DATABASE_URL` shape downstream tasks must use; it ships no SQL.
- Anything Wise/GoCardless-specific (no GoCardless-mock service).
- Pgadmin / RedisInsight / other GUIs — see Open Question 2.
- Encryption-at-rest KEK setup — handled by SEC tasks and a separate `.env` variable.
- Backups / restore drills — not relevant for ephemeral local data.

## 3. Files to create / modify

All paths are relative to repo root.

| Path                  | Purpose                                                                                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docker-compose.yml`  | Defines the three services, their healthchecks, network, volumes, and port mappings.                                                                                                          |
| `.env.example`        | Documents every env var the compose file reads and every downstream-task contract var (`DATABASE_URL`, `REDIS_URL`, `SMTP_*`). Devs copy to `.env` on first setup. Never committed as `.env`. |
| `.env`                | Local dev values (git-ignored already by INF-001's `.gitignore`).                                                                                                                             |
| `scripts/db-reset.sh` | Convenience helper to nuke + recreate volumes; executable (`chmod +x`).                                                                                                                       |
| `package.json` (root) | Add `dev:db:up`, `dev:db:down`, `dev:db:reset`, `dev:db:logs` under `scripts`. INF-002 already created this file; this task **modifies** it.                                                  |
| `docs/local-setup.md` | Quickstart guide. Linked from the root `README.md` (which INF-001 already authored).                                                                                                          |
| `README.md` (root)    | One-line "Local development → see docs/local-setup.md" addition under a `Getting started` heading. Optional if `docs/local-setup.md` is linked from `docs/mvp/`.                              |

No other files touched. Does not create any `packages/*` files (those land in INF-002 / BE-001 / etc).

## 4. Key interfaces & contracts

These values are the contract that downstream tasks (INF-008, BE-001, BE-005, BE-019, BE-029) and the per-package code will consume. They are pinned here so the rest of the MVP can rely on them without coordination.

### Service images & versions

| Service  | Image                   | Notes                                                                                                            |
| -------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Postgres | `postgres:16.4-alpine`  | Pinned minor. Alpine for size. Matches Neon's Postgres major in production per ARCHITECTURE.md §10.              |
| Redis    | `redis:7.4-alpine`      | Pinned minor. `--appendonly yes` for durability of BullMQ state across restarts. Matches Upstash Redis 7 family. |
| Mailpit  | `axllent/mailpit:v1.20` | SMTP catch-all + web UI. No persistence configured (in-memory store).                                            |

### Credentials & database

- Postgres user: `power_budget`
- Postgres password: `power_budget` (dev-only; never reused anywhere else; clearly documented in `.env.example` as "DO NOT USE IN STAGING/PROD").
- Postgres database: `power_budget`
- Postgres bound on `localhost:${POSTGRES_PORT}` (default `5432`).

### Volumes & network

- Named volume `pb_pg_data` → `/var/lib/postgresql/data` (Postgres).
- Named volume `pb_redis_data` → `/data` (Redis with `--appendonly yes`).
- Mailpit: no volume (ephemeral).
- Bridge network `pb_local`. Services discoverable inside Docker as `postgres`, `redis`, `mailpit`. Host can reach all three on `localhost:<port>`.

### Healthchecks (so `docker compose up --wait` returns)

| Service  | Command                                                              | interval / timeout / retries / start_period |
| -------- | -------------------------------------------------------------------- | ------------------------------------------- |
| Postgres | `pg_isready -U power_budget -d power_budget`                         | 5s / 3s / 10 / 5s                           |
| Redis    | `redis-cli ping`                                                     | 5s / 3s / 10 / 2s                           |
| Mailpit  | `wget -qO- http://127.0.0.1:8025/readyz` (Mailpit ships a `/readyz`) | 5s / 3s / 10 / 2s                           |

### Env-var contract (frozen here; downstream tasks must use these names exactly)

```dotenv
# === Compose-level ===
POSTGRES_USER=power_budget
POSTGRES_PASSWORD=power_budget
POSTGRES_DB=power_budget
POSTGRES_PORT=5432

REDIS_PORT=6379

MAILPIT_SMTP_PORT=1025
MAILPIT_UI_PORT=8025

# === Application-level (consumed by packages/backend & worker) ===
DATABASE_URL=postgres://power_budget:power_budget@localhost:5432/power_budget
REDIS_URL=redis://localhost:6379
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=Power Budget <noreply@power-budget.local>
```

- `DATABASE_URL` shape mirrors what INF-008's `drizzle.config.ts` and `packages/backend`'s db module will parse.
- `REDIS_URL` is consumed by BullMQ (ARCHITECTURE.md §9) and by `RedisRefreshTokenStore` (§5.1).
- `SMTP_*` are consumed by `ResendEmailChannel`'s SMTP-compatible cousin used in dev — the actual Resend adapter switches on `NODE_ENV` (production uses Resend HTTP API; non-production uses `nodemailer` over SMTP pointing at Mailpit). The adapter selection lives in BE-029.
- The default `SMTP_FROM` uses the reserved `.local` TLD per RFC 6762 — no chance of accidentally hitting a real domain even if a message somehow escapes.

### `package.json` scripts contract

```json
{
  "scripts": {
    "dev:db:up": "docker compose up -d --wait",
    "dev:db:down": "docker compose down",
    "dev:db:reset": "bash scripts/db-reset.sh",
    "dev:db:logs": "docker compose logs -f"
  }
}
```

`dev:db:reset` deletes volumes; documented as destructive in `docs/local-setup.md`.

## 5. Step-by-step build order

Each step ≤30 min. Steps assume INF-002 has landed (root `package.json` exists, repo is a pnpm workspace).

1. **Pin image versions.** Decide and record Postgres 16.4-alpine, Redis 7.4-alpine, Mailpit v1.20. Verify each tag exists on Docker Hub / GHCR (`docker pull <image>` locally as a sanity check).
2. **Author `docker-compose.yml` skeleton.** Top-level `services:` block with `postgres`, `redis`, `mailpit`. Each service has `image`, `container_name` (`pb_postgres`, `pb_redis`, `pb_mailpit`), `restart: unless-stopped`.
3. **Wire env-var substitution.** Use `${POSTGRES_USER:-power_budget}` form throughout so `.env` overrides cleanly but defaults work even without an `.env` file. Mirror for password, db, every port.
4. **Add port mappings.** `${POSTGRES_PORT:-5432}:5432`, `${REDIS_PORT:-6379}:6379`, `${MAILPIT_SMTP_PORT:-1025}:1025`, `${MAILPIT_UI_PORT:-8025}:8025`.
5. **Declare named volumes.** Top-level `volumes:` with `pb_pg_data` and `pb_redis_data`. Mount Postgres at `/var/lib/postgresql/data`, Redis at `/data`. Redis command: `["redis-server", "--appendonly", "yes"]`.
6. **Declare network.** Top-level `networks:` with `pb_local: { driver: bridge }`. Add `networks: [pb_local]` to each service.
7. **Add healthchecks.** Per table in §4. Confirm each command works inside the container image (e.g. `pg_isready` ships with `postgres:16-alpine`; `redis-cli` ships with `redis:7-alpine`; Mailpit alpine image bundles `wget`).
8. **Add Mailpit env vars.** `MP_SMTP_AUTH_ACCEPT_ANY=1`, `MP_SMTP_AUTH_ALLOW_INSECURE=1` so the SMTP transport doesn't have to provide creds.
9. **Author `.env.example`.** Copy the block from §4. Add a comment header naming it as the source of truth and stating "Copy to `.env`; do not commit `.env`".
10. **Author `scripts/db-reset.sh`.** Two lines: `docker compose down -v` then `docker compose up -d --wait`. Add `set -euo pipefail`. `chmod +x` the file. Add a top comment warning the script destroys local data.
11. **Add the four `package.json` scripts.** Per §4. Confirm `pnpm dev:db:up` resolves (this is just `pnpm run`, no install needed).
12. **Author `docs/local-setup.md`.** Sections: Prerequisites (Docker Desktop ≥ 4.30 or Colima/OrbStack), First-time setup (`cp .env.example .env`, `pnpm dev:db:up`), Common commands (`up`/`down`/`reset`/`logs`), Env-var contract (table from §4), Troubleshooting (port clashes — change `*_PORT` in `.env`; stuck volumes — `pnpm dev:db:reset`; Mailpit UI at http://localhost:8025), Pointer to ARCHITECTURE.md §4 and §10.
13. **Link `docs/local-setup.md` from the root `README.md`** under a `## Getting started` heading.
14. **Smoke test #1 — clean boot.** From an empty state: `cp .env.example .env`, `pnpm dev:db:up`. Confirm exit code 0 and all three healthchecks green (`docker compose ps` should show `(healthy)` for all).
15. **Smoke test #2 — Postgres connect.** `psql "$DATABASE_URL" -c 'select version();'` returns a Postgres 16.x banner. (Use `pg_isready` if `psql` is not installed locally.)
16. **Smoke test #3 — Redis ping.** `redis-cli -u "$REDIS_URL" ping` returns `PONG`.
17. **Smoke test #4 — Mailpit UI.** Open http://localhost:8025 in a browser; UI loads. Send a test mail via `nc localhost 1025` or `swaks --to test@power-budget.local --server localhost:1025` and confirm it appears in the inbox.
18. **Smoke test #5 — Persistence.** `pnpm dev:db:down` (no `-v`). `pnpm dev:db:up`. Re-connect to Postgres; create a temp table; `pnpm dev:db:down`; `pnpm dev:db:up`; confirm the table is still there.
19. **Smoke test #6 — Reset.** `pnpm dev:db:reset`. Confirm the temp table from step 18 is gone.
20. **Smoke test #7 — Tear down.** `docker compose down -v`. Confirm no `pb_*` containers, volumes, or network remain (`docker ps -a | grep pb_`, `docker volume ls | grep pb_`, `docker network ls | grep pb_local`).
21. **Document the verified state** by pasting the smoke-test outputs into the PR description so the reviewer can confirm the contract.

## 6. Test plan

Infra task — verification is end-to-end, no unit tests.

- `docker compose up -d --wait` exits 0 within 30 s on a warm cache; all three services report `(healthy)` in `docker compose ps`.
- `psql "$DATABASE_URL" -c 'select version();'` returns a `PostgreSQL 16.4 …` line.
- `redis-cli -u "$REDIS_URL" ping` returns `PONG`.
- `redis-cli -u "$REDIS_URL" info server | grep redis_version` returns a `7.4.x` line.
- Mailpit UI at http://localhost:8025 responds 200 and renders the inbox.
- A mail sent through `localhost:1025` shows up in the Mailpit inbox within 1 s.
- After `pnpm dev:db:down` followed by `pnpm dev:db:up`, a row inserted before `down` is still readable (volume persistence).
- `pnpm dev:db:reset` wipes the data (named volume removed and recreated; row no longer present).
- `docker compose down -v` removes containers + volumes + the `pb_local` network. `docker ps -a`, `docker volume ls`, `docker network ls` show no `pb_*` residue.
- `cp .env.example .env` followed by `pnpm dev:db:up` works without any further edits (defaults are usable as-is).
- Port-clash test: set `POSTGRES_PORT=55432` in `.env`; `pnpm dev:db:up`; confirm Postgres reachable on `localhost:55432` and not on `5432`.

## 7. Acceptance criteria

(Refined from BACKLOG.md INF-004.)

- [ ] `docker-compose.yml` exists at repo root and declares exactly three services: `postgres` (16.4-alpine), `redis` (7.4-alpine), `mailpit` (v1.20).
- [ ] `docker compose up -d --wait` exits 0 with all three services healthy.
- [ ] Postgres exposes a configurable port via `POSTGRES_PORT` (default 5432) and the URL is templated in `.env.example` as `DATABASE_URL=postgres://power_budget:power_budget@localhost:5432/power_budget`.
- [ ] Mailpit UI reachable at `http://localhost:${MAILPIT_UI_PORT}` (default `http://localhost:8025`).
- [ ] Named volumes `pb_pg_data` and `pb_redis_data` exist; Postgres data persists across `docker compose down` (without `-v`).
- [ ] Healthchecks defined for all three services and visibly used (`docker compose ps` shows `(healthy)`).
- [ ] `.env.example` documents every variable from §4 with comments and the production-vs-dev warning on credentials.
- [ ] Root `package.json` defines `dev:db:up`, `dev:db:down`, `dev:db:reset`, `dev:db:logs` scripts that work as described in §4.
- [ ] `scripts/db-reset.sh` exists, is executable, and recreates volumes idempotently.
- [ ] `docs/local-setup.md` documents prerequisites, quickstart, env contract, and troubleshooting; linked from `README.md`.
- [ ] No `.env` (real) is committed; `.gitignore` from INF-001 already covers it.
- [ ] All smoke tests in §6 pass on a clean macOS dev machine with Docker Desktop.

## 8. Open questions / decisions

| #   | Question                                                                         | Recommended default                                                                                                                                                                                                                                                                                                            |
| --- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Postgres major — 16 or 15?                                                       | **16.** It is the active community release and matches what Neon offers on its current default. ARCHITECTURE.md §10 does not pin a version, so we set it here.                                                                                                                                                                 |
| 2   | Ship a `pgadmin` or `redisinsight` service?                                      | **No.** Keep the compose slim. Devs who want a GUI run it separately (DBeaver, TablePlus, RedisInsight desktop). Adding them now bloats memory and slows `up --wait`.                                                                                                                                                          |
| 3   | Seed `init.sql` for default categories / test users now?                         | **No.** Seeds live with BE-005 (schema) and the i18n seeded categories live with the categories domain. INF-004 ships an empty database; INF-008 owns migrations.                                                                                                                                                              |
| 4   | Default port — `5432` (standard) or non-standard to avoid clashes with local PG? | **`5432`** as documented in BACKLOG.md acceptance criterion — but **every port is overridable via `.env`**. Devs with a system Postgres set `POSTGRES_PORT=55432` in `.env`. The BACKLOG line "Postgres exposes a non-default port" is satisfied by being **configurable**, not by hard-coding off-default. Confirm with user. |
| 5   | Mailpit vs. MailHog vs. inbucket?                                                | **Mailpit.** Actively maintained successor to MailHog; smaller image; better Web UI; supports the same SMTP catch-all model. Acceptance criterion in BACKLOG.md already says "Mailpit UI reachable at http://localhost:8025".                                                                                                  |
| 6   | Use `docker-compose` (legacy v1) or `docker compose` (v2)?                       | **`docker compose`** (v2) only. Docker Desktop ≥ 4.x bundles v2; v1 is end-of-life. Document the prerequisite.                                                                                                                                                                                                                 |
| 7   | Bind to `127.0.0.1` only, or `0.0.0.0`?                                          | **`127.0.0.1`** for all three ports (compose default for short-form `5432:5432` already binds to all interfaces — explicitly use `"127.0.0.1:${POSTGRES_PORT}:5432"` form to scope to loopback). Avoids accidentally exposing the dev DB on the LAN.                                                                           |
| 8   | Should Redis run with a password locally?                                        | **No.** Local-only, loopback-bound. Adding a password complicates `REDIS_URL` and BullMQ config for zero security gain in dev. Production uses Upstash, which is TLS + token.                                                                                                                                                  |
| 9   | Should we share this compose with CI?                                            | **No.** INF-005 uses GitHub Actions `services:` for job-scoped containers — simpler model, no compose runtime needed.                                                                                                                                                                                                          |

## 9. Risks

| Risk                                                                                                                                                                                        | Mitigation                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Port clashes on dev machines** that already run system Postgres (e.g. via Postgres.app) or Redis. `up` fails with `bind: address already in use`.                                         | Every port is overridable in `.env`; `docs/local-setup.md` "Troubleshooting" section walks the dev through bumping `POSTGRES_PORT` etc. Default to `127.0.0.1`-only bind (Open Question 7) so at least the surface area is loopback.            |
| **Volume drift between machines / Postgres major upgrade later breaks `pb_pg_data`.** Postgres refuses to start on a data directory written by a different major.                           | Pin the major in `docker-compose.yml`. When upgrading (e.g. 16 → 17 in v2), document a forced `pnpm dev:db:reset` in the migration note; ephemeral local data makes this cheap. Production migrations are Neon's responsibility, separate path. |
| **BullMQ state leak across reset.** A dev runs `pnpm dev:db:reset` but Redis AOF still holds in-flight jobs from a previous run, leading to confusing replay behaviour after schema change. | `dev:db:reset` drops `pb_redis_data` too (it uses `docker compose down -v`, which wipes both volumes). Documented as "this nukes everything". For surgical resets, devs run `redis-cli flushall` instead.                                       |
