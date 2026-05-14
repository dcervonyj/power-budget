# Local Development Setup

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Docker Desktop | ≥ 4.30 | On macOS, [Colima](https://github.com/abiosoft/colima) or [OrbStack](https://orbstack.dev/) work too |
| Node.js | 22.x | Use `nvm use` or install via [nvm](https://github.com/nvm-sh/nvm) |
| pnpm | 9.x | Enable via `corepack enable` |

## First-time setup

```bash
cp .env.example .env
pnpm dev:db:up
```

`pnpm dev:db:up` starts Postgres, Redis, and Mailpit in detached mode and waits until all three healthchecks pass.

## Common commands

| Command | Description |
|---|---|
| `pnpm dev:db:up` | Start Postgres + Redis + Mailpit (detached, waits for healthy) |
| `pnpm dev:db:down` | Stop all local infrastructure containers |
| `pnpm dev:db:reset` | **Destructive** — remove volumes and start fresh |
| `pnpm dev:db:logs` | Tail logs from all infrastructure containers |

## Environment variables

Copy `.env.example` to `.env`. Never commit `.env`.

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_PORT` | `5432` | Host port for Postgres; change to avoid conflicts |
| `REDIS_PORT` | `6379` | Host port for Redis |
| `MAILPIT_SMTP_PORT` | `1025` | Host port for Mailpit SMTP |
| `MAILPIT_UI_PORT` | `8025` | Host port for Mailpit web UI |
| `POSTGRES_USER` | `power_budget` | Postgres superuser (dev-only) |
| `POSTGRES_PASSWORD` | `power_budget` | Postgres password (dev-only) |
| `POSTGRES_DB` | `power_budget` | Default database name |
| `DATABASE_URL` | `postgres://power_budget:power_budget@localhost:5432/power_budget` | Full connection string for the backend |
| `REDIS_URL` | `redis://localhost:6379` | Full Redis connection string |
| `SMTP_HOST` | `localhost` | SMTP server host (points to Mailpit) |
| `SMTP_PORT` | `1025` | SMTP port |
| `SMTP_USER` | _(empty)_ | SMTP username (not required for Mailpit) |
| `SMTP_PASSWORD` | _(empty)_ | SMTP password (not required for Mailpit) |
| `SMTP_FROM` | `Power Budget <noreply@power-budget.local>` | Default sender address |

## Troubleshooting

**Port conflicts** — If another process is already using a port, override it in `.env`:

```dotenv
POSTGRES_PORT=5433
REDIS_PORT=6380
```

Then restart with `pnpm dev:db:down && pnpm dev:db:up`.

**Stuck or corrupted volumes** — Run the destructive reset (removes all local data):

```bash
pnpm dev:db:reset
```

**Mailpit UI** — View captured outgoing emails at <http://localhost:8025>.

**Connect to Postgres** — Use the `DATABASE_URL` from your `.env`:

```bash
psql "$DATABASE_URL"
```

**Ping Redis**:

```bash
redis-cli -u "$REDIS_URL" ping
```

## Reference

- [ARCHITECTURE.md §4 — Infrastructure](./mvp/ARCHITECTURE.md) — services, ports, and credentials contract
- [ARCHITECTURE.md §10 — Local Dev](./mvp/ARCHITECTURE.md) — docker-compose topology details
