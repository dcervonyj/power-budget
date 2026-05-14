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
