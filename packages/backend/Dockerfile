# Backend image: NestJS API + BullMQ worker.
# Build context is the repo root:
#   docker build -f packages/backend/Dockerfile .
#
# Topologies (ADR-002):
#   - Free tier (Render): default CMD runs migrations, then API with START_WORKER=true
#     so the worker runs embedded in the same process.
#   - Standalone worker: override CMD with ["node", "dist/src/worker.main.js"].

FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json tsconfig.json ./
COPY packages/core packages/core
COPY packages/backend packages/backend

RUN pnpm install --frozen-lockfile --filter "@power-budget/backend..."
RUN pnpm --filter "@power-budget/core" build && pnpm --filter "@power-budget/backend" build
RUN pnpm --filter "@power-budget/backend" deploy --prod /prod/backend

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /prod/backend ./
USER app

EXPOSE 3000
CMD ["sh", "-c", "node drizzle/migrate.mjs && node dist/src/main.js"]
