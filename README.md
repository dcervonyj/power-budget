# Power Budget

A multi-currency household budgeting app that links real bank transactions to a plan.

## Getting started

See [docs/local-setup.md](docs/local-setup.md) for prerequisites and first-time setup.

## Prerequisites

- Node.js 22 (use `nvm use` or `corepack`)
- pnpm 9 via corepack: `corepack enable`

## Bootstrap

```bash
corepack enable
pnpm install
```

## Required configuration

The API refuses to start without `JWT_SECRET` (at least 32 bytes, e.g. `openssl rand -base64 48`).
Swagger UI (`/docs`) is served only with `SWAGGER_ENABLED=true`, CORS only for the origins in
`CORS_ORIGINS`, and the Resend bounce webhook needs `RESEND_WEBHOOK_SECRET`. See
[`.env.example`](.env.example) and [ADR-002](docs/mvp/adr/ADR-002-free-tier-deploy.md).

## Common commands

```bash
pnpm build        # build all packages (turbo, topology-aware)
pnpm dev          # start all dev servers
pnpm lint         # lint all packages
pnpm typecheck    # typecheck all packages
pnpm test         # run all tests
pnpm clean        # remove all build artefacts

pnpm dev:db:up    # start Postgres + Redis + Mailpit via docker compose
pnpm dev:db:down  # stop local infrastructure
pnpm dev:db:reset # nuke and recreate volumes
```

## Documentation

See [`docs/mvp/`](./docs/mvp/) for architecture, product requirements, and backlog.
